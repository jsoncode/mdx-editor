import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  clipboardHasFiles,
  extensionFromName,
  getFilePath,
  isInsertableFileName,
  isInsertablePath,
  isMdxPath,
  MAX_PASTE_BYTES,
  normalizeClipboardPath,
  normalizeImageExt,
} from "../lib/media";
import { useDocumentStore } from "../stores/documentStore";

export function useAssetInsert(
  insertAtCursor: (text: string) => void,
  onOpenMdx?: (path: string) => void | Promise<void>,
) {
  const workspaceId = useDocumentStore((s) => s.workspaceId);

  const insertSnippet = useCallback(
    async (snippetPromise: Promise<string>) => {
      if (!workspaceId) return false;
      const snippet = await snippetPromise;
      insertAtCursor(`\n${snippet}\n`);
      return true;
    },
    [workspaceId, insertAtCursor],
  );

  const insertFromPath = useCallback(
    async (sourcePath: string) => {
      if (!workspaceId) return false;
      return insertSnippet(
        invoke<string>("insert_asset_from_path", {
          workspaceId,
          sourcePath,
        }),
      );
    },
    [workspaceId, insertSnippet],
  );

  const insertFromBytes = useCallback(
    async (filename: string, bytes: Uint8Array) => {
      if (!workspaceId) return false;
      return insertSnippet(
        invoke<string>("insert_asset_from_bytes", {
          workspaceId,
          filename,
          bytes: Array.from(bytes),
        }),
      );
    },
    [workspaceId, insertSnippet],
  );

  const insertPaths = useCallback(
    async (paths: string[]) => {
      const seen = new Set<string>();
      let inserted = 0;

      for (const sourcePath of paths) {
        const key = normalizeClipboardPath(sourcePath);
        if (seen.has(key)) continue;
        seen.add(key);

        if (!isInsertablePath(sourcePath)) continue;
        if (await insertFromPath(sourcePath)) inserted++;
      }

      return inserted;
    },
    [insertFromPath],
  );

  const insertFromClipboardFiles = useCallback(
    async (files: File[]) => {
      const seen = new Set<string>();
      let inserted = 0;

      for (const file of files) {
        const path = getFilePath(file);
        if (path && isInsertablePath(path)) {
          const key = normalizeClipboardPath(path);
          if (seen.has(key)) continue;
          seen.add(key);
          if (await insertFromPath(path)) inserted++;
          continue;
        }

        if (!file.name || !isInsertableFileName(file.name)) continue;
        if (file.size > MAX_PASTE_BYTES) continue;

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (await insertFromBytes(file.name, bytes)) inserted++;
      }

      return inserted;
    },
    [insertFromPath, insertFromBytes],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const files = Array.from(event.dataTransfer.files);
      for (const file of files) {
        const path = getFilePath(file);
        if (path) {
          if (isMdxPath(path)) {
            await onOpenMdx?.(path);
            continue;
          }
          if (isInsertablePath(path)) {
            await insertFromPath(path);
          }
          continue;
        }
        if (file.name && isMdxPath(file.name)) continue;
        if (!isInsertableFileName(file.name)) continue;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await insertFromBytes(file.name, bytes);
      }
    },
    [insertFromPath, insertFromBytes, onOpenMdx],
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      if (!workspaceId) return;
      const data = event.clipboardData;
      if (!data) return;

      const files = Array.from(data.files);
      const imageItems = Array.from(data.items).filter((item) =>
        item.type.startsWith("image/"),
      );
      const hasFiles = clipboardHasFiles(data);

      if (hasFiles) {
        event.preventDefault();
        event.stopPropagation();

        let inserted = 0;

        try {
          const paths = await invoke<string[]>("read_clipboard_file_paths");
          inserted = await insertPaths(paths.filter(isInsertablePath));
        } catch (error) {
          console.warn("读取剪贴板文件失败:", error);
        }

        if (inserted === 0) {
          inserted = await insertFromClipboardFiles(files);
        }

        if (inserted === 0) {
          const text = data.getData("text/plain");
          if (text) insertAtCursor(text);
        }
        return;
      }

      if (imageItems.length > 0) {
        event.preventDefault();
        event.stopPropagation();

        for (const item of imageItems) {
          const file = item.getAsFile();
          if (!file) continue;

          const path = getFilePath(file);
          if (path && isInsertablePath(path)) {
            await insertFromPath(path);
            continue;
          }

          if (file.size > MAX_PASTE_BYTES) continue;
          const ext = normalizeImageExt(item.type);
          const name =
            file.name && extensionFromName(file.name)
              ? file.name
              : `paste.${ext}`;
          const bytes = new Uint8Array(await file.arrayBuffer());
          await insertFromBytes(name, bytes);
        }
      }
    },
    [
      workspaceId,
      insertAtCursor,
      insertFromPath,
      insertFromBytes,
      insertPaths,
      insertFromClipboardFiles,
    ],
  );

  return {
    insertFromPath,
    insertFromBytes,
    handleDrop,
    handlePaste,
  };
}
