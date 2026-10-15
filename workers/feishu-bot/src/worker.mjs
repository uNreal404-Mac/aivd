import { parseCommand, HELP_MESSAGE, PROGRESS_MESSAGE } from "./commands.mjs";
import { hasProcessed, markProcessed } from "./dedupe.mjs";
import { decodeFeishuRequest, selectMessageEvent, validateVerificationToken } from "./events.mjs";
import { fetchHealthSummary } from "./health.mjs";
import { getBotOpenId, getTenantAccessToken, replyToMessage } from "./feishu-api.mjs";

const SITE_URL = "https://dreamutopia-clone.pages.dev";
const EVENT_TYPE = "im.message.receive_v1";
const CALLBACK_BUDGET_MS = 2500;
const MAX_CALLBACK_BODY_BYTES = 1024 * 1024;
const HEALTH_TIMEOUT_MS = 700;
const HEALTH_REPLY_RESERVE_MS = 700;

function deadlineError() {
  const error = new Error("Feishu callback deadline exceeded");
  error.status = 503;
  return error;
}

function runBeforeDeadline(operation, deadlineAt, monotonicNow, onTimeout) {
  const remainingMs = deadlineAt - monotonicNow();
  if (remainingMs <= 0) return Promise.reject(deadlineError());

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(deadlineError());
    }, remainingMs);
  });

  return Promise.race([Promise.resolve().then(operation), timeout]).finally(() => clearTimeout(timer));
}

async function readRequestBody(request, deadlineAt, monotonicNow) {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await runBeforeDeadline(
        () => reader.read(),
        deadlineAt,
        monotonicNow,
        () => { void reader.cancel().catch(() => {}); },
      );
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_CALLBACK_BODY_BYTES) {
        const error = new Error("Feishu callback body is too large");
        error.status = 413;
        throw error;
      }
      chunks.push(chunk);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
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
        const rawBody = await readRequestBody(request, deadlineAt, monotonicNow);
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
