import type { BackendProject } from "../backendApi.js";

interface BackendProjectLoadDialogProps {
  isOpen: boolean;
  loading: boolean;
  projects: BackendProject[];
  selectedProjectId: string;
  currentUserId: string | null;
  onSelectedProjectIdChange: (projectId: string) => void;
  onReload: () => void;
  onLoadSelected: () => void;
  onCancel: () => void;
}

function formatOwner(project: BackendProject, currentUserId: string | null): string {
  if (currentUserId && project.ownerUserId === currentUserId) {
    return "You";
  }
  return project.ownerDisplayName || project.ownerUserId;
}

export function BackendProjectLoadDialog({
  isOpen,
  loading,
  projects,
  selectedProjectId,
  currentUserId,
  onSelectedProjectIdChange,
  onReload,
  onLoadSelected,
  onCancel
}: BackendProjectLoadDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Load Backend Project</h2>
        <p className="modal-support">
          Any logged-in user can load any project. Only owners can save updates to the
          same project.
        </p>
        <label>
          Select project
          <select
            value={selectedProjectId}
            onChange={(event) => onSelectedProjectIdChange(event.target.value)}
            disabled={loading || projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value="">No backend projects found</option>
            ) : (
              projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name} - owner: {formatOwner(project, currentUserId)}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="modal-cancel" onClick={onReload} disabled={loading}>
            Refresh
          </button>
          <button
            className="modal-create"
            onClick={onLoadSelected}
            disabled={loading || !selectedProjectId}
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
