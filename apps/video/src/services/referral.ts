import { and, desc, eq } from "drizzle-orm";

import { getReferralConfig } from "@/config/referral";
import { db } from "@/db";
import {
  CreditTransType,
  referralCodes,
  referrals,
  users,
} from "@/db/schema";
import {
  generateCode,
  isSelfReferral,
  isUndefinedTableError,
  isValidCode,
  maskEmail,
  normalizeEmail,
  parseRefCookie,
} from "@/lib/referral";
import { creditService } from "@/services/credit";

const CODE_INSERT_ATTEMPTS = 5;

const REFERRAL_PENDING = "PENDING";
const REFERRAL_REWARDED = "REWARDED";

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  if ((error as { code?: unknown }).code === "23505") return true;

  const cause = (error as { cause?: unknown }).cause;
  return (
    !!cause &&
    typeof cause === "object" &&
    (cause as { code?: unknown }).code === "23505"
  );
}

export interface ReferralRecordView {
  id: number;
  inviteeEmailMasked: string;
  status: string;
  createdAt: Date;
  rewardedAt: Date | null;
}

export type ReferralListResult =
  | {
      available: true;
      code: string;
      records: ReferralRecordView[];
    }
  | {
      available: false;
      code: null;
      records: ReferralRecordView[];
    };

/**
 * Grants credits exactly once per `orderNo`.
 * A duplicate order number means the reward was already granted, so it is a
 * no-op rather than an error.
 */
async function grantRewardOnce(params: {
  userId: string;
  credits: number;
  orderNo: string;
  expiryDays: number;
}): Promise<void> {
  try {
    await creditService.recharge({
      userId: params.userId,
      credits: params.credits,
      orderNo: params.orderNo,
      transType: CreditTransType.SYSTEM_ADJUST,
      expiryDays: params.expiryDays,
      remark: "Referral reward",
    });
  } catch (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }
}

export class ReferralService {
  /**
   * Returns the user's referral code, creating one if needed.
   * Returns null when the referral tables are not available.
   */
  async getOrCreateCode(userId: string): Promise<string | null> {
    try {
      const [existing] = await db
        .select({ code: referralCodes.code })
        .from(referralCodes)
        .where(eq(referralCodes.userId, userId))
        .limit(1);

      if (existing) return existing.code;

      for (let attempt = 0; attempt < CODE_INSERT_ATTEMPTS; attempt++) {
        const code = generateCode();

        // `DO NOTHING` covers both a concurrent insert for this user and a
        // code collision; the read-back below resolves which one happened.
        await db
          .insert(referralCodes)
          .values({ userId, code })
          .onConflictDoNothing();

        const [row] = await db
          .select({ code: referralCodes.code })
          .from(referralCodes)
          .where(eq(referralCodes.userId, userId))
          .limit(1);

        if (row) return row.code;
      }

      return null;
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.warn(
          "[Referral] referral tables unavailable, skipping code generation"
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Attaches an invitee to an inviter based on the referral cookie.
   * Best-effort: self-referrals, duplicates and missing tables are no-ops.
   */
  async attachFromCookieHeader(
    userId: string,
    cookieHeader: string | null | undefined
  ): Promise<void> {
    const code = parseRefCookie(cookieHeader);
    if (!code || !isValidCode(code)) return;

    try {
      const [entry] = await db
        .select({ userId: referralCodes.userId })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);

      if (!entry) return;

      const inviterId = entry.userId;
      if (inviterId === userId) return;

      const [invitee] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const inviteeEmail = invitee?.email ?? null;
      if (!inviteeEmail) return;

      const [inviter] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, inviterId))
        .limit(1);

      if (
        isSelfReferral({
          inviterId,
          inviteeId: userId,
          inviterEmail: inviter?.email ?? null,
          inviteeEmail,
        })
      ) {
        return;
      }

      const [existing] = await db
        .select({ id: referrals.id })
        .from(referrals)
        .where(eq(referrals.inviteeUserId, userId))
        .limit(1);

      if (existing) return;

      const inviteeEmailNorm = normalizeEmail(inviteeEmail);

      const [emailUsed] = await db
        .select({ id: referrals.id })
        .from(referrals)
        .where(eq(referrals.inviteeEmailNorm, inviteeEmailNorm))
        .limit(1);

      if (emailUsed) return;

      await db.insert(referrals).values({
        inviterUserId: inviterId,
        inviteeUserId: userId,
        inviteeEmailNorm,
        status: REFERRAL_PENDING,
      });
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.warn("[Referral] referral tables unavailable, skipping attach");
        return;
      }
      if (isUniqueViolation(error)) return;
      throw error;
    }
  }

  /**
   * Rewards the inviter and invitee once the invitee makes a first payment.
   * Leaves the referral `PENDING` when rewards are disabled.
   */
  async rewardOnFirstPayment(userId: string): Promise<void> {
    try {
      const [referral] = await db
        .select()
        .from(referrals)
        .where(
          and(
            eq(referrals.inviteeUserId, userId),
            eq(referrals.status, REFERRAL_PENDING)
          )
        )
        .limit(1);

      if (!referral) return;

      const config = getReferralConfig();
      if (!config.enabled) {
        console.log(
          `[Referral] Rewards disabled, leaving referral ${referral.id} pending`
        );
        return;
      }

      await grantRewardOnce({
        userId: referral.inviterUserId,
        credits: config.inviterCredits,
        orderNo: `REF_INVITER_${referral.id}`,
        expiryDays: config.expiryDays,
      });

      await grantRewardOnce({
        userId: referral.inviteeUserId,
        credits: config.inviteeCredits,
        orderNo: `REF_INVITEE_${referral.id}`,
        expiryDays: config.expiryDays,
      });

      await db
        .update(referrals)
        .set({ status: REFERRAL_REWARDED, rewardedAt: new Date() })
        .where(eq(referrals.id, referral.id));
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.warn("[Referral] referral tables unavailable, skipping reward");
        return;
      }
      throw error;
    }
  }

  /**
   * Lists the inviter's referrals for the dashboard. The link itself is built
   * by the API layer, not here.
   */
  async listForInviter(userId: string): Promise<ReferralListResult> {
    try {
      const code = await this.getOrCreateCode(userId);
      if (!code) {
        return { available: false, code: null, records: [] };
      }

      const rows = await db
        .select({
          id: referrals.id,
          status: referrals.status,
          createdAt: referrals.createdAt,
          rewardedAt: referrals.rewardedAt,
          inviteeEmail: users.email,
        })
        .from(referrals)
        .leftJoin(users, eq(users.id, referrals.inviteeUserId))
        .where(eq(referrals.inviterUserId, userId))
        .orderBy(desc(referrals.createdAt));

      return {
        available: true,
        code,
        records: rows.map((row) => ({
          id: row.id,
          inviteeEmailMasked: row.inviteeEmail ? maskEmail(row.inviteeEmail) : "",
          status: row.status,
          createdAt: row.createdAt,
          rewardedAt: row.rewardedAt,
        })),
      };
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.warn("[Referral] referral tables unavailable, skipping list");
        return { available: false, code: null, records: [] };
      }
      throw error;
    }
  }
}

export const referralService = new ReferralService();
