import { IDependencyItem, IRawDependencies } from "../types";

export const getDependenciesArrayData = (rawDependencies: IRawDependencies = {}, type: IDependencyItem["type"]) => {
  return Object.keys(rawDependencies).map<IDependencyItem>((key) => {
    return {
      name: key,
      version: rawDependencies[key],
      type,
    };
  });
};
