import {
  MonorepoHelperCore,
  IMonorepoHelperCoreConfig,
  IncludeOrExcludeItem,
  PackageManager,
  handleLockVersion,
  getAllDependencyAndGroupedByPackagePath,
  IDependencyItem,
} from "@monohelper/core";
import { getConfig, getConfigDirectoryPath } from "@monohelper/config";
import { program } from "./program";
import { merge } from "lodash";
import { printDependencyGroupedByVersionData } from "./utils";
import chalk from "chalk";

type InitMonorepoHelperOptions = {
  includePackage?: string[];
  excludePackage?: string[];
};

const initMonorepoHelper = async ({ includePackage, excludePackage }: InitMonorepoHelperOptions) => {
  const globalOptions = program.optsWithGlobals<{ packageManager: PackageManager }>();

  const configRootPath = await getConfigDirectoryPath();
  let config: Partial<IMonorepoHelperCoreConfig> | undefined = configRootPath
    ? await getConfig(configRootPath)
    : undefined;

  const cliConfig = {
    dependencies: {
      include: {
        package: includePackage?.reduce<NonNullable<IncludeOrExcludeItem["package"]>>((acc, name) => {
          acc[name] = "*";
          return acc;
        }, {}),
      },
      exclude: {
        package: excludePackage?.reduce<NonNullable<IncludeOrExcludeItem["package"]>>((acc, name) => {
          acc[name] = "*";
          return acc;
        }, {}),
      },
    },
  };

  if (config) {
    merge<Partial<IMonorepoHelperCoreConfig>, Partial<IMonorepoHelperCoreConfig>>(config, cliConfig);
  } else {
    config = cliConfig;
  }

  return await new MonorepoHelperCore(configRootPath || process.cwd(), {
    packageManager: globalOptions.packageManager as any,
    ...config,
  }).init();
};

export const checkAction = async (
  dependencyNames: string[] = [],
  opts: {
    diff?: boolean;
    exact?: boolean;
    fix?: boolean;
    includePackage?: string[];
    excludePackage?: string[];
  }
) => {
  const { includePackage, excludePackage, diff, exact, fix } = opts;

  const monorepoHelper = await initMonorepoHelper({ includePackage, excludePackage });

  const res = monorepoHelper.checkVersion({
    dependencyNames,
    onlyDifferentVersion: diff,
    exact: exact,
  });

  if (!res) {
    return;
  }

  const { allDependencyGroupedByAutoFix, allDependencyGroupedByOnlyDifferentVersion, allDependencyGroupedByVersion } =
    res;

  if (fix) {
    const length = Object.keys(allDependencyGroupedByAutoFix).length;
    console.log("");
    if (!length) {
      console.log(`${chalk.bold.green("No dependency can be auto fix")}`);
      return;
    }
    console.log(`${chalk.bold.bgGreen(length)}${chalk.bold.green(" dependency can be auto fix")}`);
    console.log("locking...");
    const flatAutoFixAllDependency = Object.keys(allDependencyGroupedByAutoFix).reduce<IDependencyItem[]>(
      (acc, key) => {
        const curData = allDependencyGroupedByAutoFix[key];
        acc.push(...curData);
        return acc;
      },
      []
    );
    const allDependencyGroupedByPackagePath = getAllDependencyAndGroupedByPackagePath(flatAutoFixAllDependency);
    const promises = Object.keys(allDependencyGroupedByPackagePath).map((packageRelativeName) => {
      const curPackageData = allDependencyGroupedByPackagePath[packageRelativeName];
      return handleLockVersion({
        packagePath: curPackageData.packagePath,
        dependencies: curPackageData.dependencies.map((item) => ({
          name: item.name,
          version: item.manualLockVersion?.version!,
          peerVersion: item.manualLockVersion?.peerDependencyVersion,
        })),
      });
    });
    await Promise.all(promises);
    console.log("lock finish");
    return;
  }

  const data = diff ? allDependencyGroupedByOnlyDifferentVersion : allDependencyGroupedByVersion;
  const totalLength = Object.keys(data).length;
  printDependencyGroupedByVersionData({
    data,
    onItemStart: (data) => {
      return;
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
      if (diff) {
        const res = monorepoHelper.getSuggestions({ data });
        if (res) {
          // @ts-ignore
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
};

export const lockAction = async (
  dependencyName: string,
  opts: {
    includePackage?: string[];
    excludePackage?: string[];
    version: string;
    peerVersion?: string;
  }
) => {
  const { includePackage, excludePackage, version, peerVersion } = opts;

  const monorepoHelper = await initMonorepoHelper({
    includePackage,
    excludePackage,
  });

  await monorepoHelper.lockVersion({
    silent: false,
    dependencyName,
    dependencyVersion: version,
    peerVersion: peerVersion,
  });
};
