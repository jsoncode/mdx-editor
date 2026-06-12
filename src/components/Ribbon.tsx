import { useDocumentActions } from "../hooks/useDocumentActions";
import { saveGuard } from "../lib/saveGuard";
import { diag, diagSaveCloseState } from "../lib/diagnosticLog";
import { useVaultActions } from "../hooks/useVaultActions";
import { isPlainMdPath } from "../lib/documentPaths";
import { useDocumentStore } from "../stores/documentStore";
import { useVaultStore } from "../stores/vaultStore";
import { useUiStore } from "../stores/uiStore";
import {
  IconExport,
  IconImage,
  IconMedia,
  IconHistory,
  IconNew,
  IconOpen,
  IconPrint,
  IconRecent,
  IconSave,
  IconSearch,
  LayoutToggle,
  RibbonMenu,
  RibbonMenuItem,
  RibbonQuickButton,
} from "./ribbon/RibbonParts";

interface RibbonProps {
  previewHtml: string;
  onPrint: () => void;
}

export function Ribbon({ previewHtml, onPrint }: RibbonProps) {
  const setAppView = useUiStore((s) => s.setAppView);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setLayoutMode = useUiStore((s) => s.setLayoutMode);
  const showSettings = useUiStore((s) => s.showSettings);
  const showHistory = useUiStore((s) => s.showHistory);
  const setPropertiesOpen = useUiStore((s) => s.setPropertiesOpen);
  const appView = useUiStore((s) => s.appView);
  const searchOpen = useUiStore((s) => s.searchOpen);
  const layoutMode = useUiStore((s) => s.layoutMode);

  const filePath = useDocumentStore((s) => s.filePath);
  const saveStatus = useDocumentStore((s) => s.saveStatus);
  const isPlainMdDocument = filePath != null && isPlainMdPath(filePath);

  const actions = useDocumentActions(previewHtml);
  const { handleOpenVault, handleCloseVault } = useVaultActions();
  const sidebarOpen = useVaultStore((s) => s.sidebarOpen);
  const setSidebarOpen = useVaultStore((s) => s.setSidebarOpen);
  const vaultPath = useVaultStore((s) => s.vaultPath);

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

  const openWelcomePage = () => {
    useUiStore.getState().showWelcome();
    setSearchOpen(false);
  };

  const openHistoryPage = () => {
    setSearchOpen(false);
    showHistory();
  };

  const openEditor = () => setAppView("editor");
  const isEditorView = appView === "editor";

  const triggerSave = () => {
    diag("shortcut", "save_button_click");
    diagSaveCloseState("before_save_button");
    saveGuard.runSaveTask(async () => {
      await actions.handleSave();
      diagSaveCloseState("after_save_button");
    });
  };

  return (
    <header className="ribbon">
      <div className="ribbon-bar">
        <nav className="ribbon-menus" aria-label="主菜单">
          <RibbonMenu label="文件">
            <RibbonMenuItem label="新建" icon={<IconNew />} onClick={() => void actions.handleNew()} />
            <RibbonMenuItem label="打开" icon={<IconOpen />} onClick={() => void actions.handleOpen()} />
            {isEditorView && (
              <>
                <RibbonMenuItem label="保存" icon={<IconSave />} onClick={triggerSave} />
                <RibbonMenuItem label="另存为" icon={<IconSave />} onClick={() => void actions.handleSaveAs()} />
              </>
            )}
            <div className="ribbon-menu-divider" role="separator" />
            <RibbonMenuItem label="最近文档" icon={<IconRecent />} onClick={openRecentPage} />
            {isEditorView && !isPlainMdDocument && (
              <RibbonMenuItem
                label="文件属性"
                icon={<IconRecent />}
                onClick={() => {
                  setPropertiesOpen(true);
                }}
              />
            )}
            {isEditorView && (
              <>
                <div className="ribbon-menu-divider" role="separator" />
                <RibbonMenuItem label="导出 Markdown" icon={<IconExport />} onClick={() => void actions.handleExportMarkdown()} />
                <RibbonMenuItem label="导出 HTML" icon={<IconExport />} onClick={() => void actions.handleExportHtml()} />
                <div className="ribbon-menu-divider" role="separator" />
                <RibbonMenuItem label="打印" icon={<IconPrint />} onClick={onPrint} />
              </>
            )}
          </RibbonMenu>

          <RibbonMenu label="工作区">
            <RibbonMenuItem
              label={vaultPath ? "切换工作区" : "打开工作区"}
              icon={<IconOpen />}
              onClick={() => void handleOpenVault()}
            />
            <RibbonMenuItem
              label={sidebarOpen ? "隐藏文档树" : "显示文档树"}
              icon={<IconRecent />}
              onClick={() => {
                openEditor();
                setSidebarOpen(!sidebarOpen);
              }}
            />
            {vaultPath && (
              <RibbonMenuItem
                label="关闭工作区"
                icon={<IconOpen />}
                onClick={() => void handleCloseVault()}
              />
            )}
          </RibbonMenu>

          {isEditorView && (
            <RibbonMenu label="插入">
              <RibbonMenuItem label="图片" icon={<IconImage />} onClick={() => void actions.handleInsertImage()} />
              <RibbonMenuItem label="音视频" icon={<IconMedia />} onClick={() => void actions.handleInsertMedia()} />
            </RibbonMenu>
          )}

          <RibbonMenu label="视图">
            <RibbonMenuItem label="开始页" icon={<IconRecent />} onClick={openWelcomePage} />
            {isEditorView && (
              <RibbonMenuItem
                label={searchOpen ? "关闭查找" : "查找"}
                icon={<IconSearch />}
                onClick={() => setSearchOpen(!searchOpen)}
              />
            )}
            <RibbonMenuItem label="最近文档" icon={<IconRecent />} onClick={openRecentPage} />
          </RibbonMenu>

          <RibbonMenu label="设置">
            <RibbonMenuItem
              label="偏好设置"
              icon={<IconRecent />}
              onClick={() => {
                setSearchOpen(false);
                showSettings();
              }}
            />
          </RibbonMenu>
        </nav>

        {isEditorView && (
          <div className="ribbon-quick-actions" aria-label="快捷操作">
            <RibbonQuickButton
              label="保存"
              icon={<IconSave />}
              title="保存 (Ctrl+S)"
              onClick={triggerSave}
            />
            {!isPlainMdDocument && (
              <RibbonQuickButton
                label="历史修改"
                icon={<IconHistory />}
                title="查看历史修改"
                onClick={openHistoryPage}
              />
            )}
          </div>
        )}

        {isEditorView && (
          <LayoutToggle
            mode={layoutMode}
            onChange={(mode) => {
              setLayoutMode(mode);
            }}
          />
        )}

        <div className="ribbon-status">
          {filePath && <span className="file-path">{filePath}</span>}
          {isEditorView && (
            <span className={`save-status status-${saveStatus}`}>{statusText}</span>
          )}
        </div>
      </div>
    </header>
  );
}
