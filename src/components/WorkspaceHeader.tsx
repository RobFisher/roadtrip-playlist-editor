interface WorkspaceHeaderProps {
  projectName: string;
  canAddPane: boolean;
  dragModeLabel: "copy" | "move";
  googleConnected: boolean;
  googleBusy: boolean;
  googleAuthError: string | null;
  googleStatus: string | null;
  spotifyConnected: boolean;
  spotifyBusy: boolean;
  spotifyAuthError: string | null;
  spotifyStatus: string | null;
  projectStatus: string | null;
  onAddPane: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onToggleGoogleConnection: () => void;
  onToggleSpotifyConnection: () => void;
}

export function WorkspaceHeader({
  projectName,
  canAddPane,
  dragModeLabel,
  googleConnected,
  googleBusy,
  googleAuthError,
  googleStatus,
  spotifyConnected,
  spotifyBusy,
  spotifyAuthError,
  spotifyStatus,
  projectStatus,
  onAddPane,
  onSaveProject,
  onLoadProject,
  onToggleGoogleConnection,
  onToggleSpotifyConnection
}: WorkspaceHeaderProps) {
  const normalizedProjectName = projectName.trim();
  const showProjectInTitle =
    normalizedProjectName.length > 0 && normalizedProjectName !== "Untitled Project";

  return (
    <header className="workspace-header">
      <div>
        <p className="eyebrow">Milestone 2 UI Concept</p>
        <h1>
          Roadtrip Playlist Pane Editor
          {showProjectInTitle ? ` - ${normalizedProjectName}` : ""}
        </h1>
        <p className="subtitle">
          Drag songs between playlist panes. Default: copy. Hold Shift while dragging
          to move.
        </p>
      </div>
      <div className="workspace-actions">
        <div className="workspace-primary-actions">
          <button onClick={onAddPane} disabled={!canAddPane}>
            Add Pane
          </button>
          <button onClick={onSaveProject}>Save Project</button>
          <button onClick={onLoadProject}>Load Project</button>
          <button
            className={googleConnected ? "google-connected" : "google-disconnected"}
            onClick={onToggleGoogleConnection}
            disabled={googleBusy}
          >
            {googleConnected ? "Disconnect Google" : "Login with Google"}
          </button>
          <button
            className={spotifyConnected ? "spotify-connected" : "spotify-disconnected"}
            onClick={onToggleSpotifyConnection}
            disabled={spotifyBusy}
          >
            {spotifyConnected ? "Disconnect Spotify" : "Connect Spotify"}
          </button>
        </div>
        <div className="workspace-status-lines">
          <span className="drag-mode-indicator">Current drag mode: {dragModeLabel}</span>
          {googleAuthError && <span className="status-error">{googleAuthError}</span>}
          {googleStatus && <span className="status-info">{googleStatus}</span>}
          {spotifyAuthError && <span className="status-error">{spotifyAuthError}</span>}
          {spotifyStatus && <span className="status-info">{spotifyStatus}</span>}
          {projectStatus && <span className="status-info">{projectStatus}</span>}
        </div>
      </div>
    </header>
  );
}
