import {
  IAllDependency,
  IAllDependencyGroupedByVersion,
  IDependencyGroupedByVersionItem,
  IDependencyItem,
  IMonorepoHelperCoreConfig,
  IncludeOrExcludePackage,
  IPackageItem,
  IRawDependencies,
} from "@monohelper/types";

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
 * set dependency item manual lock version data by config
 */
export const setDependencyItemManualLockVersionByConfig = (
  dependencyItem: IDependencyItem,
  config: Pick<IMonorepoHelperCoreConfig, "lockDependencies">
) => {
  const { lockDependencies } = config;

  const packageInfo = dependencyItem.package!;

  // get manual version lock data
  const curPackageDependenciesLockVersionData =
    lockDependencies?.package?.[packageInfo.name] || lockDependencies?.package?.[packageInfo.relativeName] || {};

  const finalDependenciesLockVersionData = { ...lockDependencies?.all, ...curPackageDependenciesLockVersionData };

  const curManualLockVersion = finalDependenciesLockVersionData[dependencyItem.name];

  if (!curManualLockVersion) {
    return dependencyItem;
  }

  if (typeof curManualLockVersion === "string") {
    const isDifferentWithRawDependency = dependencyItem.version !== curManualLockVersion;
    const isDifferentWithRawPeerDependency =
      !!dependencyItem.peerDependencyVersion && dependencyItem.peerDependencyVersion !== curManualLockVersion;
    dependencyItem.manualLockVersion = {
      version: curManualLockVersion,
      isDifferentWithRawDependency,
      isDifferentWithRawPeerDependency,
    };
  }
  if (Array.isArray(curManualLockVersion) && curManualLockVersion.length > 0) {
    const version = curManualLockVersion[0];
    const peerDependencyVersion = curManualLockVersion[1] || curManualLockVersion[0];
    const isDifferentWithRawDependency = dependencyItem.version !== version;
    const isDifferentWithRawPeerDependency =
      !!dependencyItem.peerDependencyVersion && dependencyItem.peerDependencyVersion !== peerDependencyVersion;
    dependencyItem.manualLockVersion = {
      version,
      peerDependencyVersion,
      isDifferentWithRawDependency,
      isDifferentWithRawPeerDependency,
    };
  }
  return dependencyItem;
};

/**
 * check dependency item is should include by include and exclude config
 */
export const isDependencyItemNeedInclude = (
  dependencyItem: IDependencyItem,
  config: Pick<IMonorepoHelperCoreConfig, "excludeDependencies" | "includeDependencies">
) => {
  const { includeDependencies, excludeDependencies } = config;

  const isNeedInclude = includeDependencies?.all?.length || Object.keys(includeDependencies?.package || {}).length;
  const isNeedExclude = excludeDependencies?.all?.length || Object.keys(excludeDependencies?.package || {}).length;

  const getFinalFilteredDependency = (
    dependencyItem: IDependencyItem,
    data?: {
      /**
       * all packages
       */
      all?: string[];
      package?: IncludeOrExcludePackage;
    }
  ) => {
    const curPackageDependencies =
      data?.package?.[dependencyItem.package?.name || ""] ||
      data?.package?.[dependencyItem.package?.relativeName || ""] ||
      [];

    return curPackageDependencies === "*" ? "*" : (data?.all || []).concat(curPackageDependencies);
  };

  let filteredDependency = [dependencyItem];

  const finalIncludeDependencies = getFinalFilteredDependency(dependencyItem, includeDependencies);
  if (finalIncludeDependencies !== "*" && isNeedInclude) {
    filteredDependency = filteredDependency.filter((item) => finalIncludeDependencies.includes(item.name));
  }

  const finalExcludeDependencies = getFinalFilteredDependency(dependencyItem, excludeDependencies);
  if (finalExcludeDependencies === "*") {
    filteredDependency = [];
  } else if (isNeedExclude) {
    filteredDependency = filteredDependency.filter((item) => !finalExcludeDependencies.includes(item.name));
  }

  return filteredDependency.length === 1;
};

const handleCurDependencyItemGroupedByVersion = (
  data: IDependencyGroupedByVersionItem,
  dependencyItem: IDependencyItem
) => {
  if (!data) {
    data = [[dependencyItem]];
  } else {
    const index = data.findIndex((item) => {
      const base = item[0];
      return base.lockVersion && base.lockVersion === dependencyItem.lockVersion;
    });
    if (index > -1) {
      data[index].push(dependencyItem);
    } else {
      data.push([dependencyItem]);
    }
  }
  return data;
};

type GetDependencyItemGroupedByVersionOptions = {
  dependencyItem: IDependencyItem;
  allDependency: IAllDependency;
  config: Pick<IMonorepoHelperCoreConfig, "excludeDependencies" | "includeDependencies">;
};

export const getDependencyItemGroupedByVersion = ({
  dependencyItem,
  allDependency,
  config,
}: GetDependencyItemGroupedByVersionOptions) => {
  const data = allDependency.filter((cur) => {
    return cur.name === dependencyItem.name && isDependencyItemNeedInclude(cur, config);
  });

  return data.reduce<IDependencyGroupedByVersionItem>(handleCurDependencyItemGroupedByVersion, []);
};

export const getAllDependencyGroupedByVersion = (
  allDependency: IAllDependency,
  config: Pick<IMonorepoHelperCoreConfig, "excludeDependencies" | "includeDependencies">
) => {
  // group same dependency by different version
  return allDependency.reduce<{
    allDependencyGroupedByVersion: IAllDependencyGroupedByVersion;
    allDependencyGroupedByVersionAndFiltered: IAllDependencyGroupedByVersion;
  }>(
    (acc, cur) => {
      acc.allDependencyGroupedByVersion[cur.name] = handleCurDependencyItemGroupedByVersion(
        acc.allDependencyGroupedByVersion[cur.name],
        cur
      );

      if (isDependencyItemNeedInclude(cur, config)) {
        acc.allDependencyGroupedByVersionAndFiltered[cur.name] = handleCurDependencyItemGroupedByVersion(
          acc.allDependencyGroupedByVersionAndFiltered[cur.name],
          cur
        );
      }

      return acc;
    },
    { allDependencyGroupedByVersion: {}, allDependencyGroupedByVersionAndFiltered: {} }
  );
};
