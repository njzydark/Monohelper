import { readWantedLockfile, ResolvedDependencies } from "@pnpm/lockfile-file";
import { IPackageItem } from "../types";

const changePackageDependenciesData = (
  resolvedDependencies: ResolvedDependencies = {},
  packageDependencies: IPackageItem["dependcies"]
) => {
  Object.keys(resolvedDependencies).forEach((key) => {
    const cur = packageDependencies.find((item) => item.name === key);
    if (cur) {
      cur.lockVersion = resolvedDependencies?.[key];
    }
  });
  return packageDependencies;
};

export const pnpmLockFileParser = async (lockFileDirectoryPath: string, packages: IPackageItem[]) => {
  const res = await readWantedLockfile(lockFileDirectoryPath, {
    ignoreIncompatible: false,
  });
  if (!res) {
    return;
  }
  return packages.map((packageItem) => {
    const packageLockData = res.importers[packageItem.relativeName];
    if (packageLockData) {
      changePackageDependenciesData(packageLockData.dependencies, packageItem.dependcies);
      changePackageDependenciesData(packageLockData.devDependencies, packageItem.dependcies);
    }
    return packageItem;
  });
};
