interface WorkspaceHeaderProps {
  canAddPane: boolean;
  dragModeLabel: "copy" | "move";
  spotifyAuthError: string | null;
  spotifyStatus: string | null;
  projectStatus: string | null;
  onAddPane: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
}

export function WorkspaceHeader({
  canAddPane,
  dragModeLabel,
  spotifyAuthError,
  spotifyStatus,
  projectStatus,
  onAddPane,
  onSaveProject,
  onLoadProject
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
        <button onClick={onSaveProject}>Save Project</button>
        <button onClick={onLoadProject}>Load Project</button>
        <span className="drag-mode-indicator">Current drag mode: {dragModeLabel}</span>
        {spotifyAuthError && <span className="status-error">{spotifyAuthError}</span>}
        {spotifyStatus && <span className="status-info">{spotifyStatus}</span>}
        {projectStatus && <span className="status-info">{projectStatus}</span>}
      </div>
    </header>
  );
}
