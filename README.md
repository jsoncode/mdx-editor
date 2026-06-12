# MDX 编辑器

基于 **Tauri 2 + React + TypeScript** 的桌面文档编辑器。将 Markdown 正文与媒体资源打包为单个 `.mdx` 文件，便于分发、备份与版本管理；同时支持纯 `.md` 文件编辑。

[![GitHub](https://img.shields.io/github/stars/jsoncode/mdx-editor?style=social)](https://github.com/jsoncode/mdx-editor)

---

## 目录

- [功能特性](#功能特性)
- [MDX 文件格式](#mdx-文件格式)
- [环境要求](#环境要求)
- [从源码开发](#从源码开发)
- [编译与打包](#编译与打包)
- [安装](#安装)
- [使用说明](#使用说明)
- [偏好设置](#偏好设置)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [常见问题](#常见问题)
- [参与贡献](#参与贡献)

---

## 功能特性

| 类别 | 说明 |
|------|------|
| 编辑 | 双栏布局：CodeMirror Markdown 编辑 + GFM 实时预览 |
| 工作区 | 左侧文件树浏览工作区，支持 `.md` / `.mdx` 文档与文件夹 |
| 欢迎页 | 无工作区或未打开文档时显示 VS Code 风格开始页：打开/新建工作区、打开/新建文件、最近记录 |
| 媒体 | 支持插入、拖拽、粘贴图片 / 视频 / 音频；大文件走系统剪贴板路径拷贝 |
| 附件 | 无法内嵌预览的文件（PDF、Office 等）以附件链接形式插入，可用系统默认程序打开 |
| 格式 | 同时支持 `.mdx`（单文件打包）与 `.md`（纯 Markdown）；保存 `.md` 时可选择另存为 MDX 或继续保存为 MD |
| 保存 | 防抖自动保存、未保存关闭提示、窗口尺寸记忆 |
| 历史修改 | 每次手动保存记录 Markdown 行级 diff，随文档存储；可查看变更、清空历史 |
| 文件属性 | 记录创建/修改时间；可选记录设备信息与地理位置（默认关闭） |
| 资源管理 | 从文档中删除引用后，保存时自动清理 `asset/` 中未使用的文件 |
| 文件树菜单 | 右键文件/文件夹：打开、重命名、删除、查看信息、在资源管理器中显示、复制路径；文件夹可新建文档/子文件夹 |
| 历史 | 独立「最近文档」页，按月份分组浏览 |
| 导出 | 导出为 Markdown（含 asset 目录）或 HTML |
| 系统集成 | 安装后关联 `.mdx`，双击即可打开；单实例运行，已打开时再双击会切换到新文件 |

---

## MDX 文件格式

`.mdx` 本质是一个 **ZIP 压缩包**，标准目录结构如下：

```text
document.mdx (ZIP)
├── index.md          # GFM Markdown 正文
├── manifest.json     # 文档元数据（标题、时间、可选设备/位置等）
├── versions.json     # 保存历史（行级 diff，随文档分享）
└── asset/            # 媒体与附件
    ├── a1b2c3d4.png
    └── e5f6g7h8.mp4
```

### 纯 Markdown（`.md`）配套文件

编辑 `.md` 时，历史与扩展元数据以 **sidecar** 形式保存在同目录：

| 文件 | 说明 |
|------|------|
| `文档名.md.versions.json` | 保存历史（行级 diff） |
| `文档名.md.manifest.json` | 扩展元数据（创建/修改时间、可选设备/位置） |

### manifest.json 字段

| 字段 | 说明 |
|------|------|
| `title` | 文档标题 |
| `created_at` | 创建时间（ISO 8601） |
| `modified_at` | 最后修改时间 |
| `device_info` | 可选，设备信息（需在设置中开启） |
| `location` | 可选，经纬度（需在设置中开启并授权定位） |

### 正文中的资源引用示例

```markdown
# 我的文档

![示意图](asset/a1b2c3d4.png)

[演示视频.mp4](asset/e5f6g7h8.mp4)

[📎 设计稿.pdf](asset/f9a0b1c2.pdf)
```

| 类型 | 插入方式 | 预览表现 |
|------|----------|----------|
| 图片 | `![](asset/xxx.png)` | 内联显示 |
| 视频 / 音频 | `[文件名](asset/xxx.mp4)` | 播放器控件 |
| 附件 | `[📎 文件名](asset/xxx.pdf)` | 可点击，确认后用外部程序打开 |

> **说明**：本项目中的 `.mdx` 为**单文件打包格式**，与 Web 生态中的 MDX（React 组件语法）不同，请勿混淆。

---

## 环境要求

### 运行已编译安装包

- **Windows 10/11**（x64）  
- 其他平台需自行编译（当前安装包配置以 Windows 为主）

### 从源码编译

| 工具 | 版本建议 |
|------|----------|
| [Node.js](https://nodejs.org/) | 18+（推荐 LTS） |
| [Rust](https://www.rust-lang.org/tools/install) | 1.77+（`rustup` 安装 stable） |
| 系统依赖 | Windows： [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 通常已内置）、[Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含「使用 C++ 的桌面开发」） |

安装 Rust 后验证：

```bash
node -v
npm -v
rustc --version
cargo --version
```

---

## 从源码开发

### 1. 克隆仓库

```bash
git clone git@github.com:jsoncode/mdx-editor.git
cd mdx-editor
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发模式

```bash
npm run tauri dev
```

将同时启动 Vite 前端（`http://localhost:1420`）与 Tauri 桌面窗口，支持热更新。

### 4. 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 仅启动前端（浏览器调试 UI） |
| `npm run build` | 编译 TypeScript 并打包前端到 `dist/` |
| `npm run tauri dev` | 开发模式运行桌面应用 |
| `npm run tauri build` | 生产构建并生成安装包 |

### 5. Rust 侧单独编译（可选）

```bash
cd src-tauri
cargo build
cargo test
```

---

## 编译与打包

在项目根目录执行：

```bash
npm run tauri build
```

首次编译会下载 Rust 依赖，耗时较长，属正常现象。

### 构建产物（Windows）

| 类型 | 路径 |
|------|------|
| 可执行文件 | `src-tauri/target/release/mdx-editor.exe` |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/MDX 编辑器_0.1.3_x64-setup.exe` |
| MSI 安装包 | `src-tauri/target/release/bundle/msi/` |

版本号以 `src-tauri/tauri.conf.json` 与 `package.json` 中的 `version` 为准。

---

## 安装

### 方式一：安装包（推荐）

1. 运行 `MDX 编辑器_*_x64-setup.exe`（或 MSI 安装包）
2. 按向导完成安装（安装界面为简体中文）
3. 安装完成后，`.mdx` 文件将关联到 **MDX 编辑器**
4. 双击任意 `.mdx` 文件即可打开

> **注意**：开发模式（`npm run tauri dev`）**不会**注册系统文件关联，文件关联仅在安装版中生效。

### 方式二：便携运行

直接使用编译后的 `mdx-editor.exe`，通过应用内「文件 → 打开」选择文档。

---

## 使用说明

### 界面概览

- **欢迎页**：启动后若无工作区或未打开文档，显示开始页（打开/新建工作区、打开/新建文件、最近记录、快捷键提示）
- **工作区侧栏**：打开工作区后，左侧显示 `.md` / `.mdx` 文件树，点击打开文档；右键可执行文件/文件夹操作
- **功能区**：顶部 Office 风格 Ribbon，分为「文件」「插入」「视图」等标签页
- **状态栏**：显示当前文件路径与保存状态（已保存 / 未保存 / 保存中）

### 基本流程

```text
打开工作区或文档 → 编辑 Markdown → 插入媒体 → 自动保存 / Ctrl+S → 查看历史 / 导出 / 关闭
```

1. **工作区**  
   - 欢迎页或 文件 → 打开工作区，选择文件夹作为工作区根目录  
   - 侧栏文件树中点击 `.md` / `.mdx` 打开文档  
   - 右键文件夹可新建文档或子文件夹  

2. **新建 / 打开文档**  
   - 文件 → 新建 / 打开，或欢迎页快捷入口  
   - 支持 `.mdx` 与 `.md`；拖放、命令行启动参数同样支持两种格式  

3. **保存**  
   - `Ctrl+S` 或 文件 → 保存  
   - 编辑 `.md` 时首次保存会询问：**另存为 MDX** 或 **保存为 MD**  
   - 手动保存会追加一条「历史修改」记录（不含 asset 变更）  

4. **历史修改**  
   - 文件 → 历史修改：查看每次保存的行级 diff  
   - 可将历史随 MDX 打包或 `.md` sidecar 一起分享  
   - 支持清空当前文档的全部历史  

5. **文件属性**  
   - 文件 → 文件属性：查看创建/修改时间、设备信息、地理位置等  

6. **插入资源**  
   - 功能区「插入」选择文件  
   - 将文件拖入编辑区  
   - 从资源管理器复制文件后在编辑区 `Ctrl+V`  

7. **查找替换**：视图 → 查找，或 `Ctrl+F`  

8. **最近文档**：文件 → 最近，进入按月份分组的历史列表  

9. **导出**：文件 → 导出 Markdown / HTML  

### 文件树右键菜单

| 对象 | 操作 |
|------|------|
| 文件 | 打开、重命名、删除、查看信息、在资源管理器中显示、复制路径 |
| 文件夹 | 新建文档、新建子文件夹、重命名、删除、查看信息、在资源管理器中显示、复制路径 |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存 |
| `Ctrl+F` | 打开查找面板 |
| `Esc` | 关闭查找面板 |

### 关闭与未保存提示

关闭窗口时若有未保存更改，会提示：**保存**、**不保存** 或 **取消**。

---

## 偏好设置

通过 **文件 → 设置** 打开偏好对话框：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| 撤销 / 重做步数 | 编辑器内 `Ctrl+Z` / `Ctrl+Y` 可回溯的步数 | 50 |
| 历史修改步数 | 保留的保存 diff 条数上限 | 50 |
| 记录设备信息 | 保存时在 manifest 中写入设备信息 | 关闭 |
| 记录地理位置 | 保存时尝试写入经纬度（需系统授权） | 关闭 |

关闭「设备信息」或「地理位置」后，下次保存会从 manifest 中清除对应字段。

---

## 项目结构

```text
mdx-editor/
├── src/                    # React 前端
│   ├── components/         # UI（编辑器、预览、Ribbon、欢迎页、设置等）
│   ├── hooks/              # 业务 Hook（自动保存、工作区菜单等）
│   ├── stores/             # Zustand 状态（文档、工作区、设置等）
│   └── lib/                # 工具库（diff 历史、元数据、导出等）
├── src-tauri/              # Tauri / Rust 后端
│   ├── src/
│   │   ├── mdx/            # MDX 打包 / 解包
│   │   ├── commands/       # Tauri 命令（文档、工作区、历史等）
│   │   ├── manifest.rs     # manifest 读写
│   │   ├── manifest_io.rs  # .md sidecar manifest
│   │   ├── versions.rs     # 保存历史读写
│   │   └── vault.rs        # 工作区与资源管理
│   ├── capabilities/       # 权限配置
│   └── tauri.conf.json     # 应用与安装包配置
├── package.json
└── README.md
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | [Tauri 2](https://v2.tauri.app/) |
| 前端 | React 19、TypeScript、Vite |
| 编辑器 | CodeMirror 6、@uiw/react-codemirror |
| 预览 | react-markdown、remark-gfm、rehype-raw |
| Diff | diff（行级变更对比） |
| 状态 | Zustand |
| 后端 | Rust（zip 打包、文件系统、剪贴板） |

---

## 常见问题

**Q：双击 `.mdx` 没有打开编辑器？**  
A：请确认已通过安装包安装，而非仅运行 `tauri dev`。可在文件属性中将打开方式设为「MDX 编辑器」。

**Q：`.md` 和 `.mdx` 有什么区别？**  
A：`.mdx` 将正文、媒体、元数据与保存历史打包为单个 ZIP 文件；`.md` 为纯文本，历史与扩展元数据以同目录 sidecar 文件保存。保存 `.md` 时可选择升级为 `.mdx`。

**Q：历史修改记录存在哪里？**  
A：MDX 文档内为 `versions.json`；`.md` 文档为 `文件名.md.versions.json`。分享文档时请一并带上 sidecar 文件（若使用 `.md`）。

**Q：粘贴视频/大文件失败？**  
A：请从资源管理器**复制文件**后粘贴，不要只复制文件内容。应用会通过系统剪贴板读取文件路径并拷贝到 `asset/`。

**Q：删除文档里的图片后，文件体积没变小？**  
A：需触发保存或等待自动保存（约 3 秒无编辑），才会清理未引用的 `asset` 并重新打包。

**Q：地理位置为什么没记录？**  
A：需在设置中开启「记录地理位置」，并允许系统/WebView 定位权限；获取失败时不会写入 `location` 字段。

**Q：编译报错缺少 link.exe？**  
A：请安装 Visual Studio Build Tools，并勾选「使用 C++ 的桌面开发」。

---

## 参与贡献

欢迎提交 Issue 与 Pull Request。

1. Fork 本仓库  
2. 创建特性分支：`git checkout -b feature/your-feature`  
3. 提交更改：`git commit -m "描述你的改动"`  
4. 推送分支：`git push origin feature/your-feature`  
5. 发起 Pull Request  

提交前请确保：

```bash
npm run build
cd src-tauri && cargo test
```

---

## 相关链接

- 仓库：<https://github.com/jsoncode/mdx-editor>
- Tauri 文档：<https://v2.tauri.app/>

---

如有问题或建议，欢迎在 [Issues](https://github.com/jsoncode/mdx-editor/issues) 中反馈。
