import { createServerFn } from '@tanstack/react-start';
import { adminApiMiddleware } from '@/middlewares/admin-middleware';
import { getDb } from '@/db';
import { redemptionCode, redemptionRecord } from '@/db/app.schema';
import { user } from '@/db/auth.schema';
import { and, asc, count as countFn, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  createRedemptionCode,
  generateRedemptionCode,
} from '@/credits/redemption';

// ─── List Redemption Codes ───────────────────────────────────────────────────

const listCodesInputSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
  search: z.string(),
  sortId: z.string(),
  sortDesc: z.boolean(),
  status: z.enum(['active', 'disabled']).optional(),
});

const CODE_SORT_FIELDS = {
  createdAt: redemptionCode.createdAt,
  code: redemptionCode.code,
  creditsAmount: redemptionCode.creditsAmount,
  redemptionsCount: redemptionCode.redemptionsCount,
} as Record<string, any>;

export const listRedemptionCodes = createServerFn({ method: 'GET' })
  .validator(listCodesInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    const { pageIndex, pageSize, search, sortId, sortDesc, status } = data;
    const offset = pageIndex * pageSize;

    const conditions = [];
    if (search.trim()) {
      const escaped = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;
      conditions.push(
        or(
          sql`lower(${redemptionCode.code}) like lower(${pattern})`,
          sql`lower(${redemptionCode.note}) like lower(${pattern})`
        )
      );
    }
    if (status === 'active') {
      conditions.push(eq(redemptionCode.disabled, false));
    } else if (status === 'disabled') {
      conditions.push(eq(redemptionCode.disabled, true));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortField = CODE_SORT_FIELDS[sortId] ?? redemptionCode.createdAt;
    const sortDirection = sortDesc ? desc : asc;

    const [items, [{ count }]] = await Promise.all([
      db
        .select({
          id: redemptionCode.id,
          code: redemptionCode.code,
          creditsAmount: redemptionCode.creditsAmount,
          maxRedemptions: redemptionCode.maxRedemptions,
          redemptionsCount: redemptionCode.redemptionsCount,
          perUserLimit: redemptionCode.perUserLimit,
          expiresAt: redemptionCode.expiresAt,
          creditExpiresAt: redemptionCode.creditExpiresAt,
          boundUserId: redemptionCode.boundUserId,
          note: redemptionCode.note,
          disabled: redemptionCode.disabled,
          createdAt: redemptionCode.createdAt,
        })
        .from(redemptionCode)
        .where(where)
        .orderBy(sortDirection(sortField))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: countFn() }).from(redemptionCode).where(where),
    ]);

    return { items, total: Number(count) };
  });

// ─── Create Redemption Code ─────────────────────────────────────────────────

const createCodeInputSchema = z.object({
  code: z.string().min(1).max(32),
  creditsAmount: z.number().int().min(1),
  maxRedemptions: z.number().int().min(1).nullable(),
  perUserLimit: z.number().int().min(1).default(1),
  expiresAt: z.string().nullable(), // ISO string or null
  creditExpiresAt: z.string().nullable(),
  boundUserId: z.string().nullable(),
  note: z.string().nullable(),
});

export const createRedemptionCodeFn = createServerFn({ method: 'POST' })
  .validator(createCodeInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data, context }) => {
    const { userId: adminUserId } = context;
    const codeId = await createRedemptionCode({
      code: data.code.toUpperCase().trim(),
      creditsAmount: data.creditsAmount,
      maxRedemptions: data.maxRedemptions ?? undefined,
      perUserLimit: data.perUserLimit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      creditExpiresAt: data.creditExpiresAt
        ? new Date(data.creditExpiresAt)
        : undefined,
      boundUserId: data.boundUserId ?? undefined,
      note: data.note ?? undefined,
      createdBy: adminUserId,
    });
    return { id: codeId };
  });

// ─── Generate Random Code ───────────────────────────────────────────────────

export const generateCodeFn = createServerFn({ method: 'GET' })
  .middleware([adminApiMiddleware])
  .handler(async () => {
    return { code: generateRedemptionCode(8) };
  });

// ─── Toggle Redemption Code (enable/disable) ────────────────────────────────

const toggleCodeInputSchema = z.object({
  id: z.string(),
  disabled: z.boolean(),
});

export const toggleRedemptionCodeFn = createServerFn({ method: 'POST' })
  .validator(toggleCodeInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .update(redemptionCode)
      .set({ disabled: data.disabled, updatedAt: new Date() })
      .where(eq(redemptionCode.id, data.id));
    return { success: true };
  });

// ─── List Redemption Records ────────────────────────────────────────────────

const listRecordsInputSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
  search: z.string(),
});

export const listRedemptionRecords = createServerFn({ method: 'GET' })
  .validator(listRecordsInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    const { pageIndex, pageSize, search } = data;
    const offset = pageIndex * pageSize;

    const conditions = [];
    if (search.trim()) {
      const escaped = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const pattern = `%${escaped}%`;
      conditions.push(
        or(
          sql`lower(${redemptionCode.code}) like lower(${pattern})`,
          sql`lower(${user.name}) like lower(${pattern})`
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, [{ count }]] = await Promise.all([
      db
        .select({
          id: redemptionRecord.id,
          code: redemptionCode.code,
          userName: user.name,
          userImage: user.image,
          creditsGranted: redemptionRecord.creditsGranted,
          createdAt: redemptionRecord.createdAt,
        })
        .from(redemptionRecord)
        .leftJoin(
          redemptionCode,
          eq(redemptionRecord.codeId, redemptionCode.id)
        )
        .leftJoin(user, eq(redemptionRecord.userId, user.id))
        .where(where)
        .orderBy(desc(redemptionRecord.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: countFn() })
        .from(redemptionRecord)
        .leftJoin(
          redemptionCode,
          eq(redemptionRecord.codeId, redemptionCode.id)
        )
        .leftJoin(user, eq(redemptionRecord.userId, user.id))
        .where(where),
    ]);

    return { items, total: Number(count) };
  });
