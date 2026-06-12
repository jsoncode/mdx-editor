import { useEffect, useRef } from "react";
import { isPlainMdPath } from "../lib/documentPaths";

export interface VaultContextMenuItem {
  id: string;
  label?: string;
  separator?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface VaultContextMenuProps {
  x: number;
  y: number;
  items: VaultContextMenuItem[];
  onClose: () => void;
}

export function VaultContextMenu({ x, y, items, onClose }: VaultContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    menu.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
  }, [x, y, items]);

  return (
    <div
      ref={menuRef}
      className="vault-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="vault-context-divider" role="separator" />;
        }

        return (
          <button
            key={item.id}
            type="button"
            className={`vault-context-item${item.danger ? " danger" : ""}`}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled || !item.onClick) return;
              onClose();
              item.onClick();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ms?: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("zh-CN");
}

export function VaultItemInfoDialog({
  info,
  onClose,
}: {
  info: import("../types/vault").VaultItemInfo | null;
  onClose: () => void;
}) {
  if (!info) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog vault-info-dialog"
        role="dialog"
        aria-labelledby="vault-info-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="vault-info-title">{info.kind === "folder" ? "文件夹信息" : "文件信息"}</h3>
        <dl className="vault-info-list">
          <div>
            <dt>名称</dt>
            <dd>{info.name}</dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd>{info.kind === "folder" ? "文件夹" : info.path.toLowerCase().endsWith(".md") ? "Markdown 文档 (.md)" : "MDX 文档 (.mdx)"}</dd>
          </div>
          <div>
            <dt>相对路径</dt>
            <dd>{info.relativePath || "（工作区根目录）"}</dd>
          </div>
          <div>
            <dt>完整路径</dt>
            <dd className="vault-info-path">{info.path}</dd>
          </div>
          {info.kind === "file" && (
            <div>
              <dt>大小</dt>
              <dd>{info.sizeBytes != null ? formatBytes(info.sizeBytes) : "—"}</dd>
            </div>
          )}
          {info.kind === "folder" && (
            <>
              <div>
                <dt>文档数量</dt>
                <dd>{info.fileCount ?? 0}</dd>
              </div>
              <div>
                <dt>子文件夹</dt>
                <dd>{info.folderCount ?? 0}</dd>
              </div>
            </>
          )}
          <div>
            <dt>修改时间</dt>
            <dd>{formatTimestamp(info.modifiedAtMs)}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{formatTimestamp(info.createdAtMs)}</dd>
          </div>
        </dl>
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export function VaultRenameDialog({
  target,
  onSubmit,
  onClose,
}: {
  target: import("../types/vault").VaultItemTarget | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  if (!target) return null;

  const initialName =
    target.kind === "file"
      ? target.name.replace(/\.(mdx|md)$/i, "")
      : target.name;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <form
        className="dialog vault-rename-dialog"
        role="dialog"
        aria-labelledby="vault-rename-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem("rename") as HTMLInputElement;
          onSubmit(input.value);
        }}
      >
        <h3 id="vault-rename-title">重命名{target.kind === "folder" ? "文件夹" : "文件"}</h3>
        <label className="vault-rename-field">
          新名称
          <input
            name="rename"
            autoFocus
            defaultValue={initialName}
            placeholder={target.kind === "folder" ? "文件夹名称" : "文档名称"}
          />
        </label>
        {target.kind === "file" && (
          <p className="vault-rename-hint">
            {isPlainMdPath(target.path) ? "无需输入 .md 扩展名" : "无需输入 .mdx 扩展名"}
          </p>
        )}
        <div className="dialog-actions">
          <button type="submit">确定</button>
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
