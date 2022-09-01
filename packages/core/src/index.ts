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

export class MonorepoHelperCore {
  config: Required<IMonorepoHelperCoreConfig>;
  packages: IPackageItem[] = [];

  constructor(config: IMonorepoHelperCoreConfig) {
    this.config = { ...config, lockFileDirectoryPath: config.lockFileDirectoryPath || config.rootDirectoryPath };
  }

  async init() {
    await this.getPackagesBaseData();
    await this.getPackagesLockVersionData();
  }

  async getPackagesBaseData() {
    const packageFiles = await new Promise<string[]>((resolve, reject) => {
      glob(
        "**/package.json",
        {
          cwd: this.config.rootDirectoryPath,
          ignore: ["**/node_modules/**", "**/temp/**"],
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
      default:
        console.log("unsupported package manager: ", packageManager);
    }
  }

  async checkVersion() {
    const dependencies = this.packages.reduce<IVersionCheckDependencyItem[]>((acc, packageItem) => {
      return acc.concat(
        packageItem.dependcies.map((item) => {
          return {
            ...item,
            package: {
              name: packageItem.name,
              relativeName: packageItem.relativeName,
              path: packageItem.path,
              isRoot: packageItem.isRoot,
            },
          };
        })
      );
    }, []);

    const dependenciesObjectData = dependencies.reduce<IDependenciesObjectData>((acc, cur) => {
      if (!acc[cur.name]) {
        acc[cur.name] = [{ ...cur, packages: [cur.package] }];
      } else {
        const index = acc[cur.name].findIndex((item) => item.lockVersion && item.lockVersion === cur.lockVersion);
        if (index > -1) {
          acc[cur.name][index].packages.push(cur.package);
        } else {
          acc[cur.name].push({ ...cur, packages: [cur.package] });
        }
      }
      return acc;
    }, {});

    const uniqDependenciesObjectData = Object.keys(dependenciesObjectData).reduce<IDependenciesObjectData>(
      (acc, key) => {
        const curData = dependenciesObjectData[key];
        if (dependenciesObjectData[key].length > 1) {
          acc[key] = curData;
        }
        return acc;
      },
      {}
    );

    const uniqDependenciesCount = Object.keys(uniqDependenciesObjectData).length;

    if (uniqDependenciesCount > 0) {
      console.log(chalk.yellow("This monorepo has multiple version dependencies: "));
      console.log("");
      this.printDependenciesCheckResult(uniqDependenciesObjectData);
      console.log("");
    } else {
      console.log(chalk.green("🎉 This monorepo's all package dependencies has same version!"));
    }
  }

  async fixVersion() {
    console.log("fix version");
  }

  private printDependenciesCheckResult(data: IDependenciesObjectData) {
    const Symbols = {
      BRANCH: "├──",
      EMPTY: "",
      INDENT: "    ",
      LAST_BRANCH: "└──",
      VERTICAL: "│   ",
    };

    Object.keys(data).forEach((key, kIndex) => {
      if (kIndex !== 0) {
        console.log("");
      }
      console.log(key);
      const curItem = data[key];
      curItem.forEach((item, index) => {
        const isFirst = index === 0;
        const isLast = index === curItem.length - 1;
        isFirst && console.log(Symbols.VERTICAL);
        console.log(`${isLast ? Symbols.LAST_BRANCH : Symbols.BRANCH} ${item.lockVersion || "unknown"}`);
        item.packages.forEach((itemPackage, itemPackageIndex) => {
          const isItemPackageLast = itemPackageIndex === item.packages.length - 1;
          console.log(`${isItemPackageLast && isLast ? Symbols.INDENT : Symbols.VERTICAL}${Symbols.VERTICAL}`);
          console.log(
            `${isLast ? Symbols.INDENT : Symbols.VERTICAL}${isItemPackageLast ? Symbols.LAST_BRANCH : Symbols.BRANCH}${
              itemPackage.name
            } (${itemPackage.isRoot ? "root" : itemPackage.relativeName}) ${item.version}`
          );
        });
        if (!isLast) {
          console.log(Symbols.VERTICAL);
        }
      });
      this.printSuggestions(curItem);
    });
  }

  private printSuggestions(data: IDependenciesObjectData[string]) {
    const base = data[0];
    const versions = data.map((item) => item.lockVersion).filter(Boolean) as string[];
    const maxVersion = semver.maxSatisfying(versions, "*");
    console.log("");
    console.log(
      chalk.blue(`Suggestion: lock ${chalk.bgWhiteBright(base.name)} version to ${chalk.bgWhiteBright(maxVersion)}`)
    );
  }
}

(async () => {
  const monorepoHelper = new MonorepoHelperCore({
    rootDirectoryPath: path.resolve(__dirname, "../../../"),
    packageManager: "pnpm",
  });
  await monorepoHelper.init();
  monorepoHelper.checkVersion();
})();
