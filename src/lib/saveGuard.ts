import { invoke } from "@tauri-apps/api/core";
import { flushEditorContentToStore, getEditorFlushStats } from "./editorContent";
import { useDocumentStore } from "../stores/documentStore";

/** 保存刚结束时忽略误触发的 CloseRequested（仅用于窗口 X 事件，不拦截用户主动退出） */
const POST_SAVE_SPURIOUS_CLOSE_MS = 500;

let saveDepth = 0;
let ignoreCloseUntil = 0;

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
    logSaveGuard("begin", this.getDebugInfo());
  },

  end() {
    saveDepth = Math.max(0, saveDepth - 1);
    if (saveDepth === 0) {
      ignoreCloseUntil = Date.now() + POST_SAVE_SPURIOUS_CLOSE_MS;
    }
    logSaveGuard("end", this.getDebugInfo());
  },

  isActive(): boolean {
    return saveDepth > 0;
  },

  /** 保存进行中时阻止关闭 */
  shouldBlockClose(): boolean {
    if (saveDepth > 0) return true;
    if (useDocumentStore.getState().saveStatus === "saving") return true;
    return false;
  },

  /** 保存完成后极短窗口内忽略系统误发的 CloseRequested */
  shouldIgnoreSpuriousClose(): boolean {
    return Date.now() < ignoreCloseUntil;
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
      ignoreCloseUntil,
      ignoreCloseMsLeft: Math.max(0, ignoreCloseUntil - Date.now()),
      isActive: this.isActive(),
      shouldBlockClose: this.shouldBlockClose(),
      shouldIgnoreSpuriousClose: this.shouldIgnoreSpuriousClose(),
    };
  },
};
