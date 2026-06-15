export type MediaTranscodePhase =
  | "starting"
  | "transcoding"
  | "saving"
  | "done"
  | "error";

export interface MediaTranscodeProgressEvent {
  jobId: string;
  fileName: string;
  phase: MediaTranscodePhase;
  percent?: number | null;
  message?: string | null;
}

export interface MediaTranscodeJob {
  id: string;
  fileName: string;
  phase: MediaTranscodePhase;
  percent?: number;
  message?: string;
  error?: string;
  done: boolean;
}
