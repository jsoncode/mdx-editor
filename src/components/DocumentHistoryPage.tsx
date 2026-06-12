import { useEffect, useState } from "react";
import { ask, message } from "@tauri-apps/plugin-dialog";
import { isPlainMdPath } from "../lib/documentPaths";
import {
  clearDocumentHistory,
  countHistoryDeletes,
  deleteDocumentHistoryEntry,
  getDocumentHistory,
} from "../lib/documentHistory";
import { getFileName } from "../lib/recentFiles";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore } from "../stores/uiStore";
import type { DocumentHistoryEntry } from "../types/documentHistory";

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

export function DocumentHistoryPage() {
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const filePath = useDocumentStore((s) => s.filePath);
  const saveDocument = useDocumentStore((s) => s.saveDocument);
  const enterEditor = useUiStore((s) => s.enterEditor);
  const showWelcome = useUiStore((s) => s.showWelcome);

  const [entries, setEntries] = useState<DocumentHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    void loadHistory();
  }, [workspaceId]);

  const handleDelete = async (entry: DocumentHistoryEntry) => {
    if (!workspaceId) return;

    const removeCount = countHistoryDeletes(entries, entry.id);
    const messageText =
      removeCount > 1
        ? `确定删除 ${formatSavedTime(entry.savedAt)} 的记录？\n将同时移除 ${removeCount} 条更早的历史（从旧到新依次清理，避免 diff 链断裂）。删除后需保存文档才会写入文件。`
        : `确定删除 ${formatSavedTime(entry.savedAt)} 的记录？删除后需保存文档才会写入文件。`;

    const confirmed = await ask(messageText, {
      title: "删除历史记录",
      kind: "warning",
      okLabel: "删除",
      cancelLabel: "取消",
    });
    if (!confirmed) return;

    setDeletingId(entry.id);
    try {
      const removed = await deleteDocumentHistoryEntry(workspaceId, entry.id);
      if (removed === 0) return;

      if (filePath) {
        await saveDocument();
      }
      await loadHistory();
    } catch (error) {
      await message(String(error), { title: "删除失败", kind: "error" });
    } finally {
      setDeletingId(null);
    }
  };

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
      if (filePath) {
        await saveDocument();
      }
      setEntries([]);
      setSelectedId(null);
    } catch (error) {
      await message(String(error), { title: "清空失败", kind: "error" });
    } finally {
      setClearing(false);
    }
  };

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const storageHint = filePath
    ? isPlainMdPath(filePath)
      ? "纯 Markdown (.md) 文档不记录历史修改；请另存为 MDX 以启用此功能。"
      : "历史记录保存在 MDX 文档内的 versions.json 中，分享文档后仍可查看。"
    : "保存 MDX 文档后，历史记录会写入文档内的 versions.json。";

  return (
    <div className="history-page">
      <div className="history-page-header">
        <div>
          <h1>历史修改</h1>
          <p>
            {filePath
              ? `${getFileName(filePath)} · 仅记录 Markdown 正文变更，不含 asset 资源。${storageHint}`
              : "请先保存文档后再查看历史修改。"}
          </p>
        </div>
        <div className="history-page-actions">
          <button type="button" className="secondary" onClick={() => enterEditor()}>
            返回编辑
          </button>
          <button type="button" className="secondary" onClick={showWelcome}>
            开始页
          </button>
          {entries.length > 0 && workspaceId && (
            <button
              type="button"
              className="danger"
              disabled={clearing}
              onClick={() => void handleClear()}
            >
              {clearing ? "清空中…" : "清空历史"}
            </button>
          )}
        </div>
      </div>

      <div className="history-page-body">
        {!workspaceId ? (
          <div className="history-empty">当前没有打开的文档。</div>
        ) : loading ? (
          <div className="history-empty">加载中…</div>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            暂无历史修改。每次手动保存后会记录与上一版本的 Markdown 差异，并随文档一并保存。
          </div>
        ) : (
          <div className="history-layout history-layout-page">
            <aside className="history-list">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`history-list-row${entry.id === selectedId ? " active" : ""}`}
                >
                  <button
                    type="button"
                    className="history-list-item"
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <span className="history-list-time">{formatSavedTime(entry.savedAt)}</span>
                    <span className="history-list-stats">
                      <span className="history-stat-add">+{entry.stats.additions}</span>
                      <span className="history-stat-remove">−{entry.stats.deletions}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="history-list-delete"
                    title="删除此记录"
                    aria-label={`删除 ${formatSavedTime(entry.savedAt)} 的历史记录`}
                    disabled={deletingId === entry.id}
                    onClick={() => void handleDelete(entry)}
                  >
                    {deletingId === entry.id ? "…" : "×"}
                  </button>
                </div>
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
