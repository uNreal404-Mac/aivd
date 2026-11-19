"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Code2,
  CreditCard,
  Crown,
  Folder,
  Languages,
  LogOut,
  Megaphone,
  Menu,
  Plug,
  Search,
  Settings,
  Tag,
  Tv,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocalePathname } from "@/i18n/navigation";
import { PreviewBadge } from "@/components/layout/preview-badge";
import { LocaleChange } from "@/components/locale-change";
import { authClient } from "@/lib/auth/client";
import { buildDropdowns, type DropItem } from "@/components/hf/nav-menus";
import { NavSearch } from "@/components/hf/nav-search";
import { useCreditsStore } from "@/stores/credits-store";
import "./top-nav.css";

interface HfTopNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  lang: string;
}

export function HfTopNav({ user, lang }: HfTopNavProps) {
  const pathname = useLocalePathname();
  const router = useRouter();
  const signInModal = useSigninModal();
  const zh = lang.toLowerCase().startsWith("zh");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Left edge of the open dropdown, taken from the trigger that opened it.
  const [panelLeft, setPanelLeft] = useState(16);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ start: false, end: false });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balance = useCreditsStore((state) => state.balance);
  const fetchBalance = useCreditsStore((state) => state.fetchBalance);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".hf-nav")) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Close menus when the route changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on route change only
  useEffect(() => {
    setOpen(null);
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // ⌘K / Ctrl+K anywhere, or "/" when not typing, opens site search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(null);
        setSearchOpen((value) => !value);
      } else if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(null);
        setSearchOpen(true);
      }
    };
    // Other parts of the page (e.g. the 404 page) can ask for search too.
    const onRequest = () => {
      setOpen(null);
      setSearchOpen(true);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("aivd:open-search", onRequest);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("aivd:open-search", onRequest);
    };
  }, []);

  // The account menu shows the credit balance; load it when the menu opens.
  useEffect(() => {
    if (open === "account" && user) void fetchBalance();
  }, [open, user, fetchBalance]);

  const soonLabel = zh ? "即将上线" : "Soon";
  const t = zh
    ? {
        explore: "探索",
        community: "社区",
        pricing: "定价",
        offer: "特别优惠",
        offerTitle: `注册即送 ${NEW_USER_GIFT.credits} 积分，可免费生成第一条视频`,
        login: "登录",
        signup: "免费开始",
        openMenu: "打开菜单",
        closeMenu: "关闭菜单",
        search: "搜索（⌘K）",
        creations: "我的作品",
        credits: "可用积分",
        buyCredits: "购买积分",
        billing: "积分与账单",
        account: "账户",
        settings: "设置",
        signOut: "退出登录",
        hot: "热门",
        fresh: "新",
        soonShort: "即将推出",
        offerTag: `送${NEW_USER_GIFT.credits}积分`,
        creditsLabel: "积分",
        remaining: "剩余",
        upgradePlan: "开通高级版",
        upgrade: "升级",
        language: "语言",
        languageName: "简体中文",
        plans: { FREE: "免费套餐", PRO: "专业版", BUSINESS: "商业版" },
      }
    : {
        explore: "Explore",
        community: "Community",
        pricing: "Pricing",
        offer: "Special offer",
        offerTitle: `Sign up and get ${NEW_USER_GIFT.credits} credits for your first video`,
        login: "Log in",
        signup: "Start free",
        openMenu: "Open menu",
        closeMenu: "Close menu",
        search: "Search (⌘K)",
        creations: "My creations",
        credits: "Credits",
        buyCredits: "Buy credits",
        billing: "Credits & billing",
        account: "Account",
        settings: "Settings",
        signOut: "Sign out",
        hot: "Hot",
        fresh: "New",
        soonShort: "Coming soon",
        offerTag: `+${NEW_USER_GIFT.credits} credits`,
        creditsLabel: "Credits",
        remaining: "left",
        upgradePlan: "Go premium",
        upgrade: "Upgrade",
        language: "Language",
        languageName: "English",
        plans: { FREE: "Free plan", PRO: "Pro plan", BUSINESS: "Business plan" },
      };

  const dropdowns = buildDropdowns(zh);

  // Top-level products that are not built yet, shown the way the reference
  // site shows its upcoming products: in the bar, with a small badge.
  // Products that are not built yet sit under "More", as the reference keeps
  // its secondary items, instead of crowding the bar.
  const moreMenu = {
    id: "more",
    label: zh ? "更多" : "More",
    path: "",
    routes: [] as string[],
    columns: [
      {
        title: zh ? "即将推出" : "Coming soon",
        items: [
          { title: zh ? "AI 短剧" : "AI short drama", desc: zh ? "按集生成连续剧情" : "Generate a series episode by episode", icon: Tv },
          { title: zh ? "广告工作室" : "Ads Studio", desc: zh ? "批量生成广告视频素材" : "Ad creative in batches", icon: Megaphone },
          { title: "API", desc: zh ? "在你的产品里调用生成能力" : "Generate from your own product", icon: Code2 },
          { title: "MCP", desc: zh ? "在 AI 助手里直接生成视频和图片" : "Generate from inside AI assistants", icon: Plug },
        ] as DropItem[],
      },
    ],
  };

  const href = (path: string) => (path.startsWith("/#") ? `/${lang}${path.slice(1)}` : `/${lang}${path === "/" ? "" : path}`);
  const inRoutes = (routes: string[]) => routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const activeSection = dropdowns.find((menu) => inRoutes(menu.routes));
  const headerRef = useRef<HTMLElement>(null);
  // Tool layouts size their workspace to the space under the header.
  useEffect(() => {
    const height = headerRef.current?.offsetHeight ?? 52;
    document.documentElement.style.setProperty("--hf-header-h", `${height}px`);
  }, []);

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));
  const openNow = (id: string, trigger?: HTMLElement | null) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (trigger) setPanelLeft(trigger.getBoundingClientRect().left - 4);
    setOpen(id);
  };
  // Only close the menu that was left; moving straight onto another menu
  // must not be undone by the previous menu's timer.
  const closeSoon = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen((current) => (current === id ? null : current)), 140);
  };
  const hover = (id: string) => ({
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => openNow(id, event.currentTarget),
    onMouseLeave: () => closeSoon(id),
  });
  const keepOpen = (id: string) => ({ onMouseEnter: () => openNow(id), onMouseLeave: () => closeSoon(id) });

  const badge = (kind: DropItem["badge"]) =>
    kind ? <span className={cn("hf-dd-badge", kind === "hot" ? "hf-dd-badge-hot" : "hf-dd-badge-new")}>{kind === "hot" ? t.hot : t.fresh}</span> : null;

  const row = (item: DropItem, index: number) => {
    const Icon = item.icon;
    const inner = (
      <>
        <span className={cn("hf-dd-tile", item.badge && "hf-dd-tile-flag")}>
          <Icon aria-hidden="true" />
          {badge(item.badge)}
        </span>
        <span className="hf-dd-text">
          <span className="hf-dd-title">
            {item.title}
            {item.tag ? <span className="hf-dd-4k">{item.tag}</span> : null}
            {!item.href || item.soon ? <span className="hf-tag">{soonLabel}</span> : null}
          </span>
          <span className="hf-dd-desc">{item.desc}</span>
        </span>
      </>
    );
    return item.href ? (
      <Link key={item.title} href={href(item.href)} className="hf-dd-row" style={{ ["--i" as string]: index }}>
        {inner}
      </Link>
    ) : (
      <span key={item.title} className="hf-dd-row hf-dd-row-off" aria-disabled="true" style={{ ["--i" as string]: index }}>
        {inner}
      </span>
    );
  };

  // Keep the dropdown inside the window when its trigger sits near the right.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const maxLeft = window.innerWidth - panel.offsetWidth - 16;
    if (panelLeft > maxLeft) setPanelLeft(Math.max(16, maxLeft));
  }, [open, panelLeft]);

  // Fade the ends of the link row when it scrolls sideways, like the reference.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () =>
      setFade({ start: list.scrollLeft > 2, end: list.scrollLeft + list.clientWidth < list.scrollWidth - 2 });
    update();
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      list.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const signOut = async () => {
    await authClient.signOut();
    router.push(`/${lang}`);
    router.refresh();
  };

  const otherLang = zh ? "en" : "zh";
  const accountLinks: { label: string; href: string; icon: LucideIcon }[] = [
    { label: t.creations, href: "/my-creations", icon: Folder },
    { label: t.billing, href: "/credits", icon: CreditCard },
    { label: t.account, href: "/account", icon: UserRound },
  ];
  const openMenu = open === "more" ? moreMenu : dropdowns.find((menu) => menu.id === open);
  const dots = 30;
  const filledDots =
    balance && balance.totalCredits > 0 ? Math.round((Math.max(0, balance.availableCredits) / balance.totalCredits) * dots) : 0;

  return (
    <header ref={headerRef} className={cn("hf-nav", scrolled && "hf-nav-scrolled")}>
      <div className="hf-nav-inner">
        <Link href={href("/")} className="hf-brand">
          <img src="/logo.svg" alt="" width={28} height={28} className="hf-brand-logo" />
          <span className="hf-brand-word">aivd.ai</span>
          <PreviewBadge lang={lang} />
        </Link>

        <div ref={listRef} className="hf-nav-scroll" data-fade-start={fade.start || undefined} data-fade-end={fade.end || undefined}>
          <nav className="hf-nav-links" aria-label={zh ? "主导航" : "Main"}>
            <Link href={href("/")} className="hf-item" data-active={pathname === "/" || undefined}>
              {t.explore}
            </Link>
            {dropdowns.map((menu) => (
              <Link
                key={menu.id}
                href={href(menu.path)}
                aria-expanded={open === menu.id}
                aria-haspopup="true"
                onFocus={(event) => openNow(menu.id, event.currentTarget)}
                className="hf-item"
                data-open={open === menu.id || undefined}
                data-active={activeSection?.id === menu.id || undefined}
                {...hover(menu.id)}
              >
                {menu.label}
              </Link>
            ))}
            <Link href={href("/gallery")} className="hf-item" data-active={isActive("/gallery") || undefined}>
              {t.community}
            </Link>
            <button
              type="button"
              className="hf-item"
              aria-expanded={open === "more"}
              aria-haspopup="true"
              data-open={open === "more" || undefined}
              onFocus={(event) => openNow("more", event.currentTarget)}
              onClick={(event) => (open === "more" ? setOpen(null) : openNow("more", event.currentTarget))}
              {...hover("more")}
            >
              {moreMenu.label}
              <ChevronDown className="hf-item-caret" aria-hidden="true" />
            </button>
          </nav>
        </div>

        <div className="hf-actions">
          <button
            type="button"
            aria-label={t.search}
            title={t.search}
            aria-expanded={searchOpen}
            className="hf-act hf-act-icon"
            data-open={searchOpen || undefined}
            onClick={() => {
              setOpen(null);
              setSearchOpen((value) => !value);
            }}
          >
            <Search aria-hidden="true" />
          </button>
          {user ? (
            <Link href={href("/my-creations")} aria-label={t.creations} title={t.creations} className="hf-act hf-act-icon">
              <Folder aria-hidden="true" />
            </Link>
          ) : null}
          <Link href={href("/pricing")} title={t.offerTitle} className="hf-act hf-act-accent">
            <Tag aria-hidden="true" />
            {t.offer}
            <span className="hf-act-dot" aria-hidden="true" />
          </Link>
          <Link href={href("/pricing")} className="hf-act hf-act-pricing">
            <Crown aria-hidden="true" />
            {t.pricing}
            <span className="hf-act-discount">{t.offerTag}</span>
          </Link>
          <span className="hf-lang">
            <LocaleChange />
          </span>
          {user ? (
            <div className="relative" {...hover("account")}>
              <button
                type="button"
                aria-label={t.account}
                aria-expanded={open === "account"}
                aria-haspopup="true"
                onClick={() => setOpen((current) => (current === "account" ? null : "account"))}
                className="hf-avatar"
              >
                <UserAvatar user={{ name: user.name ?? null, image: user.image ?? null }} className="h-7 w-7" />
              </button>
              {open === "account" ? (
                <div className="hf-acct">
                  <Link href={href("/account")} className="hf-acct-profile">
                    <UserAvatar user={{ name: user.name ?? null, image: user.image ?? null }} className="h-[30px] w-[30px]" />
                    <span className="min-w-0 flex-1">
                      <span className="hf-acct-name">{user.name || user.email}</span>
                      <span className="hf-acct-sub">{balance?.plan ? t.plans[balance.plan] : t.plans.FREE}</span>
                    </span>
                  </Link>

                  <div className="hf-acct-card">
                    <Link href={href("/credits")} className="hf-acct-credits">
                      <span className="hf-acct-credits-row">
                        <span className="hf-acct-label">{t.creditsLabel}</span>
                        <span className="hf-acct-left">
                          {zh
                            ? `${t.remaining} ${balance ? balance.availableCredits.toLocaleString() : "—"}`
                            : `${balance ? balance.availableCredits.toLocaleString() : "—"} ${t.remaining}`}
                          <ChevronRight aria-hidden="true" />
                        </span>
                      </span>
                      <span className="hf-acct-dots" aria-hidden="true">
                        {Array.from({ length: dots }, (_, index) => (
                          <span key={index} data-on={index < filledDots || undefined} />
                        ))}
                      </span>
                    </Link>
                    <span className="hf-acct-divider" />
                    <Link href={href("/pricing")} className="hf-acct-upgrade">
                      <span className="flex items-center gap-1.5">
                        <span className="hf-acct-ico">
                          <Crown aria-hidden="true" />
                        </span>
                        {t.upgradePlan}
                      </span>
                      <span className="hf-acct-pill">{t.upgrade}</span>
                    </Link>
                  </div>

                  <div className="hf-acct-list">
                    {accountLinks.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.href} href={href(item.href)} className="hf-acct-row">
                          <span className="hf-acct-ico">
                            <Icon aria-hidden="true" />
                          </span>
                          {item.label}
                        </Link>
                      );
                    })}
                    <Link href={`/${otherLang}${pathname === "/" ? "" : pathname}`} className="hf-acct-row hf-acct-row-split">
                      <span className="flex items-center gap-1.5">
                        <span className="hf-acct-ico">
                          <Languages aria-hidden="true" />
                        </span>
                        {t.language}
                      </span>
                      <span className="hf-acct-muted">{t.languageName}</span>
                    </Link>
                    <button type="button" onClick={signOut} className="hf-acct-row">
                      <span className="hf-acct-ico">
                        <LogOut aria-hidden="true" />
                      </span>
                      {t.signOut}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <button type="button" onClick={() => signInModal.onOpen()} className="hf-auth hf-auth-login">
                {t.login}
              </button>
              <button type="button" onClick={() => signInModal.onOpen()} className="hf-auth hf-auth-signup">
                {t.signup}
              </button>
            </>
          )}
          <button
            type="button"
            aria-label={menuOpen ? t.closeMenu : t.openMenu}
            onClick={() => setMenuOpen((value) => !value)}
            className="hf-act hf-act-icon hf-burger"
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {openMenu ? (
        <div ref={panelRef} className="hf-dd" style={{ left: panelLeft }} {...keepOpen(openMenu.id)}>
          {openMenu.columns.map((column) => (
            <div key={column.title} className="hf-dd-col">
              <p className="hf-dd-col-title">{column.title}</p>
              {column.items.map(row)}
            </div>
          ))}
        </div>
      ) : null}

      {searchOpen ? <NavSearch lang={lang} localize={href} onClose={() => setSearchOpen(false)} /> : null}

      {menuOpen ? (
        <div className="hf-nav-mobile">
          <Link href={href("/")} className="hf-item">
            {t.explore}
          </Link>
          {dropdowns.map((menu) => (
            <Link key={menu.id} href={href(menu.path)} className="hf-item">
              {menu.label}
            </Link>
          ))}
          <Link href={href("/gallery")} className="hf-item">
            {t.community}
          </Link>
          <Link href={href("/pricing")} className="hf-item">
            {t.pricing}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
