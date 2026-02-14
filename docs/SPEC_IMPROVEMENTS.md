# SPEC Improvement Suggestions

This document proposes changes to `SPEC.md` to reduce ambiguity and make execution testable.

## 1. Clarify Scope by Release

Add explicit release scopes:

- `R0 (AWS bootstrap)`: deployed web app with no auth and no Spotify integration.
- `R1 (single-user core editor)`: local playlist model and drag/drop across panes.
- `R2 (shared projects)`: invite collaborators by email and persist shared project state.
- `R3 (Spotify import/export)`: user-authorized Spotify integration for playlist sync.
- `R4 (optional AI suggestions)`: LLM-powered suggestion pane behind a feature flag.

Why: this keeps progress visible even if third-party auth is delayed.

## 2. Add Non-goals

Suggested non-goals for early phases:

- No mobile-first UX before R3.
- No support for non-Spotify music platforms before R4+.
- No advanced conflict-free replicated data types in initial collaboration release.

Why: prevents scope creep and protects early deployment timeline.

## 3. Tighten Data + Privacy Rules

Current rule is good, but add explicit fields allowed in storage:

- `Allowed PII`: email address only.
- `Disallowed`: names, profile photos, IP logs retained long-term, free-form user bios.
- `Secrets`: OAuth tokens stored encrypted at rest, never logged, rotated on compromise.

Also add retention statement:

- Remove project membership records and related tokens within a defined window (for example 30 days) after project deletion.

## 4. Define Collaboration Semantics

Specify baseline consistency behavior:

- Last-write-wins for list ordering and pane layout.
- Idempotent add/remove song operations.
- Soft conflict notifications in UI when remote updates arrive during local edit.

Why: turns "graceful handling" into testable behavior.

## 5. Define Success Metrics

Add measurable outcomes:

- Time to first deploy from repo init: less than 1 day.
- Time to add a song to 3 playlists: less than 10 seconds in UI flow.
- Failed sync operations recoverable without manual DB edits.

## 6. Specify Auth Decision Policy

Add this policy:

- Primary app sign-in: Google OIDC (for identity and project sharing).
- Music API access: Spotify OAuth (required for user playlists).
- If Spotify auth unavailable, app remains usable in local/manual mode.

Why: realistic with third-party APIs while minimizing sign-ins where possible.

## 7. Add Acceptance Criteria to Each Requirement

Example format:

- Requirement: "Invite friends to a project by email."
- Acceptance test: "Given owner and invitee emails, invitee can open project after accepting invite; no other user data is stored."

This should be done for each major section (`Development`, `Design`, `UI`, `Open questions`).
