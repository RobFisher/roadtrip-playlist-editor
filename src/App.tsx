import { useEffect, useMemo, useRef, useState } from "react";
import "./app.css";
import {
  applySongDropAtIndex,
  countSongMemberships,
  removeSongFromPlaylist,
  seedProjectData,
  type DragPayload,
  type Playlist
} from "./playlistModel.js";
import {
  buildSpotifyAuthorizeUrl,
  exchangeCodeForToken,
  generateRandomString,
  getCurrentUserPlaylists,
  getPlaylistTracks,
  type SpotifyAuthConfig,
  type SpotifyPlaylistSummary
} from "./spotify.js";

const initialPanePlaylistIds = seedProjectData.playlists.slice(0, 3).map((p) => p.id);
const DRAG_MIME = "application/x-roadtrip-song";
const NEW_PLAYLIST_VALUE = "__new_playlist__";
const IMPORT_SPOTIFY_VALUE = "__import_spotify__";
const SPOTIFY_AUTH_STATE_KEY = "spotify_pkce_state";
const SPOTIFY_AUTH_VERIFIER_KEY = "spotify_pkce_verifier";
const SPOTIFY_ACCESS_TOKEN_KEY = "spotify_access_token";
const SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY = "spotify_access_token_expires_at";

function normalizePlaylistName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildUniquePlaylistId(existingPlaylists: Playlist[], base: string): string {
  if (!existingPlaylists.some((playlist) => playlist.id === base)) {
    return base;
  }

  let counter = 2;
  while (existingPlaylists.some((playlist) => playlist.id === `${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export function App() {
  const [songs, setSongs] = useState(seedProjectData.songs);
  const [playlists, setPlaylists] = useState<Playlist[]>(seedProjectData.playlists);
  const [panePlaylistIds, setPanePlaylistIds] = useState<string[]>(initialPanePlaylistIds);
  const [dragModeLabel, setDragModeLabel] = useState<"copy" | "move">("copy");
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [selectedSong, setSelectedSong] = useState<{
    playlistId: string;
    songId: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    playlistId: string;
    index: number;
  } | null>(null);
  const [newPlaylistDialogPaneIndex, setNewPlaylistDialogPaneIndex] = useState<number | null>(
    null
  );
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [spotifyToken, setSpotifyToken] = useState<string | null>(
    localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY)
  );
  const [spotifyAuthError, setSpotifyAuthError] = useState<string | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [selectedSpotifyPlaylistId, setSelectedSpotifyPlaylistId] = useState<string>("");
  const [spotifyImportDialogPaneIndex, setSpotifyImportDialogPaneIndex] = useState<number | null>(
    null
  );
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);

  const songsById = useMemo(() => {
    return new Map(songs.map((song) => [song.id, song]));
  }, [songs]);

  const spotifyConfig: SpotifyAuthConfig = useMemo(() => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
    const redirectUri =
      import.meta.env.VITE_SPOTIFY_REDIRECT_URI ??
      `${window.location.origin}${window.location.pathname}`;

    return {
      clientId,
      redirectUri,
      scopes: ["playlist-read-private", "playlist-read-collaborative"]
    };
  }, []);

  const availableForNewPane = playlists.find(
    (playlist) => !panePlaylistIds.includes(playlist.id)
  );

  useEffect(() => {
    const expiresAtRaw = localStorage.getItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
    const expiresAt = expiresAtRaw ? Number.parseInt(expiresAtRaw, 10) : 0;
    if (expiresAt && Date.now() > expiresAt) {
      localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
      setSpotifyToken(null);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      setSpotifyAuthError(`Spotify auth error: ${oauthError}`);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (!code || !returnedState) {
      return;
    }

    const expectedState = sessionStorage.getItem(SPOTIFY_AUTH_STATE_KEY);
    const verifier = sessionStorage.getItem(SPOTIFY_AUTH_VERIFIER_KEY);
    if (!expectedState || !verifier || expectedState !== returnedState) {
      setSpotifyAuthError("Spotify auth state mismatch. Please try again.");
      return;
    }

    // Consume the callback params before async work to avoid double exchange
    // in React Strict Mode dev remounts.
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());

    const run = async () => {
      try {
        const tokenResponse = await exchangeCodeForToken(spotifyConfig, code, verifier);
        setSpotifyToken(tokenResponse.access_token);
        localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, tokenResponse.access_token);
        localStorage.setItem(
          SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY,
          String(Date.now() + tokenResponse.expires_in * 1000)
        );
        setSpotifyAuthError(null);
      } catch (error) {
        setSpotifyAuthError(
          error instanceof Error ? error.message : "Failed to complete Spotify auth."
        );
      } finally {
        sessionStorage.removeItem(SPOTIFY_AUTH_STATE_KEY);
        sessionStorage.removeItem(SPOTIFY_AUTH_VERIFIER_KEY);
      }
    };

    void run();
  }, [spotifyConfig]);

  function addPane(): void {
    if (!availableForNewPane) {
      return;
    }
    setPanePlaylistIds((prev) => [...prev, availableForNewPane.id]);
  }

  function removePane(index: number): void {
    setPanePlaylistIds((prev) => prev.filter((_, paneIndex) => paneIndex !== index));
  }

  function updatePanePlaylist(index: number, playlistId: string): void {
    if (playlistId === NEW_PLAYLIST_VALUE) {
      setNewPlaylistDialogPaneIndex(index);
      setNewPlaylistName("");
      return;
    }
    if (playlistId === IMPORT_SPOTIFY_VALUE) {
      setSpotifyImportDialogPaneIndex(index);
      return;
    }

    setPanePlaylistIds((prev) =>
      prev.map((currentId, paneIndex) =>
        paneIndex === index ? playlistId : currentId
      )
    );
  }

  function createPlaylistFromDialog(): void {
    if (newPlaylistDialogPaneIndex === null) {
      return;
    }

    const trimmedName = normalizePlaylistName(newPlaylistName);
    if (!trimmedName) {
      return;
    }

    const newPlaylistId = `playlist-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newPlaylist: Playlist = {
      id: newPlaylistId,
      name: trimmedName,
      songIds: []
    };

    setPlaylists((prev) => [...prev, newPlaylist]);
    setPanePlaylistIds((prev) =>
      prev.map((playlistId, paneIndex) =>
        paneIndex === newPlaylistDialogPaneIndex ? newPlaylistId : playlistId
      )
    );

    setNewPlaylistDialogPaneIndex(null);
    setNewPlaylistName("");
  }

  async function connectSpotify(): Promise<void> {
    if (!spotifyConfig.clientId) {
      setSpotifyAuthError("Missing VITE_SPOTIFY_CLIENT_ID. Check README setup.");
      return;
    }

    const state = generateRandomString(32);
    const verifier = generateRandomString(64);
    sessionStorage.setItem(SPOTIFY_AUTH_STATE_KEY, state);
    sessionStorage.setItem(SPOTIFY_AUTH_VERIFIER_KEY, verifier);

    const authUrl = await buildSpotifyAuthorizeUrl(spotifyConfig, state, verifier);
    window.location.href = authUrl;
  }

  function disconnectSpotify(): void {
    setSpotifyToken(null);
    setSpotifyPlaylists([]);
    setSelectedSpotifyPlaylistId("");
    localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
  }

  useEffect(() => {
    if (
      spotifyImportDialogPaneIndex === null ||
      !spotifyToken ||
      spotifyPlaylists.length > 0 ||
      spotifyLoading
    ) {
      return;
    }

    void loadSpotifyPlaylists();
  }, [spotifyImportDialogPaneIndex, spotifyLoading, spotifyPlaylists.length, spotifyToken]);

  async function loadSpotifyPlaylists(): Promise<void> {
    if (!spotifyToken) {
      return;
    }
    setSpotifyLoading(true);
    setSpotifyStatus("Loading Spotify playlists...");

    try {
      const loaded = await getCurrentUserPlaylists(spotifyToken);
      setSpotifyPlaylists(loaded);
      setSelectedSpotifyPlaylistId(loaded[0]?.id ?? "");
      setSpotifyStatus(`Loaded ${loaded.length} playlist(s).`);
    } catch (error) {
      setSpotifyStatus(
        error instanceof Error ? error.message : "Failed to load Spotify playlists."
      );
    } finally {
      setSpotifyLoading(false);
    }
  }

  async function importSelectedSpotifyPlaylist(): Promise<void> {
    if (
      !spotifyToken ||
      !selectedSpotifyPlaylistId ||
      spotifyImportDialogPaneIndex === null
    ) {
      return;
    }

    const selected = spotifyPlaylists.find((playlist) => playlist.id === selectedSpotifyPlaylistId);
    if (!selected) {
      return;
    }

    setSpotifyLoading(true);
    setSpotifyStatus(`Importing "${selected.name}"...`);

    try {
      const tracks = await getPlaylistTracks(spotifyToken, selected.id);

      const tracksByLocalSongId = new Map(
        tracks.map((track) => [
          `spotify:${track.id}`,
          {
            id: `spotify:${track.id}`,
            title: track.title,
            artist: track.artists,
            artworkUrl: track.artworkUrl,
            spotifyUri: track.spotifyUri
          }
        ])
      );

      setSongs((prevSongs) => {
        const merged = [...prevSongs];
        const existing = new Set(prevSongs.map((song) => song.id));
        for (const [songId, song] of tracksByLocalSongId) {
          if (!existing.has(songId)) {
            merged.push(song);
          }
        }
        return merged;
      });

      setPlaylists((prevPlaylists) => {
        const uniquePlaylistId = buildUniquePlaylistId(
          prevPlaylists,
          `playlist-spotify-${selected.id}`
        );

        const importedSongIds: string[] = [];

        for (const track of tracks) {
          const localSongId = `spotify:${track.id}`;
          importedSongIds.push(localSongId);
        }

        const importedPlaylist: Playlist = {
          id: uniquePlaylistId,
          name: `${selected.name} (Spotify)`,
          songIds: importedSongIds
        };

        setPanePlaylistIds((prevPaneIds) =>
          prevPaneIds.map((playlistId, paneIndex) =>
            paneIndex === spotifyImportDialogPaneIndex ? importedPlaylist.id : playlistId
          )
        );

        return [...prevPlaylists, importedPlaylist];
      });

      setSpotifyStatus(
        `Imported "${selected.name}" into pane ${spotifyImportDialogPaneIndex + 1}.`
      );
      setSpotifyImportDialogPaneIndex(null);
    } catch (error) {
      setSpotifyStatus(
        error instanceof Error ? error.message : "Failed to import selected Spotify playlist."
      );
    } finally {
      setSpotifyLoading(false);
    }
  }

  function onSongClick(playlistId: string, songId: string): void {
    setSelectedSong((prev) =>
      prev?.playlistId === playlistId && prev.songId === songId
        ? null
        : { playlistId, songId }
    );
  }

  function deleteSelectedFromPlaylist(playlistId: string): void {
    if (!selectedSong || selectedSong.playlistId !== playlistId) {
      return;
    }

    setPlaylists((prev) =>
      removeSongFromPlaylist(prev, selectedSong.playlistId, selectedSong.songId)
    );
    setSelectedSong(null);
  }

  function onSongDragStart(
    event: React.DragEvent<HTMLElement>,
    sourcePlaylistId: string,
    songId: string
  ): void {
    const mode: DragPayload["mode"] = event.shiftKey ? "move" : "copy";
    setDragModeLabel(mode);

    const payload: DragPayload = { songId, sourcePlaylistId, mode };
    dragPayloadRef.current = payload;
    const payloadText = JSON.stringify(payload);
    event.dataTransfer.setData(DRAG_MIME, payloadText);
    event.dataTransfer.setData("text/plain", payloadText);
    event.dataTransfer.effectAllowed = "copyMove";
  }

  function onPaneDrop(
    event: React.DragEvent<HTMLElement>,
    destinationPlaylistId: string,
    destinationIndex?: number
  ): void {
    event.preventDefault();
    const payloadRaw =
      event.dataTransfer.getData(DRAG_MIME) ||
      event.dataTransfer.getData("text/plain");
    let payload: DragPayload | null = null;

    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw) as DragPayload;
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      payload = dragPayloadRef.current;
    }

    if (!payload) {
      return;
    }

    const resolvedIndex =
      destinationIndex ??
      (dropTarget?.playlistId === destinationPlaylistId
        ? dropTarget.index
        : playlists.find((playlist) => playlist.id === destinationPlaylistId)?.songIds
            .length ?? 0);

    setPlaylists((prev) =>
      applySongDropAtIndex(prev, payload, destinationPlaylistId, resolvedIndex)
    );
    setDropTarget(null);
    dragPayloadRef.current = null;
  }

  function onDropSlotDragOver(
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    destinationIndex: number
  ): void {
    event.preventDefault();
    setDropTarget({ playlistId, index: destinationIndex });
  }

  function onSongCardDragOver(
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    songIndex: number
  ): void {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const isLowerHalf = event.clientY > bounds.top + bounds.height / 2;
    setDropTarget({ playlistId, index: isLowerHalf ? songIndex + 1 : songIndex });
  }

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Milestone 2 UI Concept</p>
          <h1>Roadtrip Playlist Pane Editor</h1>
          <p className="subtitle">
            Drag songs between playlist panes. Default: copy. Hold Shift while dragging
            to move.
          </p>
        </div>
        <div className="workspace-actions">
          <button onClick={addPane} disabled={!availableForNewPane}>
            Add Pane
          </button>
          <span className="drag-mode-indicator">Current drag mode: {dragModeLabel}</span>
          {spotifyAuthError && <span className="status-error">{spotifyAuthError}</span>}
          {spotifyStatus && <span className="status-info">{spotifyStatus}</span>}
        </div>
      </header>

      <section className="pane-grid">
        {panePlaylistIds.map((panePlaylistId, paneIndex) => {
          const playlist = playlists.find((item) => item.id === panePlaylistId);
          if (!playlist) {
            return null;
          }

          return (
            <article
              className="pane"
              key={`${paneIndex}-${panePlaylistId}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onPaneDrop(event, playlist.id)}
            >
              <header className="pane-header">
                <select
                  value={playlist.id}
                  onChange={(event) => updatePanePlaylist(paneIndex, event.target.value)}
                >
                  {playlists.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                  <option value={NEW_PLAYLIST_VALUE}>New playlist...</option>
                  <option value={IMPORT_SPOTIFY_VALUE}>Import from Spotify...</option>
                </select>
                <button
                  className="pane-delete"
                  onClick={() => deleteSelectedFromPlaylist(playlist.id)}
                  disabled={selectedSong?.playlistId !== playlist.id}
                  title="Delete selected song from this playlist"
                >
                  Delete Selected
                </button>
                <button
                  className="pane-remove"
                  onClick={() => removePane(paneIndex)}
                  disabled={panePlaylistIds.length <= 1}
                  title="Remove pane"
                >
                  Remove
                </button>
              </header>

              <ul className="song-list">
                {playlist.songIds.map((songId, songIndex) => {
                  const song = songsById.get(songId);
                  if (!song) {
                    return null;
                  }
                  const membershipCount = countSongMemberships(playlists, song.id);

                  return (
                    <li className="song-row" key={`${playlist.id}-${song.id}`}>
                      <div
                        className={`drop-slot ${
                          dropTarget?.playlistId === playlist.id &&
                          dropTarget.index === songIndex
                            ? "drop-slot-active"
                            : ""
                        }`}
                        onDragOver={(event) =>
                          onDropSlotDragOver(event, playlist.id, songIndex)
                        }
                        onDrop={(event) => onPaneDrop(event, playlist.id, songIndex)}
                      />
                      <article
                        className={`song-card ${
                          selectedSong?.playlistId === playlist.id &&
                          selectedSong.songId === song.id
                            ? "song-card-selected"
                            : ""
                        }`}
                        draggable
                        onClick={() => onSongClick(playlist.id, song.id)}
                        onDragStart={(event) =>
                          onSongDragStart(event, playlist.id, song.id)
                        }
                        onDragOver={(event) =>
                          onSongCardDragOver(event, playlist.id, songIndex)
                        }
                        onDragEnd={() => {
                          setDropTarget(null);
                          dragPayloadRef.current = null;
                        }}
                      >
                        <img src={song.artworkUrl} alt="" />
                        <div className="song-copy">
                          <strong>{song.title}</strong>
                          <span>{song.artist}</span>
                          <small>
                            in {membershipCount} playlist
                            {membershipCount === 1 ? "" : "s"}
                          </small>
                        </div>
                      </article>
                    </li>
                  );
                })}
                <li className="song-row">
                  <div
                    className={`drop-slot ${
                      dropTarget?.playlistId === playlist.id &&
                      dropTarget.index === playlist.songIds.length
                        ? "drop-slot-active"
                        : ""
                    }`}
                    onDragOver={(event) =>
                      onDropSlotDragOver(event, playlist.id, playlist.songIds.length)
                    }
                    onDrop={(event) =>
                      onPaneDrop(event, playlist.id, playlist.songIds.length)
                    }
                  />
                </li>
              </ul>
            </article>
          );
        })}
      </section>

      {newPlaylistDialogPaneIndex !== null && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>Create Playlist</h2>
            <label>
              Playlist name
              <input
                autoFocus
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    createPlaylistFromDialog();
                  }
                }}
              />
            </label>
            <div className="modal-actions">
              <button
                className="modal-cancel"
                onClick={() => {
                  setNewPlaylistDialogPaneIndex(null);
                  setNewPlaylistName("");
                }}
              >
                Cancel
              </button>
              <button
                className="modal-create"
                onClick={createPlaylistFromDialog}
                disabled={!newPlaylistName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {spotifyImportDialogPaneIndex !== null && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>Import From Spotify</h2>
            <p className="modal-support">
              Target pane: {spotifyImportDialogPaneIndex + 1}
            </p>
            {!spotifyToken ? (
              <>
                <p className="modal-support">
                  Connect Spotify first to load your playlists.
                </p>
                <div className="modal-actions">
                  <button
                    className="modal-cancel"
                    onClick={() => setSpotifyImportDialogPaneIndex(null)}
                  >
                    Cancel
                  </button>
                  <button className="modal-create" onClick={() => void connectSpotify()}>
                    Connect Spotify
                  </button>
                </div>
              </>
            ) : (
              <>
                <label>
                  Spotify playlist
                  <select
                    value={selectedSpotifyPlaylistId}
                    onChange={(event) => setSelectedSpotifyPlaylistId(event.target.value)}
                    disabled={spotifyLoading}
                  >
                    <option value="">Select Spotify playlist...</option>
                    {spotifyPlaylists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name} ({playlist.tracksTotal})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="modal-actions">
                  <button
                    className="modal-cancel"
                    onClick={() => setSpotifyImportDialogPaneIndex(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="modal-cancel"
                    onClick={() => void loadSpotifyPlaylists()}
                    disabled={spotifyLoading}
                  >
                    Refresh List
                  </button>
                  <button className="modal-cancel" onClick={disconnectSpotify}>
                    Disconnect
                  </button>
                  <button
                    className="modal-create"
                    onClick={() => void importSelectedSpotifyPlaylist()}
                    disabled={!selectedSpotifyPlaylistId || spotifyLoading}
                  >
                    Import
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
