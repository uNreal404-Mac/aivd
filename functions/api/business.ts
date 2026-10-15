import {
  json,
  error,
  preflight,
  hasDb,
  hasSessions,
  bindingsUnavailable,
  workerExceptionJson,
  type Env,
} from "../../libs/utils";
import { validateBusinessInquiry, insertBusinessInquiry, SUCCESS_MESSAGE } from "../../libs/businessInquiry";
import { rateLimitedResponse, takeRateLimit } from "../../libs/rateLimit";
import { clientIp } from "../../libs/guest";

export const onRequestOptions = (): Response => preflight();

function success(): Response {
  return json({ ok: true, message: SUCCESS_MESSAGE });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!hasDb(env)) return bindingsUnavailable("DB");

    if (hasSessions(env)) {
      const rl = await takeRateLimit(env.SESSIONS, `biz:ip:${clientIp(request) || "unknown"}`, 5, 3600);
      if (!rl.ok) return rateLimitedResponse(json, rl.retryAfter);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return error("invalid json");
    }

    const parsed = validateBusinessInquiry(body);
    if (!parsed.ok) {
      return json({ error: parsed.code, code: parsed.code, message: parsed.message }, 400);
    }
    if (parsed.spam) return success();

    await insertBusinessInquiry(env.DB, parsed.value);
    return success();
  } catch {
    return workerExceptionJson();
  }
};
