import { MyCreationsPage } from "@/components/creation/my-creations-page";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { getCurrentUser } from "@/lib/auth";
import { giftInfo, isNewUser } from "@/lib/onboarding";
import { CREDITS_CONFIG } from "@/config/credits";
import { siteConfig } from "@/config/site";
import "@/styles/onboarding-tokens.css";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function MyCreationsRoute({ params }: PageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();

  return (
    <>
      <MyCreationsPage locale={locale} />
      {user ? (
        <WelcomeModal
          locale={locale}
          userId={user.id}
          isNewUser={isNewUser(user.createdAt)}
          siteName={siteConfig.name}
          gift={giftInfo(CREDITS_CONFIG.registerGift)}
        />
      ) : null}
    </>
  );
}
