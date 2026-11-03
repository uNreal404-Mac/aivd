"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { calculateModelCredits, getAvailableModels } from "@/config/credits";
import { TOOL_PREFILL_KEY } from "@/components/gallery/use-template";
import { I2V_MODELS } from "@/lib/image-to-video";
import { localizedHref } from "@/lib/du-home";
import "./prompt-box.css";

type Mode = "text-to-video" | "image-to-video";
function choices(mode: Mode) {
  return getAvailableModels({ mode }).filter(m => mode !== "image-to-video" || I2V_MODELS.some(i => i.id === m.id));
}
export function PromptBox({lang, preferredModel, draft}: {lang:string; preferredModel?:string; draft?:{ text:string; revision:number }}) {
  const zh=lang.startsWith("zh");
  const id=useId();
  const [mode,setMode]=useState<Mode>("text-to-video");
  const [selected,setSelected]=useState(preferredModel ?? choices("text-to-video")[0]?.id ?? "");
  const [prompt,setPrompt]=useState("");
  const [error,setError]=useState("");
  const models=choices(mode);
  const model=models.find(m=>m.id===selected) ?? models[0];
  const duration=model?.durations[0];
  const quality=mode==="text-to-video" ? model?.qualities?.[0] : undefined;
  const cost=model && duration ? calculateModelCredits(model.id,{duration,quality}) : null;
  useEffect(()=>{ if(draft) {setPrompt(draft.text);setError("");} },[draft]);
  return <form className="du-prompt-box" action={localizedHref(lang,"/"+mode)} method="get" onSubmit={event=>{
    if (!model) return;
    event.preventDefault();
    const payload={ prompt:prompt.trim(), model:model.id, duration, quality };
    try {
      sessionStorage.setItem(mode==="image-to-video" ? "aidv_image_draft" : TOOL_PREFILL_KEY, JSON.stringify(payload));
    } catch { setError(zh?"请允许站点临时保存分镜，或直接打开工作台。":"Allow session storage to carry your draft, or open the studio directly.");return; }
    window.location.assign(event.currentTarget.action);
  }}>
    <fieldset className="du-prompt-modes" aria-label={zh?"生成模式":"Generation mode"}>
      {(["text-to-video","image-to-video"] as const).map((m,i)=><button type="button" key={m} aria-pressed={m===mode} onClick={()=>{setMode(m);setError("");}}>{zh ? ["文生视频","图生视频"][i] : ["Text → Video","Image → Video"][i]}</button>)}
    </fieldset>
    <label className="sr-only" htmlFor={id}>{zh?"镜头提示词":"Shot prompt"}</label>
    <textarea id={id} name="prompt" value={prompt} maxLength={2000} onChange={e=>setPrompt(e.target.value)} rows={2}
      placeholder={zh ? "今天，你想创作什么画面？" : "What will you create today?"}/>
    <div className="du-prompt-settings">
      <label className="sr-only" htmlFor={id+"-model"}>{zh?"视频模型":"Video model"}</label>
      <select name="model" id={id+"-model"} value={model?.id ?? ""} onChange={e=>setSelected(e.target.value)}>{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
      {duration && <span className="du-shot-cost">{duration}{zh?" 秒":"s"}</span>}
      <button type="submit" className="du-primary" disabled={!model}>{zh?"生成":"Generate"}{cost !== null && <span> · {cost} {zh?"积分":"credits"}</span>}<ArrowUpRight size={15} aria-hidden="true"/></button>
    </div>
    {error && <p role="alert">{error} <a href={localizedHref(lang,"/"+mode)}>{zh?"打开工作台":"Open studio"}</a></p>}
  </form>;
}
