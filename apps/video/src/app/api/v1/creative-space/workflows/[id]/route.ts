import { and, eq } from "drizzle-orm";

import { db, creativeWorkflows } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parseWorkflowPayload } from "@/lib/creative-space/workflow-graph";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const [workflow] = await db.select().from(creativeWorkflows)
      .where(and(eq(creativeWorkflows.id, id), eq(creativeWorkflows.userId, user.id))).limit(1);
    if (!workflow) throw new ApiError("Canvas not found.", 404);
    return apiSuccess({ workflow });
  } catch (error) { return handleApiError(error); }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    let payload: ReturnType<typeof parseWorkflowPayload>;
    try { payload = parseWorkflowPayload(await request.json()); }
    catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid canvas.", 400); }
    const [workflow] = await db.update(creativeWorkflows)
      .set({ name: payload.name, graph: payload.graph, updatedAt: new Date() })
      .where(and(eq(creativeWorkflows.id, id), eq(creativeWorkflows.userId, user.id)))
      .returning({ id: creativeWorkflows.id, updatedAt: creativeWorkflows.updatedAt });
    if (!workflow) throw new ApiError("Canvas not found.", 404);
    return apiSuccess({ workflow });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const [workflow] = await db.delete(creativeWorkflows)
      .where(and(eq(creativeWorkflows.id, id), eq(creativeWorkflows.userId, user.id)))
      .returning({ id: creativeWorkflows.id });
    if (!workflow) throw new ApiError("Canvas not found.", 404);
    return apiSuccess({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
