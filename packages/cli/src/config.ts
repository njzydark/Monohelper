import { initConfig, defaultConfig } from "@monohelper/config";
import { existsSync } from "fs";
import path from "path";

export const configAction = async (opts: { init?: boolean }) => {
  if (opts.init) {
    const rootDirectoryPath = process.cwd();
    const isRush = existsSync(path.join(rootDirectoryPath, "rush.json"));
    let config = defaultConfig;
    if (isRush) {
      config.lockFileDirectoryPath = "./common/config/rush";
    }
    await initConfig(rootDirectoryPath, config);
  }
};
