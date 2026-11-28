"use client";

import { Check, FolderInput, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { uploadImage } from "@/lib/image-to-video";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import "./canvas-import-action.css";

export type CanvasImportSource =
  | { type: "upload"; key: string }
  | { type: "generation"; uuid: string; index: number }
  | { type: "local"; file: File };

type CanvasChoice = { id: string; name: string };

export function CanvasImportAction({ source, locale, userId, className, label }: {
  source: CanvasImportSource;
  locale: string;
  userId?: string;
  className?: string;
  label?: boolean;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const [open, setOpen] = useState(false);
  const [canvases, setCanvases] = useState<CanvasChoice[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, saving]);
  const begin = async () => {
    if (!userId) { signIn.onOpen(); return; }
    setOpen(true); setLoading(true); setError(""); setDone(""); setSelected("");
    try {
      const response = await fetch("/api/v1/creative-space/workflows", { cache: "no-store", headers: { "X-Media-Account": userId } });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.data?.workflows)) throw new Error(zh ? "画布列表加载失败，请重试。" : "Could not load canvases. Try again.");
      setCanvases(body.data.workflows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoading(false); }
  };
  const submit = async () => {
    if (!userId || saving || loading || (canvases.length && !selected)) return;
    setSaving(true); setError("");
    try {
      let serverSource: Exclude<CanvasImportSource, { type: "local" }> | { type: "canvas-upload"; key: string };
      if (source.type === "local") {
        if (source.file.type.startsWith("video/")) {
          const uploaded = await uploadWorkflowVideo(source.file, fetch, userId, "canvas");
          serverSource = { type: "canvas-upload", key: uploaded.key };
        } else {
          const uploaded = await uploadImage(source.file, fetch, userId, "canvas");
          if (!uploaded.ok) throw new Error(zh ? "图片上传失败，请重试。" : "Image upload failed. Try again.");
          serverSource = { type: "canvas-upload", key: uploaded.key };
        }
      } else serverSource = source;
      const response = await fetch("/api/v1/creative-space/import", {
        method: "POST", headers: { "content-type": "application/json", "X-Media-Account": userId },
        body: JSON.stringify({ source: serverSource, ...(selected ? { canvasId: selected } : {}), locale: zh ? "zh" : "en",
          ...(!selected ? { nextCanvasNumber: (() => { try { return Math.max(1, Number(localStorage.getItem(`aivd:node-canvas:next-number:${userId}`)) + 1 || 1); } catch { return 1; } })() } : {}) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? (zh ? "导入失败，请重试。" : "Import failed. Try again."));
      if (!selected && body.data.canvasId) {
        try {
          const number = Number(/^(?:画布|Canvas\s+)(\d+)$/i.exec(body.data.canvasName)?.[1]);
          if (number > 0) localStorage.setItem(`aivd:node-canvas:next-number:${userId}`, String(number));
          localStorage.setItem(`aivd:node-canvas:last:${userId}`, body.data.canvasId);
        } catch { /* browser storage is optional */ }
      }
      setDone(zh ? `已导入「${body.data.canvasName}」` : `Imported into “${body.data.canvasName}”`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSaving(false); }
  };
  const title = zh ? "导入画布" : "Import to canvas";
  return <>
    <button type="button" className={className ?? "sr-icon"} title={title} aria-label={title} onClick={() => void begin()}>
      <FolderInput size={16} aria-hidden="true" />{label ? <span>{title}</span> : null}
    </button>
    {open && typeof document !== "undefined" ? createPortal(<div className="cim-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <dialog open className="cim-dialog" aria-modal="true" aria-label={title}>
        <header><div><small>INFINITE CANVAS</small><h2>{title}</h2></div><button type="button" aria-label={zh ? "关闭" : "Close"} onClick={() => setOpen(false)} disabled={saving}><X size={18} /></button></header>
        {done ? <output className="cim-success"><Check size={22} /><strong>{done}</strong><span>{zh ? "素材副本已存入画布素材库，并放到选定画布中。" : "A copy is in the canvas library and on your selected canvas."}</span></output> : <>
          <p className="cim-note">{zh ? "选择要放入的画布。原素材和生成结果会保留在原位置。" : "Choose a canvas. The original media stays in your library."}</p>
          <div className="cim-list">{loading ? <p className="cim-loading"><Loader2 size={17} className="cim-spin" />{zh ? "读取画布中…" : "Loading canvases…"}</p> : canvases.length ? canvases.map((item) => <label key={item.id} className={selected === item.id ? "is-selected" : ""}><input type="radio" name="canvas-import-target" checked={selected === item.id} onChange={() => setSelected(item.id)} /><span>{item.name}</span>{selected === item.id && <Check size={16} />}</label>) : !error ? <p className="cim-empty">{zh ? "还没有画布。导入时将自动创建「画布1」。" : "No canvas yet. A new canvas will be created for this import."}</p> : null}</div>
          {error && <p className="cim-error" role="alert">{error}</p>}
          <footer><button type="button" onClick={() => setOpen(false)} disabled={saving}>{zh ? "取消" : "Cancel"}</button><button type="button" className="cim-primary" disabled={loading || saving || (canvases.length > 0 && !selected)} onClick={() => void submit()}>{saving ? <><Loader2 size={16} className="cim-spin" />{zh ? "导入中…" : "Importing…"}</> : zh ? "确认导入" : "Import"}</button></footer>
        </>}
        {done && <footer><button type="button" className="cim-primary" onClick={() => setOpen(false)}>{zh ? "完成" : "Done"}</button></footer>}
      </dialog>
    </div>, document.body) : null}
  </>;
}
