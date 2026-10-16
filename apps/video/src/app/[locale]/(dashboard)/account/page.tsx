import "@/styles/account-tokens.css";

import { eq } from "drizzle-orm";
import Link from "next/link";

import { AccountActivity } from "@/components/account/account-activity";
import { ManageSubscriptionButton } from "@/components/account/manage-subscription-button";
import { customers, db } from "@/db";
import { copyFor, planLabel } from "@/lib/account-view";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import { creditService } from "@/services/credit";

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const copy = copyFor(locale);
  const balance = await creditService.getBalance(user.id);

  const [customer] = await db
    .select({ stripeCurrentPeriodEnd: customers.stripeCurrentPeriodEnd })
    .from(customers)
    .where(eq(customers.authUserId, user.id))
    .limit(1);

  const periodEnd = toDate(customer?.stripeCurrentPeriodEnd ?? null);
  const renewsOn = periodEnd
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
      }).format(periodEnd)
    : null;

  const paymentsEnabled = isPaymentsConfigured();

  return (
    <div className="acct-page">
      <h1 className="acct-title">{copy.title}</h1>

      <div className="acct-grid">
        <section className="acct-card">
          <h2 className="acct-card-heading">{copy.creditsHeading}</h2>

          <div className="acct-metric">
            <span className="acct-metric-label">{copy.available}</span>
            <span className="acct-metric-value-lg">
              {balance.availableCredits}
            </span>
          </div>

          <div className="acct-metrics">
            <div className="acct-metric">
              <span className="acct-metric-label">{copy.total}</span>
              <span className="acct-metric-value">{balance.totalCredits}</span>
            </div>
            <div className="acct-metric">
              <span className="acct-metric-label">{copy.used}</span>
              <span className="acct-metric-value">{balance.usedCredits}</span>
            </div>
            <div className="acct-metric">
              <span className="acct-metric-label">{copy.frozen}</span>
              <span className="acct-metric-value">{balance.frozenCredits}</span>
            </div>
            <div className="acct-metric">
              <span className="acct-metric-label">{copy.expiringSoon}</span>
              <span className="acct-metric-value">{balance.expiringSoon}</span>
            </div>
          </div>

          <div className="acct-actions">
            <Link className="acct-button" href={`/${locale}/pricing`}>
              {copy.buyCredits}
            </Link>
          </div>
        </section>

        <section className="acct-card">
          <h2 className="acct-card-heading">{copy.planHeading}</h2>

          <div className="acct-metric">
            <span className="acct-metric-value-lg">
              {planLabel(balance.plan, copy)}
            </span>
          </div>

          {renewsOn ? (
            <p className="acct-muted">
              {copy.renewsOn} {renewsOn}
            </p>
          ) : null}

          <div className="acct-actions">
            <ManageSubscriptionButton enabled={paymentsEnabled} copy={copy} />
          </div>
        </section>
      </div>

      <AccountActivity copy={copy} locale={locale} />
    </div>
  );
}
