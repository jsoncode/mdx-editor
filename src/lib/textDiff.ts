import { diffLines } from "diff";
import type { DiffLine, DiffStats } from "../types/documentHistory";

function splitDiffValue(value: string): string[] {
  const parts = value.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

export function computeMarkdownDiff(
  oldText: string,
  newText: string,
): { lines: DiffLine[]; stats: DiffStats } {
  const changes = diffLines(oldText, newText);
  const lines: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    const parts = splitDiffValue(change.value);
    if (change.added) {
      for (const content of parts) {
        lines.push({ type: "add", content });
        additions += 1;
      }
    } else if (change.removed) {
      for (const content of parts) {
        lines.push({ type: "remove", content });
        deletions += 1;
      }
    }
  }

  return { lines, stats: { additions, deletions } };
}
