interface DeleteListDialogProps {
  isOpen: boolean;
  listName: string;
  listKindLabel: "playlist" | "search results";
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteListDialog({
  isOpen,
  listName,
  listKindLabel,
  onCancel,
  onConfirm
}: DeleteListDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Delete List</h2>
        <p className="modal-support">
          Are you sure you want to delete the {listKindLabel} "{listName}"?
        </p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>
            No
          </button>
          <button className="modal-danger" onClick={onConfirm}>
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}
