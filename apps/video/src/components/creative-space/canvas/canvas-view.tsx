"use client";

import { ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "reactflow";
import { CanvasDialog } from "./canvas-overlays";
import { CanvasAppearance, type MiniColors, readMiniColors } from "./canvas-appearance";

export interface CanvasViewOptions {
  grid: boolean;
  gridSize: number;
  delaySubmit: boolean;
  miniColors: MiniColors;
  wheelPan: boolean;
  alignGuides: boolean;
  dragSelect: boolean;
  colorWires: boolean;
  backdrop: "dark" | "slate" | "graphite";
  toolbarScale: number;
  focusWires: boolean;
  snap: boolean;
  simple: boolean;
  speed: number;
  boost: number;
}

const defaults: CanvasViewOptions = {
  grid: true,
  gridSize: 20,
  delaySubmit: false,
  miniColors: {},
  wheelPan: true,
  alignGuides: true,
  dragSelect: true,
  colorWires: false,
  backdrop: "dark",
  toolbarScale: 1,
  focusWires: false,
  snap: false,
  simple: true,
  speed: 1,
  boost: 2.5,
};
const preferenceKey = "aivd:canvas:view-options:v1";
export function useCanvasViewOptions() {
  const [options, setOptions] = useState(defaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}");
      const next = { ...defaults };
      for (const key of [
        "grid",
        "delaySubmit",
        "wheelPan",
        "focusWires",
        "snap",
        "simple",
        "alignGuides",
        "dragSelect",
        "colorWires",
      ] as const) {
        if (typeof raw?.[key] === "boolean") next[key] = raw[key];
      }
      if ([12, 16, 20, 24, 32].includes(raw?.gridSize)) next.gridSize = raw.gridSize;
      next.miniColors = readMiniColors(raw?.miniColors);
      if (["dark", "slate", "graphite"].includes(raw?.backdrop)) next.backdrop = raw.backdrop;
      if (Number.isFinite(raw?.toolbarScale)) next.toolbarScale = Math.max(0.75, Math.min(1.25, raw.toolbarScale));
      if (Number.isFinite(raw?.speed)) next.speed = Math.max(0.25, Math.min(3, raw.speed));
      if (Number.isFinite(raw?.boost)) next.boost = Math.max(1, Math.min(5, raw.boost));
      setOptions(next);
    } catch {
      /* Defaults also work with storage disabled. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(options));
      } catch {
        /* Keep this session's preferences. */
      }
    }
  }, [options, ready]);
  return [options, setOptions] as const;
}

export function CanvasViewMenu({
  zh,
  options,
  change,
  background,
  saveBackground,
  settingsOpen,
  closeSettings,
}: {
  settingsOpen: boolean;
  closeSettings: () => void;
  zh: boolean;
  options: CanvasViewOptions;
  change: (partial: Partial<CanvasViewOptions>) => void;
  background: string;
  saveBackground: (value: string) => void;
}) {
  const flow = useReactFlow();
  const zoom = useStore((state) => Math.round(state.transform[2] * 100));
  const [open, setOpen] = useState<"zoom" | null>(null);
  const [section, setSection] = useState("interaction");
  useEffect(() => {
    if (settingsOpen) {
      setOpen(null);
      setSection("interaction");
    }
  }, [settingsOpen]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const label = (a: string, b: string) => (zh ? a : b);
  return (
    <>
      <div ref={ref} className="nc-view-menu">
        <button
          type="button"
          onClick={() => setOpen(open === "zoom" ? null : "zoom")}
          aria-expanded={open === "zoom"}
          aria-label={label("缩放菜单", "Zoom menu")}
        >
          <ZoomIn size={14} /> {zoom}%
        </button>
        {open === "zoom" && (
          <div className="nc-view-sheet">
            <label>
              {label("缩放", "Zoom")} <output>{zoom}%</output>
              <input
                type="range"
                min={10}
                max={300}
                value={zoom}
                onChange={(e) => flow.zoomTo(Number(e.target.value) / 100)}
              />
            </label>
            {[50, 100].map((pct) => (
              <button key={pct} type="button" onClick={() => flow.zoomTo(pct / 100)}>
                {label("缩放至", "Zoom to")} {pct}%
              </button>
            ))}
            <button type="button" onClick={() => flow.fitView({ padding: 0.15, maxZoom: 1.5 })}>
              {label("适合屏幕", "Fit to screen")}
            </button>
            <label>
              {label("快捷键灵敏度", "Keyboard sensitivity")} <output>{Math.round(options.speed * 100)}%</output>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.25}
                value={options.speed}
                onChange={(e) => change({ speed: Number(e.target.value) })}
              />
            </label>
            <label>
              {label("按住 Shift 加速", "Shift multiplier")} <output>×{options.boost}</output>
              <input
                type="range"
                min={1}
                max={5}
                step={0.5}
                value={options.boost}
                onChange={(e) => change({ boost: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
      </div>
      {settingsOpen && (
        <CanvasDialog title={label("自定义画布", "Canvas settings")} onClose={closeSettings} wide>
          <div className="nc-settings">
            <nav aria-label={label("设置分类", "Settings categories")}>
              {(
                [
                  ["interaction", "交互操作", "Interaction"],
                  ["wires", "连线设置", "Connections"],
                  ["grid", "网格与显示", "Grid & display"],
                  ["layout", "节点与布局", "Nodes & layout"],
                  ["appearance", "背景与配色", "Background & colours"],
                ] as const
              ).map(([id, cn, en]) => (
                <button type="button" key={id} aria-pressed={id === section} onClick={() => setSection(id)}>
                  {label(cn, en)}
                </button>
              ))}
            </nav>
            <section className="nc-preferences">
              {section === "interaction" && (
                <>
                  <label>
                    {label("滚轮操作", "Mouse wheel")}
                    <select
                      value={options.wheelPan ? "pan" : "zoom"}
                      onChange={(e) => change({ wheelPan: e.target.value === "pan" })}
                    >
                      <option value="pan">{label("平移", "Pan")}</option>
                      <option value="zoom">{label("缩放", "Zoom")}</option>
                    </select>
                  </label>
                  {(
                    [
                      ["snap", label("拖拽吸附网格", "Snap to grid")],
                      ["alignGuides", label("对齐辅助线", "Alignment guides")],
                      ["dragSelect", label("拖动节点获取焦点", "Select nodes when dragging")],
                      ["delaySubmit", label("图像和视频延迟 3 秒提交", "Delay image/video submission by 3s")],
                    ] as const
                  ).map(([key, title]) => (
                    <label key={key}>
                      {title}
                      <input
                        type="checkbox"
                        checked={options[key]}
                        onChange={(e) => change({ [key]: e.target.checked })}
                      />
                    </label>
                  ))}
                </>
              )}
              {section === "wires" && (
                <>
                  <label>
                    {label("按素材类型区分线色", "Colour by media type")}
                    <input
                      type="checkbox"
                      checked={options.colorWires}
                      onChange={(e) => change({ colorWires: e.target.checked })}
                    />
                  </label>
                  <label>
                    {label("仅显示焦点连线", "Show selected nodes’ wires")}
                    <input
                      type="checkbox"
                      checked={options.focusWires}
                      onChange={(e) => change({ focusWires: e.target.checked })}
                    />
                  </label>
                </>
              )}
              {section === "grid" && (
                <>
                  <label>
                    {label("显示点阵", "Show dot grid")}
                    <input
                      type="checkbox"
                      checked={options.grid}
                      onChange={(e) => change({ grid: e.target.checked })}
                    />
                  </label>
                  <label>
                    {label("网格间距", "Grid spacing")}
                    <select
                      value={options.gridSize}
                      onChange={(e) => change({ gridSize: Number(e.target.value) })}
                    >
                      {[12, 16, 20, 24, 32].map((n) => (
                        <option key={n} value={n}>
                          {n} px
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {label("画布底色", "Canvas colour")}
                    <select
                      value={options.backdrop}
                      onChange={(e) => change({ backdrop: e.target.value as CanvasViewOptions["backdrop"] })}
                    >
                      <option value="dark">{label("深黑", "Dark")}</option>
                      <option value="slate">{label("石板", "Slate")}</option>
                      <option value="graphite">{label("石墨", "Graphite")}</option>
                    </select>
                  </label>
                </>
              )}
              {section === "layout" && (
                <>
                  <label>
                    {label("低于 14% 使用极简视图", "Simplify below 14%")}
                    <input
                      type="checkbox"
                      checked={options.simple}
                      onChange={(e) => change({ simple: e.target.checked })}
                    />
                  </label>
                  <label>
                    {label("节点下方工具栏大小", "Node toolbar size")}
                    <output>{Math.round(options.toolbarScale * 100)}%</output>
                    <input
                      type="range"
                      min={0.75}
                      max={1.25}
                      step={0.05}
                      value={options.toolbarScale}
                      onChange={(e) => change({ toolbarScale: Number(e.target.value) })}
                    />
                  </label>
                </>
              )}
              {section === "appearance" && (
                <CanvasAppearance
                  zh={zh}
                  colors={options.miniColors}
                  setColors={(miniColors) => change({ miniColors })}
                  background={background}
                  save={saveBackground}
                />
              )}
            </section>
          </div>
        </CanvasDialog>
      )}
    </>
  );
}
