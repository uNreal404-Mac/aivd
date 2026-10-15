import { extractPendingRaw, describePendingItem } from "./site-progress.mjs";

export const PENDING_TBD = "待定";

export function extractEta(raw) {
  const source = String(raw ?? "");
  const re = /[（(]?\s*(?:预计完成|预计|ETA|eta|截止|due)\s*[:：]?\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})\s*[）)]?/u;
  const match = source.match(re);
  if (!match) return { text: source.trim(), eta: "" };
  return { text: source.replace(match[0], " ").replace(/\s+/gu, " ").trim(), eta: match[1] };
}

export function pendingItemsWithEta(issueBody) {
  const items = new Set();
  const seen = new Set();

  for (const raw of extractPendingRaw(issueBody)) {
    const { text, eta } = extractEta(raw);
    const label = describePendingItem(text) || text.trim();

    if (!label) continue;

    if (seen.has(label)) continue;

    seen.add(label);
    items.add(JSON.stringify({ item: label, eta: eta || PENDING_TBD }));
  }

  return [...items].map(JSON.parse).slice(0, 6);
}

export function parseHighlights(raw) {
  const lines = raw
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const bulletsRegex = /^(?:[-*•]\s*|\d+[.、)]\s*)/u;
  const processed = lines
    .map(line => line.replace(bulletsRegex, "").trim())
    .filter(line => line.length > 0)
    .map(line => line.slice(0, 60));

  return processed.slice(0, 4);
}

export async function summarizeHighlights({ llm, completeChat, title, body, fetchImpl }) {
  if (!llm || typeof completeChat !== "function") {
    return [title];
  }

  try {
    const content = `标题：${title}\n\n说明：\n${String(body ?? "").slice(0, 3000)}`;
    const raw = await completeChat({
      llm,
      fetchImpl,
      timeoutMs: Math.min(Number(llm.timeoutMs) || 5000, 5000),
      messages: [
        {
          role: "system",
          content: "你是项目播报助手。用通俗中文、不超过4条要点，说明这次更新带来的关键新功能或突破进展。每行一条，不要编号以外的多余内容，不要编造未提到的内容，不要输出任何密钥或链接。"
        },
        {
          role: "user",
          content
        }
      ]
    });

    const items = parseHighlights(raw);
    return items.length ? items : [title];
  } catch {
    return [title];
  }
}

export function formatAnnouncement({ header, highlights = [], pending = [], link = "" }) {
  const lines = [header, "", "本次重点："];

  for (const highlight of highlights) {
    lines.push(`• ${highlight}`);
  }

  if (pending.length > 0) {
    lines.push("", "还没完成（预计完成时间）：");
    for (const item of pending) {
      lines.push(`• ${item.item}（${item.eta || PENDING_TBD}）`);
    }
  }

  if (link) {
    lines.push("", link);
  }

  return lines.join("\n");
}
