interface SpotifySearchDialogProps {
  isOpen: boolean;
  paneIndex: number | null;
  spotifyConnected: boolean;
  loading: boolean;
  query: string;
  limit: number;
  offset: number;
  includeExternalAudio: boolean;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onOffsetChange: (value: number) => void;
  onIncludeExternalAudioChange: (value: boolean) => void;
  onSearch: () => Promise<void>;
}

export function SpotifySearchDialog({
  isOpen,
  paneIndex,
  spotifyConnected,
  loading,
  query,
  limit,
  offset,
  includeExternalAudio,
  onClose,
  onQueryChange,
  onLimitChange,
  onOffsetChange,
  onIncludeExternalAudioChange,
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
            <div className="modal-inline-fields">
              <label>
                Results per search
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={limit}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    onLimitChange(Number.isNaN(parsed) ? 5 : parsed);
                  }}
                />
              </label>
              <label>
                Offset
                <input
                  type="number"
                  min={0}
                  value={offset}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    onOffsetChange(Number.isNaN(parsed) ? 0 : parsed);
                  }}
                />
              </label>
            </div>
            <label className="modal-checkbox">
              <input
                type="checkbox"
                checked={includeExternalAudio}
                onChange={(event) => onIncludeExternalAudioChange(event.target.checked)}
              />
              Include externally hosted audio where available
            </label>
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
