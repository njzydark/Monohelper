import { readWantedLockfile } from "@pnpm/lockfile-file";
import path from "path";

export const pnpmLockFileParse = async (lockFilePath: string) => {
  return await readWantedLockfile(lockFilePath, {
    ignoreIncompatible: false,
  });
};

export const init = async (lockFilePath: string, npmManager: "pnpm") => {
  switch (npmManager) {
    case "pnpm":
      return await pnpmLockFileParse(lockFilePath);
    default:
      console.log("unsupported npm manager: ", npmManager);
  }
};

const tempLockFilePath = path.resolve(__dirname, "../temp.yaml");
init(tempLockFilePath, "pnpm");
