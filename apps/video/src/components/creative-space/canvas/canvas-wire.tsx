"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";

/** Port hit areas float outside each card. The visible wire meets the card itself. */
function CanvasWire({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, ...edge }: EdgeProps) {
  const [path] = getBezierPath({ sourceX: sourceX - 35, sourceY, targetX: targetX + 35, targetY, sourcePosition, targetPosition });
  return <BaseEdge id={edge.id} path={path} style={edge.style} markerEnd={edge.markerEnd} markerStart={edge.markerStart} interactionWidth={edge.interactionWidth} />;
}

export const CANVAS_EDGE_TYPES = { canvas: CanvasWire };
