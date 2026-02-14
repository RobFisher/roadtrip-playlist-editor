# Delivery Plan (Testable Steps)

This plan is ordered to deliver something on AWS quickly, then de-risk auth integrations.
It prioritizes functionality that can work without third-party sign-in.

## Milestone 0: Repo + Environment Baseline

Goal: reliable local dev bootstrap.

Tasks:

1. Add Nix flake/devenv for Node.js, npm, AWS CLI, CDK CLI.
2. Add project scripts for install, lint, test, and local run.
3. Add minimal README setup instructions.

Exit criteria:

- Fresh machine can run one setup command and start app locally.
- CI-style command (`npm test`) runs without failures.

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

## Milestone 2: Core Local Editor + File Import/Export (No Third-party Auth)

Goal: prove the pane-based interaction model.

Tasks:

1. Implement data model: song, playlist, project.
2. Build 3+ pane layout (search pane + playlist panes).
3. Add drag-copy and drag-move behavior with clear visual cues.
4. Add song context menu and playlist membership view.
5. Add import/export support for a standard playlist file format.

Exit criteria:

- User can add/move/copy songs across panes.
- Song card shows title, artist, art thumbnail, count of playlist memberships.
- User can import a playlist file, edit it, and export it again.
- Interaction flows covered by UI tests.

## Milestone 3: Shared Projects + Identity

Goal: multi-user collaboration with minimum PII.

Tasks:

1. Add Google OIDC sign-in for app identity.
2. Store only email for user identity records.
3. Add invite-by-email flow.
4. Persist project/playlist/song relationships in DynamoDB.

Exit criteria:

- Two users can access same project by invite.
- Unauthorized user cannot access project.
- Data schema contains no user PII beyond email.

## Milestone 4: Search Provider Integration (Low Auth Friction)

Goal: useful song discovery before Spotify dependency.

Tasks:

1. Integrate at least one free/public song search metadata source.
2. Map search results into internal song model used by panes.
3. Add graceful fallback when provider is unavailable or rate limited.

Exit criteria:

- Search pane returns results without requiring Spotify login.
- User can add search results to playlists with existing drag/copy flows.
- Provider errors are handled without breaking editing workflow.

## Milestone 5: Spotify Integration

Goal: real playlist import/export.

Tasks:

1. Register Spotify app and configure redirect URIs.
2. Implement Spotify OAuth and token handling.
3. Add import playlist from Spotify.
4. Add export playlist to Spotify.

Exit criteria:

- User connects Spotify account and imports playlist into project.
- Export creates/updates Spotify playlist correctly.
- Token refresh and expired-token behavior are covered by tests.

## Milestone 6: Real-time Collaboration Improvements

Goal: better concurrency behavior.

Tasks:

1. Add near-real-time sync mechanism.
2. Add optimistic UI updates with conflict handling.
3. Add user-facing conflict notification.

Exit criteria:

- Concurrent edits do not silently drop user changes.
- Playlist order and song membership remain consistent after simultaneous edits.

## Decision Gates

Evaluate at the end of each milestone:

1. Continue current scope.
2. De-scope next milestone.
3. Delay third-party integration and ship usable internal tool.

Use this to keep momentum if auth/approvals block progress.
