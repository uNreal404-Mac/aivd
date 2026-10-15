import { createServerFn } from '@tanstack/react-start';
import {
  and,
  asc,
  count as countFn,
  desc,
  eq,
  inArray,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import {
  imagePrompt,
  imagePromptCategory,
  imagePromptMedia,
  imagePromptToCategory,
} from '@/db/app.schema';
import { buildStorageFileUrl } from '@/lib/image-url-server';
import { adminApiMiddleware } from '@/middlewares/admin-middleware';

type PromptModel = 'gptimage' | 'nanobanana';

export interface AdminPromptItem {
  id: number;
  externalId: string;
  model: string;
  prompt: string;
  likes: number;
  views: number;
  date: string;
  authorHandle: string | null;
  authorName: string | null;
  sourceUrl: string | null;
  createdAt: Date;
  mediaCount: number;
  thumbnailUrl: string | null;
  mediaUrls: string[];
  categorySlugs: string[];
}

export interface PromptPreviewImage {
  r2Key: string;
  url?: string;
  width?: number;
  height?: number;
  altText?: string;
}

export interface AdminPromptDetail {
  id: number;
  externalId: string;
  sourceUrl: string;
  model: PromptModel;
  prompt: string;
  authorHandle?: string;
  authorName?: string;
  likes: number;
  views: number;
  date: string;
  categorySlugs: string[];
  images: PromptPreviewImage[];
}

const SORT_FIELD_MAP = {
  createdAt: imagePrompt.createdAt,
  date: imagePrompt.date,
  views: imagePrompt.views,
  likes: imagePrompt.likes,
} as Record<string, any>;

const optionalUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || z.url().safeParse(value).success, {
    message: 'Invalid source URL.',
  })
  .optional();

const promptImageInputSchema = z.object({
  r2Key: z.string().trim().min(1).max(500),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const savePromptInputSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  sourceUrl: optionalUrlSchema,
  model: z.enum(['gptimage', 'nanobanana']),
  prompt: z.string().trim().min(1).max(20_000),
  authorHandle: z.string().trim().max(100).optional(),
  authorName: z.string().trim().max(200).optional(),
  likes: z.number().int().min(0).default(0),
  views: z.number().int().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categorySlugs: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
  images: z.array(promptImageInputSchema).max(12).default([]),
});

const listPromptsInputSchema = z.object({
  pageIndex: z.number().int().min(0),
  pageSize: z.number().int().min(1).max(100),
  search: z.string(),
  model: z.string().optional().default(''),
  category: z.string().optional().default(''),
  sortId: z.string(),
  sortDesc: z.boolean(),
});

function buildPromptImageUrl(r2Key: string | null): string | null {
  if (!r2Key) return null;
  return buildStorageFileUrl(r2Key) ?? null;
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function replacePromptCategories(
  promptId: number,
  categorySlugs: string[]
) {
  const db = getDb();
  await db
    .delete(imagePromptToCategory)
    .where(eq(imagePromptToCategory.promptId, promptId));

  for (const slug of categorySlugs) {
    const category = await db
      .select({ id: imagePromptCategory.id })
      .from(imagePromptCategory)
      .where(eq(imagePromptCategory.slug, slug))
      .get();

    if (!category) continue;

    await db
      .insert(imagePromptToCategory)
      .values({ promptId, categoryId: category.id })
      .onConflictDoNothing();
  }
}

async function replacePromptMedia(
  promptId: number,
  images: z.infer<typeof promptImageInputSchema>[]
) {
  const db = getDb();
  await db
    .delete(imagePromptMedia)
    .where(eq(imagePromptMedia.promptId, promptId));

  for (const [index, image] of images.entries()) {
    await db.insert(imagePromptMedia).values({
      promptId,
      r2Key: image.r2Key,
      width: image.width ?? null,
      height: image.height ?? null,
      sort: index,
    });
  }
}

export const listPrompts = createServerFn({ method: 'GET' })
  .validator(listPromptsInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    const { pageIndex, pageSize, search, model, category, sortId, sortDesc } =
      data;
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
          sql`lower(${imagePrompt.prompt}) like lower(${pattern})`,
          sql`lower(${imagePrompt.externalId}) like lower(${pattern})`,
          sql`lower(${imagePrompt.authorHandle}) like lower(${pattern})`,
          sql`lower(${imagePrompt.authorName}) like lower(${pattern})`
        )
      );
    }
    if (model.trim()) {
      conditions.push(eq(imagePrompt.model, model.trim()));
    }

    const trimmedCategory = category.trim();
    if (trimmedCategory) {
      const promptIdsInCategory = db
        .select({ promptId: imagePromptToCategory.promptId })
        .from(imagePromptToCategory)
        .innerJoin(
          imagePromptCategory,
          eq(imagePromptCategory.id, imagePromptToCategory.categoryId)
        )
        .where(eq(imagePromptCategory.slug, trimmedCategory));
      conditions.push(inArray(imagePrompt.id, promptIdsInCategory));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortField = SORT_FIELD_MAP[sortId] ?? imagePrompt.createdAt;
    const sortDirection = sortDesc ? desc : asc;
    const mediaCounts = db
      .select({
        promptId: imagePromptMedia.promptId,
        mediaCount: countFn().as('media_count'),
      })
      .from(imagePromptMedia)
      .groupBy(imagePromptMedia.promptId)
      .as('media_counts');

    const firstMediaKey = sql<string | null>`(
      SELECT m.r2_key FROM image_prompt_media m
      WHERE m.prompt_id = ${imagePrompt.id} AND m.sort = 0
      LIMIT 1
    )`;

    const [items, [{ count }]] = await Promise.all([
      db
        .select({
          id: imagePrompt.id,
          externalId: imagePrompt.externalId,
          model: imagePrompt.model,
          prompt: imagePrompt.prompt,
          likes: imagePrompt.likes,
          views: imagePrompt.views,
          date: imagePrompt.date,
          authorHandle: imagePrompt.authorHandle,
          authorName: imagePrompt.authorName,
          sourceUrl: imagePrompt.sourceUrl,
          createdAt: imagePrompt.createdAt,
          mediaCount: sql<number>`coalesce(${mediaCounts.mediaCount}, 0)`,
          thumbnailKey: firstMediaKey,
        })
        .from(imagePrompt)
        .leftJoin(mediaCounts, eq(mediaCounts.promptId, imagePrompt.id))
        .where(where)
        .orderBy(sortDirection(sortField))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: countFn() }).from(imagePrompt).where(where),
    ]);

    const promptIds = items.map((item) => item.id);
    const categoryRows = promptIds.length
      ? await db
          .select({
            promptId: imagePromptToCategory.promptId,
            slug: imagePromptCategory.slug,
          })
          .from(imagePromptToCategory)
          .innerJoin(
            imagePromptCategory,
            eq(imagePromptCategory.id, imagePromptToCategory.categoryId)
          )
          .where(inArray(imagePromptToCategory.promptId, promptIds))
      : [];
    const categoryMap = new Map<number, string[]>();
    for (const row of categoryRows) {
      const list = categoryMap.get(row.promptId) ?? [];
      list.push(row.slug);
      categoryMap.set(row.promptId, list);
    }

    const mediaRows = promptIds.length
      ? await db
          .select({
            promptId: imagePromptMedia.promptId,
            r2Key: imagePromptMedia.r2Key,
            sort: imagePromptMedia.sort,
          })
          .from(imagePromptMedia)
          .where(inArray(imagePromptMedia.promptId, promptIds))
          .orderBy(imagePromptMedia.promptId, asc(imagePromptMedia.sort))
      : [];
    const mediaMap = new Map<number, string[]>();
    for (const row of mediaRows) {
      const url = buildPromptImageUrl(row.r2Key);
      if (!url) continue;
      const list = mediaMap.get(row.promptId) ?? [];
      list.push(url);
      mediaMap.set(row.promptId, list);
    }

    const enriched: AdminPromptItem[] = items.map((item) => ({
      ...item,
      thumbnailUrl: buildPromptImageUrl(item.thumbnailKey),
      mediaUrls: mediaMap.get(item.id) ?? [],
      categorySlugs: categoryMap.get(item.id) ?? [],
    }));

    return { items: enriched, total: Number(count) };
  });

const getPromptInputSchema = z.object({
  id: z.number().int().positive(),
});

export const getPrompt = createServerFn({ method: 'GET' })
  .validator(getPromptInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }): Promise<AdminPromptDetail | null> => {
    const db = getDb();
    const row = await db
      .select({
        id: imagePrompt.id,
        externalId: imagePrompt.externalId,
        model: imagePrompt.model,
        prompt: imagePrompt.prompt,
        likes: imagePrompt.likes,
        views: imagePrompt.views,
        date: imagePrompt.date,
        authorHandle: imagePrompt.authorHandle,
        authorName: imagePrompt.authorName,
        sourceUrl: imagePrompt.sourceUrl,
      })
      .from(imagePrompt)
      .where(eq(imagePrompt.id, data.id))
      .get();

    if (!row) return null;

    const [categoryRows, mediaRows] = await Promise.all([
      db
        .select({ slug: imagePromptCategory.slug })
        .from(imagePromptToCategory)
        .innerJoin(
          imagePromptCategory,
          eq(imagePromptCategory.id, imagePromptToCategory.categoryId)
        )
        .where(eq(imagePromptToCategory.promptId, data.id)),
      db
        .select({
          r2Key: imagePromptMedia.r2Key,
          width: imagePromptMedia.width,
          height: imagePromptMedia.height,
          sort: imagePromptMedia.sort,
        })
        .from(imagePromptMedia)
        .where(eq(imagePromptMedia.promptId, data.id))
        .orderBy(asc(imagePromptMedia.sort)),
    ]);

    return {
      id: row.id,
      externalId: row.externalId,
      sourceUrl: row.sourceUrl ?? '',
      model:
        row.model === 'nanobanana' || row.model === 'gptimage'
          ? row.model
          : 'gptimage',
      prompt: row.prompt,
      authorHandle: row.authorHandle ?? undefined,
      authorName: row.authorName ?? undefined,
      likes: row.likes,
      views: row.views,
      date: row.date,
      categorySlugs: categoryRows.map((category) => category.slug),
      images: mediaRows.map((media, index) => ({
        r2Key: media.r2Key,
        url: buildPromptImageUrl(media.r2Key) ?? undefined,
        altText: `Prompt image ${index + 1}`,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
      })),
    };
  });

const updatePromptInputSchema = savePromptInputSchema.extend({
  id: z.number().int().positive(),
});

export const updatePrompt = createServerFn({ method: 'POST' })
  .validator(updatePromptInputSchema)
  .middleware([adminApiMiddleware])
  .handler(async ({ data }) => {
    const db = getDb();
    const existing = await db
      .select({ id: imagePrompt.id })
      .from(imagePrompt)
      .where(eq(imagePrompt.id, data.id))
      .get();

    if (!existing) {
      throw new Error('Prompt not found.');
    }

    const duplicate = await db
      .select({ id: imagePrompt.id })
      .from(imagePrompt)
      .where(
        and(
          eq(imagePrompt.externalId, data.externalId),
          ne(imagePrompt.id, data.id)
        )
      )
      .get();

    if (duplicate) {
      throw new Error('Another prompt already uses this external ID.');
    }

    await db
      .update(imagePrompt)
      .set({
        externalId: data.externalId,
        model: data.model,
        prompt: data.prompt,
        likes: data.likes,
        views: data.views,
        date: data.date,
        authorHandle: normalizeOptional(data.authorHandle),
        authorName: normalizeOptional(data.authorName),
        sourceUrl: normalizeOptional(data.sourceUrl),
      })
      .where(eq(imagePrompt.id, data.id));

    await replacePromptCategories(data.id, data.categorySlugs);
    await replacePromptMedia(data.id, data.images);

    return { status: 'updated' as const, promptId: data.id };
  });
