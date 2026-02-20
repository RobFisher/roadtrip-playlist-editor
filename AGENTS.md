# Agent Instructions

## General rules
Third party APIs seem to change often -- double check official docs; avoid deprecated APIs.

## Dependency Management Policy

- Do not upgrade npm dependencies unless the user explicitly requests it.
- For normal setup and repeatable installs, use `npm ci` (not `npm install`).
- Do not run `npm update` unless explicitly requested.
- If a new dependency is required for a task, add only the minimum needed package and do not upgrade unrelated dependencies.

## File Guide

Keep this file guide up to date whenever files are added, removed, renamed, or responsibilities shift across files.

- `src/App.tsx`: Top-level workspace container. Owns app state and orchestration for panes, drag/drop, playlist creation, and Spotify import/export/auth flows.
- `src/playlistModel.ts`: Domain model and pure helpers for playlists/songs (drop behavior, reorder/move/copy, membership counts, seed data).
- `src/projectPersistence.ts`: Versioned JSON schema for local project save/load plus strict parser/validation for imported files.
- `src/spotify.ts`: Spotify API/auth helpers (PKCE URL + token exchange, profile/playlists/items fetch, playlist create/add-items, scope checks).
- `src/app.css`: Global UI styles for workspace, panes, songs, and dialogs.
- `src/components/WorkspaceHeader.tsx`: Header section with add-pane action and status indicators.
- `src/components/PlaylistPane.tsx`: Single pane UI (playlist selector, delete/remove actions, song list rendering, drag/drop slots/cards).
- `src/components/NewPlaylistDialog.tsx`: Modal for creating a new playlist name.
- `src/components/DeleteListDialog.tsx`: Confirmation modal for deleting a playlist/search results list from the project.
- `src/components/SaveProjectDialog.tsx`: Modal for entering/editing project name before saving local project JSON.
- `src/components/SpotifyImportDialog.tsx`: Modal for Spotify playlist list/select/import and optional dev-only curl debug panel.
- `src/components/SpotifyExportDialog.tsx`: Modal for exporting the current pane playlist into a new Spotify playlist.
- `src/components/SpotifySearchDialog.tsx`: Modal for searching Spotify into a pane and creating/replacing search result lists.
- `src/hooks/useSpotifyAuth.ts`: Encapsulates Spotify PKCE auth lifecycle for the browser app (connect redirect, callback token exchange, scope validation, token persistence/expiry, disconnect cleanup).
- `src/hooks/usePaneDragDrop.ts`: Encapsulates pane/song drag-and-drop state and handlers (drag mode label, drop target, payload transfer, copy/move drop application).
- `src/hooks/useSpotifyImport.ts`: Encapsulates Spotify playlist import workflow state/logic (dialog state, playlist loading, import action, status, dev curl debug generation).
- `src/projectPersistence.test.ts`: Schema parser/serializer tests for project save/load compatibility and validation errors.

## Refactor Convention

- Prefer extracting presentational UI into `src/components/*` before moving logic into hooks.
- Keep `src/playlistModel.ts` functions pure and side-effect free.
- Keep Spotify networking and protocol details in `src/spotify.ts` rather than embedding request code in components.
