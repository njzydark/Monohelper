export interface IMonorepoHelperCoreConfig {
  rootDirectoryPath: string;
  /**
   * @default same as rootDirectoryPath
   */
  lockFileDirectoryPath?: string;
  packageManager: "pnpm";
}

export interface IRawDependencies {
  [name: string]: string;
}

export interface IRawPackageItem {
  name: string;
  version: string;
  dependencies?: IRawDependencies;
  devDependencies?: IRawDependencies;
  peerDependencies?: IRawDependencies;
}

export interface IDependencyItem {
  name: string;
  version: string;
  lockVersion?: string;
  type: "dependency" | "devDependency" | "peerDependency";
}

export interface IPackageItem {
  path: string;
  name: string;
  relativeName: string;
  version: string;
  dependcies: IDependencyItem[];
  isRoot?: boolean;
}
