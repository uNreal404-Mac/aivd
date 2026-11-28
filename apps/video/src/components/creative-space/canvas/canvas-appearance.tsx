"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { CanvasData } from "@/lib/creative-space/canvas-graph";

const palette = {
  text: ["文字", "Text", "--du-pin-blue"],
  media: ["素材", "Asset", "--du-accent"],
  image: ["图片", "Image", "--du-success"],
  video: ["视频", "Video", "--du-pin-purple"],
  audio: ["音频", "Audio", "--du-warning"],
  agent: ["助手", "Agent", "--du-danger"],
  group: ["分组", "Group", "--du-text"],
} as const satisfies Record<CanvasData["kind"], readonly string[]>;
type Kind = keyof typeof palette;
const kinds = Object.keys(palette) as Kind[];
export type MiniColors = Partial<Record<Kind, string>>;
const isColor = (value: unknown): value is string => typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
export function readMiniColors(raw: unknown): MiniColors {
  const result: MiniColors = {};
  if (raw && typeof raw === "object") {
    for (const kind of kinds) {
      const color = (raw as MiniColors)[kind];
      if (isColor(color)) result[kind] = color;
    }
  }
  return result;
}
export function appearanceStyle(colors: MiniColors): CSSProperties {
  const variables: Record<string, string> = {};
  for (const kind of kinds) variables[`--du-canvas-mini-${kind}`] = colors[kind] || `var(${palette[kind][2]})`;
  return variables as CSSProperties;
}

const backgroundKey = "aivd:canvas:background:v1";
const maxFileBytes = 5 * 1024 * 1024;
const maxDataLength = 900_000;
const validBackground = (value: string | null) => Boolean(value && value.length <= maxDataLength && /^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value));
export function useCanvasBackground() {
  const [value, setValue] = useState("");
  useEffect(() => {
    try {
      const previous = localStorage.getItem(backgroundKey);
      if (previous && validBackground(previous)) setValue(previous);
    } catch { /* Private browsing can disable storage. */ }
  }, []);
  const save = (data: string) => {
    if (data) localStorage.setItem(backgroundKey, data);
    else localStorage.removeItem(backgroundKey);
    setValue(data);
  };
  return [value, save] as const;
}

export function CanvasAppearance({ zh, background, save, options, change, images }: {
  zh: boolean;
  background: string;
  save: (data: string) => void;
  options: import("./canvas-view").CanvasViewOptions;
  change: (partial: Partial<import("./canvas-view").CanvasViewOptions>) => void;
  images: { name: string; url: string }[];
}) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  async function pick(image: Blob) {
    const version = ++revision.current;
    setError("");
    if (![ "image/png", "image/jpeg", "image/webp" ].includes(image.type) || image.size > maxFileBytes) {
      setError(zh ? "请选择 5 MB 以内的 PNG、JPG 或 WebP。" : "Choose a PNG, JPG or WebP of 5 MB or less.");
      return;
    }
    setProcessing(true);
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(image);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) throw Error();
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encode = (quality: number) => {
        const webp = canvas.toDataURL("image/webp", quality);
        return webp.startsWith("data:image/webp;") ? webp : canvas.toDataURL("image/jpeg", quality);
      };
      let data = encode(0.78);
      if (data.length > maxDataLength) data = encode(0.45);
      if (!validBackground(data)) throw Error();
      if (revision.current === version) { save(data); change({ backgroundEnabled: true }); }
    } catch {
      if (revision.current === version) setError(zh ? "无法保存这张背景图，请换用更小的图片。" : "Could not save this background. Try a smaller image.");
    } finally {
      bitmap?.close();
      if (revision.current === version) setProcessing(false);
    }
  }
  const fromCanvas = async (url: string) => {
    setProcessing(true); setError("");
    try {
      const response = await fetch(url);
      if (!response.ok) throw Error();
      await pick(await response.blob());
    } catch { setError(zh ? "无法读取这张画布图片，请稍后重试。" : "Could not read this canvas image."); }
    finally { setProcessing(false); }
  };
  const l = (cn: string, en: string) => zh ? cn : en;
  return <div className="ncc-background">
    <label className="ncc-control ncc-toggle"><span>{l("启用背景图", "Enable background image")}</span><input type="checkbox" checked={options.backgroundEnabled && Boolean(background)} disabled={!background} onChange={(event) => change({ backgroundEnabled: event.target.checked })} /></label>
    <div className="ncc-control"><span>{l("背景图片", "Background image")}</span><div className="ncc-background-pick">
      <button type="button" disabled={processing} onClick={() => file.current?.click()}>{processing ? l("处理中…", "Processing…") : l("上传图片", "Upload image")}</button>
      <select aria-label={l("从画布选择图片", "Choose an image from canvas")} value="" disabled={processing || !images.length} onChange={(event) => { if (event.target.value) void fromCanvas(event.target.value); }}>
        <option value="">{l("从画布选择", "Choose from canvas")}</option>
        {images.map((item, index) => <option key={index} value={item.url}>{item.name}</option>)}
      </select>
      <input type="file" hidden ref={file} accept="image/png,image/jpeg,image/webp" onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ""; if (selected) void pick(selected); }} />
    </div></div>
    {background && <button type="button" className="ncc-background-remove" onClick={() => { revision.current += 1; save(""); change({ backgroundEnabled: false }); }}>{l("移除背景图片", "Remove background image")}</button>}
    <label className="ncc-control ncc-slider"><span>{l("不透明度", "Opacity")}</span><input type="range" min="0" max="1" step="0.05" value={options.backgroundOpacity} onChange={(event) => change({ backgroundOpacity: Number(event.target.value) })} /><output>{Math.round(options.backgroundOpacity * 100)}%</output></label>
    <label className="ncc-control ncc-slider"><span>{l("模糊度", "Blur")}</span><input type="range" min="0" max="24" value={options.backgroundBlur} onChange={(event) => change({ backgroundBlur: Number(event.target.value) })} /><output>{options.backgroundBlur}px</output></label>
    <div className="ncc-control"><span>{l("显示方式", "Display mode")}</span><div className="ncc-segments">{(["cover", "contain", "repeat"] as const).map((mode, index) =>
      <button type="button" key={mode} aria-pressed={options.backgroundMode === mode} onClick={() => change({ backgroundMode: mode })}>{[l("铺满", "Cover"), l("适应", "Fit"), l("平铺", "Tile")][index]}</button>)}</div></div>
    <label className="ncc-control ncc-slider"><span>{l("平铺大小", "Tile size")}</span><input type="range" min="0.5" max="2" step="0.1" value={options.backgroundTileScale} disabled={options.backgroundMode !== "repeat"} onChange={(event) => change({ backgroundTileScale: Number(event.target.value) })} /><output>{Math.round(options.backgroundTileScale * 100)}%</output></label>
    {error && <p className="ncc-error" role="alert">{error}</p>}
  </div>;
}
