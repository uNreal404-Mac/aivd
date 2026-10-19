import type { Metadata } from "next";

import { EffectsGallery } from "@/components/effects/effects-gallery";
import type { Locale } from "@/config/i18n-config";
import { copyFor } from "@/lib/effects-data";
import { buildAlternates } from "@/lib/seo";
import "@/styles/effects-tokens.css";

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
    alternates: buildAlternates("/effects", locale as Locale),
  };
}

export default async function EffectsPage({ params }: EffectsPageProps) {
  const { locale } = await params;
  const copy = copyFor(locale);

  return (
    <div className="bg-[var(--fx-bg)] text-[color:var(--fx-text)]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          {copy.heading}
        </h1>
        <p className="text-sm text-[color:var(--fx-muted)]">{copy.sub}</p>
        <div className="mt-6">
          <EffectsGallery lang={locale} />
        </div>
      </div>
    </div>
  );
}
