import type { ReactNode } from "react";
import { useState } from "react";
import { useVaultActions } from "../hooks/useVaultActions";
import { useDocumentStore } from "../stores/documentStore";
import { useVaultStore } from "../stores/vaultStore";
import { getVaultName } from "../types/vault";
import { FileTree, VaultCreateFolderInput, VaultEmptyState } from "./FileTree";

export function WorkspaceSidebar() {
  const [creatingFolder, setCreatingFolder] = useState(false);

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const tree = useVaultStore((s) => s.tree);
  const expandedFolders = useVaultStore((s) => s.expandedFolders);
  const selectedFolder = useVaultStore((s) => s.selectedFolder);
  const loading = useVaultStore((s) => s.loading);
  const toggleFolder = useVaultStore((s) => s.toggleFolder);
  const setSelectedFolder = useVaultStore((s) => s.setSelectedFolder);
  const createFolder = useVaultStore((s) => s.createFolder);
  const refreshTree = useVaultStore((s) => s.refreshTree);
  const setSidebarOpen = useVaultStore((s) => s.setSidebarOpen);

  const filePath = useDocumentStore((s) => s.filePath);

  const {
    handleOpenVault,
    handleNewDocumentInVault,
    handleOpenFileInVault,
  } = useVaultActions();

  if (!vaultPath) {
    return (
      <aside className="workspace-sidebar">
        <VaultEmptyState onOpenVault={() => void handleOpenVault()} />
      </aside>
    );
  }

  const vaultName = getVaultName(vaultPath);

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-header">
        <div className="workspace-sidebar-title" title={vaultPath}>
          <FolderBadge />
          <span>{vaultName}</span>
        </div>
        <div className="workspace-sidebar-actions">
          <IconButton title="新建文档" label="新建文档" onClick={() => void handleNewDocumentInVault()}>
            <PlusDocIcon />
          </IconButton>
          <IconButton title="新建文件夹" label="新建文件夹" onClick={() => setCreatingFolder(true)}>
            <PlusFolderIcon />
          </IconButton>
          <IconButton title="刷新" label="刷新文档树" onClick={() => void refreshTree()}>
            <RefreshIcon />
          </IconButton>
          <IconButton title="切换工作区" label="打开其他工作区" onClick={() => void handleOpenVault()}>
            <SwitchIcon />
          </IconButton>
          <IconButton title="关闭侧栏" label="隐藏文档树" onClick={() => setSidebarOpen(false)}>
            <CloseIcon />
          </IconButton>
        </div>
      </div>

      {creatingFolder && (
        <VaultCreateFolderInput
          onSubmit={(name) => {
            void createFolder(name).finally(() => setCreatingFolder(false));
          }}
          onCancel={() => setCreatingFolder(false)}
        />
      )}

      <div className="workspace-sidebar-tree">
        {loading ? (
          <p className="workspace-sidebar-hint">加载中...</p>
        ) : tree.length === 0 ? (
          <p className="workspace-sidebar-hint">暂无 MDX 文档，点击上方 + 新建。</p>
        ) : (
          <FileTree
            nodes={tree}
            activePath={filePath}
            expandedFolders={expandedFolders}
            selectedFolder={selectedFolder}
            onToggleFolder={toggleFolder}
            onSelectFolder={setSelectedFolder}
            onOpenFile={(path) => void handleOpenFileInVault(path)}
          />
        )}
      </div>
    </aside>
  );
}

function IconButton({
  title,
  label,
  onClick,
  children,
}: {
  title: string;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="workspace-icon-btn" title={title} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function FolderBadge() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="workspace-vault-icon">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 1.5H12.5A1.5 1.5 0 0 1 14 6v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5z" fill="currentColor" />
    </svg>
  );
}

function PlusDocIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusFolderIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 5h5l1 1h6v7H2V5z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7v4M6 9h4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M11.5 2.5A5 5 0 0 1 13 7M4.5 13.5A5 5 0 0 1 3 9M13 2v3.5H9.5M3 14v-3.5h3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 4h8M2 8h12M2 12h6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 10l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
