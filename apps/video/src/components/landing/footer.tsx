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
        { title: isChinese ? "图片生成视频" : "Image to Video", href: "/image-to-video" },
        { title: isChinese ? "文字生成视频" : "Text to Video", href: "/text-to-video" },
        { title: isChinese ? "参考图生成视频" : "Reference to Video", href: "/reference-to-video" },
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
      <div className="du-frame py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <LocaleLink
              href="/"
              className="flex items-center gap-2 text-xl font-semibold mb-4 text-[var(--du-text)]"
            >
              <img src="/logo.svg" width={28} height={28} alt="" /> aidv.ai
            </LocaleLink>
            <p className="text-sm text-[var(--du-text-muted)] mb-4">
              {isChinese
                ? "用 AI 将你的创意变成精彩视频。"
                : "Transform your ideas into stunning videos with AI."}
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
          <LocaleLink href="/" locale={isChinese ? "en" : "zh"} hrefLang={isChinese ? "en" : "zh"} className="inline-flex min-h-11 items-center text-sm text-[var(--du-text)] hover:underline">{isChinese ? "English" : "简体中文"}</LocaleLink>
        </div>
      </div>
    </footer>
  );
}
