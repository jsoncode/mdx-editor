interface PendingExportSuccess {
  formatLabel: string;
  path: string;
  resolve: (action: "open" | "close") => void;
}

let pending: PendingExportSuccess | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeExportSuccessPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getExportSuccessPromptPending(): PendingExportSuccess | null {
  return pending;
}

export function requestExportSuccessPrompt(
  path: string,
  formatLabel: string,
): Promise<"open" | "close"> {
  return new Promise((resolve) => {
    pending = { path, formatLabel, resolve };
    notify();
  });
}

export function submitExportSuccessPrompt(action: "open" | "close"): void {
  pending?.resolve(action);
  pending = null;
  notify();
}
