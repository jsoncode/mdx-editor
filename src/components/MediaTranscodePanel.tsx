import { useEffect } from "react";
import { describeTranscodeFormats } from "../lib/media";
import { FfmpegErrorDetails } from "./FfmpegErrorDetails";
import { useMediaTranscodeStore } from "../stores/mediaTranscodeStore";
import type { MediaTranscodeJob } from "../types/mediaTranscode";

function phaseLabel(job: MediaTranscodeJob): string {
  if (job.phase === "error") return "";
  if (job.message) return job.message;
  switch (job.phase) {
    case "starting":
      return "准备中…";
    case "transcoding":
      return "正在转码…";
    case "saving":
      return "正在写入文档资源…";
    case "done":
      return "已插入文档，可直接预览";
    default:
      return "处理中…";
  }
}

function JobRow({ job }: { job: MediaTranscodeJob }) {
  const percent =
    typeof job.percent === "number" ? Math.max(0, Math.min(100, job.percent)) : null;
  const formatLabel = describeTranscodeFormats(job.fileName);

  return (
    <div className={`media-transcode-job${job.phase === "error" ? " is-error" : ""}`}>
      <div className="media-transcode-job-head">
        <span className="media-transcode-job-name" title={job.fileName}>
          {job.fileName}
        </span>
        {formatLabel ? (
          <span className="media-transcode-job-format">{formatLabel}</span>
        ) : null}
      </div>
      <p className="media-transcode-job-message">
        {job.phase === "error" && job.error ? (
          <FfmpegErrorDetails message={job.error} className="ffmpeg-error-details media-transcode-error" />
        ) : (
          phaseLabel(job)
        )}
      </p>
      {percent !== null || job.done ? (
        <div className="media-transcode-progress-track" aria-hidden="true">
          <div
            className="media-transcode-progress-bar"
            style={{ width: `${job.done ? 100 : percent ?? 0}%` }}
          />
        </div>
      ) : (
        <div className="media-transcode-progress-track is-indeterminate" aria-hidden="true">
          <div className="media-transcode-progress-bar" />
        </div>
      )}
    </div>
  );
}

export function MediaTranscodePanel() {
  const initialize = useMediaTranscodeStore((s) => s.initialize);
  const jobs = useMediaTranscodeStore((s) => s.jobs);
  const panelOpen = useMediaTranscodeStore((s) => s.panelOpen);
  const minimizePanel = useMediaTranscodeStore((s) => s.minimizePanel);
  const finishPanel = useMediaTranscodeStore((s) => s.finishPanel);
  const openPanel = useMediaTranscodeStore((s) => s.openPanel);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const activeJobs = jobs.filter((job) => !job.done);
  const allFinished = jobs.length > 0 && activeJobs.length === 0;

  if (jobs.length === 0) {
    return null;
  }

  if (!panelOpen) {
    if (activeJobs.length === 0) {
      return null;
    }
    return (
      <button
        type="button"
        className="media-transcode-bubble"
        onClick={openPanel}
        aria-label="查看媒体转码进度"
      >
        <span className="media-transcode-bubble-dot" aria-hidden="true" />
        转码中 {activeJobs.length}
      </button>
    );
  }

  return (
    <div className="media-transcode-overlay" role="presentation">
      <div
        className="media-transcode-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-transcode-title"
      >
        <div className="media-transcode-dialog-head">
          <h2 id="media-transcode-title">正在转码媒体</h2>
          {!allFinished ? (
            <button type="button" className="secondary" onClick={minimizePanel}>
              后台继续
            </button>
          ) : null}
        </div>

        <div className="media-transcode-dialog-desc">
          <p>
            您插入的文件含有编辑器无法直接播放的格式。正在借助 FFmpeg 转为通用格式后再写入文档，
            以便在预览区正常播放并随 MDX 一并保存。
          </p>
          <ul className="media-transcode-format-list">
            <li>视频：WMV、AVI、MOV、MKV 等 → <strong>MP4</strong></li>
            <li>音频：WMA、AIFF 等 → <strong>M4A</strong></li>
          </ul>
          {!allFinished ? (
            <p className="media-transcode-dialog-hint">
              可点击「后台继续」关闭此窗口；右下角气泡会继续显示进度。
            </p>
          ) : null}
        </div>

        <div className="media-transcode-job-list">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>

        {allFinished ? (
          <div className="media-transcode-dialog-actions">
            <button type="button" onClick={finishPanel}>
              确定
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
