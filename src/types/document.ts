export interface Manifest {
  format_version: string;
  title: string;
  created_at: string;
  modified_at: string;
}

export interface DocumentState {
  workspace_id: string;
  content: string;
  manifest: Manifest;
  file_path: string | null;
}

export type SaveStatus = "saved" | "saving" | "dirty" | "idle";
