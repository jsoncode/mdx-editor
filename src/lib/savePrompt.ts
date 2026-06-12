import { ask } from "@tauri-apps/plugin-dialog";

export type PlainMdSaveChoice = "mdx" | "md";

export async function promptPlainMdSaveChoice(): Promise<PlainMdSaveChoice> {
  const saveAsMdx = await ask(
    "当前为 Markdown (.md) 文件。是否另存为 MDX 格式？\n\nMDX 可将图片等资源打包进单一文件；选择「保存为 MD」则仅写入纯 Markdown 文本。",
    {
      title: "保存文档",
      kind: "info",
      okLabel: "另存为 MDX",
      cancelLabel: "保存为 MD",
    },
  );
  return saveAsMdx ? "mdx" : "md";
}
