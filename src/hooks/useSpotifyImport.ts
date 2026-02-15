import { useEffect, useMemo, useState } from "react";
import type { Playlist, Song } from "../playlistModel.js";
import {
  getCurrentUserPlaylists,
  getCurrentUserProfile,
  getPlaylistItems,
  type SpotifyPlaylistSummary
} from "../spotify.js";

interface UseSpotifyImportArgs {
  spotifyToken: string | null;
  playlists: Playlist[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  setPanePlaylistIds: React.Dispatch<React.SetStateAction<string[]>>;
  onDisconnectAuth: () => void;
  buildUniquePlaylistId: (existingPlaylists: Playlist[], base: string) => string;
}

interface UseSpotifyImportResult {
  spotifyPlaylists: SpotifyPlaylistSummary[];
  spotifyUserId: string | null;
  spotifyLoading: boolean;
  selectedSpotifyPlaylistId: string;
  spotifyImportDialogPaneIndex: number | null;
  spotifyStatus: string | null;
  spotifyDebugCurlCommands: string;
  setSpotifyStatusMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedSpotifyPlaylistId: React.Dispatch<React.SetStateAction<string>>;
  openSpotifyImportDialog: (paneIndex: number) => void;
  closeSpotifyImportDialog: () => void;
  loadSpotifyPlaylists: () => Promise<void>;
  importSelectedSpotifyPlaylist: () => Promise<void>;
  disconnectSpotifyImport: () => void;
  copySpotifyDebugCurl: () => Promise<void>;
}

export function useSpotifyImport({
  spotifyToken,
  playlists,
  setSongs,
  setPlaylists,
  setPanePlaylistIds,
  onDisconnectAuth,
  buildUniquePlaylistId
}: UseSpotifyImportArgs): UseSpotifyImportResult {
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [spotifyUserId, setSpotifyUserId] = useState<string | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [selectedSpotifyPlaylistId, setSelectedSpotifyPlaylistId] = useState<string>("");
  const [spotifyImportDialogPaneIndex, setSpotifyImportDialogPaneIndex] = useState<number | null>(
    null
  );
  const [spotifyAutoLoadTriggered, setSpotifyAutoLoadTriggered] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);

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

  function openSpotifyImportDialog(paneIndex: number): void {
    setSpotifyImportDialogPaneIndex(paneIndex);
    setSpotifyAutoLoadTriggered(false);
  }

  function closeSpotifyImportDialog(): void {
    setSpotifyImportDialogPaneIndex(null);
    setSpotifyAutoLoadTriggered(false);
  }

  function disconnectSpotifyImport(): void {
    onDisconnectAuth();
    setSpotifyPlaylists([]);
    setSelectedSpotifyPlaylistId("");
    setSpotifyUserId(null);
    setSpotifyAutoLoadTriggered(false);
  }

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
      setSpotifyStatus(`Loaded ${loaded.length} playlist(s).`);
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
      const playlistItems = await getPlaylistItems(spotifyToken, selected.id);
      if (playlistItems.length === 0) {
        setSpotifyStatus(
          `Imported 0 songs from "${selected.name}". The playlist may contain unavailable/local-only items for this token.`
        );
      }

      const tracksByLocalSongId = new Map(
        playlistItems.map((track) => [
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

        const importedSongIds = playlistItems.map((track) => `spotify:${track.id}`);
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
        `Imported ${playlistItems.length} song(s) from "${selected.name}" into pane ${spotifyImportDialogPaneIndex + 1}.`
      );
      closeSpotifyImportDialog();
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

  return {
    spotifyPlaylists,
    spotifyUserId,
    spotifyLoading,
    selectedSpotifyPlaylistId,
    spotifyImportDialogPaneIndex,
    spotifyStatus,
    spotifyDebugCurlCommands,
    setSpotifyStatusMessage: setSpotifyStatus,
    setSelectedSpotifyPlaylistId,
    openSpotifyImportDialog,
    closeSpotifyImportDialog,
    loadSpotifyPlaylists,
    importSelectedSpotifyPlaylist,
    disconnectSpotifyImport,
    copySpotifyDebugCurl
  };
}
