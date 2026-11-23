// How many videos an account may have generating at once, by plan tier.
import { and, eq, gt, inArray, sql } from "drizzle-orm";

import {
  PLAN_PERKS,
  SUBSCRIPTION_PRODUCTS,
  planTierOfName,
  type PlanTier,
} from "@/config/pricing-user";
import {
  CreditTransType,
  VideoStatus,
  creditPackages,
  creditTransactions,
  db,
  videos,
} from "@/db";
import { ApiError } from "@/lib/api/error";
import { isFreeInternalAccount } from "@/lib/internal-test-account";

const TIER_RANK: Record<PlanTier, number> = { free: 0, basic: 1, pro: 2, ultimate: 3 };

/**
 * A row still "in progress" after this long is treated as stuck and stops
 * counting, so one lost callback cannot lock an account out for good.
 */
export const ACTIVE_GENERATION_WINDOW_MS = 2 * 60 * 60 * 1000;

export function concurrencyLimitFor(tier: PlanTier): number {
  return PLAN_PERKS[tier].concurrency;
}

/**
 * Tier of one subscription credit grant. The grant does not store the product
 * id; the audit row's remark ends with the product name ("Stripe payment:
 * Pro Plan"), and every subscription product grants a distinct credit amount,
 * which is the fallback when the remark does not name a known product.
 */
export function planTierOfGrant(grant: {
  remark?: string | null;
  initialCredits?: number | null;
}): Exclude<PlanTier, "free"> {
  const label = (grant.remark ?? "").replace(/^[^:]*:\s*/, "").trim();
  const product =
    SUBSCRIPTION_PRODUCTS.find((item) => item.name === label || item.id === label) ??
    SUBSCRIPTION_PRODUCTS.find((item) => item.credits === grant.initialCredits);
  if (product) return planTierOfName(product.name);
  return /^(basic|pro|ultimate)/i.test(label) ? planTierOfName(label) : "basic";
}

/**
 * The account's current tier: the highest tier among its subscription credit
 * grants that have not expired and were not refunded. No such grant is "free".
 */
export async function getUserPlanTier(userId: string, now: Date = new Date()): Promise<PlanTier> {
  if (await isFreeInternalAccount(userId)) return "ultimate";
  const grants = await db
    .select({
      id: creditPackages.id,
      initialCredits: creditPackages.initialCredits,
      remark: creditTransactions.remark,
    })
    .from(creditPackages)
    .leftJoin(
      creditTransactions,
      and(
        eq(creditTransactions.orderNo, creditPackages.orderNo),
        eq(creditTransactions.transType, CreditTransType.SUBSCRIPTION),
      ),
    )
    .where(
      and(
        eq(creditPackages.userId, userId),
        eq(creditPackages.transType, CreditTransType.SUBSCRIPTION),
        gt(creditPackages.expiredAt, now),
      ),
    );
  if (grants.length === 0) return "free";

  const refunded = await db
    .select({ packageId: creditTransactions.packageId })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.transType, CreditTransType.REFUND),
        inArray(
          creditTransactions.packageId,
          grants.map((grant) => grant.id),
        ),
      ),
    );
  const refundedIds = new Set(refunded.map((row) => row.packageId));

  let tier: PlanTier = "free";
  for (const grant of grants) {
    if (refundedIds.has(grant.id)) continue;
    const candidate = planTierOfGrant(grant);
    if (TIER_RANK[candidate] > TIER_RANK[tier]) tier = candidate;
  }
  return tier;
}

/** Videos (not images or audio) the account has in progress right now. */
export async function countActiveGenerations(userId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(videos)
    .where(
      and(
        eq(videos.userId, userId),
        eq(videos.mediaType, "video"),
        inArray(videos.status, [VideoStatus.PENDING, VideoStatus.GENERATING, VideoStatus.UPLOADING]),
        gt(videos.createdAt, new Date(now.getTime() - ACTIVE_GENERATION_WINDOW_MS)),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Throws a 429 ApiError when the account is already at its tier's limit. */
export async function assertWithinConcurrencyLimit(userId: string): Promise<void> {
  const active = await countActiveGenerations(userId);
  // Every tier allows at least one, so an idle account needs no tier lookup.
  if (active === 0) return;
  const tier = await getUserPlanTier(userId);
  const limit = concurrencyLimitFor(tier);
  if (active >= limit) {
    throw new ApiError(
      `You already have ${limit} video${limit === 1 ? "" : "s"} generating. Wait for one to finish, or upgrade for more at once.`,
      429,
      { code: "CONCURRENCY_LIMIT", limit, tier },
    );
  }
}
