import { DRAFT_ROBOTS } from "@/lib/indexing";
import type { Metadata } from "next";

import { EffectsGallery } from "@/components/effects/effects-gallery";
import type { Locale } from "@/config/i18n-config";
import { copyFor } from "@/lib/effects-data";
import { buildAlternates } from "@/lib/seo";
import "@/components/effects/effects.css";

type EffectsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: EffectsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh";

  return {
    title: isZh ? "AI 视频特效模板" : "AI Video Effects Templates",
    description: isZh
      ? "浏览 AI 视频特效模板，涵盖镜头运动、变形、氛围与风格，挑一个在创作页应用并按你的想法调整。"
      : "Browse AI video effect templates — camera moves, transforms, atmosphere, and style — then take any look into the studio to make it your own.",
    robots: DRAFT_ROBOTS,
    alternates: buildAlternates("/effects", locale as Locale),
  };
}

export default async function EffectsPage({ params }: EffectsPageProps) {
  const { locale } = await params;
  const copy = copyFor(locale);

  return (
    <div className="fx-page">
      <header className="fx-head">
        <p className="fx-kicker">{locale === "zh" ? "AI 视频特效" : "AI video effects"}</p>
        <h1 className="fx-title">{copy.heading}</h1>
        <p className="fx-sub">{copy.sub}</p>
      </header>
      <EffectsGallery lang={locale} />
    </div>
  );
}
