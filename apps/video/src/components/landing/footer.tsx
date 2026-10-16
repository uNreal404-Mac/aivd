"use client";

import { Heart } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

import { cn } from "@/components/ui";
import { LocaleLink } from "@/i18n/navigation";

export function LandingFooter() {
  const t = useTranslations('Footer');
  const locale = useLocale();
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: t('product'),
      links: [
        { title: t('imageToVideo'), href: "/image-to-video" },
        { title: t('textToVideo'), href: "/text-to-video" },
        { title: t('referenceToVideo'), href: "/reference-to-video" },
        { title: t('pricing'), href: "/pricing" },
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
        { title: t('refund'), href: "/refund-policy" },
        { title: t('contact'), href: "/contact" },
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
              🎬 DreamUtopia
            </LocaleLink>
            <p className="text-sm text-[var(--du-text-muted)] mb-4">
              {t('tagline')}
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
            {t('madeWith')}
            <Heart className="h-4 w-4 fill-[var(--du-accent-2)] text-[var(--du-accent-2)]" />
            {t('byTeam')}
          </p>
        </div>
      </div>
    </footer>
  );
}
