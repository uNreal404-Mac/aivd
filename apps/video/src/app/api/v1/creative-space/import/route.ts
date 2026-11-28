import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { db, creativeWorkflows, mediaAssets, videos, VideoStatus } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { assertMediaAccount } from "@/lib/api/media-account";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage, isStorageKey, SIGNED_URL_DEFAULT_TTL } from "@/lib/storage";
import { parseWorkflowPayload } from "@/lib/creative-space/workflow-graph";

const schema = z.object({
  canvasId: z.string().min(1).max(80).optional(),
  locale: z.enum(["zh", "en"]).default("zh"),
  nextCanvasNumber: z.number().int().min(1).max(1_000_000).optional(),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("upload"), key: z.string().min(1).max(500) }),
    z.object({ type: z.literal("canvas-upload"), key: z.string().min(1).max(500) }),
    z.object({ type: z.literal("generation"), uuid: z.string().min(1).max(100), index: z.number().int().min(0).max(8).default(0) }),
  ]),
});

function nextName(names: string[], zh: boolean, preferred?: number) {
  const used = names.reduce((max, name) => Math.max(max, Number(/^(?:画布|Canvas\s+)(\d+)$/i.exec(name)?.[1] ?? 0)), 0);
  const number = Math.max(used + 1, preferred ?? 1);
  return zh ? `画布${number}` : `Canvas ${number}`;
}

function mimeFor(key: string, type: "image" | "video") {
  if (type === "video") return "video/mp4";
  const ext = key.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
}

export async function POST(request: Request) {
  let copiedKey: string | null = null;
  let ownerId: string | null = null;
  try {
    const user = await requireAuth(request);
    ownerId = user.id;
    assertMediaAccount(request, user.id);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError("Invalid import request.", 400);
    const { canvasId, source, locale, nextCanvasNumber } = parsed.data;
    const ownedCanvas = canvasId ? (await db.select().from(creativeWorkflows).where(and(eq(creativeWorkflows.id, canvasId), eq(creativeWorkflows.userId, user.id))).limit(1))[0] : null;
    if (canvasId && !ownedCanvas) throw new ApiError("Canvas not found.", 404);
    const existing = !canvasId ? await db.select({ id: creativeWorkflows.id, name: creativeWorkflows.name }).from(creativeWorkflows).where(eq(creativeWorkflows.userId, user.id)).limit(101) : [];
    if (!canvasId && existing.length) throw new ApiError("Choose a canvas.", 400);
    if (existing.length >= 100) throw new ApiError("Canvas limit reached.", 400);

    let sourceKey: string;
    let name: string;
    let mimeType: string;
    let media: "image" | "video";
    let size = 0;
    if (source.type === "generation") {
      const row = (await db.select().from(videos).where(and(eq(videos.uuid, source.uuid), eq(videos.userId, user.id))).limit(1))[0];
      if (!row || row.status !== VideoStatus.COMPLETED || row.isDeleted || (row.mediaType !== "image" && row.mediaType !== "video")) throw new ApiError("Creation not found.", 404);
      const extra = Array.isArray(row.parameters?.extraKeys) ? row.parameters.extraKeys : [];
      const keys = [row.videoUrl, ...extra].filter((value): value is string => typeof value === "string" && Boolean(value));
      sourceKey = keys[source.index];
      if (!sourceKey || !isStorageKey(sourceKey)) throw new ApiError("Creation is unavailable for import.", 400);
      media = row.mediaType;
      mimeType = mimeFor(sourceKey, media);
      name = (row.prompt || (media === "image" ? "图片" : "视频")).slice(0, 60);
    } else {
      const key = source.key;
      const prefix = `uploads/${user.id}/${source.type === "canvas-upload" ? "canvas/" : ""}`;
      if (!key.startsWith(prefix) || (source.type === "upload" && key.startsWith(`uploads/${user.id}/canvas/`))) throw new ApiError("Asset not found.", 404);
      const row = (await db.select().from(mediaAssets).where(and(eq(mediaAssets.userId, user.id), eq(mediaAssets.key, key))).limit(1))[0];
      if (!row || (!row.mimeType.startsWith("image/") && !row.mimeType.startsWith("video/"))) throw new ApiError("Asset not found.", 404);
      sourceKey = key;
      mimeType = row.mimeType;
      media = mimeType.startsWith("video/") ? "video" : "image";
      name = row.name.slice(0, 60);
      size = row.size;
    }

    const storage = getStorage();
    let assetKey = sourceKey;
    if (source.type !== "canvas-upload") {
      const ext = sourceKey.split(".").pop()?.split("?")[0] || (media === "video" ? "mp4" : "png");
      assetKey = `uploads/${user.id}/canvas/${nanoid()}.${ext}`;
      const copied = await storage.downloadAndUpload({ sourceUrl: storage.getSignedUrl(sourceKey), key: assetKey, contentType: mimeType, requireNonEmpty: true });
      copiedKey = assetKey;
      size = copied.fileSize;
      await db.insert(mediaAssets).values({ id: nanoid(), userId: user.id, key: assetKey, name, mimeType, size });
    }

    const rawGraph = ownedCanvas?.graph ?? { version: 2, nodes: [], edges: [] };
    const targetTitle = ownedCanvas?.name ?? nextName(existing.map((item) => item.name), locale === "zh", nextCanvasNumber);
    const graph = parseWorkflowPayload({ name: targetTitle, graph: rawGraph }).graph;
    if (graph.nodes.length >= 200) throw new ApiError("Canvas is full.", 400);
    const revision = typeof graph.revision === "number" ? graph.revision : 0;
    const lastX = graph.nodes.reduce((max, node) => Math.max(max, node.position.x), -360);
    const node = {
      id: crypto.randomUUID(), type: "media", position: { x: lastX + 360, y: 0 },
      data: { kind: "media", media, title: name, mime: mimeType, assetKey },
    };
    const nextGraph = { ...graph, version: 2 as const, revision: revision + 1, nodes: [...graph.nodes, node] };
    parseWorkflowPayload({ name: targetTitle, graph: nextGraph });
    let targetId = canvasId;
    let targetName = ownedCanvas?.name;
    if (ownedCanvas && canvasId) {
      const stored = sql<number>`coalesce(json_extract(${creativeWorkflows.graph}, '$.revision'), 0)`;
      const [updated] = await db.update(creativeWorkflows).set({ graph: nextGraph, updatedAt: new Date() })
        .where(and(eq(creativeWorkflows.id, canvasId), eq(creativeWorkflows.userId, user.id), eq(stored, revision)))
        .returning({ id: creativeWorkflows.id });
      if (!updated) throw new ApiError("Canvas changed in another window. Try again.", 409);
    } else {
      targetId = nanoid();
      targetName = targetTitle;
      await db.insert(creativeWorkflows).values({ id: targetId, userId: user.id, name: targetName, graph: nextGraph });
    }
    return apiSuccess({ canvasId: targetId, canvasName: targetName, key: assetKey, url: storage.getSignedUrl(assetKey, SIGNED_URL_DEFAULT_TTL) });
  } catch (error) {
    if (copiedKey && ownerId) {
      await Promise.allSettled([
        db.delete(mediaAssets).where(and(eq(mediaAssets.userId, ownerId), eq(mediaAssets.key, copiedKey))),
        getStorage().deleteFile(copiedKey),
      ]);
    }
    return handleApiError(error);
  }
}
