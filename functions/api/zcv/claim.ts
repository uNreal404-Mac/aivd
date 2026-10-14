import { getSession, tokenFromRequest } from "../../../libs/auth";
import { guestIdFromRequest } from "../../../libs/guest";
import { claimGuestPreview } from "../../../libs/zcv";
import { json } from "../../../libs/utils";
import type { ZcvEnv } from "../../../libs/zcvService";

export const onRequestPost: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS) return json({ error: "storage_unavailable" }, 503);
  const session = await getSession(env, tokenFromRequest(request));
  if (!session) return json({ error: "unauthorized" }, 401);
  const guestId = guestIdFromRequest(request);
  if (!guestId) return json({ error: "guest_session_missing" }, 403);
  let body: { previewId?: string };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const previewId = typeof body.previewId === "string" ? body.previewId : "";
  const claimed = await claimGuestPreview(env.DB, previewId, guestId, session.userId);
  return claimed ? json({ ok: true }) : json({ error: "preview_not_owned" }, 403);
};
