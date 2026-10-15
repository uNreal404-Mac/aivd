import { PROGRESS_MESSAGE } from "./commands.mjs";
import { botConfig } from "./config.mjs";
import { fetchWebsiteProgressData } from "./github.mjs";
import { buildProgressFromGithub } from "./site-progress.mjs";

export function progressCacheKey(issueNumber = botConfig.github.progressIssueNumber) {
  return `progress:site:${issueNumber}`;
}

export async function fetchProgressSummary({
  kv,
  token,
  fetchImpl = fetch,
  now: _now = Date.now,
  config = botConfig,
} = {}) {
  const issueNumber = config.github.progressIssueNumber;
  const cacheKey = progressCacheKey(issueNumber);
  const cached = await kv.get(cacheKey);
  if (typeof cached === "string" && cached) return cached;

  try {
    const data = await fetchWebsiteProgressData({ fetchImpl, token, config });
    const summary = buildProgressFromGithub({
      issueBody: data.issueBody,
      mergedPulls: data.mergedPulls,
      openPulls: data.openPulls,
      detailUrl: config.siteUrl,
    });
    await kv.put(cacheKey, summary, {
      expirationTtl: Math.max(60, config.progress.cacheTtlSeconds),
    });
    return summary;
  } catch {
    return PROGRESS_MESSAGE;
  }
}
