/** 独立 PDF 文档样式：无滚动容器，支持 WebView2 自动分页 */
export const PDF_DOCUMENT_STYLES = `
@page {
  size: A4;
  margin: 18mm 16mm;
}

html, body {
  margin: 0;
  padding: 0;
  overflow: visible !important;
  height: auto !important;
  min-height: 0 !important;
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.pdf-export-body {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  overflow: visible !important;
  height: auto !important;
  background: #fff;
}

.pdf-export-body h1,
.pdf-export-body h2,
.pdf-export-body h3,
.pdf-export-body h4,
.pdf-export-body h5,
.pdf-export-body h6 {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  page-break-after: avoid;
  break-after: avoid-page;
}

.pdf-export-body pre {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 6px;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.pdf-export-body code {
  font-family: Consolas, Monaco, monospace;
}

.pdf-export-body table {
  border-collapse: collapse;
  width: 100%;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.pdf-export-body th,
.pdf-export-body td {
  border: 1px solid #ddd;
  padding: 0.5rem;
}

.pdf-export-body blockquote {
  border-left: 4px solid #ddd;
  margin-left: 0;
  padding-left: 1rem;
  color: #555;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.pdf-export-body img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  margin: 0.5rem 0;
  page-break-inside: avoid;
  break-inside: avoid-page;
  object-fit: contain;
}

.pdf-export-body .pdf-video-cover {
  position: relative;
  display: block;
  width: fit-content;
  max-width: 100%;
  margin: 0.5rem 0;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.pdf-export-body .pdf-video-poster {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  margin: 0;
  object-fit: contain;
}

.pdf-export-body .attachment-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  margin: 0.15rem 0;
  border: 1px solid #d6dce5;
  border-radius: 6px;
  background: #f5f8fc;
  color: #2b579a;
  font-size: 13px;
  max-width: 100%;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.pdf-export-body .attachment-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.pdf-export-body .attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-export-body .pdf-audio-static {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 480px;
  min-height: 40px;
  margin: 0.5rem 0;
  padding: 0.35rem 0.65rem;
  border: 1px solid #d6dce5;
  border-radius: 6px;
  background: #f5f8fc;
  color: #2b579a;
  font-size: 13px;
  box-sizing: border-box;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

.pdf-export-body .pdf-video-badge {
  position: absolute;
  left: 0.5rem;
  bottom: 0.5rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
}

.pdf-export-body .pdf-media-fallback {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  border: 1px dashed #c8d4e6;
  border-radius: 6px;
  color: #666;
  font-size: 13px;
  page-break-inside: avoid;
  break-inside: avoid-page;
}

@media print {
  html, body, .pdf-export-body {
    overflow: visible !important;
    height: auto !important;
  }
}
`;
