import path from "path";
import glob from "glob";
import fs from "fs/promises";
import chalk from "chalk";
import semver from "semver";

import {
  IMonorepoHelperCoreConfig,
  IPackageItem,
  IRawPackageItem,
  IDependenciesObjectData,
  IVersionCheckDependencyItem,
} from "./types";
import { getDependenciesArrayData } from "./utils";
import { pnpmLockFileParser } from "./lockFileParser/pnpm";

const supportedPackageManager = ["pnpm"];

export class MonorepoHelperCore {
  config: Required<IMonorepoHelperCoreConfig>;
  packages: IPackageItem[] = [];
  dependencies: IVersionCheckDependencyItem[] = [];
  dependenciesObjectData: IDependenciesObjectData = {};
  isPackageManagerSupport = false;

  constructor(config: IMonorepoHelperCoreConfig) {
    this.config = { ...config, lockFileDirectoryPath: config.lockFileDirectoryPath || config.rootDirectoryPath };
    if (supportedPackageManager.includes(this.config.packageManager)) {
      this.isPackageManagerSupport = true;
    }
  }

  async init() {
    await this.getPackagesBaseData();
    await this.getPackagesLockVersionData();
    this.getDependenciesObjectData();
  }

  async getPackagesBaseData() {
    const packageFiles = await new Promise<string[]>((resolve, reject) => {
      glob(
        "**/package.json",
        {
          cwd: this.config.rootDirectoryPath,
          ignore: ["**/node_modules/**", "**/temp/**", "**/common/autoinstallers/**"],
        },
        (err, matches) => {
          if (err) {
            reject(err);
          } else {
            resolve(matches);
          }
        }
      );
    });

    const dataPromises = packageFiles.map(async (item) => {
      const filePath = path.join(this.config.rootDirectoryPath, item);
      const res = await fs.readFile(filePath, "utf8");
      const parsedData = JSON.parse(res) as IRawPackageItem;

      if (!parsedData) {
        return;
      }

      const depenencies = getDependenciesArrayData(parsedData.dependencies, "dependency");
      const devDepenencies = getDependenciesArrayData(parsedData.devDependencies, "devDependency");
      const peerDepenencies = getDependenciesArrayData(parsedData.peerDependencies, "peerDependency");

      const isRoot = item.split("/").length === 1;
      const relativeName = isRoot
        ? "."
        : filePath
            .replace(this.config.rootDirectoryPath, "")
            .replace("package.json", "")
            .replace(/(^\/|\/$)/g, "");

      const packgeItem: IPackageItem = {
        path: filePath,
        name: parsedData.name,
        relativeName,
        version: parsedData.version,
        isRoot,
        dependcies: [...depenencies, ...devDepenencies, ...peerDepenencies],
      };
      return packgeItem;
    });
    const data = await Promise.all(dataPromises);
    this.packages = data.filter(Boolean) as IPackageItem[];
  }

  async getPackagesLockVersionData() {
    const { packageManager, lockFileDirectoryPath } = this.config;
    switch (packageManager) {
      case "pnpm":
        await pnpmLockFileParser(lockFileDirectoryPath, this.packages);
        break;
    }
  }

  getDependenciesObjectData() {
    this.dependencies = this.packages.reduce<IVersionCheckDependencyItem[]>((acc, packageItem) => {
      const peerDependenciesData = packageItem.dependcies
        .filter((item) => item.type === "peerDependency")
        .reduce<{ [name: string]: string }>((acc, cur) => {
          acc[cur.name] = cur.version;
          return acc;
        }, {});
      return acc.concat(
        packageItem.dependcies
          .filter((item) => item.type !== "peerDependency")
          .sort((item) => {
            if (item.type === "dependency") {
              return -1;
            } else {
              return 1;
            }
          })
          .reduce<IVersionCheckDependencyItem[]>((acc, cur) => {
            if (cur.type === "devDependency") {
              const index = acc.findIndex((item) => item.name === cur.name);
              if (index > -1) {
                if (acc[index].version !== cur.version) {
                  acc[index].devDependencyVersion = cur.version;
                }
                return acc;
              }
            }

            const peerDependencyVersion = peerDependenciesData[cur.name];
            acc.push({
              ...cur,
              peerDependencyVersion,
              package: {
                isRoot: packageItem.isRoot,
                name: packageItem.name,
                path: packageItem.path,
                relativeName: packageItem.relativeName,
                version: packageItem.version,
              },
            });
            return acc;
          }, [])
      );
    }, []);

    this.dependenciesObjectData = this.dependencies.reduce<IDependenciesObjectData>((acc, cur) => {
      if (!acc[cur.name]) {
        acc[cur.name] = [[cur]];
      } else {
        const index = acc[cur.name].findIndex((item) => item[0].lockVersion && item[0].lockVersion === cur.lockVersion);
        if (index > -1) {
          acc[cur.name][index].push(cur);
        } else {
          acc[cur.name].push([cur]);
        }
      }
      return acc;
    }, {});
  }

  checkVersion(options?: {
    /**
     * @default false
     */
    silent?: boolean;
    /**
     * @default true
     */
    onlyCheckMultipleVersionDependency?: boolean;
    /**
     * @description the dependency you want to check
     */
    dependencyNames?: string[];
    /**
     * @description the package you want to exclude when check
     */
    excludePackageNames?: string[];
  }) {
    if (!this.checkPackageManagerIsSupport()) {
      return;
    }

    const finalOptions = {
      silent: false,
      onlyCheckMultipleVersionDependency: true,
      ...options,
    };

    let dependenciesObjectData = this.dependenciesObjectData;

    const { dependencyNames, excludePackageNames } = finalOptions;
    if (dependencyNames?.length || excludePackageNames?.length) {
      dependenciesObjectData = Object.keys(dependenciesObjectData).reduce<IDependenciesObjectData>((acc, key) => {
        const curDependency = dependenciesObjectData[key];

        if (dependencyNames?.length) {
          if (dependencyNames?.some((tempname) => key.includes(tempname))) {
            acc[key] = curDependency;
          } else {
            return acc;
          }
        }

        if (excludePackageNames?.length) {
          const newDependency = curDependency.filter((item) => {
            if (
              item
                .map((item) => item.package)
                .some((temp) =>
                  excludePackageNames.some((name) => temp.name.includes(name) || temp.relativeName.includes(name))
                )
            ) {
              return false;
            }
            return true;
          });
          acc[key] = newDependency;
        }

        return acc;
      }, {});
    }

    const multipleVersionDependenciesObjectData = Object.keys(dependenciesObjectData).reduce<IDependenciesObjectData>(
      (acc, key) => {
        const curData = dependenciesObjectData[key];
        if (dependenciesObjectData[key].length > 1) {
          acc[key] = curData;
        }
        return acc;
      },
      {}
    );

    if (!finalOptions.silent) {
      finalOptions.onlyCheckMultipleVersionDependency
        ? this.printCheckResult(multipleVersionDependenciesObjectData, {
            isMultipleVersionCheck: true,
          })
        : this.printCheckResult(dependenciesObjectData, {
            isMultipleVersionCheck: false,
          });
    }

    return {
      multipleVersionDependenciesObjectData,
    };
  }

  async lockVersion(options: {
    /**
     * @default false
     */
    silent?: boolean;
    excludePackageName?: string[];
    dependencyName: string;
    dependencyVersion: string;
  }) {
    if (!this.checkPackageManagerIsSupport()) {
      return;
    }

    const { silent, excludePackageName, dependencyName, dependencyVersion } = { silent: false, ...options };

    const filteredDependencies = this.dependencies.filter((item) => {
      let flag = false;
      if (item.name === dependencyName && item.version && item.version !== dependencyVersion) {
        flag = true;
      }
      if (flag && excludePackageName?.length) {
        flag = !excludePackageName.some((name) => item.package.name === name);
      }
      return flag;
    });

    const promises = filteredDependencies.map(async (item) => {
      const path = item.package.path;
      const originData = await fs.readFile(path, "utf-8");
      if (originData) {
        const regx = new RegExp(`("${dependencyName}")(:\\s*)(".*")`, "g");
        const newData = originData.replace(regx, `$1$2"${dependencyVersion}"`);
        await fs.writeFile(path, newData);
      }
    });

    await Promise.all(promises);

    if (!silent) {
      console.log("");
      if (filteredDependencies.length) {
        console.log(chalk.green("🎉 Version locking complete!"));
      } else {
        console.log("No dependcy need to lock version");
      }
    }

    return {
      filteredDependencies,
    };
  }

  printCheckResult(
    data: IDependenciesObjectData,
    {
      isMultipleVersionCheck,
    }: {
      isMultipleVersionCheck: boolean;
    }
  ) {
    if (isMultipleVersionCheck) {
      const count = Object.keys(data).length;
      if (count === 0) {
        console.log(chalk.green("🎉 Dependencies are all the same version!"));
        return;
      }

      console.log(chalk.yellow(`Existence of ${count} different version of dependencies: `));
      console.log("");
    }

    const Symbols = {
      BRANCH: "├──",
      EMPTY: "",
      INDENT: "    ",
      LAST_BRANCH: "└──",
      VERTICAL: "│   ",
    };

    const rootKeys = Object.keys(data);
    rootKeys.forEach((key, rootIndex) => {
      const curItem = data[key];
      if (curItem.length === 0) {
        return;
      }
      if (rootIndex !== 0) {
        console.log("");
      }
      console.log(key);
      curItem.forEach((items, index) => {
        const isFirst = index === 0;
        const isLast = index === curItem.length - 1;
        isFirst && console.log(Symbols.VERTICAL);
        console.log(`${isLast ? Symbols.LAST_BRANCH : Symbols.BRANCH} ${items[0].lockVersion || "unknown"}`);
        items.forEach((item, itemIndex) => {
          const isItemPackageLast = itemIndex === items.length - 1;
          console.log(`${isLast ? Symbols.INDENT : Symbols.VERTICAL}${Symbols.VERTICAL}`);
          console.log(
            `${isLast ? Symbols.INDENT : Symbols.VERTICAL}${isItemPackageLast ? Symbols.LAST_BRANCH : Symbols.BRANCH}${
              item.package.name
            } (${item.package.isRoot ? "root" : item.package.relativeName}) ${item.version}`
          );
        });
        if (!isLast) {
          console.log(Symbols.VERTICAL);
        }
      });
      if (isMultipleVersionCheck) {
        this.printSuggestions(curItem);
      }
    });
  }

  printSuggestions(data: IDependenciesObjectData[string]) {
    const base = data[0][0];
    const versions = data.map((item) => item[0].lockVersion?.split("_")[0]).filter(Boolean) as string[];
    const maxVersion = semver.maxSatisfying(versions, "*");
    if (!maxVersion) {
      return;
    }
    console.log("");
    console.log(
      chalk.blue(
        `Suggestion: lock ${chalk.bgWhiteBright(chalk.black(base.name))} version to ${chalk.bgWhiteBright(
          chalk.black(maxVersion)
        )}`
      )
    );
  }

  private checkPackageManagerIsSupport() {
    if (!this.isPackageManagerSupport) {
      console.log(chalk.red(`Unsupported package manager: ${this.config.packageManager}`));
      return false;
    }
    return true;
  }
}

// TODO: test code
// (async () => {
//   const monorepoHelper = new MonorepoHelperCore({
//     rootDirectoryPath: path.resolve(__dirname, "../../../"),
//     packageManager: "pnpm",
//   });
//   await monorepoHelper.init();
//   monorepoHelper.checkVersion();
//   // await monorepoHelper.lockVersion({
//   //   dependencyName: "glob",
//   //   dependencyVersion: "^8.0.3",
//   // });
// })();
