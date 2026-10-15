import { decryptLarkPayload, verifyLarkSignature } from "./security.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });

function headerValue(headers, name) {
  if (headers && typeof headers.get === "function") return headers.get(name);
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? null;
}

function parseJson(bytes) {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    const error = new Error("Invalid Feishu callback payload");
    error.status = 400;
    throw error;
  }
}

export async function decodeFeishuRequest({ rawBody, headers, encryptKey }) {
  if (!(rawBody instanceof Uint8Array) && !(rawBody instanceof ArrayBuffer)) {
    const error = new Error("Invalid Feishu callback payload");
    error.status = 400;
    throw error;
  }
  const body = rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody);
  const outerPayload = parseJson(body);
  const isEncrypted = typeof outerPayload?.encrypt === "string";
  const hasEncryptKey = typeof encryptKey === "string" && encryptKey.length > 0;
  if (isEncrypted && !hasEncryptKey) {
    const error = new Error("Encrypted callback is not configured");
    error.status = 401;
    throw error;
  }
  if (!hasEncryptKey) return outerPayload;

  if (!isEncrypted && outerPayload?.type === "url_verification") return outerPayload;

  const timestamp = headerValue(headers, "X-Lark-Request-Timestamp");
  const nonce = headerValue(headers, "X-Lark-Request-Nonce");
  const signature = headerValue(headers, "X-Lark-Signature");
  const validSignature = await verifyLarkSignature({
    rawBody: body,
    timestamp,
    nonce,
    signature,
    encryptKey,
  });

  if (!isEncrypted) {
    if (!validSignature) {
      const error = new Error("Invalid Feishu request signature");
      error.status = 401;
      throw error;
    }
    return outerPayload;
  }

  try {
    const decrypted = parseJson(await decryptLarkPayload(outerPayload.encrypt, encryptKey));
    // Feishu's encrypted URL-verification handshake can omit the signature headers.
    // The caller still validates its top-level Verification Token before echoing the challenge.
    if (decrypted?.type === "url_verification") return decrypted;
    if (!validSignature) {
      const error = new Error("Invalid Feishu request signature");
      error.status = 401;
      throw error;
    }
    return decrypted;
  } catch (cause) {
    if (cause?.status === 401) throw cause;
    const error = new Error("Unable to decode encrypted Feishu callback", { cause });
    error.status = 400;
    throw error;
  }
}

function sameToken(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function validateVerificationToken(payload, configuredToken) {
  if (typeof configuredToken !== "string" || configuredToken.length === 0) return false;
  const receivedToken = payload?.type === "url_verification" ? payload.token : payload?.header?.token;
  return sameToken(receivedToken, configuredToken);
}

function textFromMessage(message) {
  try {
    const content = JSON.parse(message.content);
    return typeof content?.text === "string" ? content.text : null;
  } catch {
    return null;
  }
}

export function messageContext(payload) {
  const message = payload?.event?.message ?? {};
  const sender = payload?.event?.sender ?? {};
  const senderId = sender.sender_id ?? {};
  const named = typeof senderId.name === "string" && senderId.name
    ? senderId.name
    : (typeof sender.name === "string" ? sender.name : "");
  return {
    chatId: typeof message.chat_id === "string" ? message.chat_id : "",
    senderOpenId: typeof senderId.open_id === "string" ? senderId.open_id : "",
    senderName: named,
  };
}

export function selectMessageEvent(payload, botOpenId) {
  if (payload?.header?.event_type !== "im.message.receive_v1") return null;
  const eventId = payload.header.event_id;
  const message = payload?.event?.message;
  const messageId = message?.message_id;
  if (typeof eventId !== "string" || !eventId || typeof messageId !== "string" || !messageId) return null;
  if (payload?.event?.sender?.sender_type !== "user" || message?.message_type !== "text") return null;

  let text = textFromMessage(message);
  if (text === null) return null;
  if (message.chat_type === "p2p") {
    return { eventId, messageId, chatType: "p2p", text };
  }
  if (message.chat_type !== "group" || typeof botOpenId !== "string" || !botOpenId) return null;

  const botMention = Array.isArray(message.mentions)
    ? message.mentions.find((mention) => mention?.id?.open_id === botOpenId && typeof mention.key === "string" && mention.key.length > 0)
    : null;
  if (!botMention) return null;

  text = text.split(botMention.key).join("");
  return { eventId, messageId, chatType: "group", text };
}
