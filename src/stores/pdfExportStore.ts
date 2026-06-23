import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { buildPdfExportDocument } from "../lib/exportPdfDocument";
import { preparePdfAssets, renderPdfBodyHtml } from "../lib/exportPdf";
import { useSettingsStore } from "./settingsStore";

interface PdfExportStore {
  exporting: boolean;
  statusMessage: string | null;
  exportDocument: (params: {
    workspaceId: string;
    content: string;
    outputPath: string;
    title: string;
  }) => Promise<void>;
}

export const usePdfExportStore = create<PdfExportStore>((set) => ({
  exporting: false,
  statusMessage: null,

  exportDocument: async ({ workspaceId, content, outputPath, title }) => {
    set({ exporting: true, statusMessage: "正在准备资源…" });
    try {
      const ffmpegPath = useSettingsStore.getState().ffmpegPath;
      const singleLineBreaks = useSettingsStore.getState().markdownSingleLineBreaks;
      const assets = await preparePdfAssets(workspaceId, content, ffmpegPath);
      set({ statusMessage: "正在排版…" });
      const bodyHtml = renderPdfBodyHtml(content, singleLineBreaks, assets);
      const html = buildPdfExportDocument(title, bodyHtml);
      set({ statusMessage: "正在生成 PDF…" });
      await invoke("export_html_to_pdf", { html, outputPath });
    } finally {
      set({ exporting: false, statusMessage: null });
    }
  },
}));
