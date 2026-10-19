import type { CSSProperties } from "react";

import { LocaleLink } from "@/i18n/navigation";

const LINKS = [
  { href: "/terms", en: "Terms of Service", zh: "服务条款" },
  { href: "/privacy", en: "Privacy Policy", zh: "隐私政策" },
  { href: "/refund-policy", en: "Refund Policy", zh: "退款政策" },
] as const;

/**
 * Public links to the terms, privacy, and refund pages.
 * Locale prefixing is handled by next-intl.
 */
export function LegalLinks({
  locale,
  className,
  style,
}: {
  locale: string;
  className?: string;
  style?: CSSProperties;
}) {
  const zh = locale === "zh";

  return (
    <nav
      className={className}
      style={style}
      aria-label={zh ? "法律信息" : "Legal"}
    >
      {LINKS.map((link) => (
        <LocaleLink key={link.href} href={link.href}>
          {zh ? link.zh : link.en}
        </LocaleLink>
      ))}
    </nav>
  );
}
