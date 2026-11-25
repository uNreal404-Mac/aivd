"use client";

import {
  AudioLines,
  Bot,
  Camera,
  Clapperboard,
  Download,
  Eraser,
  Expand,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Music,
  Paintbrush,
  Scissors,
  SplitSquareHorizontal,
  Sparkles,
  Type,
  Upload,
  Video,
  ZoomIn,
} from "lucide-react";
import { createContext, memo, useContext, useState, type ReactNode } from "react";
import { Handle, NodeResizer, NodeToolbar, Position, type NodeProps } from "reactflow";

import type {
  AgentData,
  CanvasData,
  GenerateData,
  GroupData,
  MediaData,
  PortType,
  TextData,
} from "@/lib/creative-space/canvas-graph";
import { inputTypes, outputType } from "@/lib/creative-space/canvas-graph";
import type { CanvasEditAction } from "../canvas-inpaint-modal";
import { choicesFor, modelsFor, withModel } from "./model-options";

export interface NodeInputsSummary {
  texts: number;
  images: number;
  videos: number;
}

export interface CanvasActions {
  zh: boolean;
  patch: (id: string, partial: Partial<CanvasData>) => void;
  commit: () => void;
  run: (id: string) => void;
  inputsOf: (id: string) => NodeInputsSummary;
  quoteOf: (id: string) => number | null;
  edit: (id: string, action: CanvasEditAction) => void;
  shots: (id: string) => void;
  compare: (id: string) => void;
  canCompare: (id: string) => boolean;
  captureFrame: (id: string) => void;
  spreadSteps: (id: string) => void;
  agentToVideo: (id: string) => void;
  singleSelection: boolean;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

function useActions(): CanvasActions {
  const value = useContext(CanvasActionsContext);
  if (!value) throw new Error("Canvas actions missing");
  return value;
}

const PORT_LABEL: Record<PortType, { zh: string; en: string }> = {
  text: { zh: "文字", en: "Text" },
  image: { zh: "图片", en: "Image" },
  video: { zh: "视频", en: "Video" },
  audio: { zh: "音频", en: "Audio" },
};

export const KIND_LABEL: Record<CanvasData["kind"], { zh: string; en: string }> = {
  text: { zh: "文字", en: "Text" },
  media: { zh: "素材", en: "Asset" },
  image: { zh: "生成图片", en: "Generate image" },
  video: { zh: "生成视频", en: "Generate video" },
  audio: { zh: "生成音频", en: "Generate audio" },
  agent: { zh: "Agent 策划", en: "Agent" },
  group: { zh: "分组", en: "Group" },
};

export function kindIcon(kind: CanvasData["kind"], media?: MediaData["media"]) {
  if (kind === "text") return Type;
  if (kind === "image") return ImageIcon;
  if (kind === "video") return Film;
  if (kind === "audio") return Music;
  if (kind === "agent") return Bot;
  if (kind === "group") return Layers;
  return media === "video" ? Video : media === "audio" ? AudioLines : Upload;
}

function Ports({ data }: { data: CanvasData }) {
  const { zh } = useActions();
  const accepts = inputTypes(data.kind);
  const out = outputType(data);
  return (
    <>
      {accepts.length ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="nc-port nc-port-in"
          title={`${zh ? "接收" : "Accepts"}：${accepts.map((type) => PORT_LABEL[type][zh ? "zh" : "en"]).join(zh ? "、" : ", ")}`}
        />
      ) : null}
      {out ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className={`nc-port nc-port-out nc-port-${out}`}
          title={`${zh ? "输出" : "Outputs"}：${PORT_LABEL[out][zh ? "zh" : "en"]}`}
        />
      ) : null}
    </>
  );
}

function Title({ id, title, fallback }: { id: string; title: string; fallback: string }) {
  const { patch, commit } = useActions();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        className="nc-title-input nodrag"
        defaultValue={title || fallback}
        // biome-ignore lint/a11y/noAutofocus: rename starts on double-click
        autoFocus
        maxLength={60}
        onBlur={(event) => {
          setEditing(false);
          patch(id, { title: event.target.value.trim() });
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") (event.target as HTMLInputElement).blur();
        }}
      />
    );
  }
  return (
    <strong className="nc-title" onDoubleClick={() => setEditing(true)} title={title || fallback}>
      {title || fallback}
    </strong>
  );
}

function Shell({
  id,
  data,
  selected,
  children,
  className = "",
  status,
}: {
  id: string;
  data: CanvasData;
  selected: boolean;
  children: ReactNode;
  className?: string;
  status?: string;
}) {
  const { zh } = useActions();
  const Icon = kindIcon(data.kind, data.kind === "media" ? data.media : undefined);
  const fallback = KIND_LABEL[data.kind][zh ? "zh" : "en"];
  return (
    <div className={`nc-node nc-node-${data.kind}${selected ? " is-selected" : ""} ${className}`} data-node-id={id}>
      <Ports data={data} />
      <div className="nc-node-head">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <Title id={id} title={data.title} fallback={fallback} />
        {status ? <span className={`nc-dot nc-dot-${status}`} aria-hidden="true" /> : null}
      </div>
      {children}
    </div>
  );
}

function MediaPreview({ media, url, id, alt }: { media: "image" | "video" | "audio"; url?: string; id: string; alt: string }) {
  if (!url) return null;
  if (media === "video") return <video className="nc-media nodrag" src={url} controls muted playsInline preload="metadata" data-node-id={id} />;
  if (media === "audio") return <audio className="nc-audio nodrag" src={url} controls preload="none" />;
  return <img className="nc-media" src={url} alt={alt} draggable={false} />;
}

function ToolButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="nc-tool" title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** Edit tools above a node that has a finished image or video. */
function OutputTools({ id, media, url, selected }: { id: string; media: "image" | "video" | "audio"; url?: string; selected: boolean }) {
  const actions = useActions();
  const { zh } = actions;
  if (!url) return null;
  return (
    <NodeToolbar isVisible={selected && actions.singleSelection} position={Position.Top} className="nc-node-tools">
      {media === "image" ? (
        <>
          <ToolButton label={zh ? "局部重绘" : "Inpaint"} onClick={() => actions.edit(id, "inpaint")}><Paintbrush className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "消除" : "Erase"} onClick={() => actions.edit(id, "erase")}><Eraser className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "扩图" : "Expand"} onClick={() => actions.edit(id, "outpaint")}><Expand className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "抠图" : "Cutout"} onClick={() => actions.edit(id, "cutout")}><Scissors className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "高清放大" : "Upscale"} onClick={() => actions.edit(id, "upscale")}><ZoomIn className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "改文字" : "Edit text"} onClick={() => actions.edit(id, "text-edit")}><Type className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "多机位分镜" : "Multi-angle shots"} onClick={() => actions.shots(id)}><Camera className="h-4 w-4" /></ToolButton>
          <ToolButton label={zh ? "图生视频" : "Animate"} onClick={() => actions.edit(id, "animate")}><Clapperboard className="h-4 w-4" /></ToolButton>
          {actions.canCompare(id) ? (
            <ToolButton label={zh ? "前后对比" : "Before / after"} onClick={() => actions.compare(id)}><SplitSquareHorizontal className="h-4 w-4" /></ToolButton>
          ) : null}
        </>
      ) : null}
      {media === "video" ? (
        <ToolButton label={zh ? "截取当前帧" : "Capture frame"} onClick={() => actions.captureFrame(id)}><Camera className="h-4 w-4" /></ToolButton>
      ) : null}
      <a className="nc-tool" href={url} target="_blank" rel="noreferrer" download title={zh ? "下载" : "Download"} aria-label={zh ? "下载" : "Download"}>
        <Download className="h-4 w-4" />
      </a>
    </NodeToolbar>
  );
}

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps<TextData>) {
  const { zh, patch } = useActions();
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={120} lineClassName="nc-resize-line" handleClassName="nc-resize-handle" />
      <Shell id={id} data={data} selected={selected} className="nc-fill">
        <textarea
          className="nc-text nodrag nowheel"
          value={data.text}
          placeholder={zh ? "写下提示词、分镜或台词，连到生成节点使用" : "Write a prompt, shot or line, then wire it to a generator"}
          onChange={(event) => patch(id, { text: event.target.value })}
          maxLength={5000}
          aria-label={zh ? "文字内容" : "Text"}
        />
      </Shell>
    </>
  );
});

export const MediaNode = memo(function MediaNode({ id, data, selected }: NodeProps<MediaData>) {
  const { zh } = useActions();
  const missing = !data.url && !data.busy;
  return (
    <>
      <OutputTools id={id} media={data.media} url={data.url} selected={selected} />
      <Shell id={id} data={data} selected={selected} status={data.busy ? "running" : missing ? "failed" : "done"}>
        <div className={`nc-preview nc-preview-${data.media}`}>
          {data.busy ? (
            <span className="nc-empty"><Loader2 className="h-5 w-5 nc-spin" aria-hidden="true" />{zh ? "上传并检查中…" : "Uploading…"}</span>
          ) : null}
          {missing ? (
            <span className="nc-empty">
              {data.localId
                ? zh ? "这个素材只在原来的浏览器里，请重新添加" : "This file is only in the browser it was added in"
                : zh ? "素材加载中或已不可用" : "Loading, or no longer available"}
            </span>
          ) : null}
          <MediaPreview media={data.media} url={data.url} id={id} alt={data.title} />
        </div>
      </Shell>
    </>
  );
});

function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="nc-field">
      <span>{label}</span>
      <select className="nodrag" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function GeneratePanel({ id, data }: { id: string; data: GenerateData }) {
  const actions = useActions();
  const { zh, patch } = actions;
  const choices = choicesFor(data.kind, data.modelId);
  const inputs = actions.inputsOf(id);
  const credits = actions.quoteOf(id);
  const busy = data.status === "submitting" || data.status === "running";
  const linked = [
    inputs.texts ? `${inputs.texts} ${zh ? "段文字" : inputs.texts > 1 ? "texts" : "text"}` : "",
    data.kind !== "audio" && inputs.images ? `${inputs.images} ${zh ? "张参考图" : inputs.images > 1 ? "images" : "image"}` : "",
  ].filter(Boolean);
  const overLimit = data.kind !== "audio" && inputs.images > choices.maxImages;
  return (
    <div className="nc-panel nodrag nowheel" onKeyDown={(event) => event.stopPropagation()}>
      <textarea
        className="nc-prompt"
        value={data.prompt}
        placeholder={
          data.kind === "audio"
            ? zh ? "要说的台词，或音乐的描述" : "Lines to speak, or the music to make"
            : zh ? "描述画面；连进来的文字会自动拼在前面" : "Describe the shot; wired text is added in front"
        }
        maxLength={5000}
        onChange={(event) => patch(id, { prompt: event.target.value })}
        aria-label={zh ? "提示词" : "Prompt"}
      />
      <p className="nc-linked">
        {linked.length ? `${zh ? "已连接" : "Wired"}：${linked.join(zh ? "，" : ", ")}` : zh ? "从左侧端口连入文字或图片" : "Wire text or images into the left port"}
        {overLimit ? ` · ${zh ? `这个模型最多用 ${choices.maxImages} 张，多出的不会发送` : `this model uses ${choices.maxImages} at most`}` : ""}
        {choices.requiresImage && !inputs.images ? ` · ${zh ? "这个模型需要一张参考图" : "needs a reference image"}` : ""}
      </p>
      <div className="nc-fields">
        <Select
          label={zh ? "模型" : "Model"}
          value={data.modelId}
          options={modelsFor(data.kind).map((model) => ({ value: model.id, label: model.name }))}
          onChange={(value) => patch(id, withModel(data, value))}
        />
        {choices.aspects.length ? (
          <Select label={zh ? "比例" : "Aspect"} value={data.aspect ?? choices.aspects[0]} options={choices.aspects.map((value) => ({ value, label: value }))} onChange={(value) => patch(id, { aspect: value })} />
        ) : null}
        {choices.resolutions.length ? (
          <Select label={zh ? "清晰度" : "Quality"} value={data.resolution ?? choices.resolutions[0]} options={choices.resolutions.map((value) => ({ value, label: value }))} onChange={(value) => patch(id, { resolution: value })} />
        ) : null}
        {data.kind === "video" ? (
          <Select label={zh ? "时长" : "Length"} value={String(data.duration ?? choices.durations[0])} options={choices.durations.map((value) => ({ value: String(value), label: `${value}s` }))} onChange={(value) => patch(id, { duration: Number(value) })} />
        ) : null}
        {data.kind === "image" && choices.maxCount > 1 ? (
          <Select label={zh ? "张数" : "Count"} value={String(data.count ?? 1)} options={Array.from({ length: choices.maxCount }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} onChange={(value) => patch(id, { count: Number(value) })} />
        ) : null}
        {choices.voices.length ? (
          <Select label={zh ? "音色" : "Voice"} value={data.voice ?? choices.voices[0].id} options={choices.voices.map((voice) => ({ value: voice.id, label: voice.name }))} onChange={(value) => patch(id, { voice: value })} />
        ) : null}
        {data.kind === "video" && choices.audio ? (
          <label className="nc-check">
            <input type="checkbox" checked={Boolean(data.audio)} onChange={(event) => patch(id, { audio: event.target.checked })} />
            <span>{zh ? "带声音" : "Sound"}</span>
          </label>
        ) : null}
      </div>
      {choices.style ? (
        <input
          className="nc-style"
          value={data.style ?? ""}
          maxLength={300}
          placeholder={zh ? "风格或音色描述（可选）" : "Style or voice notes (optional)"}
          onChange={(event) => patch(id, { style: event.target.value })}
          aria-label={zh ? "风格" : "Style"}
        />
      ) : null}
      <div className="nc-run-row">
        <span className="nc-quote">{credits !== null ? `${zh ? "约" : "≈"} ${credits} ${zh ? "积分" : "credits"}` : ""}</span>
        <button type="button" className="nc-run" disabled={busy} onClick={() => actions.run(id)}>
          {busy ? <Loader2 className="h-4 w-4 nc-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {busy ? (zh ? "生成中" : "Working") : data.resultUuid ? (zh ? "重新生成" : "Regenerate") : zh ? "生成" : "Generate"}
        </button>
      </div>
    </div>
  );
}

export const GenerateNode = memo(function GenerateNode({ id, data, selected }: NodeProps<GenerateData>) {
  const actions = useActions();
  const { zh, patch } = actions;
  const urls = data.urls ?? [];
  const index = Math.min(data.resultIndex ?? 0, Math.max(0, urls.length - 1));
  const url = data.status === "done" ? urls[index] : undefined;
  const Icon = kindIcon(data.kind);
  return (
    <>
      <OutputTools id={id} media={data.kind} url={url} selected={selected} />
      <Shell id={id} data={data} selected={selected} status={data.status}>
        <div className={`nc-preview nc-preview-${data.kind}`}>
          {url ? <MediaPreview media={data.kind} url={url} id={id} alt={data.prompt || data.title} /> : null}
          {!url ? (
            <span className={`nc-empty${data.status === "failed" ? " is-error" : ""}`} role={data.status === "failed" ? "alert" : undefined}>
              {data.status === "submitting" || data.status === "running" ? (
                <>
                  <Loader2 className="h-5 w-5 nc-spin" aria-hidden="true" />
                  {data.status === "submitting" ? (zh ? "提交中…" : "Submitting…") : zh ? "生成中，完成后自动显示" : "Generating…"}
                </>
              ) : data.status === "failed" ? (
                data.error || (zh ? "生成失败" : "Generation failed")
              ) : data.status === "done" ? (
                zh ? "结果加载中…" : "Loading result…"
              ) : (
                <>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  {zh ? "选中节点，在下方写提示词并生成" : "Select, write a prompt below and generate"}
                </>
              )}
            </span>
          ) : null}
        </div>
        {url && data.error ? <p className="nc-node-error" role="alert">{data.error}</p> : null}
        {urls.length > 1 ? (
          <div className="nc-thumbs nodrag">
            {urls.map((item, position) => (
              <button
                key={item}
                type="button"
                className={position === index ? "is-active" : ""}
                onClick={() => patch(id, { resultIndex: position })}
                aria-label={`${zh ? "使用第" : "Use #"}${position + 1}${zh ? "张" : ""}`}
              >
                <img src={item} alt="" draggable={false} />
              </button>
            ))}
          </div>
        ) : null}
      </Shell>
      <NodeToolbar isVisible={selected && actions.singleSelection} position={Position.Bottom} className="nc-panel-toolbar">
        <GeneratePanel id={id} data={data} />
      </NodeToolbar>
    </>
  );
});

export const AgentNode = memo(function AgentNode({ id, data, selected }: NodeProps<AgentData>) {
  const actions = useActions();
  const { zh, patch } = actions;
  const inputs = actions.inputsOf(id);
  const busy = data.status === "running" || data.status === "submitting";
  return (
    <>
      <Shell id={id} data={data} selected={selected} status={data.status}>
        <div className="nc-agent">
          {data.reply ? <p className="nc-agent-reply">{data.reply}</p> : null}
          {data.steps?.length ? (
            <ol className="nc-agent-steps">
              {data.steps.map((step, index) => (
                <li key={`${step.title}-${index}`}><strong>{step.title}</strong>{step.instruction}</li>
              ))}
            </ol>
          ) : null}
          {data.error ? <p className="nc-agent-error" role="alert">{data.error}</p> : null}
          {!data.reply && !data.error ? (
            <p className="nc-agent-hint">{zh ? "说出你想做的片子，连入素材后它会参考画面给出分镜和生成提示词" : "Describe the piece; wire assets in and it plans shots and a prompt"}</p>
          ) : null}
        </div>
      </Shell>
      <NodeToolbar isVisible={selected && actions.singleSelection} position={Position.Bottom} className="nc-panel-toolbar">
        <div className="nc-panel nodrag nowheel" onKeyDown={(event) => event.stopPropagation()}>
          <textarea
            className="nc-prompt"
            value={data.prompt}
            maxLength={5000}
            placeholder={zh ? "例如：用 @A 做一条 15 秒的新品宣传片，三个镜头" : "e.g. a 15s launch film for @A in three shots"}
            onChange={(event) => patch(id, { prompt: event.target.value })}
            aria-label={zh ? "给 Agent 的需求" : "Brief"}
          />
          <p className="nc-linked">
            {inputs.images + inputs.videos
              ? `${zh ? "已连接素材" : "Wired assets"}：${inputs.images + inputs.videos}（${zh ? "按连接顺序记作 @A、@B…" : "@A, @B… in wire order"}）`
              : zh ? "可从左侧连入图片或视频" : "Wire images or videos into the left port"}
          </p>
          <div className="nc-run-row">
            <span className="nc-quote">{zh ? "策划不扣积分" : "Planning is free"}</span>
            {data.steps?.length ? (
              <button type="button" className="nc-ghost" onClick={() => actions.spreadSteps(id)}>{zh ? "铺成分镜卡片" : "Lay out shots"}</button>
            ) : null}
            {data.generationPrompt ? (
              <button type="button" className="nc-ghost" onClick={() => actions.agentToVideo(id)}>{zh ? "接一个视频节点" : "Add video node"}</button>
            ) : null}
            <button type="button" className="nc-run" disabled={busy} onClick={() => actions.run(id)}>
              {busy ? <Loader2 className="h-4 w-4 nc-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
              {busy ? (zh ? "策划中" : "Planning") : zh ? "开始策划" : "Plan"}
            </button>
          </div>
        </div>
      </NodeToolbar>
    </>
  );
});

export const GroupNode = memo(function GroupNode({ id, data, selected }: NodeProps<GroupData>) {
  const { zh, commit } = useActions();
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={240} minHeight={160} onResizeEnd={commit} lineClassName="nc-resize-line" handleClassName="nc-resize-handle" />
      <div className={`nc-group nc-group-${data.tone ?? "neutral"}${selected ? " is-selected" : ""}`}>
        <div className="nc-group-head">
          <Layers className="h-4 w-4" aria-hidden="true" />
          <Title id={id} title={data.title} fallback={zh ? "分组" : "Group"} />
        </div>
      </div>
    </>
  );
});

export const NODE_TYPES = {
  text: TextNode,
  media: MediaNode,
  image: GenerateNode,
  video: GenerateNode,
  audio: GenerateNode,
  agent: AgentNode,
  group: GroupNode,
};
