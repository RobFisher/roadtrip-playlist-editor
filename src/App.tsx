import { useMemo, useRef, useState } from "react";
import "./app.css";
import {
  removeSongFromPlaylist,
  seedProjectData,
  type Playlist
} from "./playlistModel.js";
import {
  parseProjectState,
  serializeProjectState,
  type PaneMode
} from "./projectPersistence.js";
import { DeleteListDialog } from "./components/DeleteListDialog.js";
import { NewPlaylistDialog } from "./components/NewPlaylistDialog.js";
import { PlaylistPane } from "./components/PlaylistPane.js";
import { SaveProjectDialog } from "./components/SaveProjectDialog.js";
import { SpotifyExportDialog } from "./components/SpotifyExportDialog.js";
import { SpotifyImportDialog } from "./components/SpotifyImportDialog.js";
import { SpotifySearchDialog } from "./components/SpotifySearchDialog.js";
import { WorkspaceHeader } from "./components/WorkspaceHeader.js";
import { useSpotifyAuth } from "./hooks/useSpotifyAuth.js";
import { usePaneDragDrop } from "./hooks/usePaneDragDrop.js";
import { useSpotifyImport } from "./hooks/useSpotifyImport.js";
import {
  addItemsToSpotifyPlaylist,
  createSpotifyPlaylist,
  searchSpotifyTracks
} from "./spotify.js";

const initialPanePlaylistIds = seedProjectData.playlists.slice(0, 3).map((p) => p.id);
const initialPaneModes: PaneMode[] = initialPanePlaylistIds.map(() => "playlist");
const NEW_PLAYLIST_VALUE = "__new_playlist__";
const IMPORT_SPOTIFY_VALUE = "__import_spotify__";
const SEARCH_SPOTIFY_VALUE = "__search_spotify__";
const SPOTIFY_SEARCH_PAGE_SIZE = 10;

interface PaneSearchState {
  query: string;
  nextOffset: number;
  total: number;
}

function normalizePlaylistName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toFilenameSlug(projectName: string): string {
  const normalized = normalizeProjectName(projectName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
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
  const loadProjectInputRef = useRef<HTMLInputElement | null>(null);
  const [songs, setSongs] = useState(seedProjectData.songs);
  const [playlists, setPlaylists] = useState<Playlist[]>(seedProjectData.playlists);
  const [panePlaylistIds, setPanePlaylistIds] = useState<string[]>(initialPanePlaylistIds);
  const [paneModes, setPaneModes] = useState<PaneMode[]>(initialPaneModes);
  const [selectedSong, setSelectedSong] = useState<{
    playlistId: string;
    songId: string;
  } | null>(null);
  const [newPlaylistDialogPaneIndex, setNewPlaylistDialogPaneIndex] = useState<number | null>(
    null
  );
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [saveProjectDialogOpen, setSaveProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [spotifyExportDialogPaneIndex, setSpotifyExportDialogPaneIndex] = useState<
    number | null
  >(null);
  const [spotifyExportPlaylistName, setSpotifyExportPlaylistName] = useState("");
  const [spotifyExportLoading, setSpotifyExportLoading] = useState(false);
  const [deleteListDialogPaneIndex, setDeleteListDialogPaneIndex] = useState<number | null>(
    null
  );
  const [spotifySearchDialogPaneIndex, setSpotifySearchDialogPaneIndex] = useState<
    number | null
  >(null);
  const [spotifySearchQuery, setSpotifySearchQuery] = useState("");
  const [paneSearchStates, setPaneSearchStates] = useState<Array<PaneSearchState | null>>(
    initialPanePlaylistIds.map(() => null)
  );
  const [spotifySearchLoading, setSpotifySearchLoading] = useState(false);
  const [spotifySearchLoadMorePaneIndex, setSpotifySearchLoadMorePaneIndex] = useState<
    number | null
  >(null);
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
    setSpotifyStatusMessage,
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
    setPaneModes,
    onDisconnectAuth: disconnectSpotifyAuth,
    buildUniquePlaylistId
  });
  const [projectStatus, setProjectStatus] = useState<string | null>(null);

  const spotifyConnected = Boolean(spotifyToken);
  const spotifyBusy =
    spotifyLoading ||
    spotifyExportLoading ||
    spotifySearchLoading ||
    spotifySearchLoadMorePaneIndex !== null;

  const spotifyExportSourcePlaylist = useMemo(() => {
    if (spotifyExportDialogPaneIndex === null) {
      return null;
    }
    const playlistId = panePlaylistIds[spotifyExportDialogPaneIndex];
    return playlists.find((playlist) => playlist.id === playlistId) ?? null;
  }, [panePlaylistIds, playlists, spotifyExportDialogPaneIndex]);

  const searchOnlyPlaylistIds = useMemo(() => {
    const usedByPlaylistPane = new Set<string>();
    const usedBySearchPane = new Set<string>();

    panePlaylistIds.forEach((playlistId, paneIndex) => {
      const mode = paneModes[paneIndex] ?? "playlist";
      if (mode === "search") {
        usedBySearchPane.add(playlistId);
      } else {
        usedByPlaylistPane.add(playlistId);
      }
    });

    return new Set(
      [...usedBySearchPane].filter((playlistId) => !usedByPlaylistPane.has(playlistId))
    );
  }, [paneModes, panePlaylistIds]);

  const membershipPlaylists = useMemo(
    () => playlists.filter((playlist) => !searchOnlyPlaylistIds.has(playlist.id)),
    [playlists, searchOnlyPlaylistIds]
  );

  const spotifyExportableSongUris = useMemo(() => {
    if (!spotifyExportSourcePlaylist) {
      return [] as string[];
    }
    const seenUris = new Set<string>();
    const uris: string[] = [];
    spotifyExportSourcePlaylist.songIds.forEach((songId) => {
      const uri = songsById.get(songId)?.spotifyUri?.trim() ?? "";
      if (!uri || seenUris.has(uri)) {
        return;
      }
      seenUris.add(uri);
      uris.push(uri);
    });
    return uris;
  }, [songsById, spotifyExportSourcePlaylist]);

  function addPane(): void {
    if (!availableForNewPane) {
      return;
    }
    setPanePlaylistIds((prev) => [...prev, availableForNewPane.id]);
    setPaneModes((prev) => [...prev, "playlist"]);
    setPaneSearchStates((prev) => [...prev, null]);
  }

  function removePane(index: number): void {
    setPanePlaylistIds((prev) => prev.filter((_, paneIndex) => paneIndex !== index));
    setPaneModes((prev) => prev.filter((_, paneIndex) => paneIndex !== index));
    setPaneSearchStates((prev) => prev.filter((_, paneIndex) => paneIndex !== index));
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
    if (playlistId === SEARCH_SPOTIFY_VALUE) {
      openSpotifySearchDialog(index);
      return;
    }

    setPanePlaylistIds((prev) =>
      prev.map((currentId, paneIndex) =>
        paneIndex === index ? playlistId : currentId
      )
    );
    setPaneModes((prev) =>
      prev.map((mode, paneIndex) => (paneIndex === index ? "playlist" : mode))
    );
    setPaneSearchStates((prev) =>
      prev.map((state, paneIndex) => (paneIndex === index ? null : state))
    );
  }

  function openSpotifyExportDialog(paneIndex: number): void {
    const selectedPlaylistId = panePlaylistIds[paneIndex];
    const selectedPlaylist = playlists.find((playlist) => playlist.id === selectedPlaylistId);
    const defaultName = selectedPlaylist
      ? `${selectedPlaylist.name} (Roadtrip Export)`
      : "Roadtrip Export";
    setSpotifyExportPlaylistName(defaultName);
    setSpotifyExportDialogPaneIndex(paneIndex);
  }

  function closeSpotifyExportDialog(): void {
    if (spotifyExportLoading) {
      return;
    }
    setSpotifyExportDialogPaneIndex(null);
  }

  function openSpotifySearchDialog(paneIndex: number): void {
    setSpotifySearchDialogPaneIndex(paneIndex);
  }

  function closeSpotifySearchDialog(): void {
    setSpotifySearchDialogPaneIndex(null);
  }

  function openDeleteListDialog(paneIndex: number): void {
    setDeleteListDialogPaneIndex(paneIndex);
  }

  function closeDeleteListDialog(): void {
    setDeleteListDialogPaneIndex(null);
  }

  function confirmDeleteList(): void {
    if (deleteListDialogPaneIndex === null) {
      return;
    }

    const targetPaneIndex = deleteListDialogPaneIndex;
    const targetPlaylistId = panePlaylistIds[targetPaneIndex];
    const targetPlaylist = playlists.find((playlist) => playlist.id === targetPlaylistId);
    if (!targetPlaylist) {
      closeDeleteListDialog();
      return;
    }

    const remainingPlaylists = playlists.filter(
      (playlist) => playlist.id !== targetPlaylistId
    );
    const fallbackPlaylist =
      remainingPlaylists[0] ??
      ({
        id: buildUniquePlaylistId(remainingPlaylists, "playlist-untitled"),
        name: "Untitled Playlist",
        songIds: []
      } satisfies Playlist);
    const nextPlaylists =
      remainingPlaylists.length > 0
        ? remainingPlaylists
        : [...remainingPlaylists, fallbackPlaylist];

    const nextPanePlaylistIds = panePlaylistIds.map((playlistId) =>
      playlistId === targetPlaylistId ? fallbackPlaylist.id : playlistId
    );
    const nextPaneModes = paneModes.map((mode, paneIndex) =>
      panePlaylistIds[paneIndex] === targetPlaylistId ? "playlist" : mode
    );
    const nextPaneSearchStates = paneSearchStates.map((state, paneIndex) =>
      panePlaylistIds[paneIndex] === targetPlaylistId ? null : state
    );

    setPlaylists(nextPlaylists);
    setPanePlaylistIds(nextPanePlaylistIds);
    setPaneModes(nextPaneModes);
    setPaneSearchStates(nextPaneSearchStates);

    if (selectedSong?.playlistId === targetPlaylistId) {
      setSelectedSong(null);
    }
    if (
      spotifyExportDialogPaneIndex !== null &&
      panePlaylistIds[spotifyExportDialogPaneIndex] === targetPlaylistId
    ) {
      setSpotifyExportDialogPaneIndex(null);
    }
    if (
      spotifySearchLoadMorePaneIndex !== null &&
      panePlaylistIds[spotifySearchLoadMorePaneIndex] === targetPlaylistId
    ) {
      setSpotifySearchLoadMorePaneIndex(null);
    }

    const listKindLabel = paneModes[targetPaneIndex] === "search" ? "search results" : "playlist";
    setSpotifyStatusMessage(
      `Deleted ${listKindLabel} "${targetPlaylist.name}" from this project.`
    );
    closeDeleteListDialog();
  }

  async function searchSpotifyForPane(): Promise<void> {
    if (!spotifyToken || spotifySearchDialogPaneIndex === null) {
      setSpotifyStatusMessage("Connect Spotify before searching.");
      return;
    }

    const query = normalizePlaylistName(spotifySearchQuery);
    if (!query) {
      setSpotifyStatusMessage("Spotify search query is required.");
      return;
    }

    setSpotifySearchLoading(true);
    setSpotifyStatusMessage(`Searching Spotify for "${query}"...`);

    try {
      const result = await searchSpotifyTracks(spotifyToken, {
        query,
        limit: SPOTIFY_SEARCH_PAGE_SIZE,
        offset: 0
      });

      const tracksByLocalSongId = new Map(
        result.tracks.map((track) => [
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
        const searchPlaylistName = `Search: ${query}`;
        const existingSearchPlaylist = prevPlaylists.find(
          (playlist) => playlist.name.toLowerCase() === searchPlaylistName.toLowerCase()
        );
        const searchPlaylistId =
          existingSearchPlaylist?.id ??
          buildUniquePlaylistId(prevPlaylists, `playlist-search-${Date.now()}`);
        const searchPlaylist: Playlist = {
          id: searchPlaylistId,
          name: searchPlaylistName,
          songIds: result.tracks.map((track) => `spotify:${track.id}`)
        };

        setPanePlaylistIds((prevPaneIds) =>
          prevPaneIds.map((playlistId, paneIndex) =>
            paneIndex === spotifySearchDialogPaneIndex ? searchPlaylist.id : playlistId
          )
        );
        setPaneModes((prevModes) =>
          prevModes.map((mode, paneIndex) =>
            paneIndex === spotifySearchDialogPaneIndex ? "search" : mode
          )
        );
        setPaneSearchStates((prevStates) =>
          prevStates.map((state, paneIndex) =>
            paneIndex === spotifySearchDialogPaneIndex
              ? {
                  query,
                  nextOffset: SPOTIFY_SEARCH_PAGE_SIZE,
                  total: result.total
                }
              : state
          )
        );

        if (existingSearchPlaylist) {
          return prevPlaylists.map((playlist) =>
            playlist.id === existingSearchPlaylist.id ? searchPlaylist : playlist
          );
        }
        return [...prevPlaylists, searchPlaylist];
      });

      setSelectedSong(null);
      setSpotifyStatusMessage(
        `Search added ${result.tracks.length} track(s) to pane ${
          spotifySearchDialogPaneIndex + 1
        } (1-${result.tracks.length} of ${result.total}).`
      );
      closeSpotifySearchDialog();
    } catch (error) {
      if (error instanceof Error && error.message.includes("(429)")) {
        setSpotifyStatusMessage(
          `Spotify search is rate-limited right now. Retry in a moment. ${error.message}`
        );
      } else {
        setSpotifyStatusMessage(
          error instanceof Error ? error.message : "Spotify search failed."
        );
      }
    } finally {
      setSpotifySearchLoading(false);
    }
  }

  async function loadMoreSearchResults(paneIndex: number): Promise<void> {
    if (!spotifyToken) {
      setSpotifyStatusMessage("Connect Spotify before loading more results.");
      return;
    }
    if (paneModes[paneIndex] !== "search") {
      return;
    }

    const searchState = paneSearchStates[paneIndex];
    if (!searchState || searchState.nextOffset >= searchState.total) {
      return;
    }

    const panePlaylistId = panePlaylistIds[paneIndex];
    if (!panePlaylistId) {
      return;
    }

    setSpotifySearchLoadMorePaneIndex(paneIndex);
    setSpotifyStatusMessage(
      `Loading more search results in pane ${paneIndex + 1}...`
    );

    try {
      const result = await searchSpotifyTracks(spotifyToken, {
        query: searchState.query,
        limit: SPOTIFY_SEARCH_PAGE_SIZE,
        offset: searchState.nextOffset
      });

      const newSongIds = result.tracks.map((track) => `spotify:${track.id}`);
      const tracksByLocalSongId = new Map(
        result.tracks.map((track) => [
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

      setPlaylists((prevPlaylists) =>
        prevPlaylists.map((playlist) => {
          if (playlist.id !== panePlaylistId) {
            return playlist;
          }
          const existingSongIds = new Set(playlist.songIds);
          const appended = newSongIds.filter((songId) => !existingSongIds.has(songId));
          return {
            ...playlist,
            songIds: [...playlist.songIds, ...appended]
          };
        })
      );

      setPaneSearchStates((prevStates) =>
        prevStates.map((state, index) => {
          if (index !== paneIndex || !state) {
            return state;
          }
          return {
            ...state,
            nextOffset: state.nextOffset + SPOTIFY_SEARCH_PAGE_SIZE,
            total: result.total
          };
        })
      );

      setSpotifyStatusMessage(
        `Loaded ${result.tracks.length} more track(s) in pane ${paneIndex + 1}.`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("(429)")) {
        setSpotifyStatusMessage(
          `Spotify search is rate-limited right now. Retry in a moment. ${error.message}`
        );
      } else {
        setSpotifyStatusMessage(
          error instanceof Error ? error.message : "Failed to load more search results."
        );
      }
    } finally {
      setSpotifySearchLoadMorePaneIndex(null);
    }
  }

  async function exportActivePaneToSpotify(): Promise<void> {
    if (!spotifyToken || !spotifyExportSourcePlaylist) {
      setSpotifyStatusMessage("Connect Spotify before exporting.");
      return;
    }

    const trimmedPlaylistName = normalizePlaylistName(spotifyExportPlaylistName);
    if (!trimmedPlaylistName) {
      setSpotifyStatusMessage("Spotify playlist name is required.");
      return;
    }

    if (spotifyExportableSongUris.length === 0) {
      setSpotifyStatusMessage(
        `Pane ${spotifyExportDialogPaneIndex !== null ? spotifyExportDialogPaneIndex + 1 : ""} has no songs with Spotify URI, so nothing can be exported.`
      );
      return;
    }

    setSpotifyExportLoading(true);
    setSpotifyStatusMessage(`Exporting "${trimmedPlaylistName}" to Spotify...`);

    try {
      const createdPlaylist = await createSpotifyPlaylist(spotifyToken, {
        name: trimmedPlaylistName,
        description: `Exported from Roadtrip Playlist Pane Editor (${new Date().toISOString()})`,
        isPublic: false
      });
      await addItemsToSpotifyPlaylist(
        spotifyToken,
        createdPlaylist.id,
        spotifyExportableSongUris
      );
      setSpotifyStatusMessage(
        `Exported ${spotifyExportableSongUris.length} song(s) to Spotify playlist "${createdPlaylist.name}".${
          createdPlaylist.externalUrl ? ` ${createdPlaylist.externalUrl}` : ""
        }`
      );
      if (spotifyExportDialogPaneIndex !== null) {
        setPaneModes((prev) =>
          prev.map((mode, paneIndex) =>
            paneIndex === spotifyExportDialogPaneIndex ? "playlist" : mode
          )
        );
        setPaneSearchStates((prev) =>
          prev.map((state, paneIndex) =>
            paneIndex === spotifyExportDialogPaneIndex ? null : state
          )
        );
      }
      setSpotifyExportDialogPaneIndex(null);
    } catch (error) {
      setSpotifyStatusMessage(
        error instanceof Error ? error.message : "Failed to export playlist to Spotify."
      );
    } finally {
      setSpotifyExportLoading(false);
    }
  }

  function toggleSpotifyConnection(): void {
    if (spotifyConnected) {
      disconnectSpotifyImport();
      setSpotifyStatusMessage("Disconnected Spotify.");
      return;
    }
    void connectSpotify();
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
    setPaneModes((prev) =>
      prev.map((mode, paneIndex) =>
        paneIndex === newPlaylistDialogPaneIndex ? "playlist" : mode
      )
    );
    setPaneSearchStates((prev) =>
      prev.map((state, paneIndex) =>
        paneIndex === newPlaylistDialogPaneIndex ? null : state
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

  function saveProjectToFile(): void {
    const normalizedName = normalizeProjectName(projectName);
    if (!normalizedName) {
      setProjectStatus("Project name is required to save.");
      return;
    }

    const payload = serializeProjectState(
      normalizedName,
      songs,
      playlists,
      panePlaylistIds,
      paneModes
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `roadtrip-project-${toFilenameSlug(normalizedName)}-${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setProjectStatus(`Saved "${normalizedName}" with ${playlists.length} playlist(s).`);
    setSaveProjectDialogOpen(false);
  }

  function openSaveProjectDialog(): void {
    setProjectName((prev) => normalizeProjectName(prev) || "Untitled Project");
    setSaveProjectDialogOpen(true);
  }

  function openLoadProjectPicker(): void {
    if (!loadProjectInputRef.current) {
      return;
    }
    loadProjectInputRef.current.value = "";
    loadProjectInputRef.current.click();
  }

  async function loadProjectFromFile(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = parseProjectState(raw);
      setSongs(parsed.songs);
      setPlaylists(parsed.playlists);
      setPanePlaylistIds(parsed.panePlaylistIds);
      setPaneModes(parsed.paneModes);
      setPaneSearchStates(parsed.panePlaylistIds.map(() => null));
      setProjectName(parsed.projectName ?? "Untitled Project");
      setSelectedSong(null);
      setNewPlaylistDialogPaneIndex(null);
      closeSpotifyImportDialog();
      closeSpotifySearchDialog();
      setProjectStatus(
        `Loaded "${parsed.projectName ?? "Untitled Project"}" with ${parsed.playlists.length} playlist(s) into ${parsed.panePlaylistIds.length} pane(s).`
      );
    } catch (error) {
      setProjectStatus(
        error instanceof Error ? error.message : "Failed to load project file."
      );
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="workspace">
      <WorkspaceHeader
        projectName={projectName}
        canAddPane={Boolean(availableForNewPane)}
        dragModeLabel={dragModeLabel}
        spotifyConnected={spotifyConnected}
        spotifyBusy={spotifyBusy}
        spotifyAuthError={spotifyAuthError}
        spotifyStatus={spotifyStatus}
        projectStatus={projectStatus}
        onAddPane={addPane}
        onSaveProject={openSaveProjectDialog}
        onLoadProject={openLoadProjectPicker}
        onToggleSpotifyConnection={toggleSpotifyConnection}
      />
      <input
        ref={loadProjectInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(event) => void loadProjectFromFile(event)}
      />

      <section className="pane-grid">
        {panePlaylistIds.map((panePlaylistId, paneIndex) => {
          const playlist = playlists.find((item) => item.id === panePlaylistId);
          if (!playlist) {
            return null;
          }
          const paneMode = paneModes[paneIndex] ?? "playlist";
          const paneSearchState = paneSearchStates[paneIndex];
          const selectablePlaylists =
            paneMode === "search"
              ? playlists.filter(
                  (candidate) =>
                    !searchOnlyPlaylistIds.has(candidate.id) || candidate.id === panePlaylistId
                )
              : playlists.filter((candidate) => !searchOnlyPlaylistIds.has(candidate.id));

          return (
            <PlaylistPane
              key={`${paneIndex}-${panePlaylistId}`}
              paneIndex={paneIndex}
              paneCount={panePlaylistIds.length}
              playlist={playlist}
              playlists={selectablePlaylists}
              membershipPlaylists={membershipPlaylists}
              songsById={songsById}
              selectedSong={selectedSong}
              dropTarget={dropTarget}
              newPlaylistValue={NEW_PLAYLIST_VALUE}
              importSpotifyValue={IMPORT_SPOTIFY_VALUE}
              searchSpotifyValue={SEARCH_SPOTIFY_VALUE}
              onUpdatePanePlaylist={updatePanePlaylist}
              onDeleteSelectedFromPlaylist={deleteSelectedFromPlaylist}
              onDeleteList={openDeleteListDialog}
              onOpenSpotifyExport={openSpotifyExportDialog}
              onRemovePane={removePane}
              onPaneDrop={onPaneDrop}
              onDropSlotDragOver={onDropSlotDragOver}
              onSongCardDragOver={onSongCardDragOver}
              onSongDragStart={onSongDragStart}
              onSongClick={onSongClick}
              onSongDragEnd={onSongDragEnd}
              canLoadMore={
                paneMode === "search" &&
                Boolean(paneSearchState) &&
                (paneSearchState?.nextOffset ?? 0) < (paneSearchState?.total ?? 0)
              }
              loadMoreLoading={spotifySearchLoadMorePaneIndex === paneIndex}
              onLoadMore={loadMoreSearchResults}
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
      <SaveProjectDialog
        isOpen={saveProjectDialogOpen}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onSave={saveProjectToFile}
        onCancel={() => setSaveProjectDialogOpen(false)}
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
        onRefreshPlaylists={loadSpotifyPlaylists}
        onImportSelected={importSelectedSpotifyPlaylist}
        onPlaylistSelect={setSelectedSpotifyPlaylistId}
        onCopyDebugCurl={copySpotifyDebugCurl}
      />
      <SpotifyExportDialog
        isOpen={spotifyExportDialogPaneIndex !== null}
        paneIndex={spotifyExportDialogPaneIndex}
        playlistName={spotifyExportPlaylistName}
        exportableSongs={spotifyExportableSongUris.length}
        totalSongs={spotifyExportSourcePlaylist?.songIds.length ?? 0}
        spotifyConnected={spotifyConnected}
        exporting={spotifyExportLoading}
        onClose={closeSpotifyExportDialog}
        onPlaylistNameChange={setSpotifyExportPlaylistName}
        onExport={exportActivePaneToSpotify}
      />
      <SpotifySearchDialog
        isOpen={spotifySearchDialogPaneIndex !== null}
        paneIndex={spotifySearchDialogPaneIndex}
        spotifyConnected={spotifyConnected}
        loading={spotifySearchLoading}
        query={spotifySearchQuery}
        onClose={closeSpotifySearchDialog}
        onQueryChange={setSpotifySearchQuery}
        onSearch={searchSpotifyForPane}
      />
      <DeleteListDialog
        isOpen={deleteListDialogPaneIndex !== null}
        listName={
          deleteListDialogPaneIndex !== null
            ? playlists.find((playlist) => playlist.id === panePlaylistIds[deleteListDialogPaneIndex])
                ?.name ?? "this list"
            : "this list"
        }
        listKindLabel={
          deleteListDialogPaneIndex !== null &&
          paneModes[deleteListDialogPaneIndex] === "search"
            ? "search results"
            : "playlist"
        }
        onCancel={closeDeleteListDialog}
        onConfirm={confirmDeleteList}
      />
    </main>
  );
}
