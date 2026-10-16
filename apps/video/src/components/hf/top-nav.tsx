"use client";

import { useState } from "react";
import Link from "next/link";
import { Gem, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocalePathname } from "@/i18n/navigation";

interface HfTopNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  lang: string;
}

interface NavItem {
  key: string;
  href: string;
  badge?: { badgeKey: "top" | "new" | "soon"; tone: "lime" | "muted" };
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "explore", href: "/explore" },
  { key: "video", href: "/text-to-video", badge: { badgeKey: "top", tone: "lime" } },
  { key: "imageToVideo", href: "/image-to-video" },
  { key: "reference", href: "/reference-to-video", badge: { badgeKey: "new", tone: "lime" } },
  { key: "myCreations", href: "/my-creations" },
  { key: "image", href: "", badge: { badgeKey: "soon", tone: "muted" }, disabled: true },
  { key: "audio", href: "", badge: { badgeKey: "soon", tone: "muted" }, disabled: true },
  { key: "effects", href: "", badge: { badgeKey: "soon", tone: "muted" }, disabled: true },
];

function Badge({ label, tone }: { label: string; tone: "lime" | "muted" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 text-[10px] font-semibold",
        tone === "lime"
          ? "bg-[var(--du-accent)] text-[var(--du-on-accent)]"
          : "bg-[var(--du-glass-bg-strong)] text-[var(--du-text-dim)]"
      )}
    >
      {label}
    </span>
  );
}

export function HfTopNav({ user, lang }: HfTopNavProps) {
  const pathname = useLocalePathname();
  const signInModal = useSigninModal();
  const t = useTranslations("HfNav");
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderItem = (item: NavItem, mobile = false) => {
    const active = !item.disabled && isActive(item.href);
    const content = (
      <>
        <span className="whitespace-nowrap">{t(`items.${item.key}`)}</span>
        {item.badge && (
          <Badge label={t(`badges.${item.badge.badgeKey}`)} tone={item.badge.tone} />
        )}
      </>
    );

    if (item.disabled) {
      return (
        <span
          key={item.key}
          aria-disabled="true"
          className={cn(
            "flex shrink-0 cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--du-text-dim)] opacity-60",
            mobile ? "min-h-11 px-3 py-2" : "hidden px-2 text-[14px] xl:flex"
          )}
        >
          {content}
        </span>
      );
    }

    return (
      <Link
        key={item.key}
        href={`/${lang}${item.href}`}
        onClick={mobile ? () => setMenuOpen(false) : undefined}
        className={cn(
          "flex shrink-0 items-center gap-1.5 font-medium transition-colors",
          active
            ? "text-[var(--du-accent-text)]"
            : "text-[var(--du-text)] hover:text-[var(--du-accent-text)]",
          mobile ? "min-h-11 px-3 py-2 text-sm" : "px-2 text-[14px]"
        )}
      >
        {content}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 h-[52px] border-b border-[var(--du-border)] bg-[var(--du-bg)]">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: logo + desktop nav */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            href={`/${lang}`}
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 lg:min-h-0 lg:min-w-0"
          >
            {/* biome-ignore lint/nursery/noImgElement: small static svg */}
            <img src="/logo.svg" alt="" width={28} height={28} className="rounded-md" />
            <span className="whitespace-nowrap text-base font-semibold text-[var(--du-text)]">
              DreamUtopia
            </span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 overflow-hidden lg:flex">
            {NAV_ITEMS.map((item) => renderItem(item))}
          </nav>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/${lang}/pricing`}
            aria-label={t("pricing")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--du-glass-bg)] text-[var(--du-text)] hover:bg-[var(--du-glass-bg-strong)] lg:hidden"
          >
            <Gem className="h-4 w-4" />
          </Link>
          <Link
            href={`/${lang}/pricing`}
            className="hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--du-glass-bg)] px-3 text-sm font-medium text-[var(--du-text)] hover:bg-[var(--du-glass-bg-strong)] lg:flex"
          >
            <Gem className="h-4 w-4" />
            {t("pricing")}
          </Link>

          {user ? (
            <Link
              href={`/${lang}/my-creations`}
              className="flex h-11 min-w-11 shrink-0 items-center rounded-[10px] px-1 lg:h-9 lg:min-w-0"
              aria-label={t("myCreations")}
            >
              <UserAvatar
                user={{ name: user.name ?? null, image: user.image ?? null }}
                className="h-8 w-8"
              />
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-transparent bg-[var(--du-accent-soft)] px-3 text-sm font-medium text-[var(--du-accent-text)] hover:border-[var(--du-border-strong)] lg:flex"
              >
                {t("login")}
              </button>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-[var(--du-signup)] px-3 text-sm font-medium text-[var(--du-signup-text)] shadow-[var(--du-glow)] hover:bg-[var(--du-signup-hover)] lg:flex"
              >
                {t("signUp")}
              </button>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="flex h-11 min-w-11 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-[var(--du-signup)] px-3 text-sm font-medium text-[var(--du-signup-text)] shadow-[var(--du-glow)] hover:bg-[var(--du-signup-hover)] lg:hidden"
              >
                {t("signUp")}
              </button>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[var(--du-glass-bg)] text-[var(--du-text)] lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-[52px] border-b border-[var(--du-border)] bg-[var(--du-bg-elev)] py-2 lg:hidden">
          <nav className="flex flex-col">
            {NAV_ITEMS.map((item) => renderItem(item, true))}
            <Link
              href={`/${lang}/pricing`}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--du-text)] hover:text-[var(--du-accent-text)]"
            >
              <Gem className="h-4 w-4" />
              {t("pricing")}
            </Link>
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signInModal.onOpen();
                }}
                className="mt-1 mx-3 flex h-11 items-center justify-center rounded-[10px] bg-[var(--du-signup)] px-3 text-sm font-medium text-[var(--du-signup-text)]"
              >
                {t("signUp")}
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
