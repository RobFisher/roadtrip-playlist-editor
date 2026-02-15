# Agent Instructions

## Dependency Management Policy

- Do not upgrade npm dependencies unless the user explicitly requests it.
- For normal setup and repeatable installs, use `npm ci` (not `npm install`).
- Do not run `npm update` unless explicitly requested.
- If a new dependency is required for a task, add only the minimum needed package and do not upgrade unrelated dependencies.

## File Guide

- `src/App.tsx`: Top-level workspace container. Owns app state and orchestration for panes, drag/drop, playlist creation, and Spotify import/auth flows.
- `src/playlistModel.ts`: Domain model and pure helpers for playlists/songs (drop behavior, reorder/move/copy, membership counts, seed data).
- `src/spotify.ts`: Spotify API/auth helpers (PKCE URL + token exchange, profile/playlists/items fetch, scope checks).
- `src/app.css`: Global UI styles for workspace, panes, songs, and dialogs.
- `src/components/WorkspaceHeader.tsx`: Header section with add-pane action and status indicators.
- `src/components/PlaylistPane.tsx`: Single pane UI (playlist selector, delete/remove actions, song list rendering, drag/drop slots/cards).
- `src/components/NewPlaylistDialog.tsx`: Modal for creating a new playlist name.
- `src/components/SpotifyImportDialog.tsx`: Modal for Spotify connect/list/select/import and optional dev-only curl debug panel.
- `src/hooks/useSpotifyAuth.ts`: Encapsulates Spotify PKCE auth lifecycle for the browser app (connect redirect, callback token exchange, scope validation, token persistence/expiry, disconnect cleanup).

## Refactor Convention

- Prefer extracting presentational UI into `src/components/*` before moving logic into hooks.
- Keep `src/playlistModel.ts` functions pure and side-effect free.
- Keep Spotify networking and protocol details in `src/spotify.ts` rather than embedding request code in components.
