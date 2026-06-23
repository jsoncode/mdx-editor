import { usePdfExportStore } from "../stores/pdfExportStore";

export function PdfExportStatus() {
  const exporting = usePdfExportStore((s) => s.exporting);
  const statusMessage = usePdfExportStore((s) => s.statusMessage);

  if (!exporting) {
    return null;
  }

  return (
    <div className="pdf-export-status-overlay" aria-live="polite" role="status">
      {statusMessage ?? "正在导出 PDF…"}
    </div>
  );
}
