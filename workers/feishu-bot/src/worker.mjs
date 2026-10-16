import { parseCommand } from "./commands.mjs";
import { botConfig } from "./config.mjs";
import { hasProcessed, markProcessed } from "./dedupe.mjs";
import { decodeFeishuRequest, messageContext, selectMessageEvent, validateVerificationToken } from "./events.mjs";
import { forwardToGrok, GROK_FORWARD_CHAT_ID } from "./forward.mjs";
import { fetchHealthSummary } from "./health.mjs";
import { getBotOpenId, getTenantAccessToken, replyToMessage } from "./feishu-api.mjs";
import { fetchProgressSummary } from "./progress.mjs";
import { replyWithOptionalLlm } from "./llm.mjs";
import { handleFeishuRequest, handleGithubWebhook } from "./requests.mjs";

const SITE_URL = botConfig.siteUrl;
const EVENT_TYPE = "im.message.receive_v1";
const CALLBACK_BUDGET_MS = 2500;
const GITHUB_WEBHOOK_BUDGET_MS = 8000;
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

async function commandReply({
  command,
  selected,
  context,
  kv,
  env,
  fetchImpl,
  now,
  deadlineAt,
  monotonicNow,
}) {
  if (command === "url") return SITE_URL;
  if (command === "health") {
    const remainingHealthMs = deadlineAt - monotonicNow() - HEALTH_REPLY_RESERVE_MS;
    const healthTimeoutMs = Math.max(1, Math.min(HEALTH_TIMEOUT_MS, remainingHealthMs));
    return fetchHealthSummary({ fetchImpl, timeoutMs: healthTimeoutMs });
  }
  if (command === "progress") {
    return fetchProgressSummary({ kv, token: env.GITHUB_TOKEN, fetchImpl, now });
  }
  if (command === "request") {
    return handleFeishuRequest({ kv, env, selected, context, fetchImpl });
  }
  return replyWithOptionalLlm({
    kv,
    env,
    chatId: context?.chatId,
    userText: selected?.text,
    fetchImpl,
    now,
  });
}

async function handleGithubRequest(request, env, { fetchImpl, now, monotonicNow }) {
  if (typeof env?.GITHUB_WEBHOOK_SECRET !== "string" || !env.GITHUB_WEBHOOK_SECRET) {
    return textResponse("GitHub webhook is not configured", 503);
  }
  if (!env.BOT_KV) return textResponse("Storage is not configured", 503);
  const deadlineAt = monotonicNow() + GITHUB_WEBHOOK_BUDGET_MS;
  try {
    const rawBody = await readRequestBody(request, deadlineAt, monotonicNow);
    const result = await handleGithubWebhook({
      rawBody,
      headers: request.headers,
      kv: createDeadlineKv(env.BOT_KV, deadlineAt, monotonicNow),
      env,
      fetchImpl: createDeadlineFetch(fetchImpl, deadlineAt, monotonicNow),
      now,
    });
    return textResponse(result.body ?? "ok", result.status ?? 200);
  } catch (error) {
    return textResponse("GitHub webhook rejected", error?.status ?? 500);
  }
}

export function createWorker({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  callbackBudgetMs = CALLBACK_BUDGET_MS,
  monotonicNow = () => performance.now(),
} = {}) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.pathname === "/github/webhook") {
        if (request.method !== "POST") return textResponse("Not found", 404);
        return handleGithubRequest(request, env, { fetchImpl, now, monotonicNow });
      }
      if (url.pathname !== "/feishu/events" || request.method !== "POST") return textResponse("Not found", 404);
      if (typeof env?.FEISHU_VERIFICATION_TOKEN !== "string" || !env.FEISHU_VERIFICATION_TOKEN) {
        return textResponse("Webhook is not configured", 503);
      }
      const requestBudgetMs = Number.isFinite(callbackBudgetMs) && callbackBudgetMs > 0
        ? Math.min(CALLBACK_BUDGET_MS, callbackBudgetMs)
        : CALLBACK_BUDGET_MS;
      const deadlineAt = monotonicNow() + requestBudgetMs;
      const boundedFetch = createDeadlineFetch(fetchImpl, deadlineAt, monotonicNow);
      const deferWork = typeof ctx?.waitUntil === "function";

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

      const processMessage = async () => {
        // Background work may exceed Feishu's ~2.5s ack budget (LLM timeout stays 9s).
        const workDeadlineAt = deferWork ? monotonicNow() + 60_000 : deadlineAt;
        const workFetch = deferWork ? fetchImpl : boundedFetch;
        const kv = deferWork ? env.BOT_KV : createDeadlineKv(env.BOT_KV, deadlineAt, monotonicNow);

        let token = null;
        let selected = null;
        const chatType = payload?.event?.message?.chat_type;
        if (chatType === "p2p") {
          selected = selectMessageEvent(payload, "");
        } else if (chatType === "group") {
          if (!eligibleGroupShape(payload)) return;
          token = await getTenantAccessToken({
            kv,
            appId: env.FEISHU_APP_ID,
            appSecret: env.FEISHU_APP_SECRET,
            fetchImpl: workFetch,
            now,
          });
          const botOpenId = await getBotOpenId({ kv, token, fetchImpl: workFetch, now });
          selected = selectMessageEvent(payload, botOpenId);
        } else {
          return;
        }

        if (!selected) return;
        if (await hasProcessed(kv, selected.eventId, selected.messageId)) return;
        if (!token) {
          token = await getTenantAccessToken({
            kv,
            appId: env.FEISHU_APP_ID,
            appSecret: env.FEISHU_APP_SECRET,
            fetchImpl: workFetch,
            now,
          });
        }

        const command = parseCommand(selected.text);
        const context = messageContext(payload);
        await forwardToGrok({ env, kv, payload, selected, context, fetchImpl: workFetch });
        // The forwarding chat is mirror-only: whatever the message says (commands included) and
        // whatever Resend answers, it never gets a Feishu reply. It is always marked processed so
        // Feishu retries do not send the email (or a reply) twice.
        if (context?.chatId === GROK_FORWARD_CHAT_ID) {
          await markProcessed(kv, selected.eventId, selected.messageId);
          return;
        }
        const text = await commandReply({
          command,
          selected,
          context,
          kv,
          env,
          fetchImpl: workFetch,
          now,
          deadlineAt: workDeadlineAt,
          monotonicNow,
        });
        await replyToMessage({
          token,
          messageId: selected.messageId,
          text,
          fetchImpl: workFetch,
        });
        await markProcessed(kv, selected.eventId, selected.messageId);
      };

      if (deferWork) {
        ctx.waitUntil(processMessage().catch(() => {}));
        return textResponse("ok", 200);
      }

      try {
        await processMessage();
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
