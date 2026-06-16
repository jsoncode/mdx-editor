import { parseFfmpegError, isStructuredFfmpegError } from "../lib/ffmpegErrors";

export function FfmpegErrorDetails({
  message,
  className = "ffmpeg-error-details",
}: {
  message: string;
  className?: string;
}) {
  if (!isStructuredFfmpegError(message)) {
    return <p className={className}>{message}</p>;
  }

  const parsed = parseFfmpegError(message);

  return (
    <div className={className}>
      <p className="ffmpeg-error-title">{parsed.title}</p>
      {parsed.reason ? (
        <p className="ffmpeg-error-reason">
          <strong>原因：</strong>
          {parsed.reason}
        </p>
      ) : null}
      {parsed.solutions.length > 0 ? (
        <div className="ffmpeg-error-solutions">
          <strong>解决方案：</strong>
          <ol>
            {parsed.solutions.map((solution) => (
              <li key={solution}>{solution}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
