import path from "path";
import glob from "glob";
import fs from "fs/promises";

import { IDependencyItem, IMonorepoHelperCoreConfig, IPackageItem, IRawPackageItem } from "./types";
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
}

new MonorepoHelperCore({
  rootDirectoryPath: path.resolve(__dirname, "../../../"),
  packageManager: "pnpm",
}).init();
