import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/** 构建预览用 remark 插件链（GFM + 可选单行换行） */
export function buildRemarkPlugins(singleLineBreaks: boolean) {
  if (singleLineBreaks) {
    return [remarkGfm, remarkBreaks];
  }
  return [remarkGfm];
}
