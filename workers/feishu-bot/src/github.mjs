import { botConfig } from "./config.mjs";

const encoder = new TextEncoder();

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": botConfig.github.userAgent,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (typeof token === "string" && token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string") return encoder.encode(value);
  throw new TypeError("HMAC payload must be bytes or text");
}

function equalDigest(left, right) {
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    try {
      return crypto.subtle.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function hmacSha256Hex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, asBytes(data));
  return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyGitHubSignature(rawBody, signatureHeader, secret) {
  if (typeof secret !== "string" || !secret || typeof signatureHeader !== "string" || !signatureHeader) {
    return false;
  }
  const digest = await hmacSha256Hex(secret, rawBody);
  const expected = `sha256=${digest}`;
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(signatureHeader)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return equalDigest(left, right);
}

async function readGithubJson(response, label) {
  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    const error = new Error(`${label} returned invalid JSON`, { cause });
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`${label} failed`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function listIssueComments({
  fetchImpl = fetch,
  token,
  owner = botConfig.github.owner,
  repo = botConfig.github.repo,
  issueNumber = botConfig.github.progressIssueNumber,
} = {}) {
  const url = `${botConfig.github.apiBase}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=30`;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: githubHeaders(token),
    redirect: "error",
  });
  const payload = await readGithubJson(response, "GitHub comments");
  if (!Array.isArray(payload)) throw new Error("GitHub comments response was invalid");
  return payload;
}

export async function createIssue({
  fetchImpl = fetch,
  token,
  title,
  body,
  labels,
  owner = botConfig.github.owner,
  repo = botConfig.github.repo,
} = {}) {
  if (typeof token !== "string" || !token) {
    const error = new Error("GitHub token is not configured");
    error.status = 503;
    throw error;
  }

  const post = async (payload) => {
    const response = await fetchImpl(`${botConfig.github.apiBase}/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: {
        ...githubHeaders(token),
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return readGithubJson(response, "GitHub issue create");
  };

  const payload = { title, body };
  if (Array.isArray(labels) && labels.length) payload.labels = labels;

  let created;
  try {
    created = await post(payload);
  } catch (error) {
    if (error?.status === 422 && payload.labels) {
      const retryPayload = { title, body };
      created = await post(retryPayload);
    } else {
      throw error;
    }
  }

  if (!Number.isFinite(created?.number) || typeof created.html_url !== "string" || !created.html_url) {
    throw new Error("GitHub issue create response was invalid");
  }
  return {
    number: created.number,
    html_url: created.html_url,
    title: typeof created.title === "string" ? created.title : title,
  };
}
