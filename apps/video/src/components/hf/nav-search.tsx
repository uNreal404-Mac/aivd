"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clapperboard,
  Clock,
  CreditCard,
  Crown,
  Folder,
  Image as ImageIcon,
  LayoutTemplate,
  Search,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui";
import { buildDropdowns } from "@/components/hf/nav-menus";
import { CREATIVE_SKILLS } from "@/lib/creative-skills";
import { HOME_TEMPLATES, HOME_TEMPLATE_CATEGORIES } from "@/lib/home-templates";
import {
  clearRecentSearches,
  readRecentSearches,
  rememberSearch,
  searchSite,
  type SearchEntry,
  type SearchTab,
} from "@/lib/site-search";
import "./nav-search.css";

type Entry = SearchEntry<LucideIcon>;

const S = (name: string) => `/home/samples/${name}.webp`;

/** Everything the panel can find, in the order sections are shown. */
function buildIndex(zh: boolean): Entry[] {
  const entries: Entry[] = [];
  // The same page can sit in two menus under two names ("图片转视频" under
  // Image, "图生视频" under Video). Keep one entry and let both names find it.
  const seen = new Map<string, Entry>();
  const here = buildDropdowns(zh);
  const there = buildDropdowns(!zh);

  // Models first, then features, from the nav menus in both languages.
  for (const pass of ["models", "features"] as const) {
    here.forEach((menu, m) => {
      menu.columns.forEach((column, c) => {
        const isModels = column.title === (zh ? "模型" : "Models");
        if ((pass === "models") !== isModels) return;
        column.items.forEach((item, i) => {
          const key = item.href ?? `${menu.id}:${item.title}`;
          const other = there[m]?.columns[c]?.items[i];
          const existing = seen.get(key);
          if (existing) {
            existing.keywords = [...(existing.keywords ?? []), item.title, item.desc, other?.title ?? ""];
            return;
          }
          const inTemplates = menu.id === "templates";
          const entry: Entry = {
            id: key,
            tab: isModels ? "models" : inTemplates ? "templates" : "features",
            section: isModels
              ? zh
                ? `${menu.label}模型`
                : `${menu.label} models`
              : inTemplates
                ? zh
                  ? "模板与灵感"
                  : "Templates & ideas"
                : zh
                  ? `${menu.label}工具`
                  : `${menu.label} tools`,
            title: item.title,
            desc: item.desc,
            keywords: [other?.title ?? "", other?.desc ?? "", item.tag ?? "", menu.label, there[m]?.label ?? ""],
            href: item.href,
            badge: item.badge,
            tag: item.tag,
            soon: item.soon || !item.href,
            icon: item.icon,
          };
          seen.set(key, entry);
          entries.push(entry);
        });
      });
    });
  }

  // Prompt templates and creative-space cases, with their pictures.
  for (const template of HOME_TEMPLATES) {
    const category = HOME_TEMPLATE_CATEGORIES.find((item) => item.id === template.category);
    entries.push({
      id: `template:${template.id}`,
      tab: "templates",
      section: zh ? "视频模板" : "Video templates",
      title: zh ? template.title.zh : template.title.en,
      desc: zh ? template.prompt.zh : template.prompt.en,
      keywords: [zh ? template.title.en : template.title.zh, category?.zh ?? "", category?.en ?? "", zh ? "模板" : "template"],
      href: `/ai/video?prompt=${encodeURIComponent(zh ? template.prompt.zh : template.prompt.en)}&aspect=${encodeURIComponent(template.aspect)}`,
      image: template.image,
    });
  }
  for (const skill of CREATIVE_SKILLS) {
    entries.push({
      id: `skill:${skill.id}`,
      tab: "templates",
      section: zh ? "创作空间案例" : "Creative Space ideas",
      title: zh ? skill.title.zh : skill.title.en,
      desc: zh ? skill.brief.zh : skill.brief.en,
      keywords: [zh ? skill.title.en : skill.title.zh, "agent", zh ? "创作空间" : "creative space"],
      href: `/creative-space/canvas?prompt=${encodeURIComponent(zh ? skill.brief.zh : skill.brief.en)}`,
      image: skill.image,
    });
  }

  // Pages people look for by name.
  const pages: { title: [string, string]; desc: [string, string]; href: string; icon: LucideIcon; keywords: string[] }[] = [
    { title: ["定价", "Pricing"], desc: ["套餐、积分包和新用户福利", "Plans, credit packs and the new-account offer"], href: "/pricing", icon: Crown, keywords: ["价格", "会员", "套餐", "订阅", "price", "plan", "subscription", "premium"] },
    { title: ["积分与账单", "Credits & billing"], desc: ["积分余额、明细和积分包到期时间", "Balance, history and when credits expire"], href: "/credits", icon: CreditCard, keywords: ["积分", "余额", "充值", "账单", "credits", "balance", "billing"] },
    { title: ["我的作品", "My creations"], desc: ["生成过的视频、图片和音频", "Everything you have generated"], href: "/my-creations", icon: Folder, keywords: ["历史", "作品", "下载", "history", "downloads"] },
    { title: ["社区画廊", "Community gallery"], desc: ["看看大家公开发布的作品", "Work others have published"], href: "/gallery", icon: Users, keywords: ["社区", "画廊", "community", "gallery"] },
    { title: ["账户", "Account"], desc: ["个人资料、套餐和偏好设置", "Profile, plan and preferences"], href: "/account", icon: UserRound, keywords: ["个人", "资料", "设置", "语言", "退出", "profile", "settings", "language", "sign out"] },
  ];
  for (const page of pages) {
    entries.push({
      id: `page:${page.href}`,
      tab: "pages",
      section: zh ? "页面" : "Pages",
      title: zh ? page.title[0] : page.title[1],
      desc: zh ? page.desc[0] : page.desc[1],
      keywords: [zh ? page.title[1] : page.title[0], ...page.keywords],
      href: page.href,
      icon: page.icon,
    });
  }
  return entries;
}

const POPULAR: { title: string; zh: string; en: string; href: string; image: string }[] = [
  { title: "Seedance 2.5", zh: "电影级画面和同步声音", en: "Cinematic video with synced sound", href: "/ai/video?model=bytedance%2Fseedance-2-5", image: S("rain-couple") },
  { title: "Nano Banana Pro", zh: "出色的 4K 图像模型", en: "An excellent 4K image model", href: "/ai/image?model=nano-banana-pro", image: S("red-carpet") },
  { title: "Creative Space", zh: "一句话拆成分镜再生成", en: "One line becomes a shot plan", href: "/creative-space", image: S("cosmic-bloom") },
  { title: "Veo 3.1", zh: "画面和声音一起生成", en: "Picture and sound together", href: "/ai/video?model=veo-3.1", image: S("mountain-valley") },
];

export function NavSearch({
  lang,
  localize,
  onClose,
}: {
  lang: string;
  /** Turns a site path into a localized link. */
  localize: (path: string) => string;
  onClose: () => void;
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const index = useMemo(() => buildIndex(zh), [zh]);
  const typed = query.trim().length > 0;

  const tabs: { id: SearchTab; label: string }[] = [
    { id: "all", label: zh ? "全部" : "All" },
    { id: "models", label: zh ? "模型" : "Models" },
    { id: "features", label: zh ? "功能" : "Features" },
    { id: "templates", label: zh ? "模板" : "Templates" },
    { id: "pages", label: zh ? "页面" : "Pages" },
  ];

  const sections = useMemo(() => {
    if (typed) return searchSite(index, query, tab);
    // Nothing typed: browse a tab, or show what is popular on "all".
    if (tab === "all") {
      return [
        { section: zh ? "热门" : "Popular", items: index.filter((entry) => entry.badge === "hot" && !entry.soon).slice(0, 6) },
        { section: zh ? "新上线" : "New", items: index.filter((entry) => entry.badge === "new" && entry.tab === "models" && !entry.soon).slice(0, 6) },
      ];
    }
    const grouped = new Map<string, Entry[]>();
    for (const entry of index) {
      if (entry.tab !== tab) continue;
      grouped.set(entry.section, [...(grouped.get(entry.section) ?? []), entry]);
    }
    return [...grouped].map(([section, items]) => ({ section, items }));
  }, [typed, index, query, tab, zh]);

  // Rows the arrow keys move through: only ones that lead somewhere.
  const rows = useMemo(() => sections.flatMap((section) => section.items.filter((item) => item.href)), [sections]);
  const fallbacks = typed && rows.length === 0;

  useEffect(() => {
    setRecent(readRecentSearches());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query, tab]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (path: string) => {
    if (typed) setRecent(rememberSearch(query));
    onClose();
    router.push(localize(path));
  };

  const fallbackLinks = [
    { label: zh ? `用「${query.trim()}」生成视频` : `Make a video of “${query.trim()}”`, href: `/ai/video?prompt=${encodeURIComponent(query.trim())}`, icon: Clapperboard },
    { label: zh ? `用「${query.trim()}」生成图片` : `Make an image of “${query.trim()}”`, href: `/ai/image?prompt=${encodeURIComponent(query.trim())}`, icon: ImageIcon },
  ];

  const onKeyDown = (event: React.KeyboardEvent) => {
    const count = fallbacks ? fallbackLinks.length : rows.length;
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else onClose();
    } else if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActive((value) => (value + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActive((value) => (value - 1 + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = fallbacks ? fallbackLinks[active]?.href : rows[active]?.href;
      if (target) go(target);
    } else if (event.key === "Tab" && !event.shiftKey && document.activeElement === inputRef.current) {
      // Tab cycles the category tabs while typing, like the reference.
      event.preventDefault();
      setTab((current) => tabs[(tabs.findIndex((item) => item.id === current) + 1) % tabs.length].id);
    }
  };

  let rowIndex = -1;
  const renderRow = (entry: Entry) => {
    const Icon = entry.icon ?? Sparkles;
    const live = Boolean(entry.href);
    const position = live ? ++rowIndex : -1;
    const content = (
      <>
        <span className={cn("ns-tile", entry.image && "ns-tile-img")}>
          {entry.image ? <img src={entry.image} alt="" loading="lazy" /> : <Icon aria-hidden="true" />}
        </span>
        <span className="ns-text">
          <span className="ns-title">
            {entry.title}
            {entry.tag ? <span className="ns-chip">{entry.tag}</span> : null}
            {entry.badge ? (
              <span className={entry.badge === "hot" ? "ns-badge ns-badge-hot" : "ns-badge"}>
                {entry.badge === "hot" ? (zh ? "热门" : "Hot") : zh ? "新" : "New"}
              </span>
            ) : null}
            {entry.soon ? <span className="ns-soon">{zh ? "即将上线" : "Soon"}</span> : null}
          </span>
          <span className="ns-desc">{entry.desc}</span>
        </span>
        {live ? <ArrowRight className="ns-go" aria-hidden="true" /> : null}
      </>
    );
    return live ? (
      <button
        key={entry.id}
        type="button"
        aria-current={position === active || undefined}
        data-row={position}
        className={cn("ns-row", position === active && "ns-row-on")}
        onMouseMove={() => setActive(position)}
        onClick={() => entry.href && go(entry.href)}
      >
        {content}
      </button>
    ) : (
      <div key={entry.id} className="ns-row ns-row-off" aria-disabled="true">
        {content}
      </div>
    );
  };

  return (
    <div className="ns" onKeyDown={onKeyDown}>
      <button type="button" className="ns-scrim" aria-label={zh ? "关闭搜索" : "Close search"} tabIndex={-1} onClick={onClose} />
      <div className="ns-bar">
        <Search className="ns-bar-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={zh ? "搜索模型、功能、模板…" : "Search models, features, templates…"}
          aria-label={zh ? "搜索全站" : "Search the site"}
          aria-controls="ns-results"
          autoComplete="off"
          spellCheck={false}
          maxLength={120}
        />
        {query ? (
          <button
            type="button"
            className="ns-clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            {zh ? "清除" : "Clear"}
          </button>
        ) : (
          <kbd className="ns-kbd">⌘ K</kbd>
        )}
        <span className="ns-bar-sep" aria-hidden="true" />
        <button type="button" className="ns-close" aria-label={zh ? "关闭搜索" : "Close search"} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="ns-panel">
        <div className="ns-tabs" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={cn("ns-tab", tab === item.id && "ns-tab-on")}
              onClick={() => {
                setTab(item.id);
                inputRef.current?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div ref={listRef} id="ns-results" className="ns-body" aria-label={zh ? "搜索结果" : "Results"}>
          {!typed && tab === "all" ? (
            <>
              {recent.length ? (
                <div className="ns-block">
                  <div className="ns-head">
                    <span>{zh ? "最近搜索" : "Recent"}</span>
                    <button
                      type="button"
                      className="ns-link"
                      onClick={() => {
                        clearRecentSearches();
                        setRecent([]);
                      }}
                    >
                      {zh ? "清空" : "Clear"}
                    </button>
                  </div>
                  <div className="ns-recent">
                    {recent.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="ns-recent-chip"
                        onClick={() => {
                          setQuery(item);
                          inputRef.current?.focus();
                        }}
                      >
                        <Clock aria-hidden="true" />
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="ns-block">
                <div className="ns-head">
                  <span>{zh ? "热门产品" : "Popular products"}</span>
                  <button type="button" className="ns-link" onClick={() => setTab("models")}>
                    {zh ? "查看全部" : "See all"}
                    <ArrowRight aria-hidden="true" />
                  </button>
                </div>
                <div className="ns-cards">
                  {POPULAR.map((card) => (
                    <button key={card.title} type="button" className="ns-card" onClick={() => go(card.href)}>
                      <span className="ns-card-media">
                        <img src={card.image} alt="" loading="lazy" />
                      </span>
                      <span className="ns-card-title">{card.title === "Creative Space" && zh ? "创作空间" : card.title}</span>
                      <span className="ns-card-desc">{zh ? card.zh : card.en}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ns-cols">
                {sections.map((section) => (
                  <div key={section.section} className="ns-block">
                    <div className="ns-head">
                      <span>{section.section}</span>
                    </div>
                    {section.items.map(renderRow)}
                  </div>
                ))}
              </div>
            </>
          ) : typed || sections.length > 0 ? (
            <>
              {sections.map((section) => (
                <div key={section.section} className="ns-block">
                  <div className="ns-head">
                    <span>{section.section}</span>
                    <span className="ns-count">{section.items.length}</span>
                  </div>
                  {section.items.map(renderRow)}
                </div>
              ))}
              {fallbacks ? (
                <div className="ns-empty">
                  <p>
                    {sections.length
                      ? zh
                        ? "这些功能还没上线，可以先直接生成："
                        : "These are not live yet. You can generate right away:"
                      : zh
                        ? `没有找到「${query.trim()}」相关的模型或功能`
                        : `Nothing matches “${query.trim()}”`}
                  </p>
                  {sections.length ? null : <p className="ns-empty-sub">{zh ? "可以直接拿这句话去生成：" : "You can generate from it directly:"}</p>}
                  {fallbackLinks.map((link, position) => {
                    const Icon = link.icon;
                    return (
                      <button
                        key={link.href}
                        type="button"
                        aria-current={position === active || undefined}
                        data-row={position}
                        className={cn("ns-row", position === active && "ns-row-on")}
                        onMouseMove={() => setActive(position)}
                        onClick={() => go(link.href)}
                      >
                        <span className="ns-tile">
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="ns-text">
                          <span className="ns-title">{link.label}</span>
                        </span>
                        <ArrowRight className="ns-go" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <div className="ns-empty">
              <LayoutTemplate aria-hidden="true" />
              <p>{zh ? "这里还没有内容" : "Nothing here yet"}</p>
            </div>
          )}
        </div>

        <div className="ns-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {zh ? "选择" : "Move"}
          </span>
          <span>
            <kbd>Enter</kbd>
            {zh ? "打开" : "Open"}
          </span>
          <span>
            <kbd>Tab</kbd>
            {zh ? "切换分类" : "Category"}
          </span>
          <span>
            <kbd>Esc</kbd>
            {zh ? "关闭" : "Close"}
          </span>
        </div>
      </div>
    </div>
  );
}
