"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Coins, Crown, Image as ImageIcon, Music, Sparkles, Video } from "lucide-react";

import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { calculateModelCredits } from "@/config/credits";
import { CREDIT_PACKAGES, NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";
import { localizedHref } from "@/lib/du-home";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";
import "./home-pricing.css";

type Period = "month" | "year";
type Kind = "video" | "image" | "audio";
type Unit = { id: string; kind: Kind; name: string; spec: { zh: string; en: string }; credits: number };

// What one generation costs, from the same pricing the studios charge.
const market = (id: string, req: Parameters<typeof marketCredits>[1]) => {
  const model = getMarketModel(id);
  return model ? marketCredits(model, req) : 0;
};
const UNITS: Unit[] = [
  { id: "veo-3.1", kind: "video", name: "Veo 3.1", spec: { zh: "8 秒 · 720p · 有声", en: "8s · 720p · sound" }, credits: calculateModelCredits("veo-3.1", { duration: 8, quality: "720p" }) },
  { id: "wan2.6", kind: "video", name: "Wan 2.6", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: calculateModelCredits("wan2.6", { duration: 5, quality: "720p" }) },
  { id: "grok-imagine/text-to-video", kind: "video", name: "Grok Imagine", spec: { zh: "6 秒 · 720p", en: "6s · 720p" }, credits: market("grok-imagine/text-to-video", { prompt: "", duration: 6, resolution: "720p" }) },
  { id: "kling/v4-flash-reference-to-video", kind: "video", name: "Kling 4.0 Flash", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("kling/v4-flash-reference-to-video", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "seedance-2-5-flash", kind: "video", name: "Seedance 2.5 Flash", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("seedance-2-5-flash", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "bytedance/seedance-2-5", kind: "video", name: "Seedance 2.5", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("bytedance/seedance-2-5", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "grok-imagine-image-2-0/text-to-image", kind: "image", name: "Grok Imagine 2.0", spec: { zh: "每张", en: "per image" }, credits: market("grok-imagine-image-2-0/text-to-image", { prompt: "" }) },
  { id: "flux3/klein-text-to-image", kind: "image", name: "FLUX 3", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("flux3/klein-text-to-image", { prompt: "", resolution: "1K" }) },
  { id: "nano-banana-2-1", kind: "image", name: "Nano Banana 2.1", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("nano-banana-2-1", { prompt: "", resolution: "1K" }) },
  { id: "nano-banana-pro", kind: "image", name: "Nano Banana Pro", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("nano-banana-pro", { prompt: "", resolution: "1K" }) },
  { id: "gpt-image-2-6-sunburst", kind: "image", name: "GPT Image 2.6", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("gpt-image-2-6-sunburst", { prompt: "", resolution: "1K" }) },
  { id: "elevenlabs-turbo-2-5", kind: "audio", name: "Eleven Turbo 2.5", spec: { zh: "每 1000 字", en: "per 1,000 chars" }, credits: market("elevenlabs-turbo-2-5", { prompt: "x".repeat(1000) }) },
  { id: "elevenlabs-v3", kind: "audio", name: "Eleven v3", spec: { zh: "每 1000 字", en: "per 1,000 chars" }, credits: market("elevenlabs-v3", { prompt: "x".repeat(1000) }) },
  { id: "suno-music", kind: "audio", name: "Suno V6", spec: { zh: "每首歌", en: "per song" }, credits: market("suno-music", { prompt: "" }) },
];
const unit = (id: string) => UNITS.find((item) => item.id === id) ?? UNITS[0];

const TIERS = ["basic", "pro", "ultimate"] as const;
type Tier = (typeof TIERS)[number];
const TIER_OF = (name: string): Tier => (name.toLowerCase().startsWith("pro") ? "pro" : name.toLowerCase().startsWith("ultimate") ? "ultimate" : "basic");

/**
 * Pricing block. On the homepage its buttons lead to /pricing; on the pricing
 * page (`checkout` set) they start checkout for the exact product shown.
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("year");
  const [videoModel, setVideoModel] = useState("veo-3.1");
  const [imageModel, setImageModel] = useState("nano-banana-pro");
  const [videos, setVideos] = useState(15);
  const [images, setImages] = useState(40);
  const [showAll, setShowAll] = useState(false);

  const plans = useMemo(
    () =>
      TIERS.map((tier) => {
        const monthly = SUBSCRIPTION_PRODUCTS.find((item) => item.period === "month" && TIER_OF(item.name) === tier)!;
        const yearly = SUBSCRIPTION_PRODUCTS.find((item) => item.period === "year" && TIER_OF(item.name) === tier)!;
        const perMonth = period === "year" ? yearly.priceUsd / 12 : monthly.priceUsd;
        const saving = Math.round((1 - yearly.priceUsd / (monthly.priceUsd * 12)) * 100);
        return { tier, monthly, yearly, perMonth, credits: monthly.credits, saving, popular: monthly.popular };
      }),
    [period],
  );
  const maxSaving = Math.max(...plans.map((plan) => plan.saving));

  // Estimator: credits a month for the chosen mix, and the smallest plan that covers it.
  const need = videos * unit(videoModel).credits + images * unit(imageModel).credits;
  const recommended = plans.find((plan) => plan.credits >= need)?.tier ?? "ultimate";
  const overflow = Math.max(0, need - plans[plans.length - 1].credits);

  const copy = zh
    ? {
        kicker: "定价",
        title: "选择适合你的套餐",
        sub: `所有套餐都能使用全部模型。新用户注册即送 ${NEW_USER_GIFT.credits} 积分，生成失败积分自动退回。`,
        monthly: "月付",
        yearly: "年付",
        save: (n: number) => `最高省 ${n}%`,
        names: { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as Record<Tier, string>,
        blurbs: { basic: "适合初次尝试 AI 创作", pro: "适合日常稳定产出", ultimate: "适合团队和大批量项目" } as Record<Tier, string>,
        popular: "人气之选",
        perMonth: "/月",
        billedYearly: (n: number) => `按年计费 US$${n}`,
        billedMonthly: "按月计费，可随时取消",
        cta: (name: string) => `开通 ${name}`,
        creditsPerMonth: "积分/月",
        about: "约可生成",
        videos: "条视频",
        imagesUnit: "张图片",
        includes: ["全部视频、图片和音频模型", "生成前显示积分，失败自动退回", "成片无水印，可商用"],
        recommended: "最适合你",
        estimatorTitle: "每月要做多少内容？",
        estimatorSub: "拖动滑块，按你选的模型实时算出每月需要的积分。",
        videosLabel: "视频",
        imagesLabel: "图片",
        perVideo: "积分/条",
        perImage: "积分/张",
        needLabel: "每月约需",
        fits: (name: string) => `推荐 ${name}`,
        overflow: (n: number) => `超出 ${n.toLocaleString()} 积分，可加购积分包`,
        compareTitle: "每个套餐能生成多少",
        compareSub: "按每次生成的积分计算，免费列是新用户赠送的积分。",
        model: "模型",
        free: "免费",
        perUse: "积分/次",
        showMore: "查看全部模型",
        showLess: "收起",
        kinds: { video: "视频", image: "图片", audio: "音频" } as Record<Kind, string>,
        packs: "积分包",
        packsSub: "订阅积分不够用时随时加购，不会过期",
        viewPricing: "查看完整定价",
        comingSoon: "即将开放购买",
        redirecting: "正在跳转…",
        checkoutError: "暂时无法跳转到支付页面，请稍后再试。",
        buyPack: "购买",
      }
    : {
        kicker: "PRICING",
        title: "Pick the plan that fits",
        sub: `Every plan unlocks every model. New accounts get ${NEW_USER_GIFT.credits} credits, and failed runs are refunded.`,
        monthly: "Monthly",
        yearly: "Yearly",
        save: (n: number) => `Save up to ${n}%`,
        names: { basic: "Basic", pro: "Pro", ultimate: "Ultimate" } as Record<Tier, string>,
        blurbs: { basic: "For trying AI creation", pro: "For steady everyday output", ultimate: "For teams and big projects" } as Record<Tier, string>,
        popular: "Most popular",
        perMonth: "/mo",
        billedYearly: (n: number) => `Billed US$${n} yearly`,
        billedMonthly: "Billed monthly, cancel anytime",
        cta: (name: string) => `Get ${name}`,
        creditsPerMonth: "credits/mo",
        about: "About",
        videos: "videos",
        imagesUnit: "images",
        includes: ["Every video, image and audio model", "Cost shown first, refunds on failure", "No watermark, commercial use"],
        recommended: "Best fit",
        estimatorTitle: "How much will you make each month?",
        estimatorSub: "Drag the sliders and see the credits your mix needs.",
        videosLabel: "Videos",
        imagesLabel: "Images",
        perVideo: "credits each",
        perImage: "credits each",
        needLabel: "You need about",
        fits: (name: string) => `We suggest ${name}`,
        overflow: (n: number) => `${n.toLocaleString()} credits over; add a credit pack`,
        compareTitle: "What each plan makes",
        compareSub: "Counted from the credits per generation; Free is the new-account gift.",
        model: "Model",
        free: "Free",
        perUse: "credits each",
        showMore: "Show every model",
        showLess: "Show less",
        kinds: { video: "Video", image: "Image", audio: "Audio" } as Record<Kind, string>,
        packs: "Credit packs",
        packsSub: "Top up whenever your plan runs low; packs do not expire",
        viewPricing: "See full pricing",
        comingSoon: "Coming soon",
        redirecting: "Redirecting…",
        checkoutError: "We could not open checkout. Please try again.",
        buyPack: "Buy",
      };

  const href = (path: string) => localizedHref(lang, path);

  const buy = async (productId: string) => {
    if (!checkout?.enabled || pendingId) return;
    setCheckoutError(null);
    setPendingId(productId);
    const result = await startStripeCheckout(productId);
    if (!result.ok) setCheckoutError(result.error || copy.checkoutError);
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

  const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  const count = (credits: number, cost: number) => (cost > 0 ? Math.floor(credits / cost) : 0);
  const visibleUnits = (kind: Kind) => UNITS.filter((item) => item.kind === kind).slice(0, showAll ? undefined : kind === "audio" ? 1 : 3);
  const dots = 40;
  const filled = Math.min(dots, Math.round((need / (plans.find((plan) => plan.tier === recommended)?.credits ?? 1)) * dots));

  return (
    <section className={asPage ? "hp hp-page" : "hp"} aria-labelledby="hp-title">
      <div className="hp-head">
        <p className="hp-kicker">{copy.kicker}</p>
        {asPage ? (
          <h1 id="hp-title" className="hp-title">{copy.title}</h1>
        ) : (
          <h2 id="hp-title" className="hp-title">{copy.title}</h2>
        )}
        <p className="hp-sub">{copy.sub}</p>
        {checkout && !checkout.enabled ? <p className="hp-note">{copy.comingSoon}</p> : null}
        <fieldset className="hp-toggle">
          <legend className="sr-only">{zh ? "计费周期" : "Billing period"}</legend>
          <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>
            {copy.monthly}
          </button>
          <button type="button" aria-pressed={period === "year"} onClick={() => setPeriod("year")}>
            {copy.yearly}
          </button>
          <span className="hp-toggle-save">{copy.save(maxSaving)}</span>
        </fieldset>
      </div>

      {/* Plan cards */}
      <div className="hp-plans">
        {plans.map((plan) => {
          const name = copy.names[plan.tier];
          const isPick = plan.tier === recommended;
          return (
            <article key={plan.tier} className={`hp-plan hp-plan-${plan.tier}${isPick ? " hp-plan-pick" : ""}`}>
              <div className="hp-plan-top">
                <div className="hp-plan-name">
                  {name}
                  {plan.popular ? (
                    <span className="hp-pill">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.popular}
                    </span>
                  ) : null}
                  {isPick ? <span className="hp-pill hp-pill-pick">{copy.recommended}</span> : null}
                </div>
                <p className="hp-plan-blurb">{copy.blurbs[plan.tier]}</p>
                <p className="hp-price">
                  {period === "year" ? <s className="hp-price-was">US${plan.monthly.priceUsd}</s> : null}
                  <span className="hp-price-now">US${fmt(Math.round(plan.perMonth * 10) / 10)}</span>
                  <span className="hp-price-unit">{copy.perMonth}</span>
                </p>
                <p className="hp-billing">{period === "year" ? copy.billedYearly(plan.yearly.priceUsd) : copy.billedMonthly}</p>
                {action({
                  productId: period === "year" ? plan.yearly.id : plan.monthly.id,
                  label: copy.cta(name),
                  className: "hp-cta",
                  extra: period === "year" && plan.saving > 0 ? <span className="hp-cta-save">-{plan.saving}%</span> : null,
                })}
              </div>
              <div className="hp-plan-body">
                <p className="hp-credits">
                  <Coins className="h-4 w-4" aria-hidden="true" />
                  <strong>{plan.credits.toLocaleString()}</strong> {copy.creditsPerMonth}
                </p>
                <ul className="hp-tree">
                  <li>
                    {copy.about} <strong>{count(plan.credits, unit(videoModel).credits).toLocaleString()}</strong> {copy.videos}
                    <span>{unit(videoModel).name}</span>
                  </li>
                  <li>
                    {copy.about} <strong>{count(plan.credits, unit(imageModel).credits).toLocaleString()}</strong> {copy.imagesUnit}
                    <span>{unit(imageModel).name}</span>
                  </li>
                </ul>
                <ul className="hp-includes">
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

      {checkoutError ? (
        <output className="hp-error" aria-live="polite">
          {checkoutError}
        </output>
      ) : null}

      {/* Usage estimator */}
      <div className="hp-estimator">
        <div className="hp-est-left">
          <h3 className="hp-h3">{copy.estimatorTitle}</h3>
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
                {videos} · {(videos * unit(videoModel).credits).toLocaleString()} {zh ? "积分" : "credits"}
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
                {images} · {(images * unit(imageModel).credits).toLocaleString()} {zh ? "积分" : "credits"}
              </span>
            </div>
            <input type="range" min={0} max={1000} step={10} value={images} onChange={(event) => setImages(Number(event.target.value))} aria-label={copy.imagesLabel} />
            <span className="hp-slider-note">
              {unit(imageModel).spec[zh ? "zh" : "en"]} · {unit(imageModel).credits} {copy.perImage}
            </span>
          </div>
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
            const pick = plans.find((plan) => plan.tier === recommended)!;
            return action({
                productId: period === "year" ? pick.yearly.id : pick.monthly.id,
                label: copy.cta(copy.names[recommended]),
                className: "hp-cta hp-cta-accent",
              });
          })()}
        </div>
      </div>

      {/* Comparison table */}
      <div className="hp-compare">
        <div className="hp-compare-head">
          <div>
            <h3 className="hp-h3">{copy.compareTitle}</h3>
            <p className="hp-sub-sm">{copy.compareSub}</p>
          </div>
        </div>
        <table className="hp-table">
          <thead>
            <tr>
              <th scope="col">{copy.model}</th>
              <th scope="col">{copy.free}</th>
              {plans.map((plan) => (
                <th key={plan.tier} scope="col" className={plan.tier === recommended ? "hp-col-pick" : undefined}>
                  {copy.names[plan.tier]}
                </th>
              ))}
            </tr>
          </thead>
          {(["video", "image", "audio"] as Kind[]).map((kind) => (
            <tbody key={kind}>
              <tr className="hp-table-group">
                <th scope="rowgroup" colSpan={5}>
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
                  <td>{count(NEW_USER_GIFT.credits, item.credits) > 0 ? count(NEW_USER_GIFT.credits, item.credits) : "—"}</td>
                  {plans.map((plan) => (
                    <td key={plan.tier} className={plan.tier === recommended ? "hp-col-pick" : undefined}>
                      {count(plan.credits, item.credits).toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <button type="button" className="hp-more" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>
          {showAll ? copy.showLess : copy.showMore}
          <ChevronDown className={showAll ? "h-4 w-4 rotate-180" : "h-4 w-4"} aria-hidden="true" />
        </button>
      </div>

      {/* Credit packs */}
      <div className="hp-packs">
        <div>
          <p className="hp-packs-title">{copy.packs}</p>
          <p className="hp-sub-sm">{copy.packsSub}</p>
        </div>
        <div className="hp-packs-list">
          {CREDIT_PACKAGES.filter((pack) => pack.enabled !== false).map((pack) =>
            checkout ? (
              <button
                key={pack.id}
                type="button"
                className="hp-pack"
                disabled={!checkout.enabled || pendingId !== null}
                onClick={() => void buy(pack.id)}
              >
                <strong>US${pack.priceUsd}</strong>
                <span>
                  {pendingId === pack.id ? copy.redirecting : `${pack.credits.toLocaleString()} ${zh ? "积分" : "credits"}`}
                </span>
              </button>
            ) : (
              <Link key={pack.id} href={href("/pricing")} className="hp-pack">
                <strong>US${pack.priceUsd}</strong>
                <span>
                  {pack.credits.toLocaleString()} {zh ? "积分" : "credits"}
                </span>
              </Link>
            ),
          )}
        </div>
        {checkout ? null : (
          <Link href={href("/pricing")} className="hp-cta hp-cta-ghost">
            {copy.viewPricing}
          </Link>
        )}
      </div>
    </section>
  );
}
