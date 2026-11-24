import { z } from "zod";

const point = z.object({ x: z.number().finite(), y: z.number().finite() });
const node = z.object({
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(50).optional(),
  position: point,
  data: z.record(z.string(), z.unknown()),
});
const edge = z.object({
  id: z.string().min(1).max(180),
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(node).max(120),
  edges: z.array(edge).max(240),
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().min(0.1).max(4) }).optional(),
});

export const workflowPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  graph: workflowGraphSchema,
});

export function parseWorkflowPayload(value: unknown) {
  const parsed = workflowPayloadSchema.parse(value);
  if (JSON.stringify(parsed.graph).length > 250_000) throw new Error("Canvas is too large to save.");
  const ids = new Set(parsed.graph.nodes.map((item) => item.id));
  if (ids.size !== parsed.graph.nodes.length || parsed.graph.edges.some((item) => !ids.has(item.source) || !ids.has(item.target))) {
    throw new Error("Canvas has invalid connections.");
  }
  return parsed;
}
