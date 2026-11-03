import type { Metadata } from "next";
import { calculateModelCredits, CREDITS_CONFIG, getModelConfig } from "@/config/credits";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

export type SeedanceVersion = "2.5" | "2.0";
export const fallbackModel = "seedance-1.5-pro";

export const seedanceGuides = {
  "2.5": {
    slug: "seedance-2-5",
    official: "https://seed.bytedance.com/en/seedance2_5",
    en: "Check Seedance 2.5 availability on aidv.ai, compare ByteDance’s 30-second model with the available 1.5 Pro workflow, and check actual credit costs.",
    zh: "了解 Seedance 2.5 在 aidv.ai 的接入状态，对照字节跳动官方的 30 秒能力，查看当前可用的 1.5 Pro 工具和积分价格。",
  },
  "2.0": {
    slug: "seedance-2",
    official: "https://seed.bytedance.com/en/seedance2_0",
    en: "Check Seedance 2.0 availability on aidv.ai, learn which reference inputs are available here, and try the existing Seedance 1.5 Pro workflow.",
    zh: "查看 Seedance 2.0 在 aidv.ai 的支持状态，比较参考输入类型，了解可用的 Seedance 1.5 Pro 工作流、时长和所需积分。",
  },
} as const;

export function supportTitle(version: SeedanceVersion, lang: Locale) {
  return lang === "zh" ? `Seedance ${version} 支持状态` : `Seedance ${version} Support Status`;
}

export function supportMetadata(version: SeedanceVersion, lang: Locale): Metadata {
  const guide = seedanceGuides[version];
  const title = `${supportTitle(version, lang)} | aidv.ai`;
  const description = guide[lang];
  const alternates = buildAlternates("/" + guide.slug, lang);
  return {
    title: { absolute: title }, description, alternates,
    openGraph: { type: "website", title, description, url: alternates.canonical },
    twitter: { card: "summary", title, description },
  };
}

export function supportFaq(version: SeedanceVersion, lang: Locale) {
  const zh = lang === "zh";
  const gift = CREDITS_CONFIG.registerGift;
  const available = getModelConfig(fallbackModel);
  const min = available ? calculateModelCredits(fallbackModel, {
    duration: Math.min(...available.durations), quality: available.qualities?.[0],
  }) : undefined;
  const welcome = gift.enabled
    ? (zh ? `注册赠送 ${gift.amount} 积分，有效期 ${gift.expireDays} 天。` : `New accounts receive ${gift.amount} credits for ${gift.expireDays} days. `)
    : (zh ? "目前没有注册赠送积分。" : "There is no current welcome-credit offer. ");
  const cost = min === undefined ? "" : (zh ? `目前 1.5 Pro 最短片段需要 ${min} 积分。` : `The shortest 1.5 Pro clip currently costs ${min} credits.`);
  return zh ? [
    [`本站能生成 Seedance ${version} 视频吗？`, `尚未接入 ${version}。本页输入框选中的是 Seedance 1.5 Pro，提交后会打开现有工作台。`],
    ["aidv.ai 是字节跳动官网吗？", "aidv.ai 不是 ByteDance（字节跳动）官方。上方的官方模型链接会带你前往 ByteDance Seed 网站。"],
    ["可以免费生成吗？", welcome + cost],
    ["导出的视频会带水印吗？", "本站没有承诺 Seedance 无水印导出。用于客户交付前，请检查实际导出的文件。"],
    ["生成的内容可以商用吗？", "Pro 和 Ultimate 订阅列有商业使用授权。使用自己的素材，并遵守模型提供商条款及适用法律。"],
    [`本站提供 Seedance ${version} API 吗？`, `本站没有开放 ${version} 开发者 API。官方模型页面提供字节跳动自己的服务信息。`],
    ["能上传参考视频或者音频吗？", "当前工具提供文字描述和图生视频入口。你可以在图生视频工作台添加参考图，本站未提供这个版本的参考视频或音频上传。"],
    ["如何估算更长视频的用量？", "按积分表查询每个短片的价格，再累加你计划生成的片段。重新生成一个片段也会使用积分。"],
  ] : [
    [`Can I generate Seedance ${version} video here?`, `Version ${version} is not connected. The composer selects Seedance 1.5 Pro and opens the existing studio.`],
    ["Is aidv.ai an official ByteDance service?", "aidv.ai is independent of ByteDance. The official model links above open the ByteDance Seed website."],
    ["Can I generate a free clip?", welcome + cost],
    ["Are exports watermark-free?", "aidv.ai does not guarantee watermark-free Seedance exports. Inspect the rendered file before delivering it to a client."],
    ["Can I use a clip commercially?", "The Pro and Ultimate subscriptions list commercial use. Use material you have rights to and observe the model provider’s terms and applicable law."],
    [`Is there an aidv.ai API for Seedance ${version}?`, `There is no public aidv.ai developer API for ${version}. The official model page lists ByteDance’s own access options.`],
    ["Can I upload reference audio or video?", "The available tools accept a written prompt and offer an image-to-video workflow for a reference still. They do not offer reference audio or video uploads for this version."],
    ["How do I budget for a longer sequence?", "Look up each shot’s length and resolution in the credit table, then add the individual costs. Allow for another generation if a shot needs a second take."],
  ];
}
