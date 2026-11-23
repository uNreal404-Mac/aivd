"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Calculator, Check, ChevronDown, Coins, Crown, Gift, Image as ImageIcon, Layers, Music, Package, Sparkles, Video, Zap } from "lucide-react";

import { CREDIT_EXPIRATION, LAUNCH_OFFER, NEW_USER_GIFT, REFUND_POLICY, isLaunchOfferActive } from "@/config/pricing-user";
import { useFirstPurchase } from "@/hooks/use-first-purchase";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { localizedHref } from "@/lib/du-home";
import {
  CARD_IMAGE_UNIT_ID,
  CARD_VIDEO_UNIT_IDS,
  FREE_VIDEO_UNIT_ID,
  type PaidTier,
  type PlanOffer,
  creditPriceUsd,
  generationsFor,
  packOffers,
  planOffers,
  pricingUnit,
  usd,
} from "@/lib/pricing-offers";
import { PRICING_UNITS as UNITS, type PricingKind as Kind } from "@/lib/pricing-units";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";
import { ScrollReveal } from "@/components/scroll-reveal";
import "./home-pricing.css";

type Period = "month" | "year";
const unit = (id: string) => UNITS.find((item) => item.id === id) ?? UNITS[0];

/** Extra credits to allow for takes that do not make the cut. */
const RETAKE_BUFFER = 0.25;

/**
 * Pricing block. The pricing page (`asPage`) shows all of it: the plans, a
 * free / pay-as-you-go strip for people not ready to subscribe, why aivd.ai,
 * the per-model table, the credit packs and a folded usage estimator, and its
 * buttons start checkout for the exact product shown (`checkout` set). The
 * homepage shows the three plans only and sends people to /pricing for the rest.
 *
 * Every figure comes from the pricing config through pricing-offers.ts; nothing
 * here states a price, a saving or a deadline that the config does not hold.
 */
export function HomePricing({
  lang,
  asPage = false,
  checkout,
}: {
  lang: string;
  /** Render the title as the page's h1. */
  asPage?: boolean;
  /** Buy in place. `enabled` is false when payments are not configured. */
  checkout?: { enabled: boolean };
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  // The first-month price is shown only once we know the account can get it.
  const firstPurchase = useFirstPurchase();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Monthly first: Basic at its list price and the Pro first-month price are
  // what a new visitor should see; yearly is one click away with its saving.
  const [period, setPeriod] = useState<Period>("month");
  const [videoModel, setVideoModel] = useState("veo-3.1");
  const [imageModel, setImageModel] = useState(CARD_IMAGE_UNIT_ID);
  const [videos, setVideos] = useState(15);
  const [images, setImages] = useState(40);
  const [retakes, setRetakes] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const plans = useMemo(() => planOffers(), []);
  const packs = useMemo(() => packOffers(), []);
  const maxSaving = Math.max(...plans.map((plan) => plan.yearlySavingPercent));
  const offerOn = isLaunchOfferActive();
  const basic = plans[0];
  const cheapestPack = packs.reduce((low, pack) => (pack.priceUsd < low.priceUsd ? pack : low), packs[0]);
  const packYears = Math.max(1, Math.round(CREDIT_EXPIRATION.purchaseDays / 365));
  const cardVideos = CARD_VIDEO_UNIT_IDS.map((id) => pricingUnit(id));
  const freeVideo = pricingUnit(FREE_VIDEO_UNIT_ID);

  // Estimator: credits a month for the chosen mix, and the smallest plan that covers it.
  const base = videos * unit(videoModel).credits + images * unit(imageModel).credits;
  const need = Math.ceil(base * (retakes ? 1 + RETAKE_BUFFER : 1));
  const recommended: PaidTier = plans.find((plan) => plan.creditsPerMonth >= need)?.tier ?? "ultimate";
  const overflow = Math.max(0, need - plans[plans.length - 1].creditsPerMonth);

  const credits = zh ? "积分" : "credits";
  const offerEnds = LAUNCH_OFFER.endsAt
    ? new Date(LAUNCH_OFFER.endsAt).toLocaleDateString(zh ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    : "";

  const copy = zh
    ? {
        kicker: "定价",
        title: "AI 视频生成器价格与套餐",
        homeTitle: "AI 视频生成器价格",
        homeNote: "想算得更细？定价页可以看每个套餐能生成多少、按月产量估算，还能不订阅单独买积分包。",
        sub: "一站调用 Veo 3.1、Kling 4.0、Seedance 2.5、Wan 2.6 等全部模型，成片无水印、可商用，生成失败自动退积分。",
        offer: (percent: number, date: string) => `开业优惠：首次购买积分包或年付，多送 ${percent}% 积分（年付按一个月的积分计），${date} 截止`,
        monthly: "月付",
        yearly: "年付",
        save: (n: number) => `最高省 ${n}% · 全年积分一次到账`,
        assure: (days: number) => `首次购买 ${days} 天内、积分未使用可全额退款`,
        names: { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as Record<PaidTier, string>,
        blurbs: { basic: "适合初次尝试 AI 创作", pro: "适合日常稳定产出", ultimate: "适合团队和大批量项目" } as Record<PaidTier, string>,
        popular: "最受欢迎",
        perMonth: "/月",
        payToday: (price: string) => `今天支付 ${price}，每年续费`,
        yearlySave: (amount: string, percent: number, months: number) => `省 ${amount}（${percent}%），相当于送 ${months} 个月`,
        billedMonthly: "按月计费，可随时取消",
        firstMonth: (first: string, then: string) => `首月 ${first}，之后 ${then}/月`,
        firstMonthNote: "首次订阅专享",
        cta: (name: string) => `开通 ${name}`,
        ctaSave: (amount: string) => `省 ${amount}`,
        creditsPerMonth: "积分/月",
        approx: (count: string, name: string) => `≈ ${count} 条 ${name} 视频/月`,
        creditsUpFront: (n: string) => `${n} 积分一次到账，全年可用`,
        per100: (price: string) => `100 积分 = ${price}`,
        makes: (count: string, name: string) => `约 ${count} 条 ${name}`,
        each: (price: string) => `每条 ${price}`,
        atOnce: (n: number) => `同时生成 ${n} 个视频`,
        priority: "优先排队",
        includes: ["全部视频、图片和音频模型"],
        trust: ["Stripe 安全支付", "支持 Visa / Mastercard 等银行卡", "随时取消", "生成失败自动退积分"],
        freeTitle: "还没决定？",
        freeBody: (n: number, model: string) => `免绑卡领 ${n} 积分，先免费生成 1 条 ${model}。`,
        freeCta: "免费生成一条",
        paygTitle: "不想订阅？",
        paygBody: (price: string, years: number) => `${price} 起买免订阅积分包，${years} 年有效。`,
        paygCta: "看积分包",
        whyTitle: "为什么选 aivd.ai",
        whyCols: ["", "aivd.ai", "其他多模型平台"],
        whyRows: (start: string, pack: string, years: number) => [
          ["起步月价", `${start}/月`, "常见 US$12–20/月"],
          ["模型权限", "每个套餐都能用全部模型", "部分平台把热门模型留给高档套餐"],
          ["免订阅积分包", `支持（${pack} 起，${years} 年有效）`, "部分平台仅限订阅用户购买"],
          ["价格与倒计时", "页面价就是结账价，没有倒计时", "部分平台的限时倒计时刷新后会重置"],
        ],
        whyNote: "其他平台的数据来自 2026 年 11 月对 38 家 AI 视频站公开定价页的逐页核验；起步月价按其中 19 家多模型平台统计，中位约 US$15。",
        estimatorToggle: "不确定选哪档？按你的月产量算一算",
        estimatorTitle: "每月要做多少内容？",
        estimatorSub: "拖动滑块，按你选的模型实时算出每月需要的积分。",
        videosLabel: "视频",
        imagesLabel: "图片",
        perVideo: "积分/条",
        perImage: "积分/张",
        retakes: `多算 ${Math.round(RETAKE_BUFFER * 100)}% 给重拍`,
        needLabel: "每月约需",
        fits: (name: string) => `推荐 ${name}`,
        overflow: (n: number) => `超出 ${n.toLocaleString()} 积分，可加购积分包`,
        compareTitle: "每个套餐能生成多少",
        compareSub: "按每次生成的积分计算，数字下面是这一档每条的价格；免费列是新用户赠送的积分。",
        model: "模型",
        free: "免费",
        perUse: "积分/次",
        showMore: "查看全部模型",
        showLess: "收起",
        kinds: { video: "视频", image: "图片", audio: "音频" } as Record<Kind, string>,
        packs: "免订阅积分包 · 按次付费",
        packsSub: (years: number) => `无需订阅 · ${years} 年有效 · 适合偶尔创作或临时加购`,
        packMakes: (a: number, an: string, b: number, bn: string) => `约 ${a} 条 ${an} 或 ${b} 条 ${bn}`,
        bestValue: "热门",
        bottomTitle: "从一条视频开始",
        bottomSub: "价格就是页面上写的这个价，没有会重置的倒计时。",
        viewPricing: "查看完整定价",
        comingSoon: "即将开放购买",
        redirecting: "正在跳转…",
        checkoutError: "暂时无法跳转到支付页面，请稍后再试。",
      }
    : {
        kicker: "PRICING",
        title: "AI Video Generator Pricing & Plans",
        homeTitle: "AI video generator pricing",
        homeNote: "Want the detail? The pricing page shows what each plan makes, estimates your month, and sells credit packs without a plan.",
        sub: "Veo 3.1, Kling 4.0, Seedance 2.5, Wan 2.6 and every other model in one place. No watermark, commercial use, and failed generations get their credits back.",
        offer: (percent: number, date: string) => `Launch offer: ${percent}% extra credits when your first purchase is a credit pack or a yearly plan, until ${date}. On yearly plans it is ${percent}% of one month's credits.`,
        monthly: "Monthly",
        yearly: "Yearly",
        save: (n: number) => `Save up to ${n}% · Full year of credits upfront`,
        assure: (days: number) => `Full refund within ${days} days of a first purchase if the credits are unused`,
        names: { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as Record<PaidTier, string>,
        blurbs: { basic: "For trying AI creation", pro: "For steady everyday output", ultimate: "For teams and big projects" } as Record<PaidTier, string>,
        popular: "Most popular",
        perMonth: "/mo",
        payToday: (price: string) => `Pay ${price} today, renews yearly`,
        yearlySave: (amount: string, percent: number, months: number) => `Save ${amount} (${percent}%), like ${months} months free`,
        billedMonthly: "Billed monthly, cancel anytime",
        firstMonth: (first: string, then: string) => `First month ${first}, then ${then}/mo`,
        firstMonthNote: "First subscription only",
        cta: (name: string) => `Get ${name}`,
        ctaSave: (amount: string) => `Save ${amount}`,
        creditsPerMonth: "credits/mo",
        approx: (count: string, name: string) => `≈ ${count} ${name} videos a month`,
        creditsUpFront: (n: string) => `All ${n} credits arrive today and last the year`,
        per100: (price: string) => `100 credits = ${price}`,
        makes: (count: string, name: string) => `About ${count} ${name} videos`,
        each: (price: string) => `${price} each`,
        atOnce: (n: number) => (n === 1 ? "1 video generating at a time" : `${n} videos generating at once`),
        priority: "Priority queue",
        includes: ["Every video, image and audio model"],
        trust: ["Secure checkout by Stripe", "Visa, Mastercard and other cards", "Cancel anytime", "Credits back on failed generations"],
        freeTitle: "Not sure yet?",
        freeBody: (n: number, model: string) => `Get ${n} free credits with no card and make one ${model} video first.`,
        freeCta: "Make one free",
        paygTitle: "Rather not subscribe?",
        paygBody: (price: string, years: number) => `Credit packs from ${price}, no subscription, valid for ${years} year${years === 1 ? "" : "s"}.`,
        paygCta: "See credit packs",
        whyTitle: "Why aivd.ai",
        whyCols: ["", "aivd.ai", "Other multi-model platforms"],
        whyRows: (start: string, pack: string, years: number) => [
          ["Starting price", `${start}/mo`, "Usually US$12–20/mo"],
          ["Model access", "Every model on every plan", "Some keep popular models for higher tiers"],
          ["Credits without a plan", `Yes, from ${pack}, valid ${years} year${years === 1 ? "" : "s"}`, "Some sell packs to subscribers only"],
          ["Price and timers", "The page price is the checkout price; no countdown", "Some run countdowns that restart on refresh"],
        ],
        whyNote: "Other platforms: public pricing pages of 38 AI video sites checked one by one in November 2026; the starting price is from the 19 multi-model platforms among them (median about US$15).",
        estimatorToggle: "Not sure which plan? Work it out from your monthly output",
        estimatorTitle: "How much will you make each month?",
        estimatorSub: "Drag the sliders and see the credits your mix needs.",
        videosLabel: "Videos",
        imagesLabel: "Images",
        perVideo: "credits each",
        perImage: "credits each",
        retakes: `Add ${Math.round(RETAKE_BUFFER * 100)}% for retakes`,
        needLabel: "You need about",
        fits: (name: string) => `We suggest ${name}`,
        overflow: (n: number) => `${n.toLocaleString()} credits over; add a credit pack`,
        compareTitle: "What each plan makes",
        compareSub: "Counted from the credits per generation, with what one costs on that plan. Free is the new-account gift.",
        model: "Model",
        free: "Free",
        perUse: "credits each",
        showMore: "Show every model",
        showLess: "Show less",
        kinds: { video: "Video", image: "Image", audio: "Audio" } as Record<Kind, string>,
        packs: "Pay-As-You-Go Credit Packs",
        packsSub: (years: number) => `No subscription · Credits last ${years} year${years === 1 ? "" : "s"} · For occasional projects or a quick top-up`,
        packMakes: (a: number, an: string, b: number, bn: string) => `About ${a} ${an} or ${b} ${bn} clips`,
        bestValue: "Popular",
        bottomTitle: "Start with one video",
        bottomSub: "The price on this page is the price you pay. No countdown that resets.",
        viewPricing: "See full pricing",
        comingSoon: "Coming soon",
        redirecting: "Redirecting…",
        checkoutError: "We could not open checkout. Please try again.",
      };

  const href = (path: string) => localizedHref(lang, path);
  const idFor = (plan: PlanOffer) => (period === "year" ? plan.yearlyId : plan.monthlyId);

  const buy = async (productId: string) => {
    if (!checkout?.enabled || pendingId) return;
    setCheckoutError(null);
    setPendingId(productId);
    try {
      const result = await startStripeCheckout(productId, { returnTo: new URLSearchParams(window.location.search).get("returnTo") });
      if (!result.ok) {
        // Signed-out buyers sign in and come back here; anything else gets a plain sentence.
        if (result.error === "unauthorized") signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
        else setCheckoutError(copy.checkoutError);
      }
    } catch {
      setCheckoutError(copy.checkoutError);
    }
    setPendingId(null);
  };

  /** A plan or pack button: checkout on the pricing page, a link elsewhere. */
  const action = ({ productId, label, className, extra }: { productId: string; label: string; className: string; extra?: React.ReactNode }) =>
    checkout ? (
      <button type="button" className={className} disabled={!checkout.enabled || pendingId !== null} onClick={() => void buy(productId)}>
        {!checkout.enabled ? copy.comingSoon : pendingId === productId ? copy.redirecting : label}
        {checkout.enabled && pendingId !== productId ? extra : null}
      </button>
    ) : (
      <Link href={href("/pricing")} className={className}>
        {label}
        {extra}
      </Link>
    );

  const visibleUnits = (kind: Kind) => UNITS.filter((item) => item.kind === kind).slice(0, showAll ? undefined : kind === "audio" ? 1 : 3);
  const dots = 40;
  const filled = Math.min(dots, Math.round((need / (plans.find((plan) => plan.tier === recommended)?.creditsPerMonth ?? 1)) * dots));
  const headline = cardVideos[0];
  /** Only Pro, the plan we recommend, gets the solid accent button. */
  const ctaClass = (tier: PaidTier) => (tier === "pro" ? "hp-cta hp-cta-accent" : "hp-cta hp-cta-outline");

  return (
    <section className={asPage ? "hp hp-page" : "hp"} aria-labelledby="hp-title">
      <ScrollReveal />
      <div className="hp-head">
        <p className="hp-kicker">{copy.kicker}</p>
        {asPage ? (
          <h1 id="hp-title" className="hp-title">{copy.title}</h1>
        ) : (
          <h2 id="hp-title" className="hp-title">{copy.homeTitle}</h2>
        )}
        <p className="hp-sub">{copy.sub}</p>
        {checkout && !checkout.enabled ? <p className="hp-note">{copy.comingSoon}</p> : null}
        <div className="hp-toggle-wrap">
          <fieldset className="hp-toggle">
            <legend className="sr-only">{zh ? "计费周期" : "Billing period"}</legend>
            <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>
              {copy.monthly}
            </button>
            <button type="button" aria-pressed={period === "year"} onClick={() => setPeriod("year")}>
              {copy.yearly}
            </button>
          </fieldset>
          <span className="hp-toggle-save">{copy.save(maxSaving)}</span>
          <p className="hp-assure">{copy.assure(REFUND_POLICY.days)}</p>
        </div>
      </div>

      {offerOn ? (
        <p className="hp-offer">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {copy.offer(LAUNCH_OFFER.bonusPercent, offerEnds)}
        </p>
      ) : null}

      {/* Plan cards */}
      <div className="hp-plans">
        {plans.map((plan) => {
          const name = copy.names[plan.tier];
          const perCredit = creditPriceUsd(plan, period);
          const firstMonth = period === "month" && firstPurchase === true && plan.firstMonthPriceUsd !== null ? plan.firstMonthPriceUsd : null;
          return (
            <article key={plan.tier} className={`hp-plan hp-plan-${plan.tier}${plan.popular ? " hp-plan-pick hp-plan-popular" : ""}`}>
              <div className="hp-plan-top" data-tilt>
                <div className="hp-plan-name">
                  {name}
                  {plan.popular ? (
                    <span className="hp-pill">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.popular}
                    </span>
                  ) : null}
                </div>
                <p className="hp-plan-blurb">{copy.blurbs[plan.tier]}</p>
                <p className="hp-price">
                  {period === "year" ? <s className="hp-price-was">{usd(plan.monthlyPriceUsd)}</s> : null}
                  <span className="hp-price-now">{usd(period === "year" ? plan.yearlyPerMonthUsd : plan.monthlyPriceUsd)}</span>
                  <span className="hp-price-unit">{copy.perMonth}</span>
                </p>
                <div className="hp-billing-area">
                  {period === "year" ? (
                    <>
                      <p className="hp-billing hp-billing-strong">{copy.payToday(usd(plan.yearlyPriceUsd))}</p>
                      <p className="hp-billing hp-billing-save">{copy.yearlySave(usd(plan.yearlySavingUsd), plan.yearlySavingPercent, plan.yearlyMonthsFree)}</p>
                    </>
                  ) : firstMonth !== null ? (
                    <>
                      <p className="hp-billing hp-billing-strong">{copy.firstMonth(usd(firstMonth), usd(plan.monthlyPriceUsd))}</p>
                      <p className="hp-billing">{copy.firstMonthNote} · {copy.billedMonthly}</p>
                    </>
                  ) : (
                    <p className="hp-billing">{copy.billedMonthly}</p>
                  )}
                </div>
                {action({
                  productId: idFor(plan),
                  label: copy.cta(name),
                  className: ctaClass(plan.tier),
                  extra: period === "year" && plan.yearlySavingUsd > 0 ? <span className="hp-cta-save">{copy.ctaSave(usd(plan.yearlySavingUsd))}</span> : null,
                })}
              </div>
              <div className="hp-plan-body">
                <div>
                  <p className="hp-credits">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    <strong>{plan.creditsPerMonth.toLocaleString()}</strong> {copy.creditsPerMonth}
                    <span className="hp-unit-price">{copy.per100(usd(perCredit * 100, 2))}</span>
                  </p>
                  <p className="hp-approx">{copy.approx(generationsFor(plan.creditsPerMonth, freeVideo.credits).toLocaleString(), freeVideo.name)}</p>
                  {period === "year" ? <p className="hp-upfront">{copy.creditsUpFront(plan.creditsPerYear.toLocaleString())}</p> : null}
                </div>
                <ul className="hp-tree">
                  {cardVideos.map((item) => (
                    <li key={item.id}>
                      <Makes text={copy.makes("\u0000", item.name)} count={generationsFor(plan.creditsPerMonth, item.credits).toLocaleString()} />
                      <span>
                        {item.spec[zh ? "zh" : "en"]} · {copy.each(usd(item.credits * perCredit, 2))}
                      </span>
                    </li>
                  ))}
                </ul>
                <ul className="hp-includes">
                  <li>
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    {copy.atOnce(plan.concurrency)}
                  </li>
                  {plan.priorityQueue ? (
                    <li>
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      {copy.priority}
                    </li>
                  ) : null}
                  {copy.includes.map((item) => (
                    <li key={item}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      {/* What stands behind every plan, in one quiet line. */}
      <ul className="hp-trust">
        {copy.trust.map((item) => (
          <li key={item}>
            <Check aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>

      {checkoutError ? (
        <output className="hp-error" aria-live="polite">
          {checkoutError}
        </output>
      ) : null}

      {/* The homepage stops at the plans. */}
      {asPage ? null : (
        <div className="hp-home-more">
          <p className="hp-sub-sm">{copy.homeNote}</p>
          <Link href={href("/pricing")} className="hp-cta hp-cta-ghost">
            {copy.viewPricing}
          </Link>
        </div>
      )}

      {/* Two ways in for people not ready to subscribe: the free credits, or a pack. */}
      {asPage ? (
        <div className="hp-split">
          <div className="hp-split-card">
            <Gift className="hp-split-icon" aria-hidden="true" />
            <div>
              <p className="hp-split-title">{copy.freeTitle}</p>
              <p className="hp-sub-sm">{copy.freeBody(NEW_USER_GIFT.credits, freeVideo.name)}</p>
            </div>
            <Link href={href("/video")} className="hp-cta hp-cta-outline">
              {copy.freeCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="hp-split-card">
            <Package className="hp-split-icon" aria-hidden="true" />
            <div>
              <p className="hp-split-title">{copy.paygTitle}</p>
              <p className="hp-sub-sm">{copy.paygBody(usd(cheapestPack.priceUsd), packYears)}</p>
            </div>
            <a href="#packs" className="hp-cta hp-cta-outline">
              {copy.paygCta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}

      {/* Why aivd.ai: only differences we have checked on other sites' pricing pages. */}
      {asPage ? (
        <div className="hp-why">
          <h2 className="hp-h3">{copy.whyTitle}</h2>
          <div className="hp-why-scroll">
            <table className="hp-why-table">
              <thead>
                <tr>
                  {copy.whyCols.map((col, index) =>
                    index === 0 ? (
                      <td key="corner" />
                    ) : (
                      <th key={col} scope="col" className={index === 1 ? "hp-why-us" : undefined}>
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {copy.whyRows(usd(basic.monthlyPriceUsd), usd(cheapestPack.priceUsd), packYears).map(([label, us, others]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td className="hp-why-us">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {us}
                    </td>
                    <td>{others}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hp-why-note">{copy.whyNote}</p>
        </div>
      ) : null}

      {/* Comparison table */}
      {asPage ? (
      <div className="hp-compare">
        <div className="hp-compare-head">
          <div>
            <h2 className="hp-h3">{copy.compareTitle}</h2>
            <p className="hp-sub-sm">{copy.compareSub}</p>
          </div>
        </div>
        <div className="hp-table-scroll">
        <table className="hp-table">
          <thead>
            <tr>
              <th scope="col">{copy.model}</th>
              <th scope="col" className="hp-col-free">{copy.free}</th>
              {plans.map((plan) => (
                <th key={plan.tier} scope="col" className={plan.popular ? "hp-col-pick" : undefined}>
                  <span className="hp-th-name">{copy.names[plan.tier]}</span>
                  <span className="hp-th-price">
                    {usd(period === "year" ? plan.yearlyPerMonthUsd : plan.monthlyPriceUsd)}
                    {copy.perMonth}
                  </span>
                  {action({ productId: idFor(plan), label: copy.cta(copy.names[plan.tier]), className: plan.popular ? "hp-th-cta hp-th-cta-pick" : "hp-th-cta" })}
                </th>
              ))}
            </tr>
          </thead>
          {(["video", "image", "audio"] as Kind[]).map((kind) => (
            <tbody key={kind}>
              <tr className="hp-table-group">
                <th scope="rowgroup" colSpan={2 + plans.length}>
                  {kind === "video" ? <Video className="h-4 w-4" aria-hidden="true" /> : kind === "image" ? <ImageIcon className="h-4 w-4" aria-hidden="true" /> : <Music className="h-4 w-4" aria-hidden="true" />}
                  {copy.kinds[kind]}
                </th>
              </tr>
              {visibleUnits(kind).map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span className="hp-row-name">{item.name}</span>
                    <span className="hp-row-spec">
                      {item.spec[zh ? "zh" : "en"]} · {item.credits} {copy.perUse}
                    </span>
                  </th>
                  <td className="hp-col-free">{generationsFor(NEW_USER_GIFT.credits, item.credits) > 0 ? generationsFor(NEW_USER_GIFT.credits, item.credits) : "—"}</td>
                  {plans.map((plan) => (
                    <td key={plan.tier} className={plan.popular ? "hp-col-pick" : undefined}>
                      <span className="hp-cell-count">{generationsFor(plan.creditsPerMonth, item.credits).toLocaleString()}</span>
                      <span className="hp-cell-price">{usd(item.credits * creditPriceUsd(plan, period), 2)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        </div>
        <button type="button" className="hp-more" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>
          {showAll ? copy.showLess : copy.showMore}
          <ChevronDown className={showAll ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden="true" />
        </button>
      </div>
      ) : null}

      {/* Credit packs: pay as you go, no subscription */}
      {asPage ? (
      <div className="hp-packs" id="packs">
        <div>
          <h2 className="hp-packs-title">{copy.packs}</h2>
          <p className="hp-sub-sm">{copy.packsSub(packYears)}</p>
        </div>
        <div className="hp-packs-list">
          {packs.map((pack) => {
            const body = (
              <PackBody
                key={pack.id}
                price={usd(pack.priceUsd)}
                badge={pack.popular ? copy.bestValue : null}
                credits={pendingId === pack.id ? copy.redirecting : `${pack.credits.toLocaleString()} ${credits}`}
                makes={copy.packMakes(generationsFor(pack.credits, headline.credits), headline.name, generationsFor(pack.credits, freeVideo.credits), freeVideo.name)}
                per100={copy.per100(usd(pack.per100Usd, 2))}
              />
            );
            return checkout ? (
              <button key={pack.id} type="button" className="hp-pack" disabled={!checkout.enabled || pendingId !== null} onClick={() => void buy(pack.id)}>
                {body}
              </button>
            ) : (
              <Link key={pack.id} href={href("/pricing")} className="hp-pack">
                {body}
              </Link>
            );
          })}
        </div>
      </div>
      ) : null}

      {/* Usage estimator, folded so it does not stand between the plans and the packs */}
      {asPage ? (
      <details className="hp-est-fold">
        <summary>
          <Calculator className="h-4 w-4" aria-hidden="true" />
          {copy.estimatorToggle}
          <ChevronDown className="hp-est-chevron h-4 w-4" aria-hidden="true" />
        </summary>
      <div className="hp-estimator" id="estimator">
        <div className="hp-est-left">
          <h2 className="hp-h3">{copy.estimatorTitle}</h2>
          <p className="hp-sub-sm">{copy.estimatorSub}</p>
          <div className="hp-slider">
            <div className="hp-slider-head">
              <span className="hp-slider-label">
                <Video className="h-4 w-4" aria-hidden="true" />
                {copy.videosLabel}
                <select value={videoModel} onChange={(event) => setVideoModel(event.target.value)} aria-label={zh ? "视频模型" : "Video model"}>
                  {UNITS.filter((item) => item.kind === "video").map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className="hp-slider-value">
                {videos} · {(videos * unit(videoModel).credits).toLocaleString()} {credits}
              </span>
            </div>
            <input type="range" min={0} max={200} step={5} value={videos} onChange={(event) => setVideos(Number(event.target.value))} aria-label={copy.videosLabel} />
            <span className="hp-slider-note">
              {unit(videoModel).spec[zh ? "zh" : "en"]} · {unit(videoModel).credits} {copy.perVideo}
            </span>
          </div>
          <div className="hp-slider">
            <div className="hp-slider-head">
              <span className="hp-slider-label">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                {copy.imagesLabel}
                <select value={imageModel} onChange={(event) => setImageModel(event.target.value)} aria-label={zh ? "图片模型" : "Image model"}>
                  {UNITS.filter((item) => item.kind === "image").map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </span>
              <span className="hp-slider-value">
                {images} · {(images * unit(imageModel).credits).toLocaleString()} {credits}
              </span>
            </div>
            <input type="range" min={0} max={1000} step={10} value={images} onChange={(event) => setImages(Number(event.target.value))} aria-label={copy.imagesLabel} />
            <span className="hp-slider-note">
              {unit(imageModel).spec[zh ? "zh" : "en"]} · {unit(imageModel).credits} {copy.perImage}
            </span>
          </div>
          <label className="hp-retakes">
            <input type="checkbox" checked={retakes} onChange={(event) => setRetakes(event.target.checked)} />
            {copy.retakes}
          </label>
        </div>
        <div className="hp-est-right">
          <p className="hp-need-label">{copy.needLabel}</p>
          <p className="hp-need">
            {need.toLocaleString()} <span>{zh ? "积分/月" : "credits/mo"}</span>
          </p>
          <div className="hp-dots" aria-hidden="true">
            {Array.from({ length: dots }, (_, index) => (
              <span key={index} data-on={index < filled || undefined} />
            ))}
          </div>
          <p className="hp-fit">
            <Crown className="h-4 w-4" aria-hidden="true" />
            {copy.fits(copy.names[recommended])}
          </p>
          {overflow > 0 ? <p className="hp-overflow">{copy.overflow(overflow)}</p> : null}
          {(() => {
            const pick = plans.find((plan) => plan.tier === recommended) ?? plans[0];
            return action({ productId: idFor(pick), label: copy.cta(copy.names[recommended]), className: `${ctaClass(recommended)} hp-cta-block` });
          })()}
        </div>
      </div>
      </details>
      ) : null}

      {/* Closing call to action */}
      {asPage ? (
        <div className="hp-bottom">
          <div>
            <p className="hp-h3">{copy.bottomTitle}</p>
            <p className="hp-sub-sm">{copy.bottomSub}</p>
          </div>
          <div className="hp-bottom-actions">
            {(() => {
              const pro = plans.find((plan) => plan.popular) ?? plans[1];
              return action({ productId: idFor(pro), label: copy.cta(copy.names[pro.tier]), className: ctaClass(pro.tier) });
            })()}
            <Link href={href("/video")} className="hp-cta hp-cta-outline">
              {copy.freeCta}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PackBody({ price, badge, credits, makes, per100 }: { price: string; badge: string | null; credits: string; makes: string; per100: string }) {
  return (
    <>
      <strong>
        {price}
        {badge ? <em>{badge}</em> : null}
      </strong>
      <span className="hp-pack-credits">{credits}</span>
      <span>{makes}</span>
      <span>{per100}</span>
    </>
  );
}

/** A sentence with its number set in bold; the copy marks the number's place with a NUL. */
function Makes({ text, count }: { text: string; count: string }) {
  const [before, after] = text.split("\u0000");
  return (
    <>
      {before}
      <strong>{count}</strong>
      {after}
    </>
  );
}
