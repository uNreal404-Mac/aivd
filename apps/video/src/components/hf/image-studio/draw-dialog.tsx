"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2, Paintbrush, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { uploadErrorText, uploadImage, validateImageFile } from "@/lib/image-to-video";
import { localizedHref } from "@/lib/locale-path";

export function DrawDialog({ open, onClose, locale, userId, signIn }: {
  open: boolean; onClose: () => void; locale: string; userId?: string; signIn: () => void;
}) {
  const zh = locale.startsWith("zh");
  const [action, setAction] = useState<"inpaint" | "animate">("inpaint");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = async (file: File) => {
    if (busy.current || !userId) return;
    const invalid = validateImageFile(file, locale);
    if (invalid) { setError(invalid); return; }
    busy.current = true;
    setUploading(true);
    setError("");
    try {
      const result = await uploadImage(file, fetch, userId);
      if (!mounted.current) return;
      if (!result.ok) { setError(uploadErrorText(result, zh)); return; }
      sessionStorage.setItem("aivd:canvas-handoff", JSON.stringify({
        kind: "image", ownerId: userId, key: result.key, url: result.url, model: file.name, editAction: action,
      }));
      window.location.assign(localizedHref(locale, "/creative-space/canvas"));
    } catch {
      setError(zh ? "无法打开这张图，请重试。" : "Could not open this image. Try again.");
    } finally {
      setUploading(false);
      busy.current = false;
    }
  };
  const edit = action === "inpaint";
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !busy.current) onClose(); }}>
      <DialogContent className="is-draw-dialog">
        <div className="is-draw-modes">
          <button type="button" aria-pressed={!edit} disabled={uploading} onClick={() => setAction("animate")}><Film />{zh ? "图生视频" : "Image to video"}</button>
          <button type="button" aria-pressed={edit} disabled={uploading} onClick={() => setAction("inpaint")}><Paintbrush />{zh ? "局部重绘" : "Draw to edit"}</button>
        </div>
        <div className="is-draw-body">
          <img src={edit ? "/home/samples/studio-room.webp" : "/home/samples/rain-couple.webp"} alt="" />
          <DialogTitle>{edit ? zh ? "局部重绘" : "Draw to edit" : zh ? "图生视频" : "Image to video"}</DialogTitle>
          <DialogDescription>{edit ? zh ? "上传图片，涂出需要改动的区域。" : "Upload an image and brush over the area you want to change." : zh ? "上传起始画面，再描述镜头如何移动。" : "Upload a starting frame, then describe the motion."}</DialogDescription>
          {error ? <output>{error}</output> : null}
          <button type="button" className="is-draw-upload" disabled={uploading} onClick={() => userId ? input.current?.click() : signIn()}>
            {uploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus />}{uploading ? zh ? "上传中…" : "Uploading…" : zh ? "上传图片" : "Upload image"}
          </button>
          {uploading ? <output aria-live="polite">{zh ? "图片正在上传，完成后会自动打开画布" : "Uploading the image. The canvas will open when it is ready."}</output> : null}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => { const file=e.target.files?.[0]; e.target.value=""; if(file) void load(file); }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
