import { botConfig, signOutboundText } from "./config.mjs";

const FEISHU_API = "https://open.feishu.cn/open-apis";
const TOKEN_CACHE_KEY = "feishu:tenant_access_token";
const BOT_OPEN_ID_CACHE_KEY = "feishu:bot:open_id";
const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const BOT_OPEN_ID_TTL_SECONDS = 24 * 60 * 60;
const USER_NAME_TTL_SECONDS = 24 * 60 * 60;
const encoder = new TextEncoder();

function currentTime(now) {
  return typeof now === "function" ? now() : (typeof now === "number" ? now : Date.now());
}

async function jsonResponse(response) {
  if (!response.ok) throw new Error("Feishu API request failed");
  try {
    return await response.json();
  } catch (cause) {
    throw new Error("Feishu API returned invalid JSON", { cause });
  }
}

function parseCachedToken(value, nowMs) {
  if (typeof value !== "string") return null;
  try {
    const cached = JSON.parse(value);
    if (typeof cached?.token === "string" && cached.token && Number.isFinite(cached.expiresAt)
      && cached.expiresAt - nowMs > TOKEN_REFRESH_WINDOW_MS) {
      return cached.token;
    }
  } catch {
    // A malformed cache entry is treated as a miss and replaced on refresh.
  }
  return null;
}

export async function getTenantAccessToken({ kv, appId, appSecret, fetchImpl = fetch, now = Date.now }) {
  const nowMs = currentTime(now);
  const cachedToken = parseCachedToken(await kv.get(TOKEN_CACHE_KEY), nowMs);
  if (cachedToken) return cachedToken;
  if (typeof appId !== "string" || !appId || typeof appSecret !== "string" || !appSecret) {
    throw new Error("Feishu application credentials are not configured");
  }

  let response;
  try {
    response = await fetchImpl(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
  } catch (cause) {
    throw new Error("Feishu token request failed", { cause });
  }

  const payload = await jsonResponse(response);
  if (payload?.code !== 0 || typeof payload.tenant_access_token !== "string" || !payload.tenant_access_token
    || !Number.isFinite(payload.expire) || payload.expire <= 0) {
    throw new Error("Feishu token response was invalid");
  }

  const expiresAt = currentTime(now) + payload.expire * 1000;
  await kv.put(TOKEN_CACHE_KEY, JSON.stringify({ token: payload.tenant_access_token, expiresAt }), {
    expirationTtl: Math.max(60, Math.ceil(payload.expire)),
  });
  return payload.tenant_access_token;
}

export async function getBotOpenId({ kv, token, fetchImpl = fetch, env }) {
  const configuredOpenId = typeof env?.FEISHU_BOT_OPEN_ID === "string" ? env.FEISHU_BOT_OPEN_ID : "";
  if (configuredOpenId) return configuredOpenId;

  const cachedOpenId = await kv.get(BOT_OPEN_ID_CACHE_KEY);
  if (typeof cachedOpenId === "string" && cachedOpenId) return cachedOpenId;

  const response = await fetchImpl(`${FEISHU_API}/bot/v3/info`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await jsonResponse(response);
  const openId = payload?.bot?.open_id ?? payload?.data?.bot?.open_id;
  if (payload?.code !== 0 || typeof openId !== "string" || !openId) {
    throw new Error("Feishu bot identity response was invalid");
  }

  await kv.put(BOT_OPEN_ID_CACHE_KEY, openId, { expirationTtl: BOT_OPEN_ID_TTL_SECONDS });
  return openId;
}

export async function getUserName({ kv, token, openId, fetchImpl = fetch }) {
  if (typeof openId !== "string" || !openId) return "";
  const cacheKey = `feishu:user_name:${openId}`;

  try {
    const cached = await kv.get(cacheKey);
    if (typeof cached === "string" && cached) return cached;
  } catch {
    // A cache miss or read failure falls through to the API.
  }

  try {
    const response = await fetchImpl(
      `${FEISHU_API}/contact/v3/users/${encodeURIComponent(openId)}?user_id_type=open_id`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const payload = await jsonResponse(response);
    const name = payload?.data?.user?.name;
    if (payload?.code !== 0 || typeof name !== "string" || !name) return "";
    try {
      await kv.put(cacheKey, name, { expirationTtl: USER_NAME_TTL_SECONDS });
    } catch {
      // Caching is best effort.
    }
    return name;
  } catch {
    return "";
  }
}

export async function replyUuid(messageId) {
  if (typeof messageId !== "string" || !messageId) throw new TypeError("messageId is required");
  const namespace = Uint8Array.from("6ba7b8109dad11d180b400c04fd430c8".match(/.{2}/g), (byte) => parseInt(byte, 16));
  const name = encoder.encode(`dreamutopia-feishu:${messageId}`);
  const input = new Uint8Array(namespace.length + name.length);
  input.set(namespace);
  input.set(name, namespace.length);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const uuidBytes = digest.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  const hex = Array.from(uuidBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function sendTextToChat({ token, chatId, text, fetchImpl = fetch, uuid, config = botConfig }) {
  if (typeof token !== "string" || !token || typeof text !== "string" || typeof chatId !== "string" || !chatId) {
    throw new TypeError("A token, chat id, and text reply are required");
  }
  const signed = signOutboundText(text, config);
  const replyId = uuid ?? await replyUuid(`chat:${chatId}`);
  const response = await fetchImpl(`${FEISHU_API}/im/v1/messages?receive_id_type=chat_id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text: signed }),
      uuid: replyId,
    }),
  });
  const payload = await jsonResponse(response);
  if (payload?.code !== 0) throw new Error("Feishu chat message was rejected");
}

export async function replyToMessage({ token, messageId, text, fetchImpl = fetch, uuid, config = botConfig }) {
  if (typeof token !== "string" || !token || typeof text !== "string") {
    throw new TypeError("A token and text reply are required");
  }
  const signed = signOutboundText(text, config);
  const replyId = uuid ?? await replyUuid(messageId);
  const response = await fetchImpl(`${FEISHU_API}/im/v1/messages/${encodeURIComponent(messageId)}/reply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      msg_type: "text",
      content: JSON.stringify({ text: signed }),
      uuid: replyId,
    }),
  });
  const payload = await jsonResponse(response);
  if (payload?.code !== 0) throw new Error("Feishu reply was rejected");
}
