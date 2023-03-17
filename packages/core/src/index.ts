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
  PackageManager,
  IDependencyItem,
} from "@monohelper/types";

import {
  getDependenciesArrayData,
  getAllDependencyGroupedByVersion,
  setDependencyItemManualLockVersionByConfig,
  isDependencyItemNeedInclude,
  handleLockVersion,
} from "./utils";

import { pnpmLockFileParser } from "./lockFileParser/pnpm";

export * from "./utils";

export * from "@monohelper/types";

const supportedPackageManagers: PackageManager[] = ["pnpm"];

export class MonorepoHelperCore {
  rootDirectoryPath: string;
  config: IMonorepoHelperCoreConfig;
  allPackage: IAllPackage = [];
  allDependency: IAllDependency = [];
  /** grouped only by lockfile version not config's lock version */
  allDependencyGroupedByVersion: IAllDependencyGroupedByVersion = {};
  /** filter by config (include exclude) */
  allDependencyGroupedByVersionAndFiltered: IAllDependencyGroupedByVersion = {};
  isPackageManagerSupport = false;

  constructor(rootDirectoryPath: string, config: IMonorepoHelperCoreConfig) {
    this.rootDirectoryPath = rootDirectoryPath;
    this.config = { ...config, lockFileDirectoryPath: config.lockFileDirectoryPath || rootDirectoryPath };
    this.isPackageManagerSupport = supportedPackageManagers.includes(this.config.packageManager);
    return this;
  }

  async init() {
    await this.getAllPackageBaseData();
    await this.getAllPackageLockVersionData();
    this.getAllDependencyAndGroupedByVersionData();
    return this;
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

      return packgeItem;
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
   * get all dependency and grouped by version data
   */
  getAllDependencyAndGroupedByVersionData() {
    this.allDependency = this.allPackage
      .reduce<IAllDependency>((acc, packageItem) => {
        const peerDependenciesData = packageItem.dependencies
          .filter((item) => item.type === "peerDependency")
          .reduce<{ [name: string]: string }>((acc, cur) => {
            acc[cur.name] = cur.version;
            return acc;
          }, {});

        const packageItemDependencies = packageItem.dependencies
          .filter((item) => item.type !== "peerDependency")
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
                /**
                 * record dependency dev version
                 * TODO: this case should be able to be deleted
                 */
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
      }, [])
      .map((dependencyItem) => {
        return setDependencyItemManualLockVersionByConfig(dependencyItem, this.config);
      });

    // group same dependency by different version
    const { allDependencyGroupedByVersion, allDependencyGroupedByVersionAndFiltered } =
      getAllDependencyGroupedByVersion(this.allDependency, this.config);
    this.allDependencyGroupedByVersion = allDependencyGroupedByVersion;
    this.allDependencyGroupedByVersionAndFiltered = allDependencyGroupedByVersionAndFiltered;
  }

  checkVersion(options?: {
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

    // use filtered data
    let allDependencyGroupedByVersion = this.allDependencyGroupedByVersionAndFiltered;

    const { dependencyNames, exact } = finalOptions;

    // filter dependency
    if (dependencyNames?.length) {
      allDependencyGroupedByVersion = Object.keys(allDependencyGroupedByVersion).reduce<IAllDependencyGroupedByVersion>(
        (acc, key) => {
          let curDependency = allDependencyGroupedByVersion[key];
          if (dependencyNames?.some((name) => (exact ? key === name : key.includes(name)))) {
            acc[key] = curDependency;
          }
          return acc;
        },
        {}
      );
    }

    /**
     * Only different version refer these case:
     * - the dependency has multiple different version in lockfile
     * - the dependency version in package.json is different with the lock version in config(monohelper.json)
     */
    const allDependencyGroupedByOnlyDifferentVersion = Object.keys(
      allDependencyGroupedByVersion
    ).reduce<IAllDependencyGroupedByVersion>((acc, key) => {
      const allVersionData = allDependencyGroupedByVersion[key];

      let isExistsManualLockVersionDifferent = false;

      const curDataByDifferentVersion = allVersionData.filter((curVersionData) => {
        // filter by config's lock version
        const filteredData = curVersionData.filter((item) => {
          const { manualLockVersion } = item;

          const isManualLockVersionDifferent = Boolean(
            manualLockVersion?.isDifferentWithRawDependency || manualLockVersion?.isDifferentWithRawPeerDependency
          );

          if (isManualLockVersionDifferent) {
            isExistsManualLockVersionDifferent = true;
          }

          // if lock version is same as raw version, should be exclude
          return manualLockVersion?.version ? isManualLockVersionDifferent : true;
        });
        return filteredData.length > 0;
      });

      // if length > 1, mean this dependency has different lock versions (lockfile version)
      // if length === 1 and manual lock version is different with package.json's version, also mean this dependency has different version (lockfile version is same)
      if (
        curDataByDifferentVersion.length > 1 ||
        (curDataByDifferentVersion.length === 1 && isExistsManualLockVersionDifferent)
      ) {
        acc[key] = curDataByDifferentVersion;
      }

      return acc;
    }, {});

    /**
     * @description can be auto fix by config's lock version
     */
    const allDependencyGroupedByAutoFix = Object.keys(allDependencyGroupedByOnlyDifferentVersion).reduce<{
      [dependencyName: string]: IDependencyItem[];
    }>((acc, dependencyName) => {
      const data = allDependencyGroupedByOnlyDifferentVersion[dependencyName];
      const res = data.reduce<IDependencyItem[]>((acc, cur) => {
        const newData = cur.filter(
          (item) =>
            item.manualLockVersion?.isDifferentWithRawDependency ||
            item.manualLockVersion?.isDifferentWithRawPeerDependency
        );
        if (newData.length) {
          acc.push(...newData);
        }
        return acc;
      }, []);
      if (res.length) {
        acc[dependencyName] = res;
      }
      return acc;
    }, {});

    return {
      allDependencyGroupedByVersion,
      allDependencyGroupedByOnlyDifferentVersion,
      allDependencyGroupedByAutoFix,
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
     * @default dependencyVersion
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

    const finalPeerVersion = peerVersion || dependencyVersion;

    const filteredDependencies = this.allDependency.filter((item) => {
      if (!isDependencyItemNeedInclude(item, this.config)) {
        return false;
      }

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

    const promises = filteredDependencies.map((item) =>
      handleLockVersion({
        packagePath: item.package?.path,
        dependencies: [
          {
            name: item.name,
            version: dependencyVersion,
            peerVersion: item.peerDependencyVersion ? finalPeerVersion : undefined,
          },
        ],
      })
    );

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

  getSuggestions({ data }: { data: IDependencyGroupedByVersionItem; silent?: boolean }) {
    const base = data?.[0]?.[0];
    if (!base) {
      return;
    }

    // @ts-ignore
    let suggestions: IDependencyCheckSuggestionItem[] = [];

    const lockVersions = data.map((item) => item[0]?.lockVersion?.split("_")[0]).filter(Boolean) as string[];
    const uniqLockVersions = Array.from(new Set(lockVersions));
    const isExistsSameLockVersion = lockVersions.length !== uniqLockVersions.length;
    const maxLockVersion = semver.maxSatisfying(lockVersions, "*");
    const minLockVersion = semver.minSatisfying(lockVersions, "*");

    let differentVersionPeerDependencies: IAllDependencyGroupedByVersion = {};
    let differentVersionTransitivePeerDependencies: IAllDependencyGroupedByVersion = {};

    if (isExistsSameLockVersion) {
      const differentVersionDependencies = data.reduce<IAllDependency>((acc, cur) => {
        acc.push(...cur);
        return acc;
      }, []);

      const allPeerDependency = differentVersionDependencies.reduce<IAllDependency>((acc, item) => {
        item.children?.forEach((child) => {
          if (child.version && child.type === "peerDependency") {
            const cur = this.allDependency.find(
              (temp) => temp.name === child.name && temp.package?.name === item.package?.name
            );
            if (!cur) {
              return acc;
            }
            acc.push(cur);
          }
        });
        return acc;
      }, []);
      differentVersionPeerDependencies = getAllDependencyGroupedByVersion(
        allPeerDependency,
        this.config
      ).allDependencyGroupedByVersionAndFiltered;

      const allTransitivePeerDepedency = differentVersionDependencies.reduce<IAllDependency>((acc, item) => {
        item.transitivePeerDependencies?.forEach((name) => {
          const cur = this.allDependency.find(
            (temp) => temp.name === name && temp.package?.name === item.package?.name
          );
          if (!cur) {
            return acc;
          }
          acc.push(cur);
        });
        return acc;
      }, []);
      differentVersionTransitivePeerDependencies = getAllDependencyGroupedByVersion(
        allTransitivePeerDepedency,
        this.config
      ).allDependencyGroupedByVersionAndFiltered;
    }

    if (maxLockVersion && minLockVersion && maxLockVersion !== minLockVersion) {
      suggestions.push({
        type: "normal",
        message: `lock ${chalk.blue(base.name)} version to ${chalk.blue(minLockVersion)} or ${chalk.blue(
          maxLockVersion
        )}`,
      });
    }

    return {
      isExistsSameLockVersion,
      uniqLockVersions,
      maxLockVersion,
      minLockVersion,
      differentVersionPeerDependencies,
      differentVersionTransitivePeerDependencies,
      suggestions,
    };
  }

  private checkPackageManagerIsSupport() {
    if (!this.isPackageManagerSupport) {
      console.log(chalk.red(`Unsupported package manager: ${this.config.packageManager}`));
      return false;
    }
    return true;
  }
}
