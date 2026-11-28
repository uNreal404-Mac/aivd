"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { HomeMediaPicker } from "../home-media-picker";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";
import { uploadErrorText } from "@/lib/image-to-video";
import { KLING_MAX_MIDDLE_FRAMES, maxKlingFrames } from "@/lib/kling-keyframes";
import { changeFrame, frameReferences, ownedFrameKey, type FrameSlot, type StudioFrames } from "@/lib/studio-keyframes";
import type { UploadedVideoReference } from "@/lib/video-references";

export function KeyframeInput({ frames, duration, locale, userId, onChange, onBusy, onError, signIn }: {
  frames: StudioFrames; duration: number; locale: string; userId?: string;
  onChange: (frames: StudioFrames) => void; onBusy: (busy: boolean) => void; onError: (message: string) => void; signIn: () => void;
}) {
  const zh = locale.startsWith("zh");
  const [slot, setSlot] = useState<FrameSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = useRef(frames);
  current.current = frames;
  const count = frameReferences(frames).length;
  const max = maxKlingFrames(duration);
  const middle = frames.middle ?? [];
  const choose = async (items: PickerAsset[]) => {
    const item = items[0];
    if (!item || !userId || slot === null || busy) return;
    const position = slot;
    setBusy(true); onBusy(true);
    try {
      if (!item.mimeType.startsWith("image/")) throw new Error("image");
      const ready = await readyPickerImage(item, userId);
      const key = item.id.startsWith("work:") ? item.id : ready.key;
      if (!ownedFrameKey(key, userId)) throw new Error("owner");
      if (mounted.current) onChange(changeFrame(current.current, position, { ...ready, key }));
    } catch (error) { if (mounted.current) onError(uploadErrorText(error, zh)); }
    finally { if (mounted.current) { setBusy(false); onBusy(false); } }
  };
  const tile = (position: FrameSlot, title: string, item?: UploadedVideoReference) => (
    <div className="vst-frame-tile" key={position}>
      <button type="button" className="vst-frame-pick" disabled={busy || (!item && count >= max)}
        aria-label={`${item ? zh ? "替换" : "Replace " : zh ? "添加" : "Add "}${title}`}
        onClick={() => { if (!userId) signIn(); else setSlot(position); }}>
        {item ? <img src={item.url} alt="" /> : <Plus aria-hidden="true" />}
        <span>{title}</span>
      </button>
      {item ? <button type="button" className="vst-frame-remove" disabled={busy} aria-label={`${zh ? "移除" : "Remove "}${title}`} onClick={() => onChange(changeFrame(frames, position))}><X aria-hidden="true" /></button> : null}
    </div>
  );
  return (
    <div className="vst-frame-input">
      <div className="vst-frame-grid">
        {tile("first", zh ? "首帧" : "First frame", frames.first)}
        {middle.map((item, index) => tile(index, zh ? `中间帧 ${index + 1}` : `Middle frame ${index + 1}`, item))}
        {!middle.length ? tile(0, zh ? "中间帧" : "Middle frame") : null}
        {tile("last", zh ? "尾帧" : "Last frame", frames.last)}
      </div>
      {middle.length > 0 && middle.length < KLING_MAX_MIDDLE_FRAMES && count < max ? (
        <button type="button" className="vst-frame-add" disabled={busy} onClick={() => setSlot(middle.length)}><Plus size={14} />{zh ? "添加中间帧" : "Add middle frame"}</button>
      ) : null}
      <p className="vst-ref-hint">{zh ? `${count} / ${max} 帧 · 画幅跟随首张图片` : `${count} / ${max} frames · Aspect follows the first image`}</p>
      <HomeMediaPicker lang={locale} open={slot !== null} userId={userId} maxSelected={1} keyframeOnly acceptedTypes={["image"]} selectedIds={[]}
        onClose={() => setSlot(null)} onSelect={items => void choose(items)}
        onDelete={id => {
          const frame = (item?: UploadedVideoReference) => item && id !== (item.sourceId ?? (item.key.startsWith("work:") ? item.key : `upload:${item.key}`));
          const next = current.current;
          onChange({ first: frame(next.first) ? next.first : undefined, middle: next.middle?.filter(frame), last: frame(next.last) ? next.last : undefined });
        }} />
    </div>
  );
}
