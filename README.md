# Rob's Road-trip Playlist Editor

A local-first playlist workspace for comparing and editing multiple playlists at once.
The UI shows multiple playlist panes side by side so you can drag songs between playlists,
reorder tracks within a playlist, and quickly shape alternatives before exporting.

![Roadtrip Playlist Editor screenshot](screenshot.png)

Current status:
- Milestones 0-3 are complete.
- The app is useful now as a personal local editor with Spotify discovery/import/export.
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
3. Create local env file from the example:
   ```bash
   cp .env.local.example .env.local
   ```

Dependency policy: avoid upgrading npm dependencies unless explicitly requested.

## Daily Commands

- Start local React app:
  ```bash
  npm run dev
  ```
- Start local backend placeholder API:
  ```bash
  npm run dev:api
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
- Create playlists, remove songs from a list, delete lists, and close panes.
- Save/load project state locally as JSON.
- Connect Spotify, import playlists, and export pane content to a new Spotify playlist.
- Search Spotify into any pane, keep search result lists in the project, and load more results.

## Spotify Setup (Local + Deployed)

This app uses Spotify Authorization Code flow with PKCE in the browser.

- Required env var:
  - `VITE_SPOTIFY_CLIENT_ID`
- Optional env var:
  - `VITE_SPOTIFY_REDIRECT_URI`
    - used only on loopback local hosts (`127.0.0.1` / `localhost`)
    - on non-local hosts (for example CloudFront), app always uses current page URL
      (`window.location.origin + window.location.pathname`) as Spotify callback.

For local development, create `.env.local`:

```bash
VITE_SPOTIFY_CLIENT_ID=your_spotify_app_client_id
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/
```

Important:
- Add the same redirect URI to your Spotify app settings.
- Use `127.0.0.1` (not `localhost`) for the redirect URI.
- Do not put Spotify client secret in frontend code. PKCE flow here uses only client ID.
- For deployed builds, `VITE_SPOTIFY_REDIRECT_URI` is not required because callback uses current page URL.
  Add your deployed frontend URL (for example `https://d231ej2mp8aqcu.cloudfront.net/`) in Spotify app settings.

## Google Login Setup (Local + Deployed)

This app uses Google Identity Services OAuth token flow for app login identity.

- Required env var:
  - `VITE_GOOGLE_CLIENT_ID`

For local development, add to `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id
```

Important:
- Add `http://127.0.0.1:5173` to Authorized JavaScript origins in your Google OAuth client.
- Make sure OAuth consent screen configuration allows your test users.
- No Google client secret is used in frontend code.

## Backend API Setup (Local + Deployed)

- Optional env var:
  - `VITE_API_BASE_URL`
    - if unset, frontend calls relative `/api/*` paths.
    - in local dev, Vite proxies `/api/*` to `http://127.0.0.1:8787` by default.
    - override proxy target with `VITE_LOCAL_API_PROXY_TARGET`.
    - for deployed CloudFront builds, recommended to leave unset so frontend uses same-origin `/api/*`.

For local development with current backend placeholder:

1. Terminal A:
   ```bash
   npm run dev:api
   ```
2. Terminal B:
   ```bash
   npm run dev
   ```

The local backend verifies Google access tokens and creates an HttpOnly cookie session.
It auto-loads `.env.local` (then `.env`) so you can use the same variable names as frontend:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_SPOTIFY_CLIENT_ID`
- `VITE_SPOTIFY_REDIRECT_URI`
- `VITE_API_BASE_URL` (optional for direct API origin mode)

### Where local backend data is stored

When you run `npm run dev:api`, backend project/user/session data is stored in process memory
inside the local Node server (in-memory maps), not in DynamoDB.

That means:
- data persists only while `npm run dev:api` is running,
- restarting the local backend clears stored backend projects/sessions.

DynamoDB is used only after deploying the backend stack in AWS.

Session cookie behavior:
- Local (`http://127.0.0.1`) uses `SameSite=Lax` with non-secure cookie for dev convenience.
- Deployed backend uses `SameSite=None; Secure` so CloudFront frontend can send session cookie to API Gateway across origins.

Auth debug panel:
- Hidden by default.
- Toggle with `Ctrl+Shift+D` when you need session/cookie diagnostics in the UI.

If you want direct frontend -> API Gateway calls, set:

```bash
VITE_API_BASE_URL=https://your-api-id.execute-api.<region>.amazonaws.com
```

Recommended for deployed app:

1. Leave `VITE_API_BASE_URL` unset in `.env.local`.
2. Deploy backend + frontend with CDK.
3. Frontend will call `/api/*` on CloudFront; CloudFront routes `/api/*` to API Gateway.

This avoids browser third-party cookie restrictions between `cloudfront.net` and `execute-api.amazonaws.com`.

For deployed login/session calls to succeed, backend CORS must allow your frontend origin.
Set this in `.env.local` before backend deploy:

```bash
BACKEND_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,https://d231ej2mp8aqcu.cloudfront.net
```

Then redeploy backend:

```bash
AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npx cdk deploy RoadtripPlaylistEditorBackend-dev
```

Important: list origins without trailing slash.

For CDK deploys, `bin/cdk.ts` also loads `.env.local` and `.env`, so `VITE_GOOGLE_CLIENT_ID`
in those files is picked up by the backend Lambda config.

Current backend project rules:
- Any logged-in Google user can list and load any backend project.
- Only the owner can save updates to an existing backend project.
- If you loaded someone else's project, saving creates a new project under your own user with a new unique name.

## AWS Deployment (Optional At This Stage)

Deploying to AWS is useful for sharing a hosted frontend URL, but it is optional right now.
There is no backend persistence or multi-user system yet, so local usage is fully supported.

## AWS Account Actions Required Before First Deploy

You need valid AWS CLI auth + region before deploy.

### Quick Start: Verify AWS CLI Auth

Pick one auth path:

1. IAM user with access keys:
   ```bash
   aws configure --profile roadtrip-deployer
   AWS_PROFILE=roadtrip-deployer aws sts get-caller-identity
   ```
2. AWS SSO / IAM Identity Center:
   ```bash
   aws configure sso --profile roadtrip-deployer
   aws sso login --profile roadtrip-deployer
   AWS_PROFILE=roadtrip-deployer aws sts get-caller-identity
   ```

Then set region and run deploy commands with profile:

```bash
export AWS_PROFILE=roadtrip-deployer
export AWS_REGION=<REGION>
aws configure get region --profile "$AWS_PROFILE" || true
```

If you see `Unable to resolve AWS account to use`, run `aws sts get-caller-identity`
with the same `AWS_PROFILE` you plan to use for deploy and ensure it succeeds first.

### CDK bootstrap (one-time per account/region)

```bash
AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npx aws-cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

Then from this repo:

```bash
npm run deploy:dev
```

To deploy backend + frontend together:

```bash
npm run deploy:all:dev
```

If you use a named CLI profile:

```bash
AWS_PROFILE=roadtrip-deployer AWS_REGION=<REGION> npm run deploy:dev
```

To tear down and stop most ongoing costs:

```bash
npm run destroy:dev
```

To tear down only backend:

```bash
npm run destroy:backend:dev
```

## Tooling Included in the Nix Environment

- `node` / `npm`
- `aws`
- `cdk`

## Deployment Documentation

- AWS deploy/IAM/DNS/cost/teardown playbook: `docs/AWS_DEPLOYMENT_PLAYBOOK.md`
- Backend implementation plan (API + DynamoDB + sessions): `docs/BACKEND_IMPLEMENTATION_PLAN.md`
