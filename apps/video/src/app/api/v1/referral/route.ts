import type { NextRequest } from "next/server";

import { getReferralConfig } from "@/config/referral";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { referralService } from "@/services/referral";

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;

  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

function resolveOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    firstHeaderValue(request.headers.get("host"));

  if (host) {
    const proto =
      firstHeaderValue(request.headers.get("x-forwarded-proto")) ?? "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const result = await referralService.listForInviter(user.id);
    const origin = resolveOrigin(request);

    const link =
      result.available && result.code
        ? `${origin}/api/referral/r/${result.code}`
        : null;

    return apiSuccess({
      available: result.available,
      link,
      records: result.records,
      rewards: getReferralConfig(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
