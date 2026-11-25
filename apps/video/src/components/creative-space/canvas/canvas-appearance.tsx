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
export function appearanceStyle(colors: MiniColors, background: string): CSSProperties {
  const variables: Record<string, string> = {};
  for (const kind of kinds) variables[`--du-canvas-mini-${kind}`] = colors[kind] || `var(${palette[kind][2]})`;
  return { ...variables, backgroundImage: background ? `url("${background}")` : undefined };
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

export function CanvasAppearance({ zh, background, save, colors, setColors }: {
  zh: boolean;
  background: string;
  save: (data: string) => void;
  colors: MiniColors;
  setColors: (value: MiniColors) => void;
}) {
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<MiniColors>({});
  const element = useRef<HTMLFieldSetElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  useEffect(() => {
    if (element.current) {
      const computed = getComputedStyle(element.current);
      setTheme(Object.fromEntries(kinds.map((kind) => [kind, computed.getPropertyValue(palette[kind][2]).trim()])));
    }
    return () => { revision.current += 1; };
  }, []);
  async function pick(image: File) {
    const version = ++revision.current;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type) || image.size > maxFileBytes) {
      setError(zh ? "请选择 5 MB 以内的 PNG、JPG 或 WebP。" : "Choose a PNG, JPG or WebP of 5 MB or less.");
      return;
    }
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
      if (revision.current === version) save(data);
    } catch {
      if (revision.current === version) setError(zh ? "无法保存这张背景图，请换用更小的图片或检查浏览器存储空间。" : "Could not save this background. Try a smaller image or check browser storage.");
    } finally {
      bitmap?.close();
    }
  }
  return <>
    <label>{zh ? "自定义背景" : "Background image"}
      <button type="button" onClick={() => file.current?.click()}>{background ? (zh ? "更换图片" : "Replace image") : (zh ? "选择图片" : "Choose image")}</button>
      <input type="file" hidden ref={file} accept="image/png,image/jpeg,image/webp" onChange={(e) => {
        const selected = e.target.files?.[0];
        e.target.value = "";
        if (selected) void pick(selected);
      }} />
    </label>
    {background && <button type="button" onClick={() => {
      revision.current += 1;
      try { save(""); setError(""); } catch { setError(zh ? "无法清除浏览器保存的背景" : "Could not clear the saved background"); }
    }}>{zh ? "恢复默认背景" : "Restore default background"}</button>}
    {error && <p role="alert">{error}</p>}
    <fieldset ref={element} className="nc-mini-colors">
      <legend>{zh ? "极简模式节点配色" : "Simple view node colours"}</legend>
      {kinds.filter((kind) => theme[kind]).map((kind) => <label key={kind}>{palette[kind][zh ? 0 : 1]}
        <input type="color" aria-label={zh ? `${palette[kind][0]}节点颜色` : `${palette[kind][1]} node colour`} value={colors[kind] || theme[kind]} onChange={(e) => setColors({ ...colors, [kind]: e.target.value })} />
      </label>)}
      {Object.keys(colors).length > 0 && <button type="button" onClick={() => setColors({})}>{zh ? "恢复默认配色" : "Restore default colours"}</button>}
    </fieldset>
  </>;
}
