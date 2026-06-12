import { invoke } from "@tauri-apps/api/core";
import type { DocumentHistoryEntry, DocumentVersionsFile } from "../types/documentHistory";
import { computeMarkdownDiff } from "./textDiff";

function toHistoryEntry(
  lines: ReturnType<typeof computeMarkdownDiff>["lines"],
  stats: ReturnType<typeof computeMarkdownDiff>["stats"],
): DocumentHistoryEntry {
  return {
    id: crypto.randomUUID(),
    savedAt: Date.now(),
    lines,
    stats,
  };
}

export async function getDocumentHistory(workspaceId: string): Promise<DocumentHistoryEntry[]> {
  const file = await invoke<DocumentVersionsFile>("get_document_versions", { workspaceId });
  return Array.isArray(file.entries) ? file.entries : [];
}

export async function recordDocumentHistory(
  workspaceId: string,
  previousContent: string,
  newContent: string,
  maxEntries: number,
): Promise<void> {
  if (previousContent === newContent) return;

  const { lines, stats } = computeMarkdownDiff(previousContent, newContent);
  if (lines.length === 0) return;

  const entry = toHistoryEntry(lines, stats);
  await invoke("append_document_version", {
    workspaceId,
    entry,
    maxEntries,
  });
}

export async function clearDocumentHistory(workspaceId: string): Promise<void> {
  await invoke("clear_document_versions", { workspaceId });
}

/** 删除单条历史；若删除非最旧记录，会一并移除所有更早记录 */
export async function deleteDocumentHistoryEntry(
  workspaceId: string,
  entryId: string,
): Promise<number> {
  const [, removed] = await invoke<[DocumentVersionsFile, number]>("delete_document_version", {
    workspaceId,
    entryId,
  });
  return removed;
}

/** 预估删除某条记录时会移除的条数（与后端 delete_version 规则一致） */
export function countHistoryDeletes(entries: DocumentHistoryEntry[], entryId: string): number {
  const index = entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) return 0;
  if (index === 0 || index + 1 === entries.length) return 1;
  return entries.length - index;
}
