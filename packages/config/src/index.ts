import { readFile, writeFile } from "fs/promises";
import { IMonorepoHelperConfig } from "@monohelper/types";
import originDefaultConfig from "./default.json";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";

export const configName = "monohelper.json";
export const defaultConfig = originDefaultConfig;

export const initConfig = async (configPath: string, config = originDefaultConfig) => {
  const data = JSON.stringify(config, null, 2);
  await writeFile(join(configPath, configName), data);
};

export const getConfig = async (configPath: string) => {
  const str = await readFile(join(configPath, configName), "utf-8");
  const config = JSON.parse(str) as IMonorepoHelperConfig;
  return config;
};

export const getConfigDirectoryPath = async () => {
  const curPath = process.cwd();
  const homePath = homedir();

  const getPath = (curPath: string): string | undefined => {
    const filePath = join(curPath, configName);
    if (existsSync(filePath)) {
      return curPath;
    }
    const prePath = join(curPath, "..");
    if (prePath === homePath) {
      return;
    } else {
      return getPath(prePath);
    }
  };

  return getPath(curPath);
};
