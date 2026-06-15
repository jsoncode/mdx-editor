import { useEffect, useMemo, useState } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { useDocumentActions } from "../hooks/useDocumentActions";
import {
  clearRecentFiles,
  formatRecentTime,
  getFileName,
  getRecentFileEntries,
  groupRecentFiles,
  removeRecentFile,
} from "../lib/recentFiles";
import { revealVaultItem } from "../lib/vault";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore } from "../stores/uiStore";
import type { RecentFileEntry, RecentGroupMode, RecentSortMode } from "../types/recent";

const GROUP_OPTIONS: { id: RecentGroupMode; label: string }[] = [
  { id: "year", label: "按年" },
  { id: "month", label: "按月" },
  { id: "week", label: "按周" },
  { id: "directory", label: "按目录" },
];

const SORT_OPTIONS: { id: RecentSortMode; label: string }[] = [
  { id: "time", label: "按时间" },
  { id: "name", label: "按名称" },
];

export function RecentFilesPage() {
  const [entries, setEntries] = useState<RecentFileEntry[]>([]);
  const [groupMode, setGroupMode] = useState<RecentGroupMode>("month");
  const [sortMode, setSortMode] = useState<RecentSortMode>("time");
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);
  const showWelcome = useUiStore((s) => s.showWelcome);
  const enterEditor = useUiStore((s) => s.enterEditor);
  const { handleOpenPath } = useDocumentActions("");

  const groups = useMemo(
    () => groupRecentFiles(entries, groupMode, sortMode),
    [entries, groupMode, sortMode],
  );

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
    setEntries(useDocumentStore.getState().recentFiles);
  };

  const handleRemove = async (path: string) => {
    const next = await removeRecentFile(path);
    setEntries(next);
    setRecentFiles(next);
  };

  const handleReveal = async (path: string) => {
    try {
      await revealVaultItem(path);
    } catch {
      await message("无法打开所在文件夹，文件可能已被移动或删除。", {
        title: "无法进入",
        kind: "warning",
      });
    }
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
          <p>浏览您打开过的 MDX 文档，共 {entries.length} 个</p>
        </div>
        <div className="recent-page-actions">
          <button type="button" className="secondary" onClick={() => enterEditor()}>
            返回编辑
          </button>
          <button type="button" className="secondary" onClick={showWelcome}>
            开始页
          </button>
          {entries.length > 0 && (
            <button type="button" className="danger" onClick={() => void handleClear()}>
              清空历史
            </button>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="recent-toolbar">
          <div className="recent-toolbar-group">
            <span className="recent-toolbar-label">分组</span>
            <div className="recent-option-group" role="group" aria-label="分组方式">
              {GROUP_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`recent-option-btn${groupMode === option.id ? " active" : ""}`}
                  aria-pressed={groupMode === option.id}
                  onClick={() => setGroupMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="recent-toolbar-group">
            <span className="recent-toolbar-label">排序</span>
            <div className="recent-option-group" role="group" aria-label="排序方式">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`recent-option-btn${sortMode === option.id ? " active" : ""}`}
                  aria-pressed={sortMode === option.id}
                  onClick={() => setSortMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="recent-empty">
          <p>暂无最近打开的文档</p>
          <button type="button" onClick={() => enterEditor()}>
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
                    </button>
                    <span className="recent-time">{formatRecentTime(file.openedAt)}</span>
                    <button
                      type="button"
                      className="recent-reveal"
                      title="在文件管理器中打开所在文件夹"
                      onClick={() => void handleReveal(file.path)}
                    >
                      进入
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
