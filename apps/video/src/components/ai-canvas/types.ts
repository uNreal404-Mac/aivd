import type { Edge, Node } from "@xyflow/react";

/** Every kind of node the AI canvas can hold. */
export type CanvasNodeKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "storyboard"
  | "character"
  | "style"
  | "note"
  | "media";

export type GenStatus = "idle" | "queued" | "generating" | "completed" | "failed";

export type MediaType = "image" | "video" | "audio";

export interface BaseData extends Record<string, unknown> {
  title?: string;
}

export interface TextData extends BaseData {
  text: string;
}

/** Image, video and audio nodes all generate through a market model. */
export interface GenerateData extends BaseData {
  prompt: string;
  model: string;
  aspect?: string;
  resolution?: string;
  duration?: number;
  voice?: string;
  status: GenStatus;
  jobId?: string;
  urls: string[];
  error?: string | null;
  credits?: number;
}

export interface StoryboardData extends BaseData {
  shots: string[];
}

export interface CharacterData extends BaseData {
  name: string;
  description: string;
  imageKey?: string;
  imageUrl?: string;
}

export interface StyleData extends BaseData {
  preset: string;
  custom: string;
}

export interface NoteData extends BaseData {
  text: string;
  color: string;
}

export interface MediaData extends BaseData {
  mediaType: MediaType;
  url: string;
  /** Storage key for uploads; generation accepts it as an image reference. */
  key?: string;
  name: string;
}

export type CanvasNodeData =
  | TextData
  | GenerateData
  | StoryboardData
  | CharacterData
  | StyleData
  | NoteData
  | MediaData;

export type CanvasNode = Node<CanvasNodeData, CanvasNodeKind>;
export type CanvasEdge = Edge;

export const GENERATE_KINDS: CanvasNodeKind[] = ["image", "video", "audio"];

export function isGenerateKind(kind: string | undefined): kind is "image" | "video" | "audio" {
  return kind === "image" || kind === "video" || kind === "audio";
}
