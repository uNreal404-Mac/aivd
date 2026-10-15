import { m } from '@/locale/paraglide/messages';
import { authClient } from '@/auth/client';
import FaqSection from '@/components/blocks/faqs';
import Container from '@/components/layout/container';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { PricingTable } from '@/components/pricing/pricing-table';
import { PublicCreditPackages } from '@/components/pricing/public-credit-packages';
import { websiteConfig } from '@/config/website';
import { useCurrentPlan } from '@/hooks/use-payment';
import { seo } from '@/lib/seo';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(pages)/pricing')({
  head: () =>
    seo('/pricing', {
      title: `${m.pricing_title()} | ${websiteConfig.metadata?.name}`,
      description: m.pricing_description(),
    }),
  component: PricingPage,
});

function PricingPage() {
  const showPricePlans = websiteConfig.payment?.price?.enable !== false;
  const showCreditPackages = true;
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const { data: planData } = useCurrentPlan(showPricePlans && !!userId);
  const currentPlan = planData?.currentPlan ?? null;
  return (
    <div className="flex min-h-svh flex-col">
      <DashboardHeader showBack />
      <Container className="py-16 px-4">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              {m.pricing_title()}
            </h1>
            <p className="text-lg text-muted-foreground">
              {m.pricing_subtitle()}
            </p>
          </div>
          {showPricePlans && (
            <>
              <h2 className="sr-only">{m.pricing_subtitle()}</h2>
              <PricingTable
                currentPlan={currentPlan}
                metadata={userId ? { userId } : undefined}
              />
            </>
          )}
          {showCreditPackages && <PublicCreditPackages />}
          <FaqSection />
        </div>
      </Container>
    </div>
  );
}
