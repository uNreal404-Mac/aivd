"use client";

import { ACCOUNT_COPY, planLabel } from "@/lib/account-view";
import Link from "next/link";
import { localizedHref } from "@/lib/locale-path";
import { useEffect } from "react";
import { Clapperboard, Coins, Folder, Image as ImageIcon, UserRound } from "lucide-react";

import { useLocalePathname } from "@/i18n/navigation";
import { useCreditsStore } from "@/stores/credits-store";

/** Left rail of the signed-in area. */
export function AccountNav({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const pathname = useLocalePathname();
  const balance = useCreditsStore((state) => state.balance);
  const fetchBalance = useCreditsStore((state) => state.fetchBalance);
  const href = (path: string) => localizedHref(lang, path);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  const links = [
    { path: "/my-creations", label: zh ? "我的作品" : "My creations", icon: Folder },
    { path: "/credits", label: zh ? "积分与账单" : "Credits & billing", icon: Coins },
    { path: "/account", label: zh ? "账户" : "Account", icon: UserRound },
  ];
  const create = [
    { path: "/ai/video", label: zh ? "生成视频" : "Make a video", icon: Clapperboard },
    { path: "/ai/image", label: zh ? "生成图片" : "Make an image", icon: ImageIcon },
  ];

  return (
    <aside className="db-rail" aria-label={zh ? "账户中心" : "Account"}>
      <p className="db-rail-title">{zh ? "账户中心" : "ACCOUNT"}</p>
      {links.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link key={item.path} href={href(item.path)} className="db-rail-link" aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <span className="db-rail-sep" aria-hidden="true" />
      <p className="db-rail-title">{zh ? "开始创作" : "CREATE"}</p>
      {create.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.path} href={href(item.path)} className="db-rail-link">
            <Icon aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}

      <div className="db-rail-plan">
        <span className="db-rail-plan-name">{planLabel(balance?.tier, zh ? ACCOUNT_COPY.zh : ACCOUNT_COPY.en)}</span>
        <span className="db-rail-plan-credits">
          {zh ? "可用积分 " : "Credits "}
          <strong>{balance ? balance.availableCredits.toLocaleString() : "—"}</strong>
        </span>
        <Link href={href("/pricing")} className="db-btn db-btn-accent db-btn-sm">
          {zh ? "购买积分 / 升级" : "Buy credits / upgrade"}
        </Link>
      </div>
    </aside>
  );
}
