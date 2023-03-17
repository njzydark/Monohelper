import {
  IAllDependency,
  IAllDependencyGroupedByVersion,
  IDependencyGroupedByVersionItem,
  IDependencyItem,
  IMonorepoHelperCoreConfig,
  IncludeOrExcludeItem,
  IRawDependencies,
} from "@monohelper/types";
import fs from "fs/promises";

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
  config: Pick<IMonorepoHelperCoreConfig, "dependencies">
) => {
  const { dependencies } = config;

  const lockData = dependencies?.lock;

  const packageInfo = dependencyItem.package!;

  // get manual version lock data
  const curPackageDependenciesLockVersionData =
    lockData?.package?.[packageInfo.name] || lockData?.package?.[packageInfo.relativeName] || {};

  const finalDependenciesLockVersionData = { ...lockData?.common, ...curPackageDependenciesLockVersionData };

  const curManualLockVersion = finalDependenciesLockVersionData[dependencyItem.name];

  if (!curManualLockVersion) {
    return dependencyItem;
  }

  let version, peerDependencyVersion;

  if (typeof curManualLockVersion === "string") {
    version = curManualLockVersion;
    peerDependencyVersion = curManualLockVersion;
  } else if (Array.isArray(curManualLockVersion) && curManualLockVersion.length > 0) {
    version = curManualLockVersion[0];
    peerDependencyVersion = curManualLockVersion[1] || version;
  }

  const isDifferentWithRawDependency = !!version && dependencyItem.version !== version;
  const isDifferentWithRawPeerDependency =
    !!peerDependencyVersion &&
    !!dependencyItem.peerDependencyVersion &&
    dependencyItem.peerDependencyVersion !== peerDependencyVersion;

  dependencyItem.manualLockVersion = {
    version,
    peerDependencyVersion,
    isDifferentWithRawDependency,
    isDifferentWithRawPeerDependency,
  };

  return dependencyItem;
};

/**
 * check dependency item is should include by config
 */
export const isDependencyItemNeedInclude = (
  dependencyItem: IDependencyItem,
  config: Pick<IMonorepoHelperCoreConfig, "dependencies">
) => {
  const { dependencies = {} } = config;

  const { include, exclude } = dependencies;

  const isNeedInclude = include?.common?.length || Object.keys(include?.package || {}).length;
  const isNeedExclude = exclude?.common?.length || Object.keys(exclude?.package || {}).length;

  const getFinalFilteredDependency = (dependencyItem: IDependencyItem, data?: IncludeOrExcludeItem) => {
    const curPackageDependencies =
      data?.package?.[dependencyItem.package?.name || ""] ||
      data?.package?.[dependencyItem.package?.relativeName || ""] ||
      [];

    return curPackageDependencies === "*" ? "*" : (data?.common || []).concat(curPackageDependencies);
  };

  let filteredDependency = [dependencyItem];

  const finalIncludeDependencies = getFinalFilteredDependency(dependencyItem, include);
  if (finalIncludeDependencies !== "*" && isNeedInclude) {
    filteredDependency = filteredDependency.filter((item) => finalIncludeDependencies.includes(item.name));
  }

  const finalExcludeDependencies = getFinalFilteredDependency(dependencyItem, exclude);
  if (finalExcludeDependencies === "*") {
    filteredDependency = [];
  } else if (isNeedExclude) {
    filteredDependency = filteredDependency.filter((item) => !finalExcludeDependencies.includes(item.name));
  }

  return filteredDependency.length === 1;
};

export const handleCurDependencyItemGroupedByVersion = (
  data: IDependencyGroupedByVersionItem,
  dependencyItem: IDependencyItem
) => {
  if (dependencyItem.version.startsWith("workspace:")) {
    return [];
  }

  if (!data?.length) {
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

export const getAllDependencyGroupedByVersion = (
  allDependency: IAllDependency,
  config: Pick<IMonorepoHelperCoreConfig, "dependencies">
) => {
  // group same dependency by different version
  const res = allDependency.reduce<{
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
  return res;
};

type GetDependencyItemGroupedByVersionOptions = {
  dependencyItem: IDependencyItem;
  allDependency: IAllDependency;
  config: Pick<IMonorepoHelperCoreConfig, "dependencies">;
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

export const getAllDependencyAndGroupedByPackagePath = (data: IDependencyItem[]) => {
  return data.reduce<{
    [packageRelativeName: string]: {
      packagePath: string;
      dependencies: IDependencyItem[];
    };
  }>((acc, cur) => {
    const { package: _package } = cur;

    if (!_package) {
      return acc;
    }

    const { relativeName, path } = _package;

    if (!acc[relativeName]) {
      acc[relativeName] = {
        packagePath: path,
        dependencies: [cur],
      };
    } else {
      acc[relativeName].dependencies.push(cur);
    }

    return acc;
  }, {});
};

type LockVersionOptions = {
  packagePath?: string;
  dependencies: {
    name: string;
    version: string;
    peerVersion?: string;
  }[];
};

export const handleLockVersion = async ({ packagePath, dependencies }: LockVersionOptions) => {
  const originData = packagePath ? await fs.readFile(packagePath, "utf-8") : null;
  if (originData && packagePath && dependencies.length) {
    let newData = originData;
    dependencies.forEach(({ name, version, peerVersion }) => {
      const regx = new RegExp(`(dependencies|devDependencies)([^}]*)("${name}")(:\\s*)("\\S*")`, "gs");
      newData = newData.replace(regx, `$1$2$3$4"${version}"`);
      if (peerVersion) {
        const regx = new RegExp(`(peerDependencies)([^}]*)("${name}")(:\\s*)("\\S*")`, "gs");
        newData = newData.replace(regx, `$1$2$3$4"${peerVersion}"`);
      }
    });
    await fs.writeFile(packagePath, newData);
  }
};
