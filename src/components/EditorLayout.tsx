import { Group, Panel, Separator } from "react-resizable-panels";
import { useVaultStore } from "../stores/vaultStore";
import { SplitEditor } from "./SplitEditor";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function EditorLayout() {
  const sidebarOpen = useVaultStore((s) => s.sidebarOpen);
  const setSidebarOpen = useVaultStore((s) => s.setSidebarOpen);

  return (
    <div className="editor-layout">
      <Group orientation="horizontal" id="mdx-workspace-layout">
        {sidebarOpen && (
          <>
            <Panel defaultSize={22} minSize={15} maxSize={40} id="workspace-sidebar-panel">
              <WorkspaceSidebar />
            </Panel>
            <Separator className="resize-handle workspace-resize-handle" />
          </>
        )}
        <Panel minSize={40} id="editor-main-panel">
          <SplitEditor />
        </Panel>
      </Group>
      {!sidebarOpen && (
        <button
          type="button"
          className="sidebar-reopen-btn"
          title="显示文档树"
          aria-label="显示文档树"
          onClick={() => setSidebarOpen(true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 4h12M2 8h8M2 12h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
