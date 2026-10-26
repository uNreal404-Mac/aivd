import { db } from "@/db";
import { adminAuditLogs } from "@/db/schema";

export async function recordAdminAction(input: {
  actor: string;
  action: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(adminAuditLogs).values({
    actor: input.actor,
    action: input.action,
    targetUserId: input.targetUserId,
    details: input.details ?? null,
  });
}
