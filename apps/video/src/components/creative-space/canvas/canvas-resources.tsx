"use client";

import { ArrowUpRight, AudioLines, Bookmark, Crosshair, FolderOpen, Grid2X2, Grid3X3, Images, Play, Plus, Search, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Node } from "reactflow";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { hasOutput, isGenerationUuid, MAX_PAST_GENERATIONS, outputType, textOf, type CanvasData, type PortType, type RunStatus } from "@/lib/creative-space/canvas-graph";
import { resolveMedia } from "@/lib/creative-space/canvas-submit";
import { CANVAS_SOUNDS, getCanvasSound, SOUND_CATEGORIES, type SoundCategory } from "@/lib/creative-space/canvas-sounds";
import { kindIcon } from "./canvas-nodes";
import "./canvas-resources.css";

type CanvasNode = Node<CanvasData>;
type Section = "assets" | "history" | "sounds";
type Language = "zh" | "en";

interface CanvasResourcesProps {
  section: Section;
  zh: boolean;
  nodes: CanvasNode[];
  canvasFetch: typeof fetch;
  onClose: () => void;
  onLibrary: () => void;
  onTemplates: () => void;
  onFocus: (node: CanvasNode) => void;
  onSound: (id: string) => void;
}

const SECTION = {
  assets: { zh: "我的资产", en: "My assets" },
  history: { zh: "生成历史", en: "Generation history" },
  sounds: { zh: "音效库", en: "Sound library" },
};

const TYPES = {
  all: { zh: "全部", en: "All" },
  image: { zh: "图片", en: "Images" },
  video: { zh: "视频", en: "Videos" },
  audio: { zh: "音频", en: "Audio" },
  text: { zh: "文字", en: "Text" },
};

const STATUS: Record<RunStatus, Record<Language, string>> = {
  idle: { zh: "未运行", en: "Not run" },
  submitting: { zh: "提交中", en: "Submitting" },
  running: { zh: "生成中", en: "Generating" },
  failed: { zh: "生成失败", en: "Failed" },
  done: { zh: "已完成", en: "Completed" },
};

interface Entry {
  key: string;
  node: CanvasNode;
  type: PortType;
  label: string;
  text?: string;
  url?: string;
  uuid?: string;
  at?: number;
  currentRun?: boolean;
}

function entriesFor(node: CanvasNode, history: boolean, lang: Language): Entry[] {
  const data = node.data;
  const type = outputType(data);
  if (!type || data.kind === "group") return [];
  const base = { key: node.id, node, type };

  if (data.kind === "media") {
    if (history) return [];
    const sound = data.media === "audio" ? getCanvasSound(data.soundId) : undefined;
    if (!sound && !hasOutput(data)) return [];
    return [{ ...base, label: TYPES[type][lang], url: sound?.url ?? data.url }];
  }

  if (data.kind === "text" || data.kind === "agent") {
    const text = textOf(data) || (data.kind === "agent" ? data.reply?.trim() : "");
    if (history && (data.kind === "text" || data.status === "idle")) return [];
    if (!history && !text) return [];
    const label = history && data.kind === "agent" ? STATUS[data.status][lang] : TYPES.text[lang];
    return [{ ...base, text, label }];
  }

  if (history) {
    const run = (uuid: string, at?: number): Entry => ({
      ...base, key: `${node.id}/${uuid}`, uuid, at, currentRun: uuid === data.resultUuid,
      label: lang === "zh" ? "状态未确认" : "Status unconfirmed",
    });
    const past = (data.history ?? []).map(({ uuid, at }) => run(uuid, at));
    if (!data.inheritedResult && isGenerationUuid(data.resultUuid)) return [run(data.resultUuid, data.resultAt), ...past];
    if (data.status === "submitting" || data.status === "failed") {
      return [{ ...base, label: STATUS[data.status][lang], text: data.error || data.prompt }, ...past];
    }
    return past;
  }
  if (data.status !== "done") return [];

  // A batch contains alternatives from one run. Its output indexes aren't past runs.
  const urls = data.urls ?? [];
  const selected = Math.max(0, Math.min(data.resultIndex ?? 0, urls.length - 1));
  if (!urls.length) return [{ ...base, label: STATUS.done[lang] }];
  return urls.map((url, index) => {
    let label = STATUS.done[lang];
    if (urls.length > 1) {
      label = lang === "zh" ? `结果 ${index + 1} / ${urls.length}` : `Output ${index + 1} of ${urls.length}`;
      if (index === selected) label += lang === "zh" ? " · 已选" : " · Selected";
    }
    return { ...base, key: `${node.id}/${index}`, url, label };
  });
}

function ResourceCard({ entry, status, lang, onFocus }: { entry: Entry; status?: string; lang: Language; onFocus: (node: CanvasNode) => void }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const { node, type, text, uuid, at } = entry;
  const runStatus = status === "COMPLETED" ? STATUS.done[lang] : status === "FAILED" ? STATUS.failed[lang] :
    status === "PENDING" || status === "GENERATING" ? STATUS.running[lang] : entry.label;
  const label = entry.currentRun ? `${lang === "zh" ? "当前任务" : "Current job"} · ${runStatus}` : runStatus;
  const url = uuid ? (status === "COMPLETED" ? `/api/v1/creative-space/asset?uuid=${encodeURIComponent(uuid)}&index=0` : undefined) : entry.url;
  const date = at ? new Date(at).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : undefined;
  const recorded = date ? (lang === "zh" ? `记录于 ${date}` : `Recorded ${date}`) : (lang === "zh" ? "日期未记录" : "Date not recorded");
  const Icon = kindIcon(type);
  const title = node.data.title || TYPES[type][lang];
  const action = lang === "zh" ? "在画布中定位" : "Locate on canvas";
  const unavailable = lang === "zh" ? "暂无预览" : "Preview unavailable";
  const canPreview = url && url !== failedUrl;
  const failed = () => setFailedUrl(url);
  return (
    <li className="ncr-card">
      <div className="ncr-preview">
        {canPreview && type === "image" ? <img src={url} alt="" loading="lazy" onError={failed} /> :
          canPreview && type === "video" ? <video src={url} controls playsInline preload="metadata" aria-label={title} onError={failed} /> :
          canPreview && type === "audio" ? <><AudioLines aria-hidden="true" /><audio src={url} controls preload="none" aria-label={title} onError={failed} /></> :
          text ? <p>{text}</p> : <><Icon aria-hidden="true" /><span>{unavailable}</span></>}
      </div>
      <button type="button" className="ncr-locate" onClick={() => onFocus(node)} aria-label={`${action} · ${title} · ${label}${uuid ? ` · ${recorded}` : ""}`} title={action}>
        <span><strong>{title}</strong><small><Icon aria-hidden="true" />{label}</small>{uuid && <small>{recorded}</small>}</span>
        <Crosshair aria-hidden="true" />
      </button>
    </li>
  );
}

function NodeResults({ nodes, history, lang, onFocus, canvasFetch }: {
  nodes: CanvasNode[]; history: boolean; lang: Language; onFocus: (node: CanvasNode) => void; canvasFetch: typeof fetch;
}) {
  const [type, setType] = useState<keyof typeof TYPES>("all");
  const [compact, setCompact] = useState(false);
  const entries = useMemo(() => {
    const list = nodes.flatMap((node) => entriesFor(node, history, lang));
    return history ? list.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)) : list;
  }, [nodes, history, lang]);
  const jobIds = [...new Set(entries.flatMap((entry) => entry.uuid ? [entry.uuid] : []))].sort().join(",");
  const [statuses, setStatuses] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    if (!jobIds) return;
    let open = true;
    let timer: ReturnType<typeof setTimeout>;
    const checked = new Map<string, string>();
    async function check(ids: string[]) {
      const pending: string[] = [];
      // The authorized resolver accepts at most 200 UUIDs per request.
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        const { results } = await resolveMedia(batch, [], canvasFetch);
        if (!open) return;
        for (const id of batch) {
          const status = results[id]?.status ?? "";
          checked.set(id, status);
          if (status === "PENDING" || status === "GENERATING") pending.push(id);
        }
        setStatuses(new Map(checked));
      }
      if (pending.length) timer = setTimeout(() => void check(pending), 8000);
    }
    void check(jobIds.split(","));
    return () => { open = false; clearTimeout(timer); };
  }, [jobIds, canvasFetch]);
  const results = entries.filter((entry) => type === "all" || type === entry.type);
  const zh = lang === "zh";
  return (
    <>
      <div className="ncr-toolbar">
        <label className="ncr-type">{zh ? "类型" : "Type"}
          <select value={type} onChange={(event) => setType(event.target.value as keyof typeof TYPES)}>
            {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map((id) => <option key={id} value={id}>{TYPES[id][lang]}</option>)}
          </select>
        </label>
        {history && (
          <fieldset className="ncr-sizes">
            <legend className="sr-only">{zh ? "卡片大小" : "Card size"}</legend>
            {[{ small: true, Icon: Grid3X3, title: zh ? "小卡片" : "Small cards" }, { small: false, Icon: Grid2X2, title: zh ? "大卡片" : "Large cards" }].map(({ small, Icon, title }) => (
              <button key={title} type="button" title={title} aria-label={title} aria-pressed={compact === small} onClick={() => setCompact(small)}><Icon aria-hidden="true" /></button>
            ))}
          </fieldset>
        )}
      </div>
      <div className="ncr-scroll">
        {results.length ? (
          <ul className={`ncr-grid${compact ? " is-compact" : ""}`} onPlayCapture={(event) => {
            for (const player of event.currentTarget.querySelectorAll<HTMLMediaElement>("audio,video")) {
              if (player !== event.target && !player.paused) player.pause();
            }
          }}>
            {results.map((entry) => <ResourceCard key={entry.key} entry={entry} status={entry.uuid ? statuses.get(entry.uuid) : undefined} lang={lang} onFocus={onFocus} />)}
          </ul>
        ) : <p className="ncr-empty">{entries.length ? (zh ? "当前类型没有结果" : "No results of this type") :
          history ? (zh ? "当前画布还没有生成记录" : "No generations on this canvas yet") :
            (zh ? "当前画布还没有资产" : "No assets on this canvas yet")}</p>}
      </div>
    </>
  );
}

function SoundLibrary({ lang, onSound }: { lang: Language; onSound: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | SoundCategory>("all");
  const [playing, setPlaying] = useState<string>();
  const [failed, setFailed] = useState<string>();
  const player = useRef<HTMLAudioElement | null>(null);
  const zh = lang === "zh";
  const needle = query.trim().toLowerCase();
  const matches = CANVAS_SOUNDS.filter((sound) => (category === "all" || sound.category === category) &&
    [sound.name.zh, sound.name.en, sound.description.zh, sound.description.en].some((value) => value.toLowerCase().includes(needle)));

  function releasePlayer() {
    const audio = player.current;
    if (!audio) return;
    player.current = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  useLayoutEffect(() => releasePlayer, []);

  function stop() {
    releasePlayer();
    setPlaying(undefined);
    setFailed(undefined);
  }

  function toggle(sound: (typeof CANVAS_SOUNDS)[number]) {
    stop();
    if (playing === sound.id) return;
    const audio = new Audio(sound.url);
    player.current = audio;
    setPlaying(sound.id);
    const finish = (error: boolean) => {
      if (player.current !== audio) return;
      stop();
      if (error) setFailed(sound.id);
    };
    audio.onended = () => finish(false);
    audio.onerror = () => finish(true);
    void audio.play().catch(() => finish(true));
  }

  return (
    <>
      <div className="ncr-toolbar ncr-sound-tools">
        <label className="nc-search ncr-search"><Search aria-hidden="true" />
          <input type="search" value={query} placeholder={zh ? "搜索名称或描述" : "Search names or descriptions"}
            aria-label={zh ? "搜索音效" : "Search sounds"} onChange={(event) => { stop(); setQuery(event.target.value); }} />
        </label>
        <label className="ncr-type">{zh ? "类别" : "Category"}
          <select value={category} onChange={(event) => { stop(); setCategory(event.target.value as typeof category); }}>
            <option value="all">{TYPES.all[lang]}</option>
            {(Object.keys(SOUND_CATEGORIES) as SoundCategory[]).map((id) => <option key={id} value={id}>{SOUND_CATEGORIES[id][lang]}</option>)}
          </select>
        </label>
      </div>
      <div className="ncr-scroll">
        {matches.length ? <ul className="ncr-tracks">
          {matches.map((sound) => {
            const active = playing === sound.id;
            const toggleLabel = active ? (zh ? "停止" : "Stop") : (zh ? "试听" : "Preview");
            const insertLabel = zh ? "插入" : "Insert";
            return (
              <li key={sound.id} className="ncr-track">
                <button type="button" className="ncr-play" aria-label={`${toggleLabel} · ${sound.name[lang]}`} aria-pressed={active} onClick={() => toggle(sound)}>
                  {active ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <div className="ncr-track-copy"><strong>{sound.name[lang]}</strong><p>{sound.description[lang]}</p>
                  {failed === sound.id && <output>{zh ? "试听失败，可重试" : "Preview failed. Try again."}</output>}
                </div>
                <span className="ncr-category">{SOUND_CATEGORIES[sound.category][lang]}</span>
                <span className="ncr-duration">{sound.seconds} s</span>
                <button type="button" className="nc-btn ncr-insert" aria-label={`${insertLabel} · ${sound.name[lang]}`} onClick={() => { stop(); onSound(sound.id); }}>
                  <Plus aria-hidden="true" /><span>{insertLabel}</span>
                </button>
              </li>
            );
          })}
        </ul> : <p className="ncr-empty">{zh ? "没有匹配的音效" : "No matching sounds"}</p>}
      </div>
    </>
  );
}

export function CanvasResources({ section, zh, nodes, canvasFetch, onClose, onLibrary, onTemplates, onFocus, onSound }: CanvasResourcesProps) {
  const lang = zh ? "zh" : "en";
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="ncr-panel" aria-modal="true" aria-describedby={undefined} onOpenAutoFocus={(event) => {
        event.preventDefault();
        heading.current?.focus({ preventScroll: true });
      }}>
        <header className="ncr-head">
          <DialogTitle ref={heading} tabIndex={-1}>{SECTION[section][lang]}</DialogTitle>
          {section === "history" && <p>{zh ? `仅显示当前画布现存节点的生成记录。每个生成节点保留当前任务和最近 ${MAX_PAST_GENERATIONS} 个历史任务。` : `History covers nodes still on this canvas. Each generation node keeps its current job and up to ${MAX_PAST_GENERATIONS} previous jobs.`}</p>}
        </header>
        {section === "assets" && <nav className="ncr-nav" aria-label={SECTION.assets[lang]}>
          <button type="button" onClick={() => { onClose(); onLibrary(); }}><FolderOpen aria-hidden="true" />{zh ? "素材库" : "Media library"}<ArrowUpRight aria-hidden="true" /></button>
          <span aria-current="page"><Images aria-hidden="true" />{zh ? "当前画布资产" : "Canvas assets"}</span>
          <button type="button" onClick={() => { onClose(); onTemplates(); }}><Bookmark aria-hidden="true" />{zh ? "我的模板" : "My templates"}<ArrowUpRight aria-hidden="true" /></button>
        </nav>}
        {section === "sounds" ? <SoundLibrary lang={lang} onSound={(id) => { onClose(); onSound(id); }} /> :
          <NodeResults key={section} nodes={nodes} history={section === "history"} lang={lang} canvasFetch={canvasFetch} onFocus={(node) => { onClose(); onFocus(node); }} />}
      </DialogContent>
    </Dialog>
  );
}
