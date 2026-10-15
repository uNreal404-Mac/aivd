import { parseCommand, HELP_MESSAGE, PROGRESS_MESSAGE } from "./commands.mjs";
import { hasProcessed, markProcessed } from "./dedupe.mjs";
import { decodeFeishuRequest, selectMessageEvent, validateVerificationToken } from "./events.mjs";
import { fetchHealthSummary } from "./health.mjs";
import { getBotOpenId, getTenantAccessToken, replyToMessage } from "./feishu-api.mjs";

const SITE_URL = "https://dreamutopia-clone.pages.dev";
const EVENT_TYPE = "im.message.receive_v1";
const CALLBACK_BUDGET_MS = 2500;
const HEALTH_TIMEOUT_MS = 700;
const HEALTH_REPLY_RESERVE_MS = 700;

function runBeforeDeadline(operation, deadlineAt, monotonicNow, onTimeout) {
  const remainingMs = deadlineAt - monotonicNow();
  if (remainingMs <= 0) return Promise.reject(new Error("Feishu callback deadline exceeded"));

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error("Feishu callback deadline exceeded"));
    }, remainingMs);
  });

  return Promise.race([Promise.resolve().then(operation), timeout]).finally(() => clearTimeout(timer));
}

function createDeadlineFetch(fetchImpl, deadlineAt, monotonicNow) {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    const relayAbort = () => controller.abort(upstreamSignal?.reason);
    if (upstreamSignal?.aborted) relayAbort();
    else upstreamSignal?.addEventListener("abort", relayAbort, { once: true });

    try {
      return await runBeforeDeadline(async () => {
        const response = await fetchImpl(input, { ...init, signal: controller.signal });
        const body = await response.arrayBuffer();
        return new Response(body.byteLength ? body : null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }, deadlineAt, monotonicNow, () => controller.abort());
    } catch (error) {
      controller.abort();
      throw error;
    } finally {
      upstreamSignal?.removeEventListener("abort", relayAbort);
    }
  };
}

function createDeadlineKv(kv, deadlineAt, monotonicNow) {
  return {
    get(...args) {
      return runBeforeDeadline(() => kv.get(...args), deadlineAt, monotonicNow);
    },
    put(...args) {
      return runBeforeDeadline(() => kv.put(...args), deadlineAt, monotonicNow);
    },
  };
}

function textResponse(text, status) {
  return new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function challengeResponse(challenge) {
  return new Response(JSON.stringify({ challenge }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function hasMessageIdentity(payload) {
  const eventId = payload?.header?.event_id;
  const message = payload?.event?.message;
  return typeof eventId === "string" && eventId.length > 0
    && typeof message?.message_id === "string" && message.message_id.length > 0;
}

function eligibleGroupShape(payload) {
  return payload?.event?.sender?.sender_type === "user"
    && payload?.event?.message?.message_type === "text"
    && hasMessageIdentity(payload);
}

function replyText(command, healthText) {
  if (command === "progress") return PROGRESS_MESSAGE;
  if (command === "url") return SITE_URL;
  if (command === "health") return healthText;
  return HELP_MESSAGE;
}

export function createWorker({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  callbackBudgetMs = CALLBACK_BUDGET_MS,
  monotonicNow = () => performance.now(),
} = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname !== "/feishu/events" || request.method !== "POST") return textResponse("Not found", 404);
      if (typeof env?.FEISHU_VERIFICATION_TOKEN !== "string" || !env.FEISHU_VERIFICATION_TOKEN) {
        return textResponse("Webhook is not configured", 503);
      }
      const requestBudgetMs = Number.isFinite(callbackBudgetMs) && callbackBudgetMs > 0
        ? Math.min(CALLBACK_BUDGET_MS, callbackBudgetMs)
        : CALLBACK_BUDGET_MS;
      const deadlineAt = monotonicNow() + requestBudgetMs;
      const boundedFetch = createDeadlineFetch(fetchImpl, deadlineAt, monotonicNow);

      let payload;
      try {
        const rawBody = new Uint8Array(await request.arrayBuffer());
        payload = await decodeFeishuRequest({ rawBody, headers: request.headers, encryptKey: env.FEISHU_ENCRYPT_KEY ?? "" });
      } catch (error) {
        return textResponse("Invalid Feishu callback", error?.status ?? 400);
      }

      if (payload?.type === "url_verification") {
        if (!validateVerificationToken(payload, env.FEISHU_VERIFICATION_TOKEN)) return textResponse("Unauthorized", 401);
        if (typeof payload.challenge !== "string") return textResponse("Invalid challenge", 400);
        return challengeResponse(payload.challenge);
      }
      if (!validateVerificationToken(payload, env.FEISHU_VERIFICATION_TOKEN)) return textResponse("Unauthorized", 401);
      if (payload?.header?.event_type !== EVENT_TYPE) return textResponse("ok", 200);

      if (!env.BOT_KV) return textResponse("Storage is not configured", 503);
      const kv = createDeadlineKv(env.BOT_KV, deadlineAt, monotonicNow);

      let token = null;
      let selected = null;
      const chatType = payload?.event?.message?.chat_type;
      try {
        if (chatType === "p2p") {
          selected = selectMessageEvent(payload, "");
        } else if (chatType === "group") {
          if (!eligibleGroupShape(payload)) return textResponse("ok", 200);
          token = await getTenantAccessToken({
            kv,
            appId: env.FEISHU_APP_ID,
            appSecret: env.FEISHU_APP_SECRET,
            fetchImpl: boundedFetch,
            now,
          });
          const botOpenId = await getBotOpenId({ kv, token, fetchImpl: boundedFetch, now });
          selected = selectMessageEvent(payload, botOpenId);
        } else {
          return textResponse("ok", 200);
        }

        if (!selected) return textResponse("ok", 200);
        if (await hasProcessed(kv, selected.eventId, selected.messageId)) return textResponse("ok", 200);
        if (!token) {
          token = await getTenantAccessToken({
            kv,
            appId: env.FEISHU_APP_ID,
            appSecret: env.FEISHU_APP_SECRET,
            fetchImpl: boundedFetch,
            now,
          });
        }

        const command = parseCommand(selected.text);
        const remainingHealthMs = deadlineAt - monotonicNow() - HEALTH_REPLY_RESERVE_MS;
        const healthTimeoutMs = Math.max(1, Math.min(HEALTH_TIMEOUT_MS, remainingHealthMs));
        const healthText = command === "health"
          ? await fetchHealthSummary({ fetchImpl: boundedFetch, timeoutMs: healthTimeoutMs })
          : "";
        await replyToMessage({
          token,
          messageId: selected.messageId,
          text: replyText(command, healthText),
          fetchImpl: boundedFetch,
        });
        await markProcessed(kv, selected.eventId, selected.messageId);
        return textResponse("ok", 200);
      } catch {
        return textResponse("Temporary Feishu bot failure", 503);
      }
    },
  };
}

const worker = createWorker();
export const fetch = worker.fetch;
export default worker;
