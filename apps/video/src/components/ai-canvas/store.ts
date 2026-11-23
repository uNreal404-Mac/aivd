"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getMarketModel, marketModelsOf } from "@/ai/kie-market";

import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeData,
  CanvasNodeKind,
  GenerateData,
} from "./types";

let counter = 0;
export function newId(prefix = "n"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function defaultGenerate(kind: "image" | "video" | "audio"): GenerateData {
  const model = marketModelsOf(kind)[0];
  const options = model?.options ?? {};
  return {
    prompt: "",
    model: model?.id ?? "",
    aspect: kind === "audio" ? undefined : (options.aspects?.find((a) => a !== "auto") ?? options.aspects?.[0]),
    resolution: options.resolutions?.[0],
    duration: options.durations?.[0],
    voice: options.voices?.[0]?.id,
    status: "idle",
    urls: [],
  };
}

export function defaultData(kind: CanvasNodeKind): CanvasNodeData {
  switch (kind) {
    case "text":
      return { text: "" };
    case "image":
    case "video":
    case "audio":
      return defaultGenerate(kind);
    case "storyboard":
      return { shots: ["", "", ""] };
    case "character":
      return { name: "", description: "" };
    case "style":
      return { preset: "", custom: "" };
    case "note":
      return { text: "", color: "var(--du-accent)" };
    case "media":
      return { mediaType: "image", url: "", name: "" };
  }
}

/** Model options must match the chosen model; reset anything it does not offer. */
export function normalizeModelChoice(data: GenerateData, modelId: string): Partial<GenerateData> {
  const model = getMarketModel(modelId);
  if (!model) return { model: modelId };
  const o = model.options;
  const pick = <T,>(list: T[] | undefined, current: T | undefined) =>
    list?.length ? (current !== undefined && list.includes(current) ? current : list[0]) : undefined;
  return {
    model: modelId,
    aspect: pick(o.aspects, data.aspect),
    resolution: pick(o.resolutions, data.resolution),
    duration: pick(o.durations, data.duration),
    voice: pick(o.voices?.map((v) => v.id), data.voice),
  };
}

const NODE_WIDTH: Partial<Record<CanvasNodeKind, number>> = {
  note: 200,
  text: 280,
  style: 280,
  character: 280,
  storyboard: 320,
  image: 320,
  video: 340,
  audio: 300,
  media: 260,
};

interface CanvasState {
  name: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  setName: (name: string) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (kind: CanvasNodeKind, position: XYPosition, data?: Partial<CanvasNodeData>) => string;
  updateData: (id: string, patch: Partial<CanvasNodeData>) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  connect: (source: string, target: string) => void;
  clear: () => void;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      name: "",
      nodes: [],
      edges: [],
      setName: (name) => set({ name }),
      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
      onConnect: (connection) =>
        set({ edges: addEdge({ ...connection, id: newId("e"), animated: true }, get().edges) }),
      addNode: (kind, position, data) => {
        const id = newId(kind);
        const node: CanvasNode = {
          id,
          type: kind,
          position,
          data: { ...defaultData(kind), ...(data ?? {}) } as CanvasNodeData,
          style: { width: NODE_WIDTH[kind] },
          selected: true,
        };
        set({
          nodes: [...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node],
        });
        return id;
      },
      updateData: (id, patch) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } as CanvasNodeData } : n,
          ),
        }),
      removeNode: (id) =>
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        }),
      duplicateNode: (id) => {
        const node = get().nodes.find((n) => n.id === id);
        if (!node) return;
        const copy: CanvasNode = {
          ...node,
          id: newId(node.type ?? "n"),
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          selected: true,
          data: { ...node.data } as CanvasNodeData,
        };
        set({ nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), copy] });
      },
      connect: (source, target) =>
        set({
          edges: addEdge(
            { id: newId("e"), source, target, sourceHandle: null, targetHandle: null, animated: true },
            get().edges,
          ),
        }),
      clear: () => set({ nodes: [], edges: [] }),
    }),
    {
      name: "aivd-ai-canvas-v1",
      storage: createJSONStorage(() => localStorage),
      // Blob previews die with the tab, so local-only media is not persisted.
      partialize: (state) => ({
        name: state.name,
        edges: state.edges,
        nodes: state.nodes
          .filter((n) => !(n.type === "media" && String((n.data as { url?: string }).url).startsWith("blob:")))
          .map((n) => ({ ...n, selected: false })),
      }),
      skipHydration: true,
    },
  ),
);
