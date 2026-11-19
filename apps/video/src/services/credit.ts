import {
  CreditPackageStatus,
  CreditTransType,
  creditHolds,
  creditPackages,
  creditTransactions,
  customers,
  db,
  type CreditPackage,
} from "@/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { CREDITS_CONFIG } from "../config/credits";

// Re-export enums for consumers
export { CreditTransType, CreditPackageStatus };

export interface CreditBalance {
  totalCredits: number; // 总获得积分
  usedCredits: number; // 已消耗积分
  frozenCredits: number; // 冻结中积分
  availableCredits: number; // 可用积分 (total - used - frozen)
  expiringSoon: number; // 即将过期（7天内）
  plan?: "FREE" | "PRO" | "BUSINESS" | null; // 用户订阅计划
}

interface PackageAllocation {
  packageId: number;
  credits: number;
}

type DbReader = Pick<typeof db, "select">;

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:UNIQUE|CHECK) constraint failed/i.test(message);
}

/** Idempotency key for the ledger entry written when a package expires. */
export function expiryOrderNo(packageId: number): string {
  return `EXPIRE_${packageId}`;
}

export class CreditService {
  /**
   * 获取用户积分余额
   */
  async getBalance(userId: string): Promise<CreditBalance> {
    const now = new Date();
    const expiringSoonDate = new Date(
      now.getTime() +
      CREDITS_CONFIG.expiration.warnBeforeDays * 24 * 60 * 60 * 1000
    );

    const packages = await db
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.userId, userId),
          eq(creditPackages.status, CreditPackageStatus.ACTIVE),
          or(
            isNull(creditPackages.expiredAt),
            gt(creditPackages.expiredAt, now)
          )
        )
      )


    const [customer] = await db
      .select({ plan: customers.plan })
      .from(customers)
      .where(eq(customers.authUserId, userId))
      .limit(1);

    let totalCredits = 0;
    let usedCredits = 0;
    let frozenCredits = 0;
    let expiringSoon = 0;

    for (const pkg of packages) {
      totalCredits += pkg.initialCredits;
      usedCredits +=
        pkg.initialCredits - pkg.remainingCredits - pkg.frozenCredits;
      frozenCredits += pkg.frozenCredits;

      if (pkg.expiredAt && pkg.expiredAt <= expiringSoonDate) {
        expiringSoon += pkg.remainingCredits;
      }
    }

    return {
      totalCredits,
      usedCredits,
      frozenCredits,
      availableCredits: packages.reduce(
        (sum, p) => sum + p.remainingCredits,
        0
      ),
      expiringSoon,
      plan: customer?.plan,
    };
  }

  /**
   * 冻结积分（任务创建时调用）
   * 使用数据库事务 + 唯一约束保证幂等性
   */
  async freeze(params: {
    userId: string;
    credits: number;
    videoUuid: string;
  }): Promise<{ success: boolean; holdId: number }> {
    const { userId, credits, videoUuid } = params;

    const existingHold = await this.findHold(videoUuid);
    if (existingHold) {
      if (existingHold.status === "HOLDING") {
        return { success: true, holdId: existingHold.id };
      }
      throw new Error(`Hold already processed for video: ${videoUuid}`);
    }

    // D1 does not expose interactive transactions. Its batch API is atomic,
    // so the package updates and hold insert are committed or rolled back
    // together. CHECK constraints prevent a concurrent request from taking a
    // package below zero; in that case we re-read and retry safely.
    for (let attempt = 0; attempt < 3; attempt++) {
      const now = new Date();
      const packages = await db
        .select()
        .from(creditPackages)
        .where(
          and(
            eq(creditPackages.userId, userId),
            eq(creditPackages.status, CreditPackageStatus.ACTIVE),
            gt(creditPackages.remainingCredits, 0),
            or(
              isNull(creditPackages.expiredAt),
              gt(creditPackages.expiredAt, now)
            )
          )
        )
        .orderBy(
          sql`${creditPackages.expiredAt} is null`,
          asc(creditPackages.expiredAt),
          asc(creditPackages.createdAt)
        );

      const availableCredits = packages.reduce(
        (sum, pkg) => sum + pkg.remainingCredits,
        0
      );
      if (availableCredits < credits) {
        throw new Error(
          `Insufficient credits. Required: ${credits}, Available: ${availableCredits}`
        );
      }

      const allocation: PackageAllocation[] = [];
      let remaining = credits;
      for (const pkg of packages) {
        if (remaining <= 0) break;
        const toFreeze = Math.min(pkg.remainingCredits, remaining);
        allocation.push({ packageId: pkg.id, credits: toFreeze });
        remaining -= toFreeze;
      }

      const updates = allocation.map(({ packageId, credits: amount }) =>
        db
          .update(creditPackages)
          .set({
            remainingCredits: sql`${creditPackages.remainingCredits} - ${amount}`,
            frozenCredits: sql`${creditPackages.frozenCredits} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(creditPackages.id, packageId))
      );
      const insertHold = db
        .insert(creditHolds)
        .values({
          userId,
          videoUuid,
          credits,
          status: "HOLDING",
          packageAllocation: allocation,
        })
        .returning({ id: creditHolds.id });

      try {
        const results = await db.batch(
          [...updates, insertHold] as unknown as Parameters<typeof db.batch>[0]
        );
        const inserted = results[results.length - 1] as
          | Array<{ id: number }>
          | undefined;
        const holdId = inserted?.[0]?.id;
        if (!holdId) throw new Error("Failed to create credit hold");
        return { success: true, holdId };
      } catch (error) {
        const racedHold = await this.findHold(videoUuid);
        if (racedHold?.status === "HOLDING") {
          return { success: true, holdId: racedHold.id };
        }
        if (!isConstraintError(error) || attempt === 2) throw error;
      }
    }

    throw new Error("Failed to freeze credits");
  }

  /**
   * 结算积分（任务成功时调用）
   */
  async settle(videoUuid: string): Promise<void> {
    const hold = await this.findHold(videoUuid);
    if (!hold) throw new Error(`Hold not found for video: ${videoUuid}`);
    if (hold.status === "SETTLED") return;
    if (hold.status !== "HOLDING") {
      throw new Error(`Invalid hold status: ${hold.status}`);
    }

    const balance = await this.getBalanceInTx(db, hold.userId);
    const updates = hold.packageAllocation.map(({ packageId, credits }) =>
      db
        .update(creditPackages)
        .set({
          frozenCredits: sql`${creditPackages.frozenCredits} - ${credits}`,
          status: sql`case when ${creditPackages.remainingCredits} = 0 and ${creditPackages.frozenCredits} - ${credits} = 0 then 'DEPLETED' else ${creditPackages.status} end`,
          updatedAt: new Date(),
        })
        .where(eq(creditPackages.id, packageId))
    );

    try {
      await db.batch(
        [
          ...updates,
          db
            .update(creditHolds)
            .set({ status: "SETTLED", settledAt: new Date() })
            .where(
              and(
                eq(creditHolds.videoUuid, videoUuid),
                eq(creditHolds.status, "HOLDING")
              )
            ),
          db.insert(creditTransactions).values({
            transNo: `TXN${Date.now()}${nanoid(6)}`,
            userId: hold.userId,
            transType: CreditTransType.VIDEO_CONSUME,
            credits: -hold.credits,
            balanceAfter: balance.availableCredits,
            videoUuid,
            holdId: hold.id,
            remark: `Video generation settled: ${videoUuid}`,
          }),
        ] as unknown as Parameters<typeof db.batch>[0]
      );
    } catch (error) {
      const current = await this.findHold(videoUuid);
      if (current?.status === "SETTLED") return;
      throw error;
    }
  }

  /**
   * 释放积分（任务失败时调用）
   */
  async release(videoUuid: string): Promise<void> {
    const hold = await this.findHold(videoUuid);
    if (!hold) throw new Error(`Hold not found for video: ${videoUuid}`);
    if (hold.status === "RELEASED") return;
    if (hold.status !== "HOLDING") {
      throw new Error(`Invalid hold status: ${hold.status}`);
    }

    const balance = await this.getBalanceInTx(db, hold.userId);
    const updates = hold.packageAllocation.map(({ packageId, credits }) =>
      db
        .update(creditPackages)
        .set({
          remainingCredits: sql`${creditPackages.remainingCredits} + ${credits}`,
          frozenCredits: sql`${creditPackages.frozenCredits} - ${credits}`,
          status: CreditPackageStatus.ACTIVE,
          updatedAt: new Date(),
        })
        .where(eq(creditPackages.id, packageId))
    );

    try {
      await db.batch(
        [
          ...updates,
          db
            .update(creditHolds)
            .set({ status: "RELEASED", settledAt: new Date() })
            .where(
              and(
                eq(creditHolds.videoUuid, videoUuid),
                eq(creditHolds.status, "HOLDING")
              )
            ),
          db.insert(creditTransactions).values({
            transNo: `TXN${Date.now()}${nanoid(6)}`,
            userId: hold.userId,
            transType: CreditTransType.REFUND,
            credits: 0,
            balanceAfter: balance.availableCredits + hold.credits,
            videoUuid,
            holdId: hold.id,
            remark: `Video generation failed, credits released: ${videoUuid}`,
          }),
        ] as unknown as Parameters<typeof db.batch>[0]
      );
    } catch (error) {
      const current = await this.findHold(videoUuid);
      if (current?.status === "RELEASED") return;
      throw error;
    }
  }

  /**
   * 充值积分
   *
   * D1 batch makes the package and audit transaction an atomic unit. The
   * unique order number keeps payment/webhook retries idempotent.
   */
  async recharge(
    params: {
      userId: string;
      credits: number;
      orderNo: string;
      transType?: CreditTransType;
      expiryDays?: number;
      remark?: string;
    }
  ): Promise<{ packageId: number; created: boolean }> {
    const transType = params.transType || CreditTransType.ORDER_PAY;
    const expiryDays =
      params.expiryDays ?? CREDITS_CONFIG.expiration.purchaseDays;
    const expiredAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const balance = await this.getBalanceInTx(db, params.userId);
    const [packageResult] = await db.batch([
      db
        .insert(creditPackages)
        .values({
          userId: params.userId,
          initialCredits: params.credits,
          remainingCredits: params.credits,
          frozenCredits: 0,
          transType,
          orderNo: params.orderNo,
          status: CreditPackageStatus.ACTIVE,
          expiredAt,
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: creditPackages.orderNo }),
      db
        .insert(creditTransactions)
        .values({
          transNo: `TXN${Date.now()}${nanoid(6)}`,
          userId: params.userId,
          transType,
          credits: params.credits,
          balanceAfter: balance.availableCredits + params.credits,
          orderNo: params.orderNo,
          remark: params.remark || `Recharge: ${params.orderNo}`,
        })
        .onConflictDoNothing({ target: creditTransactions.orderNo }),
    ]);

    const [pkg] = await db
      .select({ id: creditPackages.id })
      .from(creditPackages)
      .where(eq(creditPackages.orderNo, params.orderNo))
      .limit(1);
    if (!pkg) throw new Error("Failed to create credit package");

    const created =
      Number((packageResult as { meta?: { changes?: number } }).meta?.changes) >
      0;
    return { packageId: pkg.id, created };
  }

  /**
   * 撤销某个订单已发放的积分（Stripe 退款/拒付时调用）。
   *
   * 幂等键为 `revokeOrderNo`（每次退款/拒付事件唯一），重复调用返回
   * `duplicate`，因此 Stripe webhook 重试是安全的。
   *
   * `ratio` 表示要撤销的初始积分比例（clamp 到 [0,1]）：1 表示撤销全部初始
   * 积分，0.5 表示撤销一半（部分退款）。累计撤销不会超过初始积分，也不会
   * 低于积分包的剩余积分（即不会撤销已被消耗的积分）。
   */
  async revokeForOrder(params: {
    orderNo: string;
    revokeOrderNo: string;
    ratio: number;
    remark?: string;
  }): Promise<{
    status: "revoked" | "duplicate" | "not_found" | "nothing_to_revoke";
    credits: number;
  }> {
    const [pkg] = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.orderNo, params.orderNo))
      .limit(1);
    if (!pkg) {
      return { status: "not_found", credits: 0 };
    }

    const [existingRevoke] = await db
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(eq(creditTransactions.orderNo, params.revokeOrderNo))
      .limit(1);
    if (existingRevoke) {
      return { status: "duplicate", credits: 0 };
    }

    const ratio = Math.min(1, Math.max(0, params.ratio));
    const target =
      ratio >= 1 ? pkg.initialCredits : Math.floor(pkg.initialCredits * ratio);

    const [revokedSum] = await db
      .select({
        total: sql<number>`coalesce(sum(${creditTransactions.credits}), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.packageId, pkg.id),
          eq(creditTransactions.transType, CreditTransType.REFUND)
        )
      );
    const alreadyRevoked = -Number(revokedSum?.total ?? 0);

    const delta = Math.min(
      target - alreadyRevoked,
      pkg.remainingCredits
    );
    if (delta <= 0) {
      return { status: "nothing_to_revoke", credits: 0 };
    }

    const balance = await this.getBalanceInTx(db, pkg.userId);

    try {
      await db.batch(
        [
          db.insert(creditTransactions).values({
            transNo: `TXN${Date.now()}${nanoid(6)}`,
            userId: pkg.userId,
            transType: CreditTransType.REFUND,
            credits: -delta,
            balanceAfter: balance.availableCredits - delta,
            packageId: pkg.id,
            orderNo: params.revokeOrderNo,
            remark: params.remark,
          }),
          db
            .update(creditPackages)
            .set({
              remainingCredits: sql`max(0, ${creditPackages.remainingCredits} - ${delta})`,
              updatedAt: new Date(),
            })
            .where(eq(creditPackages.id, pkg.id)),
        ] as unknown as Parameters<typeof db.batch>[0]
      );
    } catch (error) {
      // Concurrent deliveries of the same revokeOrderNo race on the unique
      // index; the second one is a duplicate, not an error.
      if (isConstraintError(error)) {
        return { status: "duplicate", credits: 0 };
      }
      throw error;
    }

    return { status: "revoked", credits: delta };
  }

  /**
   * 新用户赠送积分
   * - 幂等性：通过 transType=NEW_USER 检查防止重复发放
   * - 配置：在 src/config/pricing-user.ts 中统一管理
   */
  async grantNewUserCredits(userId: string): Promise<void> {
    const { registerGift } = CREDITS_CONFIG;

    if (!registerGift.enabled) {
      console.log(`[Credit] New user gift disabled, skipping for user: ${userId}`);
      return;
    }

    // 检查是否已经发放过（幂等性保证）
    const [existing] = await db
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.userId, userId),
          eq(creditPackages.transType, CreditTransType.NEW_USER)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`[Credit] User ${userId} already received welcome credits, skipping`);
      return;
    }

    // 发放新用户积分
    await this.recharge({
      userId,
      credits: registerGift.amount,
      orderNo: `NEW_USER_${userId}`,
      transType: CreditTransType.NEW_USER,
      expiryDays: registerGift.expireDays,
      remark: "New user welcome credits",
    });

    console.log(`[Credit] Granted ${registerGift.amount} welcome credits to new user: ${userId} (expires in ${registerGift.expireDays} days)`);
  }

  /**
   * 过期积分处理：把已过期、仍有余量的积分包标记为 EXPIRED，并为每个包
   * 写一条 EXPIRED 流水，让用户在积分明细里看到积分是怎么没的。
   *
   * 不传 userId 时处理所有用户（给定时任务用）；传 userId 时只处理该用户
   * （读余额、明细、积分包前调用，这样没有定时任务也能补记）。
   *
   * 幂等：流水的 orderNo 固定为 `EXPIRE_<packageId>`，命中唯一索引就跳过；
   * 积分包状态更新也只作用于仍为 ACTIVE 的包。正在冻结的包（有生成任务
   * 在跑）先不处理，等冻结结算后再过期。
   */
  async recordExpiries(userId?: string): Promise<number> {
    const now = new Date();
    const conditions = [
      eq(creditPackages.status, CreditPackageStatus.ACTIVE),
      lt(creditPackages.expiredAt, now),
      gt(creditPackages.remainingCredits, 0),
      eq(creditPackages.frozenCredits, 0),
    ];
    if (userId) conditions.push(eq(creditPackages.userId, userId));

    const expired = await db
      .select()
      .from(creditPackages)
      .where(and(...conditions))
      .orderBy(asc(creditPackages.expiredAt), asc(creditPackages.id));

    let recorded = 0;
    for (const pkg of expired) {
      const expiredAt = pkg.expiredAt ?? now;
      const balanceAfter = await this.balanceAfterExpiry(pkg.userId, expiredAt, pkg.remainingCredits);
      const [, txn] = (await db.batch([
        db
          .update(creditPackages)
          .set({ status: CreditPackageStatus.EXPIRED, updatedAt: now })
          .where(and(eq(creditPackages.id, pkg.id), eq(creditPackages.status, CreditPackageStatus.ACTIVE))),
        db
          .insert(creditTransactions)
          .values({
            transNo: `TXN${Date.now()}${nanoid(6)}`,
            userId: pkg.userId,
            transType: CreditTransType.EXPIRED,
            credits: -pkg.remainingCredits,
            balanceAfter,
            packageId: pkg.id,
            orderNo: expiryOrderNo(pkg.id),
            remark: `Credits expired: ${pkg.remainingCredits} left in package ${pkg.id}`,
            // Dated when the credits actually expired, so the ledger reads in order.
            createdAt: expiredAt,
          })
          .onConflictDoNothing({ target: creditTransactions.orderNo }),
      ])) as unknown as [unknown, { meta?: { changes?: number } }];
      if (Number(txn?.meta?.changes) > 0) recorded += 1;
    }
    return recorded;
  }

  /** Kept for callers that only want the count; records expiries for everyone. */
  async expireCredits(): Promise<number> {
    return this.recordExpiries();
  }

  /**
   * Balance right after a package expired: the ledger balance just before
   * that moment, less what expired. Falls back to today's balance (which
   * already leaves the expired package out) when the ledger has nothing older.
   */
  private async balanceAfterExpiry(userId: string, expiredAt: Date, credits: number): Promise<number> {
    const [previous] = await db
      .select({ balanceAfter: creditTransactions.balanceAfter })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), lte(creditTransactions.createdAt, expiredAt)))
      .orderBy(desc(creditTransactions.createdAt), desc(creditTransactions.id))
      .limit(1);
    if (previous) return Math.max(0, previous.balanceAfter - credits);
    const balance = await this.getBalanceInTx(db, userId);
    return balance.availableCredits;
  }

  /**
   * 获取积分历史
   */
  async getHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      transType?: CreditTransType;
    }
  ) {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const filters = [eq(creditTransactions.userId, userId)];
    if (options?.transType) {
      filters.push(eq(creditTransactions.transType, options.transType));
    }

    const records = await db
      .select()
      .from(creditTransactions)
      .where(and(...filters))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(and(...filters));

    const total = Number(countResult?.count ?? 0);

    return { records, total };
  }

  /**
   * Find a hold without exposing it outside the credit service.
   */
  private async findHold(videoUuid: string) {
    const [hold] = await db
      .select()
      .from(creditHolds)
      .where(eq(creditHolds.videoUuid, videoUuid))
      .limit(1);
    return hold ?? null;
  }

  /**
   * 获取余额（内部方法）
   */
  private async getBalanceInTx(
    trx: DbReader,
    userId: string
  ): Promise<CreditBalance> {
    const now = new Date();

    const packages = await trx
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.userId, userId),
          eq(creditPackages.status, CreditPackageStatus.ACTIVE),
          or(
            isNull(creditPackages.expiredAt),
            gt(creditPackages.expiredAt, now)
          )
        )
      );

    let totalCredits = 0;
    let usedCredits = 0;
    let frozenCredits = 0;

    for (const pkg of packages) {
      totalCredits += pkg.initialCredits;
      usedCredits +=
        pkg.initialCredits - pkg.remainingCredits - pkg.frozenCredits;
      frozenCredits += pkg.frozenCredits;
    }

    return {
      totalCredits,
      usedCredits,
      frozenCredits,
      availableCredits: packages.reduce(
        (sum: number, p: CreditPackage) => sum + p.remainingCredits,
        0
      ),
      expiringSoon: 0,
    };
  }
}

export const creditService = new CreditService();

