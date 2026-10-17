import type { Env } from "../../../../libs/utils";
import { json, randomId } from "../../../../libs/utils";

const STATE_TTL_SECONDS = 10 * 60;

function safeNext(value: string | null): string {
  if (!value) return "/workspace";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/workspace";
  return value;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !env.SESSIONS) {
    return json(
      {
        error: "google_not_configured",
        message: "Google sign-in is not configured yet.",
      },
      503
    );
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri =
    env.GOOGLE_REDIRECT_URI?.trim() || `${origin}/api/auth/google/callback`;
  const state = randomId("google_state");
  const next = safeNext(url.searchParams.get("next"));

  await env.SESSIONS.put(
    `oauth:google:${state}`,
    JSON.stringify({ redirectUri, next }),
    { expirationTtl: STATE_TTL_SECONDS }
  );

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    state,
    prompt: "select_account",
  }).toString();

  return Response.redirect(authorize.toString(), 302);
};
