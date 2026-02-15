import { useEffect, useMemo, useRef, useState } from "react";
import "./app.css";
import {
  applySongDropAtIndex,
  removeSongFromPlaylist,
  seedProjectData,
  type DragPayload,
  type Playlist
} from "./playlistModel.js";
import {
  getCurrentUserProfile,
  getCurrentUserPlaylists,
  getPlaylistTracks,
  type SpotifyPlaylistSummary
} from "./spotify.js";
import { NewPlaylistDialog } from "./components/NewPlaylistDialog.js";
import { PlaylistPane } from "./components/PlaylistPane.js";
import { SpotifyImportDialog } from "./components/SpotifyImportDialog.js";
import { WorkspaceHeader } from "./components/WorkspaceHeader.js";
import { useSpotifyAuth } from "./hooks/useSpotifyAuth.js";

const initialPanePlaylistIds = seedProjectData.playlists.slice(0, 3).map((p) => p.id);
const DRAG_MIME = "application/x-roadtrip-song";
const NEW_PLAYLIST_VALUE = "__new_playlist__";
const IMPORT_SPOTIFY_VALUE = "__import_spotify__";

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
  const {
    spotifyToken,
    spotifyAuthError,
    connectSpotify,
    disconnectSpotify: disconnectSpotifyAuth
  } = useSpotifyAuth();
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [spotifyUserId, setSpotifyUserId] = useState<string | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [selectedSpotifyPlaylistId, setSelectedSpotifyPlaylistId] = useState<string>("");
  const [spotifyImportDialogPaneIndex, setSpotifyImportDialogPaneIndex] = useState<number | null>(
    null
  );
  const [spotifyAutoLoadTriggered, setSpotifyAutoLoadTriggered] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);

  const songsById = useMemo(() => {
    return new Map(songs.map((song) => [song.id, song]));
  }, [songs]);

  const availableForNewPane = playlists.find(
    (playlist) => !panePlaylistIds.includes(playlist.id)
  );
  const spotifyDebugCurlCommands = useMemo(() => {
    if (!spotifyToken) {
      return "";
    }

    const playlistId = selectedSpotifyPlaylistId || "<playlist_id>";
    return [
      `curl -i -H "Authorization: Bearer ${spotifyToken}" "https://api.spotify.com/v1/me"`,
      `curl -i -H "Authorization: Bearer ${spotifyToken}" "https://api.spotify.com/v1/me/playlists?limit=50"`,
      `curl -i -H "Authorization: Bearer ${spotifyToken}" "https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=100"`
    ].join("\n\n");
  }, [selectedSpotifyPlaylistId, spotifyToken]);

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
      setSpotifyAutoLoadTriggered(false);
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

  function disconnectSpotify(): void {
    disconnectSpotifyAuth();
    setSpotifyPlaylists([]);
    setSelectedSpotifyPlaylistId("");
    setSpotifyUserId(null);
    setSpotifyAutoLoadTriggered(false);
  }

  useEffect(() => {
    if (
      spotifyImportDialogPaneIndex === null ||
      !spotifyToken ||
      spotifyAutoLoadTriggered
    ) {
      return;
    }

    setSpotifyAutoLoadTriggered(true);
    void loadSpotifyPlaylists();
  }, [spotifyAutoLoadTriggered, spotifyImportDialogPaneIndex, spotifyToken]);

  async function loadSpotifyPlaylists(): Promise<void> {
    if (!spotifyToken) {
      return;
    }
    setSpotifyLoading(true);
    setSpotifyStatus("Loading Spotify playlists...");

    try {
      const [profile, loaded] = await Promise.all([
        getCurrentUserProfile(spotifyToken),
        getCurrentUserPlaylists(spotifyToken)
      ]);
      setSpotifyUserId(profile.id);
      setSpotifyPlaylists(loaded);
      setSelectedSpotifyPlaylistId(loaded[0]?.id ?? "");
      setSpotifyStatus(
        `Loaded ${loaded.length} playlist(s).`
      );
    } catch (error) {
      setSpotifyStatus(
        error instanceof Error ? error.message : "Failed to load Spotify playlists."
      );
    } finally {
      setSpotifyLoading(false);
    }
  }

  async function copySpotifyDebugCurl(): Promise<void> {
    if (!spotifyDebugCurlCommands) {
      return;
    }
    try {
      await navigator.clipboard.writeText(spotifyDebugCurlCommands);
      setSpotifyStatus("Copied Spotify cURL commands to clipboard.");
    } catch {
      setSpotifyStatus("Failed to copy cURL commands. Select and copy manually.");
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
      if (tracks.length === 0) {
        setSpotifyStatus(
          `Imported 0 songs from "${selected.name}". The playlist may contain unavailable/local-only items for this token.`
        );
      }

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
        `Imported ${tracks.length} song(s) from "${selected.name}" into pane ${spotifyImportDialogPaneIndex + 1}.`
      );
      setSpotifyImportDialogPaneIndex(null);
      setSpotifyAutoLoadTriggered(false);
    } catch (error) {
      if (error instanceof Error && error.message.includes("403")) {
        setSpotifyStatus(
          `Spotify returned 403 while reading this playlist. ${error.message}. Ensure you are logged into the same Spotify account added in your app's user allowlist, then disconnect/reconnect and retry.`
        );
        return;
      }
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
      <WorkspaceHeader
        canAddPane={Boolean(availableForNewPane)}
        dragModeLabel={dragModeLabel}
        spotifyAuthError={spotifyAuthError}
        spotifyStatus={spotifyStatus}
        onAddPane={addPane}
      />

      <section className="pane-grid">
        {panePlaylistIds.map((panePlaylistId, paneIndex) => {
          const playlist = playlists.find((item) => item.id === panePlaylistId);
          if (!playlist) {
            return null;
          }

          return (
            <PlaylistPane
              key={`${paneIndex}-${panePlaylistId}`}
              paneIndex={paneIndex}
              paneCount={panePlaylistIds.length}
              playlist={playlist}
              playlists={playlists}
              songsById={songsById}
              selectedSong={selectedSong}
              dropTarget={dropTarget}
              newPlaylistValue={NEW_PLAYLIST_VALUE}
              importSpotifyValue={IMPORT_SPOTIFY_VALUE}
              onUpdatePanePlaylist={updatePanePlaylist}
              onDeleteSelectedFromPlaylist={deleteSelectedFromPlaylist}
              onRemovePane={removePane}
              onPaneDrop={onPaneDrop}
              onDropSlotDragOver={onDropSlotDragOver}
              onSongCardDragOver={onSongCardDragOver}
              onSongDragStart={onSongDragStart}
              onSongClick={onSongClick}
              onSongDragEnd={() => {
                setDropTarget(null);
                dragPayloadRef.current = null;
              }}
            />
          );
        })}
      </section>

      <NewPlaylistDialog
        isOpen={newPlaylistDialogPaneIndex !== null}
        name={newPlaylistName}
        onNameChange={setNewPlaylistName}
        onCreate={createPlaylistFromDialog}
        onCancel={() => {
          setNewPlaylistDialogPaneIndex(null);
          setNewPlaylistName("");
        }}
      />
      <SpotifyImportDialog
        isOpen={spotifyImportDialogPaneIndex !== null}
        targetPaneIndex={spotifyImportDialogPaneIndex}
        spotifyToken={spotifyToken}
        spotifyLoading={spotifyLoading}
        selectedSpotifyPlaylistId={selectedSpotifyPlaylistId}
        spotifyPlaylists={spotifyPlaylists}
        spotifyUserId={spotifyUserId}
        spotifyDebugCurlCommands={spotifyDebugCurlCommands}
        onClose={() => {
          setSpotifyImportDialogPaneIndex(null);
          setSpotifyAutoLoadTriggered(false);
        }}
        onConnectSpotify={connectSpotify}
        onDisconnectSpotify={disconnectSpotify}
        onRefreshPlaylists={loadSpotifyPlaylists}
        onImportSelected={importSelectedSpotifyPlaylist}
        onPlaylistSelect={setSelectedSpotifyPlaylistId}
        onCopyDebugCurl={copySpotifyDebugCurl}
      />
    </main>
  );
}
