import { load } from "@tauri-apps/plugin-store";
import type {
  RecentFileEntry,
  RecentFileGroup,
  RecentGroupMode,
  RecentSortMode,
} from "../types/recent";

const STORE_PATH = "settings.json";
const RECENT_KEY = "recent_files";
const MAX_RECENT = 100;

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

function normalizeEntries(raw: unknown): RecentFileEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): RecentFileEntry | null => {
      if (typeof item === "string") {
        return { path: item, openedAt: Date.now() };
      }
      if (
        item &&
        typeof item === "object" &&
        "path" in item &&
        typeof (item as RecentFileEntry).path === "string"
      ) {
        const entry = item as RecentFileEntry;
        return {
          path: entry.path,
          openedAt: entry.openedAt ?? Date.now(),
        };
      }
      return null;
    })
    .filter((item): item is RecentFileEntry => item !== null);
}

export async function getRecentFileEntries(): Promise<RecentFileEntry[]> {
  const store = await getStore();
  const raw = await store.get<unknown>(RECENT_KEY);
  return normalizeEntries(raw);
}

/** @deprecated use getRecentFileEntries */
export async function getRecentFiles(): Promise<string[]> {
  const entries = await getRecentFileEntries();
  return entries.map((entry) => entry.path);
}

export async function addRecentFile(path: string): Promise<RecentFileEntry[]> {
  const store = await getStore();
  const current = normalizeEntries(await store.get(RECENT_KEY));
  const now = Date.now();
  const next = [
    { path, openedAt: now },
    ...current.filter((entry) => entry.path !== path),
  ].slice(0, MAX_RECENT);

  await store.set(RECENT_KEY, next);
  await store.save();
  return next;
}

export async function removeRecentFile(path: string): Promise<RecentFileEntry[]> {
  const store = await getStore();
  const next = normalizeEntries(await store.get(RECENT_KEY)).filter(
    (entry) => entry.path !== path,
  );
  await store.set(RECENT_KEY, next);
  await store.save();
  return next;
}

export async function clearRecentFiles(): Promise<void> {
  const store = await getStore();
  await store.set(RECENT_KEY, []);
  await store.save();
}

export function sortRecentEntries(
  entries: RecentFileEntry[],
  sortMode: RecentSortMode,
): RecentFileEntry[] {
  const copy = [...entries];
  if (sortMode === "name") {
    return copy.sort((a, b) =>
      getFileName(a.path).localeCompare(getFileName(b.path), "zh-CN"),
    );
  }
  return copy.sort((a, b) => b.openedAt - a.openedAt);
}

function getYearGroup(date: Date): { sortKey: string; label: string } {
  const year = date.getFullYear();
  return { sortKey: String(year), label: `${year}年` };
}

function getMonthGroup(date: Date): { sortKey: string; label: string } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return {
    sortKey: `${year}-${String(month).padStart(2, "0")}`,
    label: `${year}年${month}月`,
  };
}

function getWeekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

function getWeekGroup(date: Date): { sortKey: string; label: string } {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const sortKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const range = `${formatShortDate(start)} – ${formatShortDate(end)}`;
  const label =
    start.getFullYear() === end.getFullYear()
      ? `${start.getFullYear()}年 ${range}`
      : `${start.getFullYear()}年${formatShortDate(start)} – ${end.getFullYear()}年${formatShortDate(end)}`;

  return { sortKey, label };
}

export function getDirectoryLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return "其他位置";

  const dir = normalized.slice(0, lastSlash);
  if (/^[a-zA-Z]:$/.test(dir)) {
    return `${dir}\\`;
  }
  return dir.replace(/\//g, "\\");
}

function getDirectoryGroup(path: string): { sortKey: string; label: string } {
  const label = getDirectoryLabel(path);
  const sortKey = label.toLowerCase();
  return { sortKey, label };
}

function groupKeyForEntry(
  file: RecentFileEntry,
  groupMode: RecentGroupMode,
): { sortKey: string; label: string } {
  const date = new Date(file.openedAt);
  switch (groupMode) {
    case "year":
      return getYearGroup(date);
    case "week":
      return getWeekGroup(date);
    case "directory":
      return getDirectoryGroup(file.path);
    case "month":
    default:
      return getMonthGroup(date);
  }
}

export function groupRecentFiles(
  entries: RecentFileEntry[],
  groupMode: RecentGroupMode,
  sortMode: RecentSortMode,
): RecentFileGroup[] {
  const sorted = sortRecentEntries(entries, sortMode);
  const groups = new Map<string, RecentFileGroup>();

  for (const file of sorted) {
    const { sortKey, label } = groupKeyForEntry(file, groupMode);
    const group = groups.get(sortKey) ?? { label, sortKey, files: [] };
    group.files.push(file);
    groups.set(sortKey, group);
  }

  const grouped = Array.from(groups.values()).map((group) => ({
    ...group,
    files: sortRecentEntries(group.files, sortMode),
  }));

  if (groupMode === "directory") {
    return grouped.sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }

  return grouped.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

/** @deprecated use groupRecentFiles with groupMode "month" */
export function groupRecentFilesByMonth(
  entries: RecentFileEntry[],
): RecentFileGroup[] {
  return groupRecentFiles(entries, "month", "time");
}

export function formatRecentTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}
