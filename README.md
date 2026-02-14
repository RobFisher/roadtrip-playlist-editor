# Rob's Road-trip Playlist Editor

Milestone 0 bootstrap for the project: Nix-based CLI environment plus a minimal
TypeScript app with lint/test/run scripts.

## Prerequisites

- Nix with flake support.

## Setup

1. Enter the development shell:
   ```bash
   nix develop
   ```
2. Install npm dependencies without upgrading package versions:
   ```bash
   npm ci
   ```

Dependency policy: avoid upgrading npm dependencies unless explicitly requested.

## Daily Commands

- Start local app:
  ```bash
  npm run dev
  ```
- Run typecheck lint:
  ```bash
  npm run lint
  ```
- Run tests:
  ```bash
  npm run test
  ```

The local app listens on `http://localhost:3000` by default.

## Tooling Included in the Nix Environment

- `node` / `npm`
- `aws`
- `cdk`
