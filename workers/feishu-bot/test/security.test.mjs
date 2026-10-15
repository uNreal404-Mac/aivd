import assert from "node:assert/strict";
import test from "node:test";
import { decryptLarkPayload, verifyLarkSignature } from "../src/security.mjs";

const encoder = new TextEncoder();

async function deriveAesKey(encryptKey) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(encryptKey));
  return crypto.subtle.importKey("raw", digest, { name: "AES-CBC" }, false, ["encrypt"]);
}

async function encryptedPayload(plaintext, encryptKey, iv = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await deriveAesKey(encryptKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, encoder.encode(plaintext));
  const packet = new Uint8Array(iv.length + ciphertext.byteLength);
  packet.set(iv);
  packet.set(new Uint8Array(ciphertext), iv.length);
  return packet;
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("verifies a signature over the exact raw request bytes", async () => {
  const rawBody = encoder.encode('{"encrypt":"AQID"}');
  const timestamp = "1720000000";
  const nonce = "nonce-value";
  const encryptKey = "test-encrypt-key";
  const prefix = encoder.encode(timestamp + nonce + encryptKey);
  const signedBytes = new Uint8Array(prefix.length + rawBody.length);
  signedBytes.set(prefix);
  signedBytes.set(rawBody, prefix.length);
  const signature = await sha256Hex(signedBytes);

  assert.equal(await verifyLarkSignature({ rawBody, timestamp, nonce, signature, encryptKey }), true);

  const altered = rawBody.slice();
  altered[altered.length - 2] ^= 1;
  assert.equal(await verifyLarkSignature({ rawBody: altered, timestamp, nonce, signature, encryptKey }), false);
});

test("rejects missing signature components and a mismatched digest", async () => {
  const args = {
    rawBody: encoder.encode("{}"),
    timestamp: "1",
    nonce: "n",
    signature: "0".repeat(64),
    encryptKey: "key",
  };

  assert.equal(await verifyLarkSignature({ ...args, timestamp: "" }), false);
  assert.equal(await verifyLarkSignature({ ...args, nonce: null }), false);
  assert.equal(await verifyLarkSignature({ ...args, signature: "not-hex" }), false);
  assert.equal(await verifyLarkSignature(args), false);
});

test("decrypts an AES-256-CBC payload with the IV prefixed to the ciphertext", async () => {
  const encryptKey = "test-encrypt-key";
  const expected = '{"type":"url_verification","challenge":"abc"}';
  const packet = await encryptedPayload(expected, encryptKey);

  const decrypted = await decryptLarkPayload(toBase64(packet), encryptKey);
  assert.equal(new TextDecoder().decode(decrypted), expected);
});

test("rejects malformed base64 and ciphertext shorter than an IV plus one block", async () => {
  await assert.rejects(() => decryptLarkPayload("not base64!", "key"));
  await assert.rejects(() => decryptLarkPayload(toBase64(new Uint8Array(31)), "key"));
});

test("rejects ciphertext whose decrypted PKCS#7 padding is invalid", async () => {
  const encryptKey = "test-encrypt-key";
  const packet = await encryptedPayload("123456789012345", encryptKey);
  packet[15] ^= 1;

  await assert.rejects(() => decryptLarkPayload(toBase64(packet), encryptKey));
});
