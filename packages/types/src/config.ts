export type PackageManager = "pnpm";

export interface IncludeOrExcludeItem {
  common?: string[];
  package?: {
    [packageName: string]: "*" | string[];
  };
}

/** dependency lock version in package.json */
export interface LockPackageDependency {
  [dependencyName: string]: string | [string, string];
}

export interface IMonorepoHelperCoreConfig {
  /**
   * @default same as rootDirectoryPath
   */
  lockFileDirectoryPath?: string;
  packageManager: PackageManager;
  dependencies?: {
    /**
     * filter by include dependencies
     */
    include?: IncludeOrExcludeItem;
    /**
     * filter by exclude dependencies
     */
    exclude?: IncludeOrExcludeItem;
    /**
     * lock means to lock the dependency version in package.json not the lockfile
     */
    lock?: {
      common?: {
        [dependencyName: string]: LockPackageDependency[string];
      };
      package?: {
        [packageName: string]: LockPackageDependency;
      };
    };
  };
}
