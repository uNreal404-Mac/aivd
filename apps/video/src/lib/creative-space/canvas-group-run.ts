import type { GraphEdge, GraphNode } from "./canvas-graph";
import { selectionWithChildren } from "./canvas-graph";

export function canvasGroupPlan(groupId: string, nodes: readonly GraphNode[], edges: readonly GraphEdge[]) {
  const members = selectionWithChildren(nodes.map((node) => ({ ...node, selected: node.id === groupId })));
  const ids = new Set(members.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const degree = new Map<string, number>();
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const byId = new Map(members.map((node) => [node.id, node]));
  const queue = members.filter((node) => !degree.get(node.id)).map((node) => node.id);
  const ordered: GraphNode[] = [];
  for (const id of queue) {
    const node = byId.get(id)!;
    const data = node.data;
    if ((data.kind === "image" || data.kind === "video" || data.kind === "audio" || data.kind === "agent") && data.status !== "done") ordered.push(node);
    for (const target of outgoing.get(id) ?? []) {
      const count = degree.get(target)! - 1;
      degree.set(target, count);
      if (!count) queue.push(target);
    }
  }
  if (queue.length !== members.length) return [];
  return ordered;
}

/** Never start the next step after a stop, a failure or an account/canvas change. */
export async function runCanvasGroup(ids: readonly string[], active: () => boolean, execute: (id: string, index: number) => Promise<boolean>) {
  for (const [index, id] of ids.entries()) {
    if (!active() || !await execute(id, index)) return false;
  }
  return active();
}
