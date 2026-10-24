"use client";

import { useState } from "react";
import Link from "next/link";
import { Gem, Menu, X } from "lucide-react";

import { cn } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocalePathname } from "@/i18n/navigation";
import { PreviewBadge } from "@/components/layout/preview-badge";
import { LocaleChange } from "@/components/locale-change";

interface HfTopNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  lang: string;
}

interface NavItem {
  label: string;
  href: string;
  badge?: { label: string; tone: "lime" | "muted" };
  disabled?: boolean;
}

function Badge({ label, tone }: { label: string; tone: "lime" | "muted" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 text-[10px] font-semibold",
        tone === "lime"
          ? "bg-[var(--du-accent)] text-[var(--du-on-accent)]"
          : "bg-[var(--du-surface-2)] text-[var(--du-text-muted)]"
      )}
    >
      {label}
    </span>
  );
}

export function HfTopNav({ user, lang }: HfTopNavProps) {
  const pathname = useLocalePathname();
  const signInModal = useSigninModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const isChinese = lang.toLowerCase().startsWith("zh");
  const copy = isChinese
    ? {
        reference: "参考",
        create: "创作",
        video: "视频",
        image: "图片",
        music: "音乐",
        effects: "特效",
        modeling: "3D 建模",
        creations: "我的作品",
        soon: "即将开放",
        pricing: "定价",
        login: "登录",
        signup: "注册",
      }
    : {
        reference: "Reference",
        create: "Create",
        video: "Video",
        image: "Image",
        music: "Music",
        effects: "Effects",
        modeling: "3D Modeling",
        creations: "My creations",
        soon: "Soon",
        pricing: "Pricing",
        login: "Login",
        signup: "Sign up",
      };
  const navItems: NavItem[] = [
    { label: copy.reference, href: "/explore" },
    { label: copy.create, href: "/text-to-video" },
    { label: copy.video, href: "/gallery", badge: { label: "Top", tone: "lime" } },
    { label: copy.image, href: "/image-to-video" },
    { label: copy.music, href: "", badge: { label: copy.soon, tone: "muted" }, disabled: true },
    { label: copy.effects, href: "", badge: { label: copy.soon, tone: "muted" }, disabled: true },
    { label: copy.modeling, href: "", badge: { label: copy.soon, tone: "muted" }, disabled: true },
    { label: copy.creations, href: "/my-creations" },
  ];

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
        <span className="whitespace-nowrap">{item.label}</span>
        {item.badge && <Badge label={item.badge.label} tone={item.badge.tone} />}
      </>
    );

    if (item.disabled) {
      return (
        <span
          key={item.label}
          aria-disabled="true"
          className={cn(
            "flex shrink-0 cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--du-text-dim)] opacity-60",
            mobile ? "px-3 py-2" : "px-2 text-[14px]"
          )}
        >
          {content}
        </span>
      );
    }

    return (
      <Link
        key={item.label}
        href={`/${lang}${item.href}`}
        onClick={mobile ? () => setMenuOpen(false) : undefined}
        className={cn(
          "flex shrink-0 items-center gap-1.5 font-medium transition-colors",
          active
            ? "text-[var(--du-accent-text)]"
            : "text-[var(--du-text)] hover:text-[var(--du-accent-text)]",
          mobile ? "px-3 py-2 text-sm" : "px-2 text-[14px]"
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
          <Link href={`/${lang}`} className="flex shrink-0 items-center gap-2">
            <img src="/logo.svg" alt="" width={28} height={28} className="rounded-md" />
            <span className="whitespace-nowrap text-base font-semibold text-[var(--du-text)]">
              aidv.ai
            </span>
            <PreviewBadge />
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 overflow-hidden xl:flex">
            {navItems.map((item) => renderItem(item))}
          </nav>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/${lang}/pricing`}
            aria-label={copy.pricing}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--du-surface)] text-[var(--du-text)] hover:bg-[var(--du-surface-2)] xl:hidden"
          >
            <Gem className="h-4 w-4" />
          </Link>
          <Link
            href={`/${lang}/pricing`}
            className="hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--du-surface)] px-3 text-sm font-medium text-[var(--du-text)] hover:bg-[var(--du-surface-2)] xl:flex"
          >
            <Gem className="h-4 w-4" />
            {copy.pricing}
          </Link>

          <LocaleChange />

          {user ? (
            <Link
              href={`/${lang}/my-creations`}
              className="flex h-9 shrink-0 items-center rounded-[10px] px-1"
              aria-label="My creations"
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
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-transparent bg-[var(--du-accent-soft)] px-3 text-sm font-medium text-[var(--du-accent-text)] hover:border-[var(--du-border-strong)] xl:flex"
              >
                {copy.login}
              </button>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-[var(--du-accent)] px-3 text-sm font-medium text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)] xl:flex"
              >
                {copy.signup}
              </button>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-[var(--du-accent)] px-3 text-sm font-medium text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)] xl:hidden"
              >
                {copy.signup}
              </button>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--du-surface)] text-[var(--du-text)] hover:bg-[var(--du-surface-2)] xl:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-[52px] border-b border-[var(--du-border)] bg-[var(--du-bg-elev)] py-2 xl:hidden">
          <nav className="flex flex-col">
            {navItems.map((item) => renderItem(item, true))}
            <Link
              href={`/${lang}/pricing`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--du-text)] hover:text-[var(--du-accent-text)]"
            >
              <Gem className="h-4 w-4" />
              {copy.pricing}
            </Link>
            {!user && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signInModal.onOpen();
                }}
                className="mt-1 mx-3 flex h-9 items-center justify-center rounded-[10px] bg-[var(--du-accent)] px-3 text-sm font-medium text-[var(--du-on-accent)]"
              >
                {copy.signup}
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
