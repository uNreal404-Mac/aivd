"use client";

import Link from "next/link";
import { localizedHref } from "@/lib/locale-path";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Coins, Gift, Receipt, RotateCcw, Settings2, ShoppingBag, Sparkles, TimerOff, type LucideIcon } from "lucide-react";

import { GridSkeleton } from "@/components/states/skeletons";
import { StateBlock } from "@/components/states/state-block";
import { useBilling } from "@/hooks/use-billing";
import { useCreditBalance, useCreditHistory } from "@/hooks/use-credits";
import { creditKind, creditKindLabel, describeRemark, type CreditKind } from "@/lib/credit-labels";

const KIND_ICON: Record<CreditKind, LucideIcon> = {
  gift: Gift,
  purchase: ShoppingBag,
  subscription: Receipt,
  spend: Sparkles,
  refund: RotateCcw,
  expired: TimerOff,
  adjust: Settings2,
};

function useDateFormat(zh: boolean) {
  const format = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  return (value: string | Date) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : format.format(date);
  };
}

/** Credits & billing: balance, the credit ledger and purchases. */
export function CreditsPage({ locale }: { locale: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const router = useRouter();
  const { balance, isLoading: balanceLoading } = useCreditBalance();
  const { transactions, hasMore, fetchNextPage, isLoading: historyLoading } = useCreditHistory();
  const billing = useBilling();
  const formatDate = useDateFormat(zh);
  const href = (path: string) => localizedHref(locale, path);

  // After checkout the user may be sent back to where they started.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);
    const returnTo = params.get("returnTo");
    if (returnTo) {
      const timer = setTimeout(() => router.push(decodeURIComponent(returnTo)), 1500);
      return () => clearTimeout(timer);
    }
  }, [router]);

  const n = (value: number | undefined) => (value ?? 0).toLocaleString(zh ? "zh-CN" : "en-US");

  return (
    <div className="db-page">
      <header className="db-head">
        <div>
          <h1 className="db-title">{zh ? "积分与账单" : "Credits & billing"}</h1>
          <p className="db-sub">{zh ? "生成前会冻结所需积分，成功后扣除，失败自动退回。" : "Credits are held when you generate, taken on success and returned on failure."}</p>
        </div>
        <Link href={href("/pricing")} className="db-btn db-btn-accent">
          <Coins aria-hidden="true" />
          {zh ? "购买积分" : "Buy credits"}
        </Link>
      </header>

      {/* Balance */}
      {balanceLoading && !balance ? (
        <GridSkeleton count={4} height={96} />
      ) : (
        <div className="db-stats">
          <div className="db-stat db-stat-main">
            <span className="db-stat-label">{zh ? "可用积分" : "Available"}</span>
            <span className="db-stat-value">{n(balance?.availableCredits)}</span>
            <span className="db-stat-note">
              {zh ? `约可生成 ${Math.floor((balance?.availableCredits ?? 0) / 90)} 条 Veo 3.1 视频` : `About ${Math.floor((balance?.availableCredits ?? 0) / 90)} Veo 3.1 clips`}
            </span>
          </div>
          <div className="db-stat">
            <span className="db-stat-label">{zh ? "生成中冻结" : "Held for running jobs"}</span>
            <span className="db-stat-value">{n(balance?.frozenCredits)}</span>
          </div>
          <div className="db-stat">
            <span className="db-stat-label">{zh ? "已使用" : "Used"}</span>
            <span className="db-stat-value">{n(balance?.usedCredits)}</span>
          </div>
          <div className="db-stat">
            <span className="db-stat-label">{zh ? "7 天内过期" : "Expiring within 7 days"}</span>
            <span className="db-stat-value">{n(balance?.expiringSoon)}</span>
          </div>
        </div>
      )}

      {/* Ledger */}
      <section className="db-section" aria-labelledby="db-ledger">
        <div className="db-section-head">
          <h2 id="db-ledger" className="db-h2">{zh ? "积分明细" : "Credit history"}</h2>
        </div>
        {historyLoading && transactions.length === 0 ? (
          <GridSkeleton count={1} height={240} />
        ) : transactions.length === 0 ? (
          <StateBlock
            framed
            icon={Coins}
            title={zh ? "还没有积分记录" : "No credit activity yet"}
            body={zh ? "购买积分或开始生成后，每一笔变动都会记在这里。" : "Every purchase and generation will be listed here."}
            actions={[{ label: zh ? "去生成" : "Start creating", href: href("/ai/video"), primary: true }]}
          />
        ) : (
          <div className="db-list" aria-label={zh ? "积分明细" : "Credit history"}>
            <div className="db-row db-row-head">
              <span />
              <span>{zh ? "类型" : "Type"}</span>
              <span>{zh ? "时间" : "Time"}</span>
              <span className="db-num">{zh ? "变动" : "Change"}</span>
              <span className="db-num">{zh ? "变动后余额" : "Balance after"}</span>
            </div>
            {transactions.map((item) => {
              const kind = creditKind(item.transType);
              const Icon = KIND_ICON[kind];
              const note = describeRemark(item.remark, zh);
              return (
                <div key={item.id} className="db-row">
                  <span className="db-row-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="db-row-main">
                    <span className="db-row-title">{creditKindLabel(kind, zh)}</span>
                    {note ? <span className="db-row-note">{note}</span> : null}
                  </span>
                  <span className="db-row-time">{formatDate(item.createdAt)}</span>
                  <span className={`db-num ${item.credits > 0 ? "db-plus" : item.credits < 0 ? "db-minus" : "db-muted"}`}>
                    {item.credits > 0 ? "+" : ""}
                    {n(item.credits)}
                  </span>
                  <span className="db-num db-muted">{n(item.balanceAfter)}</span>
                </div>
              );
            })}
          </div>
        )}
        {hasMore ? (
          <button type="button" className="db-btn db-more" onClick={() => fetchNextPage()}>
            {zh ? "加载更多" : "Load more"}
          </button>
        ) : null}
      </section>

      {/* Credit packages: where credits came from and when they expire */}
      <section className="db-section" aria-labelledby="db-packs">
        <div className="db-section-head">
          <h2 id="db-packs" className="db-h2">{zh ? "积分包" : "Credit packages"}</h2>
          <span className="db-muted">{zh ? "先到期的积分先使用" : "Credits closest to expiry are used first"}</span>
        </div>
        {billing.isLoading && billing.invoices.length === 0 ? (
          <GridSkeleton count={1} height={120} />
        ) : billing.invoices.length === 0 ? (
          <StateBlock
            framed
            icon={Receipt}
            title={zh ? "还没有积分包" : "No credit packages yet"}
            body={zh ? "注册赠送、订阅套餐或购买积分包后，会在这里显示余量和到期时间。" : "Welcome credits, plans and packs show here with what is left and when they expire."}
            actions={[{ label: zh ? "查看套餐" : "See plans", href: href("/pricing") }]}
          />
        ) : (
          <div className="db-list" aria-label={zh ? "积分包" : "Credit packages"}>
            <div className="db-row db-row-head">
              <span />
              <span>{zh ? "来源" : "Source"}</span>
              <span>{zh ? "到期时间" : "Expires"}</span>
              <span className="db-num">{zh ? "剩余 / 总量" : "Left / total"}</span>
              <span className="db-num">{zh ? "状态" : "Status"}</span>
            </div>
            {billing.invoices.map((invoice) => {
              const pack = invoice.credits;
              const kind = creditKind(pack?.transType ?? "order_pay");
              const Icon = KIND_ICON[kind];
              const expired = pack?.status === "expired" || (pack?.expiredAt ? new Date(pack.expiredAt).getTime() < Date.now() : false);
              const status = expired ? "expired" : pack?.status === "depleted" || pack?.remaining === 0 ? "depleted" : "active";
              return (
                <div key={invoice.id} className="db-row">
                  <span className="db-row-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="db-row-main">
                    <span className="db-row-title">{creditKindLabel(kind, zh)}</span>
                    <span className="db-row-note">{zh ? `获得于 ${formatDate(invoice.createdAt)}` : `Received ${formatDate(invoice.createdAt)}`}</span>
                  </span>
                  <span className="db-row-time">{pack?.expiredAt ? formatDate(pack.expiredAt) : zh ? "长期有效" : "Never"}</span>
                  <span className="db-num">
                    {n(pack?.remaining)} <span className="db-muted">/ {n(pack?.initial ?? invoice.items[0]?.quantity)}</span>
                  </span>
                  <span className="db-num">
                    <span className={status === "active" ? "db-pill db-pill-ok" : "db-pill"}>
                      {status === "active" ? (zh ? "有效" : "Active") : status === "expired" ? (zh ? "已过期" : "Expired") : zh ? "已用完" : "Used up"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
