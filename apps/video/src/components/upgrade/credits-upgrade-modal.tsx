"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Tabs from "@radix-ui/react-tabs";
import { Check, Coins, Minus } from "lucide-react";

import { FIRST_MONTH_OFFER, REFUND_POLICY } from "@/config/pricing-user";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { localizedHref } from "@/lib/locale-path";
import { usd } from "@/lib/pricing-offers";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";
import {
  UPGRADE_TABS,
  checkoutErrorMessage,
  creditsNeededLine,
  creditsShortfall,
  defaultOptionId,
  maxYearlySavingPercent,
  upgradeOptions,
  type UpgradeOption,
  type UpgradeTab,
} from "@/lib/upgrade-options";
import { useFirstPurchase } from "@/hooks/use-first-purchase";
import { useCreditsStore } from "@/stores/credits-store";
import "./credits-upgrade-modal.css";

const TIER_NAMES = { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as const;
const num = (value: number) => value.toLocaleString("en-US");

/**
 * The dialog a studio opens when a generation costs more credits than the
 * account has: yearly plans, monthly plans or one-off packs, what the selected
 * one includes, and one button into checkout. Mounted once in ModalProvider and
 * opened through useUpgradeModal.
 */
export function CreditsUpgradeModal({ lang }: { lang: string }) {
  const isOpen = useUpgradeModal((state) => state.isOpen);
  const closeModal = useUpgradeModal((state) => state.closeModal);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
    >
      <DialogContent className="cu-dialog">
        {/* Mounted per opening, so each one starts from the defaults. */}
        {isOpen ? <UpgradeBody lang={lang} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UpgradeBody({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const requiredCredits = useUpgradeModal((state) => state.requiredCredits);
  const closeModal = useUpgradeModal((state) => state.closeModal);
  const openSignIn = useSigninModal((state) => state.onOpenWithRedirect);
  const balance = useCreditsStore((state) => state.balance);
  // The stored balance can be from before the failed generation (or from an
  // earlier session), so it is shown only after a fetch made for this opening.
  const [balanceFresh, setBalanceFresh] = useState(false);
  const [tab, setTab] = useState<UpgradeTab>("year");
  const [picked, setPicked] = useState<Partial<Record<UpgradeTab, string>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const store = useCreditsStore.getState();
    store.invalidate();
    void store.fetchBalance().then(() => {
      if (live) setBalanceFresh(useCreditsStore.getState().error === null);
    });
    return () => {
      live = false;
    };
  }, []);

  const available = balanceFresh && balance ? Math.max(0, balance.availableCredits) : null;
  const shortfall = creditsShortfall(requiredCredits, available);
  const firstPurchase = useFirstPurchase();
  const options = useMemo(() => upgradeOptions(tab, firstPurchase === true), [tab, firstPurchase]);
  const selectedId = picked[tab] ?? defaultOptionId(tab, shortfall);
  const selected = options.find((option) => option.id === selectedId) ?? options[0];
  const yearlySaving = useMemo(() => maxYearlySavingPercent(), []);
  const firstMonthShown = tab === "month" && options.some((option) => option.firstMonthUsd !== null);

  const copy = zh
    ? {
        title: "获取更多积分",
        sub: "选一个套餐或积分包，接着把这条内容做出来。",
        tabs: { year: "年付", month: "月付", pack: "积分包" } as Record<UpgradeTab, string>,
        tabsLabel: "购买方式",
        save: (n: number) => `最高省 ${n}%`,
        optionsLabel: { year: "年付套餐", month: "月付套餐", pack: "积分包" } as Record<UpgradeTab, string>,
        popular: "最受欢迎",
        creditsPerMonth: (n: number) => `${num(n)} 积分/月`,
        credits: (n: number) => `${num(n)} 积分`,
        perMonth: "/月",
        was: "月付价",
        paidToday: (price: string) => `今天支付 ${price}，每年续费`,
        billedMonthly: "按月计费，可随时取消",
        firstMonth: (first: string, then: string) => `首月 ${first}，之后 ${then}/月`,
        firstOnly: "首次订阅专享",
        firstNote: `首月${FIRST_MONTH_OFFER.percentOff === 50 ? "半价" : "优惠"}仅限从未付过款的账号；是否符合条件在结账时确认，结账页显示的金额就是实际扣款。`,
        oneOff: "一次性",
        packMakes: (a: string, b: string) => `约可做 ${a} / ${b}`,
        clip: (count: number, name: string) => `${num(count)} 条 ${name}`,
        perksTitle: (name: string) => `${name} 包含`,
        perkYearCredits: (total: number, monthly: number) => `${num(total)} 积分一次到账，折合每月 ${num(monthly)}`,
        perkMonthCredits: (n: number) => `每月 ${num(n)} 积分`,
        perkPackCredits: (n: number) => `${num(n)} 积分，一次性购买，不自动续费`,
        perkValid: (days: number) => `积分 ${days} 天内有效`,
        perkMakes: (count: number, name: string, monthly: boolean) => `${monthly ? "每月约" : "约"}可生成 ${num(count)} 条 ${name}`,
        perkConcurrency: (n: number) => `同时生成 ${n} 个视频`,
        perkPriority: "优先排队",
        perkModels: "全部视频、图片和音频模型",
        perkCommercial: "成片无水印，可商用",
        perkRefund: "生成失败自动退回积分",
        cta: "去支付",
        redirecting: "正在跳转…",
        fine: `随时取消 · 未使用积分 ${REFUND_POLICY.days} 天内可退`,
        fullPricing: "查看完整定价",
        close: "关闭",
      }
    : {
        title: "Get more credits",
        sub: "Pick a plan or a credit pack and finish what you were making.",
        tabs: { year: "Yearly", month: "Monthly", pack: "Credit packs" } as Record<UpgradeTab, string>,
        tabsLabel: "How to buy",
        save: (n: number) => `Save up to ${n}%`,
        optionsLabel: { year: "Yearly plans", month: "Monthly plans", pack: "Credit packs" } as Record<UpgradeTab, string>,
        popular: "Most popular",
        creditsPerMonth: (n: number) => `${num(n)} credits/mo`,
        credits: (n: number) => `${num(n)} credits`,
        perMonth: "/mo",
        was: "Monthly price",
        paidToday: (price: string) => `${price} charged today, renews yearly`,
        billedMonthly: "Billed monthly, cancel anytime",
        firstMonth: (first: string, then: string) => `First month ${first}, then ${then}/mo`,
        firstOnly: "First subscription only",
        firstNote: "The first-month price is for accounts that have never paid. Eligibility is checked at checkout, and the amount shown there is what you pay.",
        oneOff: "one-time",
        packMakes: (a: string, b: string) => `About ${a} / ${b}`,
        clip: (count: number, name: string) => `${num(count)} ${name} clips`,
        perksTitle: (name: string) => `${name} includes`,
        perkYearCredits: (total: number, monthly: number) => `${num(total)} credits up front, ${num(monthly)} a month`,
        perkMonthCredits: (n: number) => `${num(n)} credits every month`,
        perkPackCredits: (n: number) => `${num(n)} credits, paid once, no renewal`,
        perkValid: (days: number) => `Credits last ${days} days`,
        perkMakes: (count: number, name: string, monthly: boolean) => `About ${num(count)} ${name} clips${monthly ? " a month" : ""}`,
        perkConcurrency: (n: number) => (n === 1 ? "1 video generating at a time" : `${n} videos generating at once`),
        perkPriority: "Priority queue",
        perkModels: "Every video, image and audio model",
        perkCommercial: "No watermark, commercial use",
        perkRefund: "Credits back when a generation fails",
        cta: "Continue to checkout",
        redirecting: "Redirecting…",
        fine: `Cancel anytime · ${REFUND_POLICY.days}-day refund on unused credits`,
        fullPricing: "See full pricing",
        close: "Close",
      };

  const nameOf = (option: UpgradeOption) => (option.tier ? TIER_NAMES[option.tier] : copy.credits(option.credits));
  const needed = creditsNeededLine(requiredCredits, available, zh);

  const pay = async () => {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const result = await startStripeCheckout(selected.id);
      // On success the browser is already leaving for checkout.
      if (result.ok) return;
      if (result.error === "unauthorized") {
        closeModal();
        openSignIn(`${window.location.pathname}${window.location.search}`);
        return;
      }
      setError(checkoutErrorMessage(result.error, zh));
    } catch {
      setError(checkoutErrorMessage("network", zh));
    }
    setPending(false);
  };

  const perks: { text: string; note?: string; off?: boolean }[] = [];
  if (selected.tab === "year") perks.push({ text: copy.perkYearCredits(selected.credits, selected.creditsPerMonth ?? 0) });
  else if (selected.tab === "month") perks.push({ text: copy.perkMonthCredits(selected.credits) });
  else perks.push({ text: copy.perkPackCredits(selected.credits) });
  if (selected.validDays !== null) perks.push({ text: copy.perkValid(selected.validDays) });
  for (const estimate of selected.estimates) {
    perks.push({ text: copy.perkMakes(estimate.count, estimate.name, selected.tab !== "pack"), note: estimate.spec[zh ? "zh" : "en"] });
  }
  if (selected.concurrency !== null) perks.push({ text: copy.perkConcurrency(selected.concurrency) });
  // Shown only for a plan that really has it; no plan does until a priority queue exists.
  if (selected.priorityQueue) perks.push({ text: copy.perkPriority });
  perks.push({ text: copy.perkModels }, { text: copy.perkCommercial }, { text: copy.perkRefund });

  return (
    <Tabs.Root
      className="cu"
      value={tab}
      onValueChange={(value) => {
        setTab(value as UpgradeTab);
        setError(null);
      }}
    >
      <header className="cu-head">
        <DialogTitle className="cu-title">{copy.title}</DialogTitle>
        <DialogDescription className="cu-sub">{needed ?? copy.sub}</DialogDescription>
        <Tabs.List className="cu-tabs" aria-label={copy.tabsLabel}>
          {UPGRADE_TABS.map((value) => (
            <Tabs.Trigger key={value} value={value} className="cu-tab" disabled={pending}>
              {copy.tabs[value]}
              {value === "year" && yearlySaving > 0 ? <span className="cu-tab-save">{copy.save(yearlySaving)}</span> : null}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </header>

      <div className="cu-body">
        <Tabs.Content value={tab} className="cu-pick">
          <RadioGroup.Root
            className="cu-options"
            aria-label={copy.optionsLabel[tab]}
            value={selected.id}
            onValueChange={(id) => {
              setPicked((current) => ({ ...current, [tab]: id }));
              setError(null);
            }}
            disabled={pending}
          >
            {options.map((option) => {
              const featured = option.tier !== null && option.popular;
              return (
                <RadioGroup.Item key={option.id} value={option.id} className={featured ? "cu-opt cu-opt-featured" : "cu-opt"}>
                  <span className="cu-radio" aria-hidden="true" />
                  <span className="cu-opt-main">
                    <span className="cu-opt-name">
                      {nameOf(option)}
                      {featured ? <span className="cu-tag">{copy.popular}</span> : null}
                      {option.savingPercent > 0 ? <span className="cu-tag cu-tag-save">-{option.savingPercent}%</span> : null}
                    </span>
                    {option.creditsPerMonth !== null ? <span className="cu-opt-credits">{copy.creditsPerMonth(option.creditsPerMonth)}</span> : null}
                    {option.tab === "year" ? <span className="cu-opt-note cu-opt-note-strong">{copy.paidToday(usd(option.chargedTodayUsd))}</span> : null}
                    {option.tab === "month" ? (
                      option.firstMonthUsd !== null ? (
                        <span className="cu-opt-note cu-opt-note-strong">
                          {copy.firstMonth(usd(option.firstMonthUsd), usd(option.chargedTodayUsd))}
                          <span className="cu-opt-first">{copy.firstOnly}</span>
                        </span>
                      ) : (
                        <span className="cu-opt-note">{copy.billedMonthly}</span>
                      )
                    ) : null}
                    {option.tab === "pack" ? (
                      <span className="cu-opt-note">
                        {copy.packMakes(
                          copy.clip(option.estimates[0].count, option.estimates[0].name),
                          copy.clip(option.estimates[1].count, option.estimates[1].name),
                        )}
                      </span>
                    ) : null}
                  </span>
                  <span className="cu-opt-price">
                    {option.wasPerMonthUsd !== null ? (
                      <s className="cu-price-was">
                        <span className="sr-only">{copy.was} </span>
                        {usd(option.wasPerMonthUsd)}
                      </s>
                    ) : null}
                    <span className="cu-price-now">
                      <strong>{usd(option.perMonthUsd ?? option.chargedTodayUsd)}</strong>
                      <span className="cu-price-unit">{option.perMonthUsd !== null ? copy.perMonth : ` ${copy.oneOff}`}</span>
                    </span>
                  </span>
                </RadioGroup.Item>
              );
            })}
          </RadioGroup.Root>
          {firstMonthShown ? <p className="cu-fine cu-first-note">{copy.firstNote}</p> : null}
        </Tabs.Content>

        <section className="cu-perks" aria-live="polite">
          <h3 className="cu-perks-title">
            <Coins className="h-4 w-4" aria-hidden="true" />
            {copy.perksTitle(selected.tier ? TIER_NAMES[selected.tier] : copy.credits(selected.credits))}
          </h3>
          <ul className="cu-perks-list">
            {perks.map((perk) => (
              <li key={perk.text} className={perk.off ? "cu-perk cu-perk-off" : "cu-perk"}>
                {perk.off ? <Minus className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                <span>
                  {perk.text}
                  {perk.note ? <span className="cu-perk-note">{perk.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="cu-foot">
        {error ? (
          <p className="cu-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="cu-foot-row">
          <div className="cu-foot-text">
            <p className="cu-fine">{copy.fine}</p>
            <Link href={localizedHref(lang, "/pricing")} className="cu-link" onClick={closeModal}>
              {copy.fullPricing}
            </Link>
          </div>
          <button type="button" className="cu-cta" onClick={() => void pay()} disabled={pending} aria-busy={pending}>
            {pending ? copy.redirecting : copy.cta}
          </button>
        </div>
      </footer>
    </Tabs.Root>
  );
}
