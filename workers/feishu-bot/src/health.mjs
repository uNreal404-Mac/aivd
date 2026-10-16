export const HEALTH_URL = "https://dreamutopia-video.pages.dev/api/health";
const DEFAULT_TIMEOUT_MS = 4000;
const HEALTH_FIELDS = [
  "ok",
  "authReady",
  "generationEnabled",
  "generateReady",
  "uploadReady",
  "checkoutConfigured",
  "mailConfigured",
];

function formatHealthValue(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

export async function fetchHealthSummary({ fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(HEALTH_URL, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) return `健康检查失败：HTTP ${response.status}。`;

    let payload;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) return "健康检查超时。";
      return `健康检查失败：HTTP ${response.status}，返回格式无效。`;
    }

    const fields = HEALTH_FIELDS.map((field) => `${field}=${formatHealthValue(payload?.[field])}`);
    return `健康检查：HTTP ${response.status}；${fields.join("；")}`;
  } catch {
    return controller.signal.aborted ? "健康检查超时。" : "健康检查请求失败。";
  } finally {
    clearTimeout(timeout);
  }
}
