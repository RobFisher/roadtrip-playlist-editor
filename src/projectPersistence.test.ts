import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProjectState,
  PROJECT_SCHEMA_VERSION,
  serializeProjectState
} from "./projectPersistence.js";
import { seedProjectData } from "./playlistModel.js";

test("serialize and parse project state roundtrip", () => {
  const panePlaylistIds = seedProjectData.playlists.slice(0, 2).map((playlist) => playlist.id);
  const serialized = serializeProjectState(
    seedProjectData.songs,
    seedProjectData.playlists,
    panePlaylistIds
  );
  const parsed = parseProjectState(JSON.stringify(serialized));

  assert.equal(parsed.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.deepEqual(parsed.songs, seedProjectData.songs);
  assert.deepEqual(parsed.playlists, seedProjectData.playlists);
  assert.deepEqual(parsed.panePlaylistIds, panePlaylistIds);
});

test("parse rejects unknown pane playlist references", () => {
  const invalid = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    songs: seedProjectData.songs,
    playlists: seedProjectData.playlists,
    panePlaylistIds: ["does-not-exist"]
  };

  assert.throws(() => parseProjectState(JSON.stringify(invalid)), /unknown playlist/);
});
