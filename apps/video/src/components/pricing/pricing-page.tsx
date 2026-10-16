// placeholder: replace this line
"use client";

import { useMemo, useState } from "react";

import type { CreditPackageConfig } from "@/config/credits";
import {
  costPer100Credits,
  displayPlanName,
  faqItemsFor,
  featureLabels,
  monthlyEquivalentCents,
  plansForPeriod,
  pricingCopy,
  type BillingPeriod,
} from "@/components/pricing/pricing-data";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";

export interface PricingPageProps {
  paymentsEnabled: boolean;
  subscriptions: CreditPackageConfig[];
  packs: CreditPackageConfig[];
  locale: string;
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
}: PricingPageProps) {
  const copy = pricingCopy(locale);
  const faq = faqItemsFor(locale);
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

  function buttonLabel(productId: string): string {
    if (!paymentsEnabled) return copy.comingSoon;
    if (pendingId === productId) return copy.redirecting;
    return copy.getStarted;
  }

  return (
    <div className="pr-page">
      <div className="pr-shell">
        {/* ---------- hero ---------- */}
        <header className="pr-hero">
          <h1 className="pr-hero__title">{copy.heroTitle}</h1>
          <p className="pr-hero__sub">{copy.heroSubtitle}</p>
        </header>

        {/* ---------- billing toggle ---------- */}
        <div className="pr-toggle-wrap">
          <fieldset className="pr-toggle" aria-label={copy.billingPeriodLabel}>
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
            </button>
          </fieldset>
          <span className="pr-toggle__badge">{copy.saveBadge}</span>
        </div>

        {/* ---------- plan cards ---------- */}
        <div className="pr-grid">
          {plans.map((plan) => {
            const isPopular = plan.popular === true;
            const isYearly = plan.billingPeriod === "year";
            const features = featureLabels(plan.features, locale);
            const showError = errorId === plan.id;

            return (
              <article
                key={plan.id}
                className={`pr-card${isPopular ? " pr-card--popular" : ""}`}
              >
                {isPopular ? (
                  <span className="pr-card__ribbon">{copy.mostPopular}</span>
                ) : null}

                <h2 className="pr-card__name">{displayPlanName(plan.name)}</h2>

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
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="pr-card__spacer" />

                <button
                  type="button"
                  className={`pr-btn${isPopular ? " pr-btn--primary" : ""}`}
                  disabled={!paymentsEnabled || pendingId !== null}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {buttonLabel(plan.id)}
                </button>

                {showError && errorMessage ? (
                  <p className="pr-error">{errorMessage}</p>
                ) : null}
              </article>
            );
          })}
        </div>

        {/* ---------- credit packs ---------- */}
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.creditPacksTitle}</h2>
          <p className="pr-section__sub">{copy.creditPacksSubtitle}</p>
          <div className="pr-packs">
            {packs.map((pack) => {
              const features = featureLabels(pack.features, locale);
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

                  {features.length > 0 ? (
                    <ul className="pr-features">
                      {features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="pr-pack__spacer" />

                  <button
                    type="button"
                    className="pr-btn pr-btn--sm"
                    disabled={!paymentsEnabled || pendingId !== null}
                    onClick={() => handleCheckout(pack.id)}
                  >
                    {buttonLabel(pack.id)}
                  </button>

                  {showError && errorMessage ? (
                    <p className="pr-error">{errorMessage}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------- comparison table ---------- */}
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.compareTitle}</h2>
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
        </section>

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
