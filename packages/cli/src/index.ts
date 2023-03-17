#!/usr/bin/env node
import { program } from "./program";
import { Option } from "commander";
import pkg from "../package.json";
import { checkAction, lockAction } from "./dependency";
import { configAction } from "./config";

program
  .name(pkg.cliName)
  .description(pkg.description)
  .option("-p,--package-manager [packageManager]", "", "pnpm")
  .version(pkg.version)
  .configureHelp({
    showGlobalOptions: true,
    visibleGlobalOptions: (cmd) => {
      // @ts-ignore
      const options = (cmd.parent?.options as Option[]) || [];
      return options.filter((item) => item.long !== "--version");
    },
  });

program
  .command("check")
  .description("check dependency version")
  .argument("[dependencyNames...]")
  .option("--include-package <packageNames...>")
  .option("--exclude-package <packageNames...>")
  .option("--diff", "print only different version when check", true)
  .option("--no-diff", "print all version when check")
  .option("--exact", "dependency name matched exactly", false)
  .option("--no-exact", "dependency name matched partially")
  .option("--fix", "auto fix check problem with config's lock version")
  .action(checkAction);

program
  .command("lock")
  .description("lock dependency version")
  .argument("dependencyName")
  .option("--include-package <packageNames...>")
  .option("--exclude-package <packageNames...>")
  .requiredOption("-v,--version <version>", "lock single dependency version")
  .option("--peer-version <peerVersion>", "lock single peerDependency version")
  .action(lockAction);

program.command("config").description("monohelper.json config").option("-i,--init", "init config").action(configAction);

program.parse(process.argv);
