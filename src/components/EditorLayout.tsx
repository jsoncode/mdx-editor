import { Group, Panel, Separator } from "react-resizable-panels";
import { useVaultStore } from "../stores/vaultStore";
import { SplitEditor } from "./SplitEditor";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

const SIDEBAR_PANEL_ID = "workspace-sidebar-panel";
const EDITOR_PANEL_ID = "editor-main-panel";

export function EditorLayout() {
  const sidebarOpen = useVaultStore((s) => s.sidebarOpen);

  return (
    <div className="editor-layout">
      <Group
        orientation="horizontal"
        id="mdx-workspace-layout"
        resizeTargetMinimumSize={{ coarse: 28, fine: 8 }}
      >
        {sidebarOpen && (
          <>
            <Panel
              id={SIDEBAR_PANEL_ID}
              defaultSize={280}
              minSize={220}
              maxSize="50%"
              className="workspace-sidebar-panel"
            >
              <WorkspaceSidebar />
            </Panel>
            <Separator className="resize-handle workspace-resize-handle" />
          </>
        )}
        <Panel id={EDITOR_PANEL_ID} minSize={400} className="editor-main-panel">
          <SplitEditor />
        </Panel>
      </Group>
    </div>
  );
}
