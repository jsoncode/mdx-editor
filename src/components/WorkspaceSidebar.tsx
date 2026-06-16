import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { useVaultActions } from "../hooks/useVaultActions";
import { useVaultTreeMenu } from "../hooks/useVaultTreeMenu";
import { useVaultTreeDrag } from "../hooks/useVaultTreeDrag";
import { isPlainMdPath } from "../lib/documentPaths";
import { useDocumentStore } from "../stores/documentStore";
import { useVaultStore } from "../stores/vaultStore";
import { getVaultName } from "../types/vault";
import {
  VaultContextMenu,
  VaultItemInfoDialog,
  VaultRenameDialog,
  type VaultContextMenuItem,
} from "./VaultContextMenu";
import { FileTree, VaultCreateFolderInput, VaultEmptyState } from "./FileTree";
import { VaultTreeDragOverlay } from "./VaultTreeDragOverlay";

export function WorkspaceSidebar() {
  const [creatingFolder, setCreatingFolder] = useState(false);

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const tree = useVaultStore((s) => s.tree);
  const expandedFolders = useVaultStore((s) => s.expandedFolders);
  const deferredExpandedFolders = useDeferredValue(expandedFolders);
  const selectedFolder = useVaultStore((s) => s.selectedFolder);
  const loading = useVaultStore((s) => s.loading);
  const toggleFolder = useVaultStore((s) => s.toggleFolder);
  const setSelectedFolder = useVaultStore((s) => s.setSelectedFolder);
  const createFolder = useVaultStore((s) => s.createFolder);
  const refreshTree = useVaultStore((s) => s.refreshTree);
  const expandAllFolders = useVaultStore((s) => s.expandAllFolders);
  const collapseAllFolders = useVaultStore((s) => s.collapseAllFolders);
  const setSidebarOpen = useVaultStore((s) => s.setSidebarOpen);

  const filePath = useDocumentStore((s) => s.filePath);

  const {
    handleOpenVault,
    handleNewDocumentInVault,
    handleOpenFileInVault,
  } = useVaultActions();

  const treeMenu = useVaultTreeMenu();
  const treeDrag = useVaultTreeDrag();

  const contextMenuItems = useMemo((): VaultContextMenuItem[] => {
    if (!treeMenu.contextMenu) return [];

    const { target } = treeMenu.contextMenu;

    if (target.kind === "workspace") {
      return [
        {
          id: "new-mdx",
          label: "新建 MDX 文档",
          onClick: () => {
            void (async () => {
              const path = await treeMenu.createDocumentInWorkspace(target.folderRelative, "mdx");
              if (path) handleOpenFileInVault(path);
            })();
          },
        },
        {
          id: "new-md",
          label: "新建 Markdown 文档",
          onClick: () => {
            void (async () => {
              const path = await treeMenu.createDocumentInWorkspace(target.folderRelative, "md");
              if (path) handleOpenFileInVault(path);
            })();
          },
        },
        {
          id: "new-folder",
          label: "新建文件夹",
          onClick: () => {
            setSelectedFolder(target.folderRelative);
            setCreatingFolder(true);
          },
        },
        { id: "sep-1", separator: true },
        {
          id: "refresh",
          label: "刷新文档树",
          onClick: () => void refreshTree(),
        },
      ];
    }

    if (target.kind === "file") {
      const mdItems: VaultContextMenuItem[] = isPlainMdPath(target.path)
        ? [
            {
              id: "convert-mdx",
              label: "转换为 MDX",
              onClick: () => void treeMenu.convertMdToMdx(target),
            },
            { id: "sep-convert", separator: true },
          ]
        : [];

      return [
        { id: "open", label: "打开", onClick: () => handleOpenFileInVault(target.path) },
        ...mdItems,
        { id: "sep-1", separator: true },
        { id: "rename", label: "重命名", onClick: () => treeMenu.setRenameTarget(target) },
        { id: "delete", label: "删除", danger: true, onClick: () => void treeMenu.deleteFile(target) },
        { id: "sep-2", separator: true },
        { id: "info", label: "查看信息", onClick: () => void treeMenu.showInfo(target) },
        {
          id: "reveal",
          label: "在资源管理器中显示",
          onClick: () => void treeMenu.revealInExplorer(target.path),
        },
        { id: "copy", label: "复制路径", onClick: () => void treeMenu.copyPath(target.path) },
      ];
    }

    return [
      {
        id: "new-mdx",
        label: "新建 MDX 文档",
        onClick: () => {
          void (async () => {
            const path = await treeMenu.createDocumentInFolder(target, "mdx");
            if (path) handleOpenFileInVault(path);
          })();
        },
      },
      {
        id: "new-md",
        label: "新建 Markdown 文档",
        onClick: () => {
          void (async () => {
            const path = await treeMenu.createDocumentInFolder(target, "md");
            if (path) handleOpenFileInVault(path);
          })();
        },
      },
      {
        id: "new-folder",
        label: "新建子文件夹",
        onClick: () => {
          setSelectedFolder(target.relativePath);
          setCreatingFolder(true);
        },
      },
      { id: "sep-1", separator: true },
      { id: "rename", label: "重命名", onClick: () => treeMenu.setRenameTarget(target) },
      {
        id: "delete",
        label: "删除文件夹",
        danger: true,
        onClick: () => void treeMenu.deleteFolder(target),
      },
      { id: "sep-2", separator: true },
      { id: "info", label: "查看信息", onClick: () => void treeMenu.showInfo(target) },
      {
        id: "reveal",
        label: "在资源管理器中显示",
        onClick: () => void treeMenu.revealInExplorer(target.path),
      },
      { id: "copy", label: "复制路径", onClick: () => void treeMenu.copyPath(target.path) },
    ];
  }, [treeMenu, handleOpenFileInVault, setSelectedFolder, refreshTree]);

  const handleTreeBackgroundContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".vault-tree-item, .vault-tree-row, .vault-tree-body, .vault-tree-chevron")) {
      return;
    }
    treeMenu.openWorkspaceContextMenu(event);
  };

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
          <IconButton title="刷新文档树" label="刷新文档树" onClick={() => void refreshTree()}>
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

      {tree.length > 0 && (
        <div className="workspace-tree-toolbar">
          <button
            type="button"
            className="workspace-tree-toolbar-btn"
            title="展开所有文件夹"
            onClick={() => expandAllFolders()}
          >
            <ExpandAllIcon />
            <span>全部展开</span>
          </button>
          <button
            type="button"
            className="workspace-tree-toolbar-btn"
            title="收起所有文件夹"
            onClick={() => collapseAllFolders()}
          >
            <CollapseAllIcon />
            <span>全部收起</span>
          </button>
        </div>
      )}

      <div
        className={`workspace-sidebar-tree${treeDrag.dragging ? " is-vault-dragging" : ""}${treeDrag.dropTarget === "" && treeDrag.dropValid ? " vault-drop-hover-root" : ""}`}
        data-vault-drop-folder=""
        onContextMenu={handleTreeBackgroundContextMenu}
      >
        {loading ? (
          <p className="workspace-sidebar-hint">加载中...</p>
        ) : tree.length === 0 ? (
          <p className="workspace-sidebar-hint">暂无文档，右键可新建，或点击上方 + 新建。</p>
        ) : (
          <FileTree
            vaultPath={vaultPath}
            nodes={tree}
            activePath={filePath}
            expandedFolders={deferredExpandedFolders}
            selectedFolder={selectedFolder}
            onToggleFolder={toggleFolder}
            onSelectFolder={setSelectedFolder}
            onOpenFile={(path) => void handleOpenFileInVault(path)}
            onFileContextMenu={(event, node) =>
              treeMenu.openContextMenu(event, treeMenu.buildFileContextTarget(node.path, node.name))
            }
            onFolderContextMenu={(event, node, absolutePath) =>
              treeMenu.openContextMenu(
                event,
                treeMenu.buildFolderContextTarget(absolutePath, node.name, node.relative_path),
              )
            }
            dragging={treeDrag.dragging}
            dropTarget={treeDrag.dropTarget}
            onPointerDown={treeDrag.handlePointerDown}
            consumeClickSuppression={treeDrag.consumeClickSuppression}
            canDropOn={treeDrag.canDropOn}
          />
        )}
      </div>

      <VaultTreeDragOverlay
        dragging={treeDrag.dragging}
        pointer={treeDrag.pointer}
        dropLine={treeDrag.dropLine}
        dropValid={treeDrag.dropValid}
      />

      {treeMenu.contextMenu && (
        <VaultContextMenu
          x={treeMenu.contextMenu.x}
          y={treeMenu.contextMenu.y}
          items={contextMenuItems}
          onClose={treeMenu.closeContextMenu}
        />
      )}

      <VaultItemInfoDialog info={treeMenu.infoItem} onClose={() => treeMenu.setInfoItem(null)} />
      <VaultRenameDialog
        target={treeMenu.renameTarget}
        onClose={() => treeMenu.setRenameTarget(null)}
        onSubmit={(name) => {
          if (treeMenu.renameTarget) {
            void treeMenu.submitRename(treeMenu.renameTarget, name);
          }
        }}
      />
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
        d="M12.8 5.2A5.4 5.4 0 0 0 4.1 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M11.2 2.6h2.1v2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.2 10.8A5.4 5.4 0 0 0 11.9 12.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M4.8 13.4H2.7v-2.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
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

function ExpandAllIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 5.5L8 10l5-4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9.5L8 14l5-4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 6.5L8 2l5 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 10.5L8 6l5 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
