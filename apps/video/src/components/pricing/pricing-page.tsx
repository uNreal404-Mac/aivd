"use client";

import { useMemo, useState } from "react";

import { LocaleLink } from "@/i18n/navigation";
import {
  approxVideoCount,
  costPer100Credits,
  displayPlanName,
  fill,
  formatCreditNumber,
  formatUsd,
  monthlyEquivalentCents,
  pricingCopy,
  yearlySavingsPercent,
  type FaqItem,
  type PricingProduct,
} from "@/components/pricing/pricing-data";
import { startStripeCheckout } from "@/lib/stripe-checkout-client";

export interface VideoDurationRow {
  seconds: number;
  credits: number;
}

export interface PricingPageProps {
  paymentsEnabled: boolean;
  locale: string;
  monthlyPlans: PricingProduct[];
  yearlyPlans: PricingProduct[];
  packs: PricingProduct[];
  giftEnabled: boolean;
  giftCredits: number;
  giftDays: number;
  videoPerSecond: number;
  videoDurations: VideoDurationRow[];
  cheapestVideoSeconds: number;
  cheapestVideoCredits: number;
  imageEnabled: boolean;
  musicEnabled: boolean;
  imageCredits: number;
  musicCredits: number;
  musicTracks: number;
  faq: FaqItem[];
}

export function PricingPage({
  paymentsEnabled,
  locale,
  monthlyPlans,
  yearlyPlans,
  packs,
  giftEnabled,
  giftCredits,
  giftDays,
  videoPerSecond,
  videoDurations,
  cheapestVideoSeconds,
  cheapestVideoCredits,
  imageEnabled,
  musicEnabled,
  imageCredits,
  musicCredits,
  musicTracks,
  faq,
}: PricingPageProps) {
  const copy = pricingCopy(locale);
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const plans = period === "year" ? yearlyPlans : monthlyPlans;

  const savingsPercent = useMemo(
    () => yearlySavingsPercent([...monthlyPlans, ...yearlyPlans]),
    [monthlyPlans, yearlyPlans]
  );

  const hasVideoCost = cheapestVideoCredits > 0 && cheapestVideoSeconds > 0;

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

  function per100Label(product: PricingProduct): string {
    return fill(copy.per100Credits, {
      price: formatUsd(costPer100Credits(product)),
    });
  }

  return (
    <div className="pr-page">
      <div className="pr-shell">
        {/* ---------- hero ---------- */}
        <header className="pr-hero">
          <h1 className="pr-hero__title">{copy.heroTitle}</h1>
          <p className="pr-hero__sub">{copy.heroSubtitle}</p>
          {giftEnabled ? (
            <p className="pr-hero__gift">
              {fill(copy.welcomeGift, {
                credits: formatCreditNumber(giftCredits),
                days: giftDays,
              })}
            </p>
          ) : null}
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
          {savingsPercent > 0 ? (
            <span className="pr-toggle__badge">
              {fill(copy.saveBadge, { pct: savingsPercent })}
            </span>
          ) : null}
        </div>

        <p className="pr-usd-note">{copy.usdNote}</p>

        {/* ---------- plan cards ---------- */}
        <div className="pr-grid">
          {plans.map((plan) => {
            const isYearly = plan.billingPeriod === "year";
            const isPopular = plan.popular === true;
            const showError = errorId === plan.id;
            const videos = approxVideoCount(plan.credits, cheapestVideoCredits);

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
                  <span className="pr-price__currency">{copy.usdShort}</span>
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
                    { credits: formatCreditNumber(plan.credits) }
                  )}
                </p>

                <ul className="pr-card__facts">
                  {hasVideoCost ? (
                    <li>
                      {fill(copy.approxVideos, {
                        count: formatCreditNumber(videos),
                        seconds: cheapestVideoSeconds,
                      })}
                    </li>
                  ) : null}
                  <li>{per100Label(plan)}</li>
                  {plan.validityDays && plan.validityDays > 0 ? (
                    <li>
                      {fill(copy.validForDays, { days: plan.validityDays })}
                    </li>
                  ) : null}
                </ul>

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
              const showError = errorId === pack.id;

              return (
                <article key={pack.id} className="pr-pack">
                  <span className="pr-pack__credits">
                    {fill(copy.packCredits, {
                      credits: formatCreditNumber(pack.credits),
                    })}
                  </span>
                  <span className="pr-pack__price">
                    {formatUsd(pack.price.amount)}
                    <span className="pr-pack__currency">{copy.usdShort}</span>
                  </span>
                  <span className="pr-pack__meta">{per100Label(pack)}</span>
                  {pack.validityDays && pack.validityDays > 0 ? (
                    <span className="pr-pack__meta">
                      {fill(copy.validForDays, { days: pack.validityDays })}
                    </span>
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

        {/* ---------- credit costs ---------- */}
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.costsTitle}</h2>
          <p className="pr-section__sub">{copy.costsSubtitle}</p>

          <div className="pr-table-wrap">
            <table className="pr-table pr-table--costs">
              <caption className="pr-sr-only">{copy.costsTitle}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy.tableType}</th>
                  <th scope="col">{copy.tableUnit}</th>
                  <th scope="col">{copy.tableCredits}</th>
                  <th scope="col">{copy.tableStatus}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{copy.videoRow}</th>
                  <td>{copy.videoUnit}</td>
                  <td>{formatCreditNumber(videoPerSecond)}</td>
                  <td>
                    <span className="pr-status pr-status--available">
                      {copy.available}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">{copy.imageRow}</th>
                  <td>{copy.imageUnit}</td>
                  <td>{formatCreditNumber(imageCredits)}</td>
                  <td>
                    <span
                      className={`pr-status ${
                        imageEnabled
                          ? "pr-status--available"
                          : "pr-status--soon"
                      }`}
                    >
                      {imageEnabled ? copy.available : copy.comingSoon}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">{copy.musicRow}</th>
                  <td>{fill(copy.musicUnit, { tracks: musicTracks })}</td>
                  <td>{formatCreditNumber(musicCredits)}</td>
                  <td>
                    <span
                      className={`pr-status ${
                        musicEnabled
                          ? "pr-status--available"
                          : "pr-status--soon"
                      }`}
                    >
                      {musicEnabled ? copy.available : copy.comingSoon}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {videoDurations.length > 0 ? (
            <ul className="pr-chips" aria-label={copy.videoRow}>
              {videoDurations.map((row) => (
                <li className="pr-chip" key={row.seconds}>
                  {fill(copy.chipTemplate, {
                    seconds: row.seconds,
                    credits: formatCreditNumber(row.credits),
                  })}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="pr-footnote">{copy.failedFootnote}</p>
          <p className="pr-note">
            <LocaleLink className="pr-link" href="/image-to-video">
              {copy.costsCta}
            </LocaleLink>
          </p>
        </section>

        {/* ---------- comparison table ---------- */}
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.compareTitle}</h2>
          <p className="pr-section__sub">{copy.compareSubtitle}</p>
          <div className="pr-table-wrap">
            <table className="pr-table">
              <caption className="pr-sr-only">{copy.compareTitle}</caption>
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
                      {formatCreditNumber(
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
                    <td key={plan.id}>
                      {formatUsd(costPer100Credits(plan))}
                    </td>
                  ))}
                </tr>
                {hasVideoCost ? (
                  <tr>
                    <th scope="row">
                      {fill(copy.tableApproxVideos, {
                        seconds: cheapestVideoSeconds,
                      })}
                    </th>
                    {plans.map((plan) => (
                      <td key={plan.id}>
                        {formatCreditNumber(
                          approxVideoCount(
                            plan.billingPeriod === "year"
                              ? Math.round(plan.credits / 12)
                              : plan.credits,
                            cheapestVideoCredits
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                ) : null}
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
          <p className="pr-note">
            <LocaleLink className="pr-link" href="/refund-policy">
              {copy.refundPolicyLink}
            </LocaleLink>
            <LocaleLink className="pr-link" href="/terms">
              {copy.termsLink}
            </LocaleLink>
          </p>
        </section>

        {/* ---------- closing CTA ---------- */}
        <section className="pr-cta">
          <h2 className="pr-cta__title">{copy.ctaTitle}</h2>
          <p className="pr-cta__sub">{copy.ctaBody}</p>
          <LocaleLink
            className="pr-btn pr-btn--primary pr-cta__btn"
            href="/image-to-video"
          >
            {copy.ctaButton}
          </LocaleLink>
        </section>
      </div>
    </div>
  );
}
