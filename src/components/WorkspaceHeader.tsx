interface WorkspaceHeaderProps {
  canAddPane: boolean;
  dragModeLabel: "copy" | "move";
  spotifyAuthError: string | null;
  spotifyStatus: string | null;
  onAddPane: () => void;
}

export function WorkspaceHeader({
  canAddPane,
  dragModeLabel,
  spotifyAuthError,
  spotifyStatus,
  onAddPane
}: WorkspaceHeaderProps) {
  return (
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
        <button onClick={onAddPane} disabled={!canAddPane}>
          Add Pane
        </button>
        <span className="drag-mode-indicator">Current drag mode: {dragModeLabel}</span>
        {spotifyAuthError && <span className="status-error">{spotifyAuthError}</span>}
        {spotifyStatus && <span className="status-info">{spotifyStatus}</span>}
      </div>
    </header>
  );
}
