/** 将焦点从预览 iframe 等子框架收回主文档，避免 Tauri 按 asset.localhost 校验 IPC 权限。 */
export function ensureMainFrameFocus(): void {
  const active = document.activeElement;
  if (active instanceof HTMLIFrameElement) {
    active.blur();
  }
  if (document.body.tabIndex < 0) {
    document.body.tabIndex = -1;
  }
  document.body.focus({ preventScroll: true });
}
