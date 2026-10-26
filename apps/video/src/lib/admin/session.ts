import { env } from "@/lib/auth/env.mjs";

export const ADMIN_SESSION_COOKIE = "aivd_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

interface AdminSessionPayload {
  version: 1;
  username: string;
  expiresAt: number;
}

export interface AdminPrincipal {
  id: string;
  name: string;
  email: string;
  image: null;
  isAdmin: true;
  source: "admin-panel";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function configuredUsername(): string {
  return env.ADMIN_PANEL_USERNAME?.trim() || "aivd001";
}

function sessionSecret(): string | null {
  return env.ADMIN_PANEL_SESSION_SECRET || env.BETTER_AUTH_SECRET || null;
}

async function hmac(value: string): Promise<Uint8Array> {
  const secret = sessionSecret();
  if (!secret) throw new Error("Admin session secret is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function parsePasswordHash(value: string): {
  iterations: number;
  salt: Uint8Array;
  digest: Uint8Array;
} | null {
  const [algorithm, iterationsText, saltText, digestText] = value.split("$");
  const iterations = Number(iterationsText);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !saltText ||
    !digestText
  ) {
    return null;
  }
  try {
    return {
      iterations,
      salt: fromBase64Url(saltText),
      digest: fromBase64Url(digestText),
    };
  } catch {
    return null;
  }
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const parsed = env.ADMIN_PANEL_PASSWORD_HASH
    ? parsePasswordHash(env.ADMIN_PANEL_PASSWORD_HASH)
    : null;
  if (!parsed || username !== configuredUsername()) return false;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const candidate = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: parsed.salt,
        iterations: parsed.iterations,
      },
      keyMaterial,
      parsed.digest.byteLength * 8,
    ),
  );

  if (candidate.byteLength !== parsed.digest.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < candidate.byteLength; index += 1) {
    difference |= candidate[index] ^ parsed.digest[index];
  }
  return difference === 0;
}

export async function createAdminSessionToken(): Promise<string> {
  const payload: AdminSessionPayload = {
    version: 1,
    username: configuredUsername(),
    expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(body));
  return `${body}.${signature}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
): Promise<AdminPrincipal | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  let validSignature = false;
  try {
    const expected = await hmac(body);
    const received = fromBase64Url(signature);
    if (expected.byteLength === received.byteLength) {
      let difference = 0;
      for (let index = 0; index < expected.byteLength; index += 1) {
        difference |= expected[index] ^ received[index];
      }
      validSignature = difference === 0;
    }
  } catch {
    return null;
  }
  if (!validSignature) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as AdminSessionPayload;
    if (
      payload.version !== 1 ||
      payload.username !== configuredUsername() ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return {
      id: `admin-panel:${payload.username}`,
      name: payload.username,
      email: "admin@local.invalid",
      image: null,
      isAdmin: true,
      source: "admin-panel",
    };
  } catch {
    return null;
  }
}

export function readCookie(headers: Headers, name: string): string | undefined {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

export async function getAdminPanelPrincipal(
  headers: Headers,
): Promise<AdminPrincipal | null> {
  return verifyAdminSessionToken(readCookie(headers, ADMIN_SESSION_COOKIE));
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new Error("Invalid request origin");
  }
}
