"use client";

import { ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "reactflow";
import { type MiniColors, readMiniColors } from "./canvas-appearance";
import { CanvasCustomize } from "./canvas-customize";

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
  panSensitivity: number;
  focusAnimationLimit: number;
  submitDelaySeconds: number;
  touchRadius: number;
  blankAction: "context" | "double";
  mentionNaming: "name" | "number";
  blurAfterSubmit: boolean;
  shiftEnterSubmit: boolean;
  previewCanvasAssets: boolean;
  videoHoverPlay: boolean;
  notifyCompleted: boolean;
  notifyBrowser: boolean;
  notifySound: boolean;
  notifyTiming: "hidden" | "always";
  notifyFailed: boolean;
  notifyOnlyMine: boolean;
  successSound: string;
  failureSound: string;
  wireWidth: number;
  wireFocusRadius: number;
  wireHoverHighlight: boolean;
  wireAnimate: boolean;
  gridDotSize: number;
  gridGlow: boolean;
  horizontalGap: number;
  verticalGap: number;
  groupPadding: number;
  groupLabelScale: number;
  topToolbarScale: number;
  groupCoverWires: boolean;
  backgroundEnabled: boolean;
  backgroundOpacity: number;
  backgroundBlur: number;
  backgroundMode: "cover" | "contain" | "repeat";
  backgroundTileScale: number;
  themeColor: string;
  wireColor: string;
}

export const canvasViewDefaults: CanvasViewOptions = {
  grid: true,
  gridSize: 34,
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
  panSensitivity: 1.2,
  focusAnimationLimit: 100,
  submitDelaySeconds: 0,
  touchRadius: 150,
  blankAction: "context",
  mentionNaming: "name",
  blurAfterSubmit: false,
  shiftEnterSubmit: false,
  previewCanvasAssets: true,
  videoHoverPlay: true,
  notifyCompleted: true,
  notifyBrowser: false,
  notifySound: false,
  notifyTiming: "hidden",
  notifyFailed: true,
  notifyOnlyMine: true,
  successSound: "clear",
  failureSound: "descending",
  wireWidth: 2,
  wireFocusRadius: 12,
  wireHoverHighlight: true,
  wireAnimate: false,
  gridDotSize: 1.5,
  gridGlow: false,
  horizontalGap: 100,
  verticalGap: 110,
  groupPadding: 80,
  groupLabelScale: 1,
  topToolbarScale: 1,
  groupCoverWires: false,
  backgroundEnabled: true,
  backgroundOpacity: 0.25,
  backgroundBlur: 8,
  backgroundMode: "cover",
  backgroundTileScale: 1,
  themeColor: "",
  wireColor: "#9ca3af",
};
const preferenceKey = "aivd:canvas:view-options:v2";
const legacyPreferenceKey = "aivd:canvas:view-options:v1";
export function useCanvasViewOptions() {
  const [options, setOptions] = useState(canvasViewDefaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(preferenceKey);
      const raw = JSON.parse(saved ?? localStorage.getItem(legacyPreferenceKey) ?? "{}");
      const migrateGrid = saved === null;
      const next = { ...canvasViewDefaults };
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
        "blurAfterSubmit", "shiftEnterSubmit", "previewCanvasAssets", "videoHoverPlay",
        "notifyCompleted", "notifyBrowser", "notifySound", "notifyFailed", "notifyOnlyMine",
        "wireHoverHighlight", "wireAnimate", "gridGlow", "groupCoverWires", "backgroundEnabled",
      ] as const) {
        if (typeof raw?.[key] === "boolean") next[key] = raw[key];
      }
      if (Number.isFinite(raw?.gridSize) && !(migrateGrid && raw.gridSize === 20)) next.gridSize = Math.max(10, Math.min(60, raw.gridSize));
      next.miniColors = readMiniColors(raw?.miniColors);
      if (["dark", "slate", "graphite"].includes(raw?.backdrop)) next.backdrop = raw.backdrop;
      if (Number.isFinite(raw?.toolbarScale)) next.toolbarScale = Math.max(0.75, Math.min(1.25, raw.toolbarScale));
      if (Number.isFinite(raw?.speed)) next.speed = Math.max(0.25, Math.min(3, raw.speed));
      if (Number.isFinite(raw?.boost)) next.boost = Math.max(1, Math.min(5, raw.boost));
      const numeric = {
        panSensitivity: [0.25, 3], focusAnimationLimit: [0, 200], submitDelaySeconds: [0, 5], touchRadius: [40, 250],
        wireWidth: [1, 6], wireFocusRadius: [4, 30], gridDotSize: [1, 5], horizontalGap: [20, 250], verticalGap: [20, 250],
        groupPadding: [30, 200], groupLabelScale: [0.7, 1.6], topToolbarScale: [0.75, 1.4], backgroundOpacity: [0, 1],
        backgroundBlur: [0, 24], backgroundTileScale: [0.5, 2],
      } as const;
      for (const [key, [min, max]] of Object.entries(numeric)) {
        if (Number.isFinite(raw?.[key]) && !(migrateGrid && key === "gridDotSize" && raw[key] === 2)) (next as unknown as Record<string, unknown>)[key] = Math.max(min, Math.min(max, raw[key]));
      }
      if (raw?.delaySubmit && !Number.isFinite(raw?.submitDelaySeconds)) next.submitDelaySeconds = 3;
      if (["context", "double"].includes(raw?.blankAction)) next.blankAction = raw.blankAction;
      if (["name", "number"].includes(raw?.mentionNaming)) next.mentionNaming = raw.mentionNaming;
      if (["hidden", "always"].includes(raw?.notifyTiming)) next.notifyTiming = raw.notifyTiming;
      if (["cover", "contain", "repeat"].includes(raw?.backgroundMode)) next.backgroundMode = raw.backgroundMode;
      if (typeof raw?.successSound === "string") next.successSound = raw.successSound.slice(0, 30);
      if (typeof raw?.failureSound === "string") next.failureSound = raw.failureSound.slice(0, 30);
      if (typeof raw?.themeColor === "string" && /^#[\da-f]{6}$/i.test(raw.themeColor)) next.themeColor = raw.themeColor;
      if (typeof raw?.wireColor === "string" && /^#[\da-f]{6}$/i.test(raw.wireColor)) next.wireColor = raw.wireColor;
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
  showMinimap,
  setShowMinimap,
  images,
}: {
  settingsOpen: boolean;
  closeSettings: () => void;
  zh: boolean;
  options: CanvasViewOptions;
  change: (partial: Partial<CanvasViewOptions>) => void;
  background: string;
  saveBackground: (value: string) => void;
  showMinimap: boolean;
  setShowMinimap: (value: boolean) => void;
  images: { name: string; url: string }[];
}) {
  const flow = useReactFlow();
  const zoom = useStore((state) => Math.round(state.transform[2] * 100));
  const [open, setOpen] = useState<"zoom" | null>(null);
  useEffect(() => {
    if (settingsOpen) {
      setOpen(null);
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
      {settingsOpen && <CanvasCustomize zh={zh} options={options} change={change} background={background} saveBackground={saveBackground} onClose={closeSettings} showMinimap={showMinimap} setShowMinimap={setShowMinimap} images={images} />}
    </>
  );
}
