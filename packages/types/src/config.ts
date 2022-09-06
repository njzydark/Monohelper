export interface IMonorepoHelperConfig {
  /**
   * @default same as rootDirectoryPath
   */
  lockFileDirectoryPath?: string;
  packageManager: "pnpm";
  excludeDependencies?: {
    all?: string[];
    package?: { [packageName: string]: "*" | string[] };
  };
  lockDependencies?: {
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
