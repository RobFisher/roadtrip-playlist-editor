interface NewPlaylistDialogProps {
  isOpen: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}

export function NewPlaylistDialog({
  isOpen,
  name,
  onNameChange,
  onCancel,
  onCreate
}: NewPlaylistDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Create Playlist</h2>
        <label>
          Playlist name
          <input
            autoFocus
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCreate();
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-create" onClick={onCreate} disabled={!name.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
