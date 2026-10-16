export const ATTRIBUTION_COOKIE = "du_attr";

export const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
] as const;

const MAX_VALUE_LENGTH = 100;

const ATTRIBUTION_KEYS: readonly string[] = [
  ...ATTRIBUTION_PARAMS,
  "landing_path",
  "first_seen",
];

function sanitizeValue(value: string): string {
  return value.trim().slice(0, MAX_VALUE_LENGTH);
}

export function pickAttribution(
  search: URLSearchParams,
): Record<string, string> | null {
  const result: Record<string, string> = {};

  for (const key of ATTRIBUTION_PARAMS) {
    const raw = search.get(key);
    if (raw === null) {
      continue;
    }
    const value = sanitizeValue(raw);
    if (value.length === 0) {
      continue;
    }
    result[key] = value;
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

export function readAttributionCookie(): Record<string, string> | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieString = document.cookie;
  if (!cookieString) {
    return null;
  }

  const prefix = `${ATTRIBUTION_COOKIE}=`;
  let rawValue: string | undefined;

  for (const part of cookieString.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      rawValue = trimmed.slice(prefix.length);
      break;
    }
  }

  if (!rawValue) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawValue);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const result: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}
