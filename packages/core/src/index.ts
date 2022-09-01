import { readWantedLockfile } from "@pnpm/lockfile-file";
import path from "path";

export const pnpmLockFileParse = async (lockFileDirectoryPath: string) => {
  const res = await readWantedLockfile(lockFileDirectoryPath, {
    ignoreIncompatible: false,
  });
  console.log("res", res);
};

export const getAllPackageJson = async (workspacePath:string)=>{
  
}

export const init = async (lockFileDirectoryPath: string, npmManager: "pnpm") => {
  switch (npmManager) {
    case "pnpm":
      return await pnpmLockFileParse(lockFileDirectoryPath);
    default:
      console.log("unsupported npm manager: ", npmManager);
  }
};

const tempLockFilePath = path.resolve(__dirname, "../../..");
init(tempLockFilePath, "pnpm");
