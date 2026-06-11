import { useEffect, useRef } from "react";
import { useDocumentStore } from "../stores/documentStore";

const AUTOSAVE_DELAY_MS = 3000;

export function useAutosave() {
  const content = useDocumentStore((s) => s.content);
  const isDirty = useDocumentStore((s) => s.isDirty);
  const workspaceId = useDocumentStore((s) => s.workspaceId);
  const autosaveDocument = useDocumentStore((s) => s.autosaveDocument);
  const syncContent = useDocumentStore((s) => s.syncContent);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!workspaceId || !isDirty) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void autosaveDocument();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, isDirty, workspaceId, autosaveDocument]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty) {
        void syncContent();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDirty, syncContent]);
}
