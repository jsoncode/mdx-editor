import { invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFileName, addRecentFile, removeRecentFile } from "../lib/recentFiles";
import { moveVaultItem } from "../lib/vault";
import { useDocumentStore } from "../stores/documentStore";
import { useVaultStore } from "../stores/vaultStore";

export interface VaultDropLine {
  top: number;
  left: number;
  width: number;
}

export interface VaultDragPayload {
  kind: "file" | "folder";
  relativePath: string;
  path: string;
  name: string;
}

const DRAG_THRESHOLD_PX = 6;
const VAULT_TREE_INDENT = 20;
const VAULT_TREE_BASE_PADDING = 8;
const VAULT_TREE_CHEVRON_WIDTH = 22;

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function parentFolderRelative(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

export function canDropVaultItem(
  payload: VaultDragPayload,
  targetFolderRelative: string,
): boolean {
  const target = normalizeRelativePath(targetFolderRelative);
  const source = normalizeRelativePath(payload.relativePath);

  if (payload.kind === "folder") {
    if (target === source || target.startsWith(`${source}/`)) {
      return false;
    }
  }

  if (parentFolderRelative(source) === target) {
    return false;
  }

  return true;
}

function computeDropLine(dropEl: HTMLElement): VaultDropLine {
  if (dropEl.classList.contains("workspace-sidebar-tree")) {
    const tree = dropEl.querySelector(".vault-tree");
    const anchor = tree ?? dropEl;
    const rect = anchor.getBoundingClientRect();
    const inset = VAULT_TREE_BASE_PADDING + VAULT_TREE_CHEVRON_WIDTH;
    return {
      top: rect.top + 2,
      left: rect.left + inset,
      width: Math.max(48, rect.width - inset - 8),
    };
  }

  const rect = dropEl.getBoundingClientRect();
  const depth = Number(dropEl.dataset.vaultDepth ?? 0);
  const childInset =
    VAULT_TREE_BASE_PADDING + (depth + 1) * VAULT_TREE_INDENT + VAULT_TREE_CHEVRON_WIDTH;
  const left = rect.left + childInset;

  return {
    top: rect.bottom - 1,
    left,
    width: Math.max(48, rect.right - left - 8),
  };
}

function resolveDropTarget(
  clientX: number,
  clientY: number,
  payload: VaultDragPayload,
): { folder: string; line: VaultDropLine } | null {
  const element = document.elementFromPoint(clientX, clientY);
  const dropEl = element?.closest<HTMLElement>("[data-vault-drop-folder]");
  if (!dropEl) return null;

  const folder = dropEl.dataset.vaultDropFolder ?? "";
  if (!canDropVaultItem(payload, folder)) return null;

  return {
    folder: normalizeRelativePath(folder),
    line: computeDropLine(dropEl),
  };
}

function findDropFolder(clientX: number, clientY: number): string | null {
  const element = document.elementFromPoint(clientX, clientY);
  const dropEl = element?.closest<HTMLElement>("[data-vault-drop-folder]");
  if (!dropEl) return null;
  return dropEl.dataset.vaultDropFolder ?? "";
}

export function useVaultTreeDrag() {
  const [dragging, setDragging] = useState<VaultDragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropLine, setDropLine] = useState<VaultDropLine | null>(null);
  const [dropValid, setDropValid] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const sessionRef = useRef<{
    payload: VaultDragPayload;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const vaultPath = useVaultStore((s) => s.vaultPath);
  const refreshTree = useVaultStore((s) => s.refreshTree);
  const expandToFile = useVaultStore((s) => s.expandToFile);
  const setSelectedFolder = useVaultStore((s) => s.setSelectedFolder);
  const toggleFolder = useVaultStore((s) => s.toggleFolder);
  const expandedFolders = useVaultStore((s) => s.expandedFolders);

  const filePath = useDocumentStore((s) => s.filePath);
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const setFilePath = useDocumentStore((s) => s.setFilePath);
  const setRecentFiles = useDocumentStore((s) => s.setRecentFiles);

  const performMoveRef = useRef<(payload: VaultDragPayload, target: string) => Promise<void>>(
    async () => {},
  );

  performMoveRef.current = async (payload: VaultDragPayload, targetFolderRelative: string) => {
    if (!vaultPath) return;

    const target = normalizeRelativePath(targetFolderRelative);
    if (!canDropVaultItem(payload, target)) return;

    try {
      const newAbsolutePath = await moveVaultItem(
        vaultPath,
        payload.relativePath,
        target,
        payload.kind === "folder",
      );

      if (payload.kind === "file" && filePath === payload.path) {
        setFilePath(newAbsolutePath);
        if (workspaceId) {
          await invoke("set_document_file_path", {
            workspaceId,
            path: newAbsolutePath,
          });
        }
        await getCurrentWindow().setTitle(`MDX Editor - ${getFileName(newAbsolutePath)}`);
        expandToFile(newAbsolutePath);
        const recent = await addRecentFile(newAbsolutePath);
        setRecentFiles(recent);
      } else if (payload.kind === "file") {
        await removeRecentFile(payload.path);
        const recent = await addRecentFile(newAbsolutePath);
        setRecentFiles(recent);
      } else if (payload.kind === "folder" && filePath) {
        const oldFolder = payload.path.replace(/\\/g, "/");
        const normalizedFile = filePath.replace(/\\/g, "/");
        if (normalizedFile.startsWith(`${oldFolder}/`)) {
          const suffix = normalizedFile.slice(oldFolder.length);
          const sep = payload.path.includes("\\") ? "\\" : "/";
          const movedFilePath = `${newAbsolutePath.replace(/[/\\]+$/, "")}${suffix.replace(/\//g, sep)}`;
          setFilePath(movedFilePath);
          if (workspaceId) {
            await invoke("set_document_file_path", {
              workspaceId,
              path: movedFilePath,
            });
          }
          expandToFile(movedFilePath);
        }
      }

      setSelectedFolder(target);
      if (target && !expandedFolders.has(target)) {
        toggleFolder(target);
      }
      await refreshTree();
    } catch (error) {
      await message(String(error), { title: "移动失败", kind: "error" });
    }
  };

  const clearDragState = useCallback(() => {
    sessionRef.current = null;
    setDragging(null);
    setDropTarget(null);
    setDropLine(null);
    setDropValid(false);
    setPointer(null);
    document.body.classList.remove("vault-tree-dnd-active");
    document.body.style.cursor = "";
  }, []);

  const updateDropTarget = useCallback(
    (clientX: number, clientY: number, payload: VaultDragPayload) => {
      setPointer({ x: clientX, y: clientY });

      const resolved = resolveDropTarget(clientX, clientY, payload);
      if (!resolved) {
        setDropTarget(null);
        setDropLine(null);
        setDropValid(false);
        document.body.style.cursor = "grabbing";
        return;
      }

      setDropTarget(resolved.folder);
      setDropLine(resolved.line);
      setDropValid(true);
      document.body.style.cursor = "copy";
    },
    [],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      const dx = event.clientX - session.startX;
      const dy = event.clientY - session.startY;
      if (!session.active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        session.active = true;
        setDragging(session.payload);
        document.body.classList.add("vault-tree-dnd-active");
        document.body.style.cursor = "grabbing";
      }

      event.preventDefault();
      updateDropTarget(event.clientX, event.clientY, session.payload);
    };

    const onPointerUp = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;

      const payload = session.payload;
      const wasActive = session.active;
      clearDragState();

      if (!wasActive) return;

      suppressClickRef.current = true;
      const folder = findDropFolder(event.clientX, event.clientY);
      if (folder === null || !canDropVaultItem(payload, folder)) return;
      void performMoveRef.current(payload, folder);
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [clearDragState, updateDropTarget]);

  const handlePointerDown = useCallback((payload: VaultDragPayload, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".vault-tree-chevron")) return;

    sessionRef.current = {
      payload,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
  }, []);

  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    dragging,
    dropTarget,
    dropLine,
    dropValid,
    pointer,
    handlePointerDown,
    consumeClickSuppression,
    canDropOn: canDropVaultItem,
  };
};
