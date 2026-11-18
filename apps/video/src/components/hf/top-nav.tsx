"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Code2,
  Eraser,
  Expand,
  FastForward,
  Layers,
  Mic,
  ScanFace,
  Smartphone,
  UserRound,
  ZoomIn,
  Clapperboard,
  Compass,
  Crown,
  Film,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  Menu,
  Orbit,
  Sparkles,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocalePathname } from "@/i18n/navigation";
import { PreviewBadge } from "@/components/layout/preview-badge";
import { LocaleChange } from "@/components/locale-change";
import "./top-nav.css";

interface HfTopNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  lang: string;
}

type MenuLink = { label: string; href?: string; icon: LucideIcon; soon?: boolean; badge?: string };
type MenuColumn = { title: string; links: MenuLink[]; more?: { label: string; href: string } };
type MegaMenu = {
  id: string;
  label: string;
  /** Landing page of the section; the top-level item links here. */
  path: string;
  /** Routes that belong to the section, for the active state and the tab strip. */
  routes: string[];
  intro: { title: string; body: string; cta: string; href: string; image: string };
  columns: MenuColumn[];
};

export function HfTopNav({ user, lang }: HfTopNavProps) {
  const pathname = useLocalePathname();
  const signInModal = useSigninModal();
  const zh = lang.toLowerCase().startsWith("zh");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openMega, setOpenMega] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openMega) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMega(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".hf-nav")) setOpenMega(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openMega]);

  // Close menus when the route changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run on route change only
  useEffect(() => {
    setOpenMega(null);
    setMenuOpen(false);
  }, [pathname]);

  const soon = zh ? "即将上线" : "Soon";
  const t = zh
    ? {
        home: "首页",
        templates: "模板",
        creative: "创作空间",
        pricing: "价格",
        upgrade: "升级",
        login: "登录",
        signup: "免费开始",
        openMenu: "打开菜单",
        closeMenu: "关闭菜单",
        creations: "我的作品",
      }
    : {
        home: "Home",
        templates: "Templates",
        creative: "Creative Space",
        pricing: "Pricing",
        upgrade: "Upgrade",
        login: "Log in",
        signup: "Start free",
        openMenu: "Open menu",
        closeMenu: "Close menu",
        creations: "My creations",
      };

  // Only pages that exist are linked. Models that are not connected yet are
  // listed as coming soon and are not clickable.
  const megaMenus: MegaMenu[] = [
    {
      id: "video",
      label: zh ? "视频" : "Video",
      path: "/video",
      routes: ["/video", "/ai/video", "/text-to-video", "/image-to-video", "/reference-to-video", "/veo-3-1", "/wan-2-6", "/models"],
      intro: {
        title: zh ? "AI视频" : "AI Video",
        body: zh
          ? "用文字或图片生成带运镜和声音的视频，生成前就能看到要消耗的积分。"
          : "Turn text or an image into video with camera moves and sound. See the credit cost before you generate.",
        cta: zh ? "试试AI视频生成器" : "Try the AI video generator",
        href: "/ai/video",
        image: "/home/samples/mountain-valley.webp",
      },
      columns: [
        {
          title: zh ? "视频" : "Video",
          links: [
            { label: zh ? "文生视频" : "Text to Video", href: "/text-to-video", icon: Film },
            { label: zh ? "图生视频" : "Image to Video", href: "/image-to-video", icon: ImagePlus },
            { label: zh ? "参考生视频" : "Reference to Video", href: "/reference-to-video", icon: Clapperboard },
            { label: zh ? "AI 视频特效" : "AI Video Effects", href: "/effects", icon: Wand2 },
            { label: zh ? "AI 视频编辑" : "AI Video Editor", icon: Layers, soon: true },
            { label: zh ? "视频生视频" : "Video to Video", icon: Film, soon: true },
            { label: zh ? "AI 数字人" : "AI Avatar", icon: UserRound, soon: true },
            { label: zh ? "视频画质提升" : "Video Upscaler", icon: ZoomIn, soon: true },
            { label: zh ? "动作模仿" : "Motion Mimic", icon: ScanFace, soon: true },
            { label: zh ? "视频延长" : "Video Extender", icon: FastForward, soon: true },
          ],
          more: { label: zh ? "打开视频工作室" : "Open video studio", href: "/ai/video" },
        },
        {
          title: zh ? "视频模型" : "Video models",
          links: [
            { label: "Veo 3.1", href: "/veo-3-1", icon: Sparkles },
            { label: "Wan 2.6", href: "/wan-2-6", icon: Orbit },
            { label: "Seedance 2.0", icon: Clapperboard, soon: true },
            { label: "Kling 4.0", icon: Orbit, soon: true },
            { label: "MiniMax H3", icon: Film, soon: true },
            { label: "Seedance 2.5", icon: Clapperboard, soon: true },
            { label: "Wan 3.0", icon: Orbit, soon: true },
            { label: "Grok Imagine", icon: Sparkles, soon: true },
          ],
        },
        {
          title: zh ? "产品" : "Products",
          links: [
            { label: t.creative, href: "/creative-space", icon: Sparkles },
            { label: zh ? "社区画廊" : "Community gallery", href: "/gallery", icon: LayoutGrid },
            { label: zh ? "灵感探索" : "Explore", href: "/explore", icon: Compass },
          ],
        },
      ],
    },
    {
      id: "image",
      label: zh ? "图片" : "Image",
      path: "/image",
      routes: ["/image", "/ai/image"],
      intro: {
        title: zh ? "AI图片" : "AI Image",
        body: zh
          ? "根据文字或参考图生成静态画面，可作为视频的起始帧。"
          : "Generate stills from text or a reference image, and use them as a video's start frame.",
        cta: zh ? "试试AI图片生成器" : "Try the AI image generator",
        href: "/ai/image",
        image: "/home/samples/red-carpet.webp",
      },
      columns: [
        {
          title: zh ? "图片" : "Image",
          links: [
            { label: zh ? "AI 图片生成器" : "AI Image Generator", href: "/ai/image", icon: ImageIcon },
            { label: zh ? "图生图" : "Image to Image", icon: ImagePlus, soon: true },
            { label: zh ? "AI 图片编辑" : "AI Photo Editor", icon: Wand2, soon: true },
            { label: zh ? "图片高清放大" : "Image Upscaler", icon: ZoomIn, soon: true },
            { label: zh ? "背景去除" : "Background Remover", icon: Eraser, soon: true },
            { label: zh ? "图片扩展" : "Image Extender", icon: Expand, soon: true },
          ],
        },
        {
          title: zh ? "图片模型" : "Image models",
          links: [
            { label: "Nano Banana 2", icon: ImageIcon, soon: true },
            { label: "Seedream 5.5", icon: ImageIcon, soon: true },
            { label: "GPT Image 2.5", icon: ImageIcon, soon: true },
            { label: "FLUX.3", icon: ImageIcon, soon: true },
            { label: "Z-Image", icon: ImageIcon, soon: true },
          ],
        },
        {
          title: zh ? "图片转视频" : "Image to video",
          links: [
            { label: zh ? "图生视频" : "Image to Video", href: "/image-to-video", icon: ImagePlus },
            { label: zh ? "社区画廊" : "Community gallery", href: "/gallery", icon: LayoutGrid },
          ],
        },
      ],
    },
    {
      id: "creative",
      label: t.creative,
      path: "/creative-space",
      routes: ["/creative-space"],
      intro: {
        title: t.creative,
        body: zh
          ? "在画布上整理素材，和 Agent 对话，把一个想法拆成分镜和可执行的提示词。"
          : "Arrange assets on a canvas, talk to an agent, and turn an idea into shots and usable prompts.",
        cta: zh ? "进入创作空间" : "Open Creative Space",
        href: "/creative-space",
        image: "/home/samples/cosmic-bloom.webp",
      },
      columns: [
        {
          title: zh ? "创作" : "Create",
          links: [
            { label: zh ? "创作空间" : "Creative Space", href: "/creative-space", icon: Sparkles },
            { label: zh ? "视频工作室" : "Video studio", href: "/ai/video", icon: Film },
            { label: zh ? "我的作品" : "My creations", href: "/my-creations", icon: Layers },
          ],
        },
        {
          title: zh ? "即将推出" : "Coming next",
          links: [
            { label: zh ? "AI 故事视频" : "AI Story Video", icon: BookOpen, soon: true },
            { label: zh ? "AI 配音" : "AI Voiceover", icon: Mic, soon: true },
          ],
        },
      ],
    },
    {
      id: "templates",
      label: t.templates,
      path: "/templates",
      routes: ["/templates", "/effects", "/gallery", "/explore"],
      intro: {
        title: t.templates,
        body: zh
          ? "选一个创意模板，提示词会直接填进首页的生成器，改完就能生成。"
          : "Pick an idea template and its prompt loads into the homepage generator, ready to edit and generate.",
        cta: zh ? "浏览全部模板" : "Browse all templates",
        href: "/templates",
        image: "/home/samples/boy-and-dog.webp",
      },
      columns: [
        {
          title: zh ? "模板分类" : "Categories",
          links: [
            { label: zh ? "故事视频" : "Story video", href: "/templates#tpl-story", icon: BookOpen },
            { label: zh ? "动态创作" : "Motion", href: "/templates#tpl-motion", icon: Orbit },
            { label: zh ? "创意重构" : "Recast", href: "/templates#tpl-recast", icon: Wand2 },
          ],
        },
        {
          title: zh ? "灵感" : "Inspiration",
          links: [
            { label: zh ? "社区画廊" : "Community gallery", href: "/gallery", icon: LayoutGrid },
            { label: zh ? "灵感探索" : "Explore", href: "/explore", icon: Compass },
            { label: zh ? "AI 视频特效" : "AI Video Effects", href: "/effects", icon: Wand2 },
          ],
        },
      ],
    },
    {
      id: "developers",
      label: zh ? "开发者" : "Developers",
      path: "/pricing",
      routes: [],
      intro: {
        title: zh ? "开发者" : "Developers",
        body: zh
          ? "API 和 MCP 接入正在准备中，上线后可在你自己的产品里调用视频生成。"
          : "API and MCP access are in preparation. Once live, you can call video generation from your own product.",
        cta: zh ? "查看价格" : "See pricing",
        href: "/pricing",
        image: "/home/samples/studio-room.webp",
      },
      columns: [
        {
          title: zh ? "接入方式" : "Integrations",
          links: [
            { label: "aivd API", icon: Code2, soon: true },
            { label: "MCP", icon: Code2, soon: true },
            { label: zh ? "移动端 App" : "Mobile app", icon: Smartphone, soon: true },
          ],
        },
      ],
    },
  ];

  const sectionTabs: Record<string, { label: string; path: string; soon?: boolean }[]> = {
    video: [
      { label: zh ? "AI 视频" : "AI Video", path: "/video" },
      { label: zh ? "视频工作室" : "Video studio", path: "/ai/video" },
      { label: zh ? "文生视频" : "Text to Video", path: "/text-to-video" },
      { label: zh ? "图生视频" : "Image to Video", path: "/image-to-video" },
      { label: zh ? "参考生视频" : "Reference to Video", path: "/reference-to-video" },
      { label: "Veo 3.1", path: "/veo-3-1" },
      { label: "Wan 2.6", path: "/wan-2-6" },
      { label: zh ? "AI 视频编辑" : "AI Video Editor", path: "", soon: true },
      { label: zh ? "视频画质提升" : "Video Upscaler", path: "", soon: true },
    ],
    image: [
      { label: zh ? "AI 图片" : "AI Image", path: "/image" },
      { label: zh ? "图片工作室" : "Image studio", path: "/ai/image" },
      { label: zh ? "图生图" : "Image to Image", path: "", soon: true },
      { label: zh ? "AI 图片编辑" : "AI Photo Editor", path: "", soon: true },
      { label: zh ? "图片高清放大" : "Image Upscaler", path: "", soon: true },
      { label: zh ? "背景去除" : "Background Remover", path: "", soon: true },
    ],
    templates: [
      { label: zh ? "全部模板" : "All templates", path: "/templates" },
      { label: zh ? "特效模板" : "Effect templates", path: "/effects" },
      { label: zh ? "社区画廊" : "Community gallery", path: "/gallery" },
      { label: zh ? "灵感探索" : "Explore", path: "/explore" },
    ],
  };

  const href = (path: string) => (path.startsWith("/#") ? `/${lang}${path.slice(1)}` : `/${lang}${path === "/" ? "" : path}`);
  const inRoutes = (routes: string[]) => routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const activeSection = megaMenus.find((menu) => inRoutes(menu.routes));
  const tabs = activeSection ? sectionTabs[activeSection.id] : undefined;
  const headerRef = useRef<HTMLElement>(null);
  // Tool layouts size their workspace to the space under the header, which
  // grows when a section tab strip is shown.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the strip appears or goes
  useEffect(() => {
    const height = headerRef.current?.offsetHeight ?? 56;
    document.documentElement.style.setProperty("--hf-header-h", `${height}px`);
  }, [tabs?.length]);

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));

  const openNow = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMega(id);
  };
  // Only close the menu that was left; moving straight onto another menu
  // must not be undone by the previous menu's timer.
  const closeSoon = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMega((current) => (current === id ? null : current)), 140);
  };

  const plainLink = (path: string, label: string) => (
    <Link key={path} href={href(path)} className={cn("hf-nav-link", isActive(path) && "hf-nav-link-active")}>
      {label}
    </Link>
  );

  const menuRow = (link: MenuLink) => {
    const Icon = link.icon;
    const inner = (
      <>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">{link.label}</span>
        {link.soon ? <span className="hf-mega-soon">{soon}</span> : null}
      </>
    );
    return link.soon || !link.href ? (
      <span key={link.label} className="hf-mega-row hf-mega-row-disabled" aria-disabled="true">
        {inner}
      </span>
    ) : (
      <Link key={link.label} href={href(link.href)} className="hf-mega-row">
        {inner}
      </Link>
    );
  };

  return (
    <header ref={headerRef} className={cn("hf-nav", scrolled && "hf-nav-scrolled", tabs && "hf-nav-with-tabs")}>
      <div className="hf-nav-inner">
        <Link href={href("/")} className="flex shrink-0 items-center gap-2">
          <img src="/logo.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight text-white">aivd.ai</span>
          <PreviewBadge lang={lang} />
        </Link>

        <nav className="hf-nav-links" aria-label={zh ? "主导航" : "Main"}>
          {plainLink("/", t.home)}
          {megaMenus.map((menu) => (
            <div key={menu.id} className="relative" onMouseEnter={() => openNow(menu.id)} onMouseLeave={() => closeSoon(menu.id)}>
              <Link
                href={href(menu.path)}
                aria-expanded={openMega === menu.id}
                aria-haspopup="true"
                onFocus={() => openNow(menu.id)}
                className={cn("hf-nav-link", (openMega === menu.id || activeSection?.id === menu.id) && "hf-nav-link-active")}
              >
                {menu.label}
                <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5 transition-transform", openMega === menu.id && "rotate-180")} />
              </Link>
            </div>
          ))}
          {user ? plainLink("/my-creations", t.creations) : null}
          {plainLink("/pricing", t.pricing)}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href={href("/pricing")} className="hf-nav-pill">
            <Crown aria-hidden="true" className="h-3.5 w-3.5 text-[var(--du-accent-text)]" />
            {t.upgrade}
          </Link>
          <LocaleChange />
          {user ? (
            <Link href={href("/my-creations")} aria-label={t.creations} className="flex h-9 items-center">
              <UserAvatar user={{ name: user.name ?? null, image: user.image ?? null }} className="h-7 w-7" />
            </Link>
          ) : (
            <>
              <button type="button" onClick={() => signInModal.onOpen()} className="hf-nav-login">
                {t.login}
              </button>
              <button type="button" onClick={() => signInModal.onOpen()} className="hf-nav-signup">
                {t.signup}
              </button>
            </>
          )}
          <button
            type="button"
            aria-label={menuOpen ? t.closeMenu : t.openMenu}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white xl:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {tabs ? (
        <nav className="hf-tabs" aria-label={activeSection?.label}>
          {tabs.map((tab) =>
            tab.soon ? (
              <span key={tab.label} className="hf-tab hf-tab-soon" aria-disabled="true">
                {tab.label}
                <span className="hf-mega-soon">{soon}</span>
              </span>
            ) : (
              <Link
                key={tab.label}
                href={href(tab.path)}
                aria-current={isActive(tab.path) ? "page" : undefined}
                className={cn("hf-tab", isActive(tab.path) && "hf-tab-active")}
              >
                {tab.label}
              </Link>
            ),
          )}
        </nav>
      ) : null}

      {megaMenus.map((menu) =>
        openMega === menu.id ? (
          <div
            key={menu.id}
            className="hf-mega"
            onMouseEnter={() => openNow(menu.id)}
            onMouseLeave={() => closeSoon(menu.id)}
          >
            <div className="hf-mega-intro">
              <p className="hf-mega-intro-title">{menu.intro.title}</p>
              <p className="hf-mega-intro-body">{menu.intro.body}</p>
              <Link href={href(menu.intro.href)} className="hf-mega-intro-cta">
                {menu.intro.cta}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
              <img src={menu.intro.image} alt="" className="hf-mega-intro-image" loading="lazy" />
            </div>
            {menu.columns.map((column) => (
              <div key={column.title} className="hf-mega-col">
                <p className="hf-mega-col-title">{column.title}</p>
                {column.links.map(menuRow)}
                {column.more ? (
                  <Link href={href(column.more.href)} className="hf-mega-more">
                    {column.more.label}
                    <ArrowRight aria-hidden="true" className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : null,
      )}

      {menuOpen ? (
        <div className="hf-nav-mobile xl:hidden">
          {plainLink("/", t.home)}
          {megaMenus.map((menu) => plainLink(menu.path, menu.label))}
          {plainLink("/pricing", t.pricing)}
        </div>
      ) : null}
    </header>
  );
}
