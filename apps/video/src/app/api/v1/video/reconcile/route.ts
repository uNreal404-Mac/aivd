import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { videoService } from "@/services/video";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.RECONCILE_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!secret || !token) return false;
  const expected = Buffer.from(secret);
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * POST /api/v1/video/reconcile
 * Called by the Worker's cron trigger (see custom-worker.ts) with
 * `Authorization: Bearer <RECONCILE_SECRET>`. Finishes, fails or refunds
 * generations that callbacks and polling left open.
 */
export async function POST(request: NextRequest) {
  if (!process.env.RECONCILE_SECRET?.trim()) {
    return NextResponse.json({ error: "reconcile_not_configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await videoService.reconcileStuckGenerations();
    return NextResponse.json({ success: true, checked: results.length, results });
  } catch (error) {
    console.error("[reconcile] run failed:", error);
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}
