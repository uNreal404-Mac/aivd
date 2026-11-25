import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db, creativeWorkflows } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parseWorkflowPayload } from "@/lib/creative-space/workflow-graph";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const workflows = await db.select({ id: creativeWorkflows.id, name: creativeWorkflows.name, updatedAt: creativeWorkflows.updatedAt })
      .from(creativeWorkflows).where(eq(creativeWorkflows.userId, user.id)).orderBy(desc(creativeWorkflows.updatedAt)).limit(100);
    return apiSuccess({ workflows });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const count = await db.select({ id: creativeWorkflows.id }).from(creativeWorkflows).where(eq(creativeWorkflows.userId, user.id)).limit(101);
    if (count.length >= 100) throw new ApiError("Canvas limit reached.", 400);
    let payload: ReturnType<typeof parseWorkflowPayload>;
    try { payload = parseWorkflowPayload(await request.json()); }
    catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid canvas.", 400); }
    const id = nanoid();
    const graph = { ...payload.graph, revision: 1 };
    await db.insert(creativeWorkflows).values({ id, userId: user.id, name: payload.name, graph });
    return apiSuccess({ id, name: payload.name, graph, revision: 1 });
  } catch (error) { return handleApiError(error); }
}
