# Rob's Road-trip Playlist Editor

Milestones 0-1 bootstrap for the project: Nix-based CLI environment, React hello-world
frontend, and CDK-based static deployment infrastructure.

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

- Start local React app:
  ```bash
  npm run dev
  ```
- Build static assets:
  ```bash
  npm run build
  ```
- Preview built assets:
  ```bash
  npm run preview
  ```
- Run typecheck lint:
  ```bash
  npm run lint
  ```
- Run tests:
  ```bash
  npm run test
  ```

The local dev server listens on `http://localhost:5173` by default.

## AWS Account Actions Required Before First Deploy

You need to do these steps in your AWS account:

1. Create a non-root deploy identity (user or role) with MFA.
2. Configure AWS CLI credentials/profile for that identity.
3. Bootstrap CDK for your account and region:
   ```bash
   cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
   ```

Then from this repo:

```bash
npm run deploy:dev
```

If you use a named CLI profile:

```bash
AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npm run deploy:dev
```

To tear down and stop most ongoing costs:

```bash
npm run destroy:dev
```

## Tooling Included in the Nix Environment

- `node` / `npm`
- `aws`
- `cdk`

## Deployment Documentation

- AWS deploy/IAM/DNS/cost/teardown playbook: `docs/AWS_DEPLOYMENT_PLAYBOOK.md`
