export const AGENT_CANVAS_HANDOFF = "aivd:agent-canvas-handoff:";

export type AgentCanvasMessage = { role: "user" | "agent"; text: string; prompt?: string };
export type AgentCanvasHandoff = { ownerId: string; title: string; prompt: string; messages: AgentCanvasMessage[] };

export function agentCanvasTitle(messages: AgentCanvasMessage[], fallback: string): string {
  const idea = messages.find((message) => message.role === "user")?.text.trim() || fallback;
  const firstLine = idea.split(/[。！？!?\n]/)[0].trim();
  const quoted = firstLine.match(/[“「『"]([^”」』"]{1,30})[”」』"]/)?.[1];
  if (quoted) return quoted.trim();
  const cleaned = firstLine
    .replace(/^(?:请|可以|能不能|帮我|帮忙|我想|我希望|我要|我需要|给我|帮我想|策划|构思|做|制作|创建|生成|设计|拍|一个|一段|一支|一条|一部|一张|个|段|支|条|部|张|的|关于|有关|以|用|把|将|想要|来)+/g, "")
    .replace(/(?:的|一个|一段|一支|一条|一部|一张)?(?:短视频|视频|短片|影片|图片|图像|画面|故事|广告|分镜|作品|项目|画布)(?:方案|策划|创意)?(?:吧|呢|吗)?$/g, "")
    .replace(/[，,：:；;\s]+$/g, "")
    .trim();
  return (cleaned || firstLine || fallback).slice(0, 30);
}
