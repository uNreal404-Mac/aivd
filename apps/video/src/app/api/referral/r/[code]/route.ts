import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { referralCodes } from "@/db/schema";
import {
  REFERRAL_COOKIE,
  isUndefinedTableError,
  isValidCode,
} from "@/lib/referral";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const response = NextResponse.redirect(new URL("/", request.url), 302);

  if (!isValidCode(code)) return response;

  let exists = false;

  try {
    const [row] = await db
      .select({ code: referralCodes.code })
      .from(referralCodes)
      .where(eq(referralCodes.code, code))
      .limit(1);

    exists = Boolean(row);
  } catch (error) {
    if (isUndefinedTableError(error)) return response;
    throw error;
  }

  if (!exists) return response;

  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: code,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
