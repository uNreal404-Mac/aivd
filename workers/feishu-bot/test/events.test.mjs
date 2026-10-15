import assert from "node:assert/strict";
import test from "node:test";
import { decodeFeishuRequest, selectMessageEvent, validateVerificationToken } from "../src/events.mjs";

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

test("verifies the raw-body signature before decrypting an encrypted callback", async () => {
  const encryptKey = "encrypt-test-key";
  const payload = { type: "url_verification", token: "verify-token", challenge: "challenge-value" };
  const rawBody = encoder.encode(JSON.stringify({ encrypt: base64(await encryptedBody(payload, encryptKey)) }));
  const headers = await larkHeaders(rawBody, encryptKey);

  assert.deepEqual(await decodeFeishuRequest({ rawBody, headers, encryptKey }), payload);
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
