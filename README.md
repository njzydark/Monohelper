# Monohelper

A tool to enhance the monorepo development experience

## Features

- Provide cli tool to check package version consistency and provide related fix suggestions
- Provide vscode extension to enhance the local development experience

## Attention

Currently only support `pnpm`

## Version check

```bash
Existence of 1 different version of dependencies: 

glob
│   
├── 7.2.3
│   │   
│   ├──monohelper (root) 7
│   │   
│   └──@monohelper/cli (packages/cli) 7
│   
└── 8.0.3
    │   
    └──@monohelper/core (packages/core) ^8.0.3

Suggestion: lock glob version to 8.0.3
```

## Roadmap

- [ ] check version suggestions support peerDependency
- [ ] check and lock version support global config
- [ ] release vscode extension and support display dependency check result in problems pane
