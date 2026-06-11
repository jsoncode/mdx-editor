interface UnsavedDialogProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedDialog({ open, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h3>未保存的更改</h3>
        <p>文档有未保存的更改，是否在关闭前保存？</p>
        <div className="dialog-actions">
          <button type="button" onClick={onSave}>
            保存
          </button>
          <button type="button" className="secondary" onClick={onDiscard}>
            不保存
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
