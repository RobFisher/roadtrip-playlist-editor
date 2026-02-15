import type { Playlist, Song } from "./playlistModel.js";

export const PROJECT_SCHEMA_VERSION = "roadtrip-playlist-project.v1";

export interface PersistedProjectV1 {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  exportedAt: string;
  projectName?: string;
  songs: Song[];
  playlists: Playlist[];
  panePlaylistIds: string[];
}

function assertString(value: unknown, fieldPath: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid project file: "${fieldPath}" must be a non-empty string.`);
  }
}

function assertStringArray(value: unknown, fieldPath: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid project file: "${fieldPath}" must be an array of strings.`);
  }
}

function assertObject(value: unknown, fieldPath: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid project file: "${fieldPath}" must be an object.`);
  }
}

function validateSongs(songs: unknown): Song[] {
  if (!Array.isArray(songs)) {
    throw new Error(`Invalid project file: "songs" must be an array.`);
  }

  return songs.map((song, index) => {
    assertObject(song, `songs[${index}]`);
    assertString(song.id, `songs[${index}].id`);
    assertString(song.title, `songs[${index}].title`);
    assertString(song.artist, `songs[${index}].artist`);
    assertString(song.artworkUrl, `songs[${index}].artworkUrl`);
    if (song.spotifyUri !== undefined && typeof song.spotifyUri !== "string") {
      throw new Error(
        `Invalid project file: "songs[${index}].spotifyUri" must be a string when provided.`
      );
    }
    const normalized: Song = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      artworkUrl: song.artworkUrl
    };
    if (typeof song.spotifyUri === "string") {
      normalized.spotifyUri = song.spotifyUri;
    }
    return normalized;
  });
}

function validatePlaylists(playlists: unknown): Playlist[] {
  if (!Array.isArray(playlists)) {
    throw new Error(`Invalid project file: "playlists" must be an array.`);
  }

  return playlists.map((playlist, index) => {
    assertObject(playlist, `playlists[${index}]`);
    assertString(playlist.id, `playlists[${index}].id`);
    assertString(playlist.name, `playlists[${index}].name`);
    assertStringArray(playlist.songIds, `playlists[${index}].songIds`);
    return {
      id: playlist.id,
      name: playlist.name,
      songIds: playlist.songIds
    };
  });
}

export function serializeProjectState(
  projectName: string,
  songs: Song[],
  playlists: Playlist[],
  panePlaylistIds: string[]
): PersistedProjectV1 {
  const normalizedProjectName = projectName.trim();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projectName: normalizedProjectName || undefined,
    songs,
    playlists,
    panePlaylistIds
  };
}

export function parseProjectState(raw: string): PersistedProjectV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid project file: not valid JSON.");
  }

  assertObject(parsed, "root");

  if (parsed.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(
      `Invalid project file: expected schemaVersion "${PROJECT_SCHEMA_VERSION}".`
    );
  }

  const songs = validateSongs(parsed.songs);
  const playlists = validatePlaylists(parsed.playlists);
  assertStringArray(parsed.panePlaylistIds, "panePlaylistIds");

  if (parsed.panePlaylistIds.length < 1) {
    throw new Error(`Invalid project file: "panePlaylistIds" cannot be empty.`);
  }

  const songIds = new Set<string>();
  songs.forEach((song) => {
    if (songIds.has(song.id)) {
      throw new Error(`Invalid project file: duplicate song id "${song.id}".`);
    }
    songIds.add(song.id);
  });

  const playlistIds = new Set<string>();
  playlists.forEach((playlist) => {
    if (playlistIds.has(playlist.id)) {
      throw new Error(`Invalid project file: duplicate playlist id "${playlist.id}".`);
    }
    playlistIds.add(playlist.id);

    playlist.songIds.forEach((songId) => {
      if (!songIds.has(songId)) {
        throw new Error(
          `Invalid project file: playlist "${playlist.id}" references unknown song "${songId}".`
        );
      }
    });
  });

  parsed.panePlaylistIds.forEach((playlistId, index) => {
    if (!playlistIds.has(playlistId)) {
      throw new Error(
        `Invalid project file: panePlaylistIds[${index}] references unknown playlist "${playlistId}".`
      );
    }
  });

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
    projectName:
      typeof parsed.projectName === "string" && parsed.projectName.trim()
        ? parsed.projectName.trim()
        : undefined,
    songs,
    playlists,
    panePlaylistIds: parsed.panePlaylistIds
  };
}
