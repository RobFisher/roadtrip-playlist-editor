# Agent Instructions

## Dependency Management Policy

- Do not upgrade npm dependencies unless the user explicitly requests it.
- For normal setup and repeatable installs, use `npm ci` (not `npm install`).
- Do not run `npm update` unless explicitly requested.
- If a new dependency is required for a task, add only the minimum needed package and do not upgrade unrelated dependencies.
