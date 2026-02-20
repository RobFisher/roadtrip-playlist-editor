interface SpotifySearchDialogProps {
  isOpen: boolean;
  paneIndex: number | null;
  spotifyConnected: boolean;
  loading: boolean;
  query: string;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
}

export function SpotifySearchDialog({
  isOpen,
  paneIndex,
  spotifyConnected,
  loading,
  query,
  onClose,
  onQueryChange,
  onSearch
}: SpotifySearchDialogProps) {
  if (!isOpen || paneIndex === null) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Spotify Search</h2>
        <p className="modal-support">Target pane: {paneIndex + 1}</p>
        <p className="modal-support">
          This replaces the pane with a new playlist containing the search result tracks.
        </p>

        {!spotifyConnected ? (
          <p className="modal-support">Connect Spotify from the main header before searching.</p>
        ) : (
          <>
            <label>
              Query
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder='Try: "track:nightcall artist:kavinsky year:2010-2015"'
                maxLength={300}
              />
            </label>
            <p className="modal-support">
              Uses your Spotify account&apos;s default market automatically.
            </p>
          </>
        )}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-create"
            onClick={() => void onSearch()}
            disabled={!spotifyConnected || loading || !query.trim()}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>
    </div>
  );
}
