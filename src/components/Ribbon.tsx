import { useDocumentActions } from "../hooks/useDocumentActions";
import { useDocumentStore } from "../stores/documentStore";
import { useUiStore, type RibbonTab } from "../stores/uiStore";
import {
  IconExport,
  IconImage,
  IconMedia,
  IconNew,
  IconOpen,
  IconRecent,
  IconSave,
  IconSearch,
  RibbonButton,
  RibbonGroup,
} from "./ribbon/RibbonParts";

interface RibbonProps {
  previewHtml: string;
}

const TABS: { id: RibbonTab; label: string }[] = [
  { id: "file", label: "文件" },
  { id: "insert", label: "插入" },
  { id: "view", label: "视图" },
];

export function Ribbon({ previewHtml }: RibbonProps) {
  const ribbonTab = useUiStore((s) => s.ribbonTab);
  const setRibbonTab = useUiStore((s) => s.setRibbonTab);
  const setAppView = useUiStore((s) => s.setAppView);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const searchOpen = useUiStore((s) => s.searchOpen);

  const filePath = useDocumentStore((s) => s.filePath);
  const saveStatus = useDocumentStore((s) => s.saveStatus);

  const actions = useDocumentActions(previewHtml);

  const statusText =
    saveStatus === "saving"
      ? "保存中..."
      : saveStatus === "dirty"
        ? "未保存更改"
        : saveStatus === "saved"
          ? "已保存"
          : "";

  const openRecentPage = () => {
    setAppView("recent");
    setSearchOpen(false);
  };

  return (
    <header className="ribbon">
      <div className="ribbon-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ribbon-tab${ribbonTab === tab.id ? " active" : ""}`}
            onClick={() => setRibbonTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div className="ribbon-status">
          {filePath && <span className="file-path">{filePath}</span>}
          <span className={`save-status status-${saveStatus}`}>{statusText}</span>
        </div>
      </div>

      <div className="ribbon-panel">
        {ribbonTab === "file" && (
          <>
            <RibbonGroup label="文档">
              <RibbonButton label="新建" icon={<IconNew />} onClick={() => void actions.handleNew()} />
              <RibbonButton label="打开" icon={<IconOpen />} onClick={() => void actions.handleOpen()} />
              <RibbonButton label="保存" icon={<IconSave />} onClick={() => void actions.handleSave()} />
              <RibbonButton label="另存为" icon={<IconSave />} onClick={() => void actions.handleSaveAs()} />
            </RibbonGroup>
            <RibbonGroup label="历史">
              <RibbonButton label="最近" icon={<IconRecent />} onClick={openRecentPage} />
            </RibbonGroup>
            <RibbonGroup label="导出">
              <RibbonButton label="Markdown" icon={<IconExport />} onClick={() => void actions.handleExportMarkdown()} />
              <RibbonButton label="HTML" icon={<IconExport />} onClick={() => void actions.handleExportHtml()} />
            </RibbonGroup>
          </>
        )}

        {ribbonTab === "insert" && (
          <RibbonGroup label="媒体">
            <RibbonButton label="图片" icon={<IconImage />} onClick={() => void actions.handleInsertImage()} />
            <RibbonButton label="音视频" icon={<IconMedia />} onClick={() => void actions.handleInsertMedia()} />
          </RibbonGroup>
        )}

        {ribbonTab === "view" && (
          <RibbonGroup label="查找">
            <RibbonButton
              label={searchOpen ? "关闭查找" : "查找"}
              icon={<IconSearch />}
              onClick={() => setSearchOpen(!searchOpen)}
            />
            <RibbonButton label="最近文档" icon={<IconRecent />} onClick={openRecentPage} />
          </RibbonGroup>
        )}
      </div>
    </header>
  );
}
