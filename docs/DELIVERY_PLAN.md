# Delivery Plan (Testable Steps)

This plan delivered AWS early, then focused on a useful no-backend editor.
Search integration is now complete; focus moves to backend/auth/collaboration next.

## Milestone 0: Repo + Environment Baseline

Goal: reliable local dev bootstrap.

Tasks:

1. Add Nix flake/devenv for Node.js, npm, AWS CLI, CDK CLI.
2. Add project scripts for install, lint, test, and local run.
3. Add minimal README setup instructions.

Exit criteria:

- Fresh machine can run one setup command and start app locally.
- CI-style command (`npm test`) runs without failures.

Status: Complete.

## Milestone 1: AWS Hello World Deployment

Goal: deploy a basic app before feature complexity.

Tasks:

1. Create minimal React SPA with one static page.
2. Provision AWS hosting path via CDK using S3 + CloudFront.
3. Set up one deploy command from local environment.
4. Publish deployment docs covering IAM setup, DNS, costs, and teardown for users deploying to their own AWS account.

Exit criteria:

- Public HTTPS URL serves the app.
- Redeploy after UI text change completes successfully.
- Rollback path documented.
- AWS deployment guide includes clear cost drivers and an explicit `cdk destroy` teardown procedure.

Status: Complete.

## Milestone 2: Core Local Editor + Local File Save/Load + Spotify Import/Export

Goal: reach a useful milestone without backend services.

Tasks:

1. Implement data model for songs/playlists/projects.
2. Build multi-pane playlist editor with drag-copy/drag-move and reorder-at-position.
3. Add core pane operations (add/remove pane, create playlist, delete selected song from playlist).
4. Add local project save/load via JSON schema (project name + pane/playlist state).
5. Integrate Spotify auth and playlist import.
6. Integrate Spotify export to create a new Spotify playlist from pane contents.

Exit criteria:

- User can build and edit playlists locally across panes.
- User can save and reload project state from local JSON files.
- User can import from Spotify and export pane content to a new Spotify playlist.
- Deployed frontend is usable without backend persistence.

Status: Complete.

## Milestone 3: Search Provider Integration (Low Auth Friction)

Goal: useful song discovery before backend work.

Tasks:

1. Integrate at least one free/public song metadata search provider.
2. Add search UI and result list that maps into the internal song model.
3. Allow adding search results directly into existing playlists/panes.
4. Add graceful handling for provider outages/rate limits/empty results.

Exit criteria:

- Search returns usable song results.
- User can add search results to playlists with current editor flows.
- Added songs remain exportable to Spotify from the existing export workflow.
- Provider failures are visible but do not break editing workflow.

Status: Complete.

## Milestone 4: Backend Project Storage + User Login

Goal: move from local-only projects to account-backed persistence.

Tasks:

1. Add authenticated user login flow for production use.
2. Persist project data to backend storage.
3. Add project list/open/save flows tied to user identity.
4. Keep local file export/import as fallback.

Exit criteria:

- User can sign in and save/open projects from backend storage.
- Users cannot overwrite others' projects.
- Local file workflows continue to work.

Status: Complete.
