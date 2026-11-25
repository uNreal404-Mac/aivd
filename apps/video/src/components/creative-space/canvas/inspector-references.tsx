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

export function InspectorReferences({ id, actions, limit, busy, onAttach, onBusy }: {
  id: string; actions: CanvasActions; limit: number; busy?: boolean; onAttach?: () => void; onBusy: (busy: boolean) => void;
}) {
  const { zh } = actions;
  const refs = actions.referencesFor(id);
  const attached = refs.filter(ref => ref.connected);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File) => {
    setUploading(true); onBusy(true); setError("");
    try { await actions.uploadImageReference(id, file); }
    catch { setError(zh ? "这张图片暂时无法添加，请重新选择。" : "Unable to add this image. Choose it again."); }
    finally { setUploading(false); onBusy(false); }
  };
  return <>
    <div className="nci-assets">
      <InspectorMenu label={zh ? "添加参考素材" : "Add reference"} triggerClass="nci-add" className="nci-reference-pop"
        disabled={busy || uploading || !limit} button={uploading ? <Loader2 className="nc-spin"/> : <Plus/>}>
        {close => <>
          <strong>{zh ? "选择素材" : "Choose a reference"}</strong>
          <label className="nci-upload"><Upload size={15}/>{zh ? "上传本地图片" : "Upload an image"}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={attached.length >= limit}
              onChange={e => { const file = e.currentTarget.files?.[0]; if (file) { close(); void upload(file); } }} /></label>
          <small>{zh ? "画布素材" : "Canvas assets"}</small>
          {refs.length ? refs.map(ref => <button type="button" className="nci-reference-option" key={ref.id} aria-pressed={ref.connected}
            onClick={() => { if (actions.attachReference(id, ref)) { onAttach?.(); close(); } }}>
            <ReferenceImage item={ref}/><span>{ref.name}</span>{ref.connected && <Check size={14}/>}</button>)
            : <p>{zh ? "当前画布没有可用素材" : "No available assets on this canvas"}</p>}
        </>}
      </InspectorMenu>
      {attached.map(ref => <span key={ref.id} className="nci-thumb" title={ref.name}><ReferenceImage item={ref}/></span>)}
    </div>
    {error && <p className="nci-info" role="alert">{error}</p>}
  </>;
}
