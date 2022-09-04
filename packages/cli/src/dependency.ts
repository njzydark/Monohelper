import { MonorepoHelperCore } from "@monorepo-helper/core";
import path from "path";
import { program } from "./program";

export const dependencyAction = async (
  dependencyNames: string[] = [],
  opts: {
    checkVersion?: boolean;
    diff?: boolean;
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

  const monorepoHelper = new MonorepoHelperCore({
    rootDirectoryPath: process.cwd(),
    lockFileDirectoryPath: path.join(process.cwd(), "common/config/rush"),
    packageManager: globaOptions.packageManager as any,
  });

  await monorepoHelper.init();

  if (opts.checkVersion) {
    monorepoHelper.checkVersion({
      silent: false,
      dependencyNames,
      onlyDifferentVersion: opts.diff,
      includePackageNames: opts.includePackage,
      excludePackageNames: opts.excludePackage,
    });
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
      excludePackageName: opts.excludePackage,
    });
  }
};
