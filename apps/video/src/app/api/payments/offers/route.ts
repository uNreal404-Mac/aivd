import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { hasPaidBefore } from "@/payment/offers";

export const dynamic = "force-dynamic";

/**
 * Which first-purchase offers the visitor can still get. Signed-out visitors
 * are treated as new, which is what checkout will decide once they sign up.
 */
export const GET = async () => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ firstPurchase: true, signedIn: false });
  try {
    return NextResponse.json({ firstPurchase: !(await hasPaidBefore(user.id)), signedIn: true });
  } catch {
    // When we cannot tell, do not promise a price checkout may not give.
    return NextResponse.json({ firstPurchase: false, signedIn: true });
  }
};
