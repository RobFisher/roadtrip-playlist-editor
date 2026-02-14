import test from "node:test";
import assert from "node:assert/strict";
import { buildGreeting } from "./app.js";

test("buildGreeting returns expected status text", () => {
  assert.equal(
    buildGreeting("Rob's Road-trip Playlist Editor"),
    "Rob's Road-trip Playlist Editor is running"
  );
});
