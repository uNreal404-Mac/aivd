"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  BookOpen,
  Brush,
  ChevronRight,
  Clapperboard,
  Code2,
  Coins,
  Compass,
  CreditCard,
  Crown,
  Eraser,
  Expand,
  FastForward,
  Film,
  Folder,
  Image as ImageIcon,
  Languages,
  ImagePlus,
  Layers,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Mic,
  Music,
  Orbit,
  Plug,
  ScanFace,
  Search,
  Settings,
  Sparkles,
  SunMedium,
  Tag,
  Tv,
  UserRound,
  Users,
  Volume2,
  Wand2,
  X,
  ZoomIn,
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

/** One row in a dropdown: icon tile, title and a one-line description. */
type DropItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
  /** Omitted for features that are not live yet; those render greyed out. */
  href?: string;
  badge?: "hot" | "new";
};
type DropColumn = { title: string; items: DropItem[] };
type Dropdown = {
  id: string;
  label: string;
  /** Landing page of the section; the top-level item links here. */
  path: string;
  /** Routes that belong to the section, for the active state and the tab strip. */
  routes: string[];
  columns: DropColumn[];
};

export function HfTopNav({ user, lang }: HfTopNavProps) {
  const pathname = useLocalePathname();
  const router = useRouter();
  const signInModal = useSigninModal();
  const zh = lang.toLowerCase().startsWith("zh");
  const [menuOpen, setMenuOpen] = useState(false);
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
  }, [pathname]);

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
        search: "搜索模板",
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
        search: "Search templates",
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

  // Only pages that exist get a link. Everything else is listed so visitors
  // can see what is coming, but it is greyed out and not clickable.
  const dropdowns: Dropdown[] = [
    {
      id: "image",
      label: zh ? "图像" : "Image",
      path: "/ai/image",
      routes: ["/ai/image", "/image"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "创建图像" : "Create image", desc: zh ? "用文字生成 AI 图像" : "Generate AI images from text", icon: ImageIcon, href: "/ai/image" },
            { title: zh ? "图片转视频" : "Image to video", desc: zh ? "让一张静态图片动起来" : "Bring a still image to life", icon: ImagePlus, href: "/image-to-video", badge: "hot" },
            { title: zh ? "编辑图像" : "Edit image", desc: zh ? "用一句话修改图片内容" : "Change an image with one sentence", icon: Layers },
            { title: zh ? "局部重绘" : "Inpaint", desc: zh ? "选中区域，描述修改内容" : "Select an area and describe the change", icon: Brush },
            { title: zh ? "重新打光" : "Relight", desc: zh ? "调整光源位置、颜色和亮度" : "Move the light, change its colour and strength", icon: SunMedium },
            { title: zh ? "背景去除" : "Remove background", desc: zh ? "一键抠出主体" : "Cut out the subject in one click", icon: Eraser },
            { title: zh ? "图像高清放大" : "Upscale image", desc: zh ? "提升图像清晰度" : "Sharpen and enlarge images", icon: ZoomIn },
            { title: zh ? "图片扩展" : "Expand image", desc: zh ? "向画面外延展内容" : "Extend the picture beyond its edges", icon: Expand },
          ],
        },
        {
          title: zh ? "模型" : "Models",
          items: [
            { title: "Seedream 5 Pro", desc: zh ? "细节丰富的高质量图像" : "Detailed, high-quality images", icon: Sparkles, badge: "new" },
            { title: "FLUX.3 Klein", desc: zh ? "Black Forest Labs 新一代模型" : "Black Forest Labs' latest model", icon: Orbit, badge: "new" },
            { title: "Grok Imagine Image 2.0", desc: zh ? "xAI 出品的高分辨率图像生成" : "High-resolution images from xAI", icon: Sparkles },
            { title: "Imagen 4", desc: zh ? "Google 旗舰图像模型" : "Google's flagship image model", icon: ImageIcon },
            { title: "FLUX.2 Pro", desc: zh ? "稳定可靠的写实风格" : "Dependable photoreal output", icon: Orbit },
            { title: "Seedream 5 Flash", desc: zh ? "快速出图，适合批量尝试" : "Fast images for quick iterations", icon: Sparkles },
          ],
        },
      ],
    },
    {
      id: "video",
      label: zh ? "视频" : "Video",
      path: "/ai/video",
      routes: ["/ai/video", "/video", "/text-to-video", "/image-to-video", "/reference-to-video", "/veo-3-1", "/wan-2-6", "/models"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "创建视频" : "Create video", desc: zh ? "在视频工作室里生成和管理视频" : "Generate and manage clips in the studio", icon: Film, href: "/ai/video", badge: "hot" },
            { title: zh ? "文生视频" : "Text to video", desc: zh ? "一句话描述，直接生成视频" : "Describe it and get a video", icon: Clapperboard, href: "/text-to-video" },
            { title: zh ? "图生视频" : "Image to video", desc: zh ? "以图片为起始帧生成视频" : "Use an image as the first frame", icon: ImagePlus, href: "/image-to-video" },
            { title: zh ? "参考生视频" : "Reference to video", desc: zh ? "用多张参考图锁定人物和风格" : "Lock characters and style with references", icon: Layers, href: "/reference-to-video" },
            { title: zh ? "AI 视频特效" : "AI video effects", desc: zh ? "热门特效模板，一键套用" : "Trending effect templates in one click", icon: Wand2, href: "/effects" },
            { title: zh ? "AI 数字人" : "AI avatar", desc: zh ? "让数字人开口说话" : "Make an avatar talk", icon: UserRound },
            { title: zh ? "动作模仿" : "Motion mimic", desc: zh ? "把参考视频的动作迁移到人物上" : "Copy motion from a reference clip", icon: ScanFace },
            { title: zh ? "视频延长" : "Extend video", desc: zh ? "让视频继续往下播" : "Continue a clip past its end", icon: FastForward },
            { title: zh ? "视频画质提升" : "Upscale video", desc: zh ? "提升视频清晰度" : "Sharpen and enlarge video", icon: ZoomIn },
          ],
        },
        {
          title: zh ? "模型" : "Models",
          items: [
            { title: "Veo 3.1", desc: zh ? "Google 出品，带同步声音的电影级短片" : "Google's cinematic clips with synced sound", icon: Sparkles, href: "/veo-3-1", badge: "hot" },
            { title: "Wan 2.6", desc: zh ? "5–15 秒，720p 与 1080p，性价比高" : "5–15s at 720p or 1080p, good value", icon: Orbit, href: "/wan-2-6" },
            { title: "Seedance 2.5", desc: zh ? "字节跳动多模态视频模型" : "ByteDance's multimodal video model", icon: Clapperboard, badge: "new" },
            { title: "Kling 4.0", desc: zh ? "参考图生成，人物一致性强" : "Reference-driven, consistent characters", icon: Film, badge: "new" },
            { title: "Gemini Omni Flash 1.1", desc: zh ? "Google 多模态视频生成" : "Google's multimodal video generation", icon: Sparkles },
            { title: "Wan 3.0", desc: zh ? "通义万相新一代视频模型" : "The next Wan video model", icon: Orbit },
            { title: "MiniMax H3", desc: zh ? "海螺文生视频" : "Hailuo text to video", icon: Film },
          ],
        },
      ],
    },
    {
      id: "audio",
      label: zh ? "音频" : "Audio",
      path: "/audio",
      routes: ["/audio"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "视频原生音效" : "Native video sound", desc: zh ? "Veo 3.1 生成画面时同步生成声音" : "Veo 3.1 renders sound with the picture", icon: Volume2, href: "/veo-3-1", badge: "hot" },
            { title: zh ? "文字转语音" : "Text to speech", desc: zh ? "把文字读成自然的人声" : "Turn text into a natural voice", icon: AudioLines, href: "/audio" },
            { title: zh ? "AI 配音" : "AI voiceover", desc: zh ? "给视频配上旁白" : "Add narration to a video", icon: Mic },
            { title: zh ? "AI 音乐" : "AI music", desc: zh ? "按风格生成背景音乐" : "Generate background music by style", icon: Music },
            { title: zh ? "音效生成" : "Sound effects", desc: zh ? "用文字生成环境声和音效" : "Create ambience and effects from text", icon: Volume2 },
            { title: zh ? "口型同步" : "Lip sync", desc: zh ? "让人物口型对上配音" : "Match mouths to the voiceover", icon: ScanFace },
          ],
        },
        {
          title: zh ? "模型" : "Models",
          items: [
            { title: "Veo 3.1", desc: zh ? "画面和声音一起生成" : "Picture and sound in one pass", icon: Sparkles, href: "/veo-3-1" },
            { title: "ElevenLabs", desc: zh ? "多语言语音合成" : "Multilingual speech synthesis", icon: AudioLines },
            { title: "Suno", desc: zh ? "完整歌曲和配乐生成" : "Full songs and scores", icon: Music },
          ],
        },
      ],
    },
    {
      id: "creative",
      label: zh ? "创作空间" : "Creative Space",
      path: "/creative-space",
      routes: ["/creative-space"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "创作空间" : "Creative Space", desc: zh ? "说出想法，Agent 拆成镜头再生成" : "Say the idea; the agent plans the shots", icon: Sparkles, href: "/creative-space", badge: "new" },
            { title: zh ? "画布" : "Canvas", desc: zh ? "在画布上整理素材，用 @ 交给 Agent" : "Arrange assets and @-mention them to the agent", icon: LayoutGrid, href: "/creative-space/canvas" },
            { title: zh ? "视频工作室" : "Video studio", desc: zh ? "选模型、调参数、批量生成" : "Pick a model, tune settings, generate", icon: Film, href: "/ai/video" },
            { title: zh ? "我的作品" : "My creations", desc: zh ? "查看和下载生成的视频" : "Find and download your videos", icon: Folder, href: "/my-creations" },
          ],
        },
        {
          title: zh ? "即将推出" : "Coming next",
          items: [
            { title: zh ? "AI 故事视频" : "AI story video", desc: zh ? "一段剧本生成多场景故事" : "A script becomes a multi-scene story", icon: BookOpen },
            { title: zh ? "AI 短剧" : "AI short drama", desc: zh ? "按集生成连续剧情" : "Generate a series episode by episode", icon: Tv },
            { title: zh ? "情绪板" : "Moodboard", desc: zh ? "把参考素材整理成统一风格" : "Turn references into one look", icon: Layers },
          ],
        },
      ],
    },
    {
      id: "templates",
      label: zh ? "模板" : "Templates",
      path: "/templates",
      routes: ["/templates", "/effects", "/gallery", "/explore"],
      columns: [
        {
          title: zh ? "模板" : "Templates",
          items: [
            { title: zh ? "全部模板" : "All templates", desc: zh ? "挑一个模板，提示词一键带入" : "Pick one and its prompt loads for you", icon: LayoutGrid, href: "/templates" },
            { title: zh ? "故事视频" : "Story video", desc: zh ? "有情节、有人物的短片" : "Short clips with characters and plot", icon: BookOpen, href: "/templates#tpl-story" },
            { title: zh ? "动态创作" : "Motion", desc: zh ? "自然、粒子和舞蹈的动态画面" : "Nature, particles and dance in motion", icon: Orbit, href: "/templates#tpl-motion" },
            { title: zh ? "创意重构" : "Recast", desc: zh ? "科幻、奇幻和超现实场景" : "Sci-fi, fantasy and surreal scenes", icon: Wand2, href: "/templates#tpl-recast" },
          ],
        },
        {
          title: zh ? "灵感" : "Inspiration",
          items: [
            { title: zh ? "特效模板" : "Effect templates", desc: zh ? "热门视频特效" : "Trending video effects", icon: Sparkles, href: "/effects", badge: "hot" },
            { title: zh ? "社区画廊" : "Community gallery", desc: zh ? "看看大家都在做什么" : "See what others are making", icon: Users, href: "/gallery" },
            { title: zh ? "灵感探索" : "Explore", desc: zh ? "按主题浏览创意" : "Browse ideas by theme", icon: Compass, href: "/explore" },
          ],
        },
      ],
    },
  ];

  // Top-level products that are not built yet, shown the way the reference
  // site shows its upcoming products: in the bar, with a small badge.
  const upcoming: { label: string; icon: LucideIcon }[] = [
    { label: zh ? "短剧" : "Short drama", icon: Tv },
    { label: zh ? "广告工作室" : "Ads Studio", icon: Megaphone },
    { label: "API", icon: Code2 },
    { label: "MCP", icon: Plug },
  ];

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

  const row = (item: DropItem) => {
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
            {item.href ? null : <span className="hf-tag">{soonLabel}</span>}
          </span>
          <span className="hf-dd-desc">{item.desc}</span>
        </span>
      </>
    );
    return item.href ? (
      <Link key={item.title} href={href(item.href)} className="hf-dd-row">
        {inner}
      </Link>
    ) : (
      <span key={item.title} className="hf-dd-row hf-dd-row-off" aria-disabled="true">
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
    { label: t.settings, href: "/settings", icon: Settings },
  ];
  const openMenu = dropdowns.find((menu) => menu.id === open);
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
            <span className="hf-sep" aria-hidden="true" />
            {upcoming.map((item) => (
              <span key={item.label} className="hf-item hf-item-off" aria-disabled="true">
                {item.label}
                <span className="hf-tag">{t.soonShort}</span>
              </span>
            ))}
          </nav>
        </div>

        <div className="hf-actions">
          <Link href={href("/templates")} aria-label={t.search} title={t.search} className="hf-act hf-act-icon">
            <Search aria-hidden="true" />
          </Link>
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
