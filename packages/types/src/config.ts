export interface IncludeOrExcludePackage {
  [packageName: string]: "*" | string[];
}

export interface IMonorepoHelperCoreConfig {
  /**
   * @default same as rootDirectoryPath
   */
  lockFileDirectoryPath?: string;
  packageManager: "pnpm";
  /**
   * filter by include dependencies
   */
  includeDependencies?: {
    /**
     * all packages
     */
    all?: string[];
    package?: IncludeOrExcludePackage;
  };
  /**
   * filter by exclude dependencies
   */
  excludeDependencies?: {
    /**
     * all packages
     */
    all?: string[];
    package?: IncludeOrExcludePackage;
  };
  /**
   * manual lock dependencies
   */
  lockDependencies?: {
    /**
     * all packages
     */
    all?: {
      [dependencyName: string]: string;
    };
    package?: {
      [packageName: string]: {
        [dependencyName: string]: string | [string, string];
      };
    };
  };
}
