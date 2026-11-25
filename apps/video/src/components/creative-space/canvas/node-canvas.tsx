"use client";

// The node canvas at /creative-space/canvas. Interaction design after
// Toonflow's canvas (MIT, see THIRD_PARTY_NOTICES.md); implementation, data,
// generation and billing are our own (see lib/creative-space/canvas-graph.ts).

import {
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyStart,
  Bookmark,
  ChevronDown,
  Play,
  Download,
  Film,
  Grid3x3,
  Hand,
  Image as ImageIcon,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  MousePointer2,
  Plus,
  Trash2,
  Unlink,
  Upload,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  MiniMap,
  type Node,
  type NodeChange,
  type OnConnectStartParams,
  NodeToolbar,
  Position,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import {
  type AgentData,
  acceptGeneration,
  arrangeBoxes,
  type CanvasData,
  type CanvasKind,
  checkConnection,
  copyGenerationSettings,
  directInputs,
  fromLegacyLocalCanvas,
  fromStoredGraph,
  type GenerateData,
  type GraphEdge,
  type GraphNode,
  hasOutput,
  isGenerationUuid,
  isUploadKey,
  kindsAccepting,
  LEGACY_CANVAS_KEY,
  type MediaData,
  outputType,
  parentsFirst,
  type PortType,
  structureKey,
  submitKey,
  inputText,
  inputTypes,
  selectionWithChildren,
  worldPosition,
  toStoredGraph,
} from "@/lib/creative-space/canvas-graph";
import { jobStatus, postGeneration, resolveMedia } from "@/lib/creative-space/canvas-submit";
import { buildCanvasAgentForm } from "@/lib/creative-space/agent-form";
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { listGuestAssets, type PickerAsset, removeGuestAsset, saveGuestAsset } from "@/lib/home-media-library";
import { UploadError, uploadErrorText, uploadImage } from "@/lib/image-to-video";
import { localizedHref } from "@/lib/locale-path";
import { errorMessage } from "@/lib/media-studio";
import { CanvasEditModal, type CanvasEditAction, type CanvasEditSubmit } from "../canvas-inpaint-modal";
import { CanvasActionsContext, type CanvasActions, KIND_LABEL, kindIcon, NODE_TYPES } from "./canvas-nodes";
import { CompareOverlay, NodeSearch, ShortcutsDialog, ShotsDialog, TemplatesDialog, type CanvasTemplate } from "./canvas-overlays";
import type { CanvasReference } from "./canvas-prompt";
import { CanvasViewMenu, useCanvasViewOptions } from "./canvas-view";
import { submissionDelay } from "@/lib/creative-space/submission-delay";
import { appearanceStyle, useCanvasBackground } from "./canvas-appearance";
import { PinRail } from "./canvas-pins";
import { buildRequest, choicesFor, defaultsFor, IMAGE_MODELS, quote, withModel } from "./model-options";
import { CanvasDock, type CanvasPanel } from "./canvas-dock";
import { CanvasHeader } from "./canvas-header";
import { CanvasResources } from "./canvas-resources";
import { getCanvasSound } from "@/lib/creative-space/canvas-sounds";
import "./node-canvas.css";
import "./canvas-chrome.css";
import "./node-interactions.css";
import { canvasGroupPlan, runCanvasGroup } from "@/lib/creative-space/canvas-group-run";
import { CANVAS_EDGE_TYPES } from "./canvas-wire";
import { GraphContextMenu } from "./graph-context-menu";

type FlowNode = Node<CanvasData>;
type CanvasSummary = { id: string; name: string; updatedAt: string | number };
type SaveState = "idle" | "local" | "dirty" | "saving" | "saved" | "error";
type LinkOrigin = { id: string; side: "source" | "target"; type?: PortType };
type Menu = { x: number; y: number; flow: { x: number; y: number }; from?: LinkOrigin; panel?: "pane" | "node"; palette?: boolean; id?: string };
type Toast = { text: string; error?: boolean };

const DRAFT_KEY = "aivd:node-canvas:draft";
const LEGACY_DONE_KEY = "aivd:node-canvas:legacy-imported";
/** Draft of the old workflow editor (kept in this browser). */
const LEGACY_FLOW_KEY = "aivd:creative-workflow-draft";
const TEMPLATES_PREFIX = "aivd:node-canvas-templates:v1";
const HANDOFF_KEY = "aivd:canvas-handoff";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const HISTORY_LIMIT = 100;
const POLL_MS = 4000;
const GEN_KINDS = new Set(["image", "video", "audio"]);

const isGen = (data: CanvasData): data is GenerateData => GEN_KINDS.has(data.kind);
const newId = () => crypto.randomUUID();

function nodeSize(kind: CanvasKind): { width: number; height: number } | undefined {
  if (kind === "text") return { width: 280, height: 280 };
  if (kind === "group") return { width: 640, height: 420 };
  return undefined;
}

/** Output URL a node shows (and passes on). */
function outputUrl(data: CanvasData): string | undefined {
  if (data.kind === "media") return data.url;
  if (isGen(data) && data.status === "done") return data.urls?.[Math.min(data.resultIndex ?? 0, (data.urls?.length ?? 1) - 1)];
  return undefined;
}

/** Stable reference to a node's output (stored, used in request signatures). */
function outputRef(data: CanvasData): { key?: string; uuid?: string; index: number } | null {
  if (data.kind === "media") {
    if (data.assetKey) return { key: data.assetKey, index: 0 };
    if (data.resultUuid) return { uuid: data.resultUuid, index: data.resultIndex ?? 0 };
    return null;
  }
  if (isGen(data) && data.status === "done" && data.resultUuid) return { uuid: data.resultUuid, index: data.resultIndex ?? 0 };
  return null;
}

/** Same-origin URL for an output (for the Agent and frame capture). */
function sameOriginUrl(data: CanvasData): string | null {
  const ref = outputRef(data);
  if (ref?.key) return `/api/v1/creative-space/asset?key=${encodeURIComponent(ref.key)}`;
  if (ref?.uuid) return `/api/v1/creative-space/asset?uuid=${encodeURIComponent(ref.uuid)}&index=${ref.index}`;
  return null;
}

const BUILTIN_TEMPLATES = (zh: boolean): CanvasTemplate[] => {
  const t = (title: string, text: string) => ({ kind: "text" as const, title, text });
  return [
    {
      id: "ecom",
      name: zh ? "电商宣传片" : "Product ad",
      description: zh ? "卖点文案 → 棚拍主图 → 15 秒宣传视频 + 配音" : "Copy → hero shot → 15s clip + voiceover",
      build: () => ({
        nodes: [
          { key: "brief", data: t(zh ? "卖点" : "Selling points", zh ? "哑黑头戴式耳机，石墨色展台，青色轮廓光" : "Matte black headphones on a graphite plinth with a cyan rim light"), x: 0, y: 0 },
          { key: "hero", data: defaultsFor("image", zh ? "主图" : "Hero shot"), x: 340, y: 0 },
          { key: "clip", data: defaultsFor("video", zh ? "宣传视频" : "Ad clip", zh ? "镜头缓慢环绕产品，光线扫过表面" : "Slow orbit around the product, light sweeping across"), x: 700, y: 0 },
          { key: "vo", data: defaultsFor("audio", zh ? "旁白" : "Voiceover", zh ? "听见每一个细节。" : "Hear every detail."), x: 700, y: 360 },
        ],
        edges: [["brief", "hero"], ["hero", "clip"]],
      }),
    },
    {
      id: "three-act",
      name: zh ? "三幕分镜短片" : "Three-act short",
      description: zh ? "三个镜头各一张关键帧，再各自生成视频" : "One keyframe per act, each animated",
      build: () => {
        const acts = zh ? ["第一幕 · 全景交代环境", "第二幕 · 中景推进冲突", "第三幕 · 特写情绪定格"] : ["Act I · wide establishing", "Act II · medium, rising action", "Act III · close-up, the moment"];
        return {
          nodes: acts.flatMap((act, index) => [
            { key: `t${index}`, data: t(act, ""), x: 0, y: index * 380 },
            { key: `i${index}`, data: defaultsFor("image", zh ? `关键帧 ${index + 1}` : `Keyframe ${index + 1}`), x: 340, y: index * 380 },
            { key: `v${index}`, data: defaultsFor("video", zh ? `镜头 ${index + 1}` : `Shot ${index + 1}`), x: 700, y: index * 380 },
          ]),
          edges: [0, 1, 2].flatMap((index) => [[`t${index}`, `i${index}`], [`i${index}`, `v${index}`]] as [string, string][]),
        };
      },
    },
    {
      id: "character",
      name: zh ? "角色一致的系列图" : "Consistent character",
      description: zh ? "先定角色形象，再用它生成三个场景" : "Lock a character, then reuse it in three scenes",
      build: () => ({
        nodes: [
          { key: "who", data: t(zh ? "角色设定" : "Character", zh ? "短发黑人女性，黑色上衣，银色耳饰，深色摄影棚侧面肖像" : "A Black woman with short natural hair, black clothing and a silver earring, in profile in a dark studio"), x: 0, y: 0 },
          { key: "sheet", data: defaultsFor("image", zh ? "角色定妆" : "Character sheet"), x: 340, y: 0 },
          ...[0, 1, 2].map((index) => ({
            key: `s${index}`,
            data: defaultsFor("image", zh ? `场景 ${index + 1}` : `Scene ${index + 1}`, zh ? ["她站在雨夜的公交站", "她在海边奔跑", "她在图书馆看书"][index] : ["At a bus stop on a rainy night", "Running on the beach", "Reading in a library"][index]),
            x: 700,
            y: index * 360,
          })),
        ],
        edges: [["who", "sheet"], ["sheet", "s0"], ["sheet", "s1"], ["sheet", "s2"]],
      }),
    },
  ];
};

function NodeCanvasInner({ locale, initialPrompt, userId }: { locale: string; initialPrompt: string; userId: string | null }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const L = useCallback((cn: string, en: string) => (zh ? cn : en), [zh]);
  const flow = useReactFlow<CanvasData>();
  const [lifetime] = useState(() => ({ current: new AbortController() }));
  const canvasFetch = useCallback<typeof fetch>((input, init = {}) => {
    const headers = new Headers(init.headers);
    if (userId) headers.set("X-Media-Account", userId);
    return fetch(input, { ...init, headers, signal: lifetime.current.signal });
  }, [lifetime, userId]);
  const uploadCanvasFile = useCallback(async (file: File) => {
    if (file.type.startsWith("video/")) return uploadWorkflowVideo(file, canvasFetch);
    const result = await uploadImage(file, canvasFetch);
    if (!result.ok) throw new UploadError(result.code);
    return result;
  }, [canvasFetch]);
  const signIn = useSigninModal();
  const shortfall = useCreditsShortfall(zh);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<CanvasData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const [title, setTitle] = useState(L("未命名画布", "Untitled canvas"));
  const titleRef = useRef(title);
  titleRef.current = title;
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const canvasIdRef = useRef<string | null>(null);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [panel, setPanel] = useState<CanvasPanel | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const graphReady = useRef(false);
  const booted = useRef(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const groupRunRef = useRef<{ id: string; controller: AbortController; pending?: string } | null>(null);
  const [groupProgress, setGroupProgress] = useState<{ index: number; total: number } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<{ id: string; name: string; graph: ReturnType<typeof toStoredGraph> }[]>([]);
  const [editing, setEditing] = useState<{ id: string; action: CanvasEditAction } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [shotsFor, setShotsFor] = useState<string | null>(null);
  const [comparing, setComparing] = useState<{ before: string; after: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [showEdges, setShowEdges] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const [viewOptions, setViewOptions] = useCanvasViewOptions();
  const [background, saveBackground] = useCanvasBackground();
  const appearance = useMemo(() => appearanceStyle(viewOptions.miniColors, background), [viewOptions.miniColors, background]);
  const [pendingSeconds, setPendingSeconds] = useState<Record<string, number>>({});
  const pendingRuns = useRef(new Map<string, { signature: string; stop: () => void }>());
  const [farOut, setFarOut] = useState(false);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [legacyCount, setLegacyCount] = useState(0);
  const [waitingMedia, setWaitingMedia] = useState<Set<string>>(() => new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const connectFrom = useRef<LinkOrigin | null>(null);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const [editingField, editField] = useState<CanvasActions["editingField"]>(null);
  const menuOpenedAt = useRef(0);
  const flowBox = useRef<HTMLDivElement>(null);
  const runLocks = useRef(new Set<string>());
  const clipboard = useRef<{ nodes: FlowNode[]; edges: Edge[] } | null>(null);
  const lastSaved = useRef("");
  const saving = useRef<Promise<string | null> | null>(null);
  const saveAgain = useRef(false);
  const saveSeq = useRef(0);
  const savedSeq = useRef(0);
  const revision = useRef(0);
  const conflict = useRef(false);
  const canvasGeneration = useRef(0);
  const editLock = useRef(false);
  const editSession = useRef(0);
  const savedKeys = useRef(new Set<string>());
  // Latest content of every node seen, so undoing a delete brings it back as it
  // was when deleted (with its prompt and result), not as at the older snapshot.
  const lastData = useRef(new Map<string, CanvasData>());
  const unknownRequest = L(
    "页面关闭时请求还没有回音，不确定是否已提交。再点生成会沿用同一个请求，不会重复扣积分。",
    "The page closed before the request was answered. Generating again reuses the same request and cannot charge twice.",
  );
  const currentPath = localizedHref(locale, "/creative-space/canvas");
  // Saved templates belong to one account (or to signed-out use) on a shared browser.
  const templatesKey = `${TEMPLATES_PREFIX}:${userId ?? "guest"}`;

  const cancelPending = useCallback((id: string) => {
    pendingRuns.current.get(id)?.stop();
    pendingRuns.current.delete(id);
    setPendingSeconds((current) => {
      const values = { ...current };
      delete values[id];
      return values;
    });
  }, []);
  const cancelAllPending = useCallback(() => {
    if (pendingRuns.current.size === 0) return;
    for (const item of pendingRuns.current.values()) item.stop();
    pendingRuns.current.clear();
    setPendingSeconds({});
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancelAllPending(); };
    window.addEventListener("pagehide", cancelAllPending);
    window.addEventListener("popstate", cancelAllPending);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", cancelAllPending);
      window.removeEventListener("popstate", cancelAllPending);
      document.removeEventListener("visibilitychange", hidden);
      cancelAllPending();
    };
  }, [cancelAllPending, userId, viewOptions.delaySubmit]);

  const say = useCallback((text: string, error = false) => setToast({ text, error }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 7000 : 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const requireLogin = useCallback(() => {
    if (userId) return true;
    signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
    return false;
  }, [signIn, userId]);

  /* ---------------------------------------------------------------- state */

  const patch = useCallback(
    (id: string, partial: Partial<CanvasData>) => {
      const apply = (list: FlowNode[]) => list.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...partial } as CanvasData } : node));
      // The ref changes now, not at the next render: a save started right
      // after this call must already see it (e.g. a request's key).
      nodesRef.current = apply(nodesRef.current);
      // A node deleted meanwhile still gets the update, so undo brings it back current.
      const remembered = lastData.current.get(id);
      if (remembered && !nodesRef.current.some((node) => node.id === id)) lastData.current.set(id, { ...remembered, ...partial } as CanvasData);
      setNodes((list) => apply(list));
    },
    [setNodes],
  );

  const replaceGraph = useCallback(
    (nextNodes: FlowNode[], nextEdges: Edge[]) => {
      const ordered = parentsFirst(nextNodes as GraphNode[]) as FlowNode[];
      nodesRef.current = ordered;
      edgesRef.current = nextEdges;
      setNodes(ordered);
      setEdges(nextEdges);
    },
    [setEdges, setNodes],
  );

  /* -------------------------------------------------------------- history */

  const history = useRef<{ stack: { nodes: FlowNode[]; edges: Edge[]; key: string }[]; index: number }>({ stack: [], index: -1 });
  const [historyTick, setHistoryTick] = useState(0);
  const commit = useCallback(() => {
    // After React applied the change.
    setTimeout(() => {
      const key = structureKey(nodesRef.current as GraphNode[], edgesRef.current);
      const h = history.current;
      if (h.stack[h.index]?.key === key) return;
      h.stack = [...h.stack.slice(0, h.index + 1), { nodes: nodesRef.current, edges: edgesRef.current, key }].slice(-(HISTORY_LIMIT + 1));
      h.index = h.stack.length - 1;
      setHistoryTick((tick) => tick + 1);
    }, 0);
  }, []);
  const resetHistory = useCallback(() => {
    history.current = { stack: [], index: -1 };
    commit();
  }, [commit]);
  // Latest content of every node seen, so undoing a delete brings it back as it
  // was when deleted (with its prompt and result), not as at the older snapshot.
  useEffect(() => {
    for (const node of nodes) lastData.current.set(node.id, node.data);
  }, [nodes]);
  const restore = useCallback(
    (step: -1 | 1) => {
      const h = history.current;
      const target = h.stack[h.index + step];
      if (!target) return;
      h.index += step;
      // Structure only: nodes that still exist keep their current content
      // (prompts, results, running jobs); removed ones come back as they were.
      const live = new Map(nodesRef.current.map((node) => [node.id, node]));
      replaceGraph(
        target.nodes.map((node) => {
          const current = live.get(node.id);
          let data = current?.data ?? lastData.current.get(node.id) ?? node.data;
          // Brought back while its request was still unanswered: retryable, same key.
          if (!current && isGen(data) && data.status === "submitting") data = { ...data, status: "failed", error: unknownRequest };
          return { ...node, data: { ...data, title: node.data.title, annotation: node.data.annotation }, selected: false };
        }),
        target.edges,
      );
      setHistoryTick((tick) => tick + 1);
    },
    [replaceGraph, unknownRequest],
  );
  const canUndo = history.current.index > 0;
  const canRedo = history.current.index < history.current.stack.length - 1;
  void historyTick;

  /* ------------------------------------------------------------- creation */

  const viewCenter = useCallback(() => {
    const pane = document.querySelector(".nc-flow")?.getBoundingClientRect();
    const point = pane ? { x: pane.left + pane.width / 2, y: pane.top + pane.height * 0.42 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const p = flow.screenToFlowPosition(point);
    return { x: p.x - 140, y: p.y - 100 };
  }, [flow]);

  const makeNode = useCallback(
    (data: CanvasData, position: { x: number; y: number }): FlowNode => {
      const size = nodeSize(data.kind);
      return {
        id: newId(),
        type: data.kind,
        position,
        data,
        ...(size ? { style: size } : {}),
        ...(data.kind === "group" ? { zIndex: -1 } : {}),
      };
    },
    [],
  );

  const addNodes = useCallback(
    (added: FlowNode[], wires: Edge[] = [], select = true) => {
      const next = [...nodesRef.current.map((node) => (select ? { ...node, selected: false } : node)), ...added.map((node) => ({ ...node, selected: select }))];
      replaceGraph(next, [...edgesRef.current, ...wires]);
      commit();
    },
    [commit, replaceGraph],
  );

  const wire = (source: string, target: string): Edge => ({ id: newId(), source, target, sourceHandle: "out", targetHandle: "in" });

  const createKind = useCallback(
    (kind: CanvasKind, position: { x: number; y: number }, from?: LinkOrigin, prompt = "") => {
      const label = KIND_LABEL[kind][zh ? "zh" : "en"];
      const data: CanvasData =
        kind === "text"
          ? { kind, title: label, text: prompt }
          : kind === "agent"
            ? { kind, title: label, prompt, status: "idle" }
            : kind === "group"
              ? { kind, title: label }
              : kind === "media"
                ? { kind, title: label, media: "image", mime: "image/*" }
                : defaultsFor(kind, label, prompt);
      const node = makeNode(data, position);
      const [source, target] = from?.side === "target" ? [node.id, from.id] : [from?.id, node.id];
      const wires = source && checkConnection(source, target, [...nodesRef.current, node] as GraphNode[], edgesRef.current).ok ? [wire(source, target)] : [];
      addNodes([node], wires);
      return node.id;
    },
    [addNodes, makeNode, zh],
  );

  /* ----------------------------------------------------------- persistence */

  const storedNow = useCallback(
    () => toStoredGraph(nodesRef.current as GraphNode[], edgesRef.current, flow.getViewport()),
    [flow],
  );
  const contentKey = (graph: ReturnType<typeof toStoredGraph>, name: string) => JSON.stringify({ name, nodes: graph.nodes, edges: graph.edges });

  const syncList = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await canvasFetch("/api/v1/creative-space/workflows", { cache: "no-store" });
      const body = await response.json();
      if (body?.success) setCanvases(body.data.workflows);
    } catch {
      /* the list is optional */
    }
  }, [canvasFetch, userId]);

  const refreshBalance = useCallback(async (): Promise<number | null> => {
    if (!userId) return null;
    try {
      const response = await canvasFetch("/api/v1/credit/balance", { cache: "no-store" });
      const body = await response.json();
      const value = typeof body?.data?.availableCredits === "number" ? body.data.availableCredits : null;
      setBalance(value);
      return value;
    } catch {
      return null;
    }
  }, [canvasFetch, userId]);

  /** Uploads files that so far live only in this browser, so the canvas can be saved. */
  const uploadLocalAssets = useCallback(async () => {
    const pending = nodesRef.current.filter((node) => node.data.kind === "media" && node.data.localId && !node.data.assetKey);
    if (!pending.length) return;
    const guests = await listGuestAssets(userId).catch(() => [] as PickerAsset[]);
    for (const node of pending) {
      const data = node.data as MediaData;
      const asset = guests.find((item) => item.id === data.localId);
      if (!asset?.file) continue;
      try {
        const result = await uploadCanvasFile(asset.file);
        if (lifetime.current.signal.aborted) return;
        patch(node.id, { assetKey: result.key, url: result.url, localId: undefined } as Partial<MediaData>);
        void removeGuestAsset(asset.id).catch(() => {});
      } catch (error) {
        say(error instanceof UploadError ? uploadErrorText(error, zh) : error instanceof Error ? error.message : L("素材上传失败", "Upload failed"), true);
      }
    }
  }, [L, lifetime, patch, say, uploadCanvasFile, userId, zh]);

  const saveRemote = useCallback(async (): Promise<string | null> => {
    if (!userId || lifetime.current.signal.aborted || conflict.current) return null;
    if (saving.current) {
      saveAgain.current = true;
      return saving.current;
    }
    const task = (async () => {
      // Bound to the canvas open when the save started: a late answer must not
      // change the id, address or "saved" mark of a canvas opened since.
      const generation = canvasGeneration.current;
      setSaveState("saving");
      try {
        await uploadLocalAssets();
        if (lifetime.current.signal.aborted || generation !== canvasGeneration.current) return null;
        const seq = ++saveSeq.current;
        const graph = storedNow();
        const name = titleRef.current.trim() || L("未命名画布", "Untitled canvas");
        const id = canvasIdRef.current;
        const response = await canvasFetch(id ? `/api/v1/creative-space/workflows/${encodeURIComponent(id)}` : "/api/v1/creative-space/workflows", {
          method: id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, graph, ...(id ? { baseRevision: revision.current } : {}) }),
        });
        const body = await response.json().catch(() => null);
        if (response.status === 409 && body?.error?.details?.code !== "ACCOUNT_CHANGED") {
          // Another window saved this canvas since it was opened here.
          if (generation === canvasGeneration.current) {
            conflict.current = true;
            setSaveState("error");
            say(L("这个画布在另一个窗口里改过。为免覆盖，这里已停止自动保存，请刷新页面载入最新版本。", "This canvas changed in another window. Saving here has stopped so nothing is overwritten; reload to get the latest."), true);
          }
          return null;
        }
        if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? L("保存失败", "Could not save"));
        if (lifetime.current.signal.aborted || generation !== canvasGeneration.current) return null;
        const savedId = (id ?? body.data.id) as string;
        revision.current = id ? body.data.workflow.revision : body.data.revision;
        lastSaved.current = contentKey(graph, name);
        savedSeq.current = Math.max(savedSeq.current, seq);
        savedKeys.current = new Set(graph.nodes.flatMap((node) => {
          const pending = (node.data as { pending?: { key?: string } }).pending;
          return pending?.key ? [`${node.id}:${pending.key}`] : [];
        }));
        if (!id) {
          canvasIdRef.current = savedId;
          setCanvasId(savedId);
          window.history.replaceState(null, "", `${currentPath}?id=${encodeURIComponent(savedId)}`);
          try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
          void syncList();
        }
        setSaveState("saved");
        return savedId;
      } catch (error) {
        if (generation === canvasGeneration.current) {
          setSaveState("error");
          say(error instanceof Error ? error.message : L("保存失败", "Could not save"), true);
        }
        return null;
      }
    })();
    saving.current = task;
    try {
      return await task;
    } finally {
      saving.current = null;
      if (saveAgain.current && !lifetime.current.signal.aborted) {
        saveAgain.current = false;
        void saveRemote();
      }
    }
  }, [L, canvasFetch, currentPath, lifetime, say, storedNow, syncList, uploadLocalAssets, userId]);

  /** Saves, and resolves true only once a save taken after this call has succeeded. */
  const persistNow = useCallback(async (): Promise<boolean> => {
    const needed = saveSeq.current + 1;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      while (saving.current) await saving.current;
      if (savedSeq.current >= needed) return true;
      const id = await saveRemote();
      if (savedSeq.current >= needed) return true;
      if (!id) return false;
    }
    return savedSeq.current >= needed;
  }, [saveRemote]);

  const saveLocalDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: titleRef.current, graph: storedNow() }));
    } catch {
      /* storage full */
    }
  }, [storedNow]);

  const saveGuestOnExit = useRef(saveLocalDraft);
  saveGuestOnExit.current = saveLocalDraft;
  useLayoutEffect(() => {
    if (lifetime.current.signal.aborted) lifetime.current = new AbortController();
    return () => {
      if (!userId && graphReady.current && (nodesRef.current.length || lastSaved.current)) saveGuestOnExit.current();
      lifetime.current.abort();
      canvasGeneration.current += 1;
      editSession.current += 1;
      if (!graphReady.current) booted.current = false;
    };
  }, [lifetime, userId]);

  /** Resolves display URLs for everything that has a stable reference. */
  const resolveAll = useCallback(async () => {
    const list = nodesRef.current;
    const guests = list.some((node) => node.data.kind === "media" && node.data.localId) ? await listGuestAssets(userId).catch(() => [] as PickerAsset[]) : [];
    for (const node of list) {
      if (node.data.kind === "media" && node.data.localId && !node.data.url) {
        const asset = guests.find((item) => item.id === (node.data as MediaData).localId);
        if (asset) patch(node.id, { url: asset.url } as Partial<MediaData>);
      }
    }
    if (!userId) return;
    const uuids: string[] = [];
    const keys: string[] = [];
    for (const node of list) {
      const data = node.data;
      if (data.kind === "media" && data.assetKey) keys.push(data.assetKey);
      else if (data.kind === "media" && data.resultUuid) uuids.push(data.resultUuid);
      else if (isGen(data) && data.status === "done" && data.resultUuid) uuids.push(data.resultUuid);
    }
    const resolved = await resolveMedia(uuids, keys, canvasFetch);
    const waiting = new Set<string>();
    for (const node of nodesRef.current) {
      const data = node.data;
      if (data.kind === "media" && data.resultUuid) {
        const state = resolved.results[data.resultUuid]?.status;
        if (state && state !== "COMPLETED" && state !== "FAILED") waiting.add(node.id);
      }
      if (data.kind === "media") {
        const url = data.assetKey ? resolved.assets[data.assetKey] : data.resultUuid ? resolved.results[data.resultUuid]?.urls[data.resultIndex ?? 0] : undefined;
        if (url) patch(node.id, { url } as Partial<MediaData>);
      } else if (isGen(data) && data.status === "done" && data.resultUuid) {
        const result = resolved.results[data.resultUuid];
        if (result?.urls.length) patch(node.id, { urls: result.urls } as Partial<GenerateData>);
      }
    }
    if (waiting.size) setWaitingMedia(waiting);
  }, [canvasFetch, patch, userId]);

  const loadGraph = useCallback(
    (graph: unknown, name: string, id: string | null) => {
      const restored = fromStoredGraph(graph, unknownRequest);
      replaceGraph(
        restored.nodes.map((node) => ({ ...node, type: node.data.kind })) as FlowNode[],
        restored.edges.map((edge) => ({ ...edge, sourceHandle: "out", targetHandle: "in" })),
      );
      setTitle(name);
      titleRef.current = name;
      canvasIdRef.current = id;
      setCanvasId(id);
      canvasGeneration.current += 1;
      conflict.current = false;
      const stored = (graph && typeof graph === "object" ? (graph as { revision?: unknown }).revision : undefined);
      revision.current = typeof stored === "number" ? stored : 0;
      setWaitingMedia(new Set());
      lastSaved.current = contentKey(toStoredGraph(nodesRef.current as GraphNode[], edgesRef.current), name);
      requestAnimationFrame(() => {
        if (restored.viewport) flow.setViewport(restored.viewport);
        else if (restored.nodes.length) flow.fitView({ padding: 0.2, maxZoom: 1 });
      });
      resetHistory();
    },
    [flow, replaceGraph, resetHistory, unknownRequest],
  );

  /** Before leaving this canvas: nothing in flight, and its latest changes saved. */
  const readyToLeave = useCallback(async () => {
    if (lifetime.current.signal.aborted) return false;
    groupRunRef.current?.controller.abort();
    cancelAllPending();
    const busy = runLocks.current.size > 0 || nodesRef.current.some((node) => (node.data as { status?: string }).status === "submitting");
    if (busy) {
      say(L("有生成请求正在提交，等它提交完再切换画布", "A generation is being submitted; switch once it is sent"), true);
      return false;
    }
    if (conflict.current) {
      say(L("这个画布和另一个窗口有冲突，请先刷新页面，免得丢掉改动", "This canvas conflicts with another window; reload first so nothing is lost"), true);
      return false;
    }
    const dirty = contentKey(storedNow(), titleRef.current) !== lastSaved.current && (Boolean(canvasIdRef.current) || nodesRef.current.length > 0);
    if (userId && dirty && !(await persistNow())) {
      say(L("当前画布还没保存成功，先不切换", "This canvas has not saved yet; staying here"), true);
      return false;
    }
    return true;
  }, [L, cancelAllPending, lifetime, persistNow, say, storedNow, userId]);

  const openCanvas = useCallback(
    async (id: string) => {
      setPanel(null);
      try {
        if (!(await readyToLeave())) return;
        const before = contentKey(storedNow(), titleRef.current);
        const generation = canvasGeneration.current;
        const response = await canvasFetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? L("打不开这个画布", "Could not open this canvas"));
        // Edited or generating while it loaded: stay, nothing is dropped.
        if (lifetime.current.signal.aborted || generation !== canvasGeneration.current || runLocks.current.size || contentKey(storedNow(), titleRef.current) !== before) {
          say(L("加载期间当前画布有改动，已留在当前画布，请再点一次", "This canvas changed while the other loaded; staying here"), true);
          return;
        }
        loadGraph(body.data.workflow.graph, body.data.workflow.name, id);
        window.history.replaceState(null, "", `${currentPath}?id=${encodeURIComponent(id)}`);
        setSaveState("saved");
        void resolveAll();
      } catch (error) {
        say(error instanceof Error ? error.message : L("打不开这个画布", "Could not open this canvas"), true);
      }
    },
    [L, canvasFetch, currentPath, lifetime, loadGraph, readyToLeave, resolveAll, say, storedNow],
  );

  const newCanvas = useCallback(async (force = false) => {
    setPanel(null);
    if (!force && !(await readyToLeave())) return;
    if (lifetime.current.signal.aborted) return;
    loadGraph({ version: 2, nodes: [], edges: [] }, L("未命名画布", "Untitled canvas"), null);
    window.history.replaceState(null, "", currentPath);
    setSaveState(userId ? "idle" : "local");
  }, [L, currentPath, lifetime, loadGraph, readyToLeave, userId]);

  const deleteCanvas = useCallback(async () => {
    const id = canvasIdRef.current;
    if (!id) return;
    if (!window.confirm(L("删除这个画布？画布里的生成结果仍保留在「我的作品」。", "Delete this canvas? Its results stay in My creations."))) return;
    try {
      const response = await canvasFetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      canvasIdRef.current = null;
      setCanvasId(null);
      await syncList();
      await newCanvas(true);
      say(L("画布已删除", "Canvas deleted"));
    } catch {
      say(L("删除失败，请重试", "Could not delete"), true);
    }
  }, [L, canvasFetch, newCanvas, say, syncList]);

  // First load: saved canvas (?id), else this browser's draft; then studio
  // hand-off and ?prompt=.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const owner = lifetime.current.signal;
    void (async () => {
      const id = new URLSearchParams(window.location.search).get("id");
      let loaded = false;
      if (id && userId) {
        try {
          const response = await canvasFetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { cache: "no-store" });
          const body = await response.json();
          if (owner.aborted) return;
          if (body?.success) {
            loadGraph(body.data.workflow.graph, body.data.workflow.name, id);
            setSaveState("saved");
            loaded = true;
          }
        } catch {
          /* fall back to the draft */
        }
      }
      if (owner.aborted) return;
      if (!loaded) {
        try {
          const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as { title?: string; graph?: unknown } | null;
          if (draft?.graph) loadGraph(draft.graph, draft.title || L("未命名画布", "Untitled canvas"), null);
          else resetHistory();
        } catch {
          resetHistory();
        }
        if (id) window.history.replaceState(null, "", currentPath);
        setSaveState(userId ? "idle" : "local");
      }
      try {
        const handoff = sessionStorage.getItem(HANDOFF_KEY);
        if (handoff) {
          const item = JSON.parse(handoff) as { url?: string; ownerId?: string; model?: string; kind?: string; uuid?: string; index?: number; key?: string; editAction?: string };
          const media = item.kind === "video" || item.kind === "audio" ? item.kind : "image";
          const ownedKey = userId && isUploadKey(item.key) && item.key.startsWith(`uploads/${userId}/`) ? item.key : undefined;
          const allowed = userId && (!item.ownerId || item.ownerId === userId) && (!item.key || ownedKey);
          let preview = allowed && (ownedKey || item.ownerId) ? item.url : undefined;
          let verified = Boolean(allowed && (ownedKey || item.ownerId));
          if (allowed && !verified && item.uuid) {
            // Older workspaces included a signed URL but no owner. Resolve the stable job under the active account.
            const result = (await resolveMedia([item.uuid], [], canvasFetch)).results[item.uuid];
            verified = Boolean(result);
            preview = result?.urls?.[item.index ?? 0];
          }
          if (owner.aborted) return;
          if (sessionStorage.getItem(HANDOFF_KEY) === handoff) sessionStorage.removeItem(HANDOFF_KEY);
          if (verified && (preview || item.uuid || ownedKey)) {
            const node = makeNode(
              {
                kind: "media",
                media,
                title: item.model || L("工作室作品", "Studio result"),
                mime: `${media}/*`,
                ...(item.uuid ? { resultUuid: item.uuid, resultIndex: item.index ?? 0 } : {}),
                ...(ownedKey ? { assetKey: ownedKey } : {}),
                ...(preview ? { url: preview } : {}),
              },
              viewCenter(),
            );
            addNodes([node]);
            if (ownedKey && media === "image" && (item.editAction === "inpaint" || item.editAction === "animate")) {
              setEditing({ id: node.id, action: item.editAction });
            }
            if (!item.uuid && !ownedKey) say(L("这个作品没有带编号，保存后可能无法再次显示", "This result has no id and may not show after saving"), true);
          }
        }
      } catch {
        /* ignore a broken hand-off */
      }
      if (initialPrompt.trim()) createKind("agent", viewCenter(), undefined, initialPrompt.trim());
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_CANVAS_KEY) || "null") as { nodes?: unknown[] } | null;
        const flowDraft = JSON.parse(localStorage.getItem(LEGACY_FLOW_KEY) || "null") as { graph?: { nodes?: unknown[] } } | null;
        const count = (Array.isArray(legacy?.nodes) ? legacy.nodes.length : 0) + (Array.isArray(flowDraft?.graph?.nodes) ? flowDraft.graph.nodes.length : 0);
        if (!localStorage.getItem(LEGACY_DONE_KEY) && count) setLegacyCount(count);
        /* templates load in their own effect, per account */
      } catch {
        /* ignore */
      }
      graphReady.current = true;
      setHydrated(true);
      void resolveAll();
    })();
  }, [L, addNodes, canvasFetch, createKind, currentPath, initialPrompt, lifetime, loadGraph, makeNode, resetHistory, resolveAll, say, userId, viewCenter]);

  useEffect(() => {
    if (!userId) return;
    void syncList();
    void refreshBalance();
  }, [refreshBalance, syncList, userId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(templatesKey) || "[]");
      setUserTemplates(Array.isArray(saved) ? saved : []);
    } catch {
      setUserTemplates([]);
    }
  }, [templatesKey]);

  // Autosave: signed in → the account (creates the canvas on first content);
  // signed out → this browser.
  useEffect(() => {
    if (!hydrated) return;
    const graph = toStoredGraph(nodesRef.current as GraphNode[], edgesRef.current);
    const key = contentKey(graph, title);
    if (key === lastSaved.current) return;
    if (!userId) {
      setSaveState("local");
      const timer = setTimeout(saveLocalDraft, 500);
      return () => clearTimeout(timer);
    }
    if (!canvasIdRef.current && !graph.nodes.length) return;
    setSaveState("dirty");
    const timer = setTimeout(() => void saveRemote(), 1500);
    return () => clearTimeout(timer);
  }, [edges, hydrated, nodes, saveLocalDraft, saveRemote, title, userId]);

  // Leaving with unsaved changes: send them along with the page unload.
  useEffect(() => {
    const flush = () => {
      if (!userId) {
        saveLocalDraft();
        return;
      }
      const id = canvasIdRef.current;
      if (!id || conflict.current) return;
      const graph = storedNow();
      const name = titleRef.current.trim() || "Untitled";
      if (contentKey(graph, name) === lastSaved.current) return;
      const body = JSON.stringify({ name, graph, baseRevision: revision.current });
      if (body.length > 60_000) return;
      void canvasFetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { method: "PUT", keepalive: true, headers: { "content-type": "application/json" }, body }).catch(() => {});
    };
    // Hidden but still open: a normal save, whose answer updates the revision.
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (!userId) saveLocalDraft();
      else if (canvasIdRef.current && contentKey(storedNow(), titleRef.current) !== lastSaved.current) void saveRemote();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [canvasFetch, saveLocalDraft, saveRemote, storedNow, userId]);

  // After signing in, pick up the URLs of assets in a draft made while signed out.
  useEffect(() => {
    if (hydrated && userId) void resolveAll();
  }, [hydrated, resolveAll, userId]);

  /* -------------------------------------------------------------- polling */

  const runningKey = useMemo(
    () => nodes.filter((node) => isGen(node.data) && node.data.status === "running" && node.data.resultUuid).map((node) => `${node.id}:${(node.data as GenerateData).resultUuid}`).join(","),
    [nodes],
  );
  useEffect(() => {
    if (!runningKey || !userId) return;
    let live = true;
    const tick = async () => {
      if (document.hidden) return;
      let changed = false;
      for (const node of nodesRef.current) {
        const data = node.data;
        if (!live || !isGen(data) || data.status !== "running" || !data.resultUuid) continue;
        const result = await jobStatus(data.resultUuid, canvasFetch);
        if (!live || !result) continue;
        if (result.status === "COMPLETED") {
          patch(node.id, { status: "done", urls: result.urls, error: null } as Partial<GenerateData>);
          changed = true;
        } else if (result.status === "FAILED") {
          patch(node.id, { status: "failed", error: result.error || L("生成失败，冻结的积分已退回", "Generation failed; held credits were returned") } as Partial<GenerateData>);
          changed = true;
        }
      }
      if (changed) void refreshBalance();
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [L, canvasFetch, patch, refreshBalance, runningKey, userId]);

  // Assets that point at a job still running (e.g. imported from the old canvas).
  useEffect(() => {
    if (!waitingMedia.size || !userId) return;
    let live = true;
    const tick = async () => {
      if (document.hidden) return;
      const done: string[] = [];
      for (const id of waitingMedia) {
        const data = nodesRef.current.find((node) => node.id === id)?.data;
        if (!live || data?.kind !== "media" || !data.resultUuid) {
          done.push(id);
          continue;
        }
        const result = await jobStatus(data.resultUuid, canvasFetch);
        if (!live || !result) continue;
        if (result.status === "COMPLETED") {
          patch(id, { url: result.urls[data.resultIndex ?? 0] } as Partial<MediaData>);
          done.push(id);
        } else if (result.status === "FAILED") done.push(id);
      }
      if (live && done.length) setWaitingMedia((current) => new Set([...current].filter((id) => !done.includes(id))));
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [canvasFetch, patch, userId, waitingMedia]);

  /* ---------------------------------------------------------- generation */

  const inputsOf = useCallback((id: string) => {
    const inputs = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current).filter((node) => hasOutput(node.data));
    return {
      texts: inputs.filter((node) => outputType(node.data) === "text").length,
      images: inputs.filter((node) => outputType(node.data) === "image").length,
      videos: inputs.filter((node) => outputType(node.data) === "video").length,
    };
  }, []);

  const mergedPrompt = useCallback((id: string, own: string) => {
    const texts = inputText(id, nodesRef.current as GraphNode[], edgesRef.current);
    return [...texts, own.trim()].filter(Boolean).join("\n");
  }, []);

  const quoteOf = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node || !isGen(node.data)) return null;
      const choices = choicesFor(node.data.kind, node.data.modelId);
      const images = node.data.kind === "audio" ? 0 : Math.min(inputsOf(id).images, choices.maxImages) + (node.data.maskKey ? 1 : 0);
      return quote(node.data, mergedPrompt(id, node.data.prompt), images);
    },
    [inputsOf, mergedPrompt],
  );

  /** Reference images for a node: stable ids (for the request signature) and sendable values. */
  const prepareImages = useCallback(
    async (id: string, max: number): Promise<{ stable: string[]; values: string[] }> => {
      const inputs = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current)
        .filter((node) => outputType(node.data) === "image" && hasOutput(node.data))
        .slice(0, max);
      const stable: string[] = [];
      const values: string[] = [];
      const uuids: string[] = [];
      for (const node of inputs) {
        const data = node.data;
        if (data.kind === "media" && data.localId && !data.assetKey) await uploadLocalAssets();
      }
      for (const input of inputs) {
        const fresh = nodesRef.current.find((node) => node.id === input.id);
        const ref = fresh ? outputRef(fresh.data) : null;
        if (!ref) throw new Error(L("有参考图还没准备好，请稍后再试", "A reference image is not ready yet"));
        if (ref.key) {
          stable.push(ref.key);
          values.push(ref.key);
        } else if (ref.uuid) {
          stable.push(`${ref.uuid}:${ref.index}`);
          values.push("");
          uuids.push(ref.uuid);
        }
      }
      if (uuids.length) {
        const resolved = await resolveMedia(uuids, [], canvasFetch);
        for (let index = 0; index < stable.length; index += 1) {
          if (values[index]) continue;
          const [uuid, position] = stable[index].split(":");
          const url = resolved.results[uuid]?.urls[Number(position)];
          if (!url) throw new Error(L("参考图读取失败，请稍后再试", "Could not read a reference image"));
          values[index] = url;
        }
      }
      return { stable, values };
    },
    [L, canvasFetch, uploadLocalAssets],
  );

  const runGenerate = useCallback(
    async (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node || !isGen(node.data) || lifetime.current.signal.aborted) return;
      const data = node.data;
      // A new attempt that fails before a new job exists keeps the last result on show.
      const previous = data.status === "done" && data.resultUuid ? { status: "done" as const } : null;
      const fail = (error: string, extra: Partial<GenerateData> = {}) =>
        patch(id, { ...(previous ?? { status: "failed" as const }), error, ...extra } as Partial<GenerateData>);
      const prompt = mergedPrompt(id, data.prompt);
      if (!prompt) {
        fail(L("先写提示词，或从左边连一个文字节点", "Write a prompt or wire a text node in"));
        return;
      }
      const choices = choicesFor(data.kind, data.modelId);
      const wiredImages = data.kind === "audio" ? 0 : inputsOf(id).images;
      if (choices.requiresImage && !wiredImages) {
        fail(L("这个模型需要从左边连入一张参考图", "This model needs a reference image wired in"));
        return;
      }
      patch(id, { status: "submitting", error: null } as Partial<GenerateData>);
      try {
        const images = data.kind === "audio" ? { stable: [], values: [] } : await prepareImages(id, choices.maxImages);
        if (data.maskKey) {
          images.stable.push(data.maskKey);
          images.values.push(data.maskKey);
        }
        const request = buildRequest(data, prompt, images.values);
        const signature = JSON.stringify({ endpoint: request.endpoint, body: buildRequest(data, prompt, images.stable).body });
        const credits = quote(data, prompt, images.values.length);
        const current = nodesRef.current.find((item) => item.id === id)?.data as GenerateData | undefined;
        const { key, reused } = submitKey(current?.pending, signature, newId);
        // Retrying an unanswered request must reach the server even if its
        // first attempt already froze the credits: it returns that job.
        const available = reused ? null : await refreshBalance();
        if (available !== null && available < credits) {
          const message = errorMessage("INSUFFICIENT_CREDITS", "", zh);
          fail(`${message}（${L("需要", "needs")} ${credits}，${L("剩余", "left")} ${available}）`);
          shortfall.report(message, credits);
          say(message, true);
          return;
        }
        patch(id, { pending: { key, signature, at: current?.pending?.at ?? Date.now() } } as Partial<GenerateData>);
        // The key is saved to the account before sending, so a reload or a
        // lost answer retries under it instead of starting a second job.
        if (!(await persistNow()) || !savedKeys.current.has(`${id}:${key}`)) {
          // Never sent: forget this key (keep any older unanswered one).
          fail(L("画布还没能保存，为免重复扣积分这次没有提交，请稍后再点生成", "The canvas could not be saved, so nothing was sent; try again shortly"), { pending: current?.pending });
          return;
        }
        if (lifetime.current.signal.aborted) return;
        const answer = await postGeneration(request.endpoint, request.body, key, canvasFetch);
        if (lifetime.current.signal.aborted) return;
        if (answer.kind === "ok" && isGenerationUuid(answer.uuid)) {
          patch(id, acceptGeneration(data, answer.uuid, Date.now()));
          void saveRemote();
          void refreshBalance();
          return;
        }
        if (answer.kind === "unauthorized") {
          patch(id, { ...(previous ?? { status: "idle" as const }), pending: reused ? current?.pending : undefined } as Partial<GenerateData>);
          requireLogin();
          return;
        }
        if (answer.kind === "lost" || answer.kind === "ok") {
          fail(L("网络中断，不确定是否已提交。再点一次生成会沿用同一个请求，不会重复扣积分。", "The connection dropped. Generating again reuses this request and cannot charge twice."));
          return;
        }
        const message = errorMessage(answer.code, answer.message, zh);
        // A refused retry says nothing about the first, unanswered attempt: keep its key.
        fail(message, reused || answer.code === "CONTENT_BLOCKED" ? {} : { pending: undefined });
        if (answer.code === "INSUFFICIENT_CREDITS") shortfall.report(message, answer.requiredCredits);
        say(message, true);
      } catch (error) {
        const message = error instanceof UploadError ? uploadErrorText(error, zh) : error instanceof Error ? error.message : L("生成失败", "Generation failed");
        const latest = nodesRef.current.find((item) => item.id === id)?.data as GenerateData | undefined;
        if (latest?.status === "submitting") fail(message);
      } finally {
        void saveRemote();
      }
    },
    [L, canvasFetch, inputsOf, lifetime, mergedPrompt, patch, persistNow, prepareImages, refreshBalance, requireLogin, saveRemote, say, shortfall, zh],
  );

  const agentForm = useCallback((id: string, instruction: string) => buildCanvasAgentForm({
    instruction, locale, userId, inputs: directInputs(id, nodesRef.current as GraphNode[], edgesRef.current),
    sourceFor: sameOriginUrl, fetchAsset: canvasFetch,
  }), [locale, userId, canvasFetch]);

  const runAgent = useCallback(
    async (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node || node.data.kind !== "agent") return;
      const instruction = mergedPrompt(id, node.data.prompt);
      if (!instruction) {
        patch(id, { error: L("先写下你的需求", "Write your brief first") } as Partial<AgentData>);
        return;
      }
      patch(id, { status: "running", error: null } as Partial<AgentData>);
      try {
        const form = await agentForm(id, instruction);
        const response = await canvasFetch("/api/v1/creative-space/agent", { method: "POST", body: form });
        if (response.status === 401) {
          patch(id, { status: "idle" } as Partial<AgentData>);
          requireLogin();
          return;
        }
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? L("Agent 暂时不可用，请稍后再试", "The agent is unavailable; try again later"));
        const result = body.data as { reply: string; generationPrompt: string; steps?: { title: string; instruction: string }[] };
        patch(id, {
          status: "done",
          reply: result.reply,
          generationPrompt: result.generationPrompt,
          steps: (result.steps ?? []).map((step) => ({ title: step.title, instruction: step.instruction })),
        } as Partial<AgentData>);
      } catch (error) {
        patch(id, { status: "failed", error: error instanceof Error ? error.message : L("策划失败", "Planning failed") } as Partial<AgentData>);
      }
    },
    [L, agentForm, canvasFetch, mergedPrompt, patch, requireLogin],
  );

  const dispatchRun = useCallback(
    (id: string) => {
      if (!requireLogin()) return;
      if (runLocks.current.has(id)) return;
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node) return;
      const status = (node.data as { status?: string }).status;
      if (status === "submitting" || status === "running") return;
      runLocks.current.add(id);
      const task = node.data.kind === "agent" ? runAgent(id) : runGenerate(id);
      void task.finally(() => runLocks.current.delete(id));
    },
    [requireLogin, runAgent, runGenerate],
  );

  const submissionSignature = useCallback((id: string) => {
    const all = nodesRef.current as GraphNode[];
    const target = all.find((node) => node.id === id);
    if (!target || !isGen(target.data)) return null;
    const inputs = directInputs(id, all, edgesRef.current);
    const snapshot = toStoredGraph([target, ...inputs], []).nodes.map((node) => [node.id, node.data]);
    return JSON.stringify([canvasGeneration.current, userId, snapshot, inputText(id, all, edgesRef.current)]);
  }, [userId]);

  const run = useCallback((id: string) => {
    if (pendingRuns.current.has(id)) { cancelPending(id); return; }
    const data = nodesRef.current.find((node) => node.id === id)?.data;
    if (!viewOptions.delaySubmit || (data?.kind !== "image" && data?.kind !== "video")) {
      dispatchRun(id);
      return;
    }
    if (!requireLogin() || runLocks.current.has(id) || data.status === "running" || data.status === "submitting") return;
    const signature = submissionSignature(id);
    if (!signature) return;
    const tick = (seconds: number) => setPendingSeconds((current) => ({ ...current, [id]: seconds }));
    const stop = submissionDelay(tick, () => {
      const valid = !document.hidden && submissionSignature(id) === signature;
      cancelPending(id);
      if (valid) dispatchRun(id);
    });
    pendingRuns.current.set(id, { signature, stop });
    tick(3);
  }, [cancelPending, dispatchRun, requireLogin, submissionSignature, viewOptions.delaySubmit]);

  useEffect(() => {
    for (const [id, item] of pendingRuns.current) {
      if (item.signature !== submissionSignature(id)) cancelPending(id);
    }
  }, [nodes, edges, cancelPending, submissionSignature]);

  const stopGroup = useCallback(() => {
    const task = groupRunRef.current;
    if (!task) return;
    task.controller.abort();
    if (task.pending && pendingRuns.current.has(task.pending)) cancelPending(task.pending);
  }, [cancelPending]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) stopGroup(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); stopGroup(); };
  }, [stopGroup]);

  const startGroup = useCallback(async (groupId: string) => {
    if (groupRunRef.current || !requireLogin()) return;
    const plan = canvasGroupPlan(groupId, nodesRef.current as GraphNode[], edgesRef.current);
    if (!plan.length) return;
    const task = { id: groupId, controller: new AbortController(), pending: undefined as string | undefined };
    const generation = canvasGeneration.current;
    groupRunRef.current = task;
    const active = () => !task.controller.signal.aborted && !lifetime.current.signal.aborted && generation === canvasGeneration.current && !document.hidden && nodesRef.current.some((node) => node.id === groupId);
    try {
      const complete = await runCanvasGroup(plan.map((node) => node.id), active, async (id, index) => {
        const find = () => nodesRef.current.find((node) => node.id === id);
        const current = find();
        if (!current || !(isGen(current.data) || current.data.kind === "agent")) return false;
        if (current.data.status === "done") return true;
        // Re-evaluate group membership and dependencies in case the graph changed between steps.
        if (!canvasGroupPlan(groupId, nodesRef.current as GraphNode[], edgesRef.current).some((node) => node.id === id)) return false;
        const waiting = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current).some(({ data }) => (isGen(data) || data.kind === "agent") && data.status !== "done");
        if (waiting) return false;
        setGroupProgress({ index: index + 1, total: plan.length });
        const busy = () => {
          const data = find()?.data;
          return pendingRuns.current.has(id) || runLocks.current.has(id) || Boolean(data && (isGen(data) || data.kind === "agent") && (data.status === "submitting" || data.status === "running"));
        };
        if (!busy()) { task.pending = id; run(id); }
        while (active() && busy()) await new Promise((resolve) => setTimeout(resolve, 200));
        if (!active() && task.pending && pendingRuns.current.has(task.pending)) cancelPending(task.pending);
        task.pending = undefined;
        const result = find()?.data;
        return Boolean(active() && result && (isGen(result) || result.kind === "agent") && result.status === "done" && !result.error);
      });
      if (active()) say(complete ? L("组内节点已执行完成", "Group finished") : L("执行已停止，请检查未完成的节点和上游输入", "Group stopped; check unfinished nodes and their inputs"), !complete);
    } finally {
      if (groupRunRef.current === task) { groupRunRef.current = null; if (!lifetime.current.signal.aborted) setGroupProgress(null); }
    }
  }, [L, cancelPending, lifetime, requireLogin, run, say]);

  /* ------------------------------------------------------------- assets */

  const addFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }, referenceTarget?: string) => {
      const accepted = files.filter((file) =>
        file.type.startsWith("image/") ? file.size <= MAX_IMAGE_BYTES : file.type.startsWith("video/") ? file.size <= MAX_VIDEO_BYTES : false,
      );
      if (accepted.length !== files.length) say(L("只支持 10MB 以内的图片、25MB 以内的视频", "Images up to 10 MB and videos up to 25 MB only"), true);
      if (!accepted.length) return;
      const origin = at ?? viewCenter();
      const created = accepted.map((file, index) => {
        const media = file.type.startsWith("video/") ? "video" : "image";
        return { file, node: makeNode({ kind: "media", media, title: file.name.slice(0, 60), mime: file.type, url: URL.createObjectURL(file), busy: true }, { x: origin.x + index * 32, y: origin.y + index * 32 }) };
      });
      const sources = created.map((item) => item.node);
      const wires = referenceTarget ? sources.filter((node) => checkConnection(node.id, referenceTarget, [...nodesRef.current, ...sources] as GraphNode[], edgesRef.current).ok).map((node) => wire(node.id, referenceTarget)) : [];
      addNodes(sources, wires, !referenceTarget);
      // Every file is kept in this browser before any upload starts, so a
      // reload mid-upload keeps them all (saving uploads what is still local).
      const kept = await Promise.all(created.map(({ file }) => saveGuestAsset(file, userId).catch(() => null)));
      if (lifetime.current.signal.aborted) return;
      created.forEach(({ node }, index) => {
        const asset = kept[index];
        if (asset) patch(node.id, { localId: asset.id, url: asset.url } as Partial<MediaData>);
      });
      for (const [index, { file, node }] of created.entries()) {
        const asset = kept[index];
        try {
          if (!asset) throw new Error(L("素材读取失败", "Could not read this file"));
          if (userId) {
            const result = await uploadCanvasFile(file);
            if (lifetime.current.signal.aborted) return;
            patch(node.id, { assetKey: result.key, url: result.url, localId: undefined, busy: false } as Partial<MediaData>);
            // The browser store is shared by everyone using this browser: a
            // signed-in upload does not stay there once it is in the account.
            void removeGuestAsset(asset.id).catch(() => {});
          } else {
            patch(node.id, { busy: false } as Partial<MediaData>);
          }
        } catch (error) {
          replaceGraph(nodesRef.current.filter((item) => item.id !== node.id), edgesRef.current.filter((edge) => edge.source !== node.id && edge.target !== node.id));
          say(error instanceof UploadError ? uploadErrorText(error, zh) : error instanceof Error ? error.message : L("上传失败", "Upload failed"), true);
        }
      }
    },
    [L, addNodes, lifetime, makeNode, patch, replaceGraph, say, uploadCanvasFile, userId, viewCenter, zh],
  );

  const replaceMedia = useCallback(async (id: string, file: File) => {
    const original = nodesRef.current.find((item) => item.id === id)?.data;
    if (original?.kind !== "media" || original.busy || original.media === "audio") return;
    const isVideo = original.media === "video";
    const accepted = isVideo ? ["video/mp4", "video/webm", "video/quicktime"] : ["image/png", "image/jpeg", "image/webp"];
    if (!accepted.includes(file.type) || file.size <= 0 || file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      say(isVideo ? L("请选择不超过 25 MB 的 MP4、WebM 或 MOV 视频", "Choose an MP4, WebM or MOV up to 25 MB") : L("请选择不超过 10 MB 的 PNG、JPEG 或 WebP 图片", "Choose a PNG, JPEG or WebP up to 10 MB"), true);
      return;
    }
    const generation = canvasGeneration.current;
    try {
      const source = userId
        ? await uploadCanvasFile(file)
        : await saveGuestAsset(file);
      if (generation !== canvasGeneration.current || !nodesRef.current.some((node) => node.id === id)) return;
      // Swap the reference only once the new file is usable. The same node ID
      // keeps every downstream wire intact, including after a failed upload.
      patch(id, {
        assetKey: "key" in source ? source.key : undefined,
        localId: "id" in source ? source.id : undefined, url: source.url, mime: file.type,
        resultUuid: undefined, resultIndex: undefined,
      } as Partial<MediaData>);
    } catch (error) {
      say(error instanceof UploadError ? uploadErrorText(error, zh) : L("替换失败，原素材已保留", "Replacement failed. The original asset is still in place."), true);
    }
  }, [L, patch, say, uploadCanvasFile, userId, zh]);

  const addPicked = useCallback(
    (picked: PickerAsset[]) => {
      const origin = viewCenter();
      // Elements and brand items made from a local upload carry a picker alias,
      // not the stored file's id: add their file like a fresh upload instead.
      const aliased = picked.filter((asset) => !asset.key && !/^work:/.test(asset.id) && asset.file && !/^[0-9a-f-]{36}$/i.test(asset.id));
      if (aliased.length) void addFiles(aliased.map((asset) => asset.file as File), origin);
      const assets = picked.filter((asset) => !aliased.includes(asset) && (asset.key || /^work:/.test(asset.id) || asset.file));
      const added = assets.map((asset, index) => {
        const media = asset.mimeType.startsWith("video/") ? "video" : "image";
        const work = /^work:([^:]+):(\d+)$/.exec(asset.id);
        const data: MediaData = {
          kind: "media",
          media,
          title: asset.name.slice(0, 60),
          mime: asset.mimeType,
          url: asset.url,
          ...(work ? { resultUuid: work[1], resultIndex: Number(work[2]) } : asset.key ? { assetKey: asset.key } : { localId: asset.id }),
        };
        return makeNode(data, { x: origin.x + index * 36, y: origin.y + index * 36 });
      });
      if (added.length) addNodes(added);
      setPickerOpen(false);
    },
    [addFiles, addNodes, makeNode, viewCenter],
  );

  /* ------------------------------------------------------ edit and shots */

  const nodeById = (id: string) => nodesRef.current.find((node) => node.id === id);

  /** A spot right of a node, moved down past anything already there. */
  const besideOf = (id: string, dy = 0, size = { width: 320, height: 300 }) => {
    const node = nodeById(id);
    const abs = node?.positionAbsolute ?? node?.position ?? { x: 0, y: 0 };
    const spot = { x: abs.x + (node?.width ?? 300) + 120, y: abs.y + dy };
    const taken = nodesRef.current
      .filter((item) => item.id !== id && !item.parentNode)
      .map((item) => ({ ...(item.positionAbsolute ?? item.position), w: item.width ?? 300, h: item.height ?? 240 }));
    for (let tries = 0; tries < 40; tries += 1) {
      const hit = taken.find((box) => spot.x < box.x + box.w + 24 && spot.x + size.width + 24 > box.x && spot.y < box.y + box.h + 24 && spot.y + size.height + 24 > box.y);
      if (!hit) break;
      spot.y = hit.y + hit.h + 40;
    }
    return spot;
  };

  const editTarget = editing ? nodeById(editing.id) : undefined;

  const submitEdit = useCallback(
    async (payload: CanvasEditSubmit) => {
      if (!editing || !requireLogin() || editLock.current) return;
      const source = nodeById(editing.id);
      if (!source) return;
      // One confirm, one job: locked before anything is awaited.
      editLock.current = true;
      const session = editSession.current;
      setEditSubmitting(true);
      try {
        let maskKey: string | undefined;
        if (payload.action !== "animate" && payload.compositeFile) {
          const uploaded = await uploadCanvasFile(payload.compositeFile);
          maskKey = uploaded.key;
        }
        // Closed while the mask uploaded: cancelled, nothing is generated.
        if (session !== editSession.current) return;
        const names: Record<CanvasEditAction, string> = {
          inpaint: L("局部重绘", "Inpaint"),
          erase: L("消除", "Erase"),
          outpaint: L("扩图", "Expand"),
          cutout: L("抠图", "Cutout"),
          upscale: L("高清放大", "Upscale"),
          "text-edit": L("改文字", "Edit text"),
          animate: L("图生视频", "Animate"),
        };
        const data: GenerateData =
          payload.action === "animate"
            ? { ...defaultsFor("video", names.animate, payload.prompt), modelId: payload.modelId, duration: payload.duration, aspect: payload.aspectRatio, resolution: payload.resolution, audio: payload.audio }
            : { ...defaultsFor("image", names[payload.action], payload.prompt), modelId: payload.modelId, aspect: payload.aspectRatio, resolution: payload.resolution, count: 1, ...(maskKey ? { maskKey } : {}) };
        const node = makeNode(data, besideOf(source.id));
        addNodes([node], [wire(source.id, node.id)]);
        setEditing(null);
        run(node.id);
      } catch (error) {
        say(error instanceof UploadError ? uploadErrorText(error, zh) : error instanceof Error ? error.message : L("提交失败", "Could not submit"), true);
      } finally {
        setEditSubmitting(false);
        editLock.current = false;
      }
    },
    [L, addNodes, editing, makeNode, requireLogin, run, say, uploadCanvasFile, zh],
  );

  const localCutout = useCallback(
    (_dataUrl: string, file: File) => {
      if (!editing) return;
      const at = besideOf(editing.id);
      setEditing(null);
      void addFiles([file], at);
    },
    [addFiles, editing],
  );

  const runShots = useCallback(
    (angles: { name: string; prompt: string }[], resolution: string, modelId: string) => {
      if (!shotsFor || !requireLogin()) return;
      const source = nodeById(shotsFor);
      if (!source) return;
      const basePrompt = isGen(source.data) ? source.data.prompt : "";
      const base = besideOf(source.id, 0, { width: 320, height: angles.length * 340 });
      const created = angles.map((angle, index) => {
        const draft = defaultsFor("image", angle.name, [angle.prompt, basePrompt].filter(Boolean).join(zh ? "。" : ". "));
        const sourceAspect = isGen(source.data) ? source.data.aspect : undefined;
        // withModel keeps only options the chosen model offers.
        const data = withModel({ ...draft, aspect: sourceAspect ?? draft.aspect, resolution: resolution || draft.resolution, count: 1 }, modelId);
        return makeNode(data, { x: base.x, y: base.y + index * 340 });
      });
      addNodes(created, created.map((node) => wire(source.id, node.id)));
      setShotsFor(null);
      for (const node of created) run(node.id);
    },
    [addNodes, makeNode, requireLogin, run, shotsFor, zh],
  );

  const compareSource = useCallback((id: string) => {
    const input = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current).find((node) => outputType(node.data) === "image" && outputUrl(node.data));
    return input ? outputUrl(input.data) : undefined;
  }, []);

  const captureFrame = useCallback(
    async (id: string) => {
      const node = nodeById(id);
      if (!node) return;
      const player = document.querySelector<HTMLVideoElement>(`video[data-node-id="${id}"]`);
      const time = player?.currentTime ?? 0;
      try {
        let blob: Blob | null = null;
        if (node.data.kind === "media" && node.data.localId) {
          blob = (await listGuestAssets(userId)).find((asset) => asset.id === (node.data as MediaData).localId)?.file ?? null;
        } else {
          const source = sameOriginUrl(node.data);
          if (!source) throw new Error();
          const response = await fetch(source);
          if (!response.ok) throw new Error();
          blob = await response.blob();
        }
        if (!blob) throw new Error();
        const url = URL.createObjectURL(blob);
        const video = document.createElement("video");
        video.muted = true;
        video.src = url;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error());
        });
        video.currentTime = Math.min(time, Math.max(0, video.duration - 0.05));
        await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        URL.revokeObjectURL(url);
        const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!frame) throw new Error();
        await addFiles([new File([frame], `${(node.data.title || "frame").slice(0, 40)}-frame.png`, { type: "image/png" })], besideOf(id));
      } catch {
        say(L("截帧失败，请等视频加载完成后再试", "Could not capture a frame; wait for the video to load"), true);
      }
    },
    [L, addFiles, say, userId],
  );

  const spreadSteps = useCallback(
    (id: string) => {
      const node = nodeById(id);
      if (!node || node.data.kind !== "agent" || !node.data.steps?.length) return;
      const steps = node.data.steps;
      const start = besideOf(id, 0, { width: steps.length * 290 + 28, height: 260 });
      const group = makeNode({ kind: "group", title: L("Agent 分镜", "Agent shots") }, { x: start.x, y: start.y });
      group.style = { width: steps.length * 290 + 28, height: 260 };
      const cards = steps.map((step, index) => ({
        ...makeNode({ kind: "text", title: `${index + 1}. ${step.title}`.slice(0, 60), text: step.instruction }, { x: 24 + index * 290, y: 56 }),
        parentNode: group.id,
      }));
      addNodes([group, ...cards]);
    },
    [L, addNodes, makeNode],
  );

  const agentToVideo = useCallback(
    (id: string) => {
      const node = nodeById(id);
      if (!node || node.data.kind !== "agent") return;
      const video = makeNode(defaultsFor("video", L("Agent 视频", "Agent video")), besideOf(id));
      const max = choicesFor("video", (video.data as GenerateData).modelId).maxImages;
      const images = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current).filter((item) => outputType(item.data) === "image").slice(0, max);
      addNodes([video], [wire(id, video.id), ...images.map((item) => wire(item.id, video.id))]);
    },
    [L, addNodes, makeNode],
  );

  /* ------------------------------------------------------ select & group */

  const selected = nodes.filter((node) => node.selected);

  const absolute = (node: FlowNode) => worldPosition(node, nodesRef.current);

  const focusNode = (node: FlowNode) => {
    setNodes((list) => list.map((item) => ({ ...item, selected: item.id === node.id })));
    const abs = flow.getNode(node.id)?.positionAbsolute ?? absolute(node);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    flow.setCenter(abs.x + (node.width ?? 280) / 2, abs.y + (node.height ?? 200) / 2, { zoom: 1, duration: reduced ? 0 : 250 });
  };

  const groupSelected = useCallback(() => {
    const members = nodesRef.current.filter((node) => node.selected && node.data.kind !== "group");
    if (members.length < 1) return;
    const boxes = members.map((node) => ({ ...absolute(node), w: node.width ?? 280, h: node.height ?? 200 }));
    const minX = Math.min(...boxes.map((box) => box.x)) - 80;
    const minY = Math.min(...boxes.map((box) => box.y)) - 80;
    const maxX = Math.max(...boxes.map((box) => box.x + box.w)) + 80;
    const maxY = Math.max(...boxes.map((box) => box.y + box.h)) + 80;
    const group = makeNode({ kind: "group", title: L("分组", "Group") }, { x: minX, y: minY });
    group.style = { width: maxX - minX, height: maxY - minY };
    const ids = new Set(members.map((node) => node.id));
    const next = nodesRef.current.map((node) =>
      ids.has(node.id) ? { ...node, parentNode: group.id, position: { x: absolute(node).x - minX, y: absolute(node).y - minY }, selected: false } : { ...node, selected: false },
    );
    replaceGraph([{ ...group, selected: true }, ...next], edgesRef.current);
    commit();
  }, [L, commit, makeNode, replaceGraph]);

  const ungroup = useCallback(
    (groupId: string) => {
      const next = nodesRef.current
        .filter((node) => node.id !== groupId)
        .map((node) => (node.parentNode === groupId ? { ...node, parentNode: undefined, position: absolute(node) } : node));
      replaceGraph(next, edgesRef.current);
      commit();
    },
    [commit, replaceGraph],
  );

  const duplicateSelected = useCallback(
    (source?: { nodes: FlowNode[]; edges: Edge[] }, offset: number | { x: number; y: number } = 48) => {
      const picked = source?.nodes ?? selectionWithChildren(nodesRef.current);
      if (!picked.length) return;
      const ids = new Map(picked.map((node) => [node.id, newId()]));
      const roots = picked.filter((node) => !node.parentNode || !ids.has(node.parentNode));
      const dx = typeof offset === "number" ? offset : offset.x - Math.min(...roots.map((node) => absolute(node).x));
      const dy = typeof offset === "number" ? offset : offset.y - Math.min(...roots.map((node) => absolute(node).y));
      const copies = picked.map((node) => {
        const parent = node.parentNode && ids.has(node.parentNode) ? ids.get(node.parentNode) : undefined;
        let data = { ...node.data } as CanvasData;
        if (isGen(data)) data = copyGenerationSettings(data, "duplicate");
        if (data.kind === "agent" && data.status !== "done") data = { ...data, status: "idle" };
        return {
          ...node,
          id: ids.get(node.id)!,
          data,
          parentNode: parent,
          position: parent ? node.position : { x: absolute(node).x + dx, y: absolute(node).y + dy },
          positionAbsolute: undefined,
          selected: true,
        } as FlowNode;
      });
      const pool = source?.edges ?? edgesRef.current;
      const wires = pool.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => wire(ids.get(edge.source)!, ids.get(edge.target)!));
      const next = [...nodesRef.current.map((node) => ({ ...node, selected: false })), ...copies.map((node) => ({ ...node, selected: !node.parentNode }))];
      replaceGraph(next, [...edgesRef.current, ...wires]);
      commit();
    },
    [commit, replaceGraph],
  );

  const copySelection = useCallback(() => {
    const picked = selectionWithChildren(nodesRef.current);
    if (picked.length) clipboard.current = { nodes: picked, edges: edgesRef.current };
  }, []);

  const pasteSelection = useCallback((at?: { x: number; y: number }) => {
    if (clipboard.current) duplicateSelected(clipboard.current, at ?? (cursor.current ? flow.screenToFlowPosition(cursor.current) : viewCenter()));
  }, [duplicateSelected, flow, viewCenter]);

  const [downloading, setDownloading] = useState(false);
  const downloadSelection = useCallback(async () => {
    if (downloading) return;
    const generation = canvasGeneration.current;
    const current = () => !lifetime.current.signal.aborted && generation === canvasGeneration.current;
    setDownloading(true);
    try {
      const files: { title: string; blob: Blob }[] = [];
      for (const { data } of selectionWithChildren(nodesRef.current)) {
        if (!current()) return;
        if (data.kind === "text" && data.text) { files.push({ title: data.title, blob: new Blob([data.text], { type: "text/plain" }) }); continue; }
        let url = sameOriginUrl(data);
        if (!url && data.kind === "media") url = getCanvasSound(data.soundId)?.url ?? (data.url?.startsWith("blob:") ? data.url : null);
        if (!url) continue;
        const response = await (url.startsWith("blob:") ? fetch(url, { signal: lifetime.current.signal }) : canvasFetch(url));
        if (!response.ok) throw new Error();
        files.push({ title: data.title, blob: await response.blob() });
      }
      if (!current()) return;
      if (!files.length) { say(L("所选节点还没有可下载的内容", "Selected nodes have no content to download")); return; }
      const { canvasZip } = await import("@/lib/creative-space/canvas-export");
      const archive = await canvasZip(files);
      if (!current()) return;
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${titleRef.current || "canvas"}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (current()) say(L("素材下载失败，请稍后重试", "Could not download the selected assets"), true); }
    finally { if (current()) setDownloading(false); }
  }, [L, canvasFetch, downloading, lifetime, say]);

  const align = useCallback(
    (mode: "row" | "column" | "grid") => {
      const group = nodesRef.current.find((node) => node.selected && node.data.kind === "group");
      const picked = nodesRef.current.filter((node) => group ? node.parentNode === group.id : node.selected && !node.parentNode);
      if (picked.length < 2) return;
      const sorted = [...picked].sort((a, b) => (mode === "column" ? a.position.y - b.position.y : a.position.x - b.position.x || a.position.y - b.position.y));
      const start = group ? { x: 80, y: 80 } : { x: Math.min(...picked.map((node) => node.position.x)), y: Math.min(...picked.map((node) => node.position.y)) };
      const positions = new Map<string, { x: number; y: number }>();
      let x = start.x;
      let y = start.y;
      const cellWidth = Math.max(...picked.map((node) => node.width ?? 280)) + 40;
      const cellHeight = Math.max(...picked.map((node) => node.height ?? 280)) + 60;
      sorted.forEach((node, index) => {
        if (mode === "grid") {
          const col = index % 3;
          const row = Math.floor(index / 3);
          positions.set(node.id, { x: start.x + col * cellWidth, y: start.y + row * cellHeight });
        } else {
          positions.set(node.id, { x, y });
          if (mode === "row") x += (node.width ?? 280) + 40;
          else y += (node.height ?? 200) + 40;
        }
      });
      const frame = group ? {
        width: Math.max(...picked.map((node) => positions.get(node.id)!.x + (node.width ?? 280))) + 80,
        height: Math.max(...picked.map((node) => positions.get(node.id)!.y + (node.height ?? 280))) + 80,
      } : null;
      replaceGraph(nodesRef.current.map((node) => {
        if (frame && node.id === group?.id) return { ...node, style: { ...node.style, ...frame } };
        return positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node;
      }), edgesRef.current);
      commit();
    },
    [commit, replaceGraph],
  );

  const arrange = useCallback(() => {
    const top = nodesRef.current.filter((node) => !node.parentNode);
    if (top.length < 2) return;
    const topOf = (id: string) => {
      let node = nodesRef.current.find((item) => item.id === id);
      while (node?.parentNode) node = nodesRef.current.find((item) => item.id === node!.parentNode);
      return node?.id ?? id;
    };
    const positions = arrangeBoxes(
      top.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y, width: node.width ?? 280, height: node.height ?? 200 })),
      edgesRef.current.map((edge) => ({ source: topOf(edge.source), target: topOf(edge.target) })),
    );
    replaceGraph(nodesRef.current.map((node) => (positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node)), edgesRef.current);
    commit();
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 300, maxZoom: 1 }));
  }, [commit, flow, replaceGraph]);

  const deleteSelected = useCallback(() => {
    const ids = new Set(nodesRef.current.filter((node) => node.selected).map((node) => node.id));
    if (!ids.size) return;
    // Children of a deleted group go with it, like React Flow's own delete.
    for (const node of nodesRef.current) if (node.parentNode && ids.has(node.parentNode)) ids.add(node.id);
    replaceGraph(
      nodesRef.current.filter((node) => !ids.has(node.id)),
      edgesRef.current.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)),
    );
    commit();
  }, [commit, replaceGraph]);

  const wireSelectedInto = useCallback(
    (kind: "image" | "video") => {
      const sources = nodesRef.current.filter((node) => node.selected && outputType(node.data) === "image" && hasOutput(node.data));
      if (!sources.length) return;
      const right = Math.max(...sources.map((node) => absolute(node).x + (node.width ?? 280)));
      const top = Math.min(...sources.map((node) => absolute(node).y));
      const target = makeNode(defaultsFor(kind, KIND_LABEL[kind][zh ? "zh" : "en"]), { x: right + 140, y: top });
      const max = choicesFor(kind, (target.data as GenerateData).modelId).maxImages;
      addNodes([target], sources.slice(0, Math.max(1, max)).map((node) => wire(node.id, target.id)));
      if (sources.length > max) say(L(`这个模型最多用 ${max} 张参考图，只连了前 ${max} 张`, `This model takes ${max} images; wired the first ${max}`));
    },
    [L, addNodes, makeNode, say, zh],
  );

  /* -------------------------------------------------------- templates */

  const insertTemplate = useCallback(
    (template: CanvasTemplate) => {
      const { nodes: specs, edges: links } = template.build();
      const origin = viewCenter();
      const keys = new Map<string, FlowNode>();
      for (const spec of specs) keys.set(spec.key, makeNode(spec.data, { x: origin.x + spec.x, y: origin.y + spec.y }));
      addNodes([...keys.values()], links.flatMap(([a, b]) => (keys.get(a) && keys.get(b) ? [wire(keys.get(a)!.id, keys.get(b)!.id)] : [])));
      setTemplatesOpen(false);
      requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 300, maxZoom: 1 }));
    },
    [addNodes, flow, makeNode, viewCenter],
  );

  const saveTemplate = useCallback(
    (name: string) => {
      const chosen = selectionWithChildren(nodesRef.current);
      const pool = chosen.length ? chosen : nodesRef.current;
      if (!pool.length) return;
      const ids = new Set(pool.map((node) => node.id));
      const graph = toStoredGraph(
        pool.map((node) => {
          const data = node.data;
          // A template keeps settings and prompts, not results.
          if (isGen(data)) return { ...node, data: copyGenerationSettings(data, "template") } as GraphNode;
          if (data.kind === "agent") return { ...node, data: { ...data, status: "idle", reply: undefined, steps: undefined, error: null } } as GraphNode;
          return node as GraphNode;
        }),
        edgesRef.current.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      );
      const next = [{ id: newId(), name: name.slice(0, 40), graph }, ...userTemplates].slice(0, 20);
      setUserTemplates(next);
      try {
        localStorage.setItem(templatesKey, JSON.stringify(next));
      } catch {
        say(L("浏览器存储已满，模板没保存", "Browser storage is full"), true);
        return;
      }
      say(L("已存为模板", "Saved as a template"));
    },
    [L, say, templatesKey, userTemplates],
  );

  const insertUserTemplate = useCallback(
    (graph: ReturnType<typeof toStoredGraph>) => {
      const restored = fromStoredGraph(graph, unknownRequest);
      const minX = Math.min(...restored.nodes.map((node) => (node.parentNode ? Number.POSITIVE_INFINITY : node.position.x)));
      const minY = Math.min(...restored.nodes.map((node) => (node.parentNode ? Number.POSITIVE_INFINITY : node.position.y)));
      const origin = viewCenter();
      const shifted = restored.nodes.map((node) => ({
        ...node,
        type: node.data.kind,
        position: node.parentNode ? node.position : { x: node.position.x - minX, y: node.position.y - minY },
      })) as FlowNode[];
      duplicateSelected({ nodes: shifted.map((node) => (node.parentNode ? node : { ...node, position: { x: node.position.x + origin.x, y: node.position.y + origin.y } })), edges: restored.edges }, 0);
      setTemplatesOpen(false);
    },
    [duplicateSelected, unknownRequest, viewCenter],
  );

  const importLegacy = useCallback(() => {
    try {
      const value = JSON.parse(localStorage.getItem(LEGACY_CANVAS_KEY) || "null");
      const result = fromLegacyLocalCanvas(value, newId);
      // The old workflow editor's draft: version 1 graph, migrated, with new ids.
      const flowDraft = JSON.parse(localStorage.getItem(LEGACY_FLOW_KEY) || "null") as { graph?: unknown } | null;
      if (flowDraft?.graph) {
        const migrated = fromStoredGraph(flowDraft.graph, unknownRequest);
        const ids = new Map(migrated.nodes.map((node) => [node.id, newId()]));
        const shiftX = result.nodes.length ? Math.max(...result.nodes.map((node) => node.position.x + 400)) - Math.min(...migrated.nodes.map((node) => node.position.x), 0) : 0;
        result.nodes.push(...migrated.nodes.map((node) => ({ ...node, id: ids.get(node.id)!, position: { x: node.position.x + shiftX, y: node.position.y } })));
        result.edges.push(...migrated.edges.map((edge) => ({ id: newId(), source: ids.get(edge.source)!, target: ids.get(edge.target)! })));
      }
      if (!result.nodes.length) {
        localStorage.setItem(LEGACY_DONE_KEY, "1");
        setLegacyCount(0);
        say(L("旧画布里没有能导入的内容", "Nothing in the old canvas could be imported"), true);
        return;
      }
      const offset = viewCenter();
      const minX = Math.min(...result.nodes.map((node) => node.position.x));
      const minY = Math.min(...result.nodes.map((node) => node.position.y));
      addNodes(
        result.nodes.map((node) => ({ ...node, type: node.data.kind, position: { x: node.position.x - minX + offset.x, y: node.position.y - minY + offset.y } })) as FlowNode[],
        result.edges.map((edge) => ({ ...edge, sourceHandle: "out", targetHandle: "in" })),
      );
      localStorage.setItem(LEGACY_DONE_KEY, "1");
      setLegacyCount(0);
      if (result.title && nodesRef.current.length === result.nodes.length) setTitle(result.title);
      say(
        result.skipped
          ? L(`已导入 ${result.nodes.length} 个节点；${result.skipped} 个只存在浏览器里的临时素材无法导入`, `Imported ${result.nodes.length} nodes; ${result.skipped} browser-only files could not be kept`)
          : L(`已导入 ${result.nodes.length} 个节点`, `Imported ${result.nodes.length} nodes`),
      );
      void resolveAll();
      requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 300, maxZoom: 1 }));
    } catch {
      say(L("旧画布读取失败", "Could not read the old canvas"), true);
    }
  }, [L, addNodes, flow, resolveAll, say, unknownRequest, viewCenter]);

  /* ------------------------------------------------------ flow handlers */

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeBase(changes);
      if (changes.some((change) => change.type === "remove")) commit();
    },
    [commit, onNodesChangeBase],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!checkConnection(connection.source, connection.target, nodesRef.current as GraphNode[], edgesRef.current).ok) return;
      setEdges((list) => {
        const next = [...list, wire(connection.source!, connection.target!)];
        edgesRef.current = next;
        return next;
      });
      connectFrom.current = null;
      commit();
    },
    [commit, setEdges],
  );

  const referencesFor = useCallback((targetId: string): CanvasReference[] => {
    const target = nodesRef.current.find((node) => node.id === targetId)?.data;
    if (!target || !(target.kind === "text" || target.kind === "agent" || target.kind === "image" || target.kind === "video")) return [];
    const agent = target.kind === "agent" || target.kind === "text";
    const limit = agent ? 8 : choicesFor(target.kind, target.modelId).maxImages;
    if (!limit) return [];
    const allowed = (data: CanvasData) => hasOutput(data) && (outputType(data) === "image" || (agent && outputType(data) === "video"));
    const wired = directInputs(targetId, nodesRef.current as GraphNode[], edgesRef.current).filter(({ data }) => allowed(data));
    return nodesRef.current.flatMap((node) => {
      if (!allowed(node.data)) return [];
      const index = wired.findIndex((input) => input.id === node.id);
      if (index >= limit || (index < 0 && (wired.length >= limit || !checkConnection(node.id, targetId, nodesRef.current as GraphNode[], edgesRef.current).ok))) return [];
      const name = node.data.title || KIND_LABEL[node.data.kind][zh ? "zh" : "en"];
      return [{ id: node.id, name, url: outputUrl(node.data), media: outputType(node.data) === "video" ? "video" as const : "image" as const, token: agent ? String.fromCharCode(65 + (index < 0 ? wired.length : index)) : name, connected: index >= 0 }];
    });
  }, [zh]);

  const attachReference = useCallback((target: string, ref: CanvasReference) => {
    const current = referencesFor(target).find((item) => item.id === ref.id);
    if (!current || ref.token !== current.token) return false;
    if (!current.connected) onConnect({ source: ref.id, target, sourceHandle: "out", targetHandle: "in" });
    return true;
  }, [onConnect, referencesFor]);

  const detachImageReferences = useCallback((id: string) => {
    const imageIds = new Set(nodesRef.current.filter((node) => outputType(node.data) === "image").map((node) => node.id));
    replaceGraph(nodesRef.current, edgesRef.current.filter((edge) => edge.target !== id || !imageIds.has(edge.source)));
    commit();
  }, [commit, replaceGraph]);

  const uploadImageReference = useCallback(async (id: string, file: File) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || !(node.data.kind === "text" || node.data.kind === "image" || node.data.kind === "video")) return;
    const forText = node.data.kind === "text";
    const cap = node.data.kind === "text" ? 8 : choicesFor(node.data.kind, node.data.modelId).maxImages;
    const linked = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current).filter((source) => outputType(source.data) === "image" || (forText && outputType(source.data) === "video")).length;
    if (!cap || linked >= cap) { say(L(`当前模型最多可用 ${cap} 张参考图`, `This model accepts up to ${cap} reference images`), true); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { say(L("请选择 PNG、JPEG 或 WebP 图片", "Choose a PNG, JPEG or WebP image"), true); return; }
    const point = absolute(node);
    await addFiles([file], { x: point.x - 400, y: point.y + linked * 320 }, id);
  }, [L, addFiles, say]);

  const onConnectStart = useCallback((_: unknown, params: OnConnectStartParams) => {
    const node = params.nodeId ? nodesRef.current.find((item) => item.id === params.nodeId) : undefined;
    const type = node && outputType(node.data);
    connectFrom.current = node && params.handleType ? { id: node.id, side: params.handleType, type: type || undefined } : null;
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const from = connectFrom.current;
      connectFrom.current = null;
      if (!from) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      // Released over empty canvas (not a node, port or toolbar): offer nodes that take it.
      const target = document.elementFromPoint(point.clientX, point.clientY) as HTMLElement | null;
      if (!target?.closest(".react-flow") || target.closest(".react-flow__node, .react-flow__handle, .react-flow__panel, .react-flow__nodesselection")) return;
      // The release is followed by a click on the pane, which would close the menu at once.
      menuOpenedAt.current = Date.now();
      setMenu({ x: point.clientX, y: point.clientY, flow: flow.screenToFlowPosition({ x: point.clientX, y: point.clientY }), from });
    },
    [flow],
  );

  /** Dropping a node onto a group puts it in; dragging it out takes it out. */
  const showAlignment = (_event: ReactMouseEvent, dragged: FlowNode) => {
    if (!viewOptions.alignGuides || !flowBox.current) return;
    const box = flowBox.current.getBoundingClientRect();
    const viewport = flow.getViewport();
    const position = absolute(dragged);
    const mark: { x?: number; y?: number } = {};
    const x = [position.x, position.x + (dragged.width ?? 0) / 2, position.x + (dragged.width ?? 0)];
    const y = [position.y, position.y + (dragged.height ?? 0) / 2, position.y + (dragged.height ?? 0)];
    const tolerance = 4 / viewport.zoom;
    for (const other of nodesRef.current) {
      if (other.id === dragged.id || other.selected || other.id === dragged.parentNode || other.parentNode === dragged.id) continue;
      const point = absolute(other);
      const targetX = [point.x, point.x + (other.width ?? 0) / 2, point.x + (other.width ?? 0)];
      const targetY = [point.y, point.y + (other.height ?? 0) / 2, point.y + (other.height ?? 0)];
      const matchX = targetX.find((a) => x.some((b) => Math.abs(a - b) <= tolerance));
      const matchY = targetY.find((a) => y.some((b) => Math.abs(a - b) <= tolerance));
      if (mark.x === undefined && matchX !== undefined) mark.x = flow.flowToScreenPosition({ x: matchX, y: 0 }).x - box.left;
      if (mark.y === undefined && matchY !== undefined) mark.y = flow.flowToScreenPosition({ x: 0, y: matchY }).y - box.top;
      if (mark.x !== undefined && mark.y !== undefined) break;
    }
    setGuides((prev) => prev.x === mark.x && prev.y === mark.y ? prev : mark);
  };

  const onNodeDragStop = useCallback(
    (_: ReactMouseEvent, dragged: FlowNode) => {
      setGuides({});
      const moved = nodesRef.current.filter((node) => node.selected || node.id === dragged.id).filter((node) => node.data.kind !== "group");
      const groups = nodesRef.current.filter((node) => node.data.kind === "group");
      let changed = false;
      const next = nodesRef.current.map((node) => {
        if (!moved.some((item) => item.id === node.id)) return node;
        const abs = absolute(node);
        const center = { x: abs.x + (node.width ?? 0) / 2, y: abs.y + (node.height ?? 0) / 2 };
        const host = groups.find((group) => {
          const g = absolute(group);
          return center.x > g.x && center.x < g.x + (group.width ?? 0) && center.y > g.y && center.y < g.y + (group.height ?? 0);
        });
        if ((host?.id ?? undefined) === node.parentNode) return node;
        changed = true;
        if (!host) return { ...node, parentNode: undefined, position: abs };
        const g = absolute(host);
        return { ...node, parentNode: host.id, position: { x: abs.x - g.x, y: abs.y - g.y } };
      });
      if (changed) replaceGraph(next, edgesRef.current);
      commit();
    },
    [commit, replaceGraph],
  );

  const disconnect = useCallback(
    (id: string) => {
      setEdges((list) => {
        const next = list.filter((edge) => edge.id !== id);
        edgesRef.current = next;
        return next;
      });
      setEdgeMenu(null);
      commit();
    },
    [commit, setEdges],
  );

  /* ------------------------------------------------------------ keyboard */

  useEffect(() => {
    const typing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
    };
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel("locate");
        return;
      }
      if (typing(event.target) || document.querySelector("[aria-modal=true], dialog[open]")) return;
      const key = event.key.toLowerCase();
      if ((!mod && !event.altKey && ["w", "a", "s", "d", "q", "e"].includes(key)) || (mod && ["=", "+", "-", "0"].includes(key))) {
        event.preventDefault();
        const viewport = flow.getViewport();
        const step = 28 * viewOptions.speed * (event.shiftKey ? viewOptions.boost : 1);
        if (key === "0") flow.fitView({ padding: 0.15, maxZoom: 1.5 });
        else if (["q", "e", "=", "+", "-"].includes(key)) flow.zoomTo(Math.min(3, Math.max(0.1, viewport.zoom * Math.exp((key === "q" || key === "-" ? -1 : 1) * step / 180))));
        else flow.setViewport({ ...viewport, x: viewport.x + (key === "a" ? step : key === "d" ? -step : 0), y: viewport.y + (key === "w" ? step : key === "s" ? -step : 0) });
        return;
      }
      if (key === "f2") {
        const picked = nodesRef.current.filter((node) => node.selected);
        if (picked.length === 1) { event.preventDefault(); editField({ id: picked[0].id, field: "title" }); setMenu(null); }
      } else if (key === "tab" && !event.shiftKey && !mod && cursor.current && flowBox.current?.contains(document.activeElement) && (document.activeElement === flowBox.current || document.activeElement?.closest(".react-flow__node,.react-flow__pane"))) {
        event.preventDefault();
        setMenu({ ...cursor.current, flow: flow.screenToFlowPosition(cursor.current) });
      } else if (mod && key === "z") {
        event.preventDefault();
        restore(event.shiftKey ? 1 : -1);
      } else if (mod && key === "y") {
        event.preventDefault();
        restore(1);
      } else if (mod && key === "c") {
        copySelection();
      } else if (mod && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (mod && key === "g") {
        event.preventDefault();
        const only = nodesRef.current.filter((node) => node.selected);
        if (only.length === 1 && only[0].data.kind === "group") ungroup(only[0].id);
        else groupSelected();
      } else if (mod && key === "a") {
        event.preventDefault();
        setNodes((list) => list.map((node) => ({ ...node, selected: true })));
      } else if (!mod && key === "l") setShowEdges((value) => !value);
      else if (!mod && key === "m") setShowMinimap((value) => !value);
      else if (!mod && key === "v") setSelectMode(true);
      else if (!mod && key === "h") setSelectMode(false);
      else if (!mod && (key === "?" || (event.shiftKey && key === "/"))) setShortcutsOpen(true);
      else if (key === "escape") {
        setMenu(null);
        setEdgeMenu(null);
      }
    };
    const onPaste = (event: ClipboardEvent) => {
      if (typing(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length) {
        event.preventDefault();
        void addFiles(files);
      } else if (clipboard.current) {
        event.preventDefault();
        pasteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [addFiles, copySelection, duplicateSelected, flow, groupSelected, pasteSelection, restore, setNodes, ungroup, viewOptions.speed, viewOptions.boost]);

  // A selected node's prompt panel opens below it; keep that panel on screen.
  const singleId = selected.length === 1 ? selected[0].id : null;
  useEffect(() => {
    if (!singleId) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector(".nc-panel-toolbar")?.getBoundingClientRect();
      const box = flowBox.current?.getBoundingClientRect();
      if (!panel || !box) return;
      // The minimap and zoom controls sit above node toolbars; treat them as the bottom edge too.
      let bottom = box.bottom - 12;
      for (const corner of document.querySelectorAll(".nc-flow .react-flow__minimap, .nc-flow .react-flow__controls")) {
        const r = corner.getBoundingClientRect();
        if (r.width && panel.right > r.left && panel.left < r.right) bottom = Math.min(bottom, r.top - 12);
      }
      const dy = panel.bottom > bottom ? Math.min(panel.bottom - bottom + 12, panel.top - box.top - 120) : 0;
      const dx = panel.right > box.right - 12 ? panel.right - box.right + 24 : panel.left < box.left + 12 ? panel.left - box.left - 24 : 0;
      if (dx === 0 && dy <= 0) return;
      const viewport = flow.getViewport();
      flow.setViewport({ x: viewport.x - dx, y: viewport.y - Math.max(0, dy), zoom: viewport.zoom }, { duration: 200 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flow, singleId]);

  /* ---------------------------------------------------------- rendering */

  const actions = useMemo<CanvasActions>(
    () => ({
      zh,
      patch,
      commit,
      run,
      pendingSeconds,
      editingField,
      editField,
      detachImageReferences,
      agentForm,
      uploadImageReference,
      inputsOf,
      quoteOf,
      edit: (id, action) => {
        if (requireLogin()) setEditing({ id, action });
      },
      shots: (id) => {
        if (requireLogin()) setShotsFor(id);
      },
      compare: (id) => {
        const node = nodeById(id);
        const before = compareSource(id);
        const after = node ? outputUrl(node.data) : undefined;
        if (before && after) setComparing({ before, after });
      },
      canCompare: (id) => Boolean(compareSource(id)),
      captureFrame: (id) => void captureFrame(id),
      replaceMedia,
      referencesFor,
      attachReference,
      spreadSteps,
      agentToVideo,
      singleSelection: selected.length === 1,
    }),
    [agentForm, agentToVideo, attachReference, referencesFor, captureFrame, commit, compareSource, detachImageReferences, editingField, uploadImageReference, inputsOf, patch, pendingSeconds, quoteOf, replaceMedia, requireLogin, run, selected.length, spreadSteps, zh],
  );

  /** Screen point → position inside the canvas area (menus are placed there, clamped to stay visible). */
  const toLocal = (point: { x: number; y: number }, width = 220, height = 320) => {
    const box = flowBox.current?.getBoundingClientRect();
    if (!box) return { left: point.x, top: point.y };
    return { left: Math.max(4, Math.min(Math.max(point.x - box.left, 8), box.width - width - 4)), top: Math.max(4, Math.min(Math.max(point.y - box.top, 8), box.height - height - 4)) };
  };
  const palettePosition = (point: Menu) => {
    const parent = toLocal(point, 210, 240);
    if (!point.panel) return toLocal(point);
    const width = flowBox.current?.clientWidth ?? window.innerWidth;
    const left = parent.left + 216;
    return { left: left + 210 <= width ? left : Math.max(4, parent.left - 216), top: toLocal(point, 210, 325).top };
  };
  const creatableKinds: CanvasKind[] = ["text", "image", "video", "audio", "agent", "group"];
  const link = menu?.from;
  const targetKind = link?.side === "target" ? nodeById(link.id)?.data.kind : undefined;
  const menuKinds = targetKind ? creatableKinds.filter((kind) => kind !== "group" && inputTypes(targetKind).includes(kind === "agent" ? "text" : kind as PortType)) : link?.type ? kindsAccepting(link.type) : creatableKinds;
  const openContext = (event: ReactMouseEvent, id?: string) => {
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    if (id && !nodesRef.current.find((node) => node.id === id)?.selected) {
      replaceGraph(nodesRef.current.map((node) => ({ ...node, selected: node.id === id })), edgesRef.current);
    }
    setEdgeMenu(null);
    setMenu({ ...point, flow: flow.screenToFlowPosition(point), panel: id ? "node" : "pane", id });
  };
  const selectedIds = new Set(selected.map((node) => node.id));
  const kindById = new Map(nodes.map((node) => [node.id, outputType(node.data)]));
  const visibleEdges = edges.map((edge) => {
    if (viewOptions.focusWires && selectedIds.size && !selectedIds.has(edge.source) && !selectedIds.has(edge.target)) return { ...edge, hidden: true };
    if (viewOptions.colorWires) return { ...edge, className: `nc-wire-${kindById.get(edge.source)}` };
    return edge;
  });
  const onlyGroup = selected.length === 1 && selected[0].data.kind === "group" ? selected[0] : null;
  const groupPlan = onlyGroup ? canvasGroupPlan(onlyGroup.id, nodes as GraphNode[], edges) : [];
  const groupCost = groupPlan.reduce((sum, node) => sum + (isGen(node.data) && !["running", "submitting"].includes(node.data.status) ? quoteOf(node.id) ?? 0 : 0), 0);
  const selectedImages = selected.filter((node) => outputType(node.data) === "image" && hasOutput(node.data)).length;
  const saveLabel: Record<SaveState, string> = {
    idle: userId ? L("加入节点后自动保存", "Saves automatically") : "",
    local: L("未登录：保存在这台设备的浏览器里", "Signed out: kept in this browser"),
    dirty: L("有改动，稍后自动保存", "Unsaved changes"),
    saving: L("保存中…", "Saving…"),
    saved: L("已保存到账号", "Saved"),
    error: L("保存失败，稍后自动重试", "Save failed; retrying"),
  };
  const shotsSource = shotsFor ? nodeById(shotsFor) : undefined;
  const editImage = editTarget ? { label: editTarget.data.title || "A", name: editTarget.data.title || "image", url: outputUrl(editTarget.data) ?? "", aspectRatio: isGen(editTarget.data) ? editTarget.data.aspect : undefined } : null;

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="nc-shell">
        <CanvasHeader zh={zh} title={title} onTitle={setTitle} back={localizedHref(locale,"/creative-space")} creditsHref={localizedHref(locale,"/credits")} contactHref={localizedHref(locale,"/contact")}
          save={saveLabel[saveState]} saveState={saveState} account={!!userId} balance={balance} signIn={requireLogin}
          canvases={canvases} canvasId={canvasId} onChoose={id => void openCanvas(id)} onNew={() => void newCanvas()} onDelete={() => void deleteCanvas()}
          canUndo={canUndo} canRedo={canRedo} undo={() => restore(-1)} redo={() => restore(1)} arrange={arrange}
          edgesOn={showEdges} toggleEdges={() => setShowEdges(v => !v)} mapOn={showMinimap} toggleMap={() => setShowMinimap(v => !v)} />
        <div className="nc-body">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                void addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />

          <div
            ref={flowBox}
            tabIndex={-1}
            onPointerMove={(event) => { cursor.current = { x: event.clientX, y: event.clientY }; }}
            data-backdrop={viewOptions.backdrop}
            style={{ ...appearance, "--du-canvas-toolbar-scale": viewOptions.toolbarScale } as CSSProperties}
            className={`nc-flow${showEdges ? "" : " edges-hidden"}${viewOptions.simple && farOut ? " is-far-out" : ""}`}
            onDoubleClick={(event) => {
              if (!(event.target as HTMLElement).classList.contains("react-flow__pane")) return;
              setMenu({ x: event.clientX, y: event.clientY, flow: flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }) });
            }}
            onDragOver={(event: DragEvent) => event.preventDefault()}
            onDrop={(event: DragEvent) => {
              event.preventDefault();
              if (event.dataTransfer.files.length) void addFiles(Array.from(event.dataTransfer.files), flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={visibleEdges}
              nodeTypes={NODE_TYPES}
              edgeTypes={CANVAS_EDGE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdgesDelete={commit}
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              onNodeContextMenu={(event, node) => openContext(event, node.id)}
              onSelectionContextMenu={(event, picked) => openContext(event, picked[0]?.id)}
              onPaneContextMenu={(event) => openContext(event)}
              onNodeDrag={showAlignment}
              selectNodesOnDrag={viewOptions.dragSelect}
              onNodeDragStop={onNodeDragStop}
              onEdgeClick={(event, edge) => setEdgeMenu({ id: edge.id, x: event.clientX, y: event.clientY })}
              onPaneClick={() => {
                flowBox.current?.focus({ preventScroll: true });
                if (Date.now() - menuOpenedAt.current > 300) setMenu(null);
                setEdgeMenu(null);
                setPanel(null);
              }}
              onMoveStart={() => { setEdgeMenu(null); setMenu(null); }}
              onMove={(_, view) => setFarOut(view.zoom < 0.14)}
              isValidConnection={(connection) => checkConnection(connection.source, connection.target, nodesRef.current as GraphNode[], edgesRef.current).ok}
              deleteKeyCode={["Backspace", "Delete"]}
              multiSelectionKeyCode={["Meta", "Shift", "Control"]}
              selectionOnDrag={selectMode}
              panOnDrag={selectMode ? [1, 2] : true}
              selectionMode={SelectionMode.Partial}
              zoomOnDoubleClick={false}
              panOnScroll={viewOptions.wheelPan}
              zoomOnScroll={!viewOptions.wheelPan}
              snapToGrid={viewOptions.snap}
              snapGrid={[viewOptions.gridSize, viewOptions.gridSize]}
              minZoom={0.1}
              maxZoom={3}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ type: "canvas" }}
            >
              {viewOptions.grid && <Background variant={BackgroundVariant.Dots} gap={viewOptions.gridSize} size={1} className="nc-bg" />}
              {showMinimap ? <MiniMap pannable zoomable position="bottom-right" className="nc-minimap" /> : null}
            </ReactFlow>

            {guides.x !== undefined && <span className="nc-guide-x" style={{ left: guides.x }} aria-hidden="true" />}
            {guides.y !== undefined && <span className="nc-guide-y" style={{ top: guides.y }} aria-hidden="true" />}
            {groupProgress && <div className="nc-group-progress">
              <output>{L(`正在执行第 ${groupProgress.index}/${groupProgress.total} 项`, `Running ${groupProgress.index}/${groupProgress.total}`)}</output>
              <button type="button" onClick={stopGroup}>{L("停止后续执行", "Stop remaining steps")}</button>
            </div>}
            {Object.keys(pendingSeconds).length > 0 && <div className="nc-grace-bar">
              <output>{L("即将提交", "Submitting")} · {Object.keys(pendingSeconds).length} {L("项", "queued")}</output>
              <button type="button" onClick={cancelAllPending}>{L("全部撤回", "Cancel queued")}</button>
            </div>}
            <CanvasViewMenu settingsOpen={panel === "settings"} closeSettings={() => setPanel(null)} background={background} saveBackground={saveBackground} zh={zh} options={viewOptions} change={(partial) => setViewOptions((current) => ({ ...current, ...partial }))} />
            <PinRail
              nodes={nodes}
              zh={zh}
              pick={focusNode}
              label={(node) => node.data.title || KIND_LABEL[node.data.kind][zh ? "zh" : "en"]}
              clear={(color) => {
                const next = nodesRef.current.map((node) => {
                  const pins = node.data.pins;
                  if (!pins?.length || (color && !pins.includes(color))) return node;
                  return { ...node, data: { ...node.data, pins: color ? pins.filter((pin) => pin !== color) : [] } };
                });
                replaceGraph(next, edgesRef.current);
              }}
            />
            <div className="nc-view-tools" role="toolbar" aria-label={L("画布视图","View")}>
              <button type="button" aria-label={L("框选 (V)","Box select (V)")} title={L("框选 (V)","Box select (V)")} className={selectMode ? "is-on" : ""} onClick={() => setSelectMode(true)} aria-pressed={selectMode}><MousePointer2 size={16}/></button>
              <button type="button" aria-label={L("平移 (H)","Pan (H)")} title={L("平移 (H)","Pan (H)")} className={selectMode ? "" : "is-on"} onClick={() => setSelectMode(false)} aria-pressed={!selectMode}><Hand size={16}/></button>
            </div>
            <button className="nc-help-button nc-round" type="button" aria-label={L("快捷键","Keyboard shortcuts")} title={L("快捷键","Keyboard shortcuts")} onClick={() => setShortcutsOpen(true)}><Keyboard size={16}/></button>
            <CanvasDock zh={zh} open={panel} onPanel={setPanel} snap={viewOptions.snap} onSnap={() => setViewOptions(v => ({ ...v, snap: !v.snap }))}
              onCreate={kind => createKind(kind, viewCenter())} onUpload={() => fileInput.current?.click()} onTemplates={() => setTemplatesOpen(true)} />
            <button className="nc-graph-count" type="button" title={L("节点定位","Find a node")} aria-label={L(`定位节点，${nodes.length} 个节点，${edges.length} 条连线`,`Find nodes, ${nodes.length} nodes, ${edges.length} links`)}
              onClick={() => setPanel(panel === "locate" ? null : "locate")}><LayoutGrid size={13}/>{nodes.length}<Link2 size={13}/>{edges.length}</button>
            {hydrated && !nodes.length && <div className="nc-empty-state">
              <button className="nc-empty-start" type="button" aria-label={L("添加第一个节点","Add first node")} onClick={() => setPanel("add")}><Plus size={30} strokeWidth={1.4}/></button>
              <strong className="nc-empty-desktop">{L("双击画布开始创作","Double-click to start creating")}</strong>
              <strong className="nc-empty-touch">{L("轻点加号开始创作","Tap + to start creating")}</strong>
              <span>{L("或从下方添加元素","Or add an element below")}</span>
            </div>}

            {legacyCount ? (
              <div className="nc-banner" aria-live="polite">
                <span>{L(`发现旧版画布里的 ${legacyCount} 个节点（只存在这台设备的浏览器里）`, `Found ${legacyCount} nodes from the old canvas in this browser`)}</span>
                <button type="button" onClick={importLegacy}>{L("导入到当前画布", "Import here")}</button>
                <button type="button" className="nc-banner-close" onClick={() => { localStorage.setItem(LEGACY_DONE_KEY, "1"); setLegacyCount(0); }} aria-label={L("不再提示", "Dismiss")}><X className="h-4 w-4" /></button>
              </div>
            ) : null}

            {selected.length > 1 || onlyGroup ? (
              <NodeToolbar nodeId={selected.map((node) => node.id)} isVisible position={Position.Top} offset={24} className="nc-selection nc-floating-selection" role="toolbar" aria-label={L("多选操作", "Selection")}>
                {onlyGroup ? <details className="nc-selection-dropdown">
                  <summary>{L("颜色", "Color")}<ChevronDown size={12} /></summary>
                  <fieldset aria-label={L("分组颜色", "Group color")}>
                    {(["neutral", "accent", "warm", "cool"] as const).map((tone, index) => (
                      <button type="button" key={tone} className={`nc-swatch nc-group-${tone}`}
                        aria-label={L(["灰色", "主题色", "暖色", "冷色"][index], tone)}
                        onClick={() => { patch(onlyGroup.id, { tone }); commit(); }} />
                    ))}
                  </fieldset>
                </details> : <>
                  <span className="nc-selection-count">{L(`${selected.length} 个节点`, `${selected.length} nodes`)}</span>
                  <button type="button" onClick={groupSelected}><Layers size={15} />{L("打组", "Group")}</button>
                </>}
                <details className="nc-selection-dropdown">
                  <summary><Grid3x3 size={14} />{L("整理布局", "Arrange")}<ChevronDown size={12} /></summary>
                  <fieldset aria-label={L("整理布局", "Arrange")}>
                    <button type="button" onClick={() => align("row")}><AlignHorizontalJustifyStart size={15} />{L("横向排列", "Row")}</button>
                    <button type="button" onClick={() => align("column")}><AlignVerticalJustifyStart size={15} />{L("纵向排列", "Column")}</button>
                    <button type="button" onClick={() => align("grid")}><Grid3x3 size={15} />{L("宫格排列", "Grid")}</button>
                    {selectedImages > 0 && <>
                      <button type="button" onClick={() => wireSelectedInto("video")}><Film size={15} />{L("用这些图生成视频", "Video from these")}</button>
                      <button type="button" onClick={() => wireSelectedInto("image")}><ImageIcon size={15} />{L("融合成新图", "Blend into image")}</button>
                    </>}
                  </fieldset>
                </details>
                {onlyGroup && <button type="button" disabled={!groupPlan.length || Boolean(groupProgress)} onClick={() => void startGroup(onlyGroup.id)}
                  title={L("按连线顺序执行未完成的生成和 Agent 节点。每项按提交时的提示词和参考素材计费。", "Run unfinished generators and agents in connection order. Each step is priced with its current prompt and references.")}>
                  <Play size={14} />{L("整组执行", "Run group")} · {L(`约 ${groupCost} 积分`, `≈ ${groupCost} credits`)}
                </button>}
                {onlyGroup && <button type="button" onClick={() => ungroup(onlyGroup.id)}><Layers size={15} />{L("解组", "Ungroup")}</button>}
                <button type="button" onClick={() => saveTemplate(onlyGroup?.data.title || title)} title={L("存为模板", "Save as template")} aria-label={L("存为模板", "Save as template")}><Bookmark size={15} /></button>
                <button type="button" disabled={downloading} onClick={() => void downloadSelection()} title={L("打包下载素材", "Download assets as ZIP")} aria-label={L("打包下载素材", "Download assets as ZIP")}><Download className="h-4 w-4" /></button>
                <button type="button" className="nc-danger" onClick={deleteSelected}><Trash2 className="h-4 w-4" /><span className="sr-only">{L("删除选中节点", "Delete selected nodes")}</span></button>
              </NodeToolbar>
            ) : null}

            {menu?.panel ? <GraphContextMenu
              style={toLocal(menu, 210, menu.panel === "node" ? 330 : 240)}
              zh={zh} node={menu.id ? nodeById(menu.id)?.data : undefined} count={selected.length}
              canUndo={canUndo} canRedo={canRedo} canPaste={Boolean(clipboard.current)}
              onAction={(action) => {
                if (action === "add") { setMenu({ ...menu, palette: !menu.palette }); return; }
                setMenu(null);
                if (action === "asset") setPickerOpen(true);
                if (action === "paste") pasteSelection(menu.flow);
                if (action === "undo") restore(-1);
                if (action === "redo") restore(1);
                if (action === "refresh") void resolveAll();
                if (action === "copy") copySelection();
                if (action === "duplicate") duplicateSelected();
                if (action === "group") groupSelected();
                if (action === "ungroup" && menu.id) ungroup(menu.id);
                if (action === "delete") deleteSelected();
                if (action === "save") saveTemplate((menu.id && nodeById(menu.id)?.data.title) || title);
                if ((action === "title" || action === "annotation") && menu.id) editField({ id: menu.id, field: action });
              }}
            /> : null}
            {menu && (!menu.panel || menu.palette) ? (
              <div className="nc-menu nc-palette" style={palettePosition(menu)} role="menu">
                <span className="nc-menu-title">{menu.from ? L("连接到新节点", "Connect to a new node") : L("添加节点", "Add node")}</span>
                {menuKinds.map((kind) => {
                  const Icon = kindIcon(kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        createKind(kind, { x: menu.flow.x - (menu.from?.side === "target" ? 280 : 0), y: menu.flow.y - 140 }, menu.from);
                        setMenu(null);
                      }}
                    >
                      <Icon className="h-4 w-4" />{KIND_LABEL[kind][zh ? "zh" : "en"]}
                    </button>
                  );
                })}
                {!menu.from ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => { setMenu(null); fileInput.current?.click(); }}><Upload className="h-4 w-4" />{L("上传素材", "Upload")}</button>
                    <button type="button" role="menuitem" onClick={() => { setMenu(null); setPickerOpen(true); }}><ImageIcon className="h-4 w-4" />{L("从素材库添加", "From library")}</button>
                  </>
                ) : null}
              </div>
            ) : null}

            {edgeMenu ? (
              <button type="button" className="nc-edge-cut" style={toLocal(edgeMenu, 0, 0)} onClick={() => disconnect(edgeMenu.id)}>
                <Unlink className="h-4 w-4" />{L("断开", "Disconnect")}
              </button>
            ) : null}
          </div>
        </div>

        {toast ? (
          <div className={`nc-toast${toast.error ? " is-error" : ""}`} role={toast.error ? "alert" : "status"}>
            <span>{toast.text}</span>
            {shortfall.action(toast.text)}
            <button type="button" onClick={() => setToast(null)} aria-label={L("关闭", "Close")}><X className="h-4 w-4" /></button>
          </div>
        ) : null}

        <HomeMediaPicker
          lang={locale}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={addPicked}
          maxSelected={8}
          selectedIds={[]}
          userId={userId ?? undefined}
          acceptedTypes={["image", "video"]}
        />
        {(panel === "history" || panel === "assets" || panel === "sounds") && <CanvasResources key={panel} section={panel} zh={zh} nodes={nodes} canvasFetch={canvasFetch}
          onClose={() => setPanel(null)} onLibrary={() => { setPanel(null); setPickerOpen(true); }} onTemplates={() => { setPanel(null); setTemplatesOpen(true); }}
          onFocus={node => { setPanel(null); focusNode(node); }}
          onSound={id => {
            const sound = getCanvasSound(id);
            if (!sound) return;
            addNodes([makeNode({ kind:"media", media:"audio", title:sound.name[zh ? "zh" : "en"], mime:"audio/wav", soundId:sound.id, url:sound.url }, viewCenter())]);
            setPanel(null);
          }} />}
        {panel === "locate" ? (
          <NodeSearch
            zh={zh}
            nodes={nodes}
            onClose={() => setPanel(null)}
            onPick={(node) => { setPanel(null); focusNode(node); }}
          />
        ) : null}
        {shortcutsOpen ? <ShortcutsDialog zh={zh} onClose={() => setShortcutsOpen(false)} /> : null}
        {templatesOpen ? (
          <TemplatesDialog
            zh={zh}
            builtin={BUILTIN_TEMPLATES(zh)}
            saved={userTemplates}
            onInsert={insertTemplate}
            onInsertSaved={(item) => insertUserTemplate(item.graph)}
            onDeleteSaved={(id) => {
              const next = userTemplates.filter((item) => item.id !== id);
              setUserTemplates(next);
              try { localStorage.setItem(templatesKey, JSON.stringify(next)); } catch { /* ignore */ }
            }}
            onClose={() => setTemplatesOpen(false)}
          />
        ) : null}
        {shotsSource && outputUrl(shotsSource.data) ? (
          <ShotsDialog
            zh={zh}
            imageUrl={outputUrl(shotsSource.data)!}
            models={IMAGE_MODELS.filter((model) => (model.options.maxImages ?? 0) > 0)}
            onClose={() => setShotsFor(null)}
            onSubmit={runShots}
          />
        ) : null}
        {comparing ? <CompareOverlay zh={zh} before={comparing.before} after={comparing.after} onClose={() => setComparing(null)} /> : null}
        {editing && editImage?.url ? (
          <CanvasEditModal
            locale={locale}
            node={editImage}
            action={editing.action}
            submitting={editSubmitting}
            onClose={() => {
              editSession.current += 1;
              setEditing(null);
            }}
            onSubmit={(payload) => void submitEdit(payload)}
            onLocalCutout={localCutout}
          />
        ) : null}
      </div>
    </CanvasActionsContext.Provider>
  );
}

export function NodeCanvas({ locale, initialPrompt = "" }: { locale: string; initialPrompt?: string }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <div className="nc-shell" aria-busy="true" />;
  const userId = session?.user?.id ?? null;
  return (
    <ReactFlowProvider key={userId ? `account:${userId}` : "guest"}>
      <NodeCanvasInner locale={locale} initialPrompt={initialPrompt} userId={userId} />
    </ReactFlowProvider>
  );
}
