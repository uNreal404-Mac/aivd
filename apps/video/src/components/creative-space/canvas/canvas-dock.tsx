"use client";

import { Bookmark, Crosshair, Folder, FolderInput, History, Magnet, Music2, Plus, Settings2, Upload } from "lucide-react";
import type { CanvasKind } from "@/lib/creative-space/canvas-graph";
import { KIND_LABEL, kindIcon } from "./canvas-nodes";
import { CanvasFloatingPanel } from "./canvas-floating-panel";

export type CanvasPanel = "add" | "assets" | "history" | "sounds" | "locate" | "settings";
const tools = [
  ["add", Plus, "添加元素", "Add elements"],
  ["assets", Folder, "我的资产", "My assets"],
  ["import", FolderInput, "导入站内素材", "Import site media"],
  ["history", History, "生成历史", "Generation history"],
  ["sounds", Music2, "音效库", "Sound library"],
  ["locate", Crosshair, "节点定位", "Find a node"],
  ["settings", Settings2, "画布设置", "Canvas settings"],
] as const;

export function CanvasDock({
  zh,
  open,
  onPanel,
  snap,
  onSnap,
  onCreate,
  onUpload,
  onTemplates,
  onImport,
}: {
  zh: boolean;
  open: CanvasPanel | null;
  onPanel: (panel: CanvasPanel | null) => void;
  snap: boolean;
  onSnap: () => void;
  onCreate: (kind: CanvasKind) => void;
  onUpload: () => void;
  onTemplates: () => void;
  onImport: () => void;
}) {
  const done = (action: () => void) => {
    onPanel(null);
    action();
  };
  return (
    <div className="nc-dock-wrap">
      {open === "add" && (
        <CanvasFloatingPanel id="nc-add-elements" title={zh ? "添加元素" : "Add elements"} onClose={() => onPanel(null)} className="nc-add-floating" width={240}>
          {(["text", "image", "video", "audio", "agent", "group"] as const).map((kind) => {
            const Icon = kindIcon(kind);
            return (
              <button type="button" key={kind} onClick={() => done(() => onCreate(kind))}>
                <Icon size={17} />
                {KIND_LABEL[kind][zh ? "zh" : "en"]}
              </button>
            );
          })}
          <hr />
          <button type="button" onClick={() => done(onUpload)}>
            <Upload size={17} />
            {zh ? "上传素材" : "Upload media"}
          </button>
          <button type="button" onClick={() => done(onTemplates)}>
            <Bookmark size={17} />
            {zh ? "工作流模板" : "Workflow templates"}
          </button>
        </CanvasFloatingPanel>
      )}
      <nav className="nc-dock" aria-label={zh ? "画布工具" : "Canvas tools"}>
        {tools.map(([key, Icon, cn, en]) => (
          <button
            type="button"
            key={key}
            data-tool={key}
            title={zh ? cn : en}
            aria-label={zh ? cn : en}
            aria-controls={key === "add" ? "nc-add-elements" : undefined}
            aria-expanded={key === "import" ? undefined : open === key}
            onClick={() => key === "import" ? onImport() : onPanel(open === key ? null : key)}
          >
            <Icon size={18} />
          </button>
        ))}
        <button
          type="button"
          title={zh ? "自动吸附" : "Snap to grid"}
          aria-label={zh ? "自动吸附" : "Snap to grid"}
          aria-pressed={snap}
          onClick={onSnap}
        >
          <Magnet size={17} />
        </button>
      </nav>
    </div>
  );
}
