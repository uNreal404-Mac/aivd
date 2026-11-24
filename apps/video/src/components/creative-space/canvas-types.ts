import type { CreativePlan } from "@/lib/creative-space/local-plan";

export type CanvasTool = "select" | "hand" | "connect";

export type CanvasNodeKind = "image" | "video" | "audio" | "text" | "group";

export type NodeStatus = "ready" | "generating" | "failed";

export type CanvasEditAction =
  | "inpaint"
  | "erase"
  | "outpaint"
  | "cutout"
  | "upscale"
  | "text-edit"
  | "animate";

export interface CanvasNodeBase {
  id: string;
  kind: CanvasNodeKind;
  label: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  zIndex: number;
  locked?: boolean;
  status: NodeStatus;
  jobUuid?: string;
  error?: string | null;
  prompt?: string;
  model?: string;
  createdAt: number;
}

export interface CanvasImageNode extends CanvasNodeBase {
  kind: "image";
  url: string;
  storageKey?: string;
  resolution?: string;
  aspectRatio?: string;
  safety: "checking" | "allowed";
  file?: File;
  samples?: File[];
}

export interface CanvasVideoNode extends CanvasNodeBase {
  kind: "video";
  url: string;
  poster?: string;
  duration?: number;
  resolution?: string;
  safety: "checking" | "allowed";
  file?: File;
  samples?: File[];
}

export interface CanvasAudioNode extends CanvasNodeBase {
  kind: "audio";
  url: string;
}

export interface CanvasTextNode extends CanvasNodeBase {
  kind: "text";
  title: string;
  content: string;
  tone: "note" | "storyboard" | "prompt";
}

export interface CanvasGroupNode extends CanvasNodeBase {
  kind: "group";
  title: string;
  height: number;
}

export type CanvasNode =
  | CanvasImageNode
  | CanvasVideoNode
  | CanvasAudioNode
  | CanvasTextNode
  | CanvasGroupNode;

export interface CanvasEdge {
  id: string;
  fromId: string;
  toId: string;
  kind: "reference" | "edit" | "animate" | "story";
  label?: string;
}

export interface AgentPlan extends CreativePlan {
  generationPrompt: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: AgentPlan;
  createdAt: number;
}

export interface AgentSession {
  id: string;
  title: string;
  messages: AgentMessage[];
}

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasSnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface PersistedCanvasProject {
  version: 2;
  title: string;
  viewport: CanvasViewport;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  sessions: AgentSession[];
  activeSessionId: string;
  updatedAt: number;
}

export const CANVAS_STORAGE_KEY = "aivd:dreamina-canvas:v2";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nextAlphaLabel(nodes: CanvasNode[]): string {
  const used = new Set(nodes.map((node) => node.label));
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    if (!used.has(ch)) return ch;
  }
  let idx = 1;
  while (used.has(`N${idx}`)) idx++;
  return `N${idx}`;
}

export function maxZIndex(nodes: CanvasNode[]): number {
  let top = 1;
  for (const node of nodes) {
    if (node.zIndex > top) top = node.zIndex;
  }
  return top;
}

export function nodeAnchor(node: CanvasNode, side: "left" | "right"): { x: number; y: number } {
  const estHeight =
    node.kind === "group"
      ? node.height
      : node.kind === "text"
        ? (node.height ?? 180)
        : node.kind === "audio"
          ? 148
          : Math.round(node.width * 0.72) + 46;
  return {
    x: side === "right" ? node.x + node.width : node.x,
    y: node.y + estHeight / 2,
  };
}

export function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.max(64, Math.abs(to.x - from.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

export function stripTransientForStorage(project: PersistedCanvasProject): PersistedCanvasProject {
  const nodes: CanvasNode[] = [];
  for (const node of project.nodes) {
    if (node.kind === "image") {
      if (node.url.startsWith("blob:")) continue;
      const { file: _f, samples: _s, ...rest } = node;
      nodes.push(rest);
    } else if (node.kind === "video") {
      if (node.url.startsWith("blob:")) continue;
      const { file: _f, samples: _s, ...rest } = node;
      nodes.push(rest);
    } else {
      nodes.push(node);
    }
  }
  const keepIds = new Set(nodes.map((node) => node.id));
  const edges = project.edges.filter((edge) => keepIds.has(edge.fromId) && keepIds.has(edge.toId));
  return {
    ...project,
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}
