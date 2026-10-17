import type { Env } from "../../../libs/utils";
import { createSession } from "../../../libs/auth";
import { makeReferralCode, mergeGuestJobs } from "../../../libs/account";
import { randomId } from "../../../libs/utils";

type GoogleState = { redirectUri: string; next: string };

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
};

function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/workspace";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/workspace";
  return value;
}

function redirectToAuth(origin: string, params: Record<string, string>): Response {
  const auth = new URL("/auth", origin);
  auth.searchParams.set("mode", "login");
  for (const [key, value] of Object.entries(params)) auth.searchParams.set(key, value);
  return Response.redirect(auth.toString(), 302);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret || !env.SESSIONS || !env.DB) {
    return redirectToAuth(origin, { google_error: "not_configured" });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirectToAuth(origin, { google_error: "missing_code" });

  const stateKey = `oauth:google:${state}`;
  const stateRaw = await env.SESSIONS.get(stateKey);
  await env.SESSIONS.delete(stateKey);
  if (!stateRaw) return redirectToAuth(origin, { google_error: "invalid_state" });

  let stateData: GoogleState;
  try {
    stateData = JSON.parse(stateRaw) as GoogleState;
  } catch {
    return redirectToAuth(origin, { google_error: "invalid_state" });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: stateData.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    return redirectToAuth(origin, { google_error: "token_exchange_failed" });
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => ({}))) as GoogleProfile;
  const email = profile.email?.trim().toLowerCase();
  if (!profileResponse.ok || !email || profile.email_verified !== true) {
    return redirectToAuth(origin, { google_error: "email_not_verified" });
  }

  let user = await env.DB.prepare(
    "SELECT id, email, credits FROM users WHERE lower(email) = ?"
  )
    .bind(email)
    .first<{ id: number; email: string; credits: number }>();

  if (!user) {
    const inserted = await env.DB.prepare(
      "INSERT INTO users (email, password_hash, credits, referral_code) VALUES (?, ?, ?, ?)"
    )
      .bind(email, `google:${randomId("account")}`, 10, makeReferralCode())
      .run();
    const userId = Number(inserted.meta.last_row_id);
    user = { id: userId, email, credits: 10 };
  }

  const userId = Number(user.id);
  const sessionToken = await createSession(env, userId, email);
  try {
    await mergeGuestJobs(env, request, userId);
  } catch {
    // Guest history migration must not block sign-in.
  }

  const auth = new URL("/auth", origin);
  auth.searchParams.set("mode", "login");
  auth.searchParams.set("google", "success");
  const next = safeNext(stateData.next);
  if (next !== "/workspace") auth.searchParams.set("next", next);
  auth.hash = `token=${encodeURIComponent(sessionToken)}`;
  return Response.redirect(auth.toString(), 302);
};
