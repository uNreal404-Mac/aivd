"use client";

import { useTranslations, useLocale } from "next-intl";

import { Languages } from "lucide-react";

import Link from "next/link";

import { LocaleLink, useLocalePathname } from "@/i18n/navigation";
import { localizedHref } from "@/lib/locale-path";
import "./footer.css";

export function LandingFooter() {
  const t = useTranslations("Footer");
  const locale = useLocale();
  const zh = locale === "zh";
  const currentYear = new Date().getFullYear();
  const pathname = useLocalePathname();

  // A site directory, laid out after the reference site's footer: every page a
  // visitor or a crawler should reach, grouped the same way as the nav.
  const columns: { title?: string; groups: { title?: string; links: { title: string; href: string }[] }[] }[] = [
    {
      groups: [
        {
          title: zh ? "创作" : "Create",
          links: [
            { title: zh ? "AI 视频" : "AI Video", href: "/ai/video" },
            { title: zh ? "AI 视频生成器" : "AI Video Generator", href: "/video" },
            { title: zh ? "AI 文生视频" : "AI Text to Video", href: "/text-to-video" },
            { title: zh ? "AI 图生视频" : "AI Image to Video", href: "/image-to-video" },
            { title: zh ? "参考生视频" : "Reference to Video", href: "/reference-to-video" },
            { title: zh ? "AI 视频特效" : "AI Video Effects", href: "/effects" },
            { title: zh ? "AI 图像" : "AI Image", href: "/ai/image" },
            { title: zh ? "AI 图片生成器" : "AI Image Generator", href: "/image" },
            { title: zh ? "AI 配音" : "AI Voiceover", href: "/audio?voiceMode=voiceover" },
            { title: zh ? "AI 音乐与音效" : "AI Music & Sound", href: "/audio?voiceMode=music" },
          ],
        },
      ],
    },
    {
      groups: [
        {
          title: zh ? "视频模型" : "Video models",
          links: [
            { title: "Veo 3.1", href: "/models/veo-3-1" },
            { title: "Wan 2.6", href: "/models/wan-2-6" },
            { title: "Seedance 2.5", href: "/models/seedance-2-5" },
            { title: "Kling 4.0", href: "/models/kling-4-0" },
            { title: "Gemini Omni Flash", href: "/models/gemini-omni-flash-1-2" },
            { title: "MiniMax H3", href: "/models/minimax-h3" },
            { title: "Grok Imagine 1.5", href: "/models/grok-imagine-1-5" },
          ],
        },
        {
          title: zh ? "图像模型" : "Image models",
          links: [
            { title: "Nano Banana Pro", href: "/models/nano-banana-pro" },
            { title: "Seedream 5.5", href: "/models/seedream-5-5" },
            { title: "GPT Image 2.6", href: "/models/gpt-image-2-6-sunburst" },
            { title: "Kling Image 4.0", href: "/models/kling-image-4-0" },
            { title: "FLUX 3", href: "/models/flux-3-image" },
          ],
        },
      ],
    },
    {
      groups: [
        {
          title: zh ? "产品" : "Products",
          links: [
            { title: zh ? "创作空间" : "Creative Space", href: "/creative-space" },
            { title: zh ? "画布" : "Canvas", href: "/creative-space/canvas" },
            { title: zh ? "视频模板" : "Video templates", href: "/templates" },
            { title: zh ? "我的作品" : "My creations", href: "/my-creations" },
          ],
        },
        {
          title: zh ? "音频模型" : "Audio models",
          links: [
            { title: "Eleven v3", href: "/models/eleven-v3" },
            { title: "Gemini 3.8 TTS", href: "/models/gemini-3-8-flash-tts" },
            { title: "Suno V6", href: "/models/suno-v6" },
          ],
        },
      ],
    },
    {
      groups: [
        {
          title: zh ? "资源" : "Resources",
          links: [
            { title: zh ? "社区画廊" : "Community gallery", href: "/gallery" },
            { title: zh ? "定价" : "Pricing", href: "/pricing" },
          ],
        },
      ],
    },
    {
      groups: [
        {
          title: zh ? "关于" : "About",
          links: [
            { title: zh ? "联系我们" : "Contact", href: "/contact" },
            { title: t("privacy"), href: "/privacy" },
            { title: t("terms"), href: "/terms" },
            { title: zh ? "退款政策" : "Refund Policy", href: "/refund-policy" },
          ],
        },
      ],
    },
  ];

  return (
    <footer className="ft">
      <div className="ft-main">
        <div className="ft-brand">
          <LocaleLink href="/" className="ft-logo">
            <img src="/logo.svg" alt="" className="ft-logo-img" />
            aivd.ai
          </LocaleLink>
          <p className="ft-tagline">{zh ? <>AI 原生<br />创意工作室</> : <>An AI-native<br />creative studio</>}</p>
        </div>
        {columns.map((column, index) => (
          <div key={index} className="ft-col">
            {column.groups.map((group, groupIndex) => (
              <div key={group.title ?? groupIndex} className="ft-group">
                {group.title ? <p className="ft-group-title">{group.title}</p> : null}
                <ul>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <LocaleLink href={link.href} className="ft-link">
                        {link.title}
                      </LocaleLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="ft-bottom">
        <p>{t("copyright", { year: currentYear })}</p>
        <div className="ft-bottom-links">
          <Link href={localizedHref(zh ? "en" : "zh", pathname)} className="ft-lang" hrefLang={zh ? "en" : "zh"}>
            <Languages aria-hidden="true" />
            {zh ? "English" : "简体中文"}
          </Link>
          <LocaleLink href="/contact">{zh ? "联系我们" : "Contact"}</LocaleLink>
          <LocaleLink href="/refund-policy">{zh ? "退款政策" : "Refunds"}</LocaleLink>
          <LocaleLink href="/terms">{t("terms")}</LocaleLink>
          <LocaleLink href="/privacy">{t("privacy")}</LocaleLink>
        </div>
      </div>
    </footer>
  );
}
