export type VaultTreeNode =
  | {
      kind: "folder";
      name: string;
      relative_path: string;
      children: VaultTreeNode[];
    }
  | {
      kind: "file";
      name: string;
      path: string;
    };

export function isVaultFolder(node: VaultTreeNode): node is Extract<VaultTreeNode, { kind: "folder" }> {
  return node.kind === "folder";
}

export function isVaultFile(node: VaultTreeNode): node is Extract<VaultTreeNode, { kind: "file" }> {
  return node.kind === "file";
}

export function getVaultName(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

export interface VaultItemInfo {
  path: string;
  name: string;
  relativePath: string;
  kind: "file" | "folder";
  sizeBytes?: number | null;
  modifiedAtMs?: number | null;
  createdAtMs?: number | null;
  fileCount?: number | null;
  folderCount?: number | null;
}

export type VaultContextTarget =
  | { kind: "file"; path: string; name: string; relativePath: string }
  | { kind: "folder"; path: string; name: string; relativePath: string };
