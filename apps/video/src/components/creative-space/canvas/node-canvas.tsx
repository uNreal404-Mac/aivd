"use client";

// The node canvas at /creative-space/canvas. Interaction design after
// Toonflow's canvas (MIT, see THIRD_PARTY_NOTICES.md); implementation, data,
// generation and billing are our own (see lib/creative-space/canvas-graph.ts).

import {
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyStart,
  ArrowLeft,
  Bookmark,
  Bot,
  Coins,
  Copy,
  Film,
  FolderOpen,
  Grid3x3,
  Hand,
  Image as ImageIcon,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  Map as MapIcon,
  MousePointer2,
  Music,
  Plus,
  Redo2,
  Search,
  Trash2,
  Type,
  Undo2,
  Unlink,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type NodeChange,
  type OnConnectStartParams,
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
  arrangeBoxes,
  type CanvasData,
  type CanvasKind,
  checkConnection,
  directInputs,
  fromLegacyLocalCanvas,
  fromStoredGraph,
  type GenerateData,
  type GraphEdge,
  type GraphNode,
  hasOutput,
  kindsAccepting,
  LEGACY_CANVAS_KEY,
  type MediaData,
  outputType,
  parentsFirst,
  type PortType,
  structureKey,
  submitKey,
  textOf,
  toStoredGraph,
} from "@/lib/creative-space/canvas-graph";
import { jobStatus, postGeneration, resolveMedia } from "@/lib/creative-space/canvas-submit";
import { previewFrame, uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { listGuestAssets, type PickerAsset, readyPickerImage, saveGuestAsset } from "@/lib/home-media-library";
import { UploadError, uploadErrorText } from "@/lib/image-to-video";
import { localizedHref } from "@/lib/locale-path";
import { errorMessage } from "@/lib/media-studio";
import { CanvasEditModal, type CanvasEditAction, type CanvasEditSubmit } from "../canvas-inpaint-modal";
import { CanvasActionsContext, type CanvasActions, KIND_LABEL, kindIcon, NODE_TYPES } from "./canvas-nodes";
import { CompareOverlay, NodeSearch, ShortcutsDialog, ShotsDialog, TemplatesDialog, type CanvasTemplate } from "./canvas-overlays";
import { buildRequest, choicesFor, defaultsFor, IMAGE_MODELS, quote, withModel } from "./model-options";
import "./node-canvas.css";

type FlowNode = Node<CanvasData>;
type CanvasSummary = { id: string; name: string; updatedAt: string | number };
type SaveState = "idle" | "local" | "dirty" | "saving" | "saved" | "error";
type Menu = { x: number; y: number; flow: { x: number; y: number }; from?: { id: string; type: PortType } };
type Toast = { text: string; error?: boolean };

const DRAFT_KEY = "aivd:node-canvas:draft";
const LEGACY_DONE_KEY = "aivd:node-canvas:legacy-imported";
const TEMPLATES_KEY = "aivd:node-canvas-templates:v1";
const HANDOFF_KEY = "aivd:canvas-handoff";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const HISTORY_LIMIT = 100;
const POLL_MS = 4000;
const GEN_KINDS = new Set(["image", "video", "audio"]);

const isGen = (data: CanvasData): data is GenerateData => GEN_KINDS.has(data.kind);
const newId = () => crypto.randomUUID();

function nodeSize(kind: CanvasKind): { width: number; height: number } | undefined {
  if (kind === "text") return { width: 260, height: 180 };
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

/** JPEG sample ≤1024px for the Agent's visual input. */
async function visualSample(blob: Blob, label: string): Promise<File> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!out) throw new Error("sample");
  return new File([out], `${label}__sample.jpg`, { type: "image/jpeg" });
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
          { key: "brief", data: t(zh ? "卖点" : "Selling points", zh ? "高端蓝牙耳机，哑光黑，白色无缝背景，柔光棚拍" : "Premium earbuds, matte black, seamless white studio, soft light"), x: 0, y: 0 },
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
          { key: "who", data: t(zh ? "角色设定" : "Character", zh ? "短发女孩，黄色雨衣，正面全身，干净背景" : "Short-haired girl, yellow raincoat, full body, plain background"), x: 0, y: 0 },
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

function NodeCanvasInner({ locale, initialPrompt }: { locale: string; initialPrompt: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const L = useCallback((cn: string, en: string) => (zh ? cn : en), [zh]);
  const flow = useReactFlow<CanvasData>();
  const { data: session, isPending: sessionPending } = useSession();
  const userId = session?.user?.id ?? null;
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
  const [listOpen, setListOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<{ id: string; name: string; graph: ReturnType<typeof toStoredGraph> }[]>([]);
  const [editing, setEditing] = useState<{ id: string; action: CanvasEditAction } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [shotsFor, setShotsFor] = useState<string | null>(null);
  const [comparing, setComparing] = useState<{ before: string; after: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [showEdges, setShowEdges] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [snap, setSnap] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const connectFrom = useRef<{ id: string; type: PortType } | null>(null);
  const menuOpenedAt = useRef(0);
  const flowBox = useRef<HTMLDivElement>(null);
  const runLocks = useRef(new Set<string>());
  const clipboard = useRef<{ nodes: FlowNode[]; edges: Edge[] } | null>(null);
  const lastSaved = useRef("");
  const saving = useRef<Promise<string | null> | null>(null);
  const saveAgain = useRef(false);
  const unknownRequest = L(
    "页面关闭时请求还没有回音，不确定是否已提交。再点生成会沿用同一个请求，不会重复扣积分。",
    "The page closed before the request was answered. Generating again reuses the same request and cannot charge twice.",
  );
  const currentPath = localizedHref(locale, "/creative-space/canvas");

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
      setNodes((list) => {
        const next = list.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...partial } as CanvasData } : node));
        nodesRef.current = next;
        return next;
      });
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
          return current ? { ...node, data: current.data, selected: false } : { ...node, selected: false };
        }),
        target.edges,
      );
      setHistoryTick((tick) => tick + 1);
    },
    [replaceGraph],
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
    (kind: CanvasKind, position: { x: number; y: number }, from?: { id: string; type: PortType }, prompt = "") => {
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
      const wires = from && checkConnection(from.id, node.id, [...nodesRef.current, node] as GraphNode[], edgesRef.current).ok ? [wire(from.id, node.id)] : [];
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
      const response = await fetch("/api/v1/creative-space/workflows", { cache: "no-store" });
      const body = await response.json();
      if (body?.success) setCanvases(body.data.workflows);
    } catch {
      /* the list is optional */
    }
  }, [userId]);

  const refreshBalance = useCallback(async (): Promise<number | null> => {
    if (!userId) return null;
    try {
      const response = await fetch("/api/v1/credit/balance", { cache: "no-store" });
      const body = await response.json();
      const value = typeof body?.data?.availableCredits === "number" ? body.data.availableCredits : null;
      setBalance(value);
      return value;
    } catch {
      return null;
    }
  }, [userId]);

  /** Uploads files that so far live only in this browser, so the canvas can be saved. */
  const uploadLocalAssets = useCallback(async () => {
    const pending = nodesRef.current.filter((node) => node.data.kind === "media" && node.data.localId && !node.data.assetKey);
    if (!pending.length) return;
    const guests = await listGuestAssets().catch(() => [] as PickerAsset[]);
    for (const node of pending) {
      const data = node.data as MediaData;
      const asset = guests.find((item) => item.id === data.localId);
      if (!asset?.file) continue;
      try {
        const result = asset.file.type.startsWith("video/")
          ? await uploadWorkflowVideo(asset.file)
          : await readyPickerImage({ id: asset.id, name: asset.name, mimeType: asset.mimeType, url: asset.url, file: asset.file });
        patch(node.id, { assetKey: result.key, url: result.url, localId: undefined } as Partial<MediaData>);
      } catch (error) {
        say(error instanceof UploadError ? uploadErrorText(error, zh) : error instanceof Error ? error.message : L("素材上传失败", "Upload failed"), true);
      }
    }
  }, [L, patch, say, zh]);

  const saveRemote = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    if (saving.current) {
      saveAgain.current = true;
      return saving.current;
    }
    const task = (async () => {
      setSaveState("saving");
      try {
        await uploadLocalAssets();
        const graph = storedNow();
        const name = titleRef.current.trim() || L("未命名画布", "Untitled canvas");
        const id = canvasIdRef.current;
        const response = await fetch(id ? `/api/v1/creative-space/workflows/${encodeURIComponent(id)}` : "/api/v1/creative-space/workflows", {
          method: id ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, graph }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? L("保存失败", "Could not save"));
        const savedId = id ?? body.data.id;
        lastSaved.current = contentKey(graph, name);
        if (!id) {
          canvasIdRef.current = savedId;
          setCanvasId(savedId);
          window.history.replaceState(null, "", `${currentPath}?id=${encodeURIComponent(savedId)}`);
          try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
          void syncList();
        }
        setSaveState("saved");
        return savedId as string;
      } catch (error) {
        setSaveState("error");
        say(error instanceof Error ? error.message : L("保存失败", "Could not save"), true);
        return null;
      }
    })();
    saving.current = task;
    try {
      return await task;
    } finally {
      saving.current = null;
      if (saveAgain.current) {
        saveAgain.current = false;
        void saveRemote();
      }
    }
  }, [L, currentPath, say, storedNow, syncList, uploadLocalAssets, userId]);

  const saveLocalDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: titleRef.current, graph: storedNow() }));
    } catch {
      /* storage full */
    }
  }, [storedNow]);

  /** Resolves display URLs for everything that has a stable reference. */
  const resolveAll = useCallback(async () => {
    const list = nodesRef.current;
    const guests = list.some((node) => node.data.kind === "media" && node.data.localId) ? await listGuestAssets().catch(() => [] as PickerAsset[]) : [];
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
    const resolved = await resolveMedia(uuids, keys);
    for (const node of nodesRef.current) {
      const data = node.data;
      if (data.kind === "media") {
        const url = data.assetKey ? resolved.assets[data.assetKey] : data.resultUuid ? resolved.results[data.resultUuid]?.urls[data.resultIndex ?? 0] : undefined;
        if (url) patch(node.id, { url } as Partial<MediaData>);
      } else if (isGen(data) && data.status === "done" && data.resultUuid) {
        const result = resolved.results[data.resultUuid];
        if (result?.urls.length) patch(node.id, { urls: result.urls } as Partial<GenerateData>);
      }
    }
  }, [patch, userId]);

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
      lastSaved.current = contentKey(toStoredGraph(nodesRef.current as GraphNode[], edgesRef.current), name);
      requestAnimationFrame(() => {
        if (restored.viewport) flow.setViewport(restored.viewport);
        else if (restored.nodes.length) flow.fitView({ padding: 0.2, maxZoom: 1 });
      });
      resetHistory();
    },
    [flow, replaceGraph, resetHistory, unknownRequest],
  );

  const openCanvas = useCallback(
    async (id: string) => {
      setListOpen(false);
      try {
        if (canvasIdRef.current && contentKey(storedNow(), titleRef.current) !== lastSaved.current) await saveRemote();
        const response = await fetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? L("打不开这个画布", "Could not open this canvas"));
        loadGraph(body.data.workflow.graph, body.data.workflow.name, id);
        window.history.replaceState(null, "", `${currentPath}?id=${encodeURIComponent(id)}`);
        setSaveState("saved");
        void resolveAll();
      } catch (error) {
        say(error instanceof Error ? error.message : L("打不开这个画布", "Could not open this canvas"), true);
      }
    },
    [L, currentPath, loadGraph, resolveAll, saveRemote, say, storedNow],
  );

  const newCanvas = useCallback(async () => {
    setListOpen(false);
    if (canvasIdRef.current && contentKey(storedNow(), titleRef.current) !== lastSaved.current) await saveRemote();
    loadGraph({ version: 2, nodes: [], edges: [] }, L("未命名画布", "Untitled canvas"), null);
    window.history.replaceState(null, "", currentPath);
    setSaveState(userId ? "idle" : "local");
  }, [L, currentPath, loadGraph, saveRemote, storedNow, userId]);

  const deleteCanvas = useCallback(async () => {
    const id = canvasIdRef.current;
    if (!id) return;
    if (!window.confirm(L("删除这个画布？画布里的生成结果仍保留在「我的作品」。", "Delete this canvas? Its results stay in My creations."))) return;
    try {
      const response = await fetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      canvasIdRef.current = null;
      setCanvasId(null);
      await syncList();
      await newCanvas();
      say(L("画布已删除", "Canvas deleted"));
    } catch {
      say(L("删除失败，请重试", "Could not delete"), true);
    }
  }, [L, newCanvas, say, syncList]);

  // First load: saved canvas (?id), else this browser's draft; then studio
  // hand-off and ?prompt=.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current || sessionPending) return;
    booted.current = true;
    void (async () => {
      const id = new URLSearchParams(window.location.search).get("id");
      let loaded = false;
      if (id && userId) {
        try {
          const response = await fetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { cache: "no-store" });
          const body = await response.json();
          if (body?.success) {
            loadGraph(body.data.workflow.graph, body.data.workflow.name, id);
            setSaveState("saved");
            loaded = true;
          }
        } catch {
          /* fall back to the draft */
        }
      }
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
          sessionStorage.removeItem(HANDOFF_KEY);
          const item = JSON.parse(handoff) as { url?: string; prompt?: string; model?: string; kind?: string; uuid?: string; index?: number };
          const media = item.kind === "video" || item.kind === "audio" ? item.kind : "image";
          if (item.url || item.uuid) {
            const node = makeNode(
              {
                kind: "media",
                media,
                title: item.model || L("工作室作品", "Studio result"),
                mime: `${media}/*`,
                ...(item.uuid ? { resultUuid: item.uuid, resultIndex: item.index ?? 0 } : {}),
                ...(item.url ? { url: item.url } : {}),
              },
              viewCenter(),
            );
            addNodes([node]);
            if (!item.uuid) say(L("这个作品没有带编号，保存后可能无法再次显示", "This result has no id and may not show after saving"), true);
          }
        }
      } catch {
        /* ignore a broken hand-off */
      }
      if (initialPrompt.trim()) createKind("agent", viewCenter(), undefined, initialPrompt.trim());
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_CANVAS_KEY) || "null") as { nodes?: unknown[] } | null;
        if (!localStorage.getItem(LEGACY_DONE_KEY) && Array.isArray(legacy?.nodes) && legacy.nodes.length) setLegacyCount(legacy.nodes.length);
        const saved = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]");
        if (Array.isArray(saved)) setUserTemplates(saved);
      } catch {
        /* ignore */
      }
      setHydrated(true);
      void resolveAll();
    })();
  }, [L, addNodes, createKind, currentPath, initialPrompt, loadGraph, makeNode, resetHistory, resolveAll, say, sessionPending, userId, viewCenter]);

  useEffect(() => {
    if (!userId) return;
    void syncList();
    void refreshBalance();
  }, [refreshBalance, syncList, userId]);

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
      if (!id) return;
      const graph = storedNow();
      const name = titleRef.current.trim() || "Untitled";
      if (contentKey(graph, name) === lastSaved.current) return;
      const body = JSON.stringify({ name, graph });
      if (body.length > 60_000) return;
      void fetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { method: "PUT", keepalive: true, headers: { "content-type": "application/json" }, body });
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [saveLocalDraft, storedNow, userId]);

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
        const result = await jobStatus(data.resultUuid);
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
  }, [L, patch, refreshBalance, runningKey, userId]);

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
    const texts = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current).map((node) => textOf(node.data)).filter(Boolean);
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
        const resolved = await resolveMedia(uuids, []);
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
    [L, uploadLocalAssets],
  );

  const runGenerate = useCallback(
    async (id: string) => {
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node || !isGen(node.data)) return;
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
        if (!canvasIdRef.current) await saveRemote();
        const images = data.kind === "audio" ? { stable: [], values: [] } : await prepareImages(id, choices.maxImages);
        if (data.maskKey) {
          images.stable.push(data.maskKey);
          images.values.push(data.maskKey);
        }
        const request = buildRequest(data, prompt, images.values);
        const signature = JSON.stringify({ endpoint: request.endpoint, body: buildRequest(data, prompt, images.stable).body });
        const credits = quote(data, prompt, images.values.length);
        const available = await refreshBalance();
        if (available !== null && available < credits) {
          const message = errorMessage("INSUFFICIENT_CREDITS", "", zh);
          fail(`${message}（${L("需要", "needs")} ${credits}，${L("剩余", "left")} ${available}）`);
          shortfall.report(message, credits);
          say(message, true);
          return;
        }
        const current = nodesRef.current.find((item) => item.id === id)?.data as GenerateData | undefined;
        const key = submitKey(current?.pending, signature, Date.now(), newId);
        patch(id, { pending: { key, signature, at: Date.now() } } as Partial<GenerateData>);
        // The key is saved before sending, so a reload mid-request retries it.
        if (canvasIdRef.current) await saveRemote();
        else saveLocalDraft();
        const answer = await postGeneration(request.endpoint, request.body, key);
        if (answer.kind === "ok") {
          patch(id, { status: "running", resultUuid: answer.uuid, resultIndex: 0, urls: undefined, pending: undefined, error: null } as Partial<GenerateData>);
          void saveRemote();
          void refreshBalance();
          return;
        }
        if (answer.kind === "unauthorized") {
          patch(id, { ...(previous ?? { status: "idle" as const }), pending: undefined } as Partial<GenerateData>);
          requireLogin();
          return;
        }
        if (answer.kind === "lost") {
          fail(L("网络中断，不确定是否已提交。再点一次生成会沿用同一个请求，不会重复扣积分。", "The connection dropped. Generating again reuses this request and cannot charge twice."));
          return;
        }
        const message = errorMessage(answer.code, answer.message, zh);
        fail(message, { pending: undefined });
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
    [L, inputsOf, mergedPrompt, patch, prepareImages, refreshBalance, requireLogin, saveLocalDraft, saveRemote, say, shortfall, zh],
  );

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
        const assets = directInputs(id, nodesRef.current as GraphNode[], edgesRef.current)
          .filter((item) => (outputType(item.data) === "image" || outputType(item.data) === "video") && hasOutput(item.data))
          .slice(0, 8);
        const form = new FormData();
        form.set("action", "plan");
        form.set("instruction", instruction);
        form.set("locale", locale);
        const guests = assets.some((item) => item.data.kind === "media" && item.data.localId) ? await listGuestAssets().catch(() => [] as PickerAsset[]) : [];
        const described: { id: string; label: string; name: string; type: "image" | "video" }[] = [];
        for (const [index, item] of assets.entries()) {
          const label = String.fromCharCode(65 + index);
          const type = outputType(item.data) === "video" ? "video" : "image";
          let blob: Blob | null = null;
          const local = item.data.kind === "media" && item.data.localId ? guests.find((asset) => asset.id === (item.data as MediaData).localId)?.file : undefined;
          if (local) blob = local;
          else {
            const source = sameOriginUrl(item.data);
            if (source) {
              const response = await fetch(source);
              if (response.ok) blob = await response.blob();
            }
          }
          if (!blob) continue;
          const still = type === "video" ? await previewFrame(new File([blob], `${label}.mp4`, { type: blob.type || "video/mp4" })) : blob;
          form.append("visual", await visualSample(still, label));
          described.push({ id: item.id, label, name: (item.data.title || label).slice(0, 300), type });
        }
        form.set("assets", JSON.stringify(described));
        const response = await fetch("/api/v1/creative-space/agent", { method: "POST", body: form });
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
    [L, locale, mergedPrompt, patch, requireLogin],
  );

  const run = useCallback(
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

  /* ------------------------------------------------------------- assets */

  const addFiles = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
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
      addNodes(created.map((item) => item.node));
      for (const { file, node } of created) {
        try {
          if (userId) {
            const result = file.type.startsWith("video/")
              ? await uploadWorkflowVideo(file)
              : await readyPickerImage({ id: node.id, name: file.name, mimeType: file.type, url: "", file });
            patch(node.id, { assetKey: result.key, url: result.url, busy: false } as Partial<MediaData>);
          } else {
            const asset = await saveGuestAsset(file);
            patch(node.id, { localId: asset.id, url: asset.url, busy: false } as Partial<MediaData>);
          }
        } catch (error) {
          replaceGraph(nodesRef.current.filter((item) => item.id !== node.id), edgesRef.current.filter((edge) => edge.source !== node.id && edge.target !== node.id));
          say(error instanceof UploadError ? uploadErrorText(error, zh) : error instanceof Error ? error.message : L("上传失败", "Upload failed"), true);
        }
      }
    },
    [L, addNodes, makeNode, patch, replaceGraph, say, userId, viewCenter, zh],
  );

  const addPicked = useCallback(
    (assets: PickerAsset[]) => {
      const origin = viewCenter();
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
      addNodes(added);
      setPickerOpen(false);
    },
    [addNodes, makeNode, viewCenter],
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
      if (!editing || !requireLogin()) return;
      const source = nodeById(editing.id);
      if (!source) return;
      setEditSubmitting(true);
      try {
        let maskKey: string | undefined;
        if (payload.action !== "animate" && payload.compositeFile) {
          const uploaded = await readyPickerImage({ id: newId(), name: "mask.png", mimeType: payload.compositeFile.type, url: "", file: payload.compositeFile });
          maskKey = uploaded.key;
        }
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
      }
    },
    [L, addNodes, editing, makeNode, requireLogin, run, say, zh],
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
          blob = (await listGuestAssets()).find((asset) => asset.id === (node.data as MediaData).localId)?.file ?? null;
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
    [L, addFiles, say],
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

  const absolute = (node: FlowNode) => node.positionAbsolute ?? node.position;

  const groupSelected = useCallback(() => {
    const members = nodesRef.current.filter((node) => node.selected && node.data.kind !== "group");
    if (members.length < 1) return;
    const boxes = members.map((node) => ({ ...absolute(node), w: node.width ?? 280, h: node.height ?? 200 }));
    const minX = Math.min(...boxes.map((box) => box.x)) - 28;
    const minY = Math.min(...boxes.map((box) => box.y)) - 60;
    const maxX = Math.max(...boxes.map((box) => box.x + box.w)) + 28;
    const maxY = Math.max(...boxes.map((box) => box.y + box.h)) + 28;
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
    (source?: { nodes: FlowNode[]; edges: Edge[] }, offset = 48) => {
      const picked = source?.nodes ?? nodesRef.current.filter((node) => node.selected);
      if (!picked.length) return;
      const ids = new Map(picked.map((node) => [node.id, newId()]));
      const copies = picked.map((node) => {
        const parent = node.parentNode && ids.has(node.parentNode) ? ids.get(node.parentNode) : undefined;
        let data = { ...node.data } as CanvasData;
        if (isGen(data)) {
          const { pending: _pending, ...rest } = data;
          data = rest.status === "done" ? rest : { ...rest, status: "idle", resultUuid: undefined, urls: undefined, error: null };
        }
        if (data.kind === "agent" && data.status !== "done") data = { ...data, status: "idle" };
        return {
          ...node,
          id: ids.get(node.id)!,
          data,
          parentNode: parent,
          position: parent ? node.position : { x: absolute(node).x + offset, y: absolute(node).y + offset },
          positionAbsolute: undefined,
          selected: true,
        } as FlowNode;
      });
      const pool = source?.edges ?? edgesRef.current;
      const wires = pool.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => wire(ids.get(edge.source)!, ids.get(edge.target)!));
      addNodes(copies, wires);
    },
    [addNodes],
  );

  const align = useCallback(
    (mode: "row" | "column" | "grid") => {
      const picked = nodesRef.current.filter((node) => node.selected && !node.parentNode);
      if (picked.length < 2) return;
      const sorted = [...picked].sort((a, b) => (mode === "column" ? a.position.y - b.position.y : a.position.x - b.position.x || a.position.y - b.position.y));
      const start = { x: Math.min(...picked.map((node) => node.position.x)), y: Math.min(...picked.map((node) => node.position.y)) };
      const positions = new Map<string, { x: number; y: number }>();
      let x = start.x;
      let y = start.y;
      sorted.forEach((node, index) => {
        if (mode === "grid") {
          const col = index % 3;
          const row = Math.floor(index / 3);
          positions.set(node.id, { x: start.x + col * 360, y: start.y + row * 400 });
        } else {
          positions.set(node.id, { x, y });
          if (mode === "row") x += (node.width ?? 280) + 40;
          else y += (node.height ?? 200) + 40;
        }
      });
      replaceGraph(nodesRef.current.map((node) => (positions.has(node.id) ? { ...node, position: positions.get(node.id)! } : node)), edgesRef.current);
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
      const chosen = nodesRef.current.filter((node) => node.selected);
      const pool = chosen.length ? chosen : nodesRef.current;
      if (!pool.length) return;
      const ids = new Set(pool.map((node) => node.id));
      const graph = toStoredGraph(
        pool.map((node) => {
          const data = node.data;
          // A template keeps settings and prompts, not results.
          if (isGen(data)) return { ...node, data: { ...data, status: "idle", resultUuid: undefined, urls: undefined, pending: undefined, error: null } } as GraphNode;
          if (data.kind === "agent") return { ...node, data: { ...data, status: "idle", reply: undefined, steps: undefined, error: null } } as GraphNode;
          return node as GraphNode;
        }),
        edgesRef.current.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      );
      const next = [{ id: newId(), name: name.slice(0, 40), graph }, ...userTemplates].slice(0, 20);
      setUserTemplates(next);
      try {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
      } catch {
        say(L("浏览器存储已满，模板没保存", "Browser storage is full"), true);
        return;
      }
      say(L("已存为模板", "Saved as a template"));
    },
    [L, say, userTemplates],
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
  }, [L, addNodes, flow, resolveAll, say, viewCenter]);

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

  const onConnectStart = useCallback((_: unknown, params: OnConnectStartParams) => {
    const node = params.nodeId ? nodesRef.current.find((item) => item.id === params.nodeId) : undefined;
    const type = node && params.handleType === "source" ? outputType(node.data) : null;
    connectFrom.current = node && type ? { id: node.id, type } : null;
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
  const onNodeDragStop = useCallback(
    (_: ReactMouseEvent, dragged: FlowNode) => {
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
        setSearchOpen(true);
        return;
      }
      if (typing(event.target)) return;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        restore(event.shiftKey ? 1 : -1);
      } else if (mod && key === "y") {
        event.preventDefault();
        restore(1);
      } else if (mod && key === "c") {
        const picked = nodesRef.current.filter((node) => node.selected);
        if (picked.length) clipboard.current = { nodes: picked, edges: edgesRef.current };
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
      } else if (!mod && key === "e") setShowEdges((value) => !value);
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
        duplicateSelected(clipboard.current);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [addFiles, duplicateSelected, groupSelected, restore, setNodes, ungroup]);

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
      spreadSteps,
      agentToVideo,
      singleSelection: selected.length === 1,
    }),
    [agentToVideo, captureFrame, commit, compareSource, inputsOf, patch, quoteOf, requireLogin, run, selected.length, spreadSteps, zh],
  );

  /** Screen point → position inside the canvas area (menus are placed there, clamped to stay visible). */
  const toLocal = (point: { x: number; y: number }, width = 220, height = 320) => {
    const box = flowBox.current?.getBoundingClientRect();
    if (!box) return { left: point.x, top: point.y };
    return { left: Math.min(Math.max(point.x - box.left, 8), box.width - width), top: Math.min(Math.max(point.y - box.top, 8), box.height - height) };
  };
  const menuKinds: CanvasKind[] = menu?.from ? kindsAccepting(menu.from.type) : ["text", "image", "video", "audio", "agent", "group"];
  const onlyGroup = selected.length === 1 && selected[0].data.kind === "group" ? selected[0] : null;
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
        <header className="nc-top">
          <Link href={localizedHref(locale, "/creative-space")} className="nc-icon-btn" aria-label={L("返回创作空间", "Back to Creative Space")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="nc-title-wrap">
            <input
              value={title}
              maxLength={100}
              onChange={(event) => setTitle(event.target.value)}
              aria-label={L("画布名称", "Canvas name")}
            />
            <span className={`nc-save nc-save-${saveState}`} aria-live="polite">{saveLabel[saveState]}</span>
          </div>
          <div className="nc-top-actions">
            {userId ? (
              <div className="nc-list-wrap">
                <button type="button" className="nc-btn" onClick={() => setListOpen((value) => !value)} aria-expanded={listOpen}>
                  <FolderOpen className="h-4 w-4" /> {L("我的画布", "My canvases")}
                </button>
                {listOpen ? (
                  <div className="nc-list" role="menu">
                    <button type="button" role="menuitem" onClick={() => void newCanvas()}><Plus className="h-4 w-4" />{L("新建画布", "New canvas")}</button>
                    {canvases.map((item) => (
                      <button type="button" role="menuitem" key={item.id} className={item.id === canvasId ? "is-active" : ""} onClick={() => void openCanvas(item.id)}>
                        {item.name}
                      </button>
                    ))}
                    {canvasId ? (
                      <button type="button" role="menuitem" className="nc-danger" onClick={() => void deleteCanvas()}><Trash2 className="h-4 w-4" />{L("删除当前画布", "Delete this canvas")}</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <button type="button" className="nc-btn" onClick={() => requireLogin()}>{L("登录后保存到账号", "Sign in to save")}</button>
            )}
            {balance !== null ? (
              <span className="nc-balance" title={L("可用积分", "Available credits")}><Coins className="h-4 w-4" aria-hidden="true" />{balance}</span>
            ) : null}
            <button type="button" className="nc-icon-btn" onClick={() => restore(-1)} disabled={!canUndo} aria-label={L("撤销 (⌘Z)", "Undo (⌘Z)")} title={L("撤销 (⌘Z)", "Undo (⌘Z)")}><Undo2 className="h-4 w-4" /></button>
            <button type="button" className="nc-icon-btn" onClick={() => restore(1)} disabled={!canRedo} aria-label={L("重做 (⇧⌘Z)", "Redo (⇧⌘Z)")} title={L("重做 (⇧⌘Z)", "Redo (⇧⌘Z)")}><Redo2 className="h-4 w-4" /></button>
            <button type="button" className="nc-icon-btn" onClick={() => setSearchOpen(true)} aria-label={L("搜索节点 (⌘K)", "Search nodes (⌘K)")} title={L("搜索节点 (⌘K)", "Search nodes (⌘K)")}><Search className="h-4 w-4" /></button>
            <button type="button" className="nc-icon-btn" onClick={() => setShortcutsOpen(true)} aria-label={L("快捷键 (?)", "Shortcuts (?)")} title={L("快捷键 (?)", "Shortcuts (?)")}><Keyboard className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="nc-body">
          <nav className="nc-rail" aria-label={L("添加节点", "Add nodes")}>
            {(["text", "image", "video", "audio", "agent"] as CanvasKind[]).map((kind) => {
              const Icon = kindIcon(kind);
              return (
                <button key={kind} type="button" onClick={() => createKind(kind, viewCenter())} title={KIND_LABEL[kind][zh ? "zh" : "en"]}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{KIND_LABEL[kind][zh ? "zh" : "en"]}</span>
                </button>
              );
            })}
            <span className="nc-rail-sep" aria-hidden="true" />
            <button type="button" onClick={() => fileInput.current?.click()} title={L("上传图片或视频", "Upload image or video")}>
              <Upload className="h-4 w-4" aria-hidden="true" /><span>{L("上传", "Upload")}</span>
            </button>
            <button type="button" onClick={() => setPickerOpen(true)} title={L("素材库：我的作品、元素", "Library: my creations, elements")}>
              <ImageIcon className="h-4 w-4" aria-hidden="true" /><span>{L("素材库", "Library")}</span>
            </button>
            <button type="button" onClick={() => setTemplatesOpen(true)} title={L("模板", "Templates")}>
              <Bookmark className="h-4 w-4" aria-hidden="true" /><span>{L("模板", "Templates")}</span>
            </button>
            <span className="nc-rail-sep" aria-hidden="true" />
            <button type="button" onClick={arrange} title={L("自动整理", "Auto-arrange")}>
              <LayoutGrid className="h-4 w-4" aria-hidden="true" /><span>{L("整理", "Arrange")}</span>
            </button>
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
          </nav>

          <div
            ref={flowBox}
            className={`nc-flow${showEdges ? "" : " edges-hidden"}`}
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
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdgesDelete={commit}
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              onNodeDragStop={onNodeDragStop}
              onEdgeClick={(event, edge) => setEdgeMenu({ id: edge.id, x: event.clientX, y: event.clientY })}
              onPaneClick={() => {
                if (Date.now() - menuOpenedAt.current > 300) setMenu(null);
                setEdgeMenu(null);
                setListOpen(false);
              }}
              onMoveStart={() => setEdgeMenu(null)}
              isValidConnection={(connection) => checkConnection(connection.source, connection.target, nodesRef.current as GraphNode[], edgesRef.current).ok}
              deleteKeyCode={["Backspace", "Delete"]}
              multiSelectionKeyCode={["Meta", "Shift", "Control"]}
              selectionOnDrag={selectMode}
              panOnDrag={selectMode ? [1, 2] : true}
              selectionMode={SelectionMode.Partial}
              zoomOnDoubleClick={false}
              snapToGrid={snap}
              snapGrid={[16, 16]}
              minZoom={0.15}
              maxZoom={3}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ type: "default" }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} className="nc-bg" />
              <Controls showInteractive={false} position="bottom-left" />
              {showMinimap ? <MiniMap pannable zoomable position="bottom-right" className="nc-minimap" /> : null}
            </ReactFlow>

            <div className="nc-view-tools" role="toolbar" aria-label={L("画布视图", "View")}>
              <button type="button" className={selectMode ? "" : "is-on"} onClick={() => setSelectMode(false)} title={L("拖动平移 (H)", "Pan (H)")} aria-pressed={!selectMode}><Hand className="h-4 w-4" /></button>
              <button type="button" className={selectMode ? "is-on" : ""} onClick={() => setSelectMode(true)} title={L("框选 (V)", "Box select (V)")} aria-pressed={selectMode}><MousePointer2 className="h-4 w-4" /></button>
              <button type="button" className={showEdges ? "is-on" : ""} onClick={() => setShowEdges((value) => !value)} title={L("显示连线 (E)", "Wires (E)")} aria-pressed={showEdges}><Link2 className="h-4 w-4" /></button>
              <button type="button" className={showMinimap ? "is-on" : ""} onClick={() => setShowMinimap((value) => !value)} title={L("小地图 (M)", "Minimap (M)")} aria-pressed={showMinimap}><MapIcon className="h-4 w-4" /></button>
              <button type="button" className={snap ? "is-on" : ""} onClick={() => setSnap((value) => !value)} title={L("网格吸附", "Snap to grid")} aria-pressed={snap}><Grid3x3 className="h-4 w-4" /></button>
            </div>

            {hydrated && !nodes.length ? (
              <div className="nc-empty-state">
                <strong>{L("从一个节点开始", "Start with a node")}</strong>
                <span>{L("双击空白处添加节点，或从右侧端口拖出一根线到空白处", "Double-click empty space, or drag a wire out of a port into empty space")}</span>
                <div className="nc-empty-actions">
                  <button type="button" onClick={() => createKind("image", viewCenter())}><ImageIcon className="h-4 w-4" />{L("生成图片", "Generate image")}</button>
                  <button type="button" onClick={() => createKind("video", viewCenter())}><Film className="h-4 w-4" />{L("生成视频", "Generate video")}</button>
                  <button type="button" onClick={() => setTemplatesOpen(true)}><Bookmark className="h-4 w-4" />{L("用模板开始", "Use a template")}</button>
                </div>
              </div>
            ) : null}

            {legacyCount ? (
              <div className="nc-banner" aria-live="polite">
                <span>{L(`发现旧版画布里的 ${legacyCount} 个节点（只存在这台设备的浏览器里）`, `Found ${legacyCount} nodes from the old canvas in this browser`)}</span>
                <button type="button" onClick={importLegacy}>{L("导入到当前画布", "Import here")}</button>
                <button type="button" className="nc-banner-close" onClick={() => { localStorage.setItem(LEGACY_DONE_KEY, "1"); setLegacyCount(0); }} aria-label={L("不再提示", "Dismiss")}><X className="h-4 w-4" /></button>
              </div>
            ) : null}

            {selected.length > 1 || onlyGroup ? (
              <div className="nc-selection" role="toolbar" aria-label={L("多选操作", "Selection")}>
                {onlyGroup ? (
                  <>
                    <button type="button" onClick={() => ungroup(onlyGroup.id)}><Layers className="h-4 w-4" />{L("解组", "Ungroup")}</button>
                    {(["neutral", "accent", "warm", "cool"] as const).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        className={`nc-swatch nc-group-${tone}`}
                        aria-label={L("分组颜色", "Group colour")}
                        onClick={() => { patch(onlyGroup.id, { tone }); commit(); }}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <span className="nc-selection-count">{L(`已选 ${selected.length} 个`, `${selected.length} selected`)}</span>
                    <button type="button" onClick={() => duplicateSelected()}><Copy className="h-4 w-4" />{L("创建副本", "Duplicate")}</button>
                    <button type="button" onClick={groupSelected}><Layers className="h-4 w-4" />{L("打组", "Group")}</button>
                    <button type="button" onClick={() => align("row")} title={L("横向排列", "Row")}><AlignHorizontalJustifyStart className="h-4 w-4" /></button>
                    <button type="button" onClick={() => align("column")} title={L("纵向排列", "Column")}><AlignVerticalJustifyStart className="h-4 w-4" /></button>
                    <button type="button" onClick={() => align("grid")} title={L("宫格排列", "Grid")}><Grid3x3 className="h-4 w-4" /></button>
                    {selectedImages ? (
                      <>
                        <button type="button" onClick={() => wireSelectedInto("video")}><Film className="h-4 w-4" />{L("用这些图生成视频", "Video from these")}</button>
                        <button type="button" onClick={() => wireSelectedInto("image")}><ImageIcon className="h-4 w-4" />{L("融合成新图", "Blend into image")}</button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => { const name = window.prompt(L("模板名称", "Template name"), title); if (name) saveTemplate(name); }}><Bookmark className="h-4 w-4" />{L("存为模板", "Save template")}</button>
                  </>
                )}
                <button type="button" className="nc-danger" onClick={deleteSelected}><Trash2 className="h-4 w-4" />{L("删除", "Delete")}</button>
              </div>
            ) : null}

            {menu ? (
              <div className="nc-menu" style={toLocal(menu)} role="menu">
                <span className="nc-menu-title">{menu.from ? L("接一个能用它的节点", "Add a node that takes it") : L("添加节点", "Add node")}</span>
                {menuKinds.map((kind) => {
                  const Icon = kindIcon(kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        createKind(kind, menu.flow, menu.from);
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
        {searchOpen ? (
          <NodeSearch
            zh={zh}
            nodes={nodes}
            onClose={() => setSearchOpen(false)}
            onPick={(node) => {
              setSearchOpen(false);
              setNodes((list) => list.map((item) => ({ ...item, selected: item.id === node.id })));
              const abs = absolute(node);
              flow.setCenter(abs.x + (node.width ?? 280) / 2, abs.y + (node.height ?? 200) / 2, { zoom: 1, duration: 300 });
            }}
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
              try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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
            onClose={() => setEditing(null)}
            onSubmit={(payload) => void submitEdit(payload)}
            onLocalCutout={localCutout}
          />
        ) : null}
      </div>
    </CanvasActionsContext.Provider>
  );
}

export function NodeCanvas({ locale, initialPrompt = "" }: { locale: string; initialPrompt?: string }) {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner locale={locale} initialPrompt={initialPrompt} />
    </ReactFlowProvider>
  );
}
