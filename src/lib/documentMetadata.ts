import { invoke } from "@tauri-apps/api/core";
import type { Manifest } from "../types/document";
import { getCurrentLocation } from "./geolocation";

export async function applyDocumentMetadata(
  workspaceId: string,
  recordDeviceInfo: boolean,
  recordLocation: boolean,
): Promise<Manifest> {
  let location = null;
  if (recordLocation) {
    location = await getCurrentLocation();
  }

  return invoke<Manifest>("apply_document_metadata", {
    workspaceId,
    metadata: {
      recordDevice: recordDeviceInfo,
      recordLocation,
      location,
    },
  });
}

export async function fetchDocumentManifest(workspaceId: string): Promise<Manifest> {
  return invoke<Manifest>("get_document_manifest", { workspaceId });
}
