"use client";

import { ArrowUp, Camera, Check, ChevronRight, CircleDollarSign, ExternalLink, Files, Layers, Loader2, Maximize, Palette, Ratio, SlidersHorizontal, Square, Volume2, VolumeX, WandSparkles } from "lucide-react";
import { useState } from "react";
import { VIDEO_PRESETS } from "@/lib/video-presets";
import type { GenerateData } from "@/lib/creative-space/canvas-graph";
import type { CanvasActions } from "./canvas-nodes";
import { CanvasPrompt } from "./canvas-prompt";
import { InspectorReferences } from "./inspector-references";
import { InspectorFrame, InspectorMenu, InspectorOptions } from "./inspector-controls";
import { choicesFor, followsReferenceAspect, modelsFor, withModel } from "./model-options";

function modelFamily(name: string) {
  if (/^nano banana/i.test(name)) return "Nano Banana";
  if (/^gpt image/i.test(name)) return "GPT Image";
  if (/^seedance/i.test(name)) return "Seedance";
  return name.split(" ")[0];
}

function ModelMenu({ data, set, zh }: { data: GenerateData; set: (id: string) => void; zh: boolean }) {
  const models = modelsFor(data.kind);
  const model = models.find(row => row.id === data.modelId);
  const groups = Array.from(new Set(models.map(row => modelFamily(row.name))));
  const [group, setGroup] = useState(modelFamily(model?.name ?? ""));
  return <InspectorMenu label={zh ? "选择模型" : "Choose model"} triggerClass="nci-model" className="nci-model-pop" onOpen={() => setGroup(modelFamily(model?.name ?? ""))}
    button={<><Layers/><span>{model?.name ?? data.modelId}</span></>}>
    {close => <div className="nci-cascade">
      <div className="nci-families">{groups.map(family => <button type="button" key={family} aria-pressed={group === family}
        onFocus={() => setGroup(family)} onPointerEnter={e => { if (e.pointerType === "mouse") setGroup(family); }} onClick={() => setGroup(family)}>
        {family}<ChevronRight size={12}/></button>)}</div>
      <div className="nci-models">{models.filter(row => modelFamily(row.name) === group).map(row =>
        <button type="button" key={row.id} aria-pressed={row.id === data.modelId} onClick={() => { set(row.id); close(); }}>
          {row.name}{row.id === data.modelId && <Check size={14}/>}</button>)}</div>
    </div>}
  </InspectorMenu>;
}

export function CanvasGenerationInspector({ id, data, actions }: { id: string; data: GenerateData; actions: CanvasActions }) {
  const { zh } = actions;
  const isVideo = data.kind === "video";
  const [selectReference, setSelectReference] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputs = actions.inputsOf(id);
  const refs = actions.referencesFor(id);
  const attached = refs.filter(ref => ref.connected);
  const choices = choicesFor(data.kind, data.modelId);
  const referenceMode = Boolean(inputs.images || selectReference || choices.requiresImage);
  const autoAspect = isVideo && inputs.images > 0 && followsReferenceAspect(data.modelId);
  const pending = actions.pendingSeconds[id];
  const busy = data.status === "submitting" || data.status === "running";
  const credits = actions.quoteOf(id);
  const patch = (changes: Partial<GenerateData>) => actions.patch(id, changes);
  const addPrompt = (direction: string) => {
    const next = [direction, data.prompt.trim()].filter(Boolean).join(" ");
    if (next.length <= 5000) { patch({ prompt: next }); setError(""); }
    else setError(zh ? "提示词最多 5000 字，请先缩短内容。" : "Shorten the prompt to fit 5,000 characters.");
  };
  const dimensions = (type: "aspect" | "resolution") => {
    const ratio = type === "aspect";
    const options = ratio ? choices.aspects : choices.resolutions;
    if (!options.length) return null;
    const value = data[type] ?? options[0];
    const label = ratio ? zh ? "宽高比" : "Aspect ratio" : zh ? "分辨率" : "Resolution";
    return <InspectorMenu label={label} button={<>{ratio ? <Ratio/> : <Maximize/>}{ratio && zh ? "比例-" : ""}{value}</>}>
      {close => <InspectorOptions label={label} value={value} options={options} set={v => { patch({ [type]: v }); close(); }}/>}
    </InspectorMenu>;
  };
  return <InspectorFrame zh={zh} title={isVideo ? zh ? "视频生成参数" : "Video generation settings" : zh ? "图片生成参数" : "Image generation settings"} kind={data.kind}>
    {isVideo && <div className="nci-top nci-modes">
      <div className="nci-segment"><button type="button" aria-pressed={!referenceMode} disabled={choices.requiresImage} onClick={() => { actions.detachImageReferences(id); setSelectReference(false); }}>{zh ? "文生视频" : "Text to video"}</button>
        {choices.maxImages > 0 && <button type="button" aria-pressed={referenceMode} onClick={() => setSelectReference(true)}>{zh ? "图片参考" : "Image reference"}</button>}</div>
      <a className="nci-chip" href={`/${zh ? "zh" : "en"}/ai/video?mode=extend`} target="_blank" rel="noreferrer" title={zh ? "在工作室延长视频" : "Extend a video in the studio"}>{zh ? "视频延长" : "Extend video"}<ExternalLink/></a>
      <InspectorMenu label={zh ? "运镜" : "Camera movement"} button={<><Camera/>{zh ? "运镜" : "Camera"}</>}>
        {close => VIDEO_PRESETS.map(preset => <button type="button" className="nci-row" key={preset.id} onClick={() => { addPrompt(preset.prompt); close(); }}>{zh ? preset.zh : preset.en}</button>)}
      </InspectorMenu>
    </div>}
    {(!isVideo || referenceMode) && <InspectorReferences id={id} actions={actions} limit={choices.maxImages} busy={busy} onBusy={setUploading} onAttach={() => setSelectReference(true)}/>}
    {!isVideo && <div className="nci-styles">
      <InspectorMenu label={zh ? "风格转绘" : "Restyle reference"} triggerClass="nci-small" disabled={!attached.length} button={<>{zh ? "风格转绘" : "Restyle"}<WandSparkles/></>}>
        {close => (zh ? ["水彩画", "电影写实", "铅笔素描", "剪纸"] : ["Watercolor", "Cinematic realism", "Pencil sketch", "Paper cutout"]).map(style =>
          <button type="button" className="nci-row" key={style} onClick={() => { addPrompt(zh ? `保留参考图主体与构图，转绘为${style}风格。` : `Preserve the reference composition and render in ${style} style.`); close(); }}>{style}</button>)}
      </InspectorMenu>
      <InspectorMenu label={zh ? "调色盘" : "Color palette"} triggerClass="nci-small" disabled={!attached.length} button={<>{zh ? "调色盘" : "Palette"}<Palette/></>}>
        {close => <label className="nci-colour">{zh ? "为画面指定主色" : "Choose a dominant color"}<input type="color" aria-label={zh ? "画面主色" : "Dominant color"}
          onChange={e => { addPrompt(zh ? `以 ${e.target.value} 为画面主色。` : `Use ${e.target.value} as the dominant color.`); close(); }}/></label>}
      </InspectorMenu>
    </div>}
    <CanvasPrompt value={data.prompt} label={zh ? "提示词" : "Prompt"} zh={zh}
      placeholder={isVideo ? zh ? "请输入视频描述…" : "Describe the video…" : zh ? "请输入图片描述…" : "Describe the image…"}
      list={() => actions.referencesFor(id)} attach={ref => actions.attachReference(id, ref)} change={prompt => patch({ prompt })}/>
    {(inputs.texts > 0 || inputs.images > choices.maxImages || (choices.requiresImage && !inputs.images)) && <p className="nci-info">
      {inputs.texts ? zh ? `已连接 ${inputs.texts} 段文本` : `${inputs.texts} text inputs connected` : ""}
      {inputs.images > choices.maxImages ? zh ? ` · 使用前 ${choices.maxImages} 张参考图` : ` · Using first ${choices.maxImages} images` : ""}
      {choices.requiresImage && !inputs.images ? zh ? " 需要参考图" : " Reference image required" : ""}
    </p>}
    {error && <p className="nci-info" role="alert">{error}</p>}
    <div className="nci-bottom">
      <ModelMenu zh={zh} data={data} set={modelId => patch(withModel(data, modelId))}/>
      {isVideo ? <>
        <InspectorMenu label={zh ? "视频设置" : "Video settings"} triggerClass="nci-video-params" className="nci-video-pop"
          button={<><SlidersHorizontal/>{[data.resolution, `${data.duration}s`, autoAspect ? (zh ? "自动" : "Auto") : data.aspect].filter(Boolean).join(" · ")}</>}>
          {() => <>
            <label className="nci-duration">{zh ? "时长" : "Duration"} <output>{data.duration}s</output>
              <input type="range" min={0} max={Math.max(0, choices.durations.length - 1)} value={Math.max(0, choices.durations.indexOf(data.duration ?? 0))}
                aria-label={zh ? "时长" : "Duration"} aria-valuetext={`${data.duration}s`} disabled={choices.durations.length < 2} onChange={e => patch({ duration: choices.durations[Number(e.target.value)] })}/></label>
            <div className="nci-range-marks"><span>{choices.durations[0]}s</span><span>{choices.durations.at(-1)}s</span></div>
            {choices.resolutions.length > 0 && <><small>{zh ? "分辨率" : "Resolution"}</small><InspectorOptions grid label={zh ? "分辨率" : "Resolution"} options={choices.resolutions} value={data.resolution} set={v => patch({ resolution: v })}/></>}
            {autoAspect ? <p className="nci-info">{zh ? "画幅跟随参考图片" : "The video follows the reference image’s aspect ratio"}</p> : choices.aspects.length > 0 && <><small>{zh ? "宽高比" : "Aspect ratio"}</small><InspectorOptions grid label={zh ? "宽高比" : "Aspect ratio"} options={choices.aspects} value={data.aspect} set={v => patch({ aspect: v })}/></>}
          </>}
        </InspectorMenu>
        {choices.audio && <button type="button" className="nci-chip" aria-pressed={Boolean(data.audio)} onClick={() => patch({ audio: !data.audio })}>{data.audio ? <Volume2/> : <VolumeX/>}{zh ? "音频" : "Sound"}</button>}
      </> : <>{dimensions("aspect")}{dimensions("resolution")}
        {<InspectorMenu disabled={choices.maxCount === 1} label={choices.maxCount === 1 ? zh ? "当前模型每次生成一张" : "This model generates one image at a time" : zh ? "批量张数" : "Batch size"} triggerClass="nci-batch" button={<><Files/>{zh ? "批量" : "Batch"}{(data.count ?? 1) > 1 ? ` ×${data.count}` : ""}</>}>
          {close => <InspectorOptions label={zh ? "张数" : "Count"} options={Array.from({ length: choices.maxCount }, (_, index) => String(index + 1))} value={String(data.count ?? 1)} set={count => { patch({ count: Number(count) }); close(); }}/>}
        </InspectorMenu>}</>}
      <div className="nci-submit">{credits !== null && <span title={zh ? "预计积分" : "Estimated credits"}><CircleDollarSign size={13}/>{credits}</span>}
        <button className="nci-run" type="button" disabled={busy || uploading || (!pending && ((!data.prompt.trim() && !inputs.texts) || (choices.requiresImage && !inputs.images)))} onClick={() => actions.run(id)} aria-label={pending ? zh ? "撤回生成" : "Cancel generation" : zh ? "生成" : "Generate"}>
          {pending ? <><Square size={11}/>{pending}</> : busy ? <Loader2 className="nc-spin"/> : <ArrowUp/>}
        </button></div>
    </div>
  </InspectorFrame>;
}
