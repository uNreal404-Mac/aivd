import { NextRequest } from "next/server";

import { creditService } from "@/services/credit";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    // Write ledger entries for credits that expired since the last visit.
    // A failure here must not stop the page from loading.
    await creditService.recordExpiries(user.id).catch((error) => console.error("[Credit] recordExpiries failed", error));
    const balance = await creditService.getBalance(user.id);
    return apiSuccess(balance);
  } catch (error) {
    return handleApiError(error);
  }
}
