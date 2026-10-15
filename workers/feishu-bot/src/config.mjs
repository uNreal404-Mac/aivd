/**
 * Copy-this-file configuration for a role bot.
 * New bots should duplicate `workers/feishu-bot/`, rename the Worker, and edit this object.
 */
export const botConfig = {
  name: "feishu-bot",
  siteUrl: "https://dreamutopia-clone.pages.dev",
  healthUrl: "https://dreamutopia-clone.pages.dev/api/health",
  github: {
    apiBase: "https://api.github.com",
    owner: "CharlesHarry7",
    repo: "dreamutopia-clone",
    progressIssueNumber: 20,
    requestLabel: "feishu-request",
    userAgent: "dreamutopia-feishu-bot",
  },
  progress: {
    commentLimit: 5,
    cacheTtlSeconds: 300,
    timeZone: "Asia/Taipei",
  },
  request: {
    rateLimitSeconds: 60,
  },
  commands: [
    {
      name: "request",
      match: "prefix",
      prefixes: ["需求：", "需求:"],
      source: "github-create-issue",
      formatter: "issueCreatedReply",
    },
    {
      name: "progress",
      match: "pattern",
      pattern: "进度",
      source: "github-issue-comments",
      formatter: "plainChineseComments",
    },
    {
      name: "url",
      match: "pattern",
      pattern: "网址",
      source: "static",
      formatter: "static",
    },
    {
      name: "health",
      match: "pattern",
      pattern: "健康",
      source: "health-http",
      formatter: "healthSummary",
    },
  ],
};
