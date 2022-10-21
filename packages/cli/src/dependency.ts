import { MonorepoHelperCore, IMonorepoHelperCoreConfig, IncludeOrExcludePackage } from "@monohelper/core";
import { getConfig, getConfigDirectoryPath } from "@monohelper/config";
import { program } from "./program";
import { merge } from "lodash";
import { printDependencyGroupedByVersionData } from "./utils";
import chalk from "chalk";

export const dependencyAction = async (
  dependencyNames: string[] = [],
  opts: {
    checkVersion?: boolean;
    diff?: boolean;
    exact?: boolean;
    includePackage?: string[];
    excludePackage?: string[];
    lockVersion?: boolean;
    version: string;
    peerVersion?: string;
  }
) => {
  if (!opts.checkVersion && !opts.lockVersion) {
    return;
  }

  const globaOptions = program.optsWithGlobals<{ packageManager: string }>();

  const configRootPath = await getConfigDirectoryPath();
  const config = configRootPath ? await getConfig(configRootPath) : undefined;
  if (config) {
    merge<IMonorepoHelperCoreConfig, Partial<IMonorepoHelperCoreConfig>>(config, {
      includeDependencies: {
        package: opts.includePackage?.reduce<IncludeOrExcludePackage>((acc, name) => {
          acc[name] = "*";
          return acc;
        }, {}),
      },
      excludeDependencies: {
        package: opts.excludePackage?.reduce<IncludeOrExcludePackage>((acc, name) => {
          acc[name] = "*";
          return acc;
        }, {}),
      },
    });
  }

  const monorepoHelper = await new MonorepoHelperCore(configRootPath || process.cwd(), {
    packageManager: globaOptions.packageManager as any,
    ...config,
  }).init();

  if (opts.checkVersion) {
    const res = monorepoHelper.checkVersion({
      dependencyNames,
      onlyDifferentVersion: opts.diff,
      exact: opts.exact,
    });
    if (!res) {
      return;
    }
    const data = opts.diff ? res.allDependencyGroupedByOnlyDifferentVersion : res.allDependencyGroupedByVersion;
    const totalLength = Object.keys(data).length;
    printDependencyGroupedByVersionData({
      data,
      onItemStart: (data) => {
        const base = data?.[0]?.[0];
        if (!base) {
          return;
        }
        const length = data.length;
        if (length > 1) {
          console.log(
            `${chalk.bold.bgRed("Check Failed")} ${chalk.red(
              `${chalk.bold(base.name)} has ${chalk.bold(length)} different version`
            )}`
          );
        } else {
          console.log(
            `${chalk.bold.bgGreen("Check Success")} ${chalk.green(`${chalk.bold(base.name)} has same version`)}`
          );
        }
        console.log();
      },
      onItemFinish: (data, index) => {
        if (opts.diff) {
          const res = monorepoHelper.getSuggestions({ data });
          if (res) {
            const { differentVersionPeerDependencies, differentVersionTransitivePeerDependencies, suggestions } = res;
            if (Object.keys(differentVersionPeerDependencies).length) {
              console.log();
              console.log(chalk.blue("PeerDependencies:"));
              console.log();
              printDependencyGroupedByVersionData({ data: differentVersionPeerDependencies });
            }
            if (Object.keys(differentVersionTransitivePeerDependencies).length) {
              console.log();
              console.log(chalk.blue("TransitivePeerDependencies:"));
              console.log();
              printDependencyGroupedByVersionData({ data: differentVersionTransitivePeerDependencies });
            }
          }
        }
        if (totalLength > 1 && index !== totalLength - 1) {
          console.log();
          console.log(chalk.white("======================================"));
        }
      },
    });
    process.exit(1);
  }

  if (opts.lockVersion) {
    if (dependencyNames.length === 0) {
      program.error("dependencyName is required");
    }
    await monorepoHelper.lockVersion({
      silent: false,
      dependencyName: dependencyNames[0],
      dependencyVersion: opts.version,
      peerVersion: opts.peerVersion,
    });
  }
};
