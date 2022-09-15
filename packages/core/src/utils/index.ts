import { IDependencyItem, IMonorepoHelperCoreConfig, IPackageItem, IRawDependencies } from "@monohelper/types";

/**
 * transform object raw dependencies to array data
 */
export const getDependenciesArrayData = (rawDependencies: IRawDependencies = {}, type: IDependencyItem["type"]) => {
  return Object.keys(rawDependencies).map<IDependencyItem>((key) => {
    return {
      name: key,
      version: rawDependencies[key],
      type,
    };
  });
};

/**
 * filter and set manual lock version data by global config
 */
export const filterAndSetManualLockVersionByGlobalConfig = (
  packageItem: IPackageItem,
  config: Pick<IMonorepoHelperCoreConfig, "excludeDependencies" | "includeDependencies" | "lockDependencies">
) => {
  const { includeDependencies, excludeDependencies, lockDependencies } = config;

  const isNeedInclude = includeDependencies?.all?.length || Object.keys(includeDependencies?.package || {}).length;
  const isNeedExclude = excludeDependencies?.all?.length || Object.keys(excludeDependencies?.package || {}).length;

  // filter by include
  const curPackageIncludeDependencies =
    includeDependencies?.package?.[packageItem.name] || includeDependencies?.package?.[packageItem.relativeName] || [];

  const finalIncludeDependencies =
    curPackageIncludeDependencies === "*"
      ? "*"
      : (includeDependencies?.all || []).concat(curPackageIncludeDependencies);

  if (finalIncludeDependencies !== "*" && isNeedInclude) {
    packageItem.dependcies = packageItem.dependcies.filter((item) => finalIncludeDependencies.includes(item.name));
  }

  // filter by exclude
  const curPackageExcludeDependencies =
    excludeDependencies?.package?.[packageItem.name] || excludeDependencies?.package?.[packageItem.relativeName] || [];

  const finalExcludeDependencies =
    curPackageExcludeDependencies === "*"
      ? "*"
      : (excludeDependencies?.all || []).concat(curPackageExcludeDependencies);

  if (finalExcludeDependencies === "*") {
    packageItem.dependcies = [];
  } else if (isNeedExclude) {
    packageItem.dependcies = packageItem.dependcies.filter((item) => !finalExcludeDependencies.includes(item.name));
  }

  // get manual version lock data
  const curPackageDependenciesLockVersionData =
    lockDependencies?.package?.[packageItem.name] || lockDependencies?.package?.[packageItem.relativeName] || {};

  const finalDependenciesLockVersionData = { ...lockDependencies?.all, ...curPackageDependenciesLockVersionData };

  packageItem.dependcies = packageItem.dependcies.map((item) => {
    const curManualLockVersion = finalDependenciesLockVersionData[item.name];
    if (typeof curManualLockVersion === "string") {
      item.manualLockVersion = {
        version: curManualLockVersion,
      };
    }
    if (Array.isArray(curManualLockVersion)) {
      item.manualLockVersion = {
        version: curManualLockVersion[0],
        peerDependencyVersion: curManualLockVersion[1],
      };
    }
    return item;
  });

  return packageItem;
};
