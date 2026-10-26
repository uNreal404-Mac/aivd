import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/api/auth";
import { assertSameOrigin } from "@/lib/admin/session";
import { recordAdminAction } from "@/lib/admin/audit";
import { creditService } from "@/services/credit";
import { handleApiError } from "@/lib/api/response";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_super_account"),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("set_banned"),
    enabled: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("adjust_credits"),
    amount: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0),
    remark: z.string().trim().min(2).max(300),
  }),
]);

function actorName(admin: Awaited<ReturnType<typeof requireAdmin>>): string {
  return "source" in admin ? admin.name : admin.email;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }

  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin(request);
  } catch (error) {
    return handleApiError(error);
  }
  const { userId } = await params;
  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: "操作参数无效" }, { status: 400 });
  }

  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      isAdmin: users.isAdmin,
      isSuperAccount: users.isSuperAccount,
      isBanned: users.isBanned,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const actor = actorName(admin);
  try {
    if (input.data.action === "set_super_account") {
      await db
        .update(users)
        .set({ isSuperAccount: input.data.enabled, updatedAt: new Date() })
        .where(eq(users.id, userId));
      await recordAdminAction({
        actor,
        action: input.data.enabled ? "grant_super_account" : "revoke_super_account",
        targetUserId: userId,
      });
      return NextResponse.json({ ok: true });
    }

    if (input.data.action === "set_banned") {
      if (target.isAdmin) {
        return NextResponse.json(
          { error: "不能通过此控制台封禁管理员账号" },
          { status: 400 },
        );
      }
      const reason = input.data.enabled
        ? input.data.reason?.trim() || "管理员操作"
        : null;
      await db.batch([
        db
          .update(users)
          .set({
            isBanned: input.data.enabled,
            banReason: reason,
            bannedAt: input.data.enabled ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId)),
        ...(input.data.enabled
          ? [db.delete(sessions).where(eq(sessions.userId, userId))]
          : []),
      ] as unknown as Parameters<typeof db.batch>[0]);
      await recordAdminAction({
        actor,
        action: input.data.enabled ? "ban_user" : "unban_user",
        targetUserId: userId,
        details: reason ? { reason } : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    const orderNo = `ADMIN_${crypto.randomUUID()}`;
    const result = await creditService.adminAdjust({
      userId,
      credits: input.data.amount,
      orderNo,
      remark: input.data.remark,
    });
    await recordAdminAction({
      actor,
      action: "adjust_credits",
      targetUserId: userId,
      details: {
        amount: input.data.amount,
        balanceAfter: result.balanceAfter,
        orderNo,
      },
    });
    return NextResponse.json({ ok: true, balanceAfter: result.balanceAfter });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    const status = message.startsWith("Insufficient credits") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
