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
