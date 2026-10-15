export const PROGRESS_MESSAGE = "项目正在持续开发中。回复「网址」查看演示站，回复「健康」检查服务；具体进度请项目负责人更新机器人配置。";

export const HELP_MESSAGE = "我可以帮你查询：回复「进度」查看项目进度，回复「网址」获取网站地址，回复「健康」检查服务状态。群聊中请 @我。";

export function parseCommand(text) {
  const normalized = typeof text === "string" ? text.normalize("NFKC").trim() : "";
  const matches = [
    ["progress", /进度/u],
    ["url", /网址/u],
    ["health", /健康/u],
  ].filter(([, pattern]) => pattern.test(normalized));

  return matches.length === 1 ? matches[0][0] : "help";
}
