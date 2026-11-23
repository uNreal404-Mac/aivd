"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import {
  AudioLines,
  Clapperboard,
  Copy,
  Download,
  Film,
  Image as ImageIcon,
  LayoutPanelTop,
  LoaderCircle,
  Palette,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  Type,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { getMarketModel, marketModelsOf } from "@/ai/kie-market";

import { useCanvasContext } from "./context";
import { collectInputs, estimateCredits, fetchJob, submitGeneration, uploadImageFile } from "./generation";
import { normalizeModelChoice, useCanvasStore } from "./store";
import type {
  CanvasNode,
  CanvasNodeKind,
  CharacterData,
  GenerateData,
  MediaData,
  NoteData,
  StoryboardData,
  StyleData,
  TextData,
} from "./types";

export const KIND_ICONS: Record<CanvasNodeKind, typeof Type> = {
  text: Type,
  image: ImageIcon,
  video: Film,
  audio: AudioLines,
  storyboard: LayoutPanelTop,
  character: UserRound,
  style: Palette,
  note: StickyNote,
  media: Clapperboard,
};

const POLL_MS = 3000;

function Shell({
  id,
  kind,
  selected,
  children,
  inputs = true,
  outputs = true,
  className = "",
  title,
}: {
  id: string;
  kind: CanvasNodeKind;
  selected?: boolean;
  children: ReactNode;
  inputs?: boolean;
  outputs?: boolean;
  className?: string;
  title?: string;
}) {
  const { t } = useCanvasContext();
  const removeNode = useCanvasStore((s) => s.removeNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const Icon = KIND_ICONS[kind];
  return (
    <div className={`aic-node aic-node-${kind} ${selected ? "is-selected" : ""} ${className}`}>
      <NodeResizer isVisible={!!selected} minWidth={180} minHeight={80} lineClassName="aic-resize-line" handleClassName="aic-resize-handle" />
      <div className="aic-node-head">
        <Icon className="aic-node-icon" size={14} />
        <span className="aic-node-title">{title || t.kinds[kind]}</span>
        <div className="aic-node-actions">
          <button type="button" className="nodrag" title={t.duplicate} aria-label={t.duplicate} onClick={() => duplicateNode(id)}>
            <Copy size={13} />
          </button>
          <button type="button" className="nodrag" title={t.delete} aria-label={t.delete} onClick={() => removeNode(id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="aic-node-body">{children}</div>
      {inputs && <Handle type="target" position={Position.Left} className="aic-handle aic-handle-in" />}
      {outputs && <Handle type="source" position={Position.Right} className="aic-handle aic-handle-out" />}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="aic-textarea nodrag nowheel"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { t } = useCanvasContext();
  const updateData = useCanvasStore((s) => s.updateData);
  const d = data as TextData;
  return (
    <Shell id={id} kind="text" selected={selected} inputs={false}>
      <AutoTextarea value={d.text} rows={5} placeholder={t.textPlaceholder} onChange={(text) => updateData(id, { text })} />
    </Shell>
  );
}

export function NoteNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { t } = useCanvasContext();
  const updateData = useCanvasStore((s) => s.updateData);
  const d = data as NoteData;
  const colors = ["var(--du-accent)", "var(--du-accent-2)", "var(--du-text)", "var(--du-surface-2)", "var(--du-border-strong)"];
  return (
    <Shell id={id} kind="note" selected={selected} inputs={false} outputs={false} className="aic-note">
      <div className="aic-note-paper" style={{ borderColor: d.color }}>
        <AutoTextarea value={d.text} rows={4} placeholder={t.notePlaceholder} onChange={(text) => updateData(id, { text })} />
        <div className="aic-note-colors nodrag">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              className={color === d.color ? "is-active" : ""}
              style={{ background: color }}
              onClick={() => updateData(id, { color })}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function StyleNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { t } = useCanvasContext();
  const updateData = useCanvasStore((s) => s.updateData);
  const d = data as StyleData;
  return (
    <Shell id={id} kind="style" selected={selected} inputs={false}>
      <div className="aic-chips nodrag">
        {t.stylePresets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={d.preset === preset ? "is-active" : ""}
            onClick={() => updateData(id, { preset: d.preset === preset ? "" : preset })}
          >
            {preset}
          </button>
        ))}
      </div>
      <AutoTextarea value={d.custom} rows={2} placeholder={t.styleCustom} onChange={(custom) => updateData(id, { custom })} />
    </Shell>
  );
}

function useImageUpload(onDone: (result: { key: string; url: string }) => void) {
  const { t, toast } = useCanvasContext();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onDone(await uploadImageFile(file));
    } catch (error) {
      toast(`${t.uploadFailed}: ${error instanceof Error ? error.message : ""}`);
    } finally {
      setBusy(false);
    }
  };
  const input = <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />;
  return { busy, open: () => inputRef.current?.click(), input };
}

export function CharacterNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { t } = useCanvasContext();
  const updateData = useCanvasStore((s) => s.updateData);
  const d = data as CharacterData;
  const upload = useImageUpload(({ key, url }) => updateData(id, { imageKey: key, imageUrl: url }));
  return (
    <Shell id={id} kind="character" selected={selected} inputs={false} title={d.name || undefined}>
      <div className="aic-character">
        <button type="button" className="aic-avatar nodrag" onClick={upload.open} aria-label={t.characterImage} title={t.characterImage}>
          {upload.busy ? (
            <LoaderCircle className="aic-spin" size={18} />
          ) : d.imageUrl ? (
            <img src={d.imageUrl} alt={d.name} />
          ) : (
            <Upload size={18} />
          )}
        </button>
        <input
          className="aic-input nodrag"
          value={d.name}
          placeholder={t.characterName}
          onChange={(e) => updateData(id, { name: e.target.value })}
        />
      </div>
      {upload.input}
      <AutoTextarea value={d.description} rows={3} placeholder={t.characterDesc} onChange={(description) => updateData(id, { description })} />
    </Shell>
  );
}

export function StoryboardNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY, width }: NodeProps<CanvasNode>) {
  const { t } = useCanvasContext();
  const updateData = useCanvasStore((s) => s.updateData);
  const d = data as StoryboardData;
  const setShot = (index: number, value: string) => updateData(id, { shots: d.shots.map((s, i) => (i === index ? value : s)) });

  const makeShots = () => {
    const { nodes, edges, addNode, connect } = useCanvasStore.getState();
    // Characters and styles wired into the storyboard carry over to every shot.
    const shared = edges
      .filter((e) => e.target === id)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is CanvasNode => !!n && (n.type === "character" || n.type === "style"));
    const x = positionAbsoluteX + (width ?? 320) + 120;
    d.shots
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((shot, index) => {
        const nodeId = addNode("image", { x, y: positionAbsoluteY + index * 420 }, { prompt: shot, title: t.shot(index + 1) });
        for (const source of shared) connect(source.id, nodeId);
      });
  };

  return (
    <Shell id={id} kind="storyboard" selected={selected}>
      <ol className="aic-shots">
        {d.shots.map((shot, index) => (
          <li key={index}>
            <span className="aic-shot-no">{index + 1}</span>
            <AutoTextarea value={shot} rows={2} placeholder={t.shotPlaceholder} onChange={(value) => setShot(index, value)} />
            <button
              type="button"
              className="aic-icon-btn nodrag"
              aria-label={t.delete}
              onClick={() => updateData(id, { shots: d.shots.filter((_, i) => i !== index) })}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ol>
      <div className="aic-row">
        <button type="button" className="aic-btn-ghost nodrag" onClick={() => updateData(id, { shots: [...d.shots, ""] })}>
          <Plus size={14} /> {t.addShot}
        </button>
        <button type="button" className="aic-btn-ghost nodrag" onClick={makeShots} disabled={!d.shots.some((s) => s.trim())}>
          <Sparkles size={14} /> {t.makeShots}
        </button>
      </div>
    </Shell>
  );
}

export function MediaNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const d = data as MediaData;
  return (
    <Shell id={id} kind="media" selected={selected} inputs={false} title={d.name || undefined}>
      <MediaPreview type={d.mediaType} url={d.url} />
    </Shell>
  );
}

function MediaPreview({ type, url }: { type: "image" | "video" | "audio"; url: string }) {
  if (!url) return null;
  if (type === "video") return <video className="aic-media nodrag" src={url} controls playsInline preload="metadata" />;
  if (type === "audio") return <audio className="aic-audio nodrag" src={url} controls preload="metadata" />;
  return <img className="aic-media" src={url} alt="" draggable={false} />;
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <label className="aic-select nodrag" title={label}>
      <span className="sr-only">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GenerateNode({ id, data, selected, kind }: NodeProps<CanvasNode> & { kind: "image" | "video" | "audio" }) {
  const { t, zh, toast, onCreditsChanged } = useCanvasContext();
  const updateData = useCanvasStore((s) => s.updateData);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as GenerateData;
  const inputs = useMemo(() => collectInputs(id, nodes, edges), [id, nodes, edges]);
  const model = getMarketModel(d.model);
  const models = useMemo(() => marketModelsOf(kind), [kind]);
  const credits = useMemo(() => estimateCredits(d, inputs), [d, inputs]);
  const busy = d.status === "queued" || d.status === "generating";
  const [submitting, setSubmitting] = useState(false);

  // Poll a running job; also refresh signed URLs once after a reload.
  const refreshed = useRef(false);
  useEffect(() => {
    if (!d.jobId) return;
    if (!busy) {
      if (d.status !== "completed" || refreshed.current) return;
      refreshed.current = true;
      fetchJob(d.jobId).then((job) => {
        if (job?.status === "completed" && job.urls.length) updateData(id, { urls: job.urls });
      });
      return;
    }
    let stopped = false;
    const tick = async () => {
      const job = await fetchJob(d.jobId as string);
      if (stopped || !job) return;
      if (job.status !== d.status || job.urls.length) {
        updateData(id, { status: job.status, urls: job.urls.length ? job.urls : d.urls, error: job.error });
      }
      if (job.status === "completed" || job.status === "failed") onCreditsChanged();
    };
    const timer = setInterval(tick, POLL_MS);
    tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id, d.jobId, d.status, busy, d.urls, updateData, onCreditsChanged]);

  const run = async () => {
    setSubmitting(true);
    const result = await submitGeneration(kind, d, inputs, zh);
    setSubmitting(false);
    if (!result.ok) {
      toast(result.message);
      return;
    }
    refreshed.current = true;
    updateData(id, { jobId: result.uuid, status: "queued", error: null, credits: result.credits });
    onCreditsChanged();
  };

  const o = model?.options;
  return (
    <Shell id={id} kind={kind} selected={selected} title={d.title}>
      <div className={`aic-preview aic-preview-${kind}`}>
        {d.urls.length > 0 ? (
          <>
            <MediaPreview type={kind} url={d.urls[0]} />
            <a className="aic-download nodrag" href={d.urls[0]} target="_blank" rel="noreferrer" download title={t.download} aria-label={t.download}>
              <Download size={14} />
            </a>
          </>
        ) : (
          <div className="aic-placeholder">
            {busy ? (
              <>
                <LoaderCircle className="aic-spin" size={22} />
                <span>{d.status === "queued" ? t.queued : t.generating}</span>
              </>
            ) : (
              (() => {
                const Icon = KIND_ICONS[kind];
                return <Icon size={26} />;
              })()
            )}
          </div>
        )}
        {busy && d.urls.length > 0 && <div className="aic-busy-badge"><LoaderCircle className="aic-spin" size={12} /> {t.generating}</div>}
      </div>
      {d.status === "failed" && <p className="aic-error">{d.error || t.failed}</p>}
      <AutoTextarea value={d.prompt} rows={3} placeholder={t.prompt} onChange={(prompt) => updateData(id, { prompt })} />
      <div className="aic-inputs">
        <span>{t.inputs}:</span>
        {inputs.texts.length === 0 && inputs.images.length === 0 ? (
          <span className="aic-dim">{t.noInputs}</span>
        ) : (
          <>
            {inputs.texts.length > 0 && <span className="aic-pill">{t.textInputs(inputs.texts.length)}</span>}
            {inputs.images.length > 0 && <span className="aic-pill">{t.imageInputs(Math.min(inputs.images.length, o?.maxImages ?? 0))}</span>}
          </>
        )}
      </div>
      <div className="aic-controls">
        <Select
          label={t.model}
          value={d.model}
          options={models.map((m) => ({ value: m.id, label: m.name }))}
          onChange={(value) => updateData(id, normalizeModelChoice(d, value))}
        />
        <Select
          label={t.aspect}
          value={d.aspect}
          options={(o?.aspects ?? []).map((a) => ({ value: a, label: a }))}
          onChange={(aspect) => updateData(id, { aspect })}
        />
        <Select
          label={t.resolution}
          value={d.resolution}
          options={(o?.resolutions ?? []).map((r) => ({ value: r, label: r }))}
          onChange={(resolution) => updateData(id, { resolution })}
        />
        <Select
          label={t.duration}
          value={d.duration}
          options={(o?.durations ?? []).map((s) => ({ value: String(s), label: `${s}s` }))}
          onChange={(duration) => updateData(id, { duration: Number(duration) })}
        />
        <Select
          label={t.voice}
          value={d.voice}
          options={(o?.voices ?? []).map((v) => ({ value: v.id, label: v.name }))}
          onChange={(voice) => updateData(id, { voice })}
        />
      </div>
      <button type="button" className="aic-generate nodrag" onClick={run} disabled={busy || submitting}>
        {busy || submitting ? <LoaderCircle className="aic-spin" size={15} /> : <Sparkles size={15} />}
        <span>{d.urls.length ? t.regenerate : t.generate}</span>
        {credits !== null && credits > 0 && <span className="aic-cost">{t.creditsCost(credits)}</span>}
      </button>
    </Shell>
  );
}

export const nodeTypes = {
  text: TextNode,
  note: NoteNode,
  style: StyleNode,
  character: CharacterNode,
  storyboard: StoryboardNode,
  media: MediaNode,
  image: (props: NodeProps<CanvasNode>) => <GenerateNode {...props} kind="image" />,
  video: (props: NodeProps<CanvasNode>) => <GenerateNode {...props} kind="video" />,
  audio: (props: NodeProps<CanvasNode>) => <GenerateNode {...props} kind="audio" />,
};
