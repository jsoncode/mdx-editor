import { invoke } from "@tauri-apps/api/core";
import { flushEditorContentToStore, getEditorFlushStats } from "./editorContent";
import { useDocumentStore } from "../stores/documentStore";

/** 保存完成后继续屏蔽关闭操作的时长（Windows 保存后可能误发 CloseRequested） */
const POST_SAVE_CLOSE_GUARD_MS = 15000;

let saveDepth = 0;
let suppressCloseUntil = 0;

function logSaveGuard(event: string, detail: Record<string, unknown>, level = "info") {
  void invoke("diagnostic_log", {
    category: "saveGuard",
    level,
    event,
    detail: JSON.stringify(detail),
  }).catch(() => undefined);
}

export const saveGuard = {
  begin() {
    saveDepth += 1;
    suppressCloseUntil = Date.now() + POST_SAVE_CLOSE_GUARD_MS;
    logSaveGuard("begin", this.getDebugInfo());
  },

  end() {
    saveDepth = Math.max(0, saveDepth - 1);
    suppressCloseUntil = Date.now() + POST_SAVE_CLOSE_GUARD_MS;
    logSaveGuard("end", this.getDebugInfo());
  },

  isActive(): boolean {
    return saveDepth > 0;
  },

  shouldBlockClose(): boolean {
    if (saveDepth > 0) return true;
    if (Date.now() < suppressCloseUntil) return true;
    if (useDocumentStore.getState().saveStatus === "saving") return true;
    return false;
  },

  /** 同步启动保存会话（必须在任何 await 之前调用） */
  startSaveSession() {
    this.begin();
    const flushed = flushEditorContentToStore();
    logSaveGuard(
      "startSaveSession",
      { flushed, ...getEditorFlushStats() },
      flushed ? "info" : "warn",
    );
  },

  /** 包装一次完整的保存流程（键盘/按钮入口） */
  runSaveTask(task: () => Promise<void>) {
    this.startSaveSession();
    void task().finally(() => {
      this.end();
    });
  },

  getDebugInfo() {
    return {
      saveDepth,
      suppressCloseUntil,
      suppressCloseMsLeft: Math.max(0, suppressCloseUntil - Date.now()),
      isActive: this.isActive(),
      shouldBlockClose: this.shouldBlockClose(),
    };
  },
};
