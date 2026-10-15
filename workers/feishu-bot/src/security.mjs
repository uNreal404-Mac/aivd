const encoder = new TextEncoder();

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalHex(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyLarkSignature({ rawBody, timestamp, nonce, signature, encryptKey }) {
  const body = asBytes(rawBody);
  if (!body || !timestamp || !nonce || !signature || !encryptKey || !/^[a-f\d]{64}$/i.test(signature)) {
    return false;
  }

  try {
    const prefix = encoder.encode(`${timestamp}${nonce}${encryptKey}`);
    const message = new Uint8Array(prefix.length + body.length);
    message.set(prefix);
    message.set(body, prefix.length);
    const digest = await crypto.subtle.digest("SHA-256", message);
    return equalHex(toHex(new Uint8Array(digest)), signature.toLowerCase());
  } catch {
    return false;
  }
}

function decodeBase64(value) {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 === 1) {
    throw new Error("Invalid encrypted payload");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/.test(value)) {
    throw new Error("Invalid encrypted payload");
  }

  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function decryptLarkPayload(encryptedBase64, encryptKey) {
  if (typeof encryptKey !== "string" || encryptKey.length === 0) {
    throw new Error("Encrypt Key is required");
  }

  const payload = decodeBase64(encryptedBase64);
  if (payload.length < 32 || (payload.length - 16) % 16 !== 0) {
    throw new Error("Invalid encrypted payload length");
  }

  const keyDigest = await crypto.subtle.digest("SHA-256", encoder.encode(encryptKey));
  const key = await crypto.subtle.importKey("raw", keyDigest, { name: "AES-CBC" }, false, ["decrypt"]);
  const iv = payload.slice(0, 16);
  const ciphertext = payload.slice(16);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  return new Uint8Array(plaintext);
}
