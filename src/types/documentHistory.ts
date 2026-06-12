export type DiffLineType = "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  content: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
}

export interface DocumentHistoryEntry {
  id: string;
  savedAt: number;
  lines: DiffLine[];
  stats: DiffStats;
}

export interface DocumentVersionsFile {
  formatVersion: string;
  entries: DocumentHistoryEntry[];
}
