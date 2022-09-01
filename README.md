# monorepo-helper

A tool to enhance the monorepo development experience

## Features

- Provide cli tool to check package version consistency and provide related fix suggestions
- Provide vscode extension to enhance the local development experience

## Attention

Currently only support `pnpm`

## Version check

```bash
This monorepo has multiple version dependencies: 

glob
│   
├── 7.2.3
│   │   
│   ├──monorepo-helper (root) 7
│   │   
│   └──@monorepo-helper/cli (packages/cli) 7
│   
└── 8.0.3
    │   
    └──@monorepo-helper/core (packages/core) ^8.0.3

Suggestion: lock glob version to 8.0.3
```
