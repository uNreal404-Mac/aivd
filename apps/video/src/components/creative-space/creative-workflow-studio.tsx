"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import ReactFlow, {
  addEdge, Background, Controls, Handle, MiniMap, Position,
  useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type NodeProps, type Viewport,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, Bot, Coins, Film, Image as ImageIcon, Loader2, Plus, Save, Sparkles, Trash2, Type, UploadCloud, X } from "lucide-react";

import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { useSession } from "@/lib/auth/client";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { listGuestAssets, readyPickerImage, saveGuestAsset, type PickerAsset } from "@/lib/home-media-library";
import { localizedHref } from "@/lib/locale-path";
import { previewFrame, uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { maxVideoReferences } from "@/lib/video-references";
import "./creative-workflow-studio.css";

type Kind = "text" | "asset" | "agent" | "image" | "video";
type Status = "idle" | "running" | "COMPLETED" | "FAILED";
type FlowData = {
  kind: Kind;
  title: string;
  prompt?: string;
  modelId?: string;
  duration?: number;
  aspect?: string;
  resolution?: string;
  audio?: boolean;
  assetKey?: string;
  assetSourceId?: string;
  assetName?: string;
  assetMime?: string;
  assetUrl?: string;
  resultUuid?: string;
  resultIndex?: number;
  resultUrl?: string;
  resultText?: string;
  generationPrompt?: string;
  status?: Status;
};
type FlowNode = Node<FlowData>;
type Graph = { nodes: FlowNode[]; edges: Edge[]; viewport?: Viewport };
type CanvasSummary = { id: string; name: string; updatedAt: string | number };
type FlowInstance = { project: (point: { x: number; y: number }) => { x: number; y: number }; getViewport: () => Viewport; setViewport: (viewport: Viewport) => void };

const IMAGE_MODELS = marketModelsOf("image");
const VIDEO_MODELS = STUDIO_MODELS.filter((model) => model.available);
const DEFAULT_IMAGE = IMAGE_MODELS[0];
const DEFAULT_VIDEO = VIDEO_MODELS.find((model) => model.id === "bytedance/seedance-2-5") ?? VIDEO_MODELS[0];
const ACCEPTED_MEDIA: Array<"image" | "video"> = ["image", "video"];
const nodeLabels = {
  zh: { text: "文字", asset: "素材", agent: "Agent", image: "生成图片", video: "生成视频" },
  en: { text: "Text", asset: "Asset", agent: "Agent", image: "Generate image", video: "Generate video" },
};
const icons = { text: Type, asset: UploadCloud, agent: Bot, image: ImageIcon, video: Film };

function newNode(kind: Kind, position: { x: number; y: number }, lang: "zh" | "en"): FlowNode {
  const id = crypto.randomUUID();
  return {
    id, type: "creativeNode", position,
    data: {
      kind, title: nodeLabels[lang][kind], prompt: "", status: "idle",
      ...(kind === "video" && DEFAULT_VIDEO ? { modelId: DEFAULT_VIDEO.id, duration: DEFAULT_VIDEO.durations[0], aspect: DEFAULT_VIDEO.aspects.find((item) => item !== "Auto") ?? "16:9", resolution: DEFAULT_VIDEO.resolutions[0], audio: false } : {}),
      ...(kind === "image" && DEFAULT_IMAGE ? { modelId: DEFAULT_IMAGE.id, aspect: DEFAULT_IMAGE.options.aspects?.[0] ?? "1:1", resolution: DEFAULT_IMAGE.options.resolutions?.[0] ?? "1K" } : {}),
    },
  };
}

function CreativeNodeCard({ data, selected }: NodeProps<FlowData>) {
  const Icon = icons[data.kind];
  const resultIsVideo = data.kind === "video" || data.assetMime?.startsWith("video/");
  const preview = data.kind === "asset" ? data.assetUrl : data.resultUrl;
  return <div className={`cw-node cw-node-${data.kind}${selected ? " cw-node-selected" : ""}`}>
    {data.kind !== "text" && data.kind !== "asset" ? <Handle type="target" position={Position.Left} /> : null}
    <div className="cw-node-head"><Icon size={17} aria-hidden="true" /><strong>{data.title}</strong><span className={`cw-node-status cw-node-status-${data.status ?? "idle"}`} /></div>
    {preview ? <div className="cw-node-preview">{resultIsVideo ? <video src={preview} muted playsInline controls /> : <img src={preview} alt={data.assetName ?? data.title} />}</div>
      : <p className="cw-node-body">{data.kind === "asset" ? data.assetName ?? "选择素材" : data.resultText ?? data.prompt ?? ""}</p>}
    {data.resultText && preview ? <p className="cw-node-body">{data.resultText.slice(0, 120)}</p> : null}
    <div className="cw-node-foot">{data.kind === "asset" ? data.assetMime?.split("/")[0] : data.modelId ?? (data.kind === "agent" ? "DeepSeek" : "")}</div>
    <Handle type="source" position={Position.Right} />
  </div>;
}
const nodeTypes = { creativeNode: CreativeNodeCard };

function cleanGraph(nodes: FlowNode[], edges: Edge[], viewport?: Viewport): Graph {
  return {
    nodes: nodes.map((node) => {
      const { assetUrl: _assetUrl, resultUrl: _resultUrl, ...data } = node.data;
      return { id: node.id, type: "creativeNode", position: node.position, data };
    }),
    edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({ id, source, target, sourceHandle, targetHandle })),
    viewport,
  };
}

async function responseData(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

export function CreativeWorkflowStudio({ locale, initialPrompt = "" }: { locale: string; initialPrompt?: string }) {
  const lang: "zh" | "en" = locale.startsWith("zh") ? "zh" : "en";
  const zh = lang === "zh";
  const { data: session } = useSession();
  const signIn = useSigninModal();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const flowRef = useRef<FlowInstance | null>(null);
  const assetFilesRef = useRef(new Map<string, File>());
  const savePromiseRef = useRef<Promise<string | null> | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const workflowIdRef = useRef<string | null>(null);
  const [workflows, setWorkflows] = useState<CanvasSummary[]>([]);
  const [name, setName] = useState(zh ? "未命名画布" : "Untitled canvas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyNode, setBusyNode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selectedNode = nodes.find((node) => node.id === selectedId);
  const currentPath = localizedHref(locale, "/creative-space/canvas");

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const patchNode = (id: string, patch: Partial<FlowData>) => {
    const next = nodesRef.current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node);
    nodesRef.current = next;
    setNodes(next);
  };

  const syncList = async () => {
    if (!session?.user?.id) return;
    try { const data = await responseData(await fetch("/api/v1/creative-space/workflows", { cache: "no-store" })); setWorkflows(data.workflows); }
    catch { /* A temporary list failure does not discard the canvas. */ }
  };

  const refreshBalance = async (): Promise<number | null> => {
    if (!session?.user?.id) return null;
    try { const data = await responseData(await fetch("/api/v1/credit/balance", { cache: "no-store" })); setBalance(data.availableCredits); return data.availableCredits; }
    catch { return null; }
  };

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("aivd:creative-workflow-draft") || "null") as { name?: string; graph?: Graph } | null;
      if (draft?.graph?.nodes && !new URLSearchParams(window.location.search).has("id")) {
        setNodes(draft.graph.nodes); nodesRef.current = draft.graph.nodes;
        setEdges(draft.graph.edges ?? []); edgesRef.current = draft.graph.edges ?? [];
        if (draft.name) setName(draft.name);
      } else if (initialPrompt) {
        const node = newNode("text", { x: 120, y: 120 }, lang);
        node.data.prompt = initialPrompt;
        setNodes([node]); nodesRef.current = [node];
      }
    } catch { /* Keep a usable blank canvas if a draft is corrupt. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("aivd:creative-workflow-draft", JSON.stringify({ name, graph: cleanGraph(nodes, edges, flowRef.current?.getViewport()) })); }
    catch { /* Database saving still works if local storage is full. */ }
  }, [ready, name, nodes, edges]);

  useEffect(() => {
    if (!ready) return;
    void listGuestAssets().then((assets) => {
      const byId = new Map(assets.map((asset) => [asset.id, asset]));
      setNodes((current) => {
        const next = current.map((node) => {
          const asset = node.data.assetSourceId ? byId.get(node.data.assetSourceId) : null;
          if (!asset || node.data.assetKey) return node;
          if (asset.file) assetFilesRef.current.set(node.id, asset.file);
          return { ...node, data: { ...node.data, assetUrl: asset.url } };
        });
        nodesRef.current = next; return next;
      });
    }).catch(() => {});
  }, [ready]);

  const loadCanvas = async (id: string) => {
    setError(""); setNotice("");
    try {
      const data = await responseData(await fetch(`/api/v1/creative-space/workflows/${encodeURIComponent(id)}`, { cache: "no-store" }));
      const graph = data.workflow.graph as Graph;
      const restored = graph.nodes.map((node) => ({ ...node, type: "creativeNode", data: { ...node.data, assetUrl: undefined, resultUrl: undefined } }));
      setNodes(restored); nodesRef.current = restored;
      setEdges(graph.edges ?? []); edgesRef.current = graph.edges ?? [];
      setName(data.workflow.name); setWorkflowId(id); workflowIdRef.current = id; setSelectedId(null);
      window.history.replaceState(null, "", `${currentPath}?id=${encodeURIComponent(id)}`);
      if (graph.viewport) requestAnimationFrame(() => flowRef.current?.setViewport(graph.viewport!));
      const library = await responseData(await fetch("/api/v1/library", { cache: "no-store" })).catch(() => ({ assets: [] }));
      const byKey = new Map<string, string>((library.assets as PickerAsset[]).filter((asset) => asset.key).map((asset) => [asset.key!, asset.url]));
      setNodes((current) => { const next = current.map((node) => node.data.assetKey && byKey.has(node.data.assetKey) ? { ...node, data: { ...node.data, assetUrl: byKey.get(node.data.assetKey) } } : node); nodesRef.current = next; return next; });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open canvas."); }
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    void syncList(); void refreshBalance();
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) void loadCanvas(id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !ready) return;
    let live = true;
    const refresh = async () => {
      for (const node of nodesRef.current) {
        if (!node.data.resultUuid || ((node.data.kind === "asset" ? node.data.assetUrl : node.data.resultUrl) && node.data.status !== "running")) continue;
        try {
          const result = await responseData(await fetch(`/api/v1/video/${encodeURIComponent(node.data.resultUuid)}/status`, { cache: "no-store" }));
          if (!live) return;
          if (result.status === "COMPLETED") {
            const url = result.mediaUrls?.[node.data.resultIndex ?? 0] ?? result.videoUrl;
            patchNode(node.id, node.data.kind === "asset" ? { status: "COMPLETED", assetUrl: url } : { status: "COMPLETED", resultUrl: url });
          }
          else if (result.status === "FAILED") patchNode(node.id, { status: "FAILED" });
        } catch { /* A provider may still be processing; retry later. */ }
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 12_000);
    return () => { live = false; clearInterval(timer); };
  }, [ready, session?.user?.id, workflowId]);

  const ensureStoredAssets = async () => {
    const guests = await listGuestAssets().catch(() => [] as PickerAsset[]);
    for (const node of nodesRef.current) {
      if (node.data.kind !== "asset" || node.data.assetKey || node.data.resultUuid) continue;
      const asset = guests.find((item) => item.id === node.data.assetSourceId);
      const file = assetFilesRef.current.get(node.id) ?? asset?.file;
      if (!file) throw new Error(zh ? "有素材已不在本机，请重新添加。" : "An asset is no longer on this device. Add it again.");
      const result = file.type.startsWith("video/") ? await uploadWorkflowVideo(file) : await readyPickerImage({ id: node.id, name: file.name, mimeType: file.type, url: node.data.assetUrl ?? "", file });
      patchNode(node.id, { assetKey: result.key, assetUrl: result.url });
    }
  };

  const saveCanvas = async (): Promise<string | null> => {
    if (!session?.user?.id) { signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`); return null; }
    if (savePromiseRef.current) return savePromiseRef.current;
    const task = (async () => {
      setSaving(true); setError("");
      try {
        await ensureStoredAssets();
        const id = workflowIdRef.current;
        const path = id ? `/api/v1/creative-space/workflows/${encodeURIComponent(id)}` : "/api/v1/creative-space/workflows";
        const data = await responseData(await fetch(path, { method: id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, graph: cleanGraph(nodesRef.current, edgesRef.current, flowRef.current?.getViewport()) }) }));
        const savedId = id ?? data.id;
        if (!id) { setWorkflowId(savedId); workflowIdRef.current = savedId; window.history.replaceState(null, "", `${currentPath}?id=${encodeURIComponent(savedId)}`); }
        setNotice(zh ? "画布已保存" : "Canvas saved"); void syncList();
        return savedId;
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save canvas."); return null; }
      finally { setSaving(false); }
    })();
    savePromiseRef.current = task;
    try { return await task; } finally { savePromiseRef.current = null; }
  };

  useEffect(() => {
    if (!workflowId || !ready || !session?.user?.id) return;
    const timer = setTimeout(() => { void saveCanvas(); }, 1200);
    return () => clearTimeout(timer);
  }, [nodes, edges, name, workflowId, ready, session?.user?.id]);

  const addNode = (kind: Kind, position?: { x: number; y: number }, asset?: PickerAsset) => {
    const nextPosition = position ?? flowRef.current?.project({ x: 280 + Math.random() * 80, y: 140 + Math.random() * 80 }) ?? { x: 160, y: 140 };
    const node = newNode(kind, nextPosition, lang);
    if (asset) {
      node.data.assetName = asset.name; node.data.assetMime = asset.mimeType;
      const work = /^work:([^:]+):(\d+)$/.exec(asset.id);
      if (work) { node.data.resultUuid = work[1]; node.data.resultIndex = Number(work[2]); }
      else node.data.assetKey = asset.key;
      node.data.assetUrl = asset.url; node.data.assetSourceId = asset.id;
      if (asset.file) assetFilesRef.current.set(node.id, asset.file);
      node.data.title = asset.name.slice(0, 45);
    }
    setNodes((current) => { const next = [...current, node]; nodesRef.current = next; return next; });
    setSelectedId(node.id);
  };

  const addAssets = (items: PickerAsset[]) => {
    items.forEach((asset, index) => addNode("asset", { x: 100 + index * 32, y: 130 + index * 32 }, asset));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer.files.length) return;
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!files.length) return;
    void (async () => {
      for (const file of files) {
        try { const asset = await saveGuestAsset(file); addNode("asset", undefined, asset); }
        catch { setError(zh ? "素材读取失败" : "Could not read this asset"); }
      }
    })();
  };

  const upstreamOf = (id: string): FlowNode[] => {
    const result: FlowNode[] = []; const visited = new Set<string>([id]);
    const visit = (target: string) => {
      for (const edge of edgesRef.current.filter((item) => item.target === target)) {
        if (visited.has(edge.source)) continue;
        visited.add(edge.source); visit(edge.source);
        const node = nodesRef.current.find((item) => item.id === edge.source);
        if (node) result.push(node);
      }
    };
    visit(id); return result;
  };

  const readNodeInput = (node: FlowNode) => {
    const upstream = upstreamOf(node.id);
    const text = [...upstream.filter((item) => item.data.kind === "text").map((item) => item.data.prompt),
      ...upstream.filter((item) => item.data.kind === "agent").map((item) => item.data.generationPrompt ?? item.data.resultText), node.data.prompt]
      .filter(Boolean).join("\n").trim();
    const media = upstream.filter((item) => item.data.kind === "asset" || (item.data.kind === "image" && item.data.resultUrl));
    return { text, media };
  };

  const waitForResult = async (id: string, uuid: string) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const data = await responseData(await fetch(`/api/v1/video/${encodeURIComponent(uuid)}/status`, { cache: "no-store" }));
      if (data.status === "COMPLETED") {
        patchNode(id, { status: "COMPLETED", resultUrl: data.mediaUrls?.[0] ?? data.videoUrl });
        void refreshBalance(); return;
      }
      if (data.status === "FAILED") { patchNode(id, { status: "FAILED" }); throw new Error(data.error ?? "Generation failed."); }
    }
    throw new Error(zh ? "生成仍在进行，请稍后返回画布查看。" : "Generation is still running. Return to this canvas later.");
  };

  const runOne = async (id: string): Promise<boolean> => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || !["agent", "image", "video"].includes(node.data.kind)) return false;
    if (!session?.user?.id) { signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`); return false; }
    await ensureStoredAssets();
    const current = nodesRef.current.find((item) => item.id === id)!;
    const { text, media } = readNodeInput(current);
    if (!text) throw new Error(zh ? "先在此节点或连接的文字节点填写提示词。" : "Add a prompt here or connect a text node first.");
    const savedId = await saveCanvas();
    if (!savedId) throw new Error(zh ? "请先保存画布。" : "Save the canvas first.");
    patchNode(id, { status: "running", resultText: "", resultUrl: undefined });
    if (current.data.kind === "agent") {
      const form = new FormData();
      form.set("action", "plan"); form.set("instruction", text); form.set("locale", locale);
      const assets = media.slice(0, 8).map((item, index) => ({ id: item.id, label: String.fromCharCode(65 + index), name: item.data.assetName ?? item.data.title, type: item.data.assetMime?.startsWith("video/") ? "video" : "image" }));
      form.set("assets", JSON.stringify(assets));
      for (const [index, item] of media.slice(0, 8).entries()) {
        const source = item.data.assetKey
          ? `/api/v1/creative-space/asset?key=${encodeURIComponent(item.data.assetKey)}`
          : item.data.resultUuid
            ? `/api/v1/creative-space/asset?uuid=${encodeURIComponent(item.data.resultUuid)}&index=${item.data.resultIndex ?? 0}`
            : item.data.assetUrl ?? item.data.resultUrl;
        if (!source) continue;
        const fetched = assetFilesRef.current.get(item.id) ? null : await fetch(source);
        if (fetched && !fetched.ok) throw new Error(zh ? "无法读取连接的素材。" : "Could not read a connected asset.");
        const file = assetFilesRef.current.get(item.id) ?? new File([await fetched!.blob()], item.data.assetName ?? `asset-${index}`, { type: item.data.assetMime ?? "image/png" });
        const visual = file.type.startsWith("video/") ? await previewFrame(file) : file;
        form.append("visual", new File([visual], `${String.fromCharCode(65 + index)}__${visual.name}`, { type: visual.type }));
      }
      const result = await responseData(await fetch("/api/v1/creative-space/agent", { method: "POST", body: form }));
      patchNode(id, { status: "COMPLETED", resultText: result.reply, generationPrompt: result.generationPrompt });
      return true;
    }
    const imageRefs = media.filter((item) => !item.data.assetMime?.startsWith("video/")).map((item) => item.data.assetKey ?? item.data.resultUrl ?? item.data.assetUrl).filter((value): value is string => Boolean(value));
    const modelId = current.data.modelId ?? "";
    if (current.data.kind === "image" && getMarketModel(modelId)?.options.requiresImage && !imageRefs.length) {
      throw new Error(zh ? "此模型需要连接一张参考图片。" : "This model needs a connected reference image.");
    }
    const required = current.data.kind === "video"
      ? estimateCredits({ modelId, duration: current.data.duration ?? 5, resolution: current.data.resolution ?? "720p" })
      : (() => { const model = getMarketModel(modelId); return model ? marketCredits(model, { prompt: text, resolution: current.data.resolution, imageUrls: imageRefs }) : 0; })();
    const available = await refreshBalance();
    if (available !== null && available < required) {
      patchNode(id, { status: "idle" });
      await saveCanvas();
      const pricing = localizedHref(locale, "/pricing");
      window.location.assign(`${pricing}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return false;
    }
    const endpoint = current.data.kind === "video" ? "/api/v1/video/generate" : "/api/v1/media/generate";
    const body = current.data.kind === "video" ? {
      model: modelId, prompt: text, duration: current.data.duration, aspectRatio: current.data.aspect,
      quality: current.data.resolution, generateAudio: current.data.audio,
      imageUrls: imageRefs.slice(0, maxVideoReferences(modelId)),
    } : {
      model: modelId, prompt: text, aspectRatio: current.data.aspect, resolution: current.data.resolution,
      count: 1, imageUrls: imageRefs.slice(0, getMarketModel(modelId)?.options.maxImages ?? 0),
    };
    const result = await responseData(await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }));
    patchNode(id, { resultUuid: result.videoUuid, status: "running" });
    void refreshBalance();
    await waitForResult(id, result.videoUuid);
    return true;
  };

  const runNode = async (id: string) => {
    if (busyNode) return;
    setBusyNode(id); setError(""); setNotice("");
    try { await runOne(id); await saveCanvas(); }
    catch (cause) { patchNode(id, { status: "FAILED" }); setError(cause instanceof Error ? cause.message : "Generation failed."); }
    finally { setBusyNode(null); }
  };

  const runWorkflow = async () => {
    if (busyNode) return;
    if (!session?.user?.id) { signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`); return; }
    setBusyNode("all"); setError(""); setNotice("");
    try {
      const pending = nodesRef.current.filter((node) => ["agent", "image", "video"].includes(node.data.kind));
      const done = new Set<string>();
      while (done.size < pending.length) {
        const next = pending.find((node) => !done.has(node.id) && !upstreamOf(node.id).some((parent) => pending.some((item) => item.id === parent.id) && !done.has(parent.id)));
        if (!next) throw new Error(zh ? "画布连接存在循环，请先移除循环连线。" : "The canvas contains a connection loop.");
        if (!await runOne(next.id)) return;
        done.add(next.id);
        await saveCanvas();
      }
      setNotice(zh ? "流程执行完成" : "Workflow complete");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workflow failed."); }
    finally { setBusyNode(null); }
  };

  const removeNode = (id: string) => {
    setNodes((current) => { const next = current.filter((item) => item.id !== id); nodesRef.current = next; return next; });
    setEdges((current) => { const next = current.filter((item) => item.source !== id && item.target !== id); edgesRef.current = next; return next; });
    setSelectedId(null);
  };

  const newCanvas = () => {
    setWorkflowId(null); workflowIdRef.current = null; setName(zh ? "未命名画布" : "Untitled canvas");
    setNodes([]); nodesRef.current = []; setEdges([]); edgesRef.current = []; setSelectedId(null); setError(""); setNotice("");
    window.history.replaceState(null, "", currentPath);
  };

  const deleteCanvas = async () => {
    if (!workflowId) return;
    try { await responseData(await fetch(`/api/v1/creative-space/workflows/${encodeURIComponent(workflowId)}`, { method: "DELETE" })); newCanvas(); void syncList(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete canvas."); }
  };

  const credits = selectedNode?.data.kind === "video" ? estimateCredits({ modelId: selectedNode.data.modelId ?? DEFAULT_VIDEO.id, duration: selectedNode.data.duration ?? DEFAULT_VIDEO.durations[0], resolution: selectedNode.data.resolution ?? DEFAULT_VIDEO.resolutions[0] })
    : selectedNode?.data.kind === "image" ? (() => { const model = getMarketModel(selectedNode.data.modelId); return model ? marketCredits(model, { prompt: selectedNode.data.prompt ?? "", resolution: selectedNode.data.resolution }) : null; })() : null;
  const selectedVideoModel = VIDEO_MODELS.find((item) => item.id === selectedNode?.data.modelId) ?? DEFAULT_VIDEO;
  const selectedImageModel = getMarketModel(selectedNode?.data.modelId);
  const selectModel = (node: FlowNode, id: string) => {
    if (node.data.kind === "video") {
      const model = VIDEO_MODELS.find((item) => item.id === id);
      if (model) patchNode(node.id, { modelId: id, duration: model.durations[0], aspect: model.aspects.find((item) => item !== "Auto") ?? "16:9", resolution: model.resolutions[0], audio: model.audio && Boolean(node.data.audio) });
    } else {
      const model = IMAGE_MODELS.find((item) => item.id === id);
      if (model) patchNode(node.id, { modelId: id, aspect: model.options.aspects?.[0] ?? "1:1", resolution: model.options.resolutions?.[0] ?? "1K" });
    }
  };

  return <main className="cw-shell">
    <HomeMediaPicker lang={locale} open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addAssets} maxSelected={12} selectedIds={[]} userId={session?.user?.id} acceptedTypes={ACCEPTED_MEDIA} />
    <div className="cw-topbar">
      <Link href={localizedHref(locale, "/creative-space")} className="cw-back" aria-label={zh ? "返回创作空间" : "Back to Creative Space"}><ArrowLeft size={18} /></Link>
      <div className="cw-title-wrap"><span>{zh ? "创作空间" : "Creative Space"}</span><input value={name} onChange={(event) => setName(event.target.value.slice(0, 100))} aria-label={zh ? "画布名称" : "Canvas name"} /></div>
      <div className="cw-top-actions">
        {balance !== null ? <span className="cw-balance"><Coins size={14} />{balance}</span> : null}
        <button type="button" onClick={() => void saveCanvas()} disabled={saving}><Save size={16} />{saving ? (zh ? "保存中" : "Saving") : (zh ? "保存" : "Save")}</button>
        <button type="button" className="cw-primary" onClick={() => void runWorkflow()} disabled={Boolean(busyNode) || !nodes.some((node) => ["agent", "image", "video"].includes(node.data.kind))}>{busyNode === "all" ? <Loader2 size={16} className="cw-spin" /> : <Sparkles size={16} />}{zh ? "运行流程" : "Run workflow"}</button>
      </div>
    </div>
    <div className="cw-workspace">
      <aside className="cw-left">
        <div className="cw-aside-section"><h2>{zh ? "画布" : "Canvases"}</h2><button type="button" onClick={newCanvas}><Plus size={16} />{zh ? "新建画布" : "New canvas"}</button>
          <div className="cw-canvas-list">{workflows.map((item) => <button type="button" key={item.id} className={workflowId === item.id ? "active" : ""} onClick={() => void loadCanvas(item.id)}>{item.name}</button>)}</div>
        </div>
        <div className="cw-aside-section"><h2>{zh ? "添加节点" : "Add nodes"}</h2>
          {(["text", "asset", "agent", "image", "video"] as Kind[]).map((kind) => {
            const Icon = icons[kind];
            return <button type="button" key={kind} onClick={() => kind === "asset" ? setPickerOpen(true) : addNode(kind)}><Icon size={16} />{nodeLabels[lang][kind]}<Plus size={14} className="cw-add-plus" /></button>;
          })}
        </div>
        <p className="cw-aside-hint">{zh ? "连接节点传递提示词与参考图。拖动空白处平移，滚轮缩放；图片和视频也可直接拖入画布。" : "Connect nodes to pass prompts and references. Drag the canvas to pan, scroll to zoom, or drop media files."}</p>
      </aside>
      <div className="cw-flow" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={(connection: Connection) => setEdges((current) => { const next = addEdge({ ...connection, type: "smoothstep", animated: true }, current); edgesRef.current = next; return next; })}
          onNodeClick={(_, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId(null)} onInit={(instance) => { flowRef.current = instance; }}
          fitView={nodes.length > 0} minZoom={0.1} maxZoom={4} panOnDrag selectionOnDrag={false} proOptions={{ hideAttribution: true }}>
          <Background color="var(--ds-line-2)" gap={24} size={1} />
          <MiniMap nodeColor="var(--du-accent)" maskColor="var(--du-bg)" />
          <Controls showInteractive={false} />
        </ReactFlow>
        {!nodes.length ? <div className="cw-empty"><Sparkles size={28} /><strong>{zh ? "在无限画布中开始创作" : "Start creating on an infinite canvas"}</strong><span>{zh ? "从左侧添加节点，或把素材拖到这里" : "Add a node or drop media here"}</span></div> : null}
      </div>
      <aside className="cw-inspector">
        <div className="cw-inspector-head"><h2>{zh ? "节点设置" : "Node settings"}</h2>{selectedNode ? <button type="button" onClick={() => setSelectedId(null)} aria-label={zh ? "关闭设置" : "Close settings"}><X size={17} /></button> : null}</div>
        {selectedNode ? <div className="cw-fields">
          <label>{zh ? "名称" : "Name"}<input value={selectedNode.data.title} onChange={(event) => patchNode(selectedNode.id, { title: event.target.value.slice(0, 45) })} /></label>
          {selectedNode.data.kind !== "asset" ? <label>{zh ? "提示词" : "Prompt"}<textarea value={selectedNode.data.prompt ?? ""} onChange={(event) => patchNode(selectedNode.id, { prompt: event.target.value.slice(0, 5000) })} rows={5} placeholder={zh ? "描述你想生成的内容，或连接文字节点" : "Describe what to create or connect a text node"} /></label> : <div className="cw-asset-detail">{selectedNode.data.assetUrl ? selectedNode.data.assetMime?.startsWith("video/") ? <video src={selectedNode.data.assetUrl} controls playsInline /> : <img src={selectedNode.data.assetUrl} alt={selectedNode.data.assetName ?? ""} /> : null}<span>{selectedNode.data.assetName}</span></div>}
          {selectedNode.data.kind === "image" || selectedNode.data.kind === "video" ? <>
            <label>{zh ? "模型" : "Model"}<select value={selectedNode.data.modelId ?? ""} onChange={(event) => selectModel(selectedNode, event.target.value)}>
              {(selectedNode.data.kind === "video" ? VIDEO_MODELS : IMAGE_MODELS).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select></label>
            {selectedNode.data.kind === "video" ? <label>{zh ? "时长" : "Duration"}<select value={selectedNode.data.duration ?? selectedVideoModel.durations[0]} onChange={(event) => patchNode(selectedNode.id, { duration: Number(event.target.value) })}>{selectedVideoModel.durations.map((duration) => <option key={duration} value={duration}>{duration}s</option>)}</select></label> : null}
            <label>{zh ? "画面比例" : "Aspect ratio"}<select value={selectedNode.data.aspect ?? ""} onChange={(event) => patchNode(selectedNode.id, { aspect: event.target.value })}>{(selectedNode.data.kind === "video" ? selectedVideoModel.aspects : selectedImageModel?.options.aspects ?? ["1:1"]).filter((item) => item !== "Auto").map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}</select></label>
            <label>{zh ? "分辨率" : "Resolution"}<select value={selectedNode.data.resolution ?? ""} onChange={(event) => patchNode(selectedNode.id, { resolution: event.target.value })}>{(selectedNode.data.kind === "video" ? selectedVideoModel.resolutions : selectedImageModel?.options.resolutions ?? ["1K"]).map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}</select></label>
            {selectedNode.data.kind === "video" && selectedVideoModel.audio ? <label className="cw-checkbox"><input type="checkbox" checked={Boolean(selectedNode.data.audio)} onChange={(event) => patchNode(selectedNode.id, { audio: event.target.checked })} />{zh ? "生成声音" : "Generate audio"}</label> : null}
          </> : null}
          {selectedNode.data.resultText ? <div className="cw-result"><strong>{zh ? "Agent 结果" : "Agent result"}</strong><p>{selectedNode.data.resultText}</p></div> : null}
          {selectedNode.data.resultUrl ? <a className="cw-result-link" href={selectedNode.data.resultUrl} target="_blank" rel="noreferrer">{zh ? "打开生成结果" : "Open generated result"}</a> : null}
          {credits !== null ? <p className="cw-cost"><Coins size={14} />{zh ? `预计 ${credits} 积分` : `Estimated ${credits} credits`}</p> : null}
          {["agent", "image", "video"].includes(selectedNode.data.kind) ? <button type="button" className="cw-run-node" onClick={() => void runNode(selectedNode.id)} disabled={Boolean(busyNode)}>{busyNode === selectedNode.id ? <Loader2 size={16} className="cw-spin" /> : <Sparkles size={16} />}{zh ? "运行此节点" : "Run this node"}</button> : null}
          <button type="button" className="cw-delete-node" onClick={() => removeNode(selectedNode.id)}><Trash2 size={15} />{zh ? "删除节点" : "Delete node"}</button>
        </div> : <p className="cw-inspector-empty">{zh ? "选中节点后可编辑提示词、模型和生成参数。" : "Select a node to edit its prompt, model, and settings."}</p>}
        {workflowId ? <button type="button" className="cw-delete-canvas" onClick={() => void deleteCanvas()}><Trash2 size={14} />{zh ? "删除当前画布" : "Delete this canvas"}</button> : null}
      </aside>
    </div>
    {(notice || error) ? <div className={`cw-toast${error ? " cw-toast-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}<button type="button" onClick={() => { setNotice(""); setError(""); }} aria-label={zh ? "关闭" : "Dismiss"}><X size={14} /></button></div> : null}
  </main>;
}
