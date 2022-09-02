import { PackageSnapshots, readWantedLockfile, ResolvedDependencies } from "@pnpm/lockfile-file";
import { IPackageItem } from "../types";
import { getDependenciesArrayData } from "../utils";

const changePackageDependenciesData = (
  allResolvedPackages: PackageSnapshots = {},
  resolvedDependencies: ResolvedDependencies = {},
  packageDependencies: IPackageItem["dependcies"]
) => {
  Object.keys(resolvedDependencies).forEach((key) => {
    const cur = packageDependencies.find((item) => item.name === key);
    if (cur) {
      cur.lockVersion = resolvedDependencies?.[key];
      const curChildrenData = allResolvedPackages[`/${key}/${cur.lockVersion}`];
      if (curChildrenData) {
        const dependcies = getDependenciesArrayData(curChildrenData.dependencies, "dependency");
        const peerDependencies = getDependenciesArrayData(curChildrenData.peerDependencies, "peerDependency");
        cur.children = [...dependcies, ...peerDependencies];
      }
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
    const importerName = Object.keys(res.importers || {}).find((item) => item.includes(packageItem.relativeName)) || "";
    const packageLockData = res.importers[importerName];
    if (packageLockData) {
      changePackageDependenciesData(
        res.packages,
        packageLockData.dependencies,
        packageItem.dependcies.filter((item) => item.type === "dependency")
      );
      changePackageDependenciesData(
        res.packages,
        packageLockData.devDependencies,
        packageItem.dependcies.filter((item) => item.type === "devDependency")
      );
    }
    return packageItem;
  });
};
