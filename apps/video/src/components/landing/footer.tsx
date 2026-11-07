"use client";

import { useTranslations, useLocale } from "next-intl";

import { LocaleLink } from "@/i18n/navigation";

export function LandingFooter() {
  const t = useTranslations('Footer');
  const locale = useLocale();
  const isChinese = locale === "zh";
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: t('product'),
      links: [
        { title: isChinese ? "视频生成" : "Video generation", href: "/ai/video" },
        { title: isChinese ? "图片生成" : "Image generation", href: "/ai/image" },
        { title: isChinese ? "图片生成视频" : "Image to Video", href: "/image-to-video" },
        { title: isChinese ? "一键模版" : "One-click Templates", href: "/gallery" },
        { title: isChinese ? "创作空间" : "Creative Space", href: "/creative-space" },
        { title: isChinese ? "定价" : "Pricing", href: "/pricing" },
      ],
    },
    // {
    //   title: t('company'),
    //   links: [
    //     { title: "About", href: "/about" },
    //     { title: "Blog", href: "/blog" },
    //     { title: "Careers", href: "/careers" },
    //     { title: "Contact", href: "/contact" },
    //   ],
    // },
    {
      title: t('legal'),
      links: [
        { title: t('privacy'), href: "/privacy" },
        { title: t('terms'), href: "/terms" },
        { title: locale === "zh" ? "退款政策" : "Refund Policy", href: "/refund-policy" },
        { title: locale === "zh" ? "联系我们" : "Contact", href: "/contact" },
        // { title: t('cookie'), href: "/cookies" },
      ],
    },
  ];


  return (
    <footer className="border-t border-[var(--du-border)] bg-[var(--du-bg-elev)]">
      <div className="mx-auto max-w-[1680px] px-6 py-16">
        {/* Main Footer Content */}
        <div className="mb-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-20">
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
