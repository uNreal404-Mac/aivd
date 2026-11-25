import { z } from "zod";

// Saved node canvases (creative_workflows.graph). Version 2 is the node
// canvas (lib/creative-space/canvas-graph.ts); version 1 rows (no version
// field) are still accepted and migrated when opened.

export const MAX_CANVAS_NODES = 200;
export const MAX_CANVAS_EDGES = 400;
export const MAX_CANVAS_BYTES = 400_000;

const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const size = z.number().finite().min(40).max(8000);
const node = z.object({
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(50).optional(),
  position: point,
  data: z.record(z.string(), z.unknown()),
  parentNode: z.string().min(1).max(80).optional(),
  // Only a size is stored; any other style is dropped.
  style: z.object({ width: size.optional(), height: size.optional() }).strip().optional(),
  zIndex: z.number().int().min(-10).max(10_000).optional(),
}).strip();
const edge = z.object({
  id: z.string().min(1).max(180),
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export const workflowGraphSchema = z.object({
  version: z.literal(2).optional(),
  nodes: z.array(node).max(MAX_CANVAS_NODES),
  edges: z.array(edge).max(MAX_CANVAS_EDGES),
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().min(0.1).max(4) }).optional(),
});

export const workflowPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  graph: workflowGraphSchema,
});

export function parseWorkflowPayload(value: unknown) {
  const parsed = workflowPayloadSchema.parse(value);
  if (JSON.stringify(parsed.graph).length > MAX_CANVAS_BYTES) throw new Error("Canvas is too large to save.");
  const ids = new Set(parsed.graph.nodes.map((item) => item.id));
  if (ids.size !== parsed.graph.nodes.length || parsed.graph.edges.some((item) => !ids.has(item.source) || !ids.has(item.target))) {
    throw new Error("Canvas has invalid connections.");
  }
  if (parsed.graph.nodes.some((item) => item.parentNode && (!ids.has(item.parentNode) || item.parentNode === item.id))) {
    throw new Error("Canvas has an invalid group.");
  }
  return parsed;
}
