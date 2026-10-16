"use client";

import { useState } from "react";
import Link from "next/link";
import { Gem, Menu, X } from "lucide-react";

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
  label: string;
  href: string;
  badge?: { label: string; tone: "lime" | "muted" };
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Explore", href: "/explore" },
  { label: "Video", href: "/text-to-video", badge: { label: "Top", tone: "lime" } },
  { label: "Image to Video", href: "/image-to-video" },
  { label: "Reference", href: "/reference-to-video", badge: { label: "New", tone: "lime" } },
  { label: "My creations", href: "/my-creations" },
  { label: "Image", href: "", badge: { label: "Soon", tone: "muted" }, disabled: true },
  { label: "Audio", href: "", badge: { label: "Soon", tone: "muted" }, disabled: true },
  { label: "Effects", href: "", badge: { label: "Soon", tone: "muted" }, disabled: true },
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
            mobile ? "px-3 py-2" : "hidden px-2 text-[14px] 2xl:flex"
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
            aria-label="Pricing"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--du-glass-bg)] text-[var(--du-text)] hover:bg-[var(--du-glass-bg-strong)] lg:hidden"
          >
            <Gem className="h-4 w-4" />
          </Link>
          <Link
            href={`/${lang}/pricing`}
            className="hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[var(--du-glass-bg)] px-3 text-sm font-medium text-[var(--du-text)] hover:bg-[var(--du-glass-bg-strong)] lg:flex"
          >
            <Gem className="h-4 w-4" />
            Pricing
          </Link>

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
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] border border-transparent bg-[var(--du-accent-soft)] px-3 text-sm font-medium text-[var(--du-accent-text)] hover:border-[var(--du-border-strong)] lg:flex"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-[var(--du-accent)] px-3 text-sm font-medium text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)] lg:flex"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => signInModal.onOpen()}
                className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-[10px] bg-[var(--du-accent)] px-3 text-sm font-medium text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)] lg:hidden"
              >
                Sign up
              </button>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--du-glass-bg)] text-[var(--du-text)] lg:hidden"
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
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--du-text)] hover:text-[var(--du-accent-text)]"
            >
              <Gem className="h-4 w-4" />
              Pricing
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
                Sign up
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
