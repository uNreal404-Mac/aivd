import assert from "node:assert/strict";
import test from "node:test";
import { decodeFeishuRequest, extractMessageText, mentionsBot, selectForwardMessage, selectMessageEvent, validateVerificationToken } from "../src/events.mjs";
import { GROK_FORWARD_CHAT_ID } from "../src/forward.mjs";

const encoder = new TextEncoder();

async function encryptedBody(payload, encryptKey) {
  const keyDigest = await crypto.subtle.digest("SHA-256", encoder.encode(encryptKey));
  const key = await crypto.subtle.importKey("raw", keyDigest, { name: "AES-CBC" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, plaintext));
  const packet = new Uint8Array(iv.length + ciphertext.length);
  packet.set(iv);
  packet.set(ciphertext, iv.length);
  return packet;
}

function base64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function larkHeaders(rawBody, encryptKey) {
  const timestamp = "1720000000";
  const nonce = "event-nonce";
  const prefix = encoder.encode(timestamp + nonce + encryptKey);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix);
  signed.set(rawBody, prefix.length);
  return new Headers({
    "X-Lark-Request-Timestamp": timestamp,
    "X-Lark-Request-Nonce": nonce,
    "X-Lark-Signature": await sha256Hex(signed),
  });
}

function eventPayload({
  eventId = "evt-1",
  messageId = "om_1",
  eventType = "im.message.receive_v1",
  chatType = "p2p",
  messageType = "text",
  senderType = "user",
  text = "进度",
  mentions = [],
  token = "verify-token",
} = {}) {
  const message = { message_id: messageId, chat_type: chatType, message_type: messageType, content: JSON.stringify({ text }), mentions };
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: eventType, token },
    event: { sender: { sender_type: senderType }, message },
  };
}

test("decodes a plaintext callback without rewriting its JSON envelope", async () => {
  const payload = { type: "url_verification", token: "verify-token", challenge: "challenge-value" };
  const rawBody = encoder.encode(JSON.stringify(payload));

  assert.deepEqual(await decodeFeishuRequest({ rawBody, headers: new Headers(), encryptKey: "" }), payload);
});

test("accepts a validly signed encrypted event delivery", async () => {
  const encryptKey = "encrypt-test-key";
  const payload = eventPayload();
  const rawBody = encoder.encode(JSON.stringify({ encrypt: base64(await encryptedBody(payload, encryptKey)) }));
  const headers = await larkHeaders(rawBody, encryptKey);

  assert.deepEqual(await decodeFeishuRequest({ rawBody, headers, encryptKey }), payload);
});

test("decrypts an encrypted URL verification handshake without signature headers", async () => {
  const encryptKey = "encrypt-test-key";
  const payload = { type: "url_verification", token: "verify-token", challenge: "challenge-value" };
  const rawBody = encoder.encode(JSON.stringify({ encrypt: base64(await encryptedBody(payload, encryptKey)) }));

  assert.deepEqual(await decodeFeishuRequest({ rawBody, headers: new Headers(), encryptKey }), payload);
});

test("still rejects an encrypted event with missing signature headers", async () => {
  const encryptKey = "encrypt-test-key";
  const payload = eventPayload();
  const rawBody = encoder.encode(JSON.stringify({ encrypt: base64(await encryptedBody(payload, encryptKey)) }));

  await assert.rejects(
    () => decodeFeishuRequest({ rawBody, headers: new Headers(), encryptKey }),
    /signature/i,
  );
});

test("rejects an encrypted event with a mismatched signature", async () => {
  const encryptKey = "encrypt-test-key";
  const payload = eventPayload();
  const rawBody = encoder.encode(JSON.stringify({ encrypt: base64(await encryptedBody(payload, encryptKey)) }));
  const headers = await larkHeaders(rawBody, encryptKey);
  headers.set("X-Lark-Signature", "0".repeat(64));

  await assert.rejects(
    () => decodeFeishuRequest({ rawBody, headers, encryptKey }),
    /signature/i,
  );
});

test("requires a valid signature on plaintext events when an Encrypt Key is configured", async () => {
  const rawBody = encoder.encode(JSON.stringify(eventPayload()));
  await assert.rejects(
    () => decodeFeishuRequest({ rawBody, headers: new Headers(), encryptKey: "encrypt-test-key" }),
    /signature/i,
  );
});

test("accepts a plaintext event with a valid signature when an Encrypt Key is configured", async () => {
  const encryptKey = "encrypt-test-key";
  const rawBody = encoder.encode(JSON.stringify(eventPayload()));
  const headers = await larkHeaders(rawBody, encryptKey);

  assert.deepEqual(await decodeFeishuRequest({ rawBody, headers, encryptKey }), eventPayload());
});

test("allows a plaintext URL verification handshake without signature headers", async () => {
  const payload = { type: "url_verification", token: "verify-token", challenge: "plain-challenge" };
  const rawBody = encoder.encode(JSON.stringify(payload));

  assert.deepEqual(await decodeFeishuRequest({ rawBody, headers: new Headers(), encryptKey: "encrypt-test-key" }), payload);
});

test("rejects encrypted callbacks without all signature headers", async () => {
  const encryptKey = "encrypt-test-key";
  const rawBody = encoder.encode(JSON.stringify({ encrypt: "AA==" }));

  await assert.rejects(() => decodeFeishuRequest({ rawBody, headers: new Headers(), encryptKey }));
});

test("rejects malformed callback JSON", async () => {
  await assert.rejects(() => decodeFeishuRequest({
    rawBody: encoder.encode("{"),
    headers: new Headers(),
    encryptKey: "",
  }));
});

test("validates URL verification token match and mismatch", () => {
  const handshake = { type: "url_verification", token: "verify-token", challenge: "c" };
  assert.equal(validateVerificationToken(handshake, "verify-token"), true);
  assert.equal(validateVerificationToken(handshake, "different-token"), false);
  assert.equal(validateVerificationToken(handshake, ""), false);
});

test("validates the schema 2.0 event header token", () => {
  assert.equal(validateVerificationToken(eventPayload(), "verify-token"), true);
  assert.equal(validateVerificationToken(eventPayload({ token: "wrong" }), "verify-token"), false);
});

test("selects direct text messages from users without requiring a mention", () => {
  const selected = selectMessageEvent(eventPayload({ chatType: "p2p", text: "查一下网址" }), "ou_bot");
  assert.deepEqual(selected, { eventId: "evt-1", messageId: "om_1", chatType: "p2p", text: "查一下网址" });
});

test("selects a group message only when it mentions this bot and removes its placeholder", () => {
  const payload = eventPayload({
    chatType: "group",
    text: "@_bot_1 及时汇报项目进度",
    mentions: [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
  });

  assert.deepEqual(selectMessageEvent(payload, "ou_bot"), {
    eventId: "evt-1",
    messageId: "om_1",
    chatType: "group",
    text: " 及时汇报项目进度",
  });
});

test("ignores a mention of another user or bot in group chat", () => {
  const personMention = eventPayload({
    chatType: "group",
    mentions: [{ key: "@_person", id: { open_id: "ou_person" } }],
  });
  const otherBotMention = eventPayload({
    chatType: "group",
    mentions: [{ key: "@_other_bot", id: { open_id: "ou_other_bot" } }],
  });

  assert.equal(selectMessageEvent(personMention, "ou_bot"), null);
  assert.equal(selectMessageEvent(otherBotMention, "ou_bot"), null);
});

test("ignores unrelated events, bot-authored messages, non-text messages, and missing IDs", () => {
  assert.equal(selectMessageEvent(eventPayload({ eventType: "im.message.reaction_v1" }), "ou_bot"), null);
  assert.equal(selectMessageEvent(eventPayload({ senderType: "app" }), "ou_bot"), null);
  assert.equal(selectMessageEvent(eventPayload({ messageType: "image" }), "ou_bot"), null);
  assert.equal(selectMessageEvent(eventPayload({ eventId: "" }), "ou_bot"), null);
  assert.equal(selectMessageEvent(eventPayload({ messageId: "" }), "ou_bot"), null);
});

test("extracts plain text message content", () => {
  assert.equal(
    extractMessageText({ message_type: "text", content: JSON.stringify({ text: "你好" }) }),
    "你好",
  );
});

test("renders a rich post with a title and every supported element type", () => {
  const message = {
    message_type: "post",
    content: JSON.stringify({
      title: "发布",
      content: [[
        { tag: "text", text: "看 " },
        { tag: "a", text: "官网", href: "https://example.com" },
        { tag: "a", text: "同链接", href: "同链接" },
        { tag: "at", user_name: "老三" },
        { tag: "at", user_id: "ou_x" },
        { tag: "img", image_key: "img_1" },
        { tag: "media", file_key: "file_1" },
        { tag: "emotion", emoji_type: "SMILE" },
        { tag: "unknown", text: "ignored" },
      ]],
    }),
  };

  assert.equal(
    extractMessageText(message),
    "发布\n看 官网 (https://example.com)同链接@老三@ou_x[image:img_1][media:file_1][SMILE]",
  );
});

test("renders a post keyed by language with a blank line between languages", () => {
  const message = {
    message_type: "post",
    content: JSON.stringify({
      zh_cn: { title: "标题", content: [[{ tag: "text", text: "中文" }]] },
      en_us: { title: "Title", content: [[{ tag: "text", text: "English" }]] },
    }),
  };

  assert.equal(extractMessageText(message), "标题\n中文\n\nTitle\nEnglish");
});

test("omits an empty post title and returns null for an empty post", () => {
  assert.equal(
    extractMessageText({
      message_type: "post",
      content: JSON.stringify({ title: "", content: [[{ tag: "text", text: "只有正文" }]] }),
    }),
    "只有正文",
  );
  assert.equal(
    extractMessageText({ message_type: "post", content: JSON.stringify({ content: [] }) }),
    null,
  );
});

test("extracts image messages as a marker and returns null for other types", () => {
  assert.equal(
    extractMessageText({ message_type: "image", content: JSON.stringify({ image_key: "img_9" }) }),
    "[image:img_9]",
  );
  assert.equal(extractMessageText({ message_type: "file", content: JSON.stringify({ file_key: "f" }) }), null);
  assert.equal(extractMessageText({ message_type: "text", content: "not-json" }), null);
});

function forwardPayload({
  eventId = "evt_fwd",
  messageId = "om_fwd",
  chatId = GROK_FORWARD_CHAT_ID,
  chatType = "group",
  messageType = "text",
  senderType = "user",
  eventType = "im.message.receive_v1",
  content = JSON.stringify({ text: "随便聊聊" }),
} = {}) {
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: eventType, token: "verify-token" },
    event: {
      sender: { sender_type: senderType, sender_id: { open_id: "ou_user", name: "老王" } },
      message: {
        message_id: messageId,
        chat_id: chatId,
        chat_type: chatType,
        message_type: messageType,
        content,
      },
    },
  };
}

test("selects any forward-chat group message without requiring a mention", () => {
  assert.deepEqual(selectForwardMessage(forwardPayload(), GROK_FORWARD_CHAT_ID), {
    eventId: "evt_fwd",
    messageId: "om_fwd",
    chatType: "group",
    messageType: "text",
    text: "随便聊聊",
  });
});

test("selects forward messages only from the configured chat and from users", () => {
  assert.equal(selectForwardMessage(forwardPayload({ chatId: "oc_other" }), GROK_FORWARD_CHAT_ID), null);
  assert.equal(selectForwardMessage(forwardPayload({ chatType: "p2p" }), GROK_FORWARD_CHAT_ID), null);
  assert.equal(selectForwardMessage(forwardPayload({ senderType: "app" }), GROK_FORWARD_CHAT_ID), null);
  assert.equal(selectForwardMessage(forwardPayload({ eventType: "im.message.reaction_v1" }), GROK_FORWARD_CHAT_ID), null);
  assert.equal(selectForwardMessage(forwardPayload({ messageId: "" }), GROK_FORWARD_CHAT_ID), null);
});

test("marks an unsupported forward message instead of dropping it", () => {
  const selected = selectForwardMessage(
    forwardPayload({ messageType: "file", content: JSON.stringify({ file_key: "file_1" }) }),
    GROK_FORWARD_CHAT_ID,
  );

  assert.deepEqual(selected, {
    eventId: "evt_fwd",
    messageId: "om_fwd",
    chatType: "group",
    messageType: "file",
    text: "[unsupported:file]",
  });
});

test("logs an ignored non-text reply message and an unsupported forward message", () => {
  const logged = [];
  const original = console.log;
  console.log = (...args) => { logged.push(args.join(" ")); };
  try {
    assert.equal(selectMessageEvent(eventPayload({ messageType: "image" }), "ou_bot"), null);
    const selected = selectForwardMessage(
      forwardPayload({ messageType: "file", content: JSON.stringify({ file_key: "file_1" }) }),
      GROK_FORWARD_CHAT_ID,
    );
    assert.equal(selected.text, "[unsupported:file]");
  } finally {
    console.log = original;
  }

  assert.ok(logged.some((line) => line.includes("ignored message_type=image")));
  assert.ok(logged.some((line) => line.includes("unsupported message_type=file")));
});

test("detects a bot mention from the text mentions array", () => {
  const message = {
    message_type: "text",
    content: JSON.stringify({ text: "@_bot_1 需求：落地页要加中文" }),
    mentions: [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
  };

  assert.equal(mentionsBot(message, "ou_bot"), true);
  assert.equal(mentionsBot(message, "ou_other"), false);
  assert.equal(mentionsBot(message, ""), false);
});

test("detects a bot mention from a post at element", () => {
  const message = {
    message_type: "post",
    content: JSON.stringify({
      title: "需求",
      content: [[{ tag: "at", user_id: "ou_bot" }, { tag: "text", text: " 落地页要加中文" }]],
    }),
    mentions: [],
  };
  const otherBot = {
    message_type: "post",
    content: JSON.stringify({
      zh_cn: { content: [[{ tag: "at", user_id: "ou_other" }]] },
    }),
  };

  assert.equal(mentionsBot(message, "ou_bot"), true);
  assert.equal(mentionsBot(otherBot, "ou_bot"), false);
  assert.equal(mentionsBot({ message_type: "text", content: JSON.stringify({ text: "没有提到" }) }, "ou_bot"), false);
});
