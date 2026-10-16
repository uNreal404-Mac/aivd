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

function parseMessageContent(message) {
  if (typeof message?.content !== "string") return null;
  try {
    return JSON.parse(message.content);
  } catch {
    return null;
  }
}

function renderPostElement(element) {
  if (!element || typeof element !== "object") return "";
  switch (element.tag) {
    case "text":
      return typeof element.text === "string" ? element.text : "";
    case "a": {
      const label = typeof element.text === "string" ? element.text : "";
      if (typeof element.href === "string" && element.href && element.href !== label) return `${label} (${element.href})`;
      return label;
    }
    case "at": {
      const name = element.user_name || element.user_id;
      return `@${typeof name === "string" && name ? name : "user"}`;
    }
    case "img":
      return `[image:${element.image_key}]`;
    case "media":
      return `[media:${element.file_key}]`;
    case "emotion":
      return `[${element.emoji_type}]`;
    default:
      return "";
  }
}

function renderPostBlock(block) {
  if (!block || typeof block !== "object") return "";
  const lines = [];
  if (typeof block.title === "string" && block.title.length > 0) lines.push(block.title);
  if (Array.isArray(block.content)) {
    for (const paragraph of block.content) {
      const elements = Array.isArray(paragraph) ? paragraph : [paragraph];
      lines.push(elements.map(renderPostElement).join(""));
    }
  }
  return lines.join("\n");
}

function renderPostContent(content) {
  if (!content || typeof content !== "object") return null;
  if (Array.isArray(content.content)) {
    const rendered = renderPostBlock(content);
    return rendered.length > 0 ? rendered : null;
  }
  const blocks = [];
  for (const value of Object.values(content)) {
    if (!value || typeof value !== "object") continue;
    const rendered = renderPostBlock(value);
    if (rendered.length > 0) blocks.push(rendered);
  }
  return blocks.length > 0 ? blocks.join("\n\n") : null;
}

export function extractMessageText(message) {
  const content = parseMessageContent(message);
  if (content === null) return null;
  switch (message?.message_type) {
    case "text":
      return typeof content.text === "string" ? content.text : null;
    case "post":
      return renderPostContent(content);
    case "image":
      return typeof content.image_key === "string" ? `[image:${content.image_key}]` : null;
    default:
      return null;
  }
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
    createTime: typeof message.create_time === "string" ? message.create_time : "",
  };
}

export function selectMessageEvent(payload, botOpenId) {
  if (payload?.header?.event_type !== "im.message.receive_v1") return null;
  const eventId = payload.header.event_id;
  const message = payload?.event?.message;
  const messageId = message?.message_id;
  if (typeof eventId !== "string" || !eventId || typeof messageId !== "string" || !messageId) return null;
  if (payload?.event?.sender?.sender_type !== "user") return null;
  if (message?.message_type !== "text") {
    console.log(`[feishu] ignored message_type=${message?.message_type ?? ""} message_id=${messageId}`);
    return null;
  }

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

export function selectForwardMessage(payload, forwardChatId) {
  if (payload?.header?.event_type !== "im.message.receive_v1") return null;
  const eventId = payload.header.event_id;
  const message = payload?.event?.message;
  const messageId = message?.message_id;
  if (typeof eventId !== "string" || !eventId || typeof messageId !== "string" || !messageId) return null;
  if (payload?.event?.sender?.sender_type !== "user") return null;
  if (message?.chat_type !== "group") return null;
  if (typeof forwardChatId !== "string" || !forwardChatId || message?.chat_id !== forwardChatId) return null;

  const messageType = message.message_type;
  let text = extractMessageText(message);
  if (text === null) {
    text = `[unsupported:${messageType}]`;
    console.log(`[feishu] unsupported message_type=${messageType} message_id=${messageId}`);
  }
  return { eventId, messageId, chatType: "group", messageType, text };
}

function postBlocks(content) {
  if (!content || typeof content !== "object") return [];
  if (Array.isArray(content.content)) return [content];
  return Object.values(content).filter((block) => block && typeof block === "object" && Array.isArray(block.content));
}

function atElementMatches(element, botOpenId) {
  if (!element || typeof element !== "object" || element.tag !== "at") return false;
  return element.user_id === botOpenId || element.open_id === botOpenId;
}

export function mentionsBot(message, botOpenId) {
  if (typeof botOpenId !== "string" || !botOpenId) return false;
  if (Array.isArray(message?.mentions) && message.mentions.some((mention) => mention?.id?.open_id === botOpenId)) {
    return true;
  }

  const content = parseMessageContent(message);
  if (!content || typeof content !== "object") return false;
  for (const block of postBlocks(content)) {
    for (const paragraph of block.content) {
      const elements = Array.isArray(paragraph) ? paragraph : [paragraph];
      if (elements.some((element) => atElementMatches(element, botOpenId))) return true;
    }
  }
  return false;
}
