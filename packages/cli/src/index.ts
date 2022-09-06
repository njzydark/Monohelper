#!/usr/bin/env node
import { program } from "./program";
import pkg from "../package.json";
import { dependencyAction } from "./dependency";
import { configAction } from "./config";

program
  .name(pkg.cliName)
  .description(pkg.description)
  .version(pkg.version)
  .option("-p,--package-manager [packageManager]", "", "pnpm");

program
  .command("dependency")
  .argument("[dependencyNames...]")
  .option("-c,--check-version")
  .option("--diff", "print only different version when check", true)
  .option("--no-diff", "print all version when check")
  .option("--include-package <packageNames...>")
  .option("--exclude-package <packageNames...>")
  .option("-l,--lock-version")
  .option("-v,--version <version>", "lock single dependency version")
  .option("--peer-version <peerVersion>", "lock single peerDependency version")
  .action(dependencyAction);

program.command("config").option("-i,--init", "init config").action(configAction);

program.parse(process.argv);
