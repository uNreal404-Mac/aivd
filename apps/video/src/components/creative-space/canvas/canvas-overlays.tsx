"use client";

import { Camera, Loader2, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Node } from "reactflow";

import { marketCredits, type MarketModel } from "@/ai/kie-market";
import type { CanvasData, StoredGraph } from "@/lib/creative-space/canvas-graph";
import { KIND_LABEL, kindIcon } from "./canvas-nodes";

export interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  build: () => { nodes: { key: string; data: CanvasData; x: number; y: number }[]; edges: [string, string][] };
}

function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="nc-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <dialog open className={`nc-dialog${wide ? " is-wide" : ""}`} aria-modal="true" aria-label={title}>
        <div className="nc-dialog-head">
          <strong>{title}</strong>
          <button type="button" className="nc-icon-btn" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </dialog>
    </div>
  );
}

export function NodeSearch({ zh, nodes, onClose, onPick }: { zh: boolean; nodes: Node<CanvasData>[]; onClose: () => void; onPick: (node: Node<CanvasData>) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes
      .filter((node) => {
        if (!q) return true;
        const data = node.data as CanvasData & { prompt?: string; text?: string };
        return [data.title, data.prompt, data.text, KIND_LABEL[data.kind][zh ? "zh" : "en"]].some((value) => value?.toLowerCase().includes(q));
      })
      .slice(0, 30);
  }, [nodes, query, zh]);
  return (
    <Dialog title={zh ? "搜索节点" : "Search nodes"} onClose={onClose}>
      <label className="nc-search">
        <Search className="h-4 w-4" aria-hidden="true" />
        <input
          ref={input}
          value={query}
          placeholder={zh ? "节点名称、提示词或文字" : "Name, prompt or text"}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") setActive((value) => Math.min(value + 1, results.length - 1));
            else if (event.key === "ArrowUp") setActive((value) => Math.max(value - 1, 0));
            else if (event.key === "Enter" && results[active]) onPick(results[active]);
          }}
          aria-label={zh ? "搜索" : "Search"}
        />
      </label>
      <div className="nc-search-list">
        {results.length ? results.map((node, index) => {
          const data = node.data as CanvasData & { prompt?: string; text?: string };
          const Icon = kindIcon(data.kind, data.kind === "media" ? data.media : undefined);
          return (
            <button key={node.id} type="button" aria-current={index === active ? "true" : undefined} className={index === active ? "is-active" : ""} onClick={() => onPick(node)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{data.title || KIND_LABEL[data.kind][zh ? "zh" : "en"]}</span>
              <em>{(data.prompt || data.text || "").slice(0, 60)}</em>
            </button>
          );
        }) : <p className="nc-muted">{zh ? "没有匹配的节点" : "No matching nodes"}</p>}
      </div>
    </Dialog>
  );
}

export function ShortcutsDialog({ zh, onClose }: { zh: boolean; onClose: () => void }) {
  const rows: [string, string][] = zh
    ? [
        ["双击空白处", "添加节点"],
        ["从端口拖线到空白处", "添加能接上的节点"],
        ["点击连线", "断开"],
        ["⌘Z / ⇧⌘Z", "撤销 / 重做（位置、连线、增删）"],
        ["⌘C / ⌘V", "复制 / 粘贴节点；粘贴图片直接成素材"],
        ["⌘D", "创建副本"],
        ["⌘G", "打组 / 解组"],
        ["⌘A", "全选"],
        ["⌘K", "搜索节点"],
        ["Delete", "删除所选"],
        ["H / V", "平移 / 框选"],
        ["Shift + 拖动", "框选"],
        ["E / M", "显隐连线 / 小地图"],
      ]
    : [
        ["Double-click empty space", "Add a node"],
        ["Drag a wire into empty space", "Add a node that takes it"],
        ["Click a wire", "Disconnect"],
        ["⌘Z / ⇧⌘Z", "Undo / redo (layout, wires, add/remove)"],
        ["⌘C / ⌘V", "Copy / paste nodes; paste an image to add it"],
        ["⌘D", "Duplicate"],
        ["⌘G", "Group / ungroup"],
        ["⌘A", "Select all"],
        ["⌘K", "Search nodes"],
        ["Delete", "Delete selection"],
        ["H / V", "Pan / box select"],
        ["Shift + drag", "Box select"],
        ["E / M", "Wires / minimap"],
      ];
  return (
    <Dialog title={zh ? "快捷键" : "Shortcuts"} onClose={onClose}>
      <dl className="nc-keys">
        {rows.map(([key, value]) => (
          <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </Dialog>
  );
}

export function TemplatesDialog({
  zh,
  builtin,
  saved,
  onInsert,
  onInsertSaved,
  onDeleteSaved,
  onClose,
}: {
  zh: boolean;
  builtin: CanvasTemplate[];
  saved: { id: string; name: string; graph: StoredGraph }[];
  onInsert: (template: CanvasTemplate) => void;
  onInsertSaved: (item: { id: string; name: string; graph: StoredGraph }) => void;
  onDeleteSaved: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={zh ? "模板" : "Templates"} onClose={onClose} wide>
      <div className="nc-templates">
        {builtin.map((template) => (
          <button key={template.id} type="button" className="nc-template" onClick={() => onInsert(template)}>
            <strong>{template.name}</strong>
            <span>{template.description}</span>
          </button>
        ))}
      </div>
      <h3 className="nc-subhead">{zh ? "我存的模板（只在这台设备）" : "Saved here"}</h3>
      {saved.length ? (
        <div className="nc-templates">
          {saved.map((item) => (
            <div key={item.id} className="nc-template is-saved">
              <button type="button" onClick={() => onInsertSaved(item)}>
                <strong>{item.name}</strong>
                <span>{zh ? `${item.graph.nodes.length} 个节点` : `${item.graph.nodes.length} nodes`}</span>
              </button>
              <button type="button" className="nc-icon-btn" onClick={() => onDeleteSaved(item.id)} aria-label={zh ? "删除模板" : "Delete template"}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="nc-muted">{zh ? "选中几个节点，在多选工具栏里点「存为模板」。" : "Select nodes and choose Save template."}</p>
      )}
    </Dialog>
  );
}

const ANGLES = [
  { id: "closeup", zh: "特写", en: "Close-up", promptZh: "保持主体外观与服装完全一致，改为电影级近景特写，突出表情与细节质感，浅景深", promptEn: "Keep the same subject and wardrobe, reframe as a cinematic close-up on face and texture, shallow depth of field" },
  { id: "medium", zh: "中景半身", en: "Medium shot", promptZh: "保持主体与光影风格一致，改为电影中景半身构图，姿态自然", promptEn: "Keep the same subject and lighting, reframe as a cinematic waist-up medium shot" },
  { id: "wide", zh: "广角全景", en: "Wide shot", promptZh: "保持主体与场景美术一致，拉远为 24mm 广角全景，展现完整环境", promptEn: "Keep the same subject and art direction, pull back to a 24mm wide establishing shot" },
  { id: "low", zh: "低角度仰拍", en: "Low angle", promptZh: "保持主体一致，改为低机位仰拍视角，增强戏剧张力", promptEn: "Keep the same subject, reframe from a dramatic low angle looking up" },
  { id: "over", zh: "过肩镜头", en: "Over the shoulder", promptZh: "保持主体与环境一致，改为过肩视角，前景柔和虚化", promptEn: "Keep subject and setting, reframe over the shoulder with soft foreground blur" },
  { id: "top", zh: "高空俯拍", en: "Top-down", promptZh: "保持主体与道具风格一致，改为 90 度垂直俯拍构图", promptEn: "Keep subject and styling, reframe as a 90-degree top-down composition" },
];

export function ShotsDialog({
  zh,
  imageUrl,
  models,
  onClose,
  onSubmit,
}: {
  zh: boolean;
  imageUrl: string;
  models: MarketModel[];
  onClose: () => void;
  onSubmit: (angles: { name: string; prompt: string }[], resolution: string, modelId: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>(["closeup", "medium", "wide"]);
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((item) => item.id === modelId) ?? models[0];
  const resolutions = model?.options.resolutions ?? [];
  const [resolution, setResolution] = useState(resolutions[0] ?? "");
  const [busy, setBusy] = useState(false);
  const each = model ? marketCredits(model, { prompt: "shot", resolution: resolution || undefined, count: 1, imageUrls: ["reference"] }) : 0;
  return (
    <Dialog title={zh ? "多机位分镜" : "Multi-angle shots"} onClose={onClose} wide>
      <div className="nc-shots">
        <img src={imageUrl} alt="" />
        <div className="nc-shots-side">
          <div className="nc-chips">
            {ANGLES.map((angle) => (
              <label key={angle.id} className={`nc-chip${picked.includes(angle.id) ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={picked.includes(angle.id)}
                  onChange={(event) => setPicked((list) => (event.target.checked ? [...list, angle.id] : list.filter((id) => id !== angle.id)))}
                />
                {zh ? angle.zh : angle.en}
              </label>
            ))}
          </div>
          <label className="nc-field">
            <span>{zh ? "模型" : "Model"}</span>
            <select value={modelId} onChange={(event) => { setModelId(event.target.value); setResolution(models.find((item) => item.id === event.target.value)?.options.resolutions?.[0] ?? ""); }}>
              {models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {resolutions.length ? (
            <label className="nc-field">
              <span>{zh ? "清晰度" : "Quality"}</span>
              <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                {resolutions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ) : null}
          <p className="nc-muted">{zh ? `每个机位生成一张新图并连到原图，共约 ${each * picked.length} 积分` : `One new image per angle, about ${each * picked.length} credits in all`}</p>
          <button
            type="button"
            className="nc-run"
            disabled={!picked.length || busy || !model}
            onClick={() => {
              setBusy(true);
              onSubmit(ANGLES.filter((angle) => picked.includes(angle.id)).map((angle) => ({ name: zh ? angle.zh : angle.en, prompt: zh ? angle.promptZh : angle.promptEn })), resolution, model!.id);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 nc-spin" /> : <Camera className="h-4 w-4" />}
            {zh ? `生成 ${picked.length} 个机位` : `Generate ${picked.length}`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function CompareOverlay({ zh, before, after, onClose }: { zh: boolean; before: string; after: string; onClose: () => void }) {
  const [split, setSplit] = useState(50);
  return (
    <Dialog title={zh ? "前后对比" : "Before / after"} onClose={onClose} wide>
      <div className="nc-compare" style={{ ["--split" as string]: `${split}%` }}>
        <img src={after} alt={zh ? "之后" : "After"} />
        <img src={before} alt={zh ? "之前" : "Before"} className="nc-compare-before" />
        <span className="nc-compare-line" aria-hidden="true" />
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(event) => setSplit(Number(event.target.value))} aria-label={zh ? "拖动对比分界线" : "Drag the divider"} className="nc-range" />
    </Dialog>
  );
}
