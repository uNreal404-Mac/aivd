"use client";

import {
  AlignCenterHorizontal,
  ArrowLeft,
  AtSign,
  Bookmark,
  Bot,
  Camera,
  Clapperboard,
  Copy,
  Download,
  Eraser,
  Expand,
  Eye,
  EyeOff,
  Film,
  FolderOpen,
  Frame,
  Hand,
  Image as ImageIcon,
  Keyboard,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  Map as MapIcon,
  Maximize2,
  MousePointer2,
  Music,
  Paintbrush,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Search,
  Send,
  Sparkles,
  SplitSquareHorizontal,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Upload,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { estimateCredits, STUDIO_MODELS } from "@/lib/ai-video-studio";
import { useSession } from "@/lib/auth/client";
import type { PickerAsset } from "@/lib/home-media-library";
import { localizedHref } from "@/lib/locale-path";
import { submitMedia } from "@/lib/media-studio";
import { generateVideo, uploadImage } from "@/lib/video-api";
import { CanvasEditModal, type CanvasEditSubmit } from "./canvas-inpaint-modal";
import {
  type AgentPlan,
  type AgentSession,
  type CanvasAudioNode,
  type CanvasEdge,
  type CanvasEditAction,
  type CanvasGroupNode,
  type CanvasImageNode,
  type CanvasNode,
  type CanvasSnapshot,
  type CanvasTextNode,
  type CanvasTool,
  type CanvasVideoNode,
  type CanvasViewport,
  CANVAS_STORAGE_KEY,
  bezierPath,
  clamp,
  maxZIndex,
  nextAlphaLabel,
  nodeAnchor,
  stripTransientForStorage,
} from "./canvas-types";
import "./creative-canvas.css";

interface CreativeSpaceStudioProps {
  locale: string;
  initialPrompt?: string;
  modeSlot?: ReactNode;
}

type ComposerKind = "image" | "video" | "audio";

interface LibraryEntry {
  uuid: string;
  kind: "image" | "video" | "audio";
  url: string;
  prompt: string;
  model?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_HISTORY = 40;
const CANVAS_TEMPLATES_KEY = "aivd:canvas-templates:v1";

interface CameraAngleSpec {
  id: string;
  zh: string;
  en: string;
  promptZh: string;
  promptEn: string;
}

const CAMERA_ANGLES: CameraAngleSpec[] = [
  { id: "closeup", zh: "特写镜头", en: "Close-up", promptZh: "保持原主体外观与服装完全一致，改为电影级近景特写构图，突出表情与细节质感，浅景深", promptEn: "Keep exact same subject identity and wardrobe, reframe as a cinematic close-up shot focusing on facial detail and texture, shallow depth of field" },
  { id: "medium", zh: "中景半身", en: "Medium Shot", promptZh: "保持原主体与光影风格一致，改为经典电影中景半身构图，人物姿态自然有叙事感", promptEn: "Keep exact same subject and lighting style, reframe as a classic cinematic medium waist-up shot with natural storytelling posture" },
  { id: "wide", zh: "广角全景", en: "Wide Establishing", promptZh: "保持原主体与场景美术风格一致，拉远改为 24mm 电影广角全景镜头，展现完整环境氛围", promptEn: "Keep exact same subject and art direction, pull back to a 24mm cinematic wide establishing shot revealing the full atmospheric environment" },
  { id: "low", zh: "低角度仰拍", en: "Low-Angle Hero", promptZh: "保持原主体完全一致，改为低机位仰拍英雄视角，凸显戏剧张力与电影史诗感", promptEn: "Keep exact same subject, reframe from a dramatic low-angle hero perspective looking upward with cinematic grandeur" },
  { id: "over-shoulder", zh: "过肩镜头", en: "Over-the-Shoulder", promptZh: "保持原主体与环境一致，改为电影过肩对话视角，前景柔和虚化增强沉浸感", promptEn: "Keep exact same subject and setting, reframe as a cinematic over-the-shoulder shot with soft foreground bokeh" },
  { id: "topdown", zh: "高空俯拍", en: "Top-Down Overhead", promptZh: "保持原主体与道具风格一致，改为 90 度垂直高空俯拍构图，线条几何感极强", promptEn: "Keep exact same subject and styling, reframe as a crisp 90-degree overhead top-down bird's-eye composition" },
];

interface BuiltinWorkflowTemplate {
  id: string;
  zh: string;
  en: string;
  descZh: string;
  descEn: string;
  groupZh: string;
  groupEn: string;
  steps: { titleZh: string; titleEn: string; contentZh: string; contentEn: string; edgeZh?: string; edgeEn?: string }[];
}

const BUILTIN_WORKFLOW_TEMPLATES: BuiltinWorkflowTemplate[] = [
  {
    id: "ecom-ad",
    zh: "电商大片全流程",
    en: "E-commerce Ad Pipeline",
    descZh: "商品主图 → 抠图换景 → 多机位展示 → 15s 宣传短片 + 配音",
    descEn: "Hero product → Cutout & scene → Multi-angle shots → 15s ad clip + VO",
    groupZh: "电商广告工作流",
    groupEn: "E-commerce Ad Flow",
    steps: [
      { titleZh: "1. 商品主图锚点", titleEn: "1. Product Hero Anchor", contentZh: "上传产品实拍图或下方直接生成棚拍主图，设为 @A 主视觉。", contentEn: "Upload a product photo or generate a studio hero shot below as @A.", edgeZh: "抠图换景", edgeEn: "Cutout" },
      { titleZh: "2. 多机位卖点分镜", titleEn: "2. Multi-Angle Details", contentZh: "选中 @A 点击「多机位分镜」，一键生成特写、中景与广角场景图。", contentEn: "Select @A and run Multi-Angle Shots for close-up, medium, and wide frames.", edgeZh: "图生视频", edgeEn: "Animate" },
      { titleZh: "3. 动效宣传短片", titleEn: "3. Hero Video Clip", contentZh: "多选分镜图点击「多图参考生视频」，选用 Kling 4.0 / Seedance 2.5 出片。", contentEn: "Multi-select frames and trigger Multi-Ref Video with Kling 4.0 or Seedance 2.5.", edgeZh: "配音配乐", edgeEn: "Score" },
      { titleZh: "4. 品牌口播与 BGM", titleEn: "4. Voiceover & BGM", contentZh: "切换底部「配音与音乐」生成 15 秒高端旁白与 Suno 节奏 BGM。", contentEn: "Switch bottom dock to Audio for a crisp 15s voiceover and Suno BGM." },
    ],
  },
  {
    id: "cinema-3act",
    zh: "电影三幕分镜短片",
    en: "3-Act Cinema Storyboard",
    descZh: "建立全景 → 冲突中景 → 情绪特写 → 电影原声配乐",
    descEn: "Establishing wide → Conflict medium → Emotional close-up → Film score",
    groupZh: "电影三幕剧分镜",
    groupEn: "3-Act Film Storyboard",
    steps: [
      { titleZh: "第一幕 · 建立全景", titleEn: "Act I · Establishing Wide", contentZh: "用 21:9 宽银幕建立世界观与光影基调，奠定整片视觉锚点。", contentEn: "Establish world-building and lighting mood in 21:9 widescreen.", edgeZh: "推镜切中景", edgeEn: "Cut to Med" },
      { titleZh: "第二幕 · 动作推进", titleEn: "Act II · Rising Action", contentZh: "引用 @A 保持角色服装与环境一致，加入明确运镜动作与情绪张力。", contentEn: "Reference @A for character continuity and introduce camera movement.", edgeZh: "情绪高潮", edgeEn: "Climax" },
      { titleZh: "第三幕 · 高潮特写", titleEn: "Act III · Climax Close-up", contentZh: "浅景深面部特写 + 慢动作光影变化，完成情感定格。", contentEn: "Shallow DOF close-up with slow-motion lighting shift for emotional payoff.", edgeZh: "管弦配乐", edgeEn: "Score" },
      { titleZh: "电影配乐与环境音", titleEn: "Cinematic Score & SFX", contentZh: "使用 Suno V6 纯音乐 BGM 或 Suno Sounds 补充环境拟音。", contentEn: "Generate instrumental BGM via Suno V6 or ambient foley via Suno Sounds." },
    ],
  },
  {
    id: "ip-drama",
    zh: "角色一致性 IP 漫剧",
    en: "Consistent IP Series",
    descZh: "锁角色定妆照 → 3 场次连续分镜 → 角色专属配音",
    descEn: "Character sheet lock → 3 continuous scene beats → Dedicated voice track",
    groupZh: "IP 漫剧制作管线",
    groupEn: "IP Character Pipeline",
    steps: [
      { titleZh: "角色定妆锚点", titleEn: "Character Anchor Sheet", contentZh: "生成角色三视图/高清正脸照，作为所有场次一致性的核心参考。", contentEn: "Generate a clean character sheet as the visual identity lock.", edgeZh: "场次 1", edgeEn: "Scene 1" },
      { titleZh: "场次 1 · 日常开场", titleEn: "Scene 1 · Hook Beat", contentZh: "引用角色锚点，设定前 3 秒强情绪冲突画面并生成首段视频。", contentEn: "Reference the character anchor for a high-retention 3-second hook clip.", edgeZh: "场次 2", edgeEn: "Scene 2" },
      { titleZh: "场次 2 · 反转对白", titleEn: "Scene 2 · Plot Twist", contentZh: "用「局部重绘」微调表情或道具细节，再转视频衔接。", contentEn: "Use Inpaint to refine expression or props, then animate smoothly.", edgeZh: "角色配音", edgeEn: "Dialogue" },
      { titleZh: "角色专属声线", titleEn: "Signature Voice Track", contentZh: "在底部音频模式固定同一 ElevenLabs 声线录制全集台词。", contentEn: "Lock one ElevenLabs voice in the bottom audio dock for consistent dialogue." },
    ],
  },
];

interface UserCanvasTemplate {
  id: string;
  name: string;
  createdAt: number;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const IMAGE_MODELS = marketModelsOf("image");
const AUDIO_MODELS = marketModelsOf("audio");
const VIDEO_MODELS = STUDIO_MODELS.filter((model) => model.available);

const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0]?.id ?? "seedream-5-5";
const DEFAULT_VIDEO_MODEL =
  VIDEO_MODELS.find((m) => m.id === "bytedance/seedance-2-5")?.id ?? VIDEO_MODELS[0]?.id ?? "veo-3.1";
const DEFAULT_AUDIO_MODEL = AUDIO_MODELS[0]?.id ?? "elevenlabs-v3";

function parseApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}

async function waitForVideoEvent(video: HTMLVideoElement, event: string) {
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to read video"));
    };
    const cleanup = () => {
      video.removeEventListener(event, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(event, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function sampleVideo(file: File, label: string): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = url;
  try {
    await waitForVideoEvent(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const times = duration > 0 ? [0.15, 0.5, 0.85].map((ratio) => duration * ratio) : [0];
    const frames: File[] = [];
    for (const [index, time] of times.entries()) {
      if (duration > 0) {
        video.currentTime = Math.min(Math.max(time, 0), Math.max(duration - 0.05, 0));
        await waitForVideoEvent(video, "seeked");
      }
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight, 1));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (blob) {
        frames.push(new File([blob], `${label}__frame-${index + 1}.jpg`, { type: "image/jpeg" }));
      }
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileFromImageUrl(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

function makeDefaultSession(zh: boolean): AgentSession {
  return {
    id: `session-${Date.now()}`,
    title: zh ? "默认会话" : "Session 1",
    messages: [],
  };
}

export function CreativeSpaceStudio({ locale, initialPrompt = "", modeSlot }: CreativeSpaceStudioProps) {
  const zh = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const { data: session } = useSession();
  const creditsShortfall = useCreditsShortfall(zh);

  // Project & spatial board state
  const [projectTitle, setProjectTitle] = useState(zh ? "未命名无限画布" : "Untitled Infinite Canvas");
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 120, y: 90, scale: 1 });
  const [tool, setTool] = useState<CanvasTool>("select");
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  // Undo / Redo history
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Drawers, overlays & view toggles (Jimeng / open-source infinite-canvas primitives)
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryEntry[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<UserCanvasTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [shotsModalNodeId, setShotsModalNodeId] = useState<string | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<string[]>(["closeup", "medium", "wide"]);
  const [shotsResolution, setShotsResolution] = useState("1K");
  const [shotsSubmitting, setShotsSubmitting] = useState(false);
  const [editModal, setEditModal] = useState<{ nodeId: string; action: CanvasEditAction } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [comparePair, setComparePair] = useState<{
    beforeUrl: string;
    afterUrl: string;
    beforeLabel: string;
    afterLabel: string;
  } | null>(null);
  const [compareSplit, setCompareSplit] = useState(50);
  const [elementPickerOpen, setElementPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Bottom multi-modal generation dock
  const [composerKind, setComposerKind] = useState<ComposerKind>("image");
  const [composerPrompt, setComposerPrompt] = useState("");
  const [imageModelId, setImageModelId] = useState(DEFAULT_IMAGE_MODEL);
  const [imageAspect, setImageAspect] = useState("1:1");
  const [imageRes, setImageRes] = useState("2K");
  const [imageCount, setImageCount] = useState(1);

  const [videoModelId, setVideoModelId] = useState(DEFAULT_VIDEO_MODEL);
  const [videoAspect, setVideoAspect] = useState("16:9");
  const [videoRes, setVideoRes] = useState("720p");
  const [videoDuration, setVideoDuration] = useState(5);
  const [videoAudio, setVideoAudio] = useState(true);

  const [audioModelId, setAudioModelId] = useState(DEFAULT_AUDIO_MODEL);
  const [audioVoice, setAudioVoice] = useState(getMarketModel(DEFAULT_AUDIO_MODEL)?.options.voices?.[0]?.id ?? "");
  const [audioStyle, setAudioStyle] = useState("");
  const [composerSubmitting, setComposerSubmitting] = useState(false);

  // Multi-session AI Agent state (Dreamina Chat + Canvas)
  const [sessions, setSessions] = useState<AgentSession[]>(() => [makeDefaultSession(zh)]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id ?? "session-1");
  const [agentInput, setAgentInput] = useState(initialPrompt);
  const [agentPlanning, setAgentPlanning] = useState(false);
  const [agentVideoModel, setAgentVideoModel] = useState(DEFAULT_VIDEO_MODEL);
  const [agentError, setAgentError] = useState<string | null>(null);

  // Refs for pointer interactions & marquee selection
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const hydratedRef = useRef(false);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origins: Map<string, { x: number; y: number }>;
    moved: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    nodeId: string;
    startX: number;
    startY: number;
    originW: number;
    originH: number;
  } | null>(null);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Restore persisted canvas project on mount (and pull handoff from Image/Video studios).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CANVAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          version?: number;
          title?: string;
          viewport?: CanvasViewport;
          nodes?: CanvasNode[];
          edges?: CanvasEdge[];
          sessions?: AgentSession[];
          activeSessionId?: string;
        };
        if (parsed && parsed.version === 2) {
          if (parsed.title) setProjectTitle(parsed.title);
          if (parsed.viewport) setViewport(parsed.viewport);
          if (Array.isArray(parsed.nodes)) setNodes(parsed.nodes);
          if (Array.isArray(parsed.edges)) setEdges(parsed.edges);
          if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
            setSessions(parsed.sessions);
            setActiveSessionId(parsed.activeSessionId || parsed.sessions[0].id);
          }
        }
      }
      // Load user's saved workflow templates.
      const savedTemplates = localStorage.getItem(CANVAS_TEMPLATES_KEY);
      if (savedTemplates) {
        const list = JSON.parse(savedTemplates) as UserCanvasTemplate[];
        if (Array.isArray(list)) setUserTemplates(list);
      }
      // Optional handoff media from Image / Video / Audio Studios ("在无限画布中打开").
      const handoff = sessionStorage.getItem("aivd:canvas-handoff");
      if (handoff) {
        sessionStorage.removeItem("aivd:canvas-handoff");
        const item = JSON.parse(handoff) as { url?: string; prompt?: string; model?: string; kind?: "image" | "video" | "audio" };
        if (item?.url) {
          setNodes((prev) => {
            const label = nextAlphaLabel(prev);
            const zIndex = maxZIndex(prev) + 1;
            const slot = prev.filter((n) => n.kind !== "group").length;
            const x = 100 + (slot % 3) * 320;
            const y = 80 + Math.floor(slot / 3) * 260;
            const node: CanvasNode =
              item.kind === "video"
                ? {
                    id: `handoff-vid-${Date.now()}`,
                    kind: "video",
                    label,
                    name: item.model || (zh ? "视频工作室作品" : "Studio video"),
                    url: item.url!,
                    prompt: item.prompt,
                    model: item.model,
                    x,
                    y,
                    width: 320,
                    zIndex,
                    status: "ready",
                    safety: "allowed",
                    createdAt: Date.now(),
                  }
                : item.kind === "audio"
                  ? {
                      id: `handoff-aud-${Date.now()}`,
                      kind: "audio",
                      label,
                      name: item.model || (zh ? "音频工作室作品" : "Studio audio"),
                      url: item.url!,
                      prompt: item.prompt,
                      model: item.model,
                      x,
                      y,
                      width: 290,
                      zIndex,
                      status: "ready",
                      createdAt: Date.now(),
                    }
                  : {
                      id: `handoff-img-${Date.now()}`,
                      kind: "image",
                      label,
                      name: item.model || (zh ? "图片工作室作品" : "Studio image"),
                      url: item.url!,
                      prompt: item.prompt,
                      model: item.model,
                      x,
                      y,
                      width: 300,
                      zIndex,
                      status: "ready",
                      safety: "allowed",
                      createdAt: Date.now(),
                    };
            setSelectedIds([node.id]);
            return [...prev, node];
          });
        }
      }
    } catch {
      // Ignore corrupt local state.
    }
    hydratedRef.current = true;
  }, [zh]);

  // Auto-save project state.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      const payload = stripTransientForStorage({
        version: 2,
        title: projectTitle,
        viewport,
        nodes,
        edges,
        sessions,
        activeSessionId,
        updatedAt: Date.now(),
      });
      localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage quota full or unavailable.
    }
  }, [projectTitle, viewport, nodes, edges, sessions, activeSessionId]);

  useEffect(() => {
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  // Push history snapshot before structural mutations.
  const commitHistory = useCallback(() => {
    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { nodes: nodesRef.current, edges: edgesRef.current }]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture((f) => [{ nodes: nodesRef.current, edges: edgesRef.current }, ...f.slice(0, MAX_HISTORY - 1)]);
      setNodes(previous.nodes);
      setEdges(previous.edges);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), { nodes: nodesRef.current, edges: edgesRef.current }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return prev.slice(1);
    });
  }, []);

  // Keyboard shortcuts (V, H, C, M, E, L, ?, Space, Cmd+K, Cmd+Z, Cmd+Shift+Z, Delete, Cmd+D).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const typing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
        setShortcutsOpen(false);
        return;
      }
      if (event.code === "Space" && !typing) {
        event.preventDefault();
        setSpacePressed(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setShortcutsOpen(false);
        setTemplatesOpen(false);
        setShotsModalNodeId(null);
        setConnectFromId(null);
        setTool("select");
        setSelectedIds([]);
        return;
      }
      if (typing) return;
      const lower = event.key.toLowerCase();
      if (lower === "v") setTool("select");
      else if (lower === "h") setTool("hand");
      else if (lower === "c") setTool((cur) => (cur === "connect" ? "select" : "connect"));
      else if (lower === "m") setShowMinimap((v) => !v);
      else if (lower === "e") setShowEdges((v) => !v);
      else if (event.key === "?") setShortcutsOpen((v) => !v);
      else if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length > 0) {
        event.preventDefault();
        commitHistory();
        const delSet = new Set(selectedIds);
        setNodes((prev) => prev.filter((n) => !delSet.has(n.id)));
        setEdges((prev) => prev.filter((e) => !delSet.has(e.fromId) && !delSet.has(e.toId)));
        setSelectedIds([]);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d" && selectedIds.length > 0) {
        event.preventDefault();
        commitHistory();
        setNodes((prev) => {
          let z = maxZIndex(prev);
          const created: CanvasNode[] = [];
          const all = [...prev];
          for (const id of selectedIds) {
            const orig = prev.find((n) => n.id === id);
            if (!orig) continue;
            const copyNode: CanvasNode = {
              ...orig,
              id: `${orig.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              label: nextAlphaLabel(all),
              x: orig.x + 36,
              y: orig.y + 36,
              zIndex: ++z,
              createdAt: Date.now(),
            };
            all.push(copyNode);
            created.push(copyNode);
          }
          setSelectedIds(created.map((n) => n.id));
          return all;
        });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [commitHistory, redo, selectedIds, undo]);

  // Poll any generating canvas nodes until completion.
  const generatingKey = useMemo(
    () =>
      nodes
        .filter((n) => n.status === "generating" && n.jobUuid)
        .map((n) => `${n.id}:${n.jobUuid}`)
        .join(","),
    [nodes],
  );

  useEffect(() => {
    if (!generatingKey) return;
    let cancelled = false;
    const poll = async () => {
      const pending = nodesRef.current.filter((n) => n.status === "generating" && n.jobUuid);
      for (const node of pending) {
        if (cancelled || !node.jobUuid) return;
        try {
          const res = await fetch(`/api/v1/video/${encodeURIComponent(node.jobUuid)}/status`, { cache: "no-store" });
          if (res.status !== 200) continue;
          const payload = await res.json();
          const data = payload?.data;
          if (!data) continue;
          if (data.status === "COMPLETED") {
            const urls: string[] = Array.isArray(data.mediaUrls) && data.mediaUrls.length
              ? data.mediaUrls
              : data.videoUrl
                ? [data.videoUrl]
                : [];
            if (urls.length > 0) {
              setNodes((prev) =>
                prev.map((item) => {
                  if (item.id !== node.id) return item;
                  if (item.kind === "image") {
                    return { ...item, status: "ready", url: urls[0], safety: "allowed", error: null };
                  }
                  if (item.kind === "video") {
                    return { ...item, status: "ready", url: urls[0], safety: "allowed", error: null };
                  }
                  if (item.kind === "audio") {
                    return { ...item, status: "ready", url: urls[0], error: null };
                  }
                  return item;
                }),
              );
              // If batch image generation returned multiple images, drop extra siblings onto the canvas!
              if (node.kind === "image" && urls.length > 1) {
                setNodes((prev) => {
                  let z = maxZIndex(prev);
                  const all = [...prev];
                  for (let i = 1; i < urls.length; i++) {
                    const sibling: CanvasImageNode = {
                      id: `img-${Date.now()}-${i}`,
                      kind: "image",
                      label: nextAlphaLabel(all),
                      name: `${node.name} #${i + 1}`,
                      url: urls[i],
                      prompt: node.prompt,
                      model: node.model,
                      resolution: node.resolution,
                      aspectRatio: node.aspectRatio,
                      x: node.x + i * (node.width + 28),
                      y: node.y,
                      width: node.width,
                      zIndex: ++z,
                      status: "ready",
                      safety: "allowed",
                      createdAt: Date.now(),
                    };
                    all.push(sibling);
                  }
                  return all;
                });
              }
            }
          } else if (data.status === "FAILED") {
            setNodes((prev) =>
              prev.map((item) =>
                item.id === node.id
                  ? { ...item, status: "failed", error: data.error || (zh ? "生成失败，积分已自动退回" : "Generation failed, credits refunded") }
                  : item,
              ),
            );
          }
        } catch {
          // Retry on next tick.
        }
      }
    };
    const timer = setInterval(() => void poll(), 3200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [generatingKey, zh]);

  // Load user's existing creations ONLY when signed in and library drawer opens (zero 401 noise!).
  useEffect(() => {
    if (!libraryOpen || !session) return;
    let cancelled = false;
    setLibraryLoading(true);
    void Promise.all([
      fetch("/api/v1/video/list?type=image&limit=18", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/v1/video/list?type=video&limit=18", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([imgJson, vidJson]) => {
        if (cancelled) return;
        const rows: LibraryEntry[] = [];
        const addRows = (json: unknown, kind: "image" | "video") => {
          const list = (json as { data?: { videos?: unknown[] } } | null)?.data?.videos;
          if (!Array.isArray(list)) return;
          for (const raw of list) {
            const item = raw as { uuid?: string; status?: string; mediaUrls?: string[]; videoUrl?: string; prompt?: string; model?: string };
            if (item.status !== "COMPLETED") continue;
            const url = item.mediaUrls?.[0] || item.videoUrl;
            if (!url || !item.uuid) continue;
            rows.push({ uuid: item.uuid, kind, url, prompt: item.prompt ?? "", model: item.model });
          }
        };
        addRows(imgJson, "image");
        addRows(vidJson, "video");
        setLibraryItems(rows);
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryOpen, session]);

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedIds.includes(n.id)),
    [nodes, selectedIds],
  );
  const singleSelected = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const selectedImages = useMemo(
    () => selectedNodes.filter((n): n is CanvasImageNode => n.kind === "image" && n.status === "ready"),
    [selectedNodes],
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId],
  );

  // Compute screen center in world coordinates for spawning new nodes cleanly.
  const worldCenter = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 520;
    const cy = rect ? rect.height * 0.42 : 300;
    return {
      x: Math.round((cx - viewport.x) / viewport.scale - 140),
      y: Math.round((cy - viewport.y) / viewport.scale - 110),
    };
  }, [viewport]);

  // Content moderation for uploaded local files (preserves existing safety pipeline).
  const moderateUploadedNode = async (node: CanvasImageNode | CanvasVideoNode) => {
    if (!node.file) return;
    const samples =
      node.kind === "image"
        ? [new File([node.file], `${node.label}__${node.file.name}`, { type: node.file.type })]
        : await sampleVideo(node.file, node.label);

    if (!session) {
      // Allow local preview arrangement while signed out; server checks on login/generation.
      setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, safety: "allowed", samples } : item)));
      return;
    }

    const formData = new FormData();
    formData.set("action", "moderate");
    formData.set("locale", locale);
    formData.set("assets", JSON.stringify([{ id: node.id, label: node.label, name: node.name, type: node.kind }]));
    for (const sample of samples) formData.append("visual", sample);
    const response = await fetch("/api/v1/creative-space/agent", { method: "POST", body: formData });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) {
        setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, safety: "allowed", samples } : item)));
        return;
      }
      throw new Error(parseApiError(payload, zh ? "素材未通过安全检查，已移除" : "Asset blocked by safety check"));
    }
    setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, safety: "allowed", samples } : item)));
  };

  const addFiles = async (files: File[]) => {
    const accepted = files.filter(
      (file) =>
        (file.type.startsWith("image/") || file.type.startsWith("video/")) &&
        file.size <= (file.type.startsWith("image/") ? MAX_IMAGE_SIZE : MAX_FILE_SIZE),
    );
    if (accepted.length !== files.length) {
      showToast(zh ? "仅支持常见图片（≤10MB）或视频（≤100MB）" : "Only images (≤10MB) and videos (≤100MB) are supported");
    }
    if (accepted.length === 0) return;

    commitHistory();
    const origin = worldCenter();
    const created: (CanvasImageNode | CanvasVideoNode)[] = [];
    setNodes((prev) => {
      let z = maxZIndex(prev);
      const all = [...prev];
      for (const [idx, file] of accepted.entries()) {
        const url = URL.createObjectURL(file);
        urlsRef.current.push(url);
        const label = nextAlphaLabel(all);
        const isVideo = file.type.startsWith("video/");
        const node: CanvasImageNode | CanvasVideoNode = isVideo
          ? {
              id: `vid-${Date.now()}-${idx}`,
              kind: "video",
              label,
              name: file.name,
              url,
              x: origin.x + idx * 310,
              y: origin.y,
              width: 300,
              zIndex: ++z,
              status: "ready",
              safety: "checking",
              file,
              samples: [],
              createdAt: Date.now(),
            }
          : {
              id: `img-${Date.now()}-${idx}`,
              kind: "image",
              label,
              name: file.name,
              url,
              x: origin.x + idx * 310,
              y: origin.y,
              width: 280,
              zIndex: ++z,
              status: "ready",
              safety: "checking",
              file,
              samples: [],
              createdAt: Date.now(),
            };
        all.push(node);
        created.push(node);
      }
      setSelectedIds(created.map((n) => n.id));
      return all;
    });

    for (const node of created) {
      try {
        await moderateUploadedNode(node);
      } catch (err) {
        URL.revokeObjectURL(node.url);
        setNodes((prev) => prev.filter((item) => item.id !== node.id));
        setSelectedIds((prev) => prev.filter((id) => id !== node.id));
        showToast(err instanceof Error ? err.message : zh ? "素材未通过安全检查" : "Blocked by safety review");
      }
    }
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDropOnStage = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      void addFiles(Array.from(event.dataTransfer.files));
    }
  };

  // Spawn helper nodes: Text card, Group frame, or Library item.
  const spawnTextNode = (title?: string, content?: string, tone: CanvasTextNode["tone"] = "note") => {
    commitHistory();
    const pos = worldCenter();
    setNodes((prev) => {
      const slot = prev.filter((n) => n.kind !== "group").length;
      const node: CanvasTextNode = {
        id: `txt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kind: "text",
        label: nextAlphaLabel(prev),
        name: title || (zh ? "创意便签" : "Creative Note"),
        title: title || (zh ? "镜头 / 提示词笔记" : "Shot / Prompt Note"),
        content: content || "",
        tone,
        x: pos.x + (slot % 3) * 304,
        y: pos.y + Math.floor(slot / 3) * 224,
        width: 260,
        zIndex: maxZIndex(prev) + 1,
        status: "ready",
        createdAt: Date.now(),
      };
      setSelectedIds([node.id]);
      return [...prev, node];
    });
  };

  const spawnGroupNode = (aroundSelected = false) => {
    commitHistory();
    let x = worldCenter().x - 40;
    let y = worldCenter().y - 40;
    let width = 620;
    let height = 380;
    if (aroundSelected && selectedNodes.length > 0) {
      const minX = Math.min(...selectedNodes.map((n) => n.x)) - 28;
      const minY = Math.min(...selectedNodes.map((n) => n.y)) - 48;
      const maxX = Math.max(...selectedNodes.map((n) => n.x + n.width)) + 28;
      const maxY = Math.max(...selectedNodes.map((n) => n.y + (n.height ?? Math.round(n.width * 0.78) + 56))) + 28;
      x = minX;
      y = minY;
      width = Math.max(320, maxX - minX);
      height = Math.max(240, maxY - minY);
    }
    setNodes((prev) => {
      const group: CanvasGroupNode = {
        id: `grp-${Date.now()}`,
        kind: "group",
        label: nextAlphaLabel(prev),
        name: zh ? "分镜分组" : "Scene Group",
        title: zh ? `场景分组 ${prev.filter((n) => n.kind === "group").length + 1}` : `Scene Group ${prev.filter((n) => n.kind === "group").length + 1}`,
        x,
        y,
        width,
        height,
        zIndex: 0,
        status: "ready",
        createdAt: Date.now(),
      };
      setSelectedIds([group.id]);
      return [group, ...prev];
    });
  };

  const addFromLibrary = (entry: LibraryEntry) => {
    commitHistory();
    const pos = worldCenter();
    setNodes((prev) => {
      const label = nextAlphaLabel(prev);
      const z = maxZIndex(prev) + 1;
      const node: CanvasNode =
        entry.kind === "video"
          ? {
              id: `lib-${entry.uuid}-${Date.now()}`,
              kind: "video",
              label,
              name: entry.model || (zh ? "视频作品" : "Video"),
              url: entry.url,
              prompt: entry.prompt,
              model: entry.model,
              x: pos.x + (prev.length % 3) * 40,
              y: pos.y + (prev.length % 3) * 32,
              width: 300,
              zIndex: z,
              status: "ready",
              safety: "allowed",
              createdAt: Date.now(),
            }
          : {
              id: `lib-${entry.uuid}-${Date.now()}`,
              kind: "image",
              label,
              name: entry.model || (zh ? "图片作品" : "Image"),
              url: entry.url,
              prompt: entry.prompt,
              model: entry.model,
              x: pos.x + (prev.length % 3) * 40,
              y: pos.y + (prev.length % 3) * 32,
              width: 280,
              zIndex: z,
              status: "ready",
              safety: "allowed",
              createdAt: Date.now(),
            };
      setSelectedIds([node.id]);
      return [...prev, node];
    });
    showToast(zh ? "已添加到画布" : "Added to canvas");
  };

  // Extract a still frame from a Video Node onto the canvas as a new Image Node!
  const extractVideoFrame = (videoNode: CanvasVideoNode) => {
    const el = document.querySelector<HTMLVideoElement>(`video[data-node-id="${videoNode.id}"]`);
    if (!el || !el.videoWidth) {
      showToast(zh ? "请先等待视频加载完成后再截帧" : "Wait for the video to load before capturing a frame");
      return;
    }
    try {
      const c = document.createElement("canvas");
      c.width = el.videoWidth;
      c.height = el.videoHeight;
      c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/png");
      c.toBlob((blob) => {
        if (!blob) return;
        commitHistory();
        const file = new File([blob], `frame-${videoNode.label}.png`, { type: "image/png" });
        const newId = `frame-${Date.now()}`;
        setNodes((prev) => {
          const imgNode: CanvasImageNode = {
            id: newId,
            kind: "image",
            label: nextAlphaLabel(prev),
            name: zh ? `@${videoNode.label} 截取帧` : `@${videoNode.label} Frame`,
            url: dataUrl,
            x: videoNode.x + videoNode.width + 48,
            y: videoNode.y,
            width: 280,
            zIndex: maxZIndex(prev) + 1,
            status: "ready",
            safety: "allowed",
            file,
            createdAt: Date.now(),
          };
          setSelectedIds([newId]);
          return [...prev, imgNode];
        });
        setEdges((prev) => [
          ...prev,
          { id: `edge-${Date.now()}`, fromId: videoNode.id, toId: newId, kind: "edit", label: zh ? "截帧" : "Frame" },
        ]);
        showToast(zh ? "已截取当前视频帧到画布" : "Captured video frame onto canvas");
      }, "image/png");
    } catch {
      showToast(zh ? "跨域视频受浏览器安全策略限制，请先下载后拖入画布" : "Cross-origin video frame capture blocked by browser security");
    }
  };

  // Ensure an image node has a storage key or HTTPS URL usable by KIE.
  const resolveImageRef = async (node: CanvasImageNode): Promise<string> => {
    if (node.storageKey) return node.storageKey;
    if (node.file) {
      const key = await uploadImage(node.file);
      setNodes((prev) => prev.map((item) => (item.id === node.id && item.kind === "image" ? { ...item, storageKey: key } : item)));
      return key;
    }
    if (/^https?:\/\//i.test(node.url)) return node.url;
    const f = await fileFromImageUrl(node.url, `${node.label}.png`);
    if (!f) throw new Error(zh ? "无法准备参考图，请重试" : "Could not prepare reference image");
    const key = await uploadImage(f);
    setNodes((prev) => prev.map((item) => (item.id === node.id && item.kind === "image" ? { ...item, storageKey: key } : item)));
    return key;
  };

  // Live credit computation for the bottom multi-modal composer.
  const selectedImageModel = getMarketModel(imageModelId) ?? IMAGE_MODELS[0];
  const selectedVideoModel = VIDEO_MODELS.find((m) => m.id === videoModelId) ?? VIDEO_MODELS[0];
  const selectedAudioModel = getMarketModel(audioModelId) ?? AUDIO_MODELS[0];

  const composerCredits = useMemo(() => {
    if (composerKind === "image") {
      return marketCredits(selectedImageModel, {
        prompt: composerPrompt,
        aspectRatio: imageAspect,
        resolution: imageRes || undefined,
        count: imageCount,
        imageUrls: selectedImages.map((n) => n.storageKey || n.url),
      });
    }
    if (composerKind === "video") {
      return estimateCredits({ modelId: videoModelId, duration: videoDuration, resolution: videoRes });
    }
    return marketCredits(selectedAudioModel, {
      prompt: composerPrompt,
      voice: audioVoice,
      style: audioStyle,
    });
  }, [
    composerKind,
    selectedImageModel,
    composerPrompt,
    imageAspect,
    imageRes,
    imageCount,
    selectedImages,
    videoModelId,
    videoDuration,
    videoRes,
    selectedAudioModel,
    audioVoice,
    audioStyle,
  ]);

  // Execute bottom composer generation directly onto canvas!
  const handleComposerGenerate = async () => {
    if (composerSubmitting) return;
    const text = composerPrompt.trim();
    if (!text) {
      showToast(zh ? "请先输入创作提示词" : "Enter a prompt first");
      return;
    }
    if (!session) {
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }

    setComposerSubmitting(true);
    try {
      const refNodes = selectedImages;
      const basePos =
        refNodes.length > 0
          ? { x: Math.max(...refNodes.map((n) => n.x + n.width)) + 64, y: refNodes[0].y }
          : worldCenter();

      if (composerKind === "image") {
        const refKeys = await Promise.all(refNodes.slice(0, selectedImageModel.options.maxImages ?? 10).map(resolveImageRef));
        const res = await submitMedia(
          {
            model: selectedImageModel.id,
            prompt: text,
            aspectRatio: imageAspect,
            resolution: imageRes || undefined,
            count: imageCount,
            imageUrls: refKeys.length ? refKeys : undefined,
          },
          zh,
        );
        if (!res.ok) {
          showToast(res.message);
          if (res.needsLogin) signIn.onOpen();
          if (res.code === "INSUFFICIENT_CREDITS") creditsShortfall.report(res.message, res.requiredCredits);
          return;
        }
        commitHistory();
        const nodeId = `gen-img-${Date.now()}`;
        setNodes((prev) => {
          const genNode: CanvasImageNode = {
            id: nodeId,
            kind: "image",
            label: nextAlphaLabel(prev),
            name: selectedImageModel.name,
            url: "",
            prompt: text,
            model: selectedImageModel.name,
            resolution: imageRes,
            aspectRatio: imageAspect,
            x: basePos.x,
            y: basePos.y,
            width: 280,
            zIndex: maxZIndex(prev) + 1,
            status: "generating",
            jobUuid: res.uuid,
            safety: "allowed",
            createdAt: Date.now(),
          };
          setSelectedIds([nodeId]);
          return [...prev, genNode];
        });
        if (refNodes.length > 0) {
          setEdges((prev) => [
            ...prev,
            ...refNodes.map((r, i) => ({
              id: `edge-${Date.now()}-${i}`,
              fromId: r.id,
              toId: nodeId,
              kind: "reference" as const,
              label: refNodes.length > 1 ? (zh ? "融合参考" : "Fusion") : zh ? "参考图" : "Ref",
            })),
          ]);
        }
        showToast(zh ? "图片任务已加入画布，生成完成后自动展示" : "Image generating directly on canvas");
      } else if (composerKind === "video") {
        const refKeys = await Promise.all(refNodes.slice(0, 4).map(resolveImageRef));
        const data = await generateVideo({
          prompt: text,
          model: videoModelId,
          duration: videoDuration,
          aspectRatio: videoAspect,
          quality: videoRes,
          imageUrl: refKeys.length === 1 ? refKeys[0] : undefined,
          imageUrls: refKeys.length > 1 ? refKeys : undefined,
          generateAudio: videoAudio,
        });
        commitHistory();
        const nodeId = `gen-vid-${Date.now()}`;
        setNodes((prev) => {
          const vidNode: CanvasVideoNode = {
            id: nodeId,
            kind: "video",
            label: nextAlphaLabel(prev),
            name: selectedVideoModel.name,
            url: "",
            prompt: text,
            model: selectedVideoModel.name,
            duration: videoDuration,
            resolution: videoRes,
            x: basePos.x,
            y: basePos.y,
            width: 320,
            zIndex: maxZIndex(prev) + 1,
            status: "generating",
            jobUuid: data.videoUuid,
            safety: "allowed",
            createdAt: Date.now(),
          };
          setSelectedIds([nodeId]);
          return [...prev, vidNode];
        });
        if (refNodes.length > 0) {
          setEdges((prev) => [
            ...prev,
            ...refNodes.map((r, i) => ({
              id: `edge-${Date.now()}-${i}`,
              fromId: r.id,
              toId: nodeId,
              kind: "animate" as const,
              label: zh ? "图生视频" : "I2V",
            })),
          ]);
        }
        showToast(zh ? "视频任务已加入画布，正在渲染…" : "Video rendering on canvas…");
      } else {
        const res = await submitMedia(
          {
            model: selectedAudioModel.id,
            prompt: text,
            voice: audioVoice || undefined,
            style: audioStyle.trim() || undefined,
          },
          zh,
        );
        if (!res.ok) {
          showToast(res.message);
          if (res.needsLogin) signIn.onOpen();
          if (res.code === "INSUFFICIENT_CREDITS") creditsShortfall.report(res.message, res.requiredCredits);
          return;
        }
        commitHistory();
        const nodeId = `gen-aud-${Date.now()}`;
        setNodes((prev) => {
          const audNode: CanvasAudioNode = {
            id: nodeId,
            kind: "audio",
            label: nextAlphaLabel(prev),
            name: selectedAudioModel.name,
            url: "",
            prompt: text,
            model: selectedAudioModel.name,
            x: basePos.x,
            y: basePos.y,
            width: 300,
            zIndex: maxZIndex(prev) + 1,
            status: "generating",
            jobUuid: res.uuid,
            createdAt: Date.now(),
          };
          setSelectedIds([nodeId]);
          return [...prev, audNode];
        });
        showToast(zh ? "音频任务已加入画布" : "Audio generating on canvas");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh ? "提交失败，请重试" : "Submission failed");
    } finally {
      setComposerSubmitting(false);
    }
  };

  // Handle post-editing modal submission (Inpaint / Erase / Outpaint / Cutout / Upscale / Text Edit / Animate).
  const handleEditModalSubmit = async (payload: CanvasEditSubmit) => {
    if (!editModal) return;
    const sourceNode = nodes.find((n): n is CanvasImageNode => n.id === editModal.nodeId && n.kind === "image");
    if (!sourceNode) return;
    if (!session) {
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }

    setEditSubmitting(true);
    try {
      const baseRef = await resolveImageRef(sourceNode);
      if (payload.action === "animate") {
        const data = await generateVideo({
          prompt: payload.prompt,
          model: payload.modelId,
          duration: payload.duration,
          aspectRatio: payload.aspectRatio,
          quality: payload.resolution,
          imageUrl: baseRef,
          generateAudio: payload.audio,
        });
        commitHistory();
        const newId = `anim-${Date.now()}`;
        setNodes((prev) => [
          ...prev,
          {
            id: newId,
            kind: "video",
            label: nextAlphaLabel(prev),
            name: `${sourceNode.name} · ${zh ? "视频" : "Video"}`,
            url: "",
            prompt: payload.prompt,
            model: payload.modelId,
            duration: payload.duration,
            resolution: payload.resolution,
            x: sourceNode.x + sourceNode.width + 64,
            y: sourceNode.y,
            width: 320,
            zIndex: maxZIndex(prev) + 1,
            status: "generating",
            jobUuid: data.videoUuid,
            safety: "allowed",
            createdAt: Date.now(),
          },
        ]);
        setEdges((prev) => [
          ...prev,
          { id: `edge-${Date.now()}`, fromId: sourceNode.id, toId: newId, kind: "animate", label: zh ? "图生视频" : "Animate" },
        ]);
        setSelectedIds([newId]);
        setEditModal(null);
        showToast(zh ? "图生视频任务已创建并连线至画布" : "Video generation spawned on canvas");
        return;
      }

      const imageUrls = [baseRef];
      if (payload.compositeFile) {
        const maskKey = await uploadImage(payload.compositeFile);
        imageUrls.push(maskKey);
      }

      const res = await submitMedia(
        {
          model: payload.modelId,
          prompt: payload.prompt,
          aspectRatio: payload.aspectRatio,
          resolution: payload.resolution,
          count: 1,
          imageUrls,
        },
        zh,
      );
      if (!res.ok) {
        showToast(res.message);
        if (res.needsLogin) signIn.onOpen();
        if (res.code === "INSUFFICIENT_CREDITS") creditsShortfall.report(res.message, res.requiredCredits);
        return;
      }

      const actionTag: Record<CanvasEditSubmit["action"], string> = {
        inpaint: zh ? "局部重绘" : "Inpaint",
        erase: zh ? "消除" : "Erase",
        outpaint: zh ? "扩图" : "Outpaint",
        cutout: zh ? "智能抠图" : "Cutout",
        upscale: zh ? `放大 ${payload.resolution}` : `Upscale ${payload.resolution}`,
        "text-edit": zh ? "文字重绘" : "Text Edit",
        animate: zh ? "图生视频" : "Animate",
      };

      commitHistory();
      const newId = `edit-${Date.now()}`;
      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          kind: "image",
          label: nextAlphaLabel(prev),
          name: `${actionTag[payload.action]} · @${sourceNode.label}`,
          url: "",
          prompt: payload.prompt,
          model: getMarketModel(payload.modelId)?.name ?? payload.modelId,
          resolution: payload.resolution,
          aspectRatio: payload.aspectRatio,
          x: sourceNode.x + sourceNode.width + 64,
          y: sourceNode.y,
          width: sourceNode.width,
          zIndex: maxZIndex(prev) + 1,
          status: "generating",
          jobUuid: res.uuid,
          safety: "allowed",
          createdAt: Date.now(),
        },
      ]);
      setEdges((prev) => [
        ...prev,
        { id: `edge-${Date.now()}`, fromId: sourceNode.id, toId: newId, kind: "edit", label: actionTag[payload.action] },
      ]);
      setSelectedIds([newId]);
      setEditModal(null);
      showToast(zh ? `${actionTag[payload.action]}任务已提交到画布` : `${actionTag[payload.action]} running on canvas`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh ? "编辑任务提交失败" : "Edit submission failed");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Multi-select horizontal layout alignment.
  const alignSelectedHorizontally = () => {
    if (selectedNodes.length < 2) return;
    commitHistory();
    const sorted = [...selectedNodes].sort((a, b) => a.x - b.x);
    const startX = sorted[0].x;
    const baseY = sorted[0].y;
    const nextPositions = new Map<string, { x: number; y: number }>();
    let cursorX = startX;
    for (const n of sorted) {
      nextPositions.set(n.id, { x: cursorX, y: baseY });
      cursorX += n.width + 32;
    }
    setNodes((prev) =>
      prev.map((n) => {
        const p = nextPositions.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      }),
    );
  };

  // Focus & smoothly center viewport on a specific node (used by ⌘K Search).
  const focusNode = useCallback((node: CanvasNode) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 960;
    const h = rect?.height ?? 620;
    const nodeH = node.height ?? 220;
    const nextScale = clamp(viewport.scale, 0.75, 1.15);
    setViewport({
      scale: nextScale,
      x: Math.round(w / 2 - (node.x + node.width / 2) * nextScale),
      y: Math.round(h * 0.44 - (node.y + nodeH / 2) * nextScale),
    });
    setSelectedIds([node.id]);
    setSearchOpen(false);
    setSearchQuery("");
  }, [viewport.scale]);

  // One-click full-canvas auto-arrange (Jimeng / infinite-canvas standard primitive).
  const autoArrangeNodes = useCallback(() => {
    const contentNodes = nodesRef.current.filter((n) => n.kind !== "group");
    if (contentNodes.length === 0) {
      showToast(zh ? "画布上还没有可整理的节点" : "No nodes to arrange yet");
      return;
    }
    commitHistory();
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(contentNodes.length))));
    const gapX = 44;
    const gapY = 48;
    const colWidths = Array.from({ length: cols }, () => 300);
    contentNodes.forEach((n, idx) => {
      const col = idx % cols;
      colWidths[col] = Math.max(colWidths[col], n.width);
    });
    const positions = new Map<string, { x: number; y: number }>();
    let curY = 80;
    for (let row = 0; row * cols < contentNodes.length; row += 1) {
      let curX = 96;
      let rowH = 220;
      for (let col = 0; col < cols; col += 1) {
        const item = contentNodes[row * cols + col];
        if (!item) break;
        positions.set(item.id, { x: curX, y: curY });
        curX += colWidths[col] + gapX;
        rowH = Math.max(rowH, item.height ?? (item.kind === "audio" ? 132 : item.kind === "text" ? 190 : 250));
      }
      curY += rowH + gapY;
    }
    setNodes((prev) =>
      prev.map((n) => {
        const p = positions.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      }),
    );
    showToast(zh ? `已自动整理 ${contentNodes.length} 个画布节点` : `Auto-arranged ${contentNodes.length} canvas nodes`);
  }, [commitHistory, showToast, zh]);

  // Higgsfield Canvas: load a curated multi-step workflow template onto the board.
  const loadBuiltinTemplate = useCallback((tpl: BuiltinWorkflowTemplate) => {
    commitHistory();
    const origin = worldCenter();
    const ts = Date.now();
    const groupId = `tpl-grp-${tpl.id}-${ts}`;
    const existing = nodesRef.current;
    let z = Math.max(2, maxZIndex(existing));
    const all = [...existing];
    const stepStride = 336;
    const newCards: CanvasTextNode[] = tpl.steps.map((step, idx) => {
      const card: CanvasTextNode = {
        id: `tpl-step-${tpl.id}-${ts}-${idx}`,
        kind: "text",
        label: nextAlphaLabel(all),
        name: zh ? step.titleZh : step.titleEn,
        title: zh ? step.titleZh : step.titleEn,
        content: zh ? step.contentZh : step.contentEn,
        tone: "storyboard",
        x: origin.x + idx * stepStride,
        y: origin.y + 48,
        width: 256,
        zIndex: ++z,
        status: "ready",
        createdAt: ts,
      };
      all.push(card);
      return card;
    });
    const group: CanvasGroupNode = {
      id: groupId,
      kind: "group",
      label: nextAlphaLabel(all),
      name: zh ? tpl.groupZh : tpl.groupEn,
      title: zh ? tpl.groupZh : tpl.groupEn,
      x: origin.x - 24,
      y: origin.y - 8,
      width: tpl.steps.length * stepStride - 32,
      height: 284,
      zIndex: 0,
      status: "ready",
      createdAt: ts,
    };
    const newEdges: CanvasEdge[] = tpl.steps.slice(0, -1).map((step, idx) => ({
      id: `tpl-edge-${ts}-${idx}`,
      fromId: newCards[idx].id,
      toId: newCards[idx + 1].id,
      kind: "story",
      label: zh ? (step.edgeZh ?? "下一步") : (step.edgeEn ?? "Next"),
    }));
    setNodes((prev) => [group, ...prev, ...newCards]);
    if (newEdges.length > 0) setEdges((prev) => [...prev, ...newEdges]);
    setTemplatesOpen(false);
    showToast(zh ? `已载入工作流模板「${tpl.zh}」` : `Loaded workflow template "${tpl.en}"`);
  }, [commitHistory, showToast, worldCenter, zh]);

  const saveCurrentAsTemplate = () => {
    if (nodes.length === 0) {
      showToast(zh ? "当前画布为空，无法保存模板" : "Canvas is empty — add nodes first");
      return;
    }
    const cleanName = templateName.trim() || projectTitle.trim() || (zh ? `自定义工作流 ${userTemplates.length + 1}` : `Custom Workflow ${userTemplates.length + 1}`);
    const cleaned = stripTransientForStorage({
      version: 2,
      title: cleanName,
      viewport,
      nodes,
      edges,
      sessions: [],
      activeSessionId: "",
      updatedAt: Date.now(),
    });
    const nextItem: UserCanvasTemplate = {
      id: `utpl-${Date.now()}`,
      name: cleanName,
      createdAt: Date.now(),
      nodes: cleaned.nodes,
      edges: cleaned.edges,
    };
    const nextList = [nextItem, ...userTemplates].slice(0, 12);
    setUserTemplates(nextList);
    setTemplateName("");
    try {
      localStorage.setItem(CANVAS_TEMPLATES_KEY, JSON.stringify(nextList));
    } catch {
      // Ignore quota errors.
    }
    showToast(zh ? `已保存工作流模板「${cleanName}」` : `Saved workflow template "${cleanName}"`);
  };

  const loadUserTemplate = (tpl: UserCanvasTemplate) => {
    commitHistory();
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setProjectTitle(tpl.name);
    setSelectedIds([]);
    setTemplatesOpen(false);
    showToast(zh ? `已恢复自定义模板「${tpl.name}」` : `Restored template "${tpl.name}"`);
  };

  const deleteUserTemplate = (id: string) => {
    const nextList = userTemplates.filter((item) => item.id !== id);
    setUserTemplates(nextList);
    try {
      localStorage.setItem(CANVAS_TEMPLATES_KEY, JSON.stringify(nextList));
    } catch {
      // Ignore storage errors.
    }
  };

  // Pollo Shots: 1-click Multi-Angle cinematic shot expansion from a single canvas image!
  const shotsSourceNode = shotsModalNodeId
    ? nodes.find((n): n is CanvasImageNode => n.id === shotsModalNodeId && n.kind === "image") ?? null
    : null;
  const shotsModel = getMarketModel(imageModelId) ?? IMAGE_MODELS[0];
  const singleShotCredits = useMemo(
    () =>
      shotsModel
        ? marketCredits(shotsModel, { prompt: "multi-angle shot", aspectRatio: imageAspect, resolution: shotsResolution, count: 1, imageUrls: ["ref"] })
        : 6,
    [shotsModel, imageAspect, shotsResolution],
  );

  const generateMultiAngleShots = async () => {
    if (!shotsSourceNode || selectedAngles.length === 0 || shotsSubmitting) return;
    if (!session) {
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }
    setShotsSubmitting(true);
    try {
      const baseRef = shotsSourceNode.file ? await uploadImage(shotsSourceNode.file) : shotsSourceNode.url;
      const chosen = CAMERA_ANGLES.filter((a) => selectedAngles.includes(a.id));
      commitHistory();
      const spawned: CanvasImageNode[] = [];
      const newEdges: CanvasEdge[] = [];
      for (let i = 0; i < chosen.length; i += 1) {
        const angle = chosen[i];
        const prompt = `${zh ? angle.promptZh : angle.promptEn}${shotsSourceNode.prompt ? `。${shotsSourceNode.prompt}` : ""}`;
        const res = await submitMedia(
          {
            model: shotsModel?.id ?? DEFAULT_IMAGE_MODEL,
            prompt,
            aspectRatio: shotsSourceNode.aspectRatio || imageAspect,
            resolution: shotsResolution,
            count: 1,
            imageUrls: [baseRef],
          },
          zh,
        );
        if (!res.ok) {
          showToast(res.message);
          if (res.needsLogin) signIn.onOpen();
          if (res.code === "INSUFFICIENT_CREDITS") creditsShortfall.report(res.message, res.requiredCredits);
          break;
        }
        const id = `shot-${angle.id}-${Date.now()}-${i}`;
        spawned.push({
          id,
          kind: "image",
          label: nextAlphaLabel([...nodesRef.current, ...spawned]),
          name: `${zh ? angle.zh : angle.en} · @${shotsSourceNode.label}`,
          url: "",
          prompt,
          model: shotsModel?.name ?? DEFAULT_IMAGE_MODEL,
          resolution: shotsResolution,
          aspectRatio: shotsSourceNode.aspectRatio || imageAspect,
          x: shotsSourceNode.x + shotsSourceNode.width + 88,
          y: shotsSourceNode.y + i * 268,
          width: 268,
          zIndex: maxZIndex(nodesRef.current) + i + 1,
          status: "generating",
          jobUuid: res.uuid,
          safety: "allowed",
          createdAt: Date.now(),
        });
        newEdges.push({
          id: `edge-shot-${Date.now()}-${i}`,
          fromId: shotsSourceNode.id,
          toId: id,
          kind: "edit",
          label: zh ? angle.zh : angle.en,
        });
      }
      if (spawned.length > 0) {
        setNodes((prev) => [...prev, ...spawned]);
        setEdges((prev) => [...prev, ...newEdges]);
        setSelectedIds(spawned.map((n) => n.id));
        setShotsModalNodeId(null);
        showToast(zh ? `已并发提交 ${spawned.length} 个机位分镜到画布` : `Spawned ${spawned.length} multi-angle shots on canvas`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : zh ? "多机位生成失败" : "Multi-angle generation failed");
    } finally {
      setShotsSubmitting(false);
    }
  };

  // Visual port-to-port Bezier edge wiring directly from node handles.
  const handlePortClick = (nodeId: string, side: "in" | "out", event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!connectFromId) {
      setConnectFromId(nodeId);
      setTool("connect");
      showToast(zh ? "请点击目标节点的左侧端口或卡片完成连线" : "Click a target node port to connect");
      return;
    }
    if (connectFromId === nodeId) {
      setConnectFromId(null);
      setTool("select");
      return;
    }
    const fromId = side === "in" ? connectFromId : nodeId;
    const toId = side === "in" ? nodeId : connectFromId;
    commitHistory();
    setEdges((prev) => {
      if (prev.some((e) => e.fromId === fromId && e.toId === toId)) return prev;
      return [...prev, { id: `edge-${Date.now()}`, fromId, toId, kind: "reference", label: zh ? "参考" : "Ref" }];
    });
    setConnectFromId(null);
    setTool("select");
    showToast(zh ? "已建立节点参考连线" : "Reference wire connected");
  };

  const filteredSearchNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => {
      const prompt = "prompt" in n && n.prompt ? n.prompt : "";
      const title = "title" in n && n.title ? n.title : "";
      const hay = `@${n.label} ${n.name} ${n.kind} ${prompt} ${title}`.toLowerCase();
      return hay.includes(q);
    });
  }, [nodes, searchQuery]);

  const minimapBounds = useMemo(() => {
    if (nodes.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const n of nodes) {
      const h = n.height ?? 210;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + h);
    }
    const pad = 160;
    const worldW = Math.max(600, maxX - minX + pad * 2);
    const worldH = Math.max(420, maxY - minY + pad * 2);
    return { minX: minX - pad, minY: minY - pad, worldW, worldH };
  }, [nodes]);

  // Pointer handlers for Infinite Canvas pan, marquee box-select, drag, resize.
  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === "hand" || spacePressed || event.button === 1) {
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      return;
    }

    if (tool === "connect") {
      setConnectFromId(null);
      return;
    }

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedIds([]);
    setMarquee({
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      curX: event.clientX - rect.left,
      curY: event.clientY - rect.top,
    });
  };

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current && panRef.current.pointerId === event.pointerId) {
      setViewport((prev) => ({
        ...prev,
        x: panRef.current!.originX + (event.clientX - panRef.current!.startX),
        y: panRef.current!.originY + (event.clientY - panRef.current!.startY),
      }));
      return;
    }
    if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
      const dx = (event.clientX - dragRef.current.startX) / viewport.scale;
      const dy = (event.clientY - dragRef.current.startY) / viewport.scale;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
      const origins = dragRef.current.origins;
      setNodes((prev) =>
        prev.map((n) => {
          const orig = origins.get(n.id);
          return orig ? { ...n, x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) } : n;
        }),
      );
      return;
    }
    if (resizeRef.current && resizeRef.current.pointerId === event.pointerId) {
      const dx = (event.clientX - resizeRef.current.startX) / viewport.scale;
      const dy = (event.clientY - resizeRef.current.startY) / viewport.scale;
      const { nodeId, originW, originH } = resizeRef.current;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          if (n.kind === "group") {
            return { ...n, width: clamp(Math.round(originW + dx), 240, 1800), height: clamp(Math.round(originH + dy), 180, 1200) };
          }
          return { ...n, width: clamp(Math.round(originW + dx), 180, 680) };
        }),
      );
      return;
    }
    if (marquee) {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMarquee((prev) =>
        prev ? { ...prev, curX: event.clientX - rect.left, curY: event.clientY - rect.top } : null,
      );
    }
  };

  const handleStagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
    if (marquee) {
      const x1 = Math.min(marquee.startX, marquee.curX);
      const y1 = Math.min(marquee.startY, marquee.curY);
      const x2 = Math.max(marquee.startX, marquee.curX);
      const y2 = Math.max(marquee.startY, marquee.curY);
      if (x2 - x1 > 8 || y2 - y1 > 8) {
        const wx1 = (x1 - viewport.x) / viewport.scale;
        const wy1 = (y1 - viewport.y) / viewport.scale;
        const wx2 = (x2 - viewport.x) / viewport.scale;
        const wy2 = (y2 - viewport.y) / viewport.scale;
        const hits = nodes
          .filter((n) => {
            if (n.kind === "group") return false;
            const nh = n.height ?? Math.round(n.width * 0.72) + 46;
            return n.x < wx2 && n.x + n.width > wx1 && n.y < wy2 && n.y + nh > wy1;
          })
          .map((n) => n.id);
        setSelectedIds(hits);
      }
      setMarquee(null);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) >= 40) {
      const nextScale = clamp(viewport.scale * (event.deltaY > 0 ? 0.91 : 1.1), 0.25, 3);
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const worldX = (cursorX - viewport.x) / viewport.scale;
      const worldY = (cursorY - viewport.y) / viewport.scale;
      setViewport({
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      });
    } else {
      setViewport((prev) => ({ ...prev, x: prev.x - event.deltaX, y: prev.y - event.deltaY }));
    }
  };

  const handleNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, node: CanvasNode) => {
    if ((event.target as HTMLElement).closest("button, input, textarea, video, audio, a")) return;
    event.stopPropagation();

    // Connect mode: click source node, then click target node to draw reference wire!
    if (tool === "connect") {
      if (!connectFromId) {
        setConnectFromId(node.id);
        showToast(zh ? `已选中起点 @${node.label}，请点击目标节点建立连线` : `Source @${node.label} picked. Click a target node to connect.`);
      } else if (connectFromId === node.id) {
        setConnectFromId(null);
      } else {
        commitHistory();
        setEdges((prev) => {
          if (prev.some((e) => e.fromId === connectFromId && e.toId === node.id)) return prev;
          return [...prev, { id: `edge-${Date.now()}`, fromId: connectFromId, toId: node.id, kind: "reference", label: zh ? "参考" : "Ref" }];
        });
        setConnectFromId(null);
        setTool("select");
        showToast(zh ? "已建立节点参考连线" : "Connected nodes");
      }
      return;
    }

    let nextSelected: string[];
    if (event.shiftKey) {
      nextSelected = selectedIds.includes(node.id)
        ? selectedIds.filter((id) => id !== node.id)
        : [...selectedIds, node.id];
    } else {
      nextSelected = selectedIds.includes(node.id) ? selectedIds : [node.id];
    }
    setSelectedIds(nextSelected);

    // Bring non-group node to front.
    if (node.kind !== "group") {
      const topZ = maxZIndex(nodes) + 1;
      setNodes((prev) => prev.map((item) => (item.id === node.id ? { ...item, zIndex: topZ } : item)));
    }

    if (tool === "hand" || spacePressed || node.locked) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const origins = new Map<string, { x: number; y: number }>();
    for (const id of nextSelected) {
      const target = nodes.find((n) => n.id === id);
      if (target && !target.locked) origins.set(id, { x: target.x, y: target.y });
    }
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origins, moved: false };
  };

  const fitAllNodes = () => {
    if (nodes.length === 0) {
      setViewport({ x: 120, y: 90, scale: 1 });
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...nodes.map((n) => n.y + (n.height ?? 260)));
    const bw = Math.max(200, maxX - minX + 120);
    const bh = Math.max(200, maxY - minY + 180);
    const scale = clamp(Math.min((rect.width - 140) / bw, (rect.height - 200) / bh), 0.3, 1.35);
    setViewport({
      scale,
      x: (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
      y: (rect.height - 100 - (maxY - minY) * scale) / 2 - minY * scale,
    });
  };

  // Multi-session Agent chat handler.
  const handleAgentSend = async () => {
    const instruction = agentInput.trim();
    if (!instruction || agentPlanning) return;
    if (!session) {
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }

    // Warn cleanly if user references @A when canvas has no assets yet.
    const mediaNodes = nodes.filter(
      (n): n is CanvasImageNode | CanvasVideoNode => (n.kind === "image" || n.kind === "video") && n.status === "ready",
    );
    if (/@[A-Z]\b/.test(instruction) && mediaNodes.length === 0) {
      setAgentError(zh ? "画布里还没有素材，请先上传、生成或从素材库拖入图片/视频，再用 @A 引用。" : "Add or upload an asset to the canvas before referencing @A.");
      return;
    }

    setAgentError(null);
    setAgentPlanning(true);
    const userMsgId = `u-${Date.now()}`;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: s.messages.length === 0 ? instruction.slice(0, 14) : s.title,
              messages: [...s.messages, { id: userMsgId, role: "user", text: instruction, createdAt: Date.now() }],
            }
          : s,
      ),
    );
    setAgentInput("");

    try {
      const formData = new FormData();
      formData.set("action", "plan");
      formData.set("instruction", instruction);
      formData.set("locale", locale);
      formData.set(
        "assets",
        JSON.stringify(mediaNodes.map(({ id, label, name, kind }) => ({ id, label, name, type: kind }))),
      );
      for (const item of mediaNodes) {
        for (const sample of item.samples ?? []) formData.append("visual", sample);
      }

      const response = await fetch("/api/v1/creative-space/agent", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(parseApiError(payload, zh ? "Agent 暂时不可用，请稍后重试" : "Agent unavailable, try again"));
      }
      const result = (
        payload as {
          data: { reply: string; generationPrompt: string; mentionedAssetIds: string[]; steps: AgentPlan["steps"] };
        }
      ).data;
      const plan: AgentPlan = {
        mentionedAssetIds: result.mentionedAssetIds,
        steps: result.steps,
        summary: result.reply,
        generationPrompt: result.generationPrompt,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  { id: `a-${Date.now()}`, role: "assistant", text: result.reply, plan, createdAt: Date.now() },
                ],
              }
            : s,
        ),
      );
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : zh ? "Agent 请求失败" : "Agent request failed");
    } finally {
      setAgentPlanning(false);
    }
  };

  // Turn an Agent storyboard into real Text Cards + Group on the Canvas!
  const dropStoryboardOnCanvas = (plan: AgentPlan) => {
    commitHistory();
    const origin = worldCenter();
    const groupId = `grp-story-${Date.now()}`;
    setNodes((prev) => {
      let z = maxZIndex(prev);
      const all = [...prev];
      const stepCards: CanvasTextNode[] = plan.steps.map((step, idx) => {
        const card: CanvasTextNode = {
          id: `story-${Date.now()}-${idx}`,
          kind: "text",
          label: nextAlphaLabel(all),
          name: step.title,
          title: `${idx + 1}. ${step.title}`,
          content: step.instruction,
          tone: "storyboard",
          x: origin.x + idx * 276,
          y: origin.y + 44,
          width: 250,
          zIndex: ++z,
          status: "ready",
          createdAt: Date.now(),
        };
        all.push(card);
        return card;
      });
      const group: CanvasGroupNode = {
        id: groupId,
        kind: "group",
        label: nextAlphaLabel(all),
        name: zh ? "Agent 分镜脚本" : "Agent Storyboard",
        title: zh ? `Agent 分镜（${stepCards.length} 镜）` : `Agent Storyboard (${stepCards.length} shots)`,
        x: origin.x - 24,
        y: origin.y - 12,
        width: Math.max(320, stepCards.length * 276 + 24),
        height: 280,
        zIndex: 0,
        status: "ready",
        createdAt: Date.now(),
      };
      // Connect sequential storyboard cards
      if (stepCards.length > 1) {
        setEdges((ePrev) => [
          ...ePrev,
          ...stepCards.slice(0, -1).map((card, i) => ({
            id: `edge-st-${Date.now()}-${i}`,
            fromId: card.id,
            toId: stepCards[i + 1].id,
            kind: "story" as const,
            label: `${i + 1}→${i + 2}`,
          })),
        ]);
      }
      return [group, ...all];
    });
    showToast(zh ? "分镜卡片已铺入画布" : "Storyboard cards dropped onto canvas");
  };

  // Execute an Agent plan directly into a live Video Node on the Canvas!
  const renderAgentPlanToCanvas = async (plan: AgentPlan) => {
    if (!session) {
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }
    const model = VIDEO_MODELS.find((m) => m.id === agentVideoModel) ?? VIDEO_MODELS[0];
    const duration = model.durations.includes(8) ? 8 : model.durations[0];
    const resolution = model.resolutions.includes("720p") ? "720p" : model.resolutions[0];

    try {
      const refCandidates = nodes
        .filter((n): n is CanvasImageNode => n.kind === "image" && n.status === "ready")
        .filter((n) => (plan.mentionedAssetIds.length ? plan.mentionedAssetIds.includes(n.id) : true))
        .slice(0, 3);
      const refKeys = await Promise.all(refCandidates.map(resolveImageRef));
      const data = await generateVideo({
        prompt: plan.generationPrompt,
        model: model.id,
        duration,
        aspectRatio: "16:9",
        quality: resolution,
        imageUrl: refKeys.length === 1 ? refKeys[0] : undefined,
        imageUrls: refKeys.length > 1 ? refKeys : undefined,
        generateAudio: model.audio,
      });
      commitHistory();
      const pos = worldCenter();
      const newId = `agent-vid-${Date.now()}`;
      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          kind: "video",
          label: nextAlphaLabel(prev),
          name: `${model.name} · Agent`,
          url: "",
          prompt: plan.generationPrompt,
          model: model.name,
          duration,
          resolution,
          x: pos.x,
          y: pos.y,
          width: 340,
          zIndex: maxZIndex(prev) + 1,
          status: "generating",
          jobUuid: data.videoUuid,
          safety: "allowed",
          createdAt: Date.now(),
        },
      ]);
      if (refCandidates.length > 0) {
        setEdges((prev) => [
          ...prev,
          ...refCandidates.map((r, i) => ({
            id: `edge-ag-${Date.now()}-${i}`,
            fromId: r.id,
            toId: newId,
            kind: "animate" as const,
            label: "Agent",
          })),
        ]);
      }
      setSelectedIds([newId]);
      showToast(zh ? `已用 ${model.name} 提交分镜视频到画布` : `Rendering storyboard with ${model.name}`);
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : zh ? "视频生成失败" : "Video generation failed");
    }
  };

  const agentPlanCredits = useMemo(() => {
    const model = VIDEO_MODELS.find((m) => m.id === agentVideoModel) ?? VIDEO_MODELS[0];
    const duration = model.durations.includes(8) ? 8 : model.durations[0];
    const resolution = model.resolutions.includes("720p") ? "720p" : model.resolutions[0];
    return estimateCredits({ modelId: model.id, duration, resolution });
  }, [agentVideoModel]);

  const activeEditNode = editModal
    ? nodes.find((n): n is CanvasImageNode => n.id === editModal.nodeId && n.kind === "image") ?? null
    : null;

  // Parent image for Before/After comparison slider (if an image node was derived from another image)
  const singleSelectedParentImage = useMemo(() => {
    if (!singleSelected || singleSelected.kind !== "image" || singleSelected.status !== "ready") return null;
    const incoming = edges.find((e) => e.toId === singleSelected.id);
    if (!incoming) return null;
    const parent = nodes.find((n): n is CanvasImageNode => n.id === incoming.fromId && n.kind === "image" && n.status === "ready");
    return parent ?? null;
  }, [singleSelected, edges, nodes]);

  // 1-click visual demo board using real local studio media (for instant pro first impression)
  const loadCinematicDemoBoard = () => {
    commitHistory();
    const now = Date.now();
    const groupId = `demo-grp-${now}`;
    const imgAId = `demo-img-a-${now}`;
    const imgBId = `demo-img-b-${now}`;
    const vidCId = `demo-vid-c-${now}`;
    const noteDId = `demo-note-d-${now}`;

    const demoNodes: CanvasNode[] = [
      {
        id: groupId,
        kind: "group",
        label: "G",
        name: zh ? "霓虹雨夜广告分镜组" : "Neon Rain Commercial Board",
        title: zh ? "霓虹雨夜 · 品牌电影分镜" : "Neon Rain · Brand Film Storyboard",
        x: 72,
        y: 52,
        width: 1090,
        height: 560,
        zIndex: 0,
        status: "ready",
        createdAt: now,
      },
      {
        id: imgAId,
        kind: "image",
        label: "A",
        name: zh ? "开场锚点帧 · 雨夜街景" : "Hero Frame · Rain Street",
        url: "/home/samples/rain-couple.webp",
        prompt: zh ? "霓虹雨夜东京街头电影感中景，湿润反光柏油路面，浅景深" : "Neon Tokyo rain street cinematic medium shot, wet reflections, shallow DOF",
        model: "Nano Banana 2",
        resolution: "2K",
        aspectRatio: "16:9",
        x: 102,
        y: 112,
        width: 268,
        zIndex: 2,
        status: "ready",
        safety: "allowed",
        createdAt: now,
      },
      {
        id: imgBId,
        kind: "image",
        label: "B",
        name: zh ? "重绘变体 · 星云氛围升级" : "Style Relight · Cosmic Mood",
        url: "/home/samples/cosmic-bloom.webp",
        prompt: zh ? "保持构图节奏，注入青蓝色星云体积光与电影调色" : "Keep framing rhythm, infuse cyan-blue volumetric bloom and film grading",
        model: "Nano Banana Pro",
        resolution: "4K",
        aspectRatio: "16:9",
        x: 424,
        y: 112,
        width: 268,
        zIndex: 3,
        status: "ready",
        safety: "allowed",
        createdAt: now,
      },
      {
        id: vidCId,
        kind: "video",
        label: "C",
        name: zh ? "图生视频成片 · 6s 推镜" : "I2V Render · 6s Push-In",
        url: "/home/example-japan-6s.mp4",
        prompt: zh ? "镜头缓慢推近，雨丝飘落，霓虹倒影微微晃动，电影配乐" : "Slow cinematic push-in, rain falling, shimmering neon reflections",
        model: "Seedance 2.0",
        duration: 6,
        resolution: "1080p",
        x: 752,
        y: 112,
        width: 312,
        zIndex: 4,
        status: "ready",
        safety: "allowed",
        createdAt: now,
      },
      {
        id: noteDId,
        kind: "text",
        label: "D",
        name: zh ? "导演剪辑备忘" : "Director Cut Note",
        title: zh ? "试一试：选中 @B 点击「前后对比」" : "Try: Select @B → Compare Before/After",
        content: zh
          ? "1. 点击任意图片卡片顶部工具条可局部重绘、扩图、抠图或生成多机位分镜。\n2. 选中 @B 后点击顶部「前后对比」可左右拖动查看原图与变体差异。\n3. 在右侧 Agent 输入 @A @B 可自动拆解完整广告分镜。"
          : "1. Select any image card for Inpaint, Outpaint, Cutout, or Multi-Angle Shots.\n2. Select @B and click Compare to drag the Before/After divider.\n3. Mention @A @B in the right Agent to draft full commercial storyboards.",
        tone: "storyboard",
        x: 102,
        y: 446,
        width: 610,
        zIndex: 5,
        status: "ready",
        createdAt: now,
      },
    ];

    const demoEdges: CanvasEdge[] = [
      { id: `demo-e1-${now}`, fromId: imgAId, toId: imgBId, kind: "edit", label: zh ? "重绘 / 4K" : "Relight / 4K" },
      { id: `demo-e2-${now}`, fromId: imgBId, toId: vidCId, kind: "animate", label: zh ? "图生视频" : "I2V 6s" },
    ];

    setNodes(demoNodes);
    setEdges(demoEdges);
    setSelectedIds([imgBId]);
    setViewport({ x: 30, y: 18, scale: 0.78 });
    showToast(zh ? "已载入电影样板画布，选中 @B 可直接体验前后对比与后编辑" : "Loaded cinematic sample board — select @B to try Compare & edits");
  };

  // Add assets picked from shared HomeMediaPicker (@元素 / 品牌工具箱 / 我的作品)
  const handlePickedElements = (picked: PickerAsset[]) => {
    if (picked.length === 0) return;
    commitHistory();
    const origin = worldCenter();
    const addedIds: string[] = [];
    setNodes((prev) => {
      let z = maxZIndex(prev);
      const next = [...prev];
      picked.forEach((asset, index) => {
        const isVideo = asset.mimeType.startsWith("video/");
        const id = `pick-${isVideo ? "video" : "image"}-${Date.now()}-${index}`;
        addedIds.push(id);
        const label = nextAlphaLabel(next);
        if (isVideo) {
          next.push({
            id,
            kind: "video",
            label,
            name: asset.name || (zh ? "素材视频" : "Picked Video"),
            url: asset.url,
            x: origin.x + index * 320,
            y: origin.y,
            width: 320,
            zIndex: ++z,
            status: "ready",
            safety: "allowed",
            createdAt: Date.now(),
          });
        } else {
          next.push({
            id,
            kind: "image",
            label,
            name: asset.name || (zh ? "元素素材" : "Element Asset"),
            url: asset.url,
            storageKey: asset.key,
            file: asset.file,
            x: origin.x + index * 290,
            y: origin.y,
            width: 268,
            zIndex: ++z,
            status: "ready",
            safety: "allowed",
            createdAt: Date.now(),
          });
        }
      });
      return next;
    });
    if (addedIds.length > 0) setSelectedIds(addedIds);
    showToast(zh ? `已将 ${picked.length} 项 @元素 加入画布并设为参考` : `Added ${picked.length} element(s) to canvas as reference`);
  };

  return (
    <div className="cc-root">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
        aria-label={zh ? "上传图片或视频素材" : "Upload image or video assets"}
      />

      {/* Slim Single Floating Studio Top Bar (6 essential controls) */}
      <div className="cc-topbar">
        <div className="cc-topbar-left">
          <Link
            href={localizedHref(locale, "/creative-space")}
            className="cc-back-link"
            title={zh ? "返回创意空间" : "Back to Creative Space"}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{zh ? "返回" : "Back"}</span>
          </Link>
          {modeSlot ?? (
            <span className="cc-badge-brand">
              <Sparkles className="h-3.5 w-3.5" />
              {zh ? "无限画布" : "Infinite Canvas"}
            </span>
          )}
          <span className="cc-divider hidden sm:inline-block" />
          <input
            type="text"
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.target.value)}
            aria-label={zh ? "画布项目名称" : "Canvas project name"}
            className="cc-project-input"
          />
        </div>

        <div className="cc-topbar-center">
          <button
            type="button"
            className="cc-icon-btn"
            disabled={past.length === 0}
            onClick={undo}
            title={zh ? "撤销 (⌘Z)" : "Undo (⌘Z)"}
            aria-label={zh ? "撤销" : "Undo"}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="cc-icon-btn"
            disabled={future.length === 0}
            onClick={redo}
            title={zh ? "重做 (⌘⇧Z)" : "Redo (⌘⇧Z)"}
            aria-label={zh ? "重做" : "Redo"}
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        <div className="cc-topbar-right">
          <button
            type="button"
            className={`cc-icon-btn${templatesOpen ? " cc-icon-btn-on" : ""}`}
            onClick={() => {
              setTemplatesOpen((v) => !v);
              setSearchOpen(false);
              setShortcutsOpen(false);
            }}
            title={zh ? "工作流模板库（保存/载入）" : "Workflow templates"}
          >
            <Bookmark className="h-4 w-4" />
            <span className="hidden md:inline">{zh ? "模板" : "Templates"}</span>
          </button>
          <button
            type="button"
            className={`cc-icon-btn${libraryOpen ? " cc-icon-btn-on" : ""}`}
            onClick={() => setLibraryOpen((v) => !v)}
          >
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{zh ? "资产库" : "Assets"}</span>
          </button>
          <button
            type="button"
            className={`cc-icon-btn${agentOpen ? " cc-icon-btn-on" : ""}`}
            onClick={() => setAgentOpen((v) => !v)}
          >
            {agentOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">{zh ? "设计 Agent" : "Agent"}</span>
          </button>
        </div>
      </div>

      {toast ? <output className="cc-toast">{toast}</output> : null}

      <div className="cc-workspace">
        {/* Infinite Canvas Stage */}
        <div
          ref={stageRef}
          className={`cc-stage${tool === "hand" || spacePressed ? " cc-stage-hand" : ""}${tool === "connect" ? " cc-stage-connect" : ""}`}
          style={{
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            backgroundSize: `${Math.max(12, Math.round(24 * viewport.scale))}px ${Math.max(12, Math.round(24 * viewport.scale))}px`,
          }}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          onWheel={handleWheel}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnStage}
        >
          {/* Floating Left Tool Dock (ByteDance Dreamina style) */}
          <div className="cc-dock-left" role="toolbar" aria-label={zh ? "画布工具栏" : "Canvas tools"}>
            <button
              type="button"
              className={`cc-dock-btn${tool === "select" ? " cc-dock-btn-on" : ""}`}
              onClick={() => {
                setTool("select");
                setConnectFromId(null);
              }}
              title={zh ? "选择 / 框选 (V)" : "Select (V)"}
            >
              <MousePointer2 className="h-4 w-4" />
              <span>{zh ? "选择" : "Select"}</span>
            </button>
            <button
              type="button"
              className={`cc-dock-btn${tool === "hand" ? " cc-dock-btn-on" : ""}`}
              onClick={() => {
                setTool("hand");
                setConnectFromId(null);
              }}
              title={zh ? "平移画布 (H / 空格)" : "Pan (H / Space)"}
            >
              <Hand className="h-4 w-4" />
              <span>{zh ? "抓手" : "Hand"}</span>
            </button>
            <button
              type="button"
              className={`cc-dock-btn${tool === "connect" ? " cc-dock-btn-on" : ""}`}
              onClick={() => {
                setTool((cur) => (cur === "connect" ? "select" : "connect"));
                setConnectFromId(null);
              }}
              title={zh ? "节点参考连线" : "Connect reference wire"}
            >
              <Link2 className="h-4 w-4" />
              <span>{zh ? "连线" : "Link"}</span>
            </button>

            <span className="cc-dock-sep" />

            <button
              type="button"
              className={`cc-dock-btn${composerKind === "image" ? " cc-dock-btn-on" : ""}`}
              onClick={() => setComposerKind("image")}
              title={zh ? "画布生图" : "Generate Image"}
            >
              <ImageIcon className="h-4 w-4" />
              <span>{zh ? "生图" : "Image"}</span>
            </button>
            <button
              type="button"
              className={`cc-dock-btn${composerKind === "video" ? " cc-dock-btn-on" : ""}`}
              onClick={() => setComposerKind("video")}
              title={zh ? "画布生视频" : "Generate Video"}
            >
              <Film className="h-4 w-4" />
              <span>{zh ? "视频" : "Video"}</span>
            </button>
            <button
              type="button"
              className={`cc-dock-btn${composerKind === "audio" ? " cc-dock-btn-on" : ""}`}
              onClick={() => setComposerKind("audio")}
              title={zh ? "画布配音 / 音乐" : "Generate Audio"}
            >
              <Music className="h-4 w-4" />
              <span>{zh ? "音频" : "Audio"}</span>
            </button>

            <span className="cc-dock-sep" />

            <button
              type="button"
              className="cc-dock-btn"
              onClick={() => spawnTextNode()}
              title={zh ? "添加文字 / 分镜便签" : "Add Text Note"}
            >
              <StickyNote className="h-4 w-4" />
              <span>{zh ? "便签" : "Note"}</span>
            </button>
            <button
              type="button"
              className="cc-dock-btn"
              onClick={() => spawnGroupNode(selectedNodes.length > 0)}
              title={zh ? "添加场景分组框" : "Add Group Frame"}
            >
              <Frame className="h-4 w-4" />
              <span>{zh ? "分组" : "Group"}</span>
            </button>
            <button
              type="button"
              className="cc-dock-btn"
              onClick={() => fileInputRef.current?.click()}
              title={zh ? "上传本地图片/视频" : "Upload media"}
            >
              <Upload className="h-4 w-4" />
              <span>{zh ? "上传" : "Upload"}</span>
            </button>
          </div>

          {/* Slide-out Asset Library Drawer */}
          {libraryOpen ? (
            <aside className="cc-library-drawer" aria-label={zh ? "我的作品资产库" : "Asset library"}>
              <div className="cc-drawer-head">
                <span>{zh ? "画布资产库" : "Asset Library"}</span>
                <button type="button" className="cc-icon-btn" onClick={() => setLibraryOpen(false)} aria-label={zh ? "关闭" : "Close"}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="cc-drawer-body">
                <button type="button" className="cc-primary-btn w-full mb-3" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {zh ? "上传本地图片 / 视频" : "Upload Local Media"}
                </button>
                {!session ? (
                  <div className="cc-local-box">
                    <p className="cc-hint">{zh ? "登录后可直接把你在图片/视频工作室生成的作品拖入画布。" : "Sign in to pull your generated images & videos onto this canvas."}</p>
                    <button type="button" className="cc-secondary-btn" onClick={() => signIn.onOpen()}>
                      {zh ? "立即登录" : "Sign in"}
                    </button>
                  </div>
                ) : libraryLoading ? (
                  <p className="cc-hint">{zh ? "正在加载你的作品…" : "Loading your creations…"}</p>
                ) : libraryItems.length === 0 ? (
                  <p className="cc-hint">{zh ? "还没有历史作品，直接在下方输入提示词即可在画布上生成。" : "No saved creations yet. Generate directly from the bar below."}</p>
                ) : (
                  <div className="cc-lib-grid">
                    {libraryItems.map((entry) => (
                      <button key={entry.uuid} type="button" className="cc-lib-item" onClick={() => addFromLibrary(entry)}>
                        {entry.kind === "video" ? (
                          <video src={entry.url} muted className="cc-lib-thumb" />
                        ) : (
                          <img src={entry.url} alt="" className="cc-lib-thumb" loading="lazy" />
                        )}
                        <span className="cc-lib-cap">{entry.prompt || entry.model || entry.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          {/* Contextual Floating Post-Edit Toolbar (Dreamina signature!) */}
          {singleSelected && singleSelected.kind === "image" && singleSelected.status === "ready" ? (
            <div className="cc-context-bar" role="toolbar" aria-label={zh ? "图片后编辑工具" : "Image edit tools"}>
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-accent"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "inpaint" })}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                {zh ? "局部重绘" : "Inpaint"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "outpaint" })}
              >
                <Expand className="h-3.5 w-3.5" />
                {zh ? "一键扩图" : "Outpaint"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "erase" })}
              >
                <Eraser className="h-3.5 w-3.5" />
                {zh ? "消除" : "Erase"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "cutout" })}
              >
                <Scissors className="h-3.5 w-3.5" />
                {zh ? "抠图" : "Cutout"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "upscale" })}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {zh ? "高清" : "HD"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "text-edit" })}
              >
                <Type className="h-3.5 w-3.5" />
                {zh ? "文字重绘" : "Text"}
              </button>
              <span className="cc-divider" />
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-accent"
                onClick={() => setShotsModalNodeId(singleSelected.id)}
              >
                <Clapperboard className="h-3.5 w-3.5" />
                {zh ? "多机位分镜" : "Multi-Angle"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-accent"
                onClick={() => setEditModal({ nodeId: singleSelected.id, action: "animate" })}
              >
                <Film className="h-3.5 w-3.5" />
                {zh ? "图生视频" : "Animate"}
              </button>
              {singleSelectedParentImage ? (
                <button
                  type="button"
                  className="cc-ctx-btn cc-ctx-btn-accent"
                  onClick={() => {
                    setCompareSplit(50);
                    setComparePair({
                      beforeUrl: singleSelectedParentImage.url,
                      afterUrl: singleSelected.url,
                      beforeLabel: `@${singleSelectedParentImage.label} ${singleSelectedParentImage.name}`,
                      afterLabel: `@${singleSelected.label} ${singleSelected.name}`,
                    });
                  }}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5" />
                  {zh ? "前后对比" : "Compare"}
                </button>
              ) : null}
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => {
                  setAgentOpen(true);
                  setAgentInput((cur) => `${cur}${cur.trim() ? " " : ""}@${singleSelected.label} `);
                }}
              >
                <AtSign className="h-3.5 w-3.5" />
                {zh ? "发给 Agent" : "Ask Agent"}
              </button>
              <a
                href={singleSelected.url}
                download={`${singleSelected.label}.png`}
                target="_blank"
                rel="noreferrer"
                className="cc-ctx-btn"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-danger"
                onClick={() => {
                  commitHistory();
                  setNodes((prev) => prev.filter((n) => n.id !== singleSelected.id));
                  setEdges((prev) => prev.filter((e) => e.fromId !== singleSelected.id && e.toId !== singleSelected.id));
                  setSelectedIds([]);
                }}
                aria-label={zh ? "删除" : "Delete"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {singleSelected && singleSelected.kind === "video" && singleSelected.status === "ready" ? (
            <div className="cc-context-bar" role="toolbar" aria-label={zh ? "视频操作工具" : "Video node tools"}>
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-accent"
                onClick={() => extractVideoFrame(singleSelected)}
              >
                <Camera className="h-3.5 w-3.5" />
                {zh ? "截取当前帧到画布" : "Extract Frame to Canvas"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn"
                onClick={() => {
                  setAgentOpen(true);
                  setAgentInput((cur) => `${cur}${cur.trim() ? " " : ""}@${singleSelected.label} `);
                }}
              >
                <AtSign className="h-3.5 w-3.5" />
                {zh ? "引用到 Agent" : "Mention in Agent"}
              </button>
              <a
                href={singleSelected.url}
                download={`${singleSelected.label}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="cc-ctx-btn"
              >
                <Download className="h-3.5 w-3.5" />
                {zh ? "下载" : "Download"}
              </a>
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-danger"
                onClick={() => {
                  commitHistory();
                  setNodes((prev) => prev.filter((n) => n.id !== singleSelected.id));
                  setEdges((prev) => prev.filter((e) => e.fromId !== singleSelected.id && e.toId !== singleSelected.id));
                  setSelectedIds([]);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {/* Multi-Select Toolbar (Fusion / Multi-Ref Video / Group / Align) */}
          {selectedNodes.length >= 2 ? (
            <div className="cc-context-bar" role="toolbar" aria-label={zh ? "多选操作" : "Multi-selection tools"}>
              <span className="cc-pill">{zh ? `已选 ${selectedNodes.length} 项` : `${selectedNodes.length} selected`}</span>
              {selectedImages.length >= 2 ? (
                <>
                  <button
                    type="button"
                    className="cc-ctx-btn cc-ctx-btn-accent"
                    onClick={() => {
                      setComposerKind("image");
                      setComposerPrompt(
                        zh
                          ? `融合 ${selectedImages.map((n) => `@${n.label}`).join(" 和 ")} 的主体与风格，生成一张电影级海报大片`
                          : `Fuse the subjects and visual style of ${selectedImages.map((n) => `@${n.label}`).join(" and ")} into one cohesive cinematic visual`,
                      );
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {zh ? "多图融合生图" : "Multi-Image Fusion"}
                  </button>
                  <button
                    type="button"
                    className="cc-ctx-btn cc-ctx-btn-accent"
                    onClick={() => {
                      setComposerKind("video");
                      setVideoModelId("kling/v4-reference-to-video");
                      setComposerPrompt(
                        zh
                          ? `参考 ${selectedImages.map((n) => `@${n.label}`).join("、")} 保持角色与场景一致，生成流畅的电影短片`
                          : `Keep character and style consistent across ${selectedImages.map((n) => `@${n.label}`).join(", ")} in a smooth cinematic sequence`,
                      );
                    }}
                  >
                    <Film className="h-3.5 w-3.5" />
                    {zh ? "多图参考生视频" : "Multi-Ref Video"}
                  </button>
                  {selectedImages.length === 2 ? (
                    <button
                      type="button"
                      className="cc-ctx-btn"
                      onClick={() => {
                        setCompareSplit(50);
                        setComparePair({
                          beforeUrl: selectedImages[0].url,
                          afterUrl: selectedImages[1].url,
                          beforeLabel: `@${selectedImages[0].label} ${selectedImages[0].name}`,
                          afterLabel: `@${selectedImages[1].label} ${selectedImages[1].name}`,
                        });
                      }}
                    >
                      <SplitSquareHorizontal className="h-3.5 w-3.5" />
                      {zh ? "双图对比" : "Compare"}
                    </button>
                  ) : null}
                </>
              ) : null}
              <button type="button" className="cc-ctx-btn" onClick={() => spawnGroupNode(true)}>
                <Layers className="h-3.5 w-3.5" />
                {zh ? "打组" : "Group"}
              </button>
              <button type="button" className="cc-ctx-btn" onClick={alignSelectedHorizontally}>
                <AlignCenterHorizontal className="h-3.5 w-3.5" />
                {zh ? "横排对齐" : "Align Row"}
              </button>
              <button
                type="button"
                className="cc-ctx-btn cc-ctx-btn-danger"
                onClick={() => {
                  commitHistory();
                  const del = new Set(selectedIds);
                  setNodes((prev) => prev.filter((n) => !del.has(n.id)));
                  setEdges((prev) => prev.filter((e) => !del.has(e.fromId) && !del.has(e.toId)));
                  setSelectedIds([]);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {zh ? "删除" : "Delete"}
              </button>
            </div>
          ) : null}

          {/* Empty Canvas Onboarding — Visual Sample Strip + 1-Click Cinematic Demo Board */}
          {nodes.length === 0 ? (
            <div className="cc-empty">
              <div className="cc-empty-preview" aria-hidden="true">
                <div className="cc-empty-preview-card">
                  <img src="/home/samples/rain-couple.webp" alt="" />
                </div>
                <div className="cc-empty-preview-card">
                  <img src="/home/samples/mech-warrior.webp" alt="" />
                </div>
                <div className="cc-empty-preview-card">
                  <img src="/home/samples/cosmic-bloom.webp" alt="" />
                </div>
              </div>
              <div className="cc-empty-title">{zh ? "无限多模态创意画布" : "Infinite Multimodal Canvas"}</div>
              <p className="cc-empty-sub">
                {zh
                  ? "像即梦画布一样自由排版：直接在下方生图 / 生视频 / 配音，拖入素材后支持局部重绘、扩图、抠图、多机位分镜与前后对比。"
                  : "Generate images, videos, and audio on an infinite board with Inpaint, Outpaint, Cutout, Multi-Angle Shots, and Before/After Compare."}
              </p>
              <div className="cc-empty-actions">
                <button type="button" className="cc-primary-btn" onClick={loadCinematicDemoBoard}>
                  <Play className="h-4 w-4" />
                  {zh ? "体验电影样板画布" : "Explore Sample Board"}
                </button>
                <button type="button" className="cc-secondary-btn" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {zh ? "上传素材" : "Upload Media"}
                </button>
                <button type="button" className="cc-secondary-btn" onClick={() => setElementPickerOpen(true)}>
                  <AtSign className="h-4 w-4" />
                  {zh ? "@元素 / 作品" : "@Elements"}
                </button>
                <button type="button" className="cc-secondary-btn" onClick={() => setTemplatesOpen(true)}>
                  <Bookmark className="h-4 w-4" />
                  {zh ? "工作流模板" : "Templates"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Transformed Infinite World Layer */}
          <div
            className="cc-world"
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
          >
            {/* SVG Bezier Edge Wires */}
            {showEdges ? (
              <svg className="cc-edges-svg" aria-hidden="true">
                {edges.map((edge) => {
                  const src = nodes.find((n) => n.id === edge.fromId);
                  const dst = nodes.find((n) => n.id === edge.toId);
                  if (!src || !dst) return null;
                  const p1 = nodeAnchor(src, "right");
                  const p2 = nodeAnchor(dst, "left");
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2 - 8;
                  return (
                    <g key={edge.id}>
                      <path d={bezierPath(p1, p2)} className="cc-edge-path" />
                      {edge.label ? (
                        <text x={midX} y={midY} textAnchor="middle" className="cc-edge-label">
                          {edge.label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            ) : null}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedIds.includes(node.id);
              const isConnectSource = connectFromId === node.id;

              if (node.kind === "group") {
                return (
                  <div
                    key={node.id}
                    className={`cc-node cc-node-group${isSelected ? " cc-node-selected" : ""}`}
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.zIndex }}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                  >
                    <div className="cc-group-head">
                      <input
                        type="text"
                        value={node.title}
                        onChange={(event) =>
                          setNodes((prev) =>
                            prev.map((n) => (n.id === node.id && n.kind === "group" ? { ...n, title: event.target.value } : n)),
                          )
                        }
                        className="cc-group-title"
                      />
                      <button
                        type="button"
                        className="cc-icon-btn"
                        onClick={() => {
                          commitHistory();
                          setNodes((prev) => prev.filter((n) => n.id !== node.id));
                        }}
                        aria-label={zh ? "删除分组" : "Delete group"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div
                      className="cc-resize-handle"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        resizeRef.current = {
                          pointerId: e.pointerId,
                          nodeId: node.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          originW: node.width,
                          originH: node.height,
                        };
                      }}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  className={`cc-node${isSelected ? " cc-node-selected" : ""}${isConnectSource ? " cc-node-connect-src" : ""}`}
                  style={{ left: node.x, top: node.y, width: node.width, zIndex: Math.max(2, node.zIndex) }}
                  onPointerDown={(e) => handleNodePointerDown(e, node)}
                >
                  <div className="cc-node-head">
                    <span className="cc-node-tag">@{node.label}</span>
                    <span className="cc-node-meta">{node.name}</span>
                    {node.kind === "image" && node.resolution ? (
                      <span className="cc-node-meta" style={{ flex: "none" }}>{node.resolution}</span>
                    ) : null}
                    <button
                      type="button"
                      className="cc-icon-btn"
                      style={{ minWidth: 24, height: 24, padding: 0 }}
                      title={zh ? "复制节点" : "Duplicate"}
                      onClick={() => {
                        commitHistory();
                        setNodes((prev) => {
                          const copyNode: CanvasNode = {
                            ...node,
                            id: `${node.kind}-${Date.now()}`,
                            label: nextAlphaLabel(prev),
                            x: node.x + 32,
                            y: node.y + 32,
                            zIndex: maxZIndex(prev) + 1,
                            createdAt: Date.now(),
                          };
                          setSelectedIds([copyNode.id]);
                          return [...prev, copyNode];
                        });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>

                  {node.status === "generating" ? (
                    <div className="cc-node-generating">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>{zh ? "AI 正在画布中生成…" : "Generating on canvas…"}</span>
                      {node.prompt ? <span className="cc-hint line-clamp-2">{node.prompt}</span> : null}
                    </div>
                  ) : node.status === "failed" ? (
                    <div className="cc-node-generating">
                      <span className="cc-error">{node.error || (zh ? "生成失败，积分已退回" : "Failed, credits refunded")}</span>
                    </div>
                  ) : node.kind === "image" ? (
                    <div className="cc-node-media">
                      <img src={node.url} alt={node.name} className="cc-node-img" draggable={false} />
                    </div>
                  ) : node.kind === "video" ? (
                    <div className="cc-node-media">
                      <video
                        data-node-id={node.id}
                        src={node.url}
                        controls
                        playsInline
                        crossOrigin="anonymous"
                        className="cc-node-video"
                      />
                    </div>
                  ) : node.kind === "audio" ? (
                    <div className="cc-node-audio">
                      {node.prompt ? <p className="cc-hint line-clamp-2">{node.prompt}</p> : null}
                      <audio controls src={node.url} />
                    </div>
                  ) : (
                    <div className="cc-node-text-body">
                      <input
                        type="text"
                        value={node.title}
                        onChange={(event) =>
                          setNodes((prev) =>
                            prev.map((n) => (n.id === node.id && n.kind === "text" ? { ...n, title: event.target.value } : n)),
                          )
                        }
                        className="cc-node-text-title"
                      />
                      <textarea
                        value={node.content}
                        onChange={(event) =>
                          setNodes((prev) =>
                            prev.map((n) => (n.id === node.id && n.kind === "text" ? { ...n, content: event.target.value } : n)),
                          )
                        }
                        placeholder={zh ? "记录分镜描述、风格参考或台词…" : "Write storyboard notes, style cues, or script…"}
                        className="cc-node-text-area"
                      />
                    </div>
                  )}

                  {/* Visual Input / Output Connection Ports */}
                  <button
                    type="button"
                    className="cc-port cc-port-in"
                    title={zh ? "参考输入端口" : "Reference input port"}
                    aria-label={zh ? "输入端口" : "Input port"}
                    onPointerDown={(e) => handlePortClick(node.id, "in", e)}
                  />
                  <button
                    type="button"
                    className="cc-port cc-port-out"
                    title={zh ? "点击连线到下一个节点" : "Connect to another node"}
                    aria-label={zh ? "输出端口" : "Output port"}
                    onPointerDown={(e) => handlePortClick(node.id, "out", e)}
                  />
                  <div
                    className="cc-resize-handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      resizeRef.current = {
                        pointerId: e.pointerId,
                        nodeId: node.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        originW: node.width,
                        originH: node.height ?? 240,
                      };
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Live Interactive Minimap (bottom-right) */}
          {showMinimap && minimapBounds ? (
            <div
              className="cc-minimap"
              aria-label={zh ? "画布小地图" : "Canvas minimap"}
              onPointerDown={(e) => {
                e.stopPropagation();
                const box = e.currentTarget.getBoundingClientRect();
                const ratioX = (e.clientX - box.left) / box.width;
                const ratioY = (e.clientY - box.top) / box.height;
                const targetWorldX = minimapBounds.minX + ratioX * minimapBounds.worldW;
                const targetWorldY = minimapBounds.minY + ratioY * minimapBounds.worldH;
                const stageRect = stageRef.current?.getBoundingClientRect();
                const sw = stageRect?.width ?? 960;
                const sh = stageRect?.height ?? 620;
                setViewport((v) => ({
                  ...v,
                  x: Math.round(sw / 2 - targetWorldX * v.scale),
                  y: Math.round(sh / 2 - targetWorldY * v.scale),
                }));
              }}
            >
              <div className="cc-minimap-label">
                <span>{zh ? "画布导航" : "Minimap"}</span>
                <span>{nodes.length}</span>
              </div>
              <div className="cc-minimap-board">
                {nodes.map((n) => {
                  const leftPct = ((n.x - minimapBounds.minX) / minimapBounds.worldW) * 100;
                  const topPct = ((n.y - minimapBounds.minY) / minimapBounds.worldH) * 100;
                  const wPct = Math.max(4, (n.width / minimapBounds.worldW) * 100);
                  const hPct = Math.max(4, ((n.height ?? 200) / minimapBounds.worldH) * 100);
                  const active = selectedIds.includes(n.id);
                  return (
                    <span
                      key={n.id}
                      className={`cc-minimap-node cc-minimap-${n.kind}${active ? " cc-minimap-node-on" : ""}`}
                      style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${wPct}%`, height: `${hPct}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Node Quick Search Palette (⌘K) */}
          {searchOpen ? (
            <dialog open className="cc-cmd-backdrop" aria-label={zh ? "搜索画布节点" : "Search canvas nodes"} onClick={() => setSearchOpen(false)}>
              <div className="cc-cmd-modal" onClick={(e) => e.stopPropagation()}>
                <div className="cc-cmd-head">
                  <Search className="h-4 w-4 text-[var(--ds-text-3)]" />
                  <input
                    ref={(el) => el?.focus()}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={zh ? "搜索 @A、节点名称、提示词或类型…" : "Search @A, node title, prompt, or kind…"}
                    className="cc-cmd-input"
                  />
                  <button type="button" className="cc-icon-btn" onClick={() => setSearchOpen(false)} aria-label={zh ? "关闭" : "Close"}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="cc-cmd-list">
                  {filteredSearchNodes.length === 0 ? (
                    <p className="cc-hint px-3 py-4 text-center">
                      {nodes.length === 0
                        ? zh ? "画布为空，先生成或上传素材吧" : "Canvas is empty — upload or generate a node first"
                        : zh ? "没有匹配的画布节点" : "No matching nodes"}
                    </p>
                  ) : (
                    filteredSearchNodes.map((n) => (
                      <button key={n.id} type="button" className="cc-cmd-item" onClick={() => focusNode(n)}>
                        <span className="cc-node-tag">@{n.label}</span>
                        <span className="min-w-0 flex-1 truncate">{n.name}</span>
                        <span className="cc-cmd-kind">{n.kind}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </dialog>
          ) : null}

          {/* Keyboard Shortcuts Sheet (?) */}
          {shortcutsOpen ? (
            <dialog open className="cc-cmd-backdrop" aria-label={zh ? "画布快捷键" : "Canvas shortcuts"} onClick={() => setShortcutsOpen(false)}>
              <div className="cc-cmd-modal" onClick={(e) => e.stopPropagation()}>
                <div className="cc-cmd-head">
                  <Keyboard className="h-4 w-4 text-[var(--du-accent-text)]" />
                  <span className="flex-1 text-sm font-semibold">{zh ? "无限画布快捷键" : "Canvas Shortcuts"}</span>
                  <button type="button" className="cc-icon-btn" onClick={() => setShortcutsOpen(false)} aria-label={zh ? "关闭" : "Close"}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="cc-shortcuts-grid">
                  {[
                    ["V", zh ? "选择 / 框选工具" : "Select / Marquee"],
                    ["H / Space", zh ? "抓手平移画布" : "Pan canvas"],
                    ["C", zh ? "节点参考连线" : "Connect reference wire"],
                    ["⌘ K", zh ? "快速搜索并定位节点" : "Quick search & jump"],
                    ["M", zh ? "显示 / 隐藏小地图" : "Toggle minimap"],
                    ["E", zh ? "显示 / 隐藏参考连线" : "Toggle edges"],
                    ["⌘ Z / ⌘ ⇧ Z", zh ? "撤销 / 重做" : "Undo / Redo"],
                    ["⌘ D", zh ? "复制选中节点" : "Duplicate selection"],
                    ["Delete", zh ? "删除选中节点" : "Delete selection"],
                    ["?", zh ? "打开快捷键面板" : "Shortcuts sheet"],
                  ].map(([k, desc]) => (
                    <div key={k} className="cc-shortcut-row">
                      <span className="cc-shortcut-desc">{desc}</span>
                      <kbd className="cc-kbd">{k}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </dialog>
          ) : null}

          {/* Workflow Templates Library Modal (Higgsfield Canvas Pipelines) */}
          {templatesOpen ? (
            <dialog open className="cc-cmd-backdrop" aria-label={zh ? "工作流模板库" : "Workflow templates"} onClick={() => setTemplatesOpen(false)}>
              <div className="cc-cmd-modal cc-tpl-modal" onClick={(e) => e.stopPropagation()}>
                <div className="cc-cmd-head">
                  <Bookmark className="h-4 w-4 text-[var(--du-accent-text)]" />
                  <span className="flex-1 text-sm font-semibold">{zh ? "工作流模板库" : "Workflow Templates"}</span>
                  <button type="button" className="cc-icon-btn" onClick={() => setTemplatesOpen(false)} aria-label={zh ? "关闭" : "Close"}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="cc-tpl-body">
                  <div className="cc-tpl-save-row">
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder={zh ? "输入名称，将当前画布保存为可复用模板…" : "Name current canvas to save as reusable template…"}
                      className="cc-tpl-input"
                    />
                    <button type="button" className="cc-primary-btn" onClick={saveCurrentAsTemplate}>
                      <Save className="h-3.5 w-3.5" />
                      {zh ? "保存当前画布" : "Save Canvas"}
                    </button>
                  </div>

                  <p className="cc-tpl-section">{zh ? "官方制片工作流模板（一键铺入画布）" : "Production Workflow Templates"}</p>
                  <div className="cc-tpl-grid">
                    {BUILTIN_WORKFLOW_TEMPLATES.map((tpl) => (
                      <button key={tpl.id} type="button" className="cc-tpl-card" onClick={() => loadBuiltinTemplate(tpl)}>
                        <span className="cc-tpl-card-head">
                          <strong>{zh ? tpl.zh : tpl.en}</strong>
                          <span className="cc-pill">{tpl.steps.length} {zh ? "节点" : "steps"}</span>
                        </span>
                        <span className="cc-tpl-card-desc">{zh ? tpl.descZh : tpl.descEn}</span>
                      </button>
                    ))}
                  </div>

                  {userTemplates.length > 0 ? (
                    <>
                      <p className="cc-tpl-section">{zh ? "我保存的自定义模板" : "My Saved Templates"}</p>
                      <div className="cc-tpl-user-list">
                        {userTemplates.map((tpl) => (
                          <div key={tpl.id} className="cc-tpl-user-row">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => loadUserTemplate(tpl)}>
                              <strong className="block truncate text-xs font-semibold text-[var(--ds-text-1)]">{tpl.name}</strong>
                              <span className="text-[11px] text-[var(--ds-text-3)]">
                                {tpl.nodes.length} {zh ? "节点" : "nodes"} · {tpl.edges.length} {zh ? "连线" : "wires"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="cc-icon-btn"
                              onClick={() => deleteUserTemplate(tpl.id)}
                              aria-label={zh ? "删除模板" : "Delete template"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </dialog>
          ) : null}

          {/* Pollo Shots: Single-Image Multi-Angle Cinematography Modal */}
          {shotsSourceNode ? (
            <dialog open className="cc-cmd-backdrop" aria-label={zh ? "单图多机位分镜" : "Multi-Angle Shots"} onClick={() => setShotsModalNodeId(null)}>
              <div className="cc-cmd-modal cc-tpl-modal" onClick={(e) => e.stopPropagation()}>
                <div className="cc-cmd-head">
                  <Clapperboard className="h-4 w-4 text-[var(--du-accent-text)]" />
                  <span className="flex-1 text-sm font-semibold">
                    {zh ? `多机位分镜 · 基于 @${shotsSourceNode.label}` : `Multi-Angle Shots · @${shotsSourceNode.label}`}
                  </span>
                  <button type="button" className="cc-icon-btn" onClick={() => setShotsModalNodeId(null)} aria-label={zh ? "关闭" : "Close"}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="cc-tpl-body">
                  <p className="cc-hint">
                    {zh
                      ? "保持角色与场景高度一致，从同一张锚点图并发生成多角度电影机位，自动以贝塞尔连线排布在右侧。"
                      : "Keep character and lighting consistent across multiple camera angles. Generated frames spawn connected to the right."}
                  </p>
                  <div className="cc-angle-grid">
                    {CAMERA_ANGLES.map((angle) => {
                      const active = selectedAngles.includes(angle.id);
                      return (
                        <button
                          key={angle.id}
                          type="button"
                          aria-pressed={active}
                          className={`cc-option-btn${active ? " cc-option-btn-on" : ""}`}
                          onClick={() =>
                            setSelectedAngles((cur) =>
                              cur.includes(angle.id)
                                ? cur.length > 1
                                  ? cur.filter((id) => id !== angle.id)
                                  : cur
                                : [...cur, angle.id].slice(0, 4),
                            )
                          }
                        >
                          <strong className="block text-xs">{zh ? angle.zh : angle.en}</strong>
                          <span className="block truncate text-[10px] opacity-75">{zh ? angle.en : angle.zh}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="cc-modal-foot">
                    <select
                      aria-label={zh ? "机位分辨率" : "Shot resolution"}
                      value={shotsResolution}
                      onChange={(e) => setShotsResolution(e.target.value)}
                      className="cc-select mr-auto"
                    >
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                    </select>
                    <button type="button" className="cc-secondary-btn" onClick={() => setShotsModalNodeId(null)}>
                      {zh ? "取消" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="cc-primary-btn"
                      disabled={shotsSubmitting || selectedAngles.length === 0}
                      onClick={() => void generateMultiAngleShots()}
                    >
                      {shotsSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {zh
                        ? `一键生成 ${selectedAngles.length} 个机位 · ${singleShotCredits * selectedAngles.length} 分`
                        : `Generate ${selectedAngles.length} Shots · ${singleShotCredits * selectedAngles.length} cr`}
                    </button>
                  </div>
                </div>
              </div>
            </dialog>
          ) : null}

          {/* Marquee Selection Overlay */}
          {marquee ? (
            <div
              className="cc-marquee"
              style={{
                left: Math.min(marquee.startX, marquee.curX),
                top: Math.min(marquee.startY, marquee.curY),
                width: Math.abs(marquee.curX - marquee.startX),
                height: Math.abs(marquee.curY - marquee.startY),
              }}
            />
          ) : null}

          {/* Floating Bottom-Left Spatial HUD (Zoom / Fit / Arrange / Edges / Search / Minimap / Help / Clear) */}
          <div className="cc-hud-bar" role="toolbar" aria-label={zh ? "画布空间控制" : "Canvas viewport controls"}>
            <button
              type="button"
              className="cc-icon-btn"
              onClick={() => setViewport((v) => ({ ...v, scale: clamp(v.scale - 0.15, 0.25, 3) }))}
              aria-label={zh ? "缩小" : "Zoom out"}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="cc-zoom-val">{Math.round(viewport.scale * 100)}%</span>
            <button
              type="button"
              className="cc-icon-btn"
              onClick={() => setViewport((v) => ({ ...v, scale: clamp(v.scale + 0.15, 0.25, 3) }))}
              aria-label={zh ? "放大" : "Zoom in"}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="cc-icon-btn"
              onClick={fitAllNodes}
              title={zh ? "自适应画布" : "Fit all"}
              aria-label={zh ? "自适应画布" : "Fit all"}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <span className="cc-divider" />
            <button
              type="button"
              className="cc-icon-btn"
              onClick={autoArrangeNodes}
              title={zh ? "一键自动整理节点" : "Auto-arrange nodes"}
              aria-label={zh ? "自动整理" : "Auto-arrange"}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`cc-icon-btn${!showEdges ? " cc-icon-btn-on" : ""}`}
              onClick={() => setShowEdges((v) => !v)}
              title={zh ? "显示 / 隐藏参考连线 (E)" : "Toggle edges (E)"}
              aria-label={zh ? "显隐连线" : "Toggle edges"}
            >
              {showEdges ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              className={`cc-icon-btn${searchOpen ? " cc-icon-btn-on" : ""}`}
              onClick={() => {
                setSearchOpen((v) => !v);
                setShortcutsOpen(false);
              }}
              title={zh ? "搜索画布节点 (⌘K)" : "Search canvas nodes (⌘K)"}
              aria-label={zh ? "搜索节点" : "Search nodes"}
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`cc-icon-btn${showMinimap ? " cc-icon-btn-on" : ""}`}
              onClick={() => setShowMinimap((v) => !v)}
              title={zh ? "显示 / 隐藏小地图 (M)" : "Toggle minimap (M)"}
              aria-label={zh ? "小地图" : "Minimap"}
            >
              <MapIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`cc-icon-btn${shortcutsOpen ? " cc-icon-btn-on" : ""}`}
              onClick={() => {
                setShortcutsOpen((v) => !v);
                setSearchOpen(false);
              }}
              title={zh ? "快捷键说明 (?)" : "Keyboard shortcuts (?)"}
              aria-label={zh ? "快捷键" : "Shortcuts"}
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>
            {nodes.length > 0 ? (
              <button
                type="button"
                className="cc-icon-btn"
                onClick={() => {
                  commitHistory();
                  setNodes([]);
                  setEdges([]);
                  setSelectedIds([]);
                  showToast(zh ? "画布已清空（可 ⌘Z 撤销）" : "Canvas cleared (⌘Z to undo)");
                }}
                title={zh ? "清空画布" : "Clear canvas"}
                aria-label={zh ? "清空画布" : "Clear canvas"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Floating Bottom Multi-Modal Generation Dock */}
          <div className="cc-bottom-dock">
            <div className="cc-composer">
              <div className="cc-composer-top">
                <div className="cc-mode-tabs" role="tablist" aria-label={zh ? "画布生成模式" : "Canvas generation mode"}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composerKind === "image"}
                    className={`cc-mode-tab${composerKind === "image" ? " cc-mode-tab-on" : ""}`}
                    onClick={() => setComposerKind("image")}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {zh ? "画布生图" : "Image"}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composerKind === "video"}
                    className={`cc-mode-tab${composerKind === "video" ? " cc-mode-tab-on" : ""}`}
                    onClick={() => setComposerKind("video")}
                  >
                    <Film className="h-3.5 w-3.5" />
                    {zh ? "画布生视频" : "Video"}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composerKind === "audio"}
                    className={`cc-mode-tab${composerKind === "audio" ? " cc-mode-tab-on" : ""}`}
                    onClick={() => setComposerKind("audio")}
                  >
                    <Music className="h-3.5 w-3.5" />
                    {zh ? "配音与音乐" : "Audio"}
                  </button>
                </div>

                <div className="cc-ref-strip">
                  {composerKind !== "audio" ? (
                    <button
                      type="button"
                      className="cc-chip-btn"
                      onClick={() => setElementPickerOpen(true)}
                      title={zh ? "从元素库 / 品牌工具箱 / 我的作品导入参考" : "Pick from Elements / Brand Kit / Works"}
                    >
                      <AtSign className="h-3 w-3" />
                      {zh ? "元素" : "Element"}
                    </button>
                  ) : null}
                  {selectedImages.length > 0 && composerKind !== "audio"
                    ? selectedImages.slice(0, 4).map((img) => (
                        <span key={img.id} className="cc-ref-pill">
                          <img src={img.url} alt="" className="cc-ref-thumb" />
                          @{img.label}
                        </span>
                      ))
                    : null}
                </div>
              </div>

              <div className="cc-composer-input-row">
                <textarea
                  rows={1}
                  value={composerPrompt}
                  onChange={(event) => setComposerPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleComposerGenerate();
                    }
                  }}
                  placeholder={
                    composerKind === "image"
                      ? zh
                        ? "描述画面（选中画布图片可自动作为参考图融合/编辑）… ⌘Enter 生成"
                        : "Describe your image (select canvas images to use as references)… ⌘Enter"
                      : composerKind === "video"
                        ? zh
                          ? "描述镜头运动与剧情（选中画布图片自动作为首帧/多图参考）… ⌘Enter 生成"
                          : "Describe camera motion & scene (selected images attach automatically)… ⌘Enter"
                        : zh
                          ? "输入配音台词，或描述想要的歌曲/音效风格… ⌘Enter 生成"
                          : "Enter voiceover script, or describe music / sound effect… ⌘Enter"
                  }
                  className="cc-composer-textarea"
                />
                <button
                  type="button"
                  className="cc-primary-btn"
                  disabled={composerSubmitting}
                  onClick={() => void handleComposerGenerate()}
                >
                  {composerSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {zh ? `生成 · ${composerCredits} 分` : `Generate · ${composerCredits} cr`}
                </button>
              </div>

              <div className="cc-composer-controls">
                <div className="cc-select-group">
                  {composerKind === "image" ? (
                    <>
                      <select
                        aria-label={zh ? "图片模型" : "Image model"}
                        className="cc-select"
                        value={imageModelId}
                        onChange={(e) => {
                          const next = getMarketModel(e.target.value);
                          setImageModelId(e.target.value);
                          if (next?.options.aspects?.length) setImageAspect(next.options.aspects[0]);
                          setImageRes(next?.options.resolutions?.[0] ?? "");
                          setImageCount((c) => Math.min(c, next?.options.maxCount ?? 1));
                        }}
                      >
                        {IMAGE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <select aria-label={zh ? "比例" : "Aspect"} className="cc-select" value={imageAspect} onChange={(e) => setImageAspect(e.target.value)}>
                        {(selectedImageModel.options.aspects ?? ["1:1", "16:9", "9:16"]).map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      {selectedImageModel.options.resolutions?.length ? (
                        <select aria-label={zh ? "分辨率" : "Resolution"} className="cc-select" value={imageRes} onChange={(e) => setImageRes(e.target.value)}>
                          {selectedImageModel.options.resolutions.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : null}
                      {(selectedImageModel.options.maxCount ?? 1) > 1 ? (
                        <select
                          aria-label={zh ? "张数" : "Count"}
                          className="cc-select"
                          value={imageCount}
                          onChange={(e) => setImageCount(Number(e.target.value))}
                        >
                          {Array.from({ length: Math.min(4, selectedImageModel.options.maxCount ?? 1) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{zh ? `${n} 张` : `${n} imgs`}</option>
                          ))}
                        </select>
                      ) : null}
                    </>
                  ) : composerKind === "video" ? (
                    <>
                      <select
                        aria-label={zh ? "视频模型" : "Video model"}
                        className="cc-select"
                        value={videoModelId}
                        onChange={(e) => {
                          const next = VIDEO_MODELS.find((m) => m.id === e.target.value) ?? VIDEO_MODELS[0];
                          setVideoModelId(next.id);
                          setVideoAspect(next.aspects[0] ?? "16:9");
                          setVideoRes(next.resolutions[0] ?? "720p");
                          setVideoDuration(next.durations[0] ?? 5);
                          setVideoAudio(next.audio);
                        }}
                      >
                        {VIDEO_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <select aria-label={zh ? "比例" : "Aspect"} className="cc-select" value={videoAspect} onChange={(e) => setVideoAspect(e.target.value)}>
                        {selectedVideoModel.aspects.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      <select
                        aria-label={zh ? "时长" : "Duration"}
                        className="cc-select"
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(Number(e.target.value))}
                      >
                        {selectedVideoModel.durations.slice(0, 12).map((d) => (
                          <option key={d} value={d}>{d}s</option>
                        ))}
                      </select>
                      <select aria-label={zh ? "画质" : "Quality"} className="cc-select" value={videoRes} onChange={(e) => setVideoRes(e.target.value)}>
                        {selectedVideoModel.resolutions.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={`cc-chip-btn${videoAudio ? " cc-chip-btn-on" : ""}`}
                        onClick={() => setVideoAudio((v) => !v)}
                      >
                        {videoAudio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                        {zh ? (videoAudio ? "有声" : "静音") : videoAudio ? "Sound" : "Muted"}
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        aria-label={zh ? "音频模型" : "Audio model"}
                        className="cc-select"
                        value={audioModelId}
                        onChange={(e) => {
                          const next = getMarketModel(e.target.value);
                          setAudioModelId(e.target.value);
                          setAudioVoice(next?.options.voices?.[0]?.id ?? "");
                        }}
                      >
                        {AUDIO_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      {selectedAudioModel.options.voices?.length ? (
                        <select aria-label={zh ? "音色" : "Voice"} className="cc-select" value={audioVoice} onChange={(e) => setAudioVoice(e.target.value)}>
                          {selectedAudioModel.options.voices.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      ) : null}
                      {selectedAudioModel.id === "suno-music" || selectedAudioModel.id === "gemini-3-8-flash-tts" ? (
                        <input
                          type="text"
                          value={audioStyle}
                          onChange={(e) => setAudioStyle(e.target.value)}
                          placeholder={selectedAudioModel.id === "suno-music" ? (zh ? "曲风：爵士、电影配乐…" : "Style: jazz, cinematic…") : zh ? "语气：温暖从容…" : "Tone: warm, calm…"}
                          className="cc-select"
                          style={{ width: 160 }}
                        />
                      ) : null}
                    </>
                  )}
                </div>
                <span className="cc-hint hidden md:inline">
                  {zh ? "滚轮缩放 · 空格拖拽 · Shift 多选" : "Scroll zoom · Space pan · Shift multi-select"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Collapsible Multi-Session AI Design Agent Panel (Chat + Canvas) */}
        {agentOpen ? (
          <aside className="cc-agent-pane" aria-label={zh ? "AI 设计 Agent" : "AI Design Agent"}>
            <div className="cc-agent-head">
              <div className="cc-modal-title">
                <Bot className="h-4 w-4 text-[var(--du-accent-text)]" />
                <span>{zh ? "AI 设计 Agent" : "AI Design Agent"}</span>
              </div>
              <button
                type="button"
                className="cc-chip-btn"
                onClick={() => {
                  const next: AgentSession = {
                    id: `session-${Date.now()}`,
                    title: zh ? `会话 ${sessions.length + 1}` : `Chat ${sessions.length + 1}`,
                    messages: [],
                  };
                  setSessions((prev) => [...prev, next]);
                  setActiveSessionId(next.id);
                }}
              >
                <Plus className="h-3 w-3" />
                {zh ? "新对话" : "New"}
              </button>
            </div>

            {/* Multi-session switcher tabs */}
            <div className="cc-session-tabs">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`cc-session-tab${s.id === activeSession.id ? " cc-session-tab-on" : ""}`}
                  onClick={() => setActiveSessionId(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>

            <div className="cc-agent-feed">
              {activeSession.messages.length === 0 ? (
                <div className="cc-local-box">
                  <p className="cc-hint">
                    {zh
                      ? "告诉 Agent 你的创意目标，用 @A / @B 引用画布里的素材。它会自动拆解多镜头分镜脚本，支持一键铺成画布卡片或直接渲染成片。"
                      : "Tell the Agent your creative goal and @-mention canvas assets (@A, @B). It drafts multi-shot storyboards you can drop onto the board or render directly."}
                  </p>
                  <div className="cc-mention-row">
                    {[
                      zh ? "为画布素材设计 3 镜头产品广告分镜" : "Draft a 3-shot product ad storyboard",
                      zh ? "把 @A 作为开场，生成 8 秒电影感短片计划" : "Use @A as opening shot for an 8s cinematic clip",
                    ].map((idea) => (
                      <button key={idea} type="button" className="cc-chip-btn" onClick={() => setAgentInput(idea)}>
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeSession.messages.map((msg) => (
                  <div key={msg.id} className={`cc-msg ${msg.role === "user" ? "cc-msg-user" : "cc-msg-assistant"}`}>
                    <div>{msg.text}</div>
                    {msg.plan ? (
                      <div className="cc-plan-card">
                        {msg.plan.steps.map((step, idx) => (
                          <div key={`${step.assetId}-${idx}`} className="cc-plan-step">
                            <strong>{idx + 1}. {step.title}</strong>
                            <div className="cc-hint">{step.instruction}</div>
                          </div>
                        ))}
                        <div className="cc-select-group">
                          <select
                            aria-label={zh ? "分镜渲染模型" : "Render model"}
                            className="cc-select"
                            value={agentVideoModel}
                            onChange={(e) => setAgentVideoModel(e.target.value)}
                          >
                            {VIDEO_MODELS.slice(0, 6).map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="cc-chip-btn"
                            onClick={() => dropStoryboardOnCanvas(msg.plan!)}
                          >
                            <StickyNote className="h-3 w-3" />
                            {zh ? "铺成画布分镜卡" : "Drop Cards"}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="cc-primary-btn w-full"
                          onClick={() => void renderAgentPlanToCanvas(msg.plan!)}
                        >
                          <Film className="h-3.5 w-3.5" />
                          {zh ? `一键渲染视频 · ${agentPlanCredits} 积分` : `Render Video · ${agentPlanCredits} cr`}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {agentError ? <p className="cc-error">{agentError}</p> : null}
            </div>

            <div className="cc-agent-foot">
              {nodes.some((n) => n.kind === "image" || n.kind === "video") ? (
                <div className="cc-mention-row">
                  {nodes
                    .filter((n) => n.kind === "image" || n.kind === "video")
                    .slice(0, 8)
                    .map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="cc-chip-btn"
                        onClick={() => setAgentInput((cur) => `${cur}${cur.trim() ? " " : ""}@${n.label} `)}
                      >
                        @{n.label}
                      </button>
                    ))}
                </div>
              ) : null}

              <div className="cc-composer-input-row">
                <textarea
                  rows={2}
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAgentSend();
                    }
                  }}
                  placeholder={zh ? "输入需求或用 @A 引用画布素材…" : "Ask the Agent or @-mention canvas assets…"}
                  className="cc-composer-textarea"
                />
                <button
                  type="button"
                  className="cc-primary-btn"
                  disabled={agentPlanning || !agentInput.trim()}
                  onClick={() => void handleAgentSend()}
                  aria-label={zh ? "发送给 Agent" : "Send to Agent"}
                >
                  {agentPlanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <a href={localizedHref(locale, "/my-creations")} className="cc-hint text-center hover:underline">
                {zh ? "所有画布生成记录同步保存在「我的作品」→" : "All generations sync with My Creations →"}
              </a>
            </div>
          </aside>
        ) : null}
      </div>

      {/* Krea / Magnific-style Before/After Comparison Slider Modal */}
      {comparePair ? (
        <dialog
          open
          className="cc-cmd-backdrop"
          aria-label={zh ? "前后对比滑块" : "Before and after comparison"}
          onClick={() => setComparePair(null)}
        >
          <div className="cc-cmd-modal cc-compare-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-cmd-head">
              <SplitSquareHorizontal className="h-4 w-4 text-[var(--du-accent-text)]" />
              <span className="flex-1 text-sm font-semibold">
                {zh ? "高清前后对比 · 左右拖动分界线" : "Before / After Compare · Drag Divider"}
              </span>
              <span className="cc-zoom-val">{compareSplit}%</span>
              <button type="button" className="cc-icon-btn" onClick={() => setComparePair(null)} aria-label={zh ? "关闭" : "Close"}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="cc-tpl-body">
              <div className="cc-compare-stage">
                <img src={comparePair.afterUrl} alt={comparePair.afterLabel} className="cc-compare-img" />
                <div
                  className="cc-compare-before-layer"
                  style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
                >
                  <img src={comparePair.beforeUrl} alt={comparePair.beforeLabel} className="cc-compare-img" />
                </div>
                <span className="cc-compare-badge cc-compare-badge-left">{comparePair.beforeLabel}</span>
                <span className="cc-compare-badge cc-compare-badge-right">{comparePair.afterLabel}</span>
                <div className="cc-compare-divider" style={{ left: `${compareSplit}%` }} aria-hidden="true">
                  <span className="cc-compare-handle">
                    <SplitSquareHorizontal className="h-4 w-4" />
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={compareSplit}
                  onChange={(e) => setCompareSplit(Number(e.target.value))}
                  aria-label={zh ? "拖动调整对比分界线" : "Drag before/after split"}
                  className="cc-compare-range"
                />
              </div>
            </div>
          </div>
        </dialog>
      ) : null}

      {/* Shared @Element / Brand Kit / Works Picker (reusing teammate's HomeMediaPicker) */}
      <HomeMediaPicker
        lang={locale}
        open={elementPickerOpen}
        onClose={() => setElementPickerOpen(false)}
        onSelect={handlePickedElements}
        maxSelected={4}
        selectedIds={[]}
        userId={session?.user?.id}
        acceptedTypes={["image", "video"]}
      />

      {/* Contextual Post-Edit Modal (Inpaint / Erase / Outpaint / Cutout / Upscale / Text Edit / Animate) */}
      {editModal && activeEditNode ? (
        <CanvasEditModal
          locale={locale}
          node={activeEditNode}
          action={editModal.action}
          submitting={editSubmitting}
          onClose={() => setEditModal(null)}
          onSubmit={(payload) => void handleEditModalSubmit(payload)}
          onLocalCutout={(dataUrl, file) => {
            commitHistory();
            const newId = `cutout-${Date.now()}`;
            setNodes((prev) => [
              ...prev,
              {
                id: newId,
                kind: "image",
                label: nextAlphaLabel(prev),
                name: `${zh ? "透明抠图" : "Cutout"} · @${activeEditNode.label}`,
                url: dataUrl,
                x: activeEditNode.x + activeEditNode.width + 64,
                y: activeEditNode.y,
                width: activeEditNode.width,
                zIndex: maxZIndex(prev) + 1,
                status: "ready",
                safety: "allowed",
                file,
                createdAt: Date.now(),
              },
            ]);
            setEdges((prev) => [
              ...prev,
              { id: `edge-${Date.now()}`, fromId: activeEditNode.id, toId: newId, kind: "edit", label: zh ? "抠图" : "Cutout" },
            ]);
            setSelectedIds([newId]);
            showToast(zh ? "已完成透明 PNG 抠图并加入画布" : "Transparent cutout added to canvas");
          }}
        />
      ) : null}
    </div>
  );
}
