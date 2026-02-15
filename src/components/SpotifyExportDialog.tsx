interface SpotifyExportDialogProps {
  isOpen: boolean;
  paneIndex: number | null;
  playlistName: string;
  exportableSongs: number;
  totalSongs: number;
  spotifyConnected: boolean;
  exporting: boolean;
  onClose: () => void;
  onPlaylistNameChange: (name: string) => void;
  onExport: () => Promise<void>;
}

export function SpotifyExportDialog({
  isOpen,
  paneIndex,
  playlistName,
  exportableSongs,
  totalSongs,
  spotifyConnected,
  exporting,
  onClose,
  onPlaylistNameChange,
  onExport
}: SpotifyExportDialogProps) {
  if (!isOpen || paneIndex === null) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Export To Spotify</h2>
        <p className="modal-support">Source pane: {paneIndex + 1}</p>

        {!spotifyConnected ? (
          <p className="modal-support">Connect Spotify from the main header before exporting.</p>
        ) : (
          <>
            <label>
              New Spotify playlist name
              <input
                value={playlistName}
                onChange={(event) => onPlaylistNameChange(event.target.value)}
                placeholder="Roadtrip export"
                maxLength={100}
              />
            </label>
            <p className="modal-support">
              Exportable songs: {exportableSongs} / {totalSongs} (songs without Spotify URI are skipped)
            </p>
          </>
        )}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-create"
            onClick={() => void onExport()}
            disabled={
              !spotifyConnected ||
              exporting ||
              !playlistName.trim() ||
              exportableSongs === 0
            }
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
