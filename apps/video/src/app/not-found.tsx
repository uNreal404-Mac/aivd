import { getLocale } from "next-intl/server";

import { HfTopNav } from "@/components/hf/top-nav";
import { LandingFooter } from "@/components/landing/footer";
import { NotFoundView } from "@/components/states/not-found-view";
import { getCurrentUser } from "@/lib/auth";

// Every unknown address lands here, in the site's own frame (nav and footer)
// and language, with a 404 status.
export default async function NotFound() {
  const locale = await getLocale();
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <HfTopNav user={user ? { name: user.name, email: user.email, image: user.image } : null} lang={locale} />
      <main className="flex-1">
        <NotFoundView locale={locale} />
      </main>
      <LandingFooter />
    </div>
  );
}
