# Auth and Third-Party Authorization Plan

This document focuses on minimizing sign-ins while staying realistic about provider requirements.

## Short Answer on "Single Google SSO for Everything"

- Google OIDC can authenticate your app users.
- Spotify data access still requires Spotify OAuth per user for import/export.
- LLM provider access can usually be app-level API key (no user sign-in), depending on product choice.

Result: practical minimum is usually 2 auth systems:

1. Google for app sign-in.
2. Spotify for Spotify account access.

## Recommended Auth Architecture

Primary identity:

- Google OIDC for user login.
- Persist only `email`, `user_id`, timestamps, and project memberships.

Music service authorization:

- Spotify OAuth with least privileges needed for import/export.
- Store Spotify refresh/access tokens encrypted at rest.
- Link Spotify token record to internal user id.

Service-to-service integrations:

- LLM provider via server-side API key only (no end-user auth in early phase).

## Third-Party Setup Checklist

### Google

1. Create OAuth client in Google Cloud Console.
2. Configure authorized redirect URI(s) for local and production environments.
3. Configure OAuth consent screen details.
4. Verify login in local and deployed environments.

### Spotify

1. Register app in Spotify Developer Dashboard.
2. Set redirect URI(s) for local and production.
3. Request only required scopes for read/write playlist operations.
4. Validate token refresh flow and revoked access behavior.

### LLM (optional later)

1. Pick provider and model with cost controls.
2. Store API key in secret manager.
3. Add request limits and abuse controls.

## Risk Register (Auth-Focused)

1. Risk: Spotify approval/scope friction or policy constraints.
   Mitigation: ship without Spotify first; keep import/export behind feature flag.
2. Risk: Redirect URI mismatch across local/prod.
   Mitigation: environment-specific config with explicit validation checks.
3. Risk: Token leakage in logs.
   Mitigation: structured logging with secret redaction and token-free logs.
4. Risk: Extra sign-in friction reduces adoption.
   Mitigation: require Spotify sign-in only when user clicks import/export.

## Test Plan for Auth

1. Google login success path.
2. Google login denied/cancelled.
3. Invite flow with email identity only.
4. Spotify connect/disconnect lifecycle.
5. Spotify token expiry and refresh.
6. Access control test: user cannot read unshared project.

## Scope Guardrail

If auth work threatens schedule, continue with:

- Local/manual songs,
- Shared projects using app auth only,
- AWS deployment already live.

This keeps progress independent from Spotify timing.
