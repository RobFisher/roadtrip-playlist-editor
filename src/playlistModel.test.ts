import test from "node:test";
import assert from "node:assert/strict";
import { applySongDrop, type Playlist } from "./playlistModel.js";

const basePlaylists: Playlist[] = [
  { id: "p1", name: "One", songIds: ["s1", "s2"] },
  { id: "p2", name: "Two", songIds: ["s3"] }
];

test("copy adds song to destination and keeps source unchanged", () => {
  const updated = applySongDrop(
    basePlaylists,
    { songId: "s1", sourcePlaylistId: "p1", mode: "copy" },
    "p2"
  );

  assert.deepEqual(updated[0]?.songIds, ["s1", "s2"]);
  assert.deepEqual(updated[1]?.songIds, ["s3", "s1"]);
});

test("move adds song to destination and removes from source", () => {
  const updated = applySongDrop(
    basePlaylists,
    { songId: "s1", sourcePlaylistId: "p1", mode: "move" },
    "p2"
  );

  assert.deepEqual(updated[0]?.songIds, ["s2"]);
  assert.deepEqual(updated[1]?.songIds, ["s3", "s1"]);
});

test("drop does not duplicate song in destination", () => {
  const updated = applySongDrop(
    basePlaylists,
    { songId: "s3", sourcePlaylistId: "p2", mode: "copy" },
    "p2"
  );

  assert.deepEqual(updated[1]?.songIds, ["s3"]);
});
