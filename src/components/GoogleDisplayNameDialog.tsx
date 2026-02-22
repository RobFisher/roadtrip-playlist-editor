interface GoogleDisplayNameDialogProps {
  isOpen: boolean;
  email: string;
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function GoogleDisplayNameDialog({
  isOpen,
  email,
  displayName,
  onDisplayNameChange,
  onSave,
  onCancel
}: GoogleDisplayNameDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Choose Display Name</h2>
        <p className="modal-support">
          Signed in as <strong>{email}</strong>. This display name is visible to other users
          when they browse backend projects, and it cannot currently be changed.
        </p>
        <label>
          Display name
          <input
            autoFocus
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSave();
              }
            }}
          />
        </label>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>
            Disconnect
          </button>
          <button className="modal-create" onClick={onSave} disabled={!displayName.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
