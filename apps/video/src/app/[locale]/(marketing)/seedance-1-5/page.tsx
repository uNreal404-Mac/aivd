import type { Metadata } from "next";

import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

interface ModelPageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

const pathSegment = "seedance-1-5";

export async function generateMetadata({
  params,
}: ModelPageProps): Promise<Metadata> {
  const { locale } = await params;
  const alternates = buildAlternates(`/${pathSegment}`, locale);
  const title =
    locale === "zh"
      ? "Seedance 1.5 即将停用"
      : "Seedance 1.5 Pro is sunsetting";
  const description =
    locale === "zh"
      ? "Seedance 1.5 Pro 约于 2026 年 11 月 11 日停用。请转到 aivd.ai 上的 Seedance 2.0 mini。预览站不会因此打开生成。"
      : "Seedance 1.5 Pro sunsets around November 11, 2026. Continue on aivd.ai with Seedance 2.0 mini. This preview does not turn generation on.";

  return {
    title,
    description,
    keywords: [
      "Seedance 1.5 Pro",
      "Seedance 2.0 mini",
      "AI video generator",
      "aivd.ai",
    ],
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { locale } = await params;
  const zh = locale === "zh";

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
          aivd.ai · Seedance 1.5 Pro
        </p>
        <h1 className="mt-4 text-4xl font-bold md:text-5xl">
          {zh ? "Seedance 1.5 Pro 即将停用" : "Seedance 1.5 Pro is sunsetting"}
        </h1>
        <p className="mt-5 text-lg text-[var(--du-text-muted)]">
          {zh
            ? "Seedance 1.5 Pro 约于 2026 年 11 月 11 日停用。下一步请看 Seedance 与 Seedance 2.0 mini。打开工作室不会启动付费生成。"
            : "Seedance 1.5 Pro sunsets around November 11, 2026. The next step on aivd.ai is Seedance and Seedance 2.0 mini. Opening the studio does not start a paid generation."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={`/${locale}/seedance-2-0-mini`}
            className="inline-flex h-12 items-center rounded-xl bg-[var(--du-accent)] px-5 text-sm font-medium text-[var(--du-on-accent)]"
          >
            {zh ? "了解 Seedance 2.0 mini" : "See Seedance 2.0 mini"}
          </a>
          <a
            href={`/${locale}/text-to-video`}
            className="inline-flex h-12 items-center rounded-xl border border-[var(--du-border)] px-5 text-sm font-medium"
          >
            {zh ? "文生视频" : "Text to video"}
          </a>
          <a
            href={`/${locale}/image-to-video`}
            className="inline-flex h-12 items-center rounded-xl border border-[var(--du-border)] px-5 text-sm font-medium"
          >
            {zh ? "图生视频" : "Image to video"}
          </a>
        </div>
      </div>
    </div>
  );
}
