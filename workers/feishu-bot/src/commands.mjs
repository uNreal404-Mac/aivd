import { botConfig } from "./config.mjs";
import { STATIC_PROGRESS_MESSAGE } from "./site-progress.mjs";

export const PROGRESS_MESSAGE = STATIC_PROGRESS_MESSAGE;

export const HELP_MESSAGE = "我可以帮你查询：回复「进度」查看项目进度，回复「网址」获取网站地址，回复「健康」检查服务状态。群聊中请 @我。发送「需求：」可登记到 GitHub。";

export function parseCommand(text, config = botConfig) {
  const normalized = typeof text === "string" ? text.normalize("NFKC").trim() : "";
  const commands = Array.isArray(config?.commands) ? config.commands : [];

  for (const command of commands) {
    if (command.match === "prefix" && Array.isArray(command.prefixes)
      && command.prefixes.some((prefix) => prefix && normalized.startsWith(prefix))) {
      return command.name;
    }
  }

  const matches = commands.filter((command) => {
    if (command.match === "prefix" || typeof command.pattern !== "string" || !command.pattern) return false;
    return new RegExp(command.pattern, "u").test(normalized);
  });

  return matches.length === 1 ? matches[0].name : "help";
}
