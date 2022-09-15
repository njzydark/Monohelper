import path from "path";
import glob from "glob";
import fs from "fs/promises";
import chalk from "chalk";
import semver from "semver";

import {
  IMonorepoHelperCoreConfig,
  IPackageItem,
  IRawPackageItem,
  IAllPackage,
  IAllDependency,
  IAllDependencyGroupedByVersion,
  IDependencyGroupedByVersionItem,
} from "@monohelper/types";

import { getDependenciesArrayData, filterAndSetManualLockVersionByGlobalConfig } from "./utils";
import { pnpmLockFileParser } from "./lockFileParser/pnpm";

const supportedPackageManager = ["pnpm"];

export class MonorepoHelperCore {
  rootDirectoryPath: string;
  config: IMonorepoHelperCoreConfig;
  allPackage: IAllPackage = [];
  allDependency: IAllDependency = [];
  allDependencyGroupedByVersion: IAllDependencyGroupedByVersion = {};
  isPackageManagerSupport = false;

  constructor(rootDirectoryPath: string, config: IMonorepoHelperCoreConfig) {
    this.rootDirectoryPath = rootDirectoryPath;
    this.config = { ...config, lockFileDirectoryPath: config.lockFileDirectoryPath || rootDirectoryPath };
    if (supportedPackageManager.includes(this.config.packageManager)) {
      this.isPackageManagerSupport = true;
    }
  }

  async init() {
    await this.getAllPackageBaseData();
    await this.getAllPackageLockVersionData();
    this.getAllDependencyAndDifferentVersionData();
  }

  async getAllPackageBaseData() {
    const packageFiles = await new Promise<string[]>((resolve, reject) => {
      glob(
        "**/package.json",
        {
          cwd: this.rootDirectoryPath,
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
      const filePath = path.join(this.rootDirectoryPath, item);
      const res = await fs.readFile(filePath, "utf8");
      const parsedData = JSON.parse(res) as IRawPackageItem;

      if (!parsedData) {
        return;
      }

      const dependencies = getDependenciesArrayData(parsedData.dependencies, "dependency");
      const devDependencies = getDependenciesArrayData(parsedData.devDependencies, "devDependency");
      const peerDependencies = getDependenciesArrayData(parsedData.peerDependencies, "peerDependency");

      const isRoot = item.split("/").length === 1;
      const relativeName = isRoot
        ? "."
        : filePath
            .replace(this.rootDirectoryPath, "")
            .replace("package.json", "")
            .replace(/(^\/|\/$)/g, "");

      const packgeItem: IPackageItem = {
        path: filePath,
        name: parsedData.name,
        relativeName,
        version: parsedData.version,
        isRoot,
        dependencies: [...dependencies, ...devDependencies, ...peerDependencies],
      };

      return filterAndSetManualLockVersionByGlobalConfig(packgeItem, this.config);
    });
    const data = await Promise.all(dataPromises);
    this.allPackage = data.filter(Boolean) as IAllPackage;
  }

  async getAllPackageLockVersionData() {
    const { packageManager, lockFileDirectoryPath } = this.config;
    if (!lockFileDirectoryPath) {
      return;
    }
    const finalLockFilePath = lockFileDirectoryPath.startsWith("./")
      ? path.join(this.rootDirectoryPath, lockFileDirectoryPath)
      : lockFileDirectoryPath;
    switch (packageManager) {
      case "pnpm":
        await pnpmLockFileParser(finalLockFilePath, this.allPackage);
        break;
    }
  }

  /**
   * get all package dependencies array format and object format data
   * @description
   * - dependencies: each dependency and package corresponds individually, with no de-duplication grouping
   * - dependenciesObjectData: group same dependency by different package
   */
  getAllDependencyAndDifferentVersionData() {
    this.allDependency = this.allPackage.reduce<IAllDependency>((acc, packageItem) => {
      const peerDependenciesData = packageItem.dependencies
        .filter((item) => item.type === "peerDependency")
        .reduce<{ [name: string]: string }>((acc, cur) => {
          acc[cur.name] = cur.version;
          return acc;
        }, {});

      const packageItemDependencies = packageItem.dependencies
        .filter((item) => {
          let flag = true;
          if (item.type === "peerDependency") {
            flag = false;
            return flag;
          }
          return flag;
        })
        .sort((item) => {
          if (item.type === "dependency") {
            return -1;
          } else {
            return 1;
          }
        })
        .reduce<IAllDependency>((acc, cur) => {
          if (cur.type === "devDependency") {
            const index = acc.findIndex((item) => item.name === cur.name);
            if (index > -1) {
              // record dependency dev version
              if (acc[index].version !== cur.version) {
                acc[index].devDependencyVersion = cur.version;
              }
              return acc;
            }
          }

          // record dependency peer version
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
        }, []);

      return acc.concat(packageItemDependencies);
    }, []);

    // group same dependency by different package
    this.allDependencyGroupedByVersion = this.allDependency.reduce<IAllDependencyGroupedByVersion>((acc, cur) => {
      if (!acc[cur.name]) {
        acc[cur.name] = [[cur]];
      } else {
        const index = acc[cur.name].findIndex((item) => {
          const base = item[0];
          return base.lockVersion && base.lockVersion === cur.lockVersion;
        });
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
    onlyDifferentVersion?: boolean;
    /**
     * @description the dependency you want to check
     */
    dependencyNames?: string[];
    /**
     * dependency name matched exactly
     * @default true
     */
    exact?: boolean;
  }) {
    if (!this.checkPackageManagerIsSupport()) {
      return;
    }

    const finalOptions = {
      silent: false,
      onlyDifferentVersion: true,
      exact: true,
      ...options,
    };

    let allDependencyGroupedByVersion = this.allDependencyGroupedByVersion;

    const { dependencyNames, exact } = finalOptions;

    // filter dependency
    if (dependencyNames?.length) {
      allDependencyGroupedByVersion = Object.keys(allDependencyGroupedByVersion).reduce<IAllDependencyGroupedByVersion>(
        (acc, key) => {
          let curDependency = allDependencyGroupedByVersion[key];

          // filter dependency
          if (dependencyNames?.length) {
            if (dependencyNames?.some((name) => (exact ? key === name : key.includes(name)))) {
              acc[key] = curDependency;
            } else {
              return acc;
            }
          }

          return acc;
        },
        {}
      );
    }

    const allDependencyGroupedByOnlyDifferentVersion = Object.keys(
      allDependencyGroupedByVersion
    ).reduce<IAllDependencyGroupedByVersion>((acc, key) => {
      const curData = allDependencyGroupedByVersion[key];
      // check multiple lock version
      if (allDependencyGroupedByVersion[key].length > 1) {
        acc[key] = curData;
        return acc;
      }
      // check multiple version
      const versions = curData[0]?.map((item) => item.version);
      const uniqVersions = Array.from(new Set(versions));
      if (uniqVersions.length > 1) {
        acc[key] = curData;
      }
      return acc;
    }, {});

    if (!finalOptions.silent) {
      this.printCheckResult(allDependencyGroupedByOnlyDifferentVersion, {
        isMultipleVersionCheck: finalOptions.onlyDifferentVersion,
      });
    }

    return {
      allDependencyGroupedByVersion,
      allDependencyGroupedByOnlyDifferentVersion,
    };
  }

  async lockVersion(options: {
    /**
     * @default false
     */
    silent?: boolean;
    dependencyName: string;
    dependencyVersion: string;
    /**
     * peerDependency version
     * @description set peerDependency version if it exists
     * @default ^dependencyVersion
     */
    peerVersion?: string;
  }) {
    if (!this.checkPackageManagerIsSupport()) {
      return;
    }

    const { silent, dependencyName, dependencyVersion, peerVersion } = {
      silent: false,
      ...options,
    };

    const finalPeerVersion = peerVersion || `^${dependencyVersion}`;

    const filteredDependencies = this.allDependency.filter((item) => {
      let flag = false;
      if (item.name === dependencyName) {
        if (item.version && item.version !== dependencyVersion) {
          flag = true;
        } else if (item.peerDependencyVersion && item.peerDependencyVersion !== finalPeerVersion) {
          flag = true;
        }
      }
      return flag;
    });

    const promises = filteredDependencies.map(async (item) => {
      const path = item.package?.path;
      const originData = path ? await fs.readFile(path, "utf-8") : null;
      if (originData && path) {
        const regx = new RegExp(`(dependencies|devDependencies)([^}]*)("${dependencyName}")(:\\s*)("\\S*")`, "gs");
        let newData = originData.replace(regx, `$1$2$3$4"${dependencyVersion}"`);
        if (item.peerDependencyVersion) {
          const regx = new RegExp(`(peerDependencies)([^}]*)("${dependencyName}")(:\\s*)("\\S*")`, "gs");
          newData = newData.replace(regx, `$1$2$3$4"${finalPeerVersion}"`);
        }
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
    data: IAllDependencyGroupedByVersion,
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
      console.log(chalk.bgWhite(chalk.black(key)));
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
              item.package?.name
            } (${item.package?.isRoot ? "root" : item.package?.relativeName}) ${item.version}`
          );
        });
        if (!isLast) {
          console.log(Symbols.VERTICAL);
        }
      });
      if (isMultipleVersionCheck) {
        this.getSuggestions({ data: curItem });
      }
    });
  }

  getSuggestions({ data, silent = false }: { data: IDependencyGroupedByVersionItem; silent?: boolean }) {
    const base = data?.[0]?.[0];
    if (!base) {
      return;
    }

    let suggestions: string[] = [];

    const lockVersions = data.map((item) => item[0]?.lockVersion?.split("_")[0]).filter(Boolean) as string[];
    const maxLockVersion = semver.maxSatisfying(lockVersions, "*");

    if (maxLockVersion) {
      suggestions.push(`lock ${chalk.blue(base.name)} version to ${chalk.blue(maxLockVersion)}`);
    }

    const uniqLockVersions = Array.from(new Set(lockVersions));
    const isExistsSameLockVersion = lockVersions.length !== uniqLockVersions.length;

    if (isExistsSameLockVersion) {
      const differentVersionDependencies = data.map((item) => item[0]);
      const transitivePeerDependencies = differentVersionDependencies.reduce<{
        [key: string]: {
          name: string;
          lockVersion?: string;
          version?: string;
          package?: Omit<IPackageItem, "dependencies">;
        }[];
      }>((acc, item) => {
        item.transitivePeerDependencies?.forEach((name) => {
          const cur = this.allDependency.find(
            (temp) => temp.name === name && temp.package?.name === item.package?.name
          );
          const temp = { name, version: cur?.version, lockVersion: cur?.lockVersion, package: item.package };
          if (acc[name]) {
            acc[name].push(temp);
          } else {
            acc[name] = [temp];
          }
        });
        return acc;
      }, {});
      const keys = Object.keys(transitivePeerDependencies);
      if (keys.length) {
        console.log("");
        console.log(chalk.blue("TransitivePeerDependencies"));
        console.log("");
        keys.forEach((key) => {
          console.log(key);
          const curTransitivePeerDependency = transitivePeerDependencies[key];
          curTransitivePeerDependency.forEach((item) => {
            console.log(`- ${item.package?.name} ${item.lockVersion || "unknown"}`);
          });
          const lockVersions = curTransitivePeerDependency
            .map((item) => item.lockVersion?.split("_")[0])
            .filter(Boolean) as string[];
          const maxLockVersion = semver.maxSatisfying(lockVersions, "*");
          if (maxLockVersion) {
            suggestions.push(`lock ${chalk.blue(key)} version to ${chalk.blue(maxLockVersion)}`);
          }
        });
      }
    }

    console.log("");
    console.log(chalk.blue("Suggestions:"));
    console.log("");
    suggestions.forEach((item) => {
      console.log(`- ${item}`);
    });
  }

  private checkPackageManagerIsSupport() {
    if (!this.isPackageManagerSupport) {
      console.log(chalk.red(`Unsupported package manager: ${this.config.packageManager}`));
      return false;
    }
    return true;
  }
}
