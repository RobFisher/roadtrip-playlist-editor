import test from "node:test";
import assert from "node:assert/strict";
import { buildVersionLabel } from "./version.js";

test("buildVersionLabel returns expected text", () => {
  assert.equal(
    buildVersionLabel("0.1.0"),
    "Roadtrip Playlist Editor 0.1.0"
  );
});
