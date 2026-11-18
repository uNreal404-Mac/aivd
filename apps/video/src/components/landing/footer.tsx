"use client";

import { useTranslations, useLocale } from "next-intl";

import { LocaleLink } from "@/i18n/navigation";

export function LandingFooter() {
  const t = useTranslations('Footer');
  const locale = useLocale();
  const isChinese = locale === "zh";
  const currentYear = new Date().getFullYear();

  // A site directory rather than a short link list: every page a visitor or a
  // crawler should be able to reach from anywhere. Only models that are on
  // sale are listed.
  const footerSections = [
    {
      title: isChinese ? "创作" : "Create",
      links: [
        { title: isChinese ? "AI 视频生成器" : "AI Video Generator", href: "/ai/video" },
        { title: isChinese ? "文字生成视频" : "Text to Video", href: "/text-to-video" },
        { title: isChinese ? "图片生成视频" : "Image to Video", href: "/image-to-video" },
        { title: isChinese ? "参考生成视频" : "Reference to Video", href: "/reference-to-video" },
        { title: isChinese ? "AI 图片生成器" : "AI Image Generator", href: "/ai/image" },
        { title: isChinese ? "创作空间" : "Creative Space", href: "/creative-space" },
      ],
    },
    {
      title: isChinese ? "视频模型" : "Video models",
      links: [
        { title: "Veo 3.1", href: "/veo-3-1" },
        { title: "Wan 2.6", href: "/wan-2-6" },
      ],
    },
    {
      title: isChinese ? "探索" : "Explore",
      links: [
        { title: isChinese ? "社区画廊" : "Community gallery", href: "/gallery" },
        { title: isChinese ? "灵感探索" : "Explore", href: "/explore" },
        { title: isChinese ? "视频特效" : "Video effects", href: "/effects" },
        { title: isChinese ? "定价" : "Pricing", href: "/pricing" },
      ],
    },
    {
      title: t('legal'),
      links: [
        { title: t('privacy'), href: "/privacy" },
        { title: t('terms'), href: "/terms" },
        { title: isChinese ? "退款政策" : "Refund Policy", href: "/refund-policy" },
        { title: isChinese ? "联系我们" : "Contact", href: "/contact" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[var(--du-border)] bg-[var(--du-bg-elev)]">
      <div className="mx-auto max-w-[1680px] px-6 py-16">
        {/* Main Footer Content */}
        <div className="mb-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:gap-12">
          {/* Brand Column */}
          <div>
            <LocaleLink
              href="/"
              className="flex items-center gap-2 text-xl font-semibold mb-4 text-[var(--du-text)]"
            >
              <img src="/logo.svg" alt="" className="h-9 w-9 rounded-lg" /> aivd.ai
            </LocaleLink>
            <p className="text-sm text-[var(--du-text-muted)] mb-4">
              {isChinese
                ? "从灵感到画面，在一个工作空间完成创作。"
                : "From idea to frame, create in one workspace."}
            </p>
          </div>

          {/* Footer Links */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-[var(--du-text)] mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.title}>
                    <LocaleLink
                      href={link.href}
                      className="text-sm text-[var(--du-text-muted)] hover:text-[var(--du-accent-text)] transition-colors"
                    >
                      {link.title}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col gap-3 border-t border-[var(--du-border)] pt-7 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--du-text-dim)]">
            {t('copyright', { year: currentYear })}
          </p>
          <p className="text-[var(--du-text-muted)]">{isChinese ? "探索灵感，创作属于你的作品。" : "Explore ideas and make them yours."}</p>
        </div>
      </div>
    </footer>
  );
}
