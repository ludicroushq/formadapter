# FormAdapter

Automatic schema forms for React and your UI kit.

[![CI](https://github.com/ludicroushq/formadapter/actions/workflows/ci.yml/badge.svg)](https://github.com/ludicroushq/formadapter/actions/workflows/ci.yml)

FormAdapter is an early TypeScript library for building schema-driven forms that can render through the component system you already use. The goal is to keep form logic portable while making UI-library adapters feel native.

This repo is still in initial development. The first package will be `@formadapter/react`.

## Packages

| Package | Description | Status |
| --- | --- | --- |
| `@formadapter/react` | React primitives for schema-driven forms | In development |

## Goals

- Generate form structure from typed schemas.
- Keep validation, defaults, and field metadata close to the schema.
- Adapt cleanly to UI libraries instead of shipping one fixed visual style.
- Stay small, typed, and framework-friendly.

## Development

```sh
bun install
bun run typecheck
bun run test
bun run build
```

## Repository

FormAdapter uses Bun workspaces, Turborepo, tsdown, and changesets.

## Release

Packages start at `0.0.0`. Future published versions will be created with changesets and released by GitHub Actions.

## License

MIT
