"use client";

import Link from "next/link";
import { Clapperboard, Home, Search } from "lucide-react";
import { StateBlock } from "@/components/states/state-block";

/** Ask the nav to open site search (the nav listens for this event). */
export function openSiteSearch() {
  window.dispatchEvent(new Event("aivd:open-search"));
}

export function NotFoundView({ locale }: { locale: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const href = (path: string) => `/${locale}${path === "/" ? "" : path}`;

  const links = [
    { label: zh ? "AI 视频" : "AI video", href: "/ai/video" },
    { label: zh ? "AI 图片" : "AI image", href: "/ai/image" },
    { label: zh ? "AI 音频" : "AI audio", href: "/audio" },
    { label: zh ? "模板" : "Templates", href: "/templates" },
    { label: zh ? "定价" : "Pricing", href: "/pricing" },
  ];

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <StateBlock
        code="404"
        title={zh ? "这个页面不存在" : "This page does not exist"}
        body={zh ? "链接可能已经失效，或者地址输入有误。搜一搜，或者直接开始创作。" : "The link may be out of date or mistyped. Search for it, or start creating."}
        actions={[
          { label: zh ? "搜索全站" : "Search the site", onClick: openSiteSearch, icon: Search },
          { label: zh ? "开始生成视频" : "Make a video", href: href("/ai/video"), icon: Clapperboard, primary: true },
          { label: zh ? "回到首页" : "Go home", href: href("/"), icon: Home },
        ]}
      >
        <nav className="st-links" aria-label={zh ? "常用页面" : "Popular pages"}>
          {links.map((link) => (
            <Link key={link.href} href={href(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>
      </StateBlock>
    </div>
  );
}
