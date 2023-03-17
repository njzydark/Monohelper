import { initConfig, defaultConfig } from "@monohelper/config";
import { PackageManager } from "@monohelper/core";
import { Command } from "commander";
import { checkIsRush } from "./utils";

export const configAction = async (opts: { init?: boolean }, cmd: Command) => {
  const globalOptions = cmd.optsWithGlobals<{ packageManager: PackageManager }>();

  if (opts.init) {
    const rootDirectoryPath = process.cwd();
    const isRush = checkIsRush();
    let config = defaultConfig;
    if (globalOptions.packageManager) {
      config.packageManager = globalOptions.packageManager;
    }
    if (isRush) {
      config.lockFileDirectoryPath = "./common/config/rush";
    }
    await initConfig(rootDirectoryPath, config);
  }
};
