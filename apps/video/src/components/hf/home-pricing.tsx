"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import {
  ArrowDown,
  ArrowRight,
  Calculator,
  Check,
  ChevronDown,
  Coins,
  Crown,
  Flame,
  Gift,
  Image as ImageIcon,
  Layers,
  Music,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  Zap,
} from "lucide-react";

import { ScrollReveal } from "@/components/scroll-reveal";
import {
  CREDIT_EXPIRATION,
  FIRST_MONTH_OFFER,
  LAUNCH_OFFER,
  NEW_USER_GIFT,
  REFUND_POLICY,
  isLaunchOfferActive,
} from "@/config/pricing-user";
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
import "./home-pricing.css";

type Period = "month" | "year";
type TableFilter = "all" | Kind;

const unit = (id: string) => UNITS.find((item) => item.id === id) ?? UNITS[0];

/** Extra credits to allow for takes that do not make the cut. */
const RETAKE_BUFFER = 0.25;

/**
 * High-conversion dark studio pricing block inspired by the top-converting
 * AI video leaders (Mitte.ai, Krea.ai, OpenArt.ai, Swagga.ai):
 * - Defaults to Annual billing (strikethrough monthly anchor + explicit savings)
 * - Value-first card anatomy: inset credit & output box ABOVE the price
 * - Clear 3-tier color identity: crisp white (Basic), electric sky-mint crown (Pro),
 *   warm champagne gold accent (Ultimate)
 * - High-contrast solid CTAs with attached savings bar underneath
 * - Honest tier differentiation (concurrency & unit credit discount)
 *
 * Every price, credit count, saving and offer rule is computed live from
 * `pricing-user.ts` via `pricing-offers.ts`.
 */
export function HomePricing({
  lang,
  asPage = false,
  checkout,
}: {
  lang: string;
  /** Render the title as the page's h1 and show full pricing sections. */
  asPage?: boolean;
  /** Buy in place. `enabled` is false when payments are not configured. */
  checkout?: { enabled: boolean };
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const firstPurchase = useFirstPurchase();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Annual by default: matches 8/8 top-converting AI video & model-keyword sites,
  // surfacing discounted monthly-equivalent prices and upfront savings on first view.
  const [period, setPeriod] = useState<Period>("year");
  const periodRef = useSegmentIndicator<HTMLFieldSetElement>(period);
  const [tableFilter, setTableFilter] = useState<TableFilter>("all");
  const [showAll, setShowAll] = useState(false);

  // Estimator state (folded by default)
  const [videoModel, setVideoModel] = useState("veo-3.1");
  const [imageModel, setImageModel] = useState(CARD_IMAGE_UNIT_ID);
  const [videos, setVideos] = useState(15);
  const [images, setImages] = useState(40);
  const [retakes, setRetakes] = useState(true);

  const plans = useMemo(() => planOffers(), []);
  const packs = useMemo(() => packOffers(), []);
  const maxSaving = Math.max(...plans.map((plan) => plan.yearlySavingPercent));
  const offerOn = isLaunchOfferActive();
  const basicMonthlyPerCredit = creditPriceUsd(plans[0], "month");
  const cheapestPack = packs.reduce((low, pack) => (pack.priceUsd < low.priceUsd ? pack : low), packs[0]);
  const packYears = Math.max(1, Math.round(CREDIT_EXPIRATION.purchaseDays / 365));
  const seedanceUnit = pricingUnit(CARD_VIDEO_UNIT_IDS[0]);
  const klingUnit = pricingUnit(CARD_VIDEO_UNIT_IDS[1]);
  const freeVideo = pricingUnit(FREE_VIDEO_UNIT_ID);

  // Estimator math
  const base = videos * unit(videoModel).credits + images * unit(imageModel).credits;
  const need = Math.ceil(base * (retakes ? 1 + RETAKE_BUFFER : 1));
  const recommended: PaidTier = plans.find((plan) => plan.creditsPerMonth >= need)?.tier ?? "ultimate";
  const overflow = Math.max(0, need - plans[plans.length - 1].creditsPerMonth);

  const credits = zh ? "积分" : "credits";
  const offerEnds = LAUNCH_OFFER.endsAt
    ? new Date(LAUNCH_OFFER.endsAt).toLocaleDateString(zh ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";

  const copy = zh
    ? {
        eyebrow: "支持 Veo 3.1 · Kling 4.0 · Seedance 2.5 · Wan\u00A02.6",
        title: "选择适合你的 AI 视频套餐",
        homeTitle: "选择适合你的 AI 视频套餐",
        sub: "一套积分畅用全部视频、图像与音频模型 · 成片无水印可商用 · 生成失败自动退积分",
        homeNote: "想查看每个模型具体扣多少积分，或不订阅直接购买积分包？",
        offer: (percent: number, date: string) =>
          `开业优惠：首次购买积分包或年付，额外赠送 ${percent}% 积分（年付按单月积分计），${date} 截止`,
        monthly: "按月付费",
        yearly: "按年付费",
        saveBadge: (n: number) => `立省 ${n}%`,
        packsJump: (price: string) => `免订阅积分包 ${price} 起`,
        names: { basic: "BASIC", pro: "PRO", ultimate: "ULTIMATE" } as Record<PaidTier, string>,
        ctaNames: { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as Record<PaidTier, string>,
        blurbs: {
          basic: "轻量试水与个人日常探索",
          pro: "创作者稳定周更的主力之选",
          ultimate: "高频产出、代理商与商业团队",
        } as Record<PaidTier, string>,
        proCrown: "最受欢迎 · 创作者首选",
        ultimateBadge: "团队优选",
        pctOff: (n: number) => `省 ${n}%`,
        firstMonthBadge: `首月省 ${FIRST_MONTH_OFFER.percentOff}%`,
        perMonth: "/月",
        billedYearly: (price: string) => `年付 ${price}`,
        billedMonthly: "按月计费",
        saveStripYearly: (amount: string, months: number) => `相比月付立省 ${amount}（相当于送 ${months} 个月）`,
        saveStripFirstMonth: (first: string, then: string) => `新客首月 ${first}，次月起 ${then}/月`,
        saveStripMonthly: "按月灵活续费 · 随时一键取消",
        cta: (name: string) => `立即开通 ${name}`,
        creditsPerMonth: "积分 / 月",
        rateLabel: "每 1,000 积分",
        rateStandard: (price: string) => `${price}（标准）`,
        rateSave: (price: string, pct: number) => `${price}（省 ${pct}%）`,
        veoOutput: (count: string, name: string) => `约 ${count} 条 ${name} 有声视频`,
        proOutput: (sCount: string, sName: string, kCount: string, kName: string) =>
          `约 ${sCount} 条 ${sName} 或 ${kCount} 条 ${kName}`,
        creditsUpFront: (n: string) => `一次到账 ${n} 积分 · 365 天有效`,
        atOnce: (n: number) => `同时生成 ${n} 个视频任务`,
        basicMissing: "多任务并行加速（Pro 起解锁 3–6 并发）",
        priority: "优先生成队列",
        features: [
          "畅用全部视频、图片与音频模型",
          "成片无水印 · 完整商业使用权",
          "生成失败自动秒退积分",
        ],
        trust: [
          "Stripe 安全加密支付",
          `首次购买 ${REFUND_POLICY.days} 天未用全额退`,
          "账户页随时一键取消",
          `新用户免绑卡送 ${NEW_USER_GIFT.credits} 积分`,
        ],
        freeTryCta: `免绑卡领 ${NEW_USER_GIFT.credits} 积分先试一条`,
        packsKicker: "PAY AS YOU GO · 无需订阅",
        packsTitle: "按次购买积分包",
        packsSub: (years: number) => `一次性付款 · ${years} 年有效 · 零自动续费 · 订阅不够用也可随时加购`,
        packNames: {
          "Trial Pack": "体验包",
          "Starter Pack": "入门包",
          "Standard Pack": "标准包",
          "Pro Pack": "大额包",
        } as Record<string, string>,
        packMakes: (veoCount: number, veoName: string, seedCount: number, seedName: string) =>
          seedCount > 0
            ? `约 ${veoCount} 条 ${veoName} / ${seedCount} 条 ${seedName.replace(" ", "\u00A0")}`
            : `约 ${veoCount} 条 ${veoName} 视频`,
        packBuy: "立即购买",
        bestValue: "热门",
        compareKicker: "TRANSPARENT RATES · 明码标价",
        compareTitle: "各模型积分消耗与可生成量",
        compareSub: "杜绝暗箱扣分：每个模型单次消耗清晰透明，数字下方为当前周期折合单条价格。",
        filters: { all: "全部", video: "视频", image: "图片", audio: "音频" } as Record<TableFilter, string>,
        model: "模型与规格",
        perUse: "积分/次",
        free: `免费 (${NEW_USER_GIFT.credits})`,
        showMore: "展开全部模型",
        showLess: "收起模型列表",
        kinds: { video: "视频模型", image: "图像模型", audio: "音频模型" } as Record<Kind, string>,
        estimatorToggle: "不确定选哪档？按你的月产量算一算",
        estimatorTitle: "按月产量估算积分",
        estimatorSub: "拖动滑块，实时算出最省钱的套餐档位。",
        videosLabel: "每月视频",
        imagesLabel: "每月图片",
        perVideo: "积分/条",
        perImage: "积分/张",
        retakes: `预留 ${Math.round(RETAKE_BUFFER * 100)}% 抽卡重拍余量`,
        needLabel: "预计每月需要",
        fits: (name: string) => `建议选择 ${name}`,
        overflow: (n: number) => `超出 ${n.toLocaleString()} 积分，可叠加积分包`,
        viewPricing: "查看完整定价与模型费率",
        comingSoon: "即将开放购买",
        redirecting: "正在跳转…",
        checkoutError: "暂时无法打开支付页面，请稍后再试。",
      }
    : {
        eyebrow: "INCLUDES VEO 3.1 · KLING 4.0 · SEEDANCE 2.5 · WAN 2.6",
        title: "AI Video Pricing & Plans",
        homeTitle: "AI Video Pricing & Plans",
        sub: "One credit balance for every video, image & audio model · No watermark · Commercial rights · Auto-refund on failures",
        homeNote: "Want exact per-model credit rates or one-time credit packs without a subscription?",
        offer: (percent: number, date: string) =>
          `Launch offer: ${percent}% extra credits on your first credit pack or yearly plan (based on 1 month of credits), until ${date}.`,
        monthly: "Monthly",
        yearly: "Annual",
        saveBadge: (n: number) => `SAVE ${n}%`,
        packsJump: (price: string) => `Credit packs from ${price}`,
        names: { basic: "BASIC", pro: "PRO", ultimate: "ULTIMATE" } as Record<PaidTier, string>,
        ctaNames: { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as Record<PaidTier, string>,
        blurbs: {
          basic: "For first clips and light creative testing",
          pro: "For creators publishing videos every week",
          ultimate: "For heavy output, agencies & client teams",
        } as Record<PaidTier, string>,
        proCrown: "Most Popular · Best for Creators",
        ultimateBadge: "BEST VALUE",
        pctOff: (n: number) => `${n}% OFF`,
        firstMonthBadge: `${FIRST_MONTH_OFFER.percentOff}% OFF 1ST MO`,
        perMonth: "/mo",
        billedYearly: (price: string) => `${price}/yr`,
        billedMonthly: "Billed monthly",
        saveStripYearly: (amount: string, months: number) => `Save ${amount} vs. monthly (~${months} months free)`,
        saveStripFirstMonth: (first: string, then: string) => `First month ${first}, then ${then}/mo`,
        saveStripMonthly: "Flexible monthly · Cancel anytime",
        cta: (name: string) => `Get ${name}`,
        creditsPerMonth: "credits / mo",
        rateLabel: "Per 1,000 credits",
        rateStandard: (price: string) => `${price} (std)`,
        rateSave: (price: string, pct: number) => `${price} (-${pct}%)`,
        veoOutput: (count: string, name: string) => `~${count} ${name} videos with sound`,
        proOutput: (sCount: string, sName: string, kCount: string, kName: string) =>
          `~${sCount} ${sName} or ${kCount} ${kName} clips`,
        creditsUpFront: (n: string) => `${n} credits upfront · 365 days`,
        atOnce: (n: number) => (n === 1 ? "1 concurrent video task" : `${n} concurrent video tasks`),
        basicMissing: "Parallel video speedup (3–6 concurrent on Pro+)",
        priority: "Priority generation queue",
        features: [
          "Every video, image & audio model unlocked",
          "No watermark · Full commercial rights",
          "Credits auto-refunded on failed runs",
        ],
        trust: [
          "Secure checkout by Stripe",
          `${REFUND_POLICY.days}-day refund if unused`,
          "One-click cancel in Account",
          `${NEW_USER_GIFT.credits} free credits, no card needed`,
        ],
        freeTryCta: `Try free with ${NEW_USER_GIFT.credits} credits`,
        packsKicker: "PAY AS YOU GO · NO SUBSCRIPTION",
        packsTitle: "One-Time Credit Packs",
        packsSub: (years: number) =>
          `Single payment · Valid ${years} year${years === 1 ? "" : "s"} · No auto-renewal · Top up anytime`,
        packNames: {
          "Trial Pack": "Trial Pack",
          "Starter Pack": "Starter Pack",
          "Standard Pack": "Standard Pack",
          "Pro Pack": "Pro Pack",
        } as Record<string, string>,
        packMakes: (veoCount: number, veoName: string, seedCount: number, seedName: string) =>
          seedCount > 0
            ? `~${veoCount} ${veoName} or ${seedCount} ${seedName}`
            : `~${veoCount} ${veoName} clips`,
        packBuy: "Buy pack",
        bestValue: "POPULAR",
        compareKicker: "TRANSPARENT RATES",
        compareTitle: "Credits per model & monthly output",
        compareSub: "No hidden deductions. Exact credit cost and effective per-clip price on each tier.",
        filters: { all: "All", video: "Video", image: "Image", audio: "Audio" } as Record<TableFilter, string>,
        model: "Model & spec",
        perUse: "cr / run",
        free: `Free (${NEW_USER_GIFT.credits})`,
        showMore: "Show all models",
        showLess: "Show fewer models",
        kinds: { video: "Video models", image: "Image models", audio: "Audio models" } as Record<Kind, string>,
        estimatorToggle: "Not sure which tier? Estimate from your monthly volume",
        estimatorTitle: "Monthly credit estimator",
        estimatorSub: "Slide your target output to find the best-value plan.",
        videosLabel: "Videos / mo",
        imagesLabel: "Images / mo",
        perVideo: "cr each",
        perImage: "cr each",
        retakes: `Include ${Math.round(RETAKE_BUFFER * 100)}% buffer for retakes`,
        needLabel: "Estimated need",
        fits: (name: string) => `Best fit: ${name}`,
        overflow: (n: number) => `${n.toLocaleString()} credits over — add a credit pack`,
        viewPricing: "See full pricing & model rates",
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
        if (result.error === "unauthorized") {
          signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
        } else {
          setCheckoutError(copy.checkoutError);
        }
      }
    } catch {
      setCheckoutError(copy.checkoutError);
    }
    setPendingId(null);
  };

  const action = ({
    productId,
    label,
    className,
  }: {
    productId: string;
    label: string;
    className: string;
  }) =>
    checkout ? (
      <button
        type="button"
        className={className}
        disabled={!checkout.enabled || pendingId !== null}
        onClick={() => void buy(productId)}
      >
        {!checkout.enabled ? copy.comingSoon : pendingId === productId ? copy.redirecting : label}
      </button>
    ) : (
      <Link href={href("/pricing")} className={className}>
        {label}
      </Link>
    );

  const visibleKinds: Kind[] = tableFilter === "all" ? ["video", "image", "audio"] : [tableFilter];
  const visibleUnits = (kind: Kind) => {
    const items = UNITS.filter((item) => item.kind === kind);
    if (showAll || tableFilter !== "all") return items;
    return items.slice(0, kind === "video" ? 3 : kind === "image" ? 2 : 1);
  };

  const dots = 32;
  const filled = Math.min(
    dots,
    Math.round((need / (plans.find((plan) => plan.tier === recommended)?.creditsPerMonth ?? 1)) * dots),
  );

  const ctaClass = (tier: PaidTier) =>
    tier === "pro"
      ? "hp-cta hp-cta-pro"
      : tier === "ultimate"
        ? "hp-cta hp-cta-ultimate"
        : "hp-cta hp-cta-white";

  return (
    <section className={asPage ? "hp hp-page" : "hp hp-home"} aria-labelledby="hp-title">
      <ScrollReveal />

      {/* 1. Centered Editorial Hero + Switch-Style Annual Toggle */}
      <header className="hp-hero">
        <p className="hp-eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{copy.eyebrow}</span>
        </p>

        {asPage ? (
          <h1 id="hp-title" className="hp-title">
            {copy.title}
          </h1>
        ) : (
          <h2 id="hp-title" className="hp-title">
            {copy.homeTitle}
          </h2>
        )}

        <p className="hp-sub">{copy.sub}</p>

        <div className="hp-controls">
          <fieldset ref={periodRef} className="hp-toggle du-seg">
            <legend className="sr-only">{zh ? "计费周期" : "Billing period"}</legend>
            <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>
              {copy.monthly}
            </button>
            <button type="button" aria-pressed={period === "year"} onClick={() => setPeriod("year")}>
              <span>{copy.yearly}</span>
              <span className="hp-toggle-save">{copy.saveBadge(maxSaving)}</span>
            </button>
          </fieldset>

          {asPage ? (
            <a href="#packs" className="hp-packs-jump">
              <span>{copy.packsJump(usd(cheapestPack.priceUsd))}</span>
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </header>

      {offerOn ? (
        <p className="hp-offer">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {copy.offer(LAUNCH_OFFER.bonusPercent, offerEnds)}
        </p>
      ) : null}

      {/* Flagship 3-Tier Cards: Value-First Anatomy (Mitte + Swagga + Krea + OpenArt) */}
      <div className="hp-tier-grid">
        {plans.map((plan) => {
          const perCredit = creditPriceUsd(plan, period);
          const rateDiscountPct = Math.round((1 - perCredit / basicMonthlyPerCredit) * 100);
          const firstMonth =
            period === "month" && firstPurchase === true && plan.firstMonthPriceUsd !== null
              ? plan.firstMonthPriceUsd
              : null;
          const displayPrice =
            period === "year"
              ? plan.yearlyPerMonthUsd
              : firstMonth !== null
                ? firstMonth
                : plan.monthlyPriceUsd;
          const struckPrice =
            period === "year" || firstMonth !== null ? plan.monthlyPriceUsd : null;

          const veoCount = generationsFor(plan.creditsPerMonth, freeVideo.credits).toLocaleString();
          const seedCount = generationsFor(plan.creditsPerMonth, seedanceUnit.credits).toLocaleString();
          const klingCount = generationsFor(plan.creditsPerMonth, klingUnit.credits).toLocaleString();

          return (
            <article
              key={plan.tier}
              className={`hp-tier hp-tier-${plan.tier}${plan.popular ? " hp-tier-featured hp-plan-popular" : ""}`}
            >
              {/* Pro gets an integrated full-width luminous top crown (Krea DNA) */}
              {plan.popular ? (
                <div className="hp-tier-crown">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.proCrown}</span>
                </div>
              ) : null}

              <div className="hp-tier-inner">
                {/* Tier Header — single clean badge policy (Annual toggle already carries Save 30%) */}
                <div className="hp-tier-head">
                  <h3 className={`hp-tier-name hp-tier-name-${plan.tier}`}>{copy.names[plan.tier]}</h3>
                  {firstMonth !== null ? (
                    <span className="hp-discount-pill hp-discount-pro">{copy.firstMonthBadge}</span>
                  ) : plan.tier === "ultimate" ? (
                    <span className="hp-ultimate-tag">{copy.ultimateBadge}</span>
                  ) : null}
                </div>
                <p className="hp-tier-blurb">{copy.blurbs[plan.tier]}</p>

                {/* VALUE-FIRST Inset Credit Box ABOVE Price (Mitte 4.95% + Swagga 8.02% secret) */}
                <div className="hp-value-box">
                  <div className="hp-credits-row">
                    <span className="hp-credits">
                      <Coins className="h-4 w-4" aria-hidden="true" />
                      <strong>{plan.creditsPerMonth.toLocaleString()}</strong>
                      <span>{copy.creditsPerMonth}</span>
                    </span>
                  </div>
                  <ul className="hp-output-list">
                    <li>{copy.veoOutput(veoCount, freeVideo.name)}</li>
                    <li>{copy.proOutput(seedCount, seedanceUnit.name, klingCount, klingUnit.name)}</li>
                  </ul>
                  <div className="hp-rate-row">
                    <span className="hp-rate-label">{copy.rateLabel}</span>
                    <span className={rateDiscountPct > 0 ? "hp-rate-val hp-rate-val-save" : "hp-rate-val"}>
                      {rateDiscountPct > 0
                        ? copy.rateSave(usd(perCredit * 1000, 2), rateDiscountPct)
                        : copy.rateStandard(usd(perCredit * 1000, 2))}
                    </span>
                  </div>
                </div>

                {/* Big Confident Price Block */}
                <div className="hp-price-block">
                  <div className="hp-price">
                    {struckPrice !== null ? <s className="hp-price-was">{usd(struckPrice)}</s> : null}
                    <span className="hp-price-now">{usd(displayPrice)}</span>
                    <span className="hp-price-unit">{copy.perMonth}</span>
                  </div>
                  <p className="hp-billed-note">
                    {period === "year"
                      ? `${copy.billedYearly(usd(plan.yearlyPriceUsd))} · ${copy.creditsUpFront(plan.creditsPerYear.toLocaleString())}`
                      : copy.billedMonthly}
                  </p>
                </div>

                {/* High-Contrast Solid CTA + Attached Recessed Savings Bar (Mitte DNA) */}
                <div className="hp-cta-stack">
                  {action({
                    productId: idFor(plan),
                    label: copy.cta(copy.ctaNames[plan.tier]),
                    className: ctaClass(plan.tier),
                  })}
                  <p
                    className={
                      period === "year" || firstMonth !== null
                        ? "hp-save-strip hp-save-strip-hi"
                        : "hp-save-strip"
                    }
                  >
                    {period === "year"
                      ? copy.saveStripYearly(usd(plan.yearlySavingUsd), plan.yearlyMonthsFree)
                      : firstMonth !== null
                        ? copy.saveStripFirstMonth(usd(firstMonth), usd(plan.monthlyPriceUsd))
                        : copy.saveStripMonthly}
                  </p>
                </div>

                {/* Structured Hairline Checklist with Clear Upgrade Contrast */}
                <ul className="hp-includes">
                  <li className={plan.tier !== "basic" ? "hp-inc-hi" : undefined}>
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    <span>{copy.atOnce(plan.concurrency)}</span>
                  </li>
                  {plan.priorityQueue ? (
                    <li className="hp-inc-hi">
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      <span>{copy.priority}</span>
                    </li>
                  ) : null}
                  {copy.features.map((item) => (
                    <li key={item}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {plan.tier === "basic" ? (
                    <li className="hp-inc-muted">
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span>{copy.basicMissing}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      {/* Quiet Trust Bar */}
      <ul className="hp-trust">
        {copy.trust.map((item) => (
          <li key={item}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {checkoutError ? (
        <output className="hp-error" aria-live="polite">
          {checkoutError}
        </output>
      ) : null}

      {/* Homepage ends cleanly after the plan stage */}
      {asPage ? null : (
        <div className="hp-home-more">
          <p className="hp-sub-sm">{copy.homeNote}</p>
          <Link href={href("/pricing")} className="hp-cta hp-cta-ghost">
            <span>{copy.viewPricing}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* 2. Pay-As-You-Go Credit Packs */}
      {asPage ? (
        <section className="hp-section hp-packs-section" id="packs" aria-labelledby="hp-packs-title">
          <div className="hp-section-head">
            <div>
              <p className="hp-section-kicker">{copy.packsKicker}</p>
              <h2 id="hp-packs-title" className="hp-h3">
                {copy.packsTitle}
              </h2>
              <p className="hp-sub-sm">{copy.packsSub(packYears)}</p>
            </div>
            <Link href={href("/video")} className="hp-free-link">
              <Gift className="h-4 w-4" aria-hidden="true" />
              <span>{copy.freeTryCta}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="hp-packs-grid">
            {packs.map((pack) => {
              const packLabel = copy.packNames[pack.name] ?? pack.name;
              const veoClips = generationsFor(pack.credits, freeVideo.credits);
              const seedClips = generationsFor(pack.credits, seedanceUnit.credits);
              const body = (
                <PackCardContent
                  key={pack.id}
                  label={packLabel}
                  badge={pack.popular ? copy.bestValue : null}
                  price={usd(pack.priceUsd)}
                  credits={
                    pendingId === pack.id
                      ? copy.redirecting
                      : `${pack.credits.toLocaleString()} ${credits}`
                  }
                  makes={copy.packMakes(veoClips, freeVideo.name, seedClips, seedanceUnit.name)}
                  unitPrice={zh ? `${usd(pack.per100Usd, 2)} / 100 积分` : `${usd(pack.per100Usd, 2)} / 100 cr`}
                  ctaLabel={!checkout?.enabled && checkout ? copy.comingSoon : copy.packBuy}
                />
              );

              return checkout ? (
                <button
                  key={pack.id}
                  type="button"
                  className={`hp-pack${pack.popular ? " hp-pack-popular" : ""}`}
                  disabled={!checkout.enabled || pendingId !== null}
                  onClick={() => void buy(pack.id)}
                >
                  {body}
                </button>
              ) : (
                <Link
                  key={pack.id}
                  href={href("/pricing")}
                  className={`hp-pack${pack.popular ? " hp-pack-popular" : ""}`}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 3. Transparent Model Credit Matrix + Collapsible Estimator */}
      {asPage ? (
        <section className="hp-section hp-compare" aria-labelledby="hp-compare-title">
          <div className="hp-compare-head">
            <div>
              <p className="hp-section-kicker">{copy.compareKicker}</p>
              <h2 id="hp-compare-title" className="hp-h3">
                {copy.compareTitle}
              </h2>
              <p className="hp-sub-sm">{copy.compareSub}</p>
            </div>
            <div className="hp-filter-bar" role="tablist" aria-label={zh ? "模型分类" : "Model category"}>
              {(["all", "video", "image", "audio"] as TableFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tableFilter === key}
                  className="hp-filter-btn"
                  onClick={() => setTableFilter(key)}
                >
                  {copy.filters[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="hp-table-scroll">
            <table className="hp-table">
              <thead>
                <tr>
                  <th scope="col">{copy.model}</th>
                  <th scope="col" className="hp-col-free">
                    {copy.free}
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.tier} scope="col" className={plan.popular ? "hp-col-pick" : undefined}>
                      <span className="hp-th-name">{copy.ctaNames[plan.tier]}</span>
                      <span className="hp-th-price">
                        {usd(period === "year" ? plan.yearlyPerMonthUsd : plan.monthlyPriceUsd)}
                        {copy.perMonth}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {visibleKinds.map((kind) => (
                <tbody key={kind}>
                  {tableFilter === "all" ? (
                    <tr className="hp-table-group">
                      <th scope="rowgroup" colSpan={2 + plans.length}>
                        {kind === "video" ? (
                          <Video className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : kind === "image" ? (
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Music className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{copy.kinds[kind]}</span>
                      </th>
                    </tr>
                  ) : null}
                  {visibleUnits(kind).map((item) => (
                    <tr key={item.id}>
                      <th scope="row">
                        <span className="hp-row-name">{item.name}</span>
                        <span className="hp-row-spec">
                          {item.spec[zh ? "zh" : "en"]} · {item.credits} {copy.perUse}
                        </span>
                      </th>
                      <td className="hp-col-free">
                        {generationsFor(NEW_USER_GIFT.credits, item.credits) > 0
                          ? generationsFor(NEW_USER_GIFT.credits, item.credits)
                          : "—"}
                      </td>
                      {plans.map((plan) => (
                        <td key={plan.tier} className={plan.popular ? "hp-col-pick" : undefined}>
                          <span className="hp-cell-count">
                            {generationsFor(plan.creditsPerMonth, item.credits).toLocaleString()}
                          </span>
                          <span className="hp-cell-price">
                            {usd(item.credits * creditPriceUsd(plan, period), 2)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          {tableFilter === "all" ? (
            <button
              type="button"
              className="hp-more"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
            >
              <span>{showAll ? copy.showLess : copy.showMore}</span>
              <ChevronDown className={showAll ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden="true" />
            </button>
          ) : null}

          <details className="hp-est-fold">
            <summary>
              <Calculator className="h-4 w-4" aria-hidden="true" />
              <span>{copy.estimatorToggle}</span>
              <ChevronDown className="hp-est-chevron h-4 w-4" aria-hidden="true" />
            </summary>
            <div className="hp-estimator" id="estimator">
              <div className="hp-est-left">
                <h3 className="hp-est-title">{copy.estimatorTitle}</h3>
                <p className="hp-sub-sm">{copy.estimatorSub}</p>
                <div className="hp-slider">
                  <div className="hp-slider-head">
                    <span className="hp-slider-label">
                      <Video className="h-4 w-4" aria-hidden="true" />
                      {copy.videosLabel}
                      <select
                        value={videoModel}
                        onChange={(event) => setVideoModel(event.target.value)}
                        aria-label={zh ? "视频模型" : "Video model"}
                      >
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
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={videos}
                    onChange={(event) => setVideos(Number(event.target.value))}
                    aria-label={copy.videosLabel}
                  />
                  <span className="hp-slider-note">
                    {unit(videoModel).spec[zh ? "zh" : "en"]} · {unit(videoModel).credits} {copy.perVideo}
                  </span>
                </div>
                <div className="hp-slider">
                  <div className="hp-slider-head">
                    <span className="hp-slider-label">
                      <ImageIcon className="h-4 w-4" aria-hidden="true" />
                      {copy.imagesLabel}
                      <select
                        value={imageModel}
                        onChange={(event) => setImageModel(event.target.value)}
                        aria-label={zh ? "图片模型" : "Image model"}
                      >
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
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={10}
                    value={images}
                    onChange={(event) => setImages(Number(event.target.value))}
                    aria-label={copy.imagesLabel}
                  />
                  <span className="hp-slider-note">
                    {unit(imageModel).spec[zh ? "zh" : "en"]} · {unit(imageModel).credits} {copy.perImage}
                  </span>
                </div>
                <label className="hp-retakes">
                  <input type="checkbox" checked={retakes} onChange={(event) => setRetakes(event.target.checked)} />
                  <span>{copy.retakes}</span>
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
                  <span>{copy.fits(copy.ctaNames[recommended])}</span>
                </p>
                {overflow > 0 ? <p className="hp-overflow">{copy.overflow(overflow)}</p> : null}
                {(() => {
                  const pick = plans.find((plan) => plan.tier === recommended) ?? plans[0];
                  return action({
                    productId: idFor(pick),
                    label: copy.cta(copy.ctaNames[recommended]),
                    className: `${ctaClass(recommended)} hp-cta-block`,
                  });
                })()}
              </div>
            </div>
          </details>
        </section>
      ) : null}
    </section>
  );
}

/** Closing studio CTA banner placed after the FAQ on /pricing. */
export function PricingClosingBanner({
  lang,
  checkout,
}: {
  lang: string;
  checkout?: { enabled: boolean };
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const [pending, setPending] = useState(false);
  const plans = useMemo(() => planOffers(), []);
  const pro = plans.find((plan) => plan.popular) ?? plans[1];
  const freeVideo = pricingUnit(FREE_VIDEO_UNIT_ID);
  const href = (path: string) => localizedHref(lang, path);

  const buyPro = async () => {
    if (!checkout?.enabled || pending) return;
    setPending(true);
    try {
      const result = await startStripeCheckout(pro.yearlyId, {
        returnTo: new URLSearchParams(window.location.search).get("returnTo"),
      });
      if (!result.ok && result.error === "unauthorized") {
        signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      }
    } catch {
      // handled cleanly by re-enabling button
    }
    setPending(false);
  };

  return (
    <div className="hp-closing-wrap">
      <div className="hp-bottom">
        <div>
          <p className="hp-h3">{zh ? "先免费生成你的第一条有声视频" : "Create your first AI video with sound"}</p>
          <p className="hp-sub-sm">
            {zh
              ? `注册即送 ${NEW_USER_GIFT.credits} 积分，免绑卡即可体验 ${freeVideo.name}，满意再升级。`
              : `Start with ${NEW_USER_GIFT.credits} free credits — no card needed to try ${freeVideo.name}. Upgrade when ready.`}
          </p>
        </div>
        <div className="hp-bottom-actions">
          <Link href={href("/video")} className="hp-cta hp-cta-white">
            <span>{zh ? "免费开始体验" : "Try it free"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="hp-cta hp-cta-pro"
            disabled={!checkout?.enabled || pending}
            onClick={() => void buyPro()}
          >
            {!checkout?.enabled
              ? zh
                ? "即将开放购买"
                : "Coming soon"
              : pending
                ? zh
                  ? "正在跳转…"
                  : "Redirecting…"
                : zh
                  ? "立即开通 Pro"
                  : "Get Pro"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PackCardContent({
  label,
  badge,
  price,
  credits,
  makes,
  unitPrice,
  ctaLabel,
}: {
  label: string;
  badge: string | null;
  price: string;
  credits: string;
  makes: string;
  unitPrice: string;
  ctaLabel: string;
}) {
  return (
    <>
      <div className="hp-pack-top">
        <span className="hp-pack-name">{label}</span>
        {badge ? <span className="hp-pack-badge">{badge}</span> : null}
      </div>
      <p className="hp-pack-price">{price}</p>
      <p className="hp-pack-credits">{credits}</p>
      <p className="hp-pack-makes">{makes}</p>
      <div className="hp-pack-foot">
        <span className="hp-pack-unit">{unitPrice}</span>
        <span className="hp-pack-cta">
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </>
  );
}
