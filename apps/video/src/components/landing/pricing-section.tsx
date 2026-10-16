import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";

import { DarkPricing } from "@/components/price/dark-pricing";
import { PricingCards } from "@/components/price/pricing-cards";
import { billingProvider } from "@/config/billing-provider";
import { isPaymentsConfigured } from "@/lib/payments";
import { getUserPlans } from "@/services/billing";
import type { CreditsDictionary } from "@/hooks/use-credit-packages";
import type { UserSubscriptionPlan } from "@/types";

interface PricingSectionProps {
  headingLevel?: "h1" | "h2";
}

export async function PricingSection({
  headingLevel = "h2",
}: PricingSectionProps) {
  const user = await getCurrentUser();
  let subscriptionPlan: UserSubscriptionPlan | undefined;
  const isCreem = billingProvider === "creem";
  const paymentsEnabled = isPaymentsConfigured();

  if (user && !isCreem) {
    subscriptionPlan = await getUserPlans(user.id);
  }

  const t = await getTranslations("PricingCards");
  const dictPrice = (await getTranslations()).raw("PricingCards") as Record<string, string>;
  const dictCredits = (await getTranslations()).raw("Credits") as CreditsDictionary;

  const Heading = headingLevel;

  return (
    <section className="relative overflow-hidden bg-[var(--du-bg)] py-16 md:py-20 text-[var(--du-text)]">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-4">
        <div className="mb-8 max-w-3xl text-left">
          <Heading className="text-3xl md:text-5xl font-black uppercase tracking-tight">
            {t("pricing")}
          </Heading>
          <p className="mt-2 text-base text-[var(--du-text-muted)]">
            {t("slogan")}
          </p>
        </div>

        {isCreem ? (
          <DarkPricing
            userId={user?.id}
            dictPrice={dictPrice}
            dictCredits={dictCredits}
            paymentsEnabled={paymentsEnabled}
          />
        ) : (
          <PricingCards
            userId={user?.id}
            subscriptionPlan={subscriptionPlan}
          />
        )}
      </div>
    </section>
  );
}
