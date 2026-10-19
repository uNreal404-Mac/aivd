"use client";

import { Heart } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

import { cn } from "@/components/ui";
import { LocaleLink } from "@/i18n/navigation";

export function LandingFooter() {
  const t = useTranslations('Footer');
  const locale = useLocale();
  const isZh = locale === "zh";
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: t('product'),
      links: [
        { title: isZh ? "图生视频" : "Image to Video", href: "/image-to-video" },
        { title: isZh ? "文生视频" : "Text to Video", href: "/text-to-video" },
        { title: isZh ? "参考图生视频" : "Reference to Video", href: "/reference-to-video" },
        { title: isZh ? "价格" : "Pricing", href: "/pricing" },
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
        { title: isZh ? "退款政策" : "Refund Policy", href: "/refund-policy" },
        { title: isZh ? "联系我们" : "Contact", href: "/contact" },
        // { title: t('cookie'), href: "/cookies" },
      ],
    },
  ];


  return (
    <footer className="border-t border-[var(--du-border)] bg-[var(--du-bg-elev)]">
      <div className="container mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <LocaleLink
              href="/"
              className="flex items-center gap-2 text-xl font-semibold mb-4 text-[var(--du-text)]"
            >
              🎬 aivd.ai
            </LocaleLink>
            <p className="text-sm text-[var(--du-text-muted)] mb-4">
              {isZh
                ? "用 AI 把文字和图片变成短视频。"
                : "Turn text and images into short AI videos."}
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
        <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-[var(--du-border)]">
          <p className="text-sm text-[var(--du-text-dim)]">
            {t('copyright', { year: currentYear })}
          </p>
          <p className="text-sm text-[var(--du-text-muted)] flex items-center gap-1">
            {isZh ? "由 aivd.ai 团队" : "Made with"}
            <Heart className="h-4 w-4 fill-[var(--du-accent-2)] text-[var(--du-accent-2)]" />
            {isZh ? "用心打造" : "by the aivd.ai team"}
          </p>
        </div>
      </div>
    </footer>
  );
}
