import { useEffect, useState } from "react";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { clearDocumentHistory, getDocumentHistory } from "../lib/documentHistory";
import { isPlainMdPath } from "../lib/documentPaths";
import { getFileName } from "../lib/recentFiles";
import type { DocumentHistoryEntry } from "../types/documentHistory";

interface DocumentHistoryDialogProps {
  open: boolean;
  workspaceId: string | null;
  filePath: string | null;
  onClose: () => void;
  onPersistHistory?: () => Promise<void>;
}

function formatSavedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DocumentHistoryDialog({
  open,
  workspaceId,
  filePath,
  onClose,
  onPersistHistory,
}: DocumentHistoryDialogProps) {
  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadHistory = async () => {
    if (!workspaceId) {
      setEntries([]);
      setSelectedId(null);
      return;
    }

    setLoading(true);
    try {
      const list = await getDocumentHistory(workspaceId);
      setEntries(list);
      setSelectedId(list[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadHistory();
  }, [open, workspaceId]);

  const handleClear = async () => {
    if (!workspaceId || entries.length === 0) return;

    const confirmed = await ask("确定清空所有历史修改记录？清空后需保存文档才会写入文件。", {
      title: "清空历史",
      kind: "warning",
      okLabel: "清空",
      cancelLabel: "取消",
    });
    if (!confirmed) return;

    setClearing(true);
    try {
      await clearDocumentHistory(workspaceId);
      if (filePath && onPersistHistory) {
        await onPersistHistory();
      }
      setEntries([]);
      setSelectedId(null);
    } catch (error) {
      await message(String(error), { title: "清空失败", kind: "error" });
    } finally {
      setClearing(false);
    }
  };

  if (!open) return null;

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const storageHint = filePath
    ? isPlainMdPath(filePath)
      ? "历史记录保存在同目录的 .versions.json sidecar 文件中，随 .md 一起分享。"
      : "历史记录保存在 MDX 文档内的 versions.json 中，分享文档后仍可查看。"
    : "保存文档后，历史记录会写入文档（MDX 内置或 .md sidecar 文件）。";

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog history-dialog"
        role="dialog"
        aria-labelledby="history-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="history-dialog-header">
          <div>
            <h3 id="history-dialog-title">历史修改</h3>
            <p className="history-dialog-desc">
              {filePath
                ? `${getFileName(filePath)} · 仅记录 Markdown 正文变更，不含 asset 资源。${storageHint}`
                : "请先保存文档后再查看历史修改。"}
            </p>
          </div>
          <div className="history-dialog-header-actions">
            {entries.length > 0 && workspaceId && (
              <button
                type="button"
                className="danger history-clear-btn"
                disabled={clearing}
                onClick={() => void handleClear()}
              >
                {clearing ? "清空中…" : "清空历史"}
              </button>
            )}
            <button type="button" className="secondary history-close-btn" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        {!workspaceId ? (
          <div className="history-empty">当前没有打开的文档。</div>
        ) : loading ? (
          <div className="history-empty">加载中…</div>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            暂无历史修改。每次手动保存后会记录与上一版本的 Markdown 差异，并随文档一并保存。
          </div>
        ) : (
          <div className="history-layout">
            <aside className="history-list">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`history-list-item${entry.id === selectedId ? " active" : ""}`}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className="history-list-time">{formatSavedTime(entry.savedAt)}</span>
                  <span className="history-list-stats">
                    <span className="history-stat-add">+{entry.stats.additions}</span>
                    <span className="history-stat-remove">−{entry.stats.deletions}</span>
                  </span>
                </button>
              ))}
            </aside>

            <div className="history-diff-pane">
              {selected ? (
                <>
                  <div className="history-diff-meta">
                    <span>{formatSavedTime(selected.savedAt)}</span>
                    <span>
                      新增 {selected.stats.additions} 行，删除 {selected.stats.deletions} 行
                    </span>
                  </div>
                  <pre className="history-diff">
                    {selected.lines.map((line, index) => (
                      <div
                        key={`${selected.id}-${index}`}
                        className={`history-diff-line history-diff-${line.type}`}
                      >
                        <span className="history-diff-prefix">{line.type === "add" ? "+" : "−"}</span>
                        <span className="history-diff-content">{line.content || " "}</span>
                      </div>
                    ))}
                  </pre>
                </>
              ) : (
                <div className="history-empty">选择一条记录查看差异。</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
