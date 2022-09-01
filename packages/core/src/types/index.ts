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

type DependencyType = "dependency" | "devDependency" | "peerDependency";

export interface IDependencyItem {
  name: string;
  version: string;
  lockVersion?: string;
  type: DependencyType;
  children?: {
    name: string;
    version: string;
    type: DependencyType;
  }[];
}

export interface IPackageItem {
  path: string;
  name: string;
  relativeName: string;
  version: string;
  dependcies: IDependencyItem[];
  isRoot?: boolean;
}

export interface IVersionCheckDependencyItem extends IDependencyItem {
  package: {
    name: string;
    relativeName: string;
    path: string;
    isRoot?: boolean;
  };
}

export interface IDependenciesObjectData {
  [name: string]: (Omit<IVersionCheckDependencyItem, "package"> & {
    packages: IVersionCheckDependencyItem["package"][];
  })[];
}
