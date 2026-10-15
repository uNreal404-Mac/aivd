import { PROGRESS_MESSAGE } from "./commands.mjs";
import { botConfig } from "./config.mjs";
import { listIssueComments } from "./github.mjs";
import { formatCommentSummary } from "./summary.mjs";

export function progressCacheKey(issueNumber = botConfig.github.progressIssueNumber) {
  return `progress:issue:${issueNumber}`;
}

export async function fetchProgressSummary({
  kv,
  token,
  fetchImpl = fetch,
  now = Date.now,
  config = botConfig,
} = {}) {
  const issueNumber = config.github.progressIssueNumber;
  const cacheKey = progressCacheKey(issueNumber);
  const cached = await kv.get(cacheKey);
  if (typeof cached === "string" && cached) return cached;

  try {
    const comments = await listIssueComments({
      fetchImpl,
      token,
      owner: config.github.owner,
      repo: config.github.repo,
      issueNumber,
    });
    const summary = formatCommentSummary(comments, {
      issueNumber,
      timeZone: config.progress.timeZone,
      limit: config.progress.commentLimit,
      now: typeof now === "function" ? now() : now,
    });
    await kv.put(cacheKey, summary, {
      expirationTtl: Math.max(60, config.progress.cacheTtlSeconds),
    });
    return summary;
  } catch {
    return PROGRESS_MESSAGE;
  }
}
