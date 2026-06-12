import { useEffect, useState } from "react";
import { useWelcomeActions } from "../hooks/useWelcomeActions";
import { formatRecentTime, getFileName, getRecentFileEntries } from "../lib/recentFiles";
import { getRecentVaults, removeRecentVault } from "../lib/vault";
import { getVaultName } from "../types/vault";
import type { RecentFileEntry } from "../types/recent";

export function WelcomePage() {
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>([]);
  const [recentVaults, setRecentVaults] = useState<string[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState("MDX 工作区");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  const {
    vaultPath,
    openWorkspace,
    createNewWorkspace,
    openFile,
    createNewFile,
    continueInWorkspace,
    openRecentDocumentsPage,
  } = useWelcomeActions();

  useEffect(() => {
    void (async () => {
      const [files, vaults] = await Promise.all([getRecentFileEntries(), getRecentVaults()]);
      setRecentFiles(files.slice(0, 8));
      setRecentVaults(vaults.slice(0, 6));
    })();
  }, []);

  const handleRemoveVault = async (path: string) => {
    setRecentVaults((await removeRecentVault(path)).slice(0, 6));
  };

  return (
    <div className="welcome-page">
      <div className="welcome-hero">
        <h1>MDX Editor</h1>
        <p>编辑、预览与管理 MDX 文档。选择下方操作开始，或从最近记录继续。</p>
      </div>

      <div className="welcome-grid">
        <section className="welcome-section">
          <h2>开始</h2>
          <ul className="welcome-actions">
            <WelcomeAction
              title="打开工作区"
              description="选择文件夹，以树形结构管理其中的 MDX 文档"
              onClick={() => void openWorkspace()}
            />
            <WelcomeAction
              title="新建工作区"
              description="在指定位置创建新的工作区文件夹"
              onClick={() => setShowCreateWorkspace(true)}
            />
            <WelcomeAction
              title="打开文件"
              description="打开本地 .md / .mdx 文档"
              shortcut="Ctrl+O"
              onClick={() => void openFile()}
            />
            <WelcomeAction
              title="新建文件"
              description={vaultPath ? "在当前工作区中创建 MDX 文档" : "创建未命名 MDX 文档"}
              shortcut="Ctrl+N"
              onClick={() => void createNewFile()}
            />
            {vaultPath && (
              <WelcomeAction
                title="进入当前工作区"
                description={`继续浏览 ${getVaultName(vaultPath)}`}
                onClick={() => void continueInWorkspace()}
              />
            )}
          </ul>

          {showCreateWorkspace && (
            <form
              className="welcome-create-workspace"
              onSubmit={(event) => {
                event.preventDefault();
                void createNewWorkspace(newWorkspaceName).finally(() => setShowCreateWorkspace(false));
              }}
            >
              <label>
                工作区名称
                <input
                  autoFocus
                  value={newWorkspaceName}
                  onChange={(event) => setNewWorkspaceName(event.target.value)}
                  placeholder="例如：我的笔记"
                />
              </label>
              <div className="welcome-create-workspace-actions">
                <button type="submit">选择位置并创建</button>
                <button type="button" className="secondary" onClick={() => setShowCreateWorkspace(false)}>
                  取消
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="welcome-section">
          <h2>最近</h2>

          <div className="welcome-recent-block">
            <div className="welcome-recent-header">
              <h3>最近的工作区</h3>
            </div>
            {recentVaults.length === 0 ? (
              <p className="welcome-empty">暂无最近工作区</p>
            ) : (
              <ul className="welcome-recent-list">
                {recentVaults.map((path) => (
                  <li key={path}>
                    <button type="button" className="welcome-recent-item" onClick={() => void openWorkspace(path)}>
                      <span className="welcome-recent-name">{getVaultName(path)}</span>
                      <span className="welcome-recent-meta">{path}</span>
                    </button>
                    <button
                      type="button"
                      className="welcome-recent-remove"
                      title="从列表移除"
                      onClick={() => void handleRemoveVault(path)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="welcome-recent-block">
            <div className="welcome-recent-header">
              <h3>最近的文档</h3>
              {recentFiles.length > 0 && (
                <button type="button" className="welcome-link-btn" onClick={openRecentDocumentsPage}>
                  查看全部
                </button>
              )}
            </div>
            {recentFiles.length === 0 ? (
              <p className="welcome-empty">暂无最近文档</p>
            ) : (
              <ul className="welcome-recent-list">
                {recentFiles.map((file) => (
                  <li key={file.path}>
                    <button type="button" className="welcome-recent-item" onClick={() => void openFile(file.path)}>
                      <span className="welcome-recent-name">{getFileName(file.path)}</span>
                      <span className="welcome-recent-meta">{formatRecentTime(file.openedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="welcome-section welcome-tips">
          <h2>快捷提示</h2>
          <ul className="welcome-tips-list">
            <li><kbd>Ctrl</kbd> + <kbd>N</kbd> 新建文档</li>
            <li><kbd>Ctrl</kbd> + <kbd>O</kbd> 打开文档</li>
            <li><kbd>Ctrl</kbd> + <kbd>S</kbd> 保存文档</li>
            <li><kbd>Ctrl</kbd> + <kbd>W</kbd> 关闭文档 / 退出应用</li>
            <li><kbd>Ctrl</kbd> + <kbd>F</kbd> 查找与替换</li>
            <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> 撤销 / 重做</li>
            <li>拖拽 .md / .mdx 文件到窗口可直接打开</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function WelcomeAction({
  title,
  description,
  shortcut,
  onClick,
}: {
  title: string;
  description: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className="welcome-action" onClick={onClick}>
        <span className="welcome-action-title">
          {title}
          {shortcut && <span className="welcome-action-shortcut">{shortcut}</span>}
        </span>
        <span className="welcome-action-desc">{description}</span>
      </button>
    </li>
  );
}
