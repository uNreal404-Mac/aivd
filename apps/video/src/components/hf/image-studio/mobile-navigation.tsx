"use client";

import { Folder, House, Plus, UserRound, UsersRound, X } from "lucide-react";
import { localizedHref } from "@/lib/locale-path";

export function ImageMobileNavigation({ locale, zh, open, onToggle }: {
  locale: string; zh: boolean; open: boolean; onToggle: () => void;
}) {
  const item = (path: string, label: string, Icon: typeof House) => (
    <a href={localizedHref(locale, path)}><Icon aria-hidden="true" /><span>{label}</span></a>
  );
  return (
    <nav className="is-mobile-nav" aria-label={zh ? "图像工作室导航" : "Image studio navigation"}>
      {item("/", zh ? "首页" : "Home", House)}
      {item("/gallery", zh ? "社区" : "Community", UsersRound)}
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="image-composer"
        aria-label={open ? zh ? "收起生成器" : "Close composer" : zh ? "创建图像" : "Create image"}>
        {open ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </button>
      {item("/my-creations", zh ? "作品库" : "Library", Folder)}
      {item("/account", zh ? "账户" : "Account", UserRound)}
    </nav>
  );
}
