# Rob's Road-trip Playlist Editor

A local-first playlist workspace for comparing and editing multiple playlists at once.
The UI shows multiple playlist panes side by side so you can drag songs between playlists,
reorder tracks within a playlist, and quickly shape alternatives before exporting.

![Roadtrip Playlist Editor screenshot](screenshot.png)

Current status:
- Milestones 0-2 are complete.
- The app is useful now as a personal local editor (save/load project JSON files, Spotify import/export).
- AWS deployment is currently optional because there is no backend or multi-user collaboration yet.

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

The local dev server listens on `http://127.0.0.1:5173` by default.

## What You Can Do Today

- Open multiple playlist panes and switch which playlist each pane displays.
- Drag songs between panes (copy or move) and reorder within a pane.
- Create playlists and delete selected songs from a playlist.
- Save/load project state locally as JSON.
- Connect Spotify, import playlists, and export pane content to a new Spotify playlist.

## Spotify Setup (Local + Deployed)

This app uses Spotify Authorization Code flow with PKCE in the browser.

- Required env var:
  - `VITE_SPOTIFY_CLIENT_ID`
- Optional env var:
  - `VITE_SPOTIFY_REDIRECT_URI`
    - default is current page URL (`window.location.origin + window.location.pathname`)

For local development, create `.env.local`:

```bash
VITE_SPOTIFY_CLIENT_ID=your_spotify_app_client_id
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/
```

Important:
- Add the same redirect URI to your Spotify app settings.
- Use `127.0.0.1` (not `localhost`) for the redirect URI.
- Do not put Spotify client secret in frontend code. PKCE flow here uses only client ID.

## AWS Deployment (Optional At This Stage)

Deploying to AWS is useful for sharing a hosted frontend URL, but it is optional right now.
There is no backend persistence or multi-user system yet, so local usage is fully supported.

## AWS Account Actions Required Before First Deploy

You need to do these steps in your AWS account:

1. Create a non-root deploy identity (user or role) with MFA.
2. Configure AWS CLI credentials/profile for that identity.
3. Bootstrap CDK for your account and region:
   ```bash
   AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npx aws-cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
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
