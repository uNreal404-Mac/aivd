import { NextRequest } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { creditService } from "@/services/credit";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { db } from "@/db";
import { creditPackages } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";

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
    // Write ledger entries for credits that expired since the last visit.
    // A failure here must not stop the page from loading.
    await creditService.recordExpiries(user.id).catch((error) => console.error("[Credit] recordExpiries failed", error));
    const { searchParams } = new URL(request.url);

    const limit = Number.parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    // Every credit package the user has (gifts, plans and packs), so the
    // credits page can show where credits came from and when they expire.
    // The ledger stores types in more than one spelling, so no type filter.
    const conditions = [eq(creditPackages.userId, user.id)];
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
        // The package itself: where the credits came from, what is left and
        // when they expire. (The amount above is an estimate, not a price;
        // the credits page shows these fields instead.)
        credits: {
          transType: pkg.transType,
          initial: pkg.initialCredits,
          remaining: pkg.remainingCredits,
          expiredAt: pkg.expiredAt,
          status: pkg.status.toLowerCase(),
        },
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
