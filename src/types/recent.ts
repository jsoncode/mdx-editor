export interface RecentFileEntry {
  path: string;
  openedAt: number;
}

export interface RecentFileGroup {
  label: string;
  sortKey: string;
  files: RecentFileEntry[];
}

export type RecentGroupMode = "year" | "month" | "week" | "directory";
export type RecentSortMode = "time" | "name";
