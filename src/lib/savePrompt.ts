import { ask } from "@tauri-apps/plugin-dialog";

export type PlainMdSaveChoice = "mdx" | "md";

export async function promptPlainMdSaveChoice(): Promise<PlainMdSaveChoice> {
  const saveAsMdx = await ask(
    "当前为可直接保存的文本文件。是否另存为 MDX 格式？\n\nMDX 会扫描正文中的本地图片、附件等资源引用，复制到 asset 并打包进单一文件；选择「保存原格式」则仅写入当前文件。",
    {
      title: "保存文档",
      kind: "info",
      okLabel: "另存为 MDX",
      cancelLabel: "保存原格式",
    },
  );
  return saveAsMdx ? "mdx" : "md";
}
