import { and, eq } from "drizzle-orm";
import { db, videos } from "@/db";

export function generationRequestKey(request: Request, bodyKey?: string) {
  return request.headers.get("Idempotency-Key")?.slice(0, 200) || bodyKey;
}

/** Returning an owned job is read-only. Only a new submission needs current moderation and pricing. */
export async function readGenerationReplay(userId: string, key?: string) {
  if (!key) return null;
  const [job] = await db.select({
    videoUuid: videos.uuid,
    taskId: videos.externalTaskId,
    provider: videos.provider,
    status: videos.status,
    creditsUsed: videos.creditsUsed,
  }).from(videos).where(and(eq(videos.userId, userId), eq(videos.idempotencyKey, key), eq(videos.isDeleted, false))).limit(1);
  return job ? { ...job, taskId: job.taskId ?? "" } : null;
}
