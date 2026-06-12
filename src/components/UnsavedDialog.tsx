interface UnsavedDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  variant?: "unsaved" | "confirm";
  confirmLabel?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedDialog({
  open,
  title = "未保存的更改",
  message = "文档有未保存的更改，是否在关闭前保存？",
  variant = "unsaved",
  confirmLabel = "退出",
  onSave,
  onDiscard,
  onCancel,
}: UnsavedDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          {variant === "unsaved" ? (
            <>
              <button type="button" onClick={onSave}>
                保存
              </button>
              <button type="button" className="secondary" onClick={onDiscard}>
                不保存
              </button>
              <button type="button" className="secondary" onClick={onCancel}>
                取消
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onDiscard}>
                {confirmLabel}
              </button>
              <button type="button" className="secondary" onClick={onCancel}>
                取消
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
