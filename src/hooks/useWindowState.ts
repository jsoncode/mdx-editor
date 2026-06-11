import { useEffect } from "react";
import {
  restoreWindowState,
  setupWindowStatePersistence,
} from "../lib/windowState";

export function useWindowState() {
  useEffect(() => {
    void restoreWindowState();

    const cleanup = setupWindowStatePersistence();
    return cleanup;
  }, []);
}
