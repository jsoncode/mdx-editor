import { toggleDevTools } from "./devtools";
import { ensureMainFrameFocus } from "./focusMainFrame";

export async function handleToggleDevTools(): Promise<void> {
  ensureMainFrameFocus();
  try {
    await toggleDevTools();
  } catch (error) {
    console.error("[devtools] 无法打开开发者工具:", error);
  }
}
