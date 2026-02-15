import type { SpotifyPlaylistSummary } from "../spotify.js";

interface SpotifyImportDialogProps {
  isOpen: boolean;
  targetPaneIndex: number | null;
  spotifyToken: string | null;
  spotifyLoading: boolean;
  selectedSpotifyPlaylistId: string;
  spotifyPlaylists: SpotifyPlaylistSummary[];
  spotifyUserId: string | null;
  spotifyDebugCurlCommands: string;
  onClose: () => void;
  onConnectSpotify: () => Promise<void>;
  onDisconnectSpotify: () => void;
  onRefreshPlaylists: () => Promise<void>;
  onImportSelected: () => Promise<void>;
  onPlaylistSelect: (playlistId: string) => void;
  onCopyDebugCurl: () => Promise<void>;
}

export function SpotifyImportDialog({
  isOpen,
  targetPaneIndex,
  spotifyToken,
  spotifyLoading,
  selectedSpotifyPlaylistId,
  spotifyPlaylists,
  spotifyUserId,
  spotifyDebugCurlCommands,
  onClose,
  onConnectSpotify,
  onDisconnectSpotify,
  onRefreshPlaylists,
  onImportSelected,
  onPlaylistSelect,
  onCopyDebugCurl
}: SpotifyImportDialogProps) {
  if (!isOpen || targetPaneIndex === null) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Import From Spotify</h2>
        <p className="modal-support">Target pane: {targetPaneIndex + 1}</p>
        {!spotifyToken ? (
          <>
            <p className="modal-support">
              Connect Spotify first to load your playlists.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={onClose}>
                Cancel
              </button>
              <button className="modal-create" onClick={() => void onConnectSpotify()}>
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
                onChange={(event) => onPlaylistSelect(event.target.value)}
                disabled={spotifyLoading}
              >
                <option value="">Select Spotify playlist...</option>
                {spotifyPlaylists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name} ({playlist.tracksTotal}){" "}
                    {playlist.ownerDisplayName ? `- ${playlist.ownerDisplayName}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {spotifyPlaylists.length === 0 && (
              <p className="modal-support">
                No importable playlists found for this account
                {spotifyUserId ? ` (${spotifyUserId})` : ""}.
              </p>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className="modal-cancel"
                onClick={() => void onRefreshPlaylists()}
                disabled={spotifyLoading}
              >
                Refresh List
              </button>
              <button className="modal-cancel" onClick={onDisconnectSpotify}>
                Disconnect
              </button>
              <button
                className="modal-create"
                onClick={() => void onImportSelected()}
                disabled={!selectedSpotifyPlaylistId || spotifyLoading}
              >
                Import
              </button>
            </div>
            {import.meta.env.DEV && (
              <details className="debug-details">
                <summary>Debug: cURL commands</summary>
                <p className="modal-support">
                  These include your live bearer token. Treat as sensitive.
                </p>
                <textarea className="debug-textarea" readOnly value={spotifyDebugCurlCommands} />
                <div className="modal-actions">
                  <button
                    className="modal-cancel"
                    onClick={() => void onCopyDebugCurl()}
                    disabled={!spotifyDebugCurlCommands}
                  >
                    Copy cURL Commands
                  </button>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
