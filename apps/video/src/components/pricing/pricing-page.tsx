"use client";
import { BillingMotion } from "@/components/motion/accents";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { CreditPackageConfig } from "@/config/credits";
import {
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

  return (
    <div className="pr-page">
      <div className="pr-shell">
        {/* ---------- hero ---------- */}
        <header className="pr-hero">
          <h1 className="pr-hero__title">{copy.heroTitle}</h1>
          <p className="pr-hero__sub">{paymentsEnabled ? copy.heroSubtitle : copy.checkoutClosed}</p>
        </header>

        {/* ---------- billing toggle ---------- */}
        <div className="pr-toggle-wrap">
          <fieldset className="pr-toggle motion-billing" aria-label={copy.billingPeriodLabel}>
            <BillingMotion yearly={period === "year"} />
            <button
              type="button"
              className={`pr-toggle__btn${
                period === "month" ? " pr-toggle__btn--active" : ""
              }`}
              aria-pressed={period === "month"}
              onClick={() => setPeriod("month")}
            >
              {copy.monthly}
            </button>
            <button
              type="button"
              className={`pr-toggle__btn${
                period === "year" ? " pr-toggle__btn--active" : ""
              }`}
              aria-pressed={period === "year"}
              onClick={() => setPeriod("year")}
            >
              {copy.yearly}
              {annualSaving !== undefined && (
                <span className="pr-toggle__badge">{fill(copy.saveBadge, { percent: String(annualSaving) })}</span>
              )}
            </button>
          </fieldset>
        </div>

        {/* ---------- plan cards ---------- */}
        <div className="pr-grid">
          {plans.map((plan) => {
            const isPopular = plan.popular === true;
            const isYearly = plan.billingPeriod === "year";
            const features = plan.features ?? [];
            const planName = displayPlanName(plan.name);
            const showError = errorId === plan.id;

            return (
              <article
                key={plan.id}
                className={`pr-card${isPopular ? " pr-card--popular motion-recommended" : ""}`}
              >
                {isPopular ? (
                  <span className="pr-card__ribbon">{copy.mostPopular}</span>
                ) : null}

                <h2 className="pr-card__name">{planName}</h2>

                <div className="pr-price">
                  <span className="pr-price__amount">
                    {formatUsd(monthlyEquivalentCents(plan))}
                  </span>
                  <span className="pr-price__period">{copy.perMonth}</span>
                </div>
                <span className="pr-price__note">
                  {isYearly
                    ? fill(copy.billedYearly, {
                        amount: formatUsd(plan.price.amount),
                      })
                    : copy.billedMonthly}
                </span>

                <p className="pr-card__credits">
                  {fill(
                    isYearly ? copy.creditsPerYear : copy.creditsPerMonth,
                    { credits: formatCredits(plan.credits) }
                  )}
                </p>

                {features.length > 0 ? (
                  <ul className="pr-features">
                    {features.map((feature) => (
                      <li key={feature}>{featureLabel(feature)}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="pr-card__spacer" />

                <button
                  type="button"
                  className={`pr-btn ${isPopular ? "du-primary pr-btn--primary" : "du-secondary pr-btn--secondary"}`}
                  disabled={!paymentsEnabled || pendingId !== null}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {buttonLabel(
                    plan.id,
                    fill(copy.choosePlan, { plan: planName.replace(/ Plan$/, "") })
                  )}
                </button>

                {showError && errorMessage ? (
                  <p className="pr-error">{errorMessage}</p>
                ) : null}
              </article>
            );
          })}
        </div>

        {/* ---------- comparison table ---------- */}
        <details className="pr-plan-details">
          <summary>{copy.compareTitle}</summary>
          <p className="pr-section__sub">{copy.compareSubtitle}</p>
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th scope="col">{copy.tableFeature}</th>
                  {plans.map((plan) => (
                    <th scope="col" key={plan.id}>
                      {displayPlanName(plan.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{copy.tableMonthlyCredits}</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {formatCredits(
                        plan.billingPeriod === "year"
                          ? Math.round(plan.credits / 12)
                          : plan.credits
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{copy.tablePrice}</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {fill(copy.tablePricePerMonth, {
                        price: formatUsd(monthlyEquivalentCents(plan)),
                      })}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{copy.tableCostPer100}</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>{formatUsd(costPer100Credits(plan))}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{copy.tableCommercialUse}</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {(plan.features ?? []).includes("commercial_use") ? (
                        <span className="pr-table__yes">✓</span>
                      ) : (
                        <span className="pr-table__no">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </details>

        {/* ---------- credit packs ---------- */}
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.creditPacksTitle}</h2>
          <p className="pr-section__sub">{copy.creditPacksSubtitle}</p>
          <div className="pr-packs">
            {packs.map((pack) => {
              const features = pack.features ?? [];
              const showError = errorId === pack.id;

              return (
                <article key={pack.id} className="pr-pack">
                  <span className="pr-pack__credits">
                    {fill(copy.packCredits, {
                      credits: formatCredits(pack.credits),
                    })}
                  </span>
                  <span className="pr-pack__meta">
                    {fill(copy.packMeta, {
                      price: formatUsd(pack.price.amount),
                      per100: formatUsd(costPer100Credits(pack)),
                    })}
                  </span>

                  {typeof pack.expireDays === "number" && (
                    <span className="pr-pack__meta">{fill(copy.packValidity, { days: String(pack.expireDays) })}</span>
                  )}
                  {features.length > 0 ? (
                    <ul className="pr-features">
                      {features.map((feature) => (
                        <li key={feature}>{featureLabel(feature)}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="pr-pack__spacer" />

                  <button
                    type="button"
                    className="pr-btn du-secondary pr-btn--secondary pr-btn--sm"
                    disabled={!paymentsEnabled || pendingId !== null}
                    onClick={() => handleCheckout(pack.id)}
                  >
                    {buttonLabel(
                      pack.id,
                      fill(copy.buyCredits, { credits: formatCredits(pack.credits) })
                    )}
                  </button>

                  {showError && errorMessage ? (
                    <p className="pr-error">{errorMessage}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {modelCosts}

        {/* ---------- FAQ ---------- */}
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.faqTitle}</h2>
          <p className="pr-section__sub">{copy.faqSubtitle}</p>
          <div className="pr-faq">
            {faq.map((item) => (
              <details key={item.id}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
