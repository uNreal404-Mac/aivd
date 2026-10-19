import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export const dynamic = "force-dynamic";

const DB_CHECK_TIMEOUT_MS = 15000;

async function checkDatabase(): Promise<boolean> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("db check timed out"));
      }, DB_CHECK_TIMEOUT_MS);
    });
    await Promise.race([db.get(sql`select 1`), timeout]);
    return true;
  } catch (error) {
    console.error(
      "[health] D1 check failed",
      (error as { code?: string; name?: string })?.code ??
        (error as Error)?.name,
      String((error as Error)?.message ?? "").slice(0, 160)
    );
    return false;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function GET() {
  const dbConnected = await checkDatabase();
  return NextResponse.json(
    {
      status: dbConnected ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      db: dbConnected ? "connected" : "unavailable",
    },
    { status: dbConnected ? 200 : 503 }
  );
}
