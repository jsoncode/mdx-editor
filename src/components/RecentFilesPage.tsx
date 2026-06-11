import { useEffect, useMemo, useState } from "react";
import { useDocumentActions } from "../hooks/useDocumentActions";
import {
  clearRecentFiles,
  formatRecentTime,
  getFileName,
  getRecentFileEntries,
  groupRecentFilesByMonth,
  removeRecentFile,
} from "../lib/recentFiles";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore } from "../stores/uiStore";
import type { RecentFileEntry } from "../types/recent";

export function RecentFilesPage() {
  const [entries, setEntries] = useState<RecentFileEntry[]>([]);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);
  const setAppView = useUiStore((s) => s.setAppView);
  const { handleOpenPath } = useDocumentActions("");

  const groups = useMemo(() => groupRecentFilesByMonth(entries), [entries]);

  const refresh = async () => {
    const list = await getRecentFileEntries();
    setEntries(list);
    setRecentFiles(list);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleOpen = async (path: string) => {
    await handleOpenPath(path);
    setAppView("editor");
  };

  const handleRemove = async (path: string) => {
    const next = await removeRecentFile(path);
    setEntries(next);
    setRecentFiles(next);
  };

  const handleClear = async () => {
    await clearRecentFiles();
    setEntries([]);
    setRecentFiles([]);
  };

  return (
    <div className="recent-page">
      <div className="recent-page-header">
        <div>
          <h1>最近文档</h1>
          <p>按月份浏览您打开过的 MDX 文档，共 {entries.length} 个</p>
        </div>
        <div className="recent-page-actions">
          <button type="button" className="secondary" onClick={() => setAppView("editor")}>
            返回编辑
          </button>
          {entries.length > 0 && (
            <button type="button" className="danger" onClick={() => void handleClear()}>
              清空历史
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="recent-empty">
          <p>暂无最近打开的文档</p>
          <button type="button" onClick={() => setAppView("editor")}>
            开始编辑
          </button>
        </div>
      ) : (
        <div className="recent-groups">
          {groups.map((group) => (
            <section key={group.sortKey} className="recent-group">
              <h2>{group.label}</h2>
              <ul className="recent-list">
                {group.files.map((file) => (
                  <li key={file.path} className="recent-list-item">
                    <button
                      type="button"
                      className="recent-open"
                      onClick={() => void handleOpen(file.path)}
                    >
                      <span className="recent-name">{getFileName(file.path)}</span>
                      <span className="recent-path">{file.path}</span>
                      <span className="recent-time">{formatRecentTime(file.openedAt)}</span>
                    </button>
                    <button
                      type="button"
                      className="recent-remove"
                      title="从历史中移除"
                      onClick={() => void handleRemove(file.path)}
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
