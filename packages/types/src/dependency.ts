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
  peerDependencyVersion?: string;
  devDependencyVersion?: string;
  /**
   * manual lock version by global config
   */
  manualLockVersion?: {
    version?: string;
    peerDependencyVersion?: string;
  };
  type: DependencyType;
  children?: {
    name: string;
    version: string;
    type: DependencyType;
  }[];
  transitivePeerDependencies?: string[];
  package?: Omit<IPackageItem, "dependencies">;
}

export type IAllDependency = IDependencyItem[];

export type IDependencyGroupedByVersionItem = IDependencyItem[][];

/**
 * same dependency name with different versions
 */
export interface IAllDependencyGroupedByVersion {
  [dependencyName: string]: IDependencyGroupedByVersionItem;
}

export interface IPackageItem {
  path: string;
  name: string;
  relativeName: string;
  version: string;
  dependencies: IDependencyItem[];
  isRoot?: boolean;
}

export type IAllPackage = IPackageItem[];
