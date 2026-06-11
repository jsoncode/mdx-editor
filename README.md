# MDX Editor

基于 Tauri 2 的桌面文档编辑器。`.mdx` 文件是 ZIP 容器，内含：

- `index.md` — GFM Markdown 正文
- `asset/` — 图片、视频、音频等媒体资源
- `manifest.json` — 文档元数据

## 功能

- 双栏编辑 / 预览
- 插入、拖拽、粘贴媒体资源
- 自动保存与关闭前未保存提示
- 最近打开文件
- 导出 Markdown（含 asset 目录）与 HTML

## 开发

```bash
npm install
npm run tauri dev
```

## 构建

```bash
npm run tauri build
```

## 文件格式示例

```text
document.mdx (ZIP)
├── index.md
├── asset/
│   └── a1b2c3d4.png
└── manifest.json
```

Markdown 中引用资源：

```markdown
![示意图](asset/a1b2c3d4.png)
```
