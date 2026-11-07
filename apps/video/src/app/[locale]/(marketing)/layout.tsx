import { getCurrentUser } from "@/lib/auth";

import { HfPromoBar } from "@/components/hf/promo-bar";
import { HfTopNav } from "@/components/hf/top-nav";
import { LandingFooter } from "@/components/landing/footer";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <HfPromoBar lang={locale} />
      <HfTopNav
        user={
          user
            ? { name: user.name, email: user.email, image: user.image }
            : null
        }
        lang={locale}
      />

      <main className="flex-1">{children}</main>

      <LandingFooter />
    </div>
  );
}
