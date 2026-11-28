"use client";

import { Check, Film, Image as ImageIcon, Loader2, Plus, Upload } from "lucide-react";
import { useState } from "react";
import type { CanvasActions } from "./canvas-nodes";
import type { CanvasReference } from "./canvas-prompt";
import { InspectorMenu } from "./inspector-controls";

function ReferenceImage({ item }: { item: CanvasReference }) {
  if (item.media === "video") return item.url ? <video muted playsInline preload="metadata" src={item.url}/> : <Film size={16}/>;
  return item.url ? <img src={item.url} alt={item.name}/> : <ImageIcon size={16}/>;
}

export function InspectorReferences({ id, actions, limit, busy, onAttach, onBusy, onMention }: {
  id: string; actions: CanvasActions; limit: number; busy?: boolean; onAttach?: () => void; onBusy: (busy: boolean) => void;
  onMention?: (ref: CanvasReference, role: string) => void;
}) {
  const { zh } = actions;
  const refs = actions.referencesFor(id);
  const attached = refs.filter(ref => ref.connected);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (files: File[]) => {
    setUploading(true); onBusy(true); setError("");
    try { for (const file of files) await actions.uploadImageReference(id, file); }
    catch { setError(zh ? "这张图片暂时无法添加，请重新选择。" : "Unable to add this image. Choose it again."); }
    finally { setUploading(false); onBusy(false); }
  };
  return <>
    <div className="nci-assets">
      <InspectorMenu label={zh ? "添加参考素材" : "Add reference"} triggerClass="nci-add" className="nci-reference-pop"
        disabled={busy || uploading || !limit} button={uploading ? <Loader2 className="nc-spin"/> : <Plus/>}>
        {close => <>
          <strong>{zh ? "选择素材" : "Choose a reference"}</strong>
          <label className="nci-upload"><Upload size={15}/>{zh ? "上传本地图片（可多选）" : "Upload images"}
            <input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={attached.length >= limit}
              onChange={e => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ""; if (files.length) { close(); void upload(files); } }} /></label>
          <small>{zh ? "画布素材" : "Canvas assets"}</small>
          {refs.length ? refs.map(ref => <button type="button" className="nci-reference-option" key={ref.id} aria-pressed={ref.connected}
            disabled={!ref.connected && !ref.attachable}
            title={!ref.connected && !ref.attachable ? zh ? `当前模型最多使用 ${limit} 张参考图` : `This model accepts ${limit} reference images` : undefined}
            onClick={() => { if (actions.attachReference(id, ref)) { onAttach?.(); close(); } }}>
            <ReferenceImage item={ref}/><span>{ref.name}</span>{ref.connected && <Check size={14}/>}</button>)
            : <p>{zh ? "当前画布没有可用素材" : "No available assets on this canvas"}</p>}
        </>}
      </InspectorMenu>
      {uploading ? <output className="nci-thumb nci-uploading"><Loader2 className="nc-spin" size={16} aria-hidden="true" /><span>{zh ? "上传中" : "Uploading"}</span></output> : null}
      {attached.map(ref => onMention ? <InspectorMenu key={ref.id} label={`${zh ? "引用" : "Mention"} ${ref.name}`}
        triggerClass="nci-thumb nci-thumb-button" button={<ReferenceImage item={ref}/>}>
        {close => <>
          <strong>@{ref.token}</strong>
          <button type="button" className="nci-row" onClick={() => { onMention(ref, ""); close(); }}>{zh ? `仅插入 @${ref.token}` : `Insert @${ref.token} only`}</button>
          {(zh ? ["作为参考素材", "作为首帧", "作为尾帧", "参考主体、构图和风格"]
            : ["Use as reference", "Use as first frame", "Use as last frame", "Match subject, composition and style"]).map(role =>
            <button type="button" className="nci-row" key={role} onClick={() => { onMention(ref, role); close(); }}>{role}</button>)}
        </>}
      </InspectorMenu> : <span key={ref.id} className="nci-thumb" title={ref.name}><ReferenceImage item={ref}/></span>)}
    </div>
    {error && <p className="nci-info" role="alert">{error}</p>}
  </>;
}
