import { useState } from "react";
import { isVaultFile, isVaultFolder, type VaultTreeNode } from "../types/vault";

interface FileTreeProps {
  nodes: VaultTreeNode[];
  depth?: number;
  activePath: string | null;
  expandedFolders: Set<string>;
  selectedFolder: string;
  onToggleFolder: (relativePath: string) => void;
  onSelectFolder: (relativePath: string) => void;
  onOpenFile: (path: string) => void;
}

export function FileTree({
  nodes,
  depth = 0,
  activePath,
  expandedFolders,
  selectedFolder,
  onToggleFolder,
  onSelectFolder,
  onOpenFile,
}: FileTreeProps) {
  return (
    <ul className="vault-tree" role="tree">
      {nodes.map((node) => (
        <FileTreeNodeItem
          key={isVaultFolder(node) ? `folder:${node.relative_path}` : `file:${node.path}`}
          node={node}
          depth={depth}
          activePath={activePath}
          expandedFolders={expandedFolders}
          selectedFolder={selectedFolder}
          onToggleFolder={onToggleFolder}
          onSelectFolder={onSelectFolder}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  );
}

function FileTreeNodeItem({
  node,
  depth,
  activePath,
  expandedFolders,
  selectedFolder,
  onToggleFolder,
  onSelectFolder,
  onOpenFile,
}: {
  node: VaultTreeNode;
  depth: number;
  activePath: string | null;
  expandedFolders: Set<string>;
  selectedFolder: string;
  onToggleFolder: (relativePath: string) => void;
  onSelectFolder: (relativePath: string) => void;
  onOpenFile: (path: string) => void;
}) {
  if (isVaultFile(node)) {
    const active = activePath === node.path;
    return (
      <li className="vault-tree-item" role="none">
        <button
          type="button"
          className={`vault-tree-file${active ? " active" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => onOpenFile(node.path)}
          title={node.path}
          role="treeitem"
        >
          <FileIcon />
          <span className="vault-tree-label">{node.name}</span>
        </button>
      </li>
    );
  }

  const expanded = expandedFolders.has(node.relative_path);
  const selected = selectedFolder === node.relative_path;

  return (
    <li className="vault-tree-item" role="none">
      <div className="vault-tree-folder-row">
        <button
          type="button"
          className="vault-tree-toggle"
          aria-label={expanded ? "折叠文件夹" : "展开文件夹"}
          onClick={() => onToggleFolder(node.relative_path)}
        >
          <ChevronIcon expanded={expanded} />
        </button>
        <button
          type="button"
          className={`vault-tree-folder${selected ? " selected" : ""}`}
          style={{ paddingLeft: `${4 + depth * 16}px` }}
          onClick={() => {
            onSelectFolder(node.relative_path);
            if (!expanded) onToggleFolder(node.relative_path);
          }}
          title={node.relative_path}
          role="treeitem"
          aria-expanded={expanded}
        >
          <FolderIcon open={expanded} />
          <span className="vault-tree-label">{node.name}</span>
        </button>
      </div>
      {expanded && node.children.length > 0 && (
        <FileTree
          nodes={node.children}
          depth={depth + 1}
          activePath={activePath}
          expandedFolders={expandedFolders}
          selectedFolder={selectedFolder}
          onToggleFolder={onToggleFolder}
          onSelectFolder={onSelectFolder}
          onOpenFile={onOpenFile}
        />
      )}
    </li>
  );
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
