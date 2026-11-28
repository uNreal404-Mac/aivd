import { and, eq, sql } from "drizzle-orm";

import { db, creativeWorkflows } from "@/db";
import { assertMediaAccount } from "@/lib/api/media-account";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parseWorkflowPayload } from "@/lib/creative-space/workflow-graph";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireAuth(request);
    assertMediaAccount(request, user.id);
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
    assertMediaAccount(request, user.id);
    const { id } = await params;
    let payload: ReturnType<typeof parseWorkflowPayload>;
    try { payload = parseWorkflowPayload(await request.json()); }
    catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid canvas.", 400); }
    const owned = and(eq(creativeWorkflows.id, id), eq(creativeWorkflows.userId, user.id));
    const stored = sql<number>`coalesce(json_extract(${creativeWorkflows.graph}, '$.revision'), 0)`;
    // A save from an older copy (another tab, a late request) must not
    // overwrite newer work such as a job id saved in between: the update
    // only applies when the stored revision is the one the save started from.
    const base = payload.baseRevision;
    const revision = (base ?? 0) + 1;
    const [workflow] = await db.update(creativeWorkflows)
      .set({ name: payload.name, graph: { ...payload.graph, revision }, updatedAt: new Date() })
      // No base (an editor from before revisions): only for a canvas never saved with one.
      .where(and(owned, eq(stored, base ?? 0)))
      .returning({ id: creativeWorkflows.id, updatedAt: creativeWorkflows.updatedAt });
    if (!workflow) {
      const [exists] = await db.select({ id: creativeWorkflows.id }).from(creativeWorkflows).where(owned).limit(1);
      if (!exists) throw new ApiError("Canvas not found.", 404);
      throw new ApiError("This canvas was changed in another window.", 409, { code: "CANVAS_CONFLICT" });
    }
    return apiSuccess({ workflow: { ...workflow, revision } });
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const user = await requireAuth(request);
    assertMediaAccount(request, user.id);
    const { id } = await params;
    const [workflow] = await db.delete(creativeWorkflows)
      .where(and(eq(creativeWorkflows.id, id), eq(creativeWorkflows.userId, user.id)))
      .returning({ id: creativeWorkflows.id });
    if (!workflow) throw new ApiError("Canvas not found.", 404);
    return apiSuccess({ deleted: true });
  } catch (error) { return handleApiError(error); }
}
