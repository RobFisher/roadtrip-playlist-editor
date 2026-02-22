import { test } from "node:test";
import assert from "node:assert/strict";

import {
  shouldUpdateLoadedBackendProject,
  type LoadedBackendProjectContext
} from "./backendProjectSave.js";

function buildLoadedProject(overrides?: Partial<LoadedBackendProjectContext>): LoadedBackendProjectContext {
  return {
    projectId: "project-1",
    ownerUserId: "user-1",
    name: "Roadtrip",
    version: 1,
    ...overrides
  };
}

test("shouldUpdateLoadedBackendProject returns true for owner when name unchanged", () => {
  assert.equal(
    shouldUpdateLoadedBackendProject(buildLoadedProject(), "user-1", "Roadtrip"),
    true
  );
});

test("shouldUpdateLoadedBackendProject returns false for owner when name changed", () => {
  assert.equal(
    shouldUpdateLoadedBackendProject(buildLoadedProject(), "user-1", "Roadtrip Copy"),
    false
  );
});

test("shouldUpdateLoadedBackendProject returns false for non-owner", () => {
  assert.equal(
    shouldUpdateLoadedBackendProject(buildLoadedProject({ ownerUserId: "user-2" }), "user-1", "Roadtrip"),
    false
  );
});
