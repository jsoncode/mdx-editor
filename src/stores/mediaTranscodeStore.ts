import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type {
  MediaTranscodeJob,
  MediaTranscodeProgressEvent,
} from "../types/mediaTranscode";

interface MediaTranscodeStore {
  jobs: MediaTranscodeJob[];
  panelOpen: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  upsertJob: (event: MediaTranscodeProgressEvent) => void;
  registerJob: (job: MediaTranscodeJob) => void;
  openPanel: () => void;
  minimizePanel: () => void;
  /** 关闭弹窗并清空已结束的任务（用户点击「确定」） */
  finishPanel: () => void;
}

function applyProgressEvent(
  jobs: MediaTranscodeJob[],
  event: MediaTranscodeProgressEvent,
): MediaTranscodeJob[] {
  const next = [...jobs];
  const index = next.findIndex((job) => job.id === event.jobId);
  const existing = index >= 0 ? next[index] : undefined;
  const done = event.phase === "done" || event.phase === "error";
  const updated: MediaTranscodeJob = {
    id: event.jobId,
    fileName: event.fileName,
    phase: event.phase,
    percent: event.percent ?? existing?.percent,
    message: event.message ?? existing?.message,
    error: event.phase === "error" ? event.message ?? "转码失败" : existing?.error,
    done,
  };
  if (index >= 0) {
    next[index] = updated;
  } else {
    next.push(updated);
  }
  return next;
}

let listenerReady: Promise<void> | null = null;

export const useMediaTranscodeStore = create<MediaTranscodeStore>((set, get) => ({
  jobs: [],
  panelOpen: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    if (!listenerReady) {
      listenerReady = listen<MediaTranscodeProgressEvent>(
        "media-transcode-progress",
        (event) => {
          get().upsertJob(event.payload);
        },
      ).then(() => undefined);
    }
    await listenerReady;
    set({ initialized: true });
  },

  upsertJob: (event) => {
    const jobs = applyProgressEvent(get().jobs, event);
    const allDone = jobs.length > 0 && jobs.every((job) => job.done);
    const panelOpen = get().panelOpen;
    set({
      jobs: allDone && !panelOpen ? [] : jobs,
    });
  },

  registerJob: (job) => {
    set((state) => ({
      jobs: [...state.jobs.filter((item) => item.id !== job.id), job],
      panelOpen: true,
    }));
  },

  openPanel: () => set({ panelOpen: true }),

  minimizePanel: () => set({ panelOpen: false }),

  finishPanel: () => {
    set({ panelOpen: false, jobs: [] });
  },
}));

export function getActiveTranscodeJobs(): MediaTranscodeJob[] {
  return useMediaTranscodeStore.getState().jobs.filter((job) => !job.done);
}
