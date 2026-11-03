"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useLocalePathname } from "@/i18n/navigation";
import { displayBrand } from "@/lib/display-brand";
import { creationLabel } from "@/lib/creation-label";
import { localizedHref } from "@/lib/du-home";
import s from "./conversion-nav.module.css";

interface HfTopNavProps {
  user?: { name?: string | null; email?: string | null; image?: string | null } | null;
  lang: string;
}

export function HfTopNav({ user, lang }: HfTopNavProps) {
  const path = useLocalePathname();
  const modal = useSigninModal();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const zh = lang.startsWith("zh");
  const links = [
    [zh ? "创作" : "Create", "/text-to-video"],
    [zh ? "模板" : "Templates", "/#templates"],
    [zh ? "作品" : "Gallery", "/gallery"],
    [zh ? "定价" : "Pricing", "/pricing"],
  ];
  const href = (dest: string) => localizedHref(lang, dest);
  const menuLabel = open ? (zh ? "关闭菜单" : "Close menu") : (zh ? "打开菜单" : "Open menu");
  const navItems = links.map(([label, dest]) => (
    <Link key={dest} href={href(dest)} prefetch={false} aria-current={path === dest ? "page" : undefined} onClick={() => setOpen(false)}>
      {label}
    </Link>
  ));

  useEffect(() => {
    if (!open) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      menu.current?.focus();
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false);
    }
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", closeOnResize);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", closeOnResize);
    };
  }, [open]);

  return (
    <header ref={header} className={`du-nav ${s.header}`}>
      <div className={s.inner}>
        <Link className={s.brand} href={href("/")} aria-label={zh ? `${displayBrand} 首页` : `${displayBrand} home`}>
          <img src="/logo.svg" alt="" width={30} height={30} /><span>{displayBrand}</span>
        </Link>
        <nav aria-label={zh ? "主导航" : "Main navigation"} className={`du-nav-links ${s.links}`}>{navItems}</nav>
        <div className={s.actions}>
          {user ? <Link href={href("/my-creations")} aria-label={zh ? "我的作品" : "My creations"}><UserAvatar user={{ name: user.name ?? null, image: user.image ?? null }} /></Link>
            : <button type="button" className={s.login} onClick={modal.onOpen}>{zh ? "登录" : "Login"}</button>}
          <Link href={href("/text-to-video")} className={s.create} prefetch={false}>{creationLabel(lang)}<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <button type="button" ref={menu} className={s.menu} title={menuLabel} aria-label={menuLabel} aria-expanded={open} aria-controls="du-mobile-menu" onClick={() => setOpen(!open)}>
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
        <nav id="du-mobile-menu" aria-label={zh ? "移动导航" : "Mobile navigation"} className={s.panel} hidden={!open}>
          {navItems}
          <Link className={s.panelAction} href={href("/text-to-video")} prefetch={false} onClick={() => setOpen(false)}>
            {creationLabel(lang)}<ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
