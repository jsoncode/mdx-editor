function isModKey(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

/** 是否为 Ctrl+S / Cmd+S（仅用物理按键 KeyS，避免与 Ctrl+W 混淆） */
export function isSaveShortcut(event: KeyboardEvent): boolean {
  return isModKey(event) && !event.altKey && event.code === "KeyS";
}

/** 是否为 Ctrl+W / Cmd+W（关闭文档，不是保存） */
export function isCloseDocumentShortcut(event: KeyboardEvent): boolean {
  return isModKey(event) && !event.altKey && !event.shiftKey && event.code === "KeyW";
}

/** F12 或 Ctrl+Shift+I / Cmd+Option+I */
export function isDevToolsShortcut(event: KeyboardEvent): boolean {
  if (event.code === "F12") return true;
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    !event.altKey &&
    event.code === "KeyI"
  );
}

export function consumeShortcut(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
