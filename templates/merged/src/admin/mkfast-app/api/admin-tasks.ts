import { logOperationalEvent } from '@/lib/observability';
import { createServerFn } from '@tanstack/react-start';
import { adminApiMiddleware } from '@/middlewares/admin-middleware';
import { ErrorCategory } from '@/ai/models';
import { refundCredits } from '@/credits/credits';
import { getDb } from '@/db';
import { creditTransaction, generationHistory } from '@/db/app.schema';
import { user } from '@/db/auth.schema';
import {
  and,
  asc,
  count as countFn,
  desc,
  eq,
  gte,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

const SORT_FIELD_MAP: Record<
  string,
  | typeof generationHistory.createdAt
  | typeof generationHistory.model
  | typeof generationHistory.creditsUsed
> = {
  createdAt: generationHistory.createdAt,
  model: generationHistory.model,
  creditsUsed: generationHistory.creditsUsed,
};

function normalizeSortId(raw: string): 'createdAt' | 'model' | 'creditsUsed' {
  const s = (raw ?? 'createdAt').trim().toLowerCase();
  if (s === 'model') return 'model';
  if (s === 'creditsused') return 'creditsUsed';
  return 'createdAt';
}

export const getTaskStats = createServerFn({ method: 'GET' })
  .middleware([adminApiMiddleware])
  .handler(async () => {
    const db = getDb();

    const [totalResult, processingResult, completedResult, failedResult] =
      await Promise.all([
        db.select({ count: countFn() }).from(generationHistory),
        db
          .select({ count: countFn() })
          .from(generationHistory)
          .where(
            or(
              eq(generationHistory.status, 'pending'),
              eq(generationHistory.status, 'processing')
            )
          ),
        db
          .select({ count: countFn() })
          .from(generationHistory)
          .where(eq(generationHistory.status, 'completed')),
        db
          .select({ count: countFn() })
          .from(generationHistory)
          .where(eq(generationHistory.status, 'failed')),
      ]);

    return {
      total: Number(totalResult[0].count),
      processing: Number(processingResult[0].count),
      completed: Number(completedResult[0].count),
      failed: Number(failedResult[0].count),
    };
  });

const listTasksInputSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
  search: z.string(),
  sortId: z.string(),
  sortDesc: z.boolean(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  model: z.string().optional(),
  type: z.string().optional(),
  resolution: z.string().optional(),
  quality: z.string().optional(),
  aspectRatio: z.string().optional(),
  provider: z.enum(['fal', 'apimart', 'kie']).optional(),
  errorCategory: z.string().optional(),
});

export const listTasks = createServerFn({ method: 'GET' })
  .validator(listTasksInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    const {
      pageIndex,
      pageSize,
      search,
      sortDesc,
      status,
      model,
      type,
      resolution,
      quality,
      aspectRatio,
      provider,
      errorCategory,
    } = data;
    const offset = pageIndex * pageSize;
    const sortId = normalizeSortId(data.sortId);

    const conditions = [];
    if (search.trim()) {
      const escaped = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;
      conditions.push(
        or(
          sql`lower(${generationHistory.prompt}) like lower(${pattern})`,
          sql`lower(${user.name}) like lower(${pattern})`
        )
      );
    }
    if (status) {
      conditions.push(eq(generationHistory.status, status));
    }
    if (model?.trim()) {
      conditions.push(eq(generationHistory.model, model.trim()));
    }
    if (type?.trim()) {
      conditions.push(
        eq(
          generationHistory.type,
          type.trim() as 'text-to-image' | 'image-to-image' | 'edit'
        )
      );
    }
    if (resolution?.trim()) {
      conditions.push(eq(generationHistory.resolution, resolution.trim()));
    }
    if (quality?.trim()) {
      conditions.push(eq(generationHistory.quality, quality.trim()));
    }
    if (aspectRatio?.trim()) {
      conditions.push(eq(generationHistory.aspectRatio, aspectRatio.trim()));
    }
    if (provider) {
      conditions.push(eq(generationHistory.provider, provider));
    }
    if (errorCategory?.trim()) {
      conditions.push(
        eq(
          generationHistory.errorCategory,
          errorCategory.trim() as ErrorCategory
        )
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortField = SORT_FIELD_MAP[sortId] ?? generationHistory.createdAt;
    const sortDirection = sortDesc ? desc : asc;

    const selectQuery = db
      .select({
        id: generationHistory.id,
        userId: generationHistory.userId,
        type: generationHistory.type,
        prompt: generationHistory.prompt,
        model: generationHistory.model,
        resolution: generationHistory.resolution,
        quality: generationHistory.quality,
        aspectRatio: generationHistory.aspectRatio,
        referenceFileId: generationHistory.referenceFileId,
        sourcePromptId: generationHistory.sourcePromptId,
        outputImageKey: generationHistory.outputImageKey,
        creditsUsed: generationHistory.creditsUsed,
        status: generationHistory.status,
        errorMessage: generationHistory.errorMessage,
        errorCategory: generationHistory.errorCategory,
        providerResponse: generationHistory.providerResponse,
        workflowInstanceId: generationHistory.workflowInstanceId,
        provider: generationHistory.provider,
        taskId: generationHistory.taskId,
        startedAt: generationHistory.startedAt,
        completedAt: generationHistory.completedAt,
        isPublic: generationHistory.isPublic,
        moderationStatus: generationHistory.moderationStatus,
        moderationReason: generationHistory.moderationReason,
        moderatedAt: generationHistory.moderatedAt,
        createdAt: generationHistory.createdAt,
        userName: user.name,
        userImage: user.image,
      })
      .from(generationHistory)
      .leftJoin(user, eq(generationHistory.userId, user.id))
      .where(where)
      .orderBy(sortDirection(sortField))
      .limit(pageSize)
      .offset(offset);
    const countQuery = db
      .select({ count: countFn() })
      .from(generationHistory)
      .leftJoin(user, eq(generationHistory.userId, user.id))
      .where(where);

    const [items, [{ count }]] = await Promise.all([selectQuery, countQuery]);

    return {
      items,
      total: Number(count),
    };
  });

// ─── Task Detail ────────────────────────────────────────────────────────────

export interface TaskTimelineEvent {
  timestamp: number;
  event: string;
  detail: string;
  status: 'success' | 'error' | 'info' | 'warning';
}

export interface TaskDetailResult {
  task: {
    id: string;
    userId: string;
    userName: string | null;
    userImage: string | null;
    type: string;
    prompt: string;
    model: string;
    resolution: string;
    quality: string | null;
    aspectRatio: string;
    sourcePromptId: number | null;
    creditsUsed: number;
    status: string;
    errorMessage: string | null;
    providerResponse: string | null;
    errorCategory: string | null;
    workflowInstanceId: string | null;
    provider: string | null;
    taskId: string | null;
    startedAt: number | null;
    providerSubmittedAt: number | null;
    providerCompletedAt: number | null;
    r2StartedAt: number | null;
    r2CompletedAt: number | null;
    completedAt: number | null;
    refundedAt: number | null;
    pollAttempts: number | null;
    createdAt: number;
    outputImageKey: string | null;
    outputExternalUrl: string | null;
  };
  timeline: TaskTimelineEvent[];
  creditTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: number;
    relatedTransactionId: string | null;
  }>;
}

const taskDetailSchema = z.object({
  id: z.string().min(1),
});

export const getTaskDetail = createServerFn({ method: 'GET' })
  .validator(taskDetailSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }): Promise<TaskDetailResult | null> => {
    const db = getDb();

    // 1. Fetch the generation_history row
    const rows = await db
      .select({
        id: generationHistory.id,
        userId: generationHistory.userId,
        type: generationHistory.type,
        prompt: generationHistory.prompt,
        model: generationHistory.model,
        resolution: generationHistory.resolution,
        quality: generationHistory.quality,
        aspectRatio: generationHistory.aspectRatio,
        sourcePromptId: generationHistory.sourcePromptId,
        creditsUsed: generationHistory.creditsUsed,
        status: generationHistory.status,
        errorMessage: generationHistory.errorMessage,
        errorCategory: generationHistory.errorCategory,
        providerResponse: generationHistory.providerResponse,
        workflowInstanceId: generationHistory.workflowInstanceId,
        provider: generationHistory.provider,
        taskId: generationHistory.taskId,
        startedAt: generationHistory.startedAt,
        providerSubmittedAt: generationHistory.providerSubmittedAt,
        providerCompletedAt: generationHistory.providerCompletedAt,
        r2StartedAt: generationHistory.r2StartedAt,
        r2CompletedAt: generationHistory.r2CompletedAt,
        completedAt: generationHistory.completedAt,
        refundedAt: generationHistory.refundedAt,
        pollAttempts: generationHistory.pollAttempts,
        createdAt: generationHistory.createdAt,
        outputImageKey: generationHistory.outputImageKey,
        outputExternalUrl: generationHistory.outputExternalUrl,
        userName: user.name,
        userImage: user.image,
      })
      .from(generationHistory)
      .leftJoin(user, eq(generationHistory.userId, user.id))
      .where(eq(generationHistory.id, data.id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const toMs = (v: Date | number | null): number | null => {
      if (v === null) return null;
      return v instanceof Date ? v.getTime() : v;
    };

    const createdAtMs = toMs(row.createdAt) ?? 0;
    const startedAtMs = toMs(row.startedAt);
    const submittedAtMs = toMs(row.providerSubmittedAt);
    const providerCompletedAtMs = toMs(row.providerCompletedAt);
    const r2StartedAtMs = toMs(row.r2StartedAt);
    const r2CompletedAtMs = toMs(row.r2CompletedAt);
    const completedAtMs = toMs(row.completedAt);
    const refundedAtMs = toMs(row.refundedAt);

    // 2. Find related credit transactions (USAGE within ±2s of createdAt, and REFUND linked to it)
    const usageWindow = 2000; // ms
    const relatedCredits = await db
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, row.userId),
          or(
            // USAGE transaction near task creation time
            and(
              eq(creditTransaction.type, 'USAGE'),
              gte(
                creditTransaction.createdAt,
                new Date(createdAtMs - usageWindow)
              ),
              lte(
                creditTransaction.createdAt,
                new Date(createdAtMs + usageWindow)
              )
            ),
            // REFUND transactions (we'll filter by relatedTransactionId below)
            eq(creditTransaction.type, 'REFUND')
          )
        )
      )
      .orderBy(asc(creditTransaction.createdAt));

    // Find the most likely USAGE transaction (closest to createdAt)
    const usageTx = relatedCredits.find((tx) => tx.type === 'USAGE');
    // Find REFUND linked to that USAGE
    const refundTx = usageTx
      ? relatedCredits.find(
          (tx) => tx.type === 'REFUND' && tx.relatedTransactionId === usageTx.id
        )
      : undefined;

    const relevantCredits = [usageTx, refundTx].filter(Boolean) as Array<
      (typeof relatedCredits)[number]
    >;

    // 3. Build timeline
    const timeline: TaskTimelineEvent[] = [];

    timeline.push({
      timestamp: createdAtMs,
      event: 'Task Created',
      detail: `Status: pending | Model: ${row.model} | Provider: ${row.provider ?? 'unknown'}`,
      status: 'info',
    });

    if (usageTx) {
      const usageCreatedAt = toMs(usageTx.createdAt) ?? createdAtMs;
      timeline.push({
        timestamp: usageCreatedAt,
        event: 'Credits Consumed',
        detail: `${Math.abs(usageTx.amount)} credit(s) deducted`,
        status: 'warning',
      });
    }

    if (startedAtMs) {
      timeline.push({
        timestamp: startedAtMs,
        event: 'Processing Started',
        detail: 'Workflow consumed credits and marked status as processing',
        status: 'info',
      });
    }

    if (submittedAtMs) {
      timeline.push({
        timestamp: submittedAtMs,
        event: 'Submitted to Provider',
        detail: `Request submitted to ${row.provider ?? 'unknown'}`,
        status: 'info',
      });
    }

    if (row.taskId && submittedAtMs) {
      timeline.push({
        timestamp: submittedAtMs + 50,
        event: 'Provider Task Assigned',
        detail: `Task ID: ${row.taskId}`,
        status: 'info',
      });
    }

    if (row.pollAttempts && row.pollAttempts > 0 && submittedAtMs) {
      timeline.push({
        timestamp: submittedAtMs + 100,
        event: 'Polling Provider',
        detail: `Polled ${row.pollAttempts} time(s) with ${row.provider === 'apimart' ? '10s initial + 3s' : '3s'} interval`,
        status: 'info',
      });
    }

    if (providerCompletedAtMs) {
      const providerLatency = submittedAtMs
        ? providerCompletedAtMs - submittedAtMs
        : null;
      timeline.push({
        timestamp: providerCompletedAtMs,
        event: 'Provider Completed',
        detail: providerLatency
          ? `Image generated in ${formatLatency(providerLatency)} (${row.pollAttempts ?? 0} polls)`
          : 'Provider returned generated image',
        status: 'success',
      });
    }

    if (completedAtMs && row.status === 'completed') {
      timeline.push({
        timestamp: completedAtMs,
        event: 'Image Available',
        detail: row.outputExternalUrl
          ? 'External URL available for preview (early-finalize)'
          : 'Generation marked as completed',
        status: 'success',
      });
    }

    if (r2StartedAtMs) {
      timeline.push({
        timestamp: r2StartedAtMs,
        event: 'R2 Upload Started',
        detail: 'Downloading image from provider and uploading to R2',
        status: 'info',
      });
    }

    if (r2CompletedAtMs) {
      const r2Latency = r2StartedAtMs ? r2CompletedAtMs - r2StartedAtMs : null;
      timeline.push({
        timestamp: r2CompletedAtMs,
        event: 'R2 Upload Completed',
        detail: r2Latency
          ? `Saved to R2 in ${formatLatency(r2Latency)} | Key: ${row.outputImageKey ?? 'unknown'}`
          : `Saved to R2 | Key: ${row.outputImageKey ?? 'unknown'}`,
        status: 'success',
      });
    }

    // Show R2 failure if completed but no R2 key and no r2CompletedAt
    if (
      row.status === 'completed' &&
      !row.outputImageKey &&
      !r2CompletedAtMs &&
      completedAtMs
    ) {
      timeline.push({
        timestamp: completedAtMs + 100,
        event: 'R2 Upload Failed',
        detail:
          'Image saved to external URL only (R2 persistence failed, non-fatal)',
        status: 'warning',
      });
    }

    if (completedAtMs && row.status === 'failed') {
      timeline.push({
        timestamp: completedAtMs,
        event: 'Generation Failed',
        detail: row.errorCategory
          ? `[${row.errorCategory}] ${row.errorMessage ?? 'Unknown error'}`
          : (row.errorMessage ?? 'Unknown error'),
        status: 'error',
      });
    }

    if (refundedAtMs) {
      timeline.push({
        timestamp: refundedAtMs,
        event: 'Credits Refunded',
        detail: refundTx
          ? `${refundTx.amount} credit(s) returned`
          : 'Credits returned to user',
        status: 'success',
      });
    } else if (refundTx) {
      const refundCreatedAt = toMs(refundTx.createdAt) ?? completedAtMs ?? 0;
      timeline.push({
        timestamp: refundCreatedAt,
        event: 'Credits Refunded',
        detail: `${refundTx.amount} credit(s) returned`,
        status: 'success',
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return {
      task: {
        id: row.id,
        userId: row.userId,
        userName: row.userName,
        userImage: row.userImage,
        type: row.type,
        prompt: row.prompt,
        model: row.model,
        resolution: row.resolution,
        quality: row.quality,
        aspectRatio: row.aspectRatio,
        sourcePromptId: row.sourcePromptId,
        creditsUsed: row.creditsUsed,
        status: row.status,
        errorMessage: row.errorMessage,
        errorCategory: row.errorCategory,
        providerResponse: row.providerResponse,
        workflowInstanceId: row.workflowInstanceId,
        provider: row.provider,
        taskId: row.taskId,
        startedAt: startedAtMs,
        providerSubmittedAt: submittedAtMs,
        providerCompletedAt: providerCompletedAtMs,
        r2StartedAt: r2StartedAtMs,
        r2CompletedAt: r2CompletedAtMs,
        completedAt: completedAtMs,
        refundedAt: refundedAtMs,
        pollAttempts: row.pollAttempts,
        createdAt: createdAtMs,
        outputImageKey: row.outputImageKey,
        outputExternalUrl: row.outputExternalUrl,
      },
      timeline,
      creditTransactions: relevantCredits.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        createdAt: toMs(tx.createdAt) ?? 0,
        relatedTransactionId: tx.relatedTransactionId,
      })),
    };
  });

// ─── Force Fail Task ────────────────────────────────────────────────────────

const forceFailTaskSchema = z.object({
  id: z.string().min(1),
});

/**
 * Admin action: force a stuck (processing/pending) task to failed status
 * and refund credits to the user.
 */
export const forceFailTask = createServerFn({ method: 'POST' })
  .validator(forceFailTaskSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();

    // 1. Fetch the task
    const rows = await db
      .select()
      .from(generationHistory)
      .where(eq(generationHistory.id, data.id))
      .limit(1);

    const task = rows[0];
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status !== 'processing' && task.status !== 'pending') {
      throw new Error(
        `Cannot force-fail a task with status "${task.status}". Only processing/pending tasks can be force-failed.`
      );
    }

    // 2. Find the USAGE transaction to refund
    const usageWindow = 2000;
    const taskCreatedAt =
      task.createdAt instanceof Date
        ? task.createdAt.getTime()
        : task.createdAt;

    const usageTransactions = await db
      .select()
      .from(creditTransaction)
      .where(
        and(
          eq(creditTransaction.userId, task.userId),
          eq(creditTransaction.type, 'USAGE'),
          gte(
            creditTransaction.createdAt,
            new Date(taskCreatedAt - usageWindow)
          ),
          lte(
            creditTransaction.createdAt,
            new Date(taskCreatedAt + usageWindow)
          )
        )
      )
      .orderBy(asc(creditTransaction.createdAt))
      .limit(1);

    const usageTx = usageTransactions[0];
    let refundedAt: Date | null = null;

    // 3. Refund credits if we found the usage transaction
    if (usageTx) {
      try {
        await refundCredits(
          task.userId,
          usageTx.id,
          'Admin force-fail: task stuck in processing'
        );
        refundedAt = new Date();
      } catch (err) {
        // Refund may already exist (idempotent), continue marking as failed
        logOperationalEvent.error(
          '[force-fail] refund error (may be duplicate):',
          err instanceof Error ? err.message : err
        );
        refundedAt = new Date();
      }
    }

    // 4. Mark the task as failed
    const now = new Date();
    await db
      .update(generationHistory)
      .set({
        status: 'failed',
        errorMessage: 'Manually marked as failed by admin (task was stuck)',
        errorCategory: ErrorCategory.UNKNOWN,
        completedAt: now,
        refundedAt,
      })
      .where(eq(generationHistory.id, data.id));

    return { success: true, refunded: !!usageTx };
  });
