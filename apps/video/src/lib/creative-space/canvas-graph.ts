// Node canvas model for /creative-space/canvas.
//
// The interaction design (typed ports, structure-only undo, drag-a-wire-to-
// empty-space, group frames, layered auto-arrange) follows Toonflow's canvas
// (https://github.com/HBAI-Ltd/Toonflow-app, MIT, Copyright (c) 2026 HBAI-Ltd;
// see THIRD_PARTY_NOTICES.md). This file is our own React/TypeScript
// implementation: every generation goes through our own API and credits.
//
// Pure functions only, so the rules are unit-tested in tests/canvas-graph.test.ts.

export type PortType = "text" | "image" | "video" | "audio";
export type CanvasKind = "text" | "media" | "image" | "video" | "audio" | "agent" | "group";
export type RunStatus = "idle" | "submitting" | "running" | "done" | "failed";

/** An unanswered generation request: retried under the same key, it cannot charge twice. */
export interface PendingSubmit {
  key: string;
  signature: string;
  at: number;
}

export const PIN_COLORS = ["red", "yellow", "green", "blue", "purple"] as const;
export type PinColor = (typeof PIN_COLORS)[number];

interface Pinnable {
  pins?: PinColor[];
}

export interface TextData extends Pinnable {
  kind: "text";
  title: string;
  text: string;
}

export interface MediaData extends Pinnable {
  kind: "media";
  title: string;
  media: "image" | "video" | "audio";
  mime: string;
  /** Upload in media_assets (owned by the user). */
  assetKey?: string;
  /** Finished generation (videos.uuid) and which of its outputs. */
  resultUuid?: string;
  resultIndex?: number;
  /** File kept in this browser (IndexedDB) until it is uploaded on save. */
  localId?: string;
  /** Display URL; never stored, resolved again on open. */
  url?: string;
  /** Upload in progress; never stored. */
  busy?: boolean;
}

export interface GenerateData extends Pinnable {
  kind: "image" | "video" | "audio";
  title: string;
  prompt: string;
  modelId: string;
  aspect?: string;
  resolution?: string;
  duration?: number;
  count?: number;
  audio?: boolean;
  voice?: string;
  style?: string;
  status: RunStatus;
  resultUuid?: string;
  resultIndex?: number;
  error?: string | null;
  pending?: PendingSubmit;
  /** Mask image (upload key) sent after the wired references, for inpaint / erase. */
  maskKey?: string;
  /** Output URLs; never stored. */
  urls?: string[];
}

export interface AgentStep {
  title: string;
  instruction: string;
}

export interface AgentData extends Pinnable {
  kind: "agent";
  title: string;
  prompt: string;
  status: RunStatus;
  reply?: string;
  generationPrompt?: string;
  steps?: AgentStep[];
  error?: string | null;
}

export interface GroupData extends Pinnable {
  kind: "group";
  title: string;
  tone?: GroupTone;
}

export const GROUP_TONES = ["neutral", "accent", "warm", "cool"] as const;
export type GroupTone = (typeof GROUP_TONES)[number];

export type CanvasData = TextData | MediaData | GenerateData | AgentData | GroupData;

/** The subset of a React Flow node these functions read and write. */
export interface GraphNode<D extends CanvasData = CanvasData> {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: D;
  parentNode?: string;
  style?: { width?: number; height?: number } & Record<string, unknown>;
  width?: number | null;
  height?: number | null;
  zIndex?: number;
  selected?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface StoredGraph {
  version: 2;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport?: Viewport;
}

/* -------------------------------------------------------------------------- */
/* Ports                                                                      */
/* -------------------------------------------------------------------------- */

export function outputType(data: CanvasData): PortType | null {
  switch (data.kind) {
    case "text":
    case "agent":
      return "text";
    case "media":
      return data.media;
    case "image":
    case "video":
    case "audio":
      return data.kind;
    default:
      return null;
  }
}

const INPUTS: Record<CanvasKind, PortType[]> = {
  text: [],
  media: [],
  group: [],
  image: ["text", "image"],
  video: ["text", "image"],
  audio: ["text"],
  agent: ["text", "image", "video"],
};

export function inputTypes(kind: CanvasKind): PortType[] {
  return INPUTS[kind];
}

/** Node kinds that accept a wire of this type, for the "drop wire on empty space" menu. */
export function kindsAccepting(type: PortType): CanvasKind[] {
  return (Object.keys(INPUTS) as CanvasKind[]).filter((kind) => INPUTS[kind].includes(type));
}

export type ConnectionCheck = { ok: true } | { ok: false; reason: "self" | "no-output" | "type" | "duplicate" | "cycle" | "missing" };

export function checkConnection(
  source: string | null | undefined,
  target: string | null | undefined,
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): ConnectionCheck {
  if (!source || !target) return { ok: false, reason: "missing" };
  if (source === target) return { ok: false, reason: "self" };
  const from = nodes.find((node) => node.id === source);
  const to = nodes.find((node) => node.id === target);
  if (!from || !to) return { ok: false, reason: "missing" };
  const type = outputType(from.data);
  if (!type) return { ok: false, reason: "no-output" };
  if (!inputTypes(to.data.kind).includes(type)) return { ok: false, reason: "type" };
  if (edges.some((edge) => edge.source === source && edge.target === target)) return { ok: false, reason: "duplicate" };
  // A wire from target back to source would close a loop.
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return { ok: false, reason: "cycle" };
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of edges) if (edge.source === current) stack.push(edge.target);
  }
  return { ok: true };
}

/** Direct inputs of a node, in wire order. */
export function directInputs(id: string, nodes: readonly GraphNode[], edges: readonly GraphEdge[]): GraphNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges
    .filter((edge) => edge.target === id)
    .map((edge) => byId.get(edge.source))
    .filter((node): node is GraphNode => Boolean(node));
}

/** Text a node contributes downstream (text cards, Agent generation prompts). */
export function textOf(data: CanvasData): string {
  if (data.kind === "text") return data.text.trim();
  if (data.kind === "agent") return (data.generationPrompt ?? "").trim();
  return "";
}

/** Whether a node has a finished output another node can use. */
export function hasOutput(data: CanvasData): boolean {
  if (data.kind === "text") return data.text.trim().length > 0;
  if (data.kind === "agent") return Boolean(data.generationPrompt?.trim());
  if (data.kind === "media") return Boolean(data.assetKey || data.resultUuid || data.localId || data.url);
  if (data.kind === "image" || data.kind === "video" || data.kind === "audio") return data.status === "done" && Boolean(data.resultUuid);
  return false;
}

/* -------------------------------------------------------------------------- */
/* Submissions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Key for a generation request. A request whose answer never arrived is sent
 * again under its old key, however long ago (the server returns the job it
 * may have created instead of charging again); a changed request gets a new
 * key. `pending` is cleared once an answer arrives.
 */
export function submitKey(pending: PendingSubmit | undefined, signature: string, makeKey: () => string): { key: string; reused: boolean } {
  if (pending && pending.signature === signature) return { key: pending.key, reused: true };
  return { key: makeKey(), reused: false };
}

/** An upload key in our bucket (never a URL): what may be stored as `assetKey`. */
export function isUploadKey(value: unknown): value is string {
  return typeof value === "string" && /^uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9_./-]+$/.test(value) && !value.includes("..");
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

function storedData(data: CanvasData): CanvasData {
  if (data.kind === "media") {
    const { url: _url, busy: _busy, assetKey, ...rest } = data;
    return isUploadKey(assetKey) ? { ...rest, assetKey } : rest;
  }
  if (data.kind === "image" || data.kind === "video" || data.kind === "audio") {
    const { urls: _urls, ...rest } = data;
    return rest;
  }
  return data;
}

/** What is saved: structure and stable references only, never URLs or files. */
/** A media node with nothing to point at (an upload not even kept locally yet) is not saved. */
function storable(node: GraphNode): boolean {
  const data = node.data;
  return data.kind !== "media" || isUploadKey(data.assetKey) || Boolean(data.resultUuid || data.localId);
}

export function toStoredGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[], viewport?: Viewport): StoredGraph {
  const kept = nodes.filter(storable);
  const ids = new Set(kept.map((node) => node.id));
  return {
    version: 2,
    nodes: kept.map((node) => {
      const width = node.style?.width ?? node.width ?? undefined;
      const height = node.style?.height ?? node.height ?? undefined;
      const sized = node.data.kind === "group" || node.data.kind === "text";
      return {
        id: node.id,
        type: node.data.kind,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        data: storedData(node.data),
        ...(node.parentNode ? { parentNode: node.parentNode } : {}),
        ...(sized && width && height ? { style: { width: Math.round(width), height: Math.round(height) } } : {}),
        ...(node.data.kind === "group" ? { zIndex: -1 } : {}),
      };
    }),
    edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map(({ id, source, target }) => ({ id, source, target })),
    ...(viewport ? { viewport: { x: Math.round(viewport.x), y: Math.round(viewport.y), zoom: Number(viewport.zoom.toFixed(3)) } } : {}),
  };
}

const RUN_STATES: RunStatus[] = ["idle", "submitting", "running", "done", "failed"];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Reads one stored node's data defensively (stored JSON is user-controlled). */
export function normalizeData(raw: Record<string, unknown>, unknownRequest: string): CanvasData | null {
  const rawPins = raw.pins;
  const pins = Array.isArray(rawPins) ? PIN_COLORS.filter((color) => rawPins.includes(color)) : [];
  const common = { title: str(raw.title), ...(pins.length ? { pins } : {}) };
  const kind = raw.kind;
  if (kind === "text") return { kind, ...common, text: str(raw.text) };
  if (kind === "group") {
    const tone = GROUP_TONES.includes(raw.tone as GroupTone) ? (raw.tone as GroupTone) : undefined;
    return { kind, ...common, ...(tone ? { tone } : {}) };
  }
  if (kind === "media") {
    const media = raw.media === "video" || raw.media === "audio" ? raw.media : "image";
    return {
      kind,
      media,
      ...common,
      mime: str(raw.mime, `${media}/*`),
      ...(isUploadKey(raw.assetKey) ? { assetKey: raw.assetKey } : {}),
      ...(typeof raw.resultUuid === "string" ? { resultUuid: raw.resultUuid, resultIndex: num(raw.resultIndex) ?? 0 } : {}),
      ...(typeof raw.localId === "string" ? { localId: raw.localId } : {}),
    };
  }
  if (kind === "agent") {
    let status = RUN_STATES.includes(raw.status as RunStatus) ? (raw.status as RunStatus) : "idle";
    if (status === "running" || status === "submitting") status = "idle";
    const steps = Array.isArray(raw.steps)
      ? raw.steps
          .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object")
          .map((step) => ({ title: str(step.title), instruction: str(step.instruction) }))
      : undefined;
    return {
      kind,
      ...common,
      prompt: str(raw.prompt),
      status,
      ...(typeof raw.reply === "string" ? { reply: raw.reply } : {}),
      ...(typeof raw.generationPrompt === "string" ? { generationPrompt: raw.generationPrompt } : {}),
      ...(steps ? { steps } : {}),
    };
  }
  if (kind === "image" || kind === "video" || kind === "audio") {
    let status = RUN_STATES.includes(raw.status as RunStatus) ? (raw.status as RunStatus) : "idle";
    const resultUuid = typeof raw.resultUuid === "string" ? raw.resultUuid : undefined;
    const pendingRaw = raw.pending as Record<string, unknown> | undefined;
    const pending =
      pendingRaw && typeof pendingRaw.key === "string" && typeof pendingRaw.signature === "string"
        ? { key: pendingRaw.key, signature: pendingRaw.signature, at: num(pendingRaw.at) ?? 0 }
        : undefined;
    let error = typeof raw.error === "string" ? raw.error : null;
    if (status === "running" && !resultUuid) status = "idle";
    if (status === "done" && !resultUuid) status = "idle";
    // Closed while the request was in flight: the outcome is unknown, and a
    // retry reuses the saved key.
    if (status === "submitting") {
      status = "failed";
      error = unknownRequest;
    }
    return {
      kind,
      ...common,
      prompt: str(raw.prompt),
      modelId: str(raw.modelId),
      ...(typeof raw.aspect === "string" ? { aspect: raw.aspect } : {}),
      ...(typeof raw.resolution === "string" ? { resolution: raw.resolution } : {}),
      ...(num(raw.duration) !== undefined ? { duration: num(raw.duration) } : {}),
      ...(num(raw.count) !== undefined ? { count: num(raw.count) } : {}),
      ...(typeof raw.audio === "boolean" ? { audio: raw.audio } : {}),
      ...(typeof raw.voice === "string" ? { voice: raw.voice } : {}),
      ...(typeof raw.style === "string" ? { style: raw.style } : {}),
      status,
      ...(resultUuid ? { resultUuid, resultIndex: num(raw.resultIndex) ?? 0 } : {}),
      ...(error ? { error } : {}),
      ...(pending ? { pending } : {}),
      ...(isUploadKey(raw.maskKey) ? { maskKey: raw.maskKey } : {}),
    };
  }
  return null;
}

/** Version 1 canvases (the old workflow editor): one "creativeNode" type, kind in data. */
function migrateV1(raw: Record<string, unknown>): CanvasData | null {
  const kind = raw.kind;
  const prompt = str(raw.prompt);
  const status: RunStatus = raw.status === "COMPLETED" ? "done" : raw.status === "FAILED" ? "failed" : raw.status === "running" ? "running" : "idle";
  if (kind === "text") return { kind: "text", title: str(raw.title), text: prompt };
  if (kind === "asset") {
    const mime = str(raw.assetMime, "image/*");
    const media = mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "image";
    return {
      kind: "media",
      media,
      mime,
      title: str(raw.assetName, str(raw.title)),
      ...(isUploadKey(raw.assetKey) ? { assetKey: raw.assetKey } : {}),
      ...(typeof raw.resultUuid === "string" ? { resultUuid: raw.resultUuid, resultIndex: num(raw.resultIndex) ?? 0 } : {}),
      ...(typeof raw.assetSourceId === "string" && !isUploadKey(raw.assetKey) && typeof raw.resultUuid !== "string" ? { localId: raw.assetSourceId } : {}),
    };
  }
  if (kind === "agent") {
    return {
      kind: "agent",
      title: str(raw.title),
      prompt,
      status: status === "done" ? "done" : "idle",
      ...(typeof raw.resultText === "string" ? { reply: raw.resultText } : {}),
      ...(typeof raw.generationPrompt === "string" ? { generationPrompt: raw.generationPrompt } : {}),
    };
  }
  if (kind === "image" || kind === "video") {
    const resultUuid = typeof raw.resultUuid === "string" ? raw.resultUuid : undefined;
    return {
      kind,
      title: str(raw.title),
      prompt,
      modelId: str(raw.modelId),
      ...(typeof raw.aspect === "string" ? { aspect: raw.aspect } : {}),
      ...(typeof raw.resolution === "string" ? { resolution: raw.resolution } : {}),
      ...(num(raw.duration) !== undefined ? { duration: num(raw.duration) } : {}),
      ...(typeof raw.audio === "boolean" ? { audio: raw.audio } : {}),
      status: resultUuid ? (status === "idle" ? "running" : status) : status === "failed" ? "failed" : "idle",
      ...(resultUuid ? { resultUuid, resultIndex: num(raw.resultIndex) ?? 0 } : {}),
    };
  }
  return null;
}

/** Reads a saved canvas (either version) into nodes and edges; drops anything invalid. */
export function fromStoredGraph(graph: unknown, unknownRequest: string): { nodes: GraphNode[]; edges: GraphEdge[]; viewport?: Viewport } {
  const value = (graph && typeof graph === "object" ? graph : {}) as Record<string, unknown>;
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const rawEdges = Array.isArray(value.edges) ? value.edges : [];
  const v2 = value.version === 2;
  const nodes: GraphNode[] = [];
  for (const item of rawNodes) {
    if (!item || typeof item !== "object") continue;
    const node = item as Record<string, unknown>;
    const data = node.data && typeof node.data === "object" ? (node.data as Record<string, unknown>) : null;
    const position = node.position as { x?: unknown; y?: unknown } | undefined;
    if (typeof node.id !== "string" || !data || typeof position?.x !== "number" || typeof position?.y !== "number") continue;
    const normalized = v2 ? normalizeData(data, unknownRequest) : migrateV1(data);
    if (!normalized) continue;
    const style = node.style as { width?: unknown; height?: unknown } | undefined;
    const width = num(style?.width);
    const height = num(style?.height);
    nodes.push({
      id: node.id,
      type: normalized.kind,
      position: { x: position.x, y: position.y },
      data: normalized,
      ...(v2 && typeof node.parentNode === "string" ? { parentNode: node.parentNode } : {}),
      ...(width && height ? { style: { width, height } } : {}),
      ...(normalized.kind === "group" ? { zIndex: -1 } : {}),
    });
  }
  const ids = new Set(nodes.map((node) => node.id));
  const groups = new Set(nodes.filter((node) => node.data.kind === "group").map((node) => node.id));
  for (const node of nodes) if (node.parentNode && (!groups.has(node.parentNode) || node.data.kind === "group")) node.parentNode = undefined;
  const edges: GraphEdge[] = [];
  for (const item of rawEdges) {
    if (!item || typeof item !== "object") continue;
    const edge = item as Record<string, unknown>;
    if (typeof edge.id !== "string" || typeof edge.source !== "string" || typeof edge.target !== "string") continue;
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    if (!checkConnection(edge.source, edge.target, nodes, edges).ok) continue;
    edges.push({ id: edge.id, source: edge.source, target: edge.target });
  }
  const vp = value.viewport as Record<string, unknown> | undefined;
  const viewport = vp && num(vp.x) !== undefined && num(vp.y) !== undefined && num(vp.zoom) !== undefined
    ? { x: vp.x as number, y: vp.y as number, zoom: vp.zoom as number }
    : undefined;
  return { nodes: parentsFirst(nodes), edges, ...(viewport ? { viewport } : {}) };
}

/** React Flow needs a parent before its children in the node array. */
export function parentsFirst<T extends GraphNode>(nodes: readonly T[]): T[] {
  return [...nodes.filter((node) => node.data.kind === "group"), ...nodes.filter((node) => node.data.kind !== "group")];
}

/* -------------------------------------------------------------------------- */
/* Old browser-only canvas (aivd:dreamina-canvas:v2)                          */
/* -------------------------------------------------------------------------- */

export const LEGACY_CANVAS_KEY = "aivd:dreamina-canvas:v2";

/**
 * The previous infinite canvas kept everything in localStorage. Converts what
 * can be kept: text cards, groups, uploads with a storage key and finished or
 * running generations. Browser-only files (blob:) and bare links cannot be
 * kept and are counted in `skipped`.
 */
export function fromLegacyLocalCanvas(value: unknown, makeId: () => string): { title: string; nodes: GraphNode[]; edges: GraphEdge[]; skipped: number } {
  const project = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawNodes = Array.isArray(project.nodes) ? project.nodes : [];
  const rawEdges = Array.isArray(project.edges) ? project.edges : [];
  const idMap = new Map<string, string>();
  const nodes: GraphNode[] = [];
  let skipped = 0;
  for (const item of rawNodes) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const x = num(raw.x) ?? 0;
    const y = num(raw.y) ?? 0;
    const width = num(raw.width) ?? 280;
    const title = str(raw.title, str(raw.name));
    const id = makeId();
    let data: CanvasData | null = null;
    let style: GraphNode["style"];
    if (raw.kind === "text") {
      data = { kind: "text", title, text: str(raw.content) };
      style = { width, height: num(raw.height) ?? 180 };
    } else if (raw.kind === "group") {
      data = { kind: "group", title };
      style = { width, height: num(raw.height) ?? 320 };
    } else if (raw.kind === "image" || raw.kind === "video" || raw.kind === "audio") {
      const media = raw.kind;
      const jobUuid = typeof raw.jobUuid === "string" ? raw.jobUuid : undefined;
      // Older library picks stored a signed URL here; only real upload keys are kept.
      const storageKey = isUploadKey(raw.storageKey) ? raw.storageKey : undefined;
      if (jobUuid) data = { kind: "media", media, title, mime: `${media}/*`, resultUuid: jobUuid, resultIndex: 0 };
      else if (storageKey) data = { kind: "media", media, title, mime: `${media}/*`, assetKey: storageKey };
    }
    if (!data) {
      skipped += 1;
      continue;
    }
    if (typeof raw.id === "string") idMap.set(raw.id, id);
    nodes.push({ id, type: data.kind, position: { x, y }, data, ...(style ? { style } : {}), ...(data.kind === "group" ? { zIndex: -1 } : {}) });
  }
  const edges: GraphEdge[] = [];
  for (const item of rawEdges) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const source = idMap.get(str(raw.fromId));
    const target = idMap.get(str(raw.toId));
    if (!source || !target || !checkConnection(source, target, nodes, edges).ok) continue;
    edges.push({ id: makeId(), source, target });
  }
  return { title: str(project.title), nodes: parentsFirst(nodes), edges, skipped };
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Layered left-to-right arrangement of top-level boxes (Toonflow arranges with
 * dagre; this is the same idea without the dependency): each box goes one
 * column right of its furthest input, columns keep their current vertical
 * order, and boxes never overlap.
 */
export function arrangeBoxes(boxes: readonly Box[], links: readonly { source: string; target: string }[], gapX = 96, gapY = 40): Map<string, { x: number; y: number }> {
  const ids = new Set(boxes.map((box) => box.id));
  const incoming = new Map<string, string[]>();
  for (const link of links) {
    if (!ids.has(link.source) || !ids.has(link.target) || link.source === link.target) continue;
    incoming.set(link.target, [...(incoming.get(link.target) ?? []), link.source]);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const value = Math.max(-1, ...(incoming.get(id) ?? []).map(depthOf)) + 1;
    visiting.delete(id);
    depth.set(id, value);
    return value;
  };
  for (const box of boxes) depthOf(box.id);
  const columns = new Map<number, Box[]>();
  for (const box of boxes) {
    const column = depth.get(box.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), box]);
  }
  const originX = Math.min(...boxes.map((box) => box.x));
  const originY = Math.min(...boxes.map((box) => box.y));
  const result = new Map<string, { x: number; y: number }>();
  let x = originX;
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const items = (columns.get(column) ?? []).sort((a, b) => a.y - b.y || a.x - b.x);
    let y = originY;
    for (const box of items) {
      result.set(box.id, { x, y });
      y += box.height + gapY;
    }
    x += Math.max(...items.map((box) => box.width)) + gapX;
  }
  return result;
}

/** Snapshot key for undo history: structure only (positions, sizes, wires, names). */
export function structureKey(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): string {
  return JSON.stringify({
    n: nodes.map((node) => [node.id, node.data.kind, Math.round(node.position.x), Math.round(node.position.y), node.parentNode ?? "", node.style?.width ?? "", node.style?.height ?? "", node.data.title]),
    e: edges.map((edge) => [edge.source, edge.target]),
  });
}
