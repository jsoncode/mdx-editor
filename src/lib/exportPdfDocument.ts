import { PDF_DOCUMENT_STYLES } from "./exportPdfDocumentStyles";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 生成可在隐藏 WebView 中直接打印的完整 HTML 文档 */
export function buildPdfExportDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>${PDF_DOCUMENT_STYLES}</style>
</head>
<body>
  <article class="markdown-preview pdf-export-body">
${bodyHtml}
  </article>
  <script>
    window.__pdfExportReady = (function () {
      function fitVideoPosters() {
        var maxWidth = document.documentElement.clientWidth || document.body.clientWidth;
        document.querySelectorAll(".pdf-video-cover img").forEach(function (img) {
          var naturalWidth = img.naturalWidth;
          var naturalHeight = img.naturalHeight;
          if (!naturalWidth || !naturalHeight) return;
          var width = naturalWidth;
          var height = naturalHeight;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          img.setAttribute("width", String(width));
          img.setAttribute("height", String(height));
          img.style.width = width + "px";
          img.style.height = height + "px";
        });
      }
      function waitImages() {
        var pending = Array.prototype.filter.call(document.images, function (img) {
          return !img.complete;
        });
        if (pending.length === 0) return Promise.resolve();
        return Promise.all(
          pending.map(function (img) {
            return new Promise(function (resolve) {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            });
          }),
        );
      }
      function prepareForPrint() {
        return waitImages().then(function () {
          fitVideoPosters();
        });
      }
      if (document.readyState === "complete") return prepareForPrint();
      return new Promise(function (resolve) {
        window.addEventListener(
          "load",
          function () {
            prepareForPrint().then(resolve);
          },
          { once: true },
        );
      });
    })();
  </script>
</body>
</html>`;
}
