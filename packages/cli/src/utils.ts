import { IAllDependencyGroupedByVersion, IDependencyGroupedByVersionItem } from "@monohelper/types";
import chalk from "chalk";

type PrintDependencyGroupedByVersionDataParams = {
  data: IAllDependencyGroupedByVersion;
  highlightItemKey?: boolean;
  onItemStart?: (item: IDependencyGroupedByVersionItem, index: number) => void;
  onItemFinish?: (item: IDependencyGroupedByVersionItem, index: number) => void;
};

export const printDependencyGroupedByVersionData = ({
  data,
  highlightItemKey,
  onItemStart,
  onItemFinish,
}: PrintDependencyGroupedByVersionDataParams) => {
  const Symbols = {
    BRANCH: "├──",
    EMPTY: "",
    INDENT: "    ",
    LAST_BRANCH: "└──",
    VERTICAL: "│   ",
  };

  const rootKeys = Object.keys(data);
  rootKeys.forEach((key, rootIndex) => {
    const curItem = data[key];
    if (curItem.length === 0) {
      return;
    }
    if (rootIndex !== 0) {
      console.log();
    }
    onItemStart?.(curItem, rootIndex);
    if (highlightItemKey) {
      console.log(chalk.blue.bold(key));
    } else {
      console.log(chalk.bold(key));
    }
    curItem.forEach((items, index) => {
      const isFirst = index === 0;
      const isLast = index === curItem.length - 1;
      isFirst && console.log(Symbols.VERTICAL);
      console.log(
        `${isLast ? Symbols.LAST_BRANCH : Symbols.BRANCH} ${
          items[0].lockVersion || chalk.yellow("lock version unknown")
        }`
      );
      items.forEach((item, itemIndex) => {
        const isItemPackageLast = itemIndex === items.length - 1;
        const manualLockRawVersionCheckMessage = item.manualLockVersion?.isDifferentWithRawDependency
          ? `${chalk.yellow(item.manualLockVersion?.version)}`
          : "";
        const manualLockRawPeerVersionCheckMessage = item.manualLockVersion?.isDifferentWithRawPeerDependency
          ? `${chalk.yellow(item.manualLockVersion?.peerDependencyVersion)}`
          : "";
        console.log(`${isLast ? Symbols.INDENT : Symbols.VERTICAL}${Symbols.VERTICAL}`);
        console.log(
          `${isLast ? Symbols.INDENT : Symbols.VERTICAL}${isItemPackageLast ? Symbols.LAST_BRANCH : Symbols.BRANCH}${
            item.package?.name
          } (${item.package?.isRoot ? "root" : item.package?.relativeName}) ${
            item.version
          } ${manualLockRawVersionCheckMessage} ${
            item.peerDependencyVersion || ""
          } ${manualLockRawPeerVersionCheckMessage}`
        );
      });
      if (!isLast) {
        console.log(Symbols.VERTICAL);
      }
    });
    onItemFinish?.(curItem, rootIndex);
  });
};
