interface Props {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}

export function ConfirmModal({ message, confirmLabel, danger, onConfirm, onCancel, onDismiss }: Props) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>취소</button>
          <button className={danger ? 'modal-confirm danger' : 'modal-confirm'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
