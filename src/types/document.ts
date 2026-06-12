export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recorded_at: string;
}

export interface DeviceInfo {
  os: string;
  arch: string;
  hostname: string;
  recorded_at: string;
}

export interface Manifest {
  format_version: string;
  title: string;
  created_at: string;
  modified_at: string;
  device_info?: DeviceInfo | null;
  location?: GeoLocation | null;
}

export interface DocumentState {
  workspace_id: string;
  content: string;
  manifest: Manifest;
  file_path: string | null;
  is_encrypted?: boolean;
}

export type SaveStatus = "saved" | "saving" | "dirty" | "idle";
