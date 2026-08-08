import { invoke } from "@tauri-apps/api/core";

export async function toggleDevTools(): Promise<boolean> {
  return invoke<boolean>("toggle_devtools");
}

export async function openDevTools(): Promise<void> {
  await invoke("open_devtools");
}
