# Backend Implementation Plan (CDK + DynamoDB + Google Session)

This plan turns the current static frontend deployment into a minimal, production-usable backend while keeping local development fast.

## Goals

1. Keep CloudFront/S3 frontend deployment working.
2. Add backend APIs for auth + project persistence.
3. Keep Google and Spotify client IDs easy to manage across local/dev/prod.
4. Make local development on `http://127.0.0.1:5173` work cleanly.

## Proposed AWS Architecture

1. `S3 + CloudFront`: static frontend hosting (existing).
2. `API Gateway HTTP API`: public API entrypoint.
3. `Lambda`: API handlers (Node.js/TypeScript).
4. `DynamoDB`: users/projects/memberships storage.
5. `Secrets Manager`: session signing secret (and later Spotify client secret if backend token flow is added).
6. `KMS`: encryption for sensitive attributes where needed.

## Identity and Session Model

Use Google as identity proof, but keep app session owned by our backend.

1. Frontend gets Google access token from Google Identity Services.
2. Frontend calls `POST /api/auth/google/session` with access token.
3. Backend verifies token against Google tokeninfo endpoint and checks `aud` + expiry.
4. Backend creates/updates local user record in DynamoDB.
5. Backend sets an HTTP-only secure session cookie.
6. Frontend calls `GET /api/me` on load to restore login after refresh.

This removes the "logout on refresh" problem and avoids storing long-lived auth state in JS-accessible storage.

## Client IDs and CloudFront

Google client ID and Spotify client ID are public identifiers and can be shipped in frontend code.

Recommended environment handling:

1. Build frontend with environment-specific values:
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_SPOTIFY_CLIENT_ID`
   - `VITE_API_BASE_URL` (for backend API origin)
2. Deploy built assets to S3/CloudFront.
3. Keep secrets out of frontend build entirely.

Provider console setup:

1. Google OAuth client:
   - Authorized JS origins include:
     - `http://127.0.0.1:5173`
     - deployed app origin(s), e.g. `https://app.example.com`
2. Spotify app:
   - Redirect URIs include local + deployed callback URLs.

## DynamoDB Data Model (Phase 1)

Start with one table for lower operational overhead.

Table: `RoadtripAppTable`  
Partition key: `pk` (string)  
Sort key: `sk` (string)

Entity patterns:

1. User profile
   - `pk = USER#{userId}`
   - `sk = PROFILE`
   - attrs: `email`, `displayName`, `createdAt`, `updatedAt`
2. Project metadata
   - `pk = PROJECT#{projectId}`
   - `sk = META`
   - attrs: `ownerUserId`, `name`, `createdAt`, `updatedAt`, `version`
3. Project document
   - `pk = PROJECT#{projectId}`
   - `sk = DOC`
   - attrs: `projectJson`, `updatedAt`, `updatedByUserId`, `version`
4. Membership edge
   - `pk = PROJECT#{projectId}`
   - `sk = MEMBER#{userId}`
   - attrs: `role` (`owner|editor|viewer`), `createdAt`

GSI for user project listing:

1. `gsi1pk = USER#{userId}`
2. `gsi1sk = PROJECT#{projectId}`
3. Project membership items should project minimal list metadata (`projectName`, `updatedAt`, `role`) for list APIs.

## API Contract (Initial)

Auth:

1. `POST /api/auth/google/session`
   - body: `{ accessToken: string, displayName?: string }`
   - sets session cookie
   - returns: `{ user: { userId, email, displayName } }`
2. `POST /api/auth/logout`
   - clears session cookie
3. `GET /api/me`
   - returns current app user from session

Projects:

1. `GET /api/projects`
   - list all projects for any authenticated user
2. `POST /api/projects`
   - create project
3. `GET /api/projects/{projectId}`
   - fetch full project doc for any authenticated user
4. `PUT /api/projects/{projectId}`
   - save project doc only if caller is owner

## Authorization Rules (Current Simplified Model)

1. Any authenticated user can load any project.
2. Only the project owner can update that project.
3. If a non-owner wants to save changes, frontend creates a new project via `POST /api/projects` with a unique name and the caller as owner.

## Security Baseline

1. Session cookie flags:
   - `HttpOnly`
   - `Secure`
   - `SameSite=Lax` (or `None` only if cross-site is required)
2. Backend authorization check on every project endpoint.
3. Never trust frontend-provided user IDs.
4. Use structured logs and never log tokens.

## Local Development (`127.0.0.1:5173`)

Two workable options:

1. Vite proxy (recommended for dev):
   - frontend calls `/api/*`
   - Vite proxies to local backend (`http://127.0.0.1:8787` for example)
   - avoids CORS complexity in local dev
2. Direct API origin:
   - frontend uses `VITE_API_BASE_URL`
   - configure CORS on API for `http://127.0.0.1:5173`

For cookie sessions in local HTTP:

1. During local dev only, allow non-secure cookie flag.
2. In deployed environments, always use `Secure=true`.

## CDK Rollout Plan

### Step 1: Add Backend Stack

Create `lib/backend-stack.ts` with:

1. DynamoDB table + GSI.
2. HTTP API.
3. Lambda handlers.
4. IAM policies scoped to table access and secrets read.
5. Stack outputs: API URL, table name.

### Step 2: Wire Frontend Stack to API Base URL

At build/deploy time provide `VITE_API_BASE_URL` to frontend.

### Step 3: Implement Auth Endpoints

1. `POST /api/auth/google/session`
2. `GET /api/me`
3. `POST /api/auth/logout`

### Step 4: Implement Project CRUD Endpoints

1. list/create/get/update.
2. enforce membership/ownership checks.
3. add optimistic version conflict response (`409`).

### Step 5: Frontend Integration

1. On app startup call `/api/me`.
2. Replace in-memory-only Google login state with cookie session state.
3. Add save/load from backend alongside local JSON fallback.

## Out of Scope for First Backend Increment

1. Real-time collaboration.
2. Spotify server-side token management.
3. Rich invite UX.

## Suggested Next Commit Scope

1. Add backend CDK stack skeleton.
2. Add minimal Lambda router with `/health`, `/me` placeholder.
3. Add `VITE_API_BASE_URL` frontend config usage and dev proxy.
4. Keep existing local file workflows unchanged.
