export function stripMarkdown(text) {
  let value = String(text ?? "");
  value = value.replace(/```[\s\S]*?```/g, "\n");
  value = value.replace(/`[^`]*`/g, " ");
  value = value.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  value = value.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  value = value.replace(/\bhttps?:\/\/[^\s)]+/gi, " ");
  value = value.replace(/\b[0-9a-f]{7,40}\b/gi, "");
  value = value.replace(/（\s*）/g, "");
  value = value.replace(/\(\s*\)/g, "");
  value = value.replace(/^#{1,6}\s+.*$/gm, "");
  value = value.replace(/^\s*>+\s?/gm, "");
  value = value.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");
  value = value.replace(/[*_~]+/g, "");
  value = value.replace(/^\s*[-*+]\s+/gm, "");
  value = value.replace(/^\s*\d+\.\s+/gm, "");
  value = value.replace(/\|/g, " ");
  value = value.replace(/[ \t]+/g, " ");
  return value.replace(/[ \t]+\n/g, "\n").trim();
}

export function keyLines(text, limit = 2) {
  return stripMarkdown(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[-*_.=]{3,}$/.test(line))
    .slice(0, limit)
    .map((line) => (line.length > 80 ? `${line.slice(0, 77)}…` : line));
}

export function formatTaipeiDate(value, timeZone = "Asia/Taipei") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function formatCommentSummary(comments, {
  issueNumber = 20,
  timeZone = "Asia/Taipei",
  limit = 5,
  now = Date.now(),
} = {}) {
  const items = (Array.isArray(comments) ? comments : [])
    .filter((comment) => comment && typeof comment.body === "string")
    .slice(-limit)
    .map((comment) => {
      const lines = keyLines(comment.body, 2);
      if (!lines.length) return null;
      const when = formatTaipeiDate(comment.created_at || now, timeZone);
      const user = comment.user?.login ? String(comment.user.login) : "同事";
      const day = when.slice(5, 10);
      return { when, text: `• ${day} ${user}：${lines.join(" ")}` };
    })
    .filter(Boolean);

  if (!items.length) {
    const nowLabel = formatTaipeiDate(now, timeZone);
    return `项目进度（台北时间 ${nowLabel}）：GitHub #${issueNumber} 最近没有可展示的文字更新。可回复「网址」或「健康」查看站点。`;
  }

  const latest = items[items.length - 1].when;
  return [`项目进度（台北时间 ${latest}）：`, ...items.map((item) => item.text)].join("\n");
}
