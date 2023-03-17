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
  /** raw version
   * @description package.json's version
   */
  version: string;
  type: DependencyType;
  lockVersion?: string;
  peerDependencyVersion?: string;
  /**
   * @deprecated
   */
  devDependencyVersion?: string;
  package?: Omit<IPackageItem, "dependencies">;
  children?: {
    name: string;
    version: string;
    type: DependencyType;
  }[];
  /**
   * Currently only pnpm support
   * @link https://pnpm.io/how-peers-are-resolved
   */
  transitivePeerDependencies?: string[];
  /**
   * manual lock version by global config
   */
  manualLockVersion?: {
    version?: string;
    peerDependencyVersion?: string;
    isDifferentWithRawDependency?: boolean;
    isDifferentWithRawPeerDependency?: boolean;
  };
  /**
   * @deprecated
   */
  checkResult?: {
    canAutoFix?: boolean;
    isPeerDependency?: boolean;
    lockVersion: string;
    errorMessage: string;
    fixMessage: string;
  }[];
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

export type IDependencyCheckSuggestionItemType =
  | "normal"
  | "differentPeerDependencyVersion"
  | "transitivePeerDependencies";

export interface IDependencyCheckSuggestionItem {
  type: IDependencyCheckSuggestionItemType;
  message: string;
}
