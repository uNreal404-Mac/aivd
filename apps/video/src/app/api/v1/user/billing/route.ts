import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/db";
import { creditPackages } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import type { CreditTransType } from "@/db/schema";

/**
 * GET /api/v1/user/billing
 *
 * Get user's purchase history (credit packages)
 * Query params:
 * - limit: number of items per page (default: 20)
 * - cursor: pagination cursor (creditPackages.id)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const limit = Number.parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    // Get ORDER_PAY type value
    const orderPayType: CreditTransType = "ORDER_PAY";

    const conditions = [
      eq(creditPackages.userId, user.id),
      eq(creditPackages.transType, orderPayType),
    ];
    if (cursor) {
      conditions.push(lt(creditPackages.id, Number.parseInt(cursor)));
    }

    const packages = await db
      .select({
        id: creditPackages.id,
        userId: creditPackages.userId,
        initialCredits: creditPackages.initialCredits,
        remainingCredits: creditPackages.remainingCredits,
        transType: creditPackages.transType,
        orderNo: creditPackages.orderNo,
        status: creditPackages.status,
        expiredAt: creditPackages.expiredAt,
        createdAt: creditPackages.createdAt,
      })
      .from(creditPackages)
      .where(and(...conditions))
      .orderBy(desc(creditPackages.createdAt))
      .limit(limit + 1);

    // Check if there's more data
    const hasMore = packages.length > limit;
    const results = hasMore ? packages.slice(0, limit) : packages;

    // Get next cursor
    const nextCursor = hasMore && results.length > 0
      ? String(results[results.length - 1].id)
      : null;

    // Transform to invoice format
    const invoices = results.map((pkg) => {
      const initialCredits = pkg.initialCredits;
      const itemDescription = initialCredits === 100
        ? "100 Credits"
        : initialCredits === 500
        ? "500 Credits"
        : initialCredits === 1000
        ? "1000 Credits"
        : initialCredits === 5000
        ? "5000 Credits"
        : `${initialCredits} Credits`;

      // Calculate amount based on credits (rough estimate)
      const amount = initialCredits * 0.1; // $0.01 per credit as example

      return {
        id: String(pkg.id),
        amount: amount,
        currency: "USD",
        status: pkg.status.toLowerCase(),
        items: [
          {
            type: "credits",
            description: itemDescription,
            quantity: initialCredits,
          },
        ],
        createdAt: pkg.createdAt,
      };
    });

    return apiSuccess({
      user: {
        email: user.email,
        id: user.id,
        createdAt: user.createdAt,
      },
      invoices,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
