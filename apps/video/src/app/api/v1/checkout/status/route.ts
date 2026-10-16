import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { creditPackages } from "@/db/schema";
import { requireAuth } from "@/lib/api/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  isValidSessionId,
  orderNoForSession,
  toCheckoutStatus,
} from "@/lib/checkout-status";

export const dynamic = "force-dynamic";

/**
 * Read-only lookup of the credits granted for a checkout session.
 * Never calls Stripe, never writes to the database.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const sessionId = request.nextUrl.searchParams.get("session_id");

    if (!isValidSessionId(sessionId)) {
      return apiError("Invalid session id", 400, {
        code: "INVALID_SESSION_ID",
      });
    }

    const rows = await db
      .select({ initialCredits: creditPackages.initialCredits })
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.orderNo, orderNoForSession(sessionId)),
          eq(creditPackages.userId, user.id)
        )
      )
      .limit(1);

    return apiSuccess(toCheckoutStatus(rows[0]));
  } catch (error) {
    return handleApiError(error);
  }
}
