"use client";

import { Bookmark, Crosshair, Folder, History, Magnet, Music2, Plus, Settings2, Upload, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CanvasKind } from "@/lib/creative-space/canvas-graph";
import { KIND_LABEL, kindIcon } from "./canvas-nodes";

export type CanvasPanel = "add" | "assets" | "history" | "sounds" | "locate" | "settings";
const tools = [
  ["add", Plus, "添加元素", "Add elements"],
  ["assets", Folder, "我的资产", "My assets"],
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
}: {
  zh: boolean;
  open: CanvasPanel | null;
  onPanel: (panel: CanvasPanel | null) => void;
  snap: boolean;
  onSnap: () => void;
  onCreate: (kind: CanvasKind) => void;
  onUpload: () => void;
  onTemplates: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open !== "add") return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !(event.target as Element).closest(".nc-empty-start"))
        onPanel(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onPanel(null);
        addButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open, onPanel]);
  const done = (action: () => void) => {
    onPanel(null);
    action();
  };
  return (
    <div ref={root} className="nc-dock-wrap">
      {open === "add" && (
        <section className="nc-dock-flyout" aria-label={zh ? "添加节点" : "Add nodes"}>
          <header>
            <strong>{zh ? "添加元素" : "Add elements"}</strong>
            <button type="button" aria-label={zh ? "关闭" : "Close"} onClick={() => onPanel(null)}>
              <X size={14} />
            </button>
          </header>
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
        </section>
      )}
      <nav className="nc-dock" aria-label={zh ? "画布工具" : "Canvas tools"}>
        {tools.map(([key, Icon, cn, en]) => (
          <button
            type="button"
            ref={key === "add" ? addButton : undefined}
            key={key}
            data-tool={key}
            title={zh ? cn : en}
            aria-label={zh ? cn : en}
            aria-expanded={open === key}
            onClick={() => onPanel(open === key ? null : key)}
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
