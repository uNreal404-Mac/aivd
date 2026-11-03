"use client";
import { BillingMotion } from "@/components/motion/accents";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { PricingReferenceClip } from "@/components/pricing/reference-clip";
import type { CreditPackageConfig } from "@/config/credits";
import {
  completeClipCount,
  costPer100Credits,
  displayPlanName,
  faqItemsFor,
  monthlyEquivalentCents,
  plansForPeriod,
  pricingCopy,
  yearlySavingsPercent,
  type BillingPeriod,
} from "@/components/pricing/pricing-data";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";

export interface PricingPageProps {
  paymentsEnabled: boolean;
  subscriptions: CreditPackageConfig[];
  packs: CreditPackageConfig[];
  locale: string;
  modelCosts: React.ReactNode;
  referenceClip: PricingReferenceClip | null;
}

/** Formats a cent amount as a USD string, e.g. 2900 -> "$29". */
function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function formatCredits(credits: number): string {
  return credits.toLocaleString("en-US");
}

/** Replaces `{name}` placeholders in a copy template. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => values[key] ?? match
  );
}

export function PricingPage({
  paymentsEnabled,
  subscriptions,
  packs,
  locale,
  modelCosts,
  referenceClip,
}: PricingPageProps) {
  const copy = pricingCopy(locale);
  const featureLabel = useTranslations("Credits.features");
  const faq = faqItemsFor(locale);
  const annualSaving = yearlySavingsPercent(subscriptions);
  const [period, setPeriod] = useState<BillingPeriod>("month");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const plans = useMemo(
    () => plansForPeriod(subscriptions, period),
    [subscriptions, period]
  );

  async function handleCheckout(productId: string) {
    if (!paymentsEnabled || pendingId !== null) return;

    setErrorId(null);
    setErrorMessage(null);
    setPendingId(productId);

    const result = await startStripeCheckout(productId);

    if (!result.ok) {
      setErrorId(productId);
      setErrorMessage(result.error || copy.errorFallback);
    }

    setPendingId(null);
  }

  function buttonLabel(productId: string, label: string): string {
    if (pendingId === productId) return copy.redirecting;
    return label;
  }

  const zh = locale === "zh";
  const sharedFeatures = (plans[0]?.features ?? []).filter((key) => plans.every((plan) => plan.features?.includes(key)));
  const packsShareFeatures = packs.length > 0 && packs.every((pack) => sharedFeatures.every((key) => pack.features?.includes(key)));

  return (
    <div className="pr-page" lang={locale}>
      <div className="pr-shell">
        <header className="pr-hero">
          <div className="pr-hero__copy">
            <h1 className="pr-hero__title">{copy.heroTitle}</h1>
            <p className="pr-hero__sub">{zh ? "按期订阅，或为单个项目补充积分。" : "Subscribe for ongoing work, or top up for a single project."}</p>
            {!paymentsEnabled && <p className="pr-status" role="note">
              {copy.checkoutClosed}{" "}<a href="#credit-costs">{zh ? "查看积分用量" : "View credit costs"} <span aria-hidden="true">↓</span></a>
            </p>}
          </div>
          <figure className="pr-still">
            <img src="/conversion/showcase/optics.webp" width={720} height={360} alt="" loading="lazy" decoding="async" fetchPriority="low" />
            <figcaption>{zh ? "光学引擎" : "Optical Engine"}</figcaption>
          </figure>
        </header>

        <section className="pr-subscriptions" aria-labelledby="pr-subscriptions">
          <div className="pr-section-head">
            <div>
              <h2 id="pr-subscriptions">{zh ? "订阅方案" : "Subscriptions"}</h2>
            </div>
            <fieldset className="pr-toggle motion-billing" aria-label={copy.billingPeriodLabel}>
              <BillingMotion yearly={period === "year"} />
              {(["month", "year"] as const).map((value) => (
                <button key={value} type="button" className={`pr-toggle__btn${period === value ? " pr-toggle__btn--active" : ""}`}
                  aria-pressed={period === value} onClick={() => setPeriod(value)}>
                  {value === "month" ? copy.monthly : copy.yearly}
                  {value === "year" && annualSaving !== undefined &&
                    <span className="pr-toggle__badge">{fill(copy.saveBadge, { percent: String(annualSaving) })}</span>}
                </button>
              ))}
            </fieldset>
          </div>

          <p className="pr-quote-unit">
            {zh ? "美元计价" : "Prices in USD"}
            {referenceClip && (zh
              ? ` · 按 ${referenceClip.duration} 秒 ${referenceClip.quality} 估算`
              : ` · Estimates for ${referenceClip.duration}-second ${referenceClip.quality} clips`)}
          </p>
          <div className="pr-ledger" data-estimate={!!referenceClip} data-checkout={paymentsEnabled}>
            <div className="pr-ledger__labels" aria-hidden="true">
              <span>{zh ? "方案" : "Plan"}</span><span>{zh ? "月均价" : "Monthly rate"}</span>
              <span>{zh ? "周期积分" : "Credit allowance"}</span>
              {referenceClip && <span>{zh ? "可生成片段" : "Complete clips"}</span>}
              <span>{zh ? "额外权益" : "Additional benefits"}</span>{paymentsEnabled && <span />}
            </div>
            {plans.map((plan) => {
              const isPopular = plan.popular === true;
              const isYearly = plan.billingPeriod === "year";
              const planName = displayPlanName(plan.name).replace(/ Plan$/, "");
              const extraFeatures = (plan.features ?? []).filter((key) => !sharedFeatures.includes(key));
              return (
                <article key={plan.id} className={`pr-card${isPopular ? " pr-card--popular motion-recommended" : ""}`} aria-label={planName}>
                  <div className="pr-name">
                    <h3>{planName}</h3>
                    {isPopular && <span className="pr-recommended">{copy.mostPopular}</span>}
                  </div>
                  <div className="pr-rate">
                    <p className="pr-price">{formatUsd(monthlyEquivalentCents(plan))}<small>{copy.perMonth}</small></p>
                    <span className="pr-meta">{isYearly ? fill(copy.billedYearly, { amount: formatUsd(plan.price.amount) }) : copy.billedMonthly}</span>
                  </div>
                  <div className="pr-allowance">
                    <strong>{formatCredits(plan.credits)}</strong>
                    <span className="pr-meta">{isYearly ? (zh ? "积分 / 年" : "credits / year") : (zh ? "积分 / 月" : "credits / month")}</span>
                  </div>
                  {referenceClip && <div className="pr-output">
                    <strong>{formatCredits(completeClipCount(plan, referenceClip.credits))}</strong>
                    <span className="pr-meta">{isYearly ? (zh ? "段视频 / 年" : "video clips / year") : (zh ? "段视频 / 月" : "video clips / month")}</span>
                  </div>}
                  {extraFeatures.length > 0
                    ? <ul className="pr-features">{extraFeatures.map((key) => <li key={key}>{featureLabel(key)}</li>)}</ul>
                    : <span className="pr-features pr-features--none" aria-label={zh ? "无额外权益" : "No additional benefits"}>—</span>}
                  {paymentsEnabled && <div className="pr-action">
                    <button type="button" className={`pr-btn ${isPopular ? "du-primary pr-btn--primary" : "du-secondary pr-btn--secondary"}`}
                      disabled={!paymentsEnabled || pendingId !== null} onClick={() => handleCheckout(plan.id)}>
                      {buttonLabel(plan.id, fill(copy.choosePlan, { plan: planName }))}
                    </button>
                    {errorId === plan.id && errorMessage && <p className="pr-error" role="alert">{errorMessage}</p>}
                  </div>}
                </article>
              );
            })}
          </div>
          {referenceClip && <p className="pr-basis">
            {zh
              ? `${referenceClip.model} 每段 ${referenceClip.credits} 积分，片段数按完整视频计算。`
              : `${referenceClip.model} is billed at ${referenceClip.credits} credits per clip. Counts include whole clips only.`}
          </p>}
          <details className="pr-plan-details">
            <summary>{zh ? "比较单位价格与共有权益" : "Compare unit prices and shared benefits"}</summary>
            {sharedFeatures.length > 0 && <p className="pr-common">
            {packsShareFeatures ? (zh ? "所有订阅和积分包均包含" : "All plans and packs include ") : (zh ? "所有订阅均包含" : "All plans include ")}
            {sharedFeatures.map((key) => featureLabel(key)).join(zh ? "、" : " · ")}{zh ? "。" : "."}
          </p>}
            <dl>{plans.map((plan) => <div key={plan.id}><dt>{displayPlanName(plan.name)}</dt><dd>{formatUsd(costPer100Credits(plan))}</dd></div>)}</dl>
          </details>
        </section>

        <section className="pr-packs-section" id="credit-packs" aria-labelledby="pr-packs-title">
          <div className="pr-section-head">
            <div><h2 id="pr-packs-title">{copy.creditPacksTitle}</h2></div>
            <p className="pr-sidecopy">{copy.creditPacksSubtitle}</p>
          </div>
          <ul className="pr-packs" data-checkout={paymentsEnabled}>
            {packs.map((pack) => (
              <li key={pack.id} className="pr-pack">
                <h3>{fill(copy.packCredits, { credits: formatCredits(pack.credits) })}</h3>
                <span className="pr-pack-price">{formatUsd(pack.price.amount)}<small>{fill(copy.tableCostPer100 + " · {price}", { price: formatUsd(costPer100Credits(pack)) })}</small></span>
                <div className="pr-pack-info">
                  {typeof pack.expireDays === "number" && <span>{fill(copy.packValidity, { days: String(pack.expireDays) })}</span>}
                  <ul>{(pack.features ?? []).filter((key) => !packsShareFeatures || !sharedFeatures.includes(key)).map((key) => <li key={key}>{featureLabel(key)}</li>)}</ul>
                </div>
                {paymentsEnabled && <div className="pr-action">
                  <button type="button" className="pr-btn du-secondary pr-btn--secondary" disabled={!paymentsEnabled || pendingId !== null} onClick={() => handleCheckout(pack.id)}>
                    {buttonLabel(pack.id, fill(copy.buyCredits, { credits: formatCredits(pack.credits) }))}
                  </button>
                  {errorId === pack.id && errorMessage && <p className="pr-error" role="alert">{errorMessage}</p>}
                </div>}
              </li>
            ))}
          </ul>
        </section>

        <div className="pr-costs" id="credit-costs">{modelCosts}</div>
        <section className="pr-faq-section" aria-labelledby="pr-faq-title">
          <div><h2 id="pr-faq-title">{copy.faqTitle}</h2></div>
          <div className="pr-faq">{faq.map((item) => <details key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
        </section>
      </div>
    </div>
  );
}
