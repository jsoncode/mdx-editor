import { invoke } from "@tauri-apps/api/core";
import { useDocumentStore } from "../stores/documentStore";
import { useEditorStore } from "../stores/editorStore";
import { useUiStore } from "../stores/uiStore";
import { saveGuard } from "./saveGuard";

const SESSION_ID = crypto.randomUUID().slice(0, 8);

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

function serializeDetail(detail?: Record<string, unknown>): string {
  if (!detail) return JSON.stringify({ sessionId: SESSION_ID });
  try {
    return JSON.stringify({ sessionId: SESSION_ID, ...detail });
  } catch {
    return JSON.stringify({ sessionId: SESSION_ID, detail: String(detail) });
  }
}

export function diag(
  category: string,
  event: string,
  detail?: Record<string, unknown>,
  level: LogLevel = "info",
) {
  const payload = serializeDetail(detail);
  if (import.meta.env.DEV) {
    const printer =
      level === "error" || level === "fatal"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    printer(`[diag:${category}] ${event}`, detail ?? "");
  }
  void invoke("diagnostic_log", { category, level, event, detail: payload }).catch(() => undefined);
}

export function diagSaveCloseState(label: string, extra?: Record<string, unknown>) {
  const doc = useDocumentStore.getState();
  const editor = useEditorStore.getState();
  const ui = useUiStore.getState();
  const editorDocLen = editor.view?.state.doc.length ?? null;

  diag("state", label, {
    appView: ui.appView,
    saveStatus: doc.saveStatus,
    isDirty: doc.isDirty,
    workspaceId: doc.workspaceId,
    filePath: doc.filePath,
    contentLen: doc.content.length,
    savedContentLen: doc.savedContent.length,
    contentChanged: doc.content !== doc.savedContent,
    editorAttached: editor.view != null,
    editorDocLen,
    editorStoreMismatch: editorDocLen != null && editorDocLen !== doc.content.length,
    saveGuard: saveGuard.getDebugInfo(),
    ...extra,
  });
}

export function installDiagnosticHandlers() {
  window.addEventListener("error", (event) => {
    diag(
      "runtime",
      "uncaught_error",
      {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      },
      "error",
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    diag(
      "runtime",
      "unhandled_rejection",
      {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      },
      "error",
    );
  });

  window.addEventListener("beforeunload", () => {
    diagSaveCloseState("beforeunload");
  });

  document.addEventListener("visibilitychange", () => {
    diag("lifecycle", "visibilitychange", { hidden: document.hidden });
  });

  diag("lifecycle", "frontend_boot", {
    userAgent: navigator.userAgent,
    href: window.location.href,
  });
}

export async function getDiagnosticLogDir(): Promise<string> {
  return invoke<string>("get_diagnostic_log_dir");
}

export async function readDiagnosticLogTail(lines = 80): Promise<string> {
  return invoke<string>("read_diagnostic_log_tail", { lines });
}

export async function openDiagnosticLogDir(): Promise<void> {
  await invoke("open_diagnostic_log_dir");
}
