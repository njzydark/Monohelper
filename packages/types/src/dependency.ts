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
  transitivePeerDependencies?: string[];
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
  peerDependencyVersion?: string;
  devDependencyVersion?: string;
  package: Omit<IPackageItem, "dependcies">;
}

export interface IDependenciesObjectData {
  [name: string]: IVersionCheckDependencyItem[][];
}
