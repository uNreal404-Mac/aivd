import { NextResponse } from "next/server";
import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  assertSameOrigin,
  createAdminSessionToken,
  getAdminPanelPrincipal,
  verifyAdminCredentials,
} from "@/lib/admin/session";

const loginLimiter = createRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  maxKeys: 2_000,
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
});

function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function GET(request: Request) {
  const principal = await getAdminPanelPrincipal(request.headers);
  return NextResponse.json({ authenticated: Boolean(principal) });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }

  const limit = loginLimiter.check(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `尝试次数过多，请在 ${limit.retryAfterSeconds} 秒后重试` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入管理员账号和密码" }, { status: 400 });
  }

  const valid = await verifyAdminCredentials(
    parsed.data.username,
    parsed.data.password,
  );
  if (!valid) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await createAdminSessionToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
