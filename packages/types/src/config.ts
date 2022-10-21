export interface IncludeOrExcludePackage {
  [packageName: string]: "*" | string[];
}

export interface IMonorepoHelperCoreConfig {
  /**
   * @default same as rootDirectoryPath
   */
  lockFileDirectoryPath?: string;
  packageManager: "pnpm";
  dependencies?: {
    filter: {
      /**
       * filter by include dependencies
       */
      include?: {
        common?: string[];
        package?: IncludeOrExcludePackage;
      };
      /**
       * filter by exclude dependencies
       */
      exclude?: {
        common?: string[];
        package?: IncludeOrExcludePackage;
      };
    };
    lock: {
      common?: {
        [dependencyName: string]: string;
      };
      package?: {
        [packageName: string]: {
          [dependencyName: string]: string | [string, string];
        };
      };
    };
  };
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
      [dependencyName: string]: string | [string, string];
    };
    package?: {
      [packageName: string]: {
        [dependencyName: string]: string | [string, string];
      };
    };
  };
}
