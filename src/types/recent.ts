export interface RecentFileEntry {
  path: string;
  openedAt: number;
}

export interface RecentFileGroup {
  label: string;
  sortKey: string;
  files: RecentFileEntry[];
}
