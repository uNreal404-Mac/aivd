import { NextRequest } from "next/server";

import { getUserPlanTier } from "@/lib/plan-limits";
import { creditService } from "@/services/credit";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    // Write ledger entries for credits that expired since the last visit.
    // A failure here must not stop the page from loading.
    await creditService.recordExpiries(user.id).catch((error) => console.error("[Credit] recordExpiries failed", error));
    // `tier` is the plan from the account's live subscription grants (the
    // source the account page and concurrency limit use); `plan` is the
    // legacy Customer.plan column, which nothing writes any more.
    const [balance, tier] = await Promise.all([creditService.getBalance(user.id), getUserPlanTier(user.id)]);
    return apiSuccess({ ...balance, tier });
  } catch (error) {
    return handleApiError(error);
  }
}
