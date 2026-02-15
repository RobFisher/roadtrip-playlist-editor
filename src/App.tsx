import { useMemo, useState } from "react";
import "./app.css";
import {
  removeSongFromPlaylist,
  seedProjectData,
  type Playlist
} from "./playlistModel.js";
import { NewPlaylistDialog } from "./components/NewPlaylistDialog.js";
import { PlaylistPane } from "./components/PlaylistPane.js";
import { SpotifyImportDialog } from "./components/SpotifyImportDialog.js";
import { WorkspaceHeader } from "./components/WorkspaceHeader.js";
import { useSpotifyAuth } from "./hooks/useSpotifyAuth.js";
import { usePaneDragDrop } from "./hooks/usePaneDragDrop.js";
import { useSpotifyImport } from "./hooks/useSpotifyImport.js";

const initialPanePlaylistIds = seedProjectData.playlists.slice(0, 3).map((p) => p.id);
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
  const [selectedSong, setSelectedSong] = useState<{
    playlistId: string;
    songId: string;
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
  const {
    dragModeLabel,
    dropTarget,
    onSongDragStart,
    onPaneDrop,
    onDropSlotDragOver,
    onSongCardDragOver,
    onSongDragEnd
  } = usePaneDragDrop({
    playlists,
    setPlaylists
  });

  const songsById = useMemo(() => {
    return new Map(songs.map((song) => [song.id, song]));
  }, [songs]);

  const availableForNewPane = playlists.find(
    (playlist) => !panePlaylistIds.includes(playlist.id)
  );
  const {
    spotifyPlaylists,
    spotifyUserId,
    spotifyLoading,
    selectedSpotifyPlaylistId,
    spotifyImportDialogPaneIndex,
    spotifyStatus,
    spotifyDebugCurlCommands,
    setSelectedSpotifyPlaylistId,
    openSpotifyImportDialog,
    closeSpotifyImportDialog,
    loadSpotifyPlaylists,
    importSelectedSpotifyPlaylist,
    disconnectSpotifyImport,
    copySpotifyDebugCurl
  } = useSpotifyImport({
    spotifyToken,
    playlists,
    setSongs,
    setPlaylists,
    setPanePlaylistIds,
    onDisconnectAuth: disconnectSpotifyAuth,
    buildUniquePlaylistId
  });

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
      openSpotifyImportDialog(index);
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
              onSongDragEnd={onSongDragEnd}
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
        onClose={closeSpotifyImportDialog}
        onConnectSpotify={connectSpotify}
        onDisconnectSpotify={disconnectSpotifyImport}
        onRefreshPlaylists={loadSpotifyPlaylists}
        onImportSelected={importSelectedSpotifyPlaylist}
        onPlaylistSelect={setSelectedSpotifyPlaylistId}
        onCopyDebugCurl={copySpotifyDebugCurl}
      />
    </main>
  );
}
