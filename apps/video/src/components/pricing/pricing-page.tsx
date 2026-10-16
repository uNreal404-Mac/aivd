// placeholder: replace this line
"use client";

import { useMemo, useState } from "react";

import type { CreditPackageConfig } from "@/config/credits";
import {
  costPer100Credits,
  displayPlanName,
  FAQ_ITEMS,
  monthlyEquivalentCents,
  plansForPeriod,
  type BillingPeriod,
} from "@/components/pricing/pricing-data";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";

export interface PricingPageProps {
  paymentsEnabled: boolean;
  subscriptions: CreditPackageConfig[];
  packs: CreditPackageConfig[];
}

/** Parallel generation slots granted by plan rank (cheapest first). */
const PARALLEL_GENERATIONS = [1, 2, 4];

/** Formats a cent amount as a USD string, e.g. 2900 -> "$29". */
function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function formatCredits(credits: number): string {
  return credits.toLocaleString("en-US");
}

export function PricingPage({
  paymentsEnabled,
  subscriptions,
  packs,
}: PricingPageProps) {
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
      setErrorMessage(result.error);
    }

    setPendingId(null);
  }

  function buttonLabel(productId: string): string {
    if (!paymentsEnabled) return "Coming soon";
    if (pendingId === productId) return "Redirecting…";
    return "Get started";
  }

  return (
    <div className="pr-page">
      <div className="pr-shell">
        {/* ---------- hero ---------- */}
        <header className="pr-hero">
          <h1 className="pr-hero__title">Plans &amp; pricing</h1>
          <p className="pr-hero__sub">
            Choose how much you want to create. Every plan unlocks the full
            DreamUtopia model roster, fast rendering and credits that work
            across text-to-video and image-to-video.
          </p>
        </header>

        {/* ---------- billing toggle ---------- */}
        <div className="pr-toggle-wrap">
          <fieldset className="pr-toggle" aria-label="Billing period">
            <button
              type="button"
              className={`pr-toggle__btn${
                period === "month" ? " pr-toggle__btn--active" : ""
              }`}
              aria-pressed={period === "month"}
              onClick={() => setPeriod("month")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`pr-toggle__btn${
                period === "year" ? " pr-toggle__btn--active" : ""
              }`}
              aria-pressed={period === "year"}
              onClick={() => setPeriod("year")}
            >
              Yearly
            </button>
          </fieldset>
          <span className="pr-toggle__badge">Save ~17%</span>
        </div>

        {/* ---------- plan cards ---------- */}
        <div className="pr-grid">
          {plans.map((plan) => {
            const isPopular = plan.popular === true;
            const isYearly = plan.billingPeriod === "year";
            const features = plan.features ?? [];
            const showError = errorId === plan.id;

            return (
              <article
                key={plan.id}
                className={`pr-card${isPopular ? " pr-card--popular" : ""}`}
              >
                {isPopular ? (
                  <span className="pr-card__ribbon">Most popular</span>
                ) : null}

                <h2 className="pr-card__name">{displayPlanName(plan.name)}</h2>

                <div className="pr-price">
                  <span className="pr-price__amount">
                    {formatUsd(monthlyEquivalentCents(plan))}
                  </span>
                  <span className="pr-price__period">/ month</span>
                </div>
                <span className="pr-price__note">
                  {isYearly
                    ? `Billed ${formatUsd(plan.price.amount)} yearly`
                    : "Billed monthly"}
                </span>

                <p className="pr-card__credits">
                  {formatCredits(plan.credits)} credits{" "}
                  {isYearly ? "per year" : "per month"}
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
          <h2 className="pr-section__title">Credit packs</h2>
          <p className="pr-section__sub">
            Prefer to top up without a subscription? Buy credits once and spend
            them whenever inspiration strikes.
          </p>
          <div className="pr-packs">
            {packs.map((pack) => {
              const features = pack.features ?? [];
              const showError = errorId === pack.id;

              return (
                <article key={pack.id} className="pr-pack">
                  <span className="pr-pack__credits">
                    {formatCredits(pack.credits)} credits
                  </span>
                  <span className="pr-pack__meta">
                    {formatUsd(pack.price.amount)} ·{" "}
                    {formatUsd(costPer100Credits(pack))} per 100 credits
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
          <h2 className="pr-section__title">Compare plans</h2>
          <p className="pr-section__sub">
            Everything each tier includes, side by side.
          </p>
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {plans.map((plan) => (
                    <th scope="col" key={plan.id}>
                      {displayPlanName(plan.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Monthly credits</th>
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
                  <th scope="row">Price</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {formatUsd(monthlyEquivalentCents(plan))} / month
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Cost per 100 credits</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>{formatUsd(costPer100Credits(plan))}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Parallel generations</th>
                  {plans.map((plan, index) => (
                    <td key={plan.id}>
                      {PARALLEL_GENERATIONS[index] ??
                        PARALLEL_GENERATIONS[PARALLEL_GENERATIONS.length - 1]}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Commercial use</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      <span className="pr-table__yes">✓</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Priority queue</th>
                  {plans.map((plan, index) => (
                    <td key={plan.id}>
                      {index === plans.length - 1 ? (
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
          <h2 className="pr-section__title">Frequently asked questions</h2>
          <p className="pr-section__sub">
            Still deciding? These are the questions we hear most.
          </p>
          <div className="pr-faq">
            {FAQ_ITEMS.map((item) => (
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
