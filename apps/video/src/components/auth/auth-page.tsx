import { Suspense } from "react";
import { localizedHref } from "@/lib/locale-path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SignInModalContent } from "@/components/sign-in-modal";
import { PreviewBadge } from "@/components/layout/preview-badge";
import "./auth-page.css";

/**
 * The /login and /register pages: a picture from the site on the left and the
 * same sign-in card the modal uses on the right, so both ways in look alike.
 */
export function AuthPage({
  locale,
  callbackURL,
  error,
  note,
}: {
  locale: string;
  callbackURL: string;
  error?: string | null;
  /** Extra line under the card, e.g. that a first sign-in creates the account. */
  note?: string;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const home = localizedHref(locale, "/");

  return (
    <div className="au">
      <aside className="au-visual" aria-hidden="true">
        <img src="/home/hero-marina-poster.webp" alt="" />
        <div className="au-visual-shade" />
        <div className="au-visual-copy">
          <p className="au-visual-kicker">{zh ? "AI 视频生成器" : "AI video generator"}</p>
          <p className="au-visual-title">{zh ? <>一句话，<br />生成电影感视频</> : <>One sentence,<br />a cinematic clip</>}</p>
          <p className="au-visual-models">Veo 3.1 · Seedance 2.5 · Kling 4.0 · Nano Banana Pro</p>
        </div>
      </aside>

      <main className="au-main">
        <div className="au-top">
          <Link href={home} className="au-brand">
            <img src="/logo.svg" alt="" width={28} height={28} />
            aivd.ai
            <PreviewBadge lang={locale} />
          </Link>
          <Link href={home} className="au-back">
            <ArrowLeft aria-hidden="true" />
            {zh ? "返回首页" : "Back to home"}
          </Link>
        </div>

        <div className="au-center">
          {error ? (
            <p role="alert" className="au-error">
              {error}
            </p>
          ) : null}
          <div className="au-card">
            <Suspense fallback={<div className="au-card-fallback" />}>
              <SignInModalContent lang={locale} callbackURL={callbackURL} />
            </Suspense>
          </div>
          {note ? <p className="au-note">{note}</p> : null}
        </div>
      </main>
    </div>
  );
}
