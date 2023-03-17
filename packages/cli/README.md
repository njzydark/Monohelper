# @monohelper/cli

A tool to to check monorepo package version consistency

## Usage

```bash
npx @monohelper/cli -h
```

```bash
Usage: monohelper [options] [command]

Options:
  -p,--package-manager [packageManager]   (default: "pnpm")
  -V, --version                          output the version number
  -h, --help                             display help for command

Commands:
  check [options] [dependencyNames...]   check dependency version
  lock [options] <dependencyName>        lock dependency version
  config [options]                       monohelper.json config
  help [command]                         display help for command
```

### Version check

```bash
npx @monohelper/cli check
```

```bash
glob
│   
├── 7.2.3
│   │   
│   ├──monohelper (root)
│   │    dependency: 7   
│   │   
│   └──@monohelper/cli (packages/cli)
│        dependency: 7   
│   
└── 8.0.3
    │   
    ├──@monohelper/config (packages/config)
    │    dependency: ^8.0.3   
    │   
    └──@monohelper/core (packages/core)
         dependency: ^8.0.3 
```
