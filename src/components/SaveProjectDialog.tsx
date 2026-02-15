interface SaveProjectDialogProps {
  isOpen: boolean;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function SaveProjectDialog({
  isOpen,
  projectName,
  onProjectNameChange,
  onCancel,
  onSave
}: SaveProjectDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Save Project</h2>
        <label>
          Project name
          <input
            autoFocus
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSave();
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-create" onClick={onSave} disabled={!projectName.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
