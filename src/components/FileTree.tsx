import { useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { isVaultFile, isVaultFolder, type VaultTreeNode } from "../types/vault";
import type { VaultDragPayload } from "../hooks/useVaultTreeDrag";

const VAULT_TREE_INDENT = 20;
const VAULT_TREE_BASE_PADDING = 8;

function treeRowStyle(depth: number): CSSProperties {
  return {
    paddingLeft: `${VAULT_TREE_BASE_PADDING + depth * VAULT_TREE_INDENT}px`,
  };
}

export interface VaultTreeDragHandlers {
  dragging: VaultDragPayload | null;
  dropTarget: string | null;
  onPointerDown: (payload: VaultDragPayload, event: PointerEvent) => void;
  consumeClickSuppression: () => boolean;
  canDropOn: (payload: VaultDragPayload, targetFolderRelative: string) => boolean;
}

interface FileTreeProps extends VaultTreeDragHandlers {
  vaultPath: string;
  nodes: VaultTreeNode[];
  depth?: number;
  activePath: string | null;
  expandedFolders: Set<string>;
  selectedFolder: string;
  onToggleFolder: (relativePath: string) => void;
  onSelectFolder: (relativePath: string) => void;
  onOpenFile: (path: string) => void;
  onFileContextMenu: (event: MouseEvent, node: Extract<VaultTreeNode, { kind: "file" }>) => void;
  onFolderContextMenu: (
    event: MouseEvent,
    node: Extract<VaultTreeNode, { kind: "folder" }>,
    absolutePath: string,
  ) => void;
}

export function FileTree({
  vaultPath,
  nodes,
  depth = 0,
  activePath,
  expandedFolders,
  selectedFolder,
  onToggleFolder,
  onSelectFolder,
  onOpenFile,
  onFileContextMenu,
  onFolderContextMenu,
  dragging,
  dropTarget,
  onPointerDown,
  consumeClickSuppression,
  canDropOn,
}: FileTreeProps) {
  return (
    <ul className="vault-tree" role="tree">
      {nodes.map((node) => (
        <FileTreeNodeItem
          key={isVaultFolder(node) ? `folder:${node.relative_path}` : `file:${node.path}`}
          vaultPath={vaultPath}
          node={node}
          depth={depth}
          activePath={activePath}
          expandedFolders={expandedFolders}
          selectedFolder={selectedFolder}
          onToggleFolder={onToggleFolder}
          onSelectFolder={onSelectFolder}
          onOpenFile={onOpenFile}
          onFileContextMenu={onFileContextMenu}
          onFolderContextMenu={onFolderContextMenu}
          dragging={dragging}
          dropTarget={dropTarget}
          onPointerDown={onPointerDown}
          consumeClickSuppression={consumeClickSuppression}
          canDropOn={canDropOn}
        />
      ))}
    </ul>
  );
}

function FileTreeNodeItem({
  vaultPath,
  node,
  depth,
  activePath,
  expandedFolders,
  selectedFolder,
  onToggleFolder,
  onSelectFolder,
  onOpenFile,
  onFileContextMenu,
  onFolderContextMenu,
  dragging,
  dropTarget,
  onPointerDown,
  consumeClickSuppression,
  canDropOn,
}: {
  vaultPath: string;
  node: VaultTreeNode;
  depth: number;
  activePath: string | null;
  expandedFolders: Set<string>;
  selectedFolder: string;
  onToggleFolder: (relativePath: string) => void;
  onSelectFolder: (relativePath: string) => void;
  onOpenFile: (path: string) => void;
  onFileContextMenu: (event: MouseEvent, node: Extract<VaultTreeNode, { kind: "file" }>) => void;
  onFolderContextMenu: (
    event: MouseEvent,
    node: Extract<VaultTreeNode, { kind: "folder" }>,
    absolutePath: string,
  ) => void;
} & VaultTreeDragHandlers) {
  if (isVaultFile(node)) {
    const active = activePath === node.path;
    const relativePath = getRelativeVaultPath(vaultPath, node.path);
    const payload: VaultDragPayload = {
      kind: "file",
      relativePath,
      path: node.path,
      name: node.name,
    };
    const isDragging = dragging?.relativePath === relativePath;

    return (
      <li className="vault-tree-item" role="none">
        <VaultTreeRow
          depth={depth}
          style={treeRowStyle(depth)}
          className={`vault-tree-file${active ? " active" : ""}${isDragging ? " dragging" : ""}`}
          onPointerDown={(event) => onPointerDown(payload, event)}
          chevron={<span className="vault-tree-chevron-placeholder" aria-hidden="true" />}
          icon={<FileIcon />}
          label={node.name}
          title={node.path}
          role="treeitem"
          onActivate={() => {
            if (consumeClickSuppression()) return;
            onOpenFile(node.path);
          }}
          onContextMenu={(event) => onFileContextMenu(event, node)}
        />
      </li>
    );
  }

  const expanded = expandedFolders.has(node.relative_path);
  const selected = selectedFolder === node.relative_path;
  const folderAbsolutePath = joinVaultPath(vaultPath, node.relative_path);
  const normalizedFolderPath = node.relative_path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const payload: VaultDragPayload = {
    kind: "folder",
    relativePath: node.relative_path,
    path: folderAbsolutePath,
    name: node.name,
  };
  const isDragging = dragging?.relativePath === node.relative_path;
  const isDropTarget = dropTarget === normalizedFolderPath;
  const showDropTarget = dragging ? canDropOn(dragging, node.relative_path) : false;

  return (
    <li className="vault-tree-item" role="none">
      <VaultTreeRow
        depth={depth}
        style={treeRowStyle(depth)}
        className={`vault-tree-folder${selected ? " selected" : ""}${isDragging ? " dragging" : ""}${isDropTarget && showDropTarget ? " vault-drop-hover" : ""}`}
        dropFolder={normalizedFolderPath}
        onPointerDown={(event) => onPointerDown(payload, event)}
        chevron={
          <button
            type="button"
            className="vault-tree-chevron"
            aria-label={expanded ? "折叠文件夹" : "展开文件夹"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFolder(node.relative_path);
            }}
          >
            <ChevronIcon expanded={expanded} />
          </button>
        }
        icon={<FolderIcon open={expanded} />}
        label={node.name}
        title={node.relative_path}
        role="treeitem"
        ariaExpanded={expanded}
        onActivate={() => {
          if (consumeClickSuppression()) return;
          onSelectFolder(node.relative_path);
          if (!expanded) onToggleFolder(node.relative_path);
        }}
        onContextMenu={(event) => onFolderContextMenu(event, node, folderAbsolutePath)}
      />
      {expanded && (
        <FileTree
          vaultPath={vaultPath}
          nodes={node.children}
          depth={depth + 1}
          activePath={activePath}
          expandedFolders={expandedFolders}
          selectedFolder={selectedFolder}
          onToggleFolder={onToggleFolder}
          onSelectFolder={onSelectFolder}
          onOpenFile={onOpenFile}
          onFileContextMenu={onFileContextMenu}
          onFolderContextMenu={onFolderContextMenu}
          dragging={dragging}
          dropTarget={dropTarget}
          onPointerDown={onPointerDown}
          consumeClickSuppression={consumeClickSuppression}
          canDropOn={canDropOn}
        />
      )}
    </li>
  );
}

function VaultTreeRow({
  depth,
  style,
  className,
  dropFolder,
  chevron,
  icon,
  label,
  title,
  role,
  ariaExpanded,
  onActivate,
  onContextMenu,
  onPointerDown,
}: {
  depth: number;
  style: CSSProperties;
  className: string;
  dropFolder?: string;
  chevron: ReactNode;
  icon: ReactNode;
  label: string;
  title: string;
  role: "treeitem";
  ariaExpanded?: boolean;
  onActivate: () => void;
  onContextMenu: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
}) {
  return (
    <div
      className={`vault-tree-row ${className}`.trim()}
      style={style}
      data-vault-depth={depth}
      {...(dropFolder !== undefined ? { "data-vault-drop-folder": dropFolder } : {})}
      onPointerDown={onPointerDown}
    >
      <div className="vault-tree-chevron-slot">{chevron}</div>
      <div
        className="vault-tree-body"
        role={role}
        tabIndex={0}
        aria-expanded={ariaExpanded}
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
          }
        }}
        onContextMenu={onContextMenu}
        title={title}
      >
        <span className="vault-tree-icon-slot">{icon}</span>
        <span className="vault-tree-label">{label}</span>
      </div>
    </div>
  );
}

function getRelativeVaultPath(vaultPath: string, itemPath: string): string {
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedItem = itemPath.replace(/\\/g, "/");
  if (normalizedItem.toLowerCase().startsWith(`${normalizedVault.toLowerCase()}/`)) {
    return normalizedItem.slice(normalizedVault.length + 1);
  }
  return normalizedItem;
}

function joinVaultPath(vaultPath: string, relativePath: string): string {
  const base = vaultPath.replace(/[/\\]+$/, "");
  const relative = relativePath.replace(/^[/\\]+/, "");
  const separator = base.includes("\\") ? "\\" : "/";
  return relative ? `${base}${separator}${relative.replace(/\//g, separator)}` : base;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={expanded ? "expanded" : ""}>
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {open ? (
        <path
          d="M2 5.5V12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.5H8L6.5 5H3a1 1 0 0 0-1 1v-.5z"
          fill="currentColor"
        />
      ) : (
        <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.5 1.5H12.5A1.5 1.5 0 0 1 14 6v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5z" fill="currentColor" />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M5 2h4.5L13 5.5V13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function VaultEmptyState({ onOpenVault }: { onOpenVault: () => void }) {
  return (
    <div className="vault-empty">
      <p>打开一个文件夹作为工作区，以树形结构管理 MDX 文档。</p>
      <button type="button" onClick={onOpenVault}>
        打开工作区
      </button>
    </div>
  );
}

export function VaultCreateFolderInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <form
      className="vault-create-folder"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name);
      }}
    >
      <input
        autoFocus
        value={name}
        placeholder="文件夹名称"
        onChange={(event) => setName(event.target.value)}
      />
      <div className="vault-create-folder-actions">
        <button type="submit">创建</button>
        <button type="button" className="secondary" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
