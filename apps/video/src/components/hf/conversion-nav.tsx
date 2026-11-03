"use client";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocalePathname } from "@/i18n/navigation";
import { creationLabel } from "@/lib/creation-label";
import { localizedHref } from "@/lib/du-home";

interface HfTopNavProps { user?: { name?: string | null; email?: string | null; image?: string | null } | null; lang: string; }
export function HfTopNav({ user, lang }: HfTopNavProps) {
  const path = useLocalePathname();
  const modal = useSigninModal();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const zh = lang.startsWith("zh");
  const links = [
    [zh ? "创作" : "Create", "/text-to-video"],
    [zh ? "模板" : "Templates", "/#templates"],
    [zh ? "作品" : "Gallery", "/gallery"],
    [zh ? "定价" : "Pricing", "/pricing"]
  ];
  const href = (dest: string) => localizedHref(lang, dest);
  const navigation = (items: typeof links) => items.map(([label, dest]) =>
    <Link key={dest} href={href(dest)} prefetch={false} aria-current={path === dest ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>);
  useEffect(() => {
    if (!open) return;
    function dismiss(e: KeyboardEvent) { if (e.key === "Escape") { setOpen(false); menu.current?.focus(); } }
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);
  return <header className="du-nav">
    <div className="du-frame du-nav-inner">
      <Link className="du-brand" href={href("/")} aria-label={zh ? "aidv.ai 首页" : "aidv.ai home"}><img src="/logo.svg" alt="" width={32} height={32}/>aidv.ai</Link>
      <nav aria-label={zh ? "主导航" : "Main navigation"} className="du-nav-links">{navigation(links)}</nav>
      <div className="du-nav-actions">
        {user ? <Link href={href("/my-creations")} aria-label={zh ? "我的作品" : "My creations"}><UserAvatar user={{ name: user.name ?? null, image: user.image ?? null }}/></Link> :
          <button className="du-login" type="button" onClick={modal.onOpen}>{zh ? "登录" : "Login"}</button>}
        <Link href={href("/text-to-video")} className="du-nav-create" prefetch={false}>{creationLabel(lang)}<ArrowUpRight size={15} aria-hidden="true"/></Link>
        <button type="button" ref={menu} className="du-menu" aria-label={open ? (zh ? "关闭菜单" : "Close menu") : (zh ? "打开菜单" : "Open menu")} aria-expanded={open} aria-controls="du-mobile-menu" onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button></div>
      <nav id="du-mobile-menu" aria-label={zh ? "移动导航" : "Mobile navigation"} className="du-mobile-menu" hidden={!open}>{navigation(links)}
        <Link href={href("/text-to-video")} onClick={() => setOpen(false)}>{creationLabel(lang)} ↗</Link>
      </nav>
    </div></header>;
}
