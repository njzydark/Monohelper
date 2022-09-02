#!/usr/bin/env node
import { program } from "commander";
import pkg from "../package.json";

console.log();
console.log(`${pkg.cliName} - ${pkg.version}`);
console.log(pkg.description);

program.version(pkg.version, "-v,--version");

program
  .command("dependency")
  .argument("[dependencyName]")
  .option("-c,--check-version")
  .option("-l,--lock-version <version>");

program.command("config").option("-i,--init", "init config");

program.parse(process.argv);
