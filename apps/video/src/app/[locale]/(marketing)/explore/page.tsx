import { ExploreGallery } from "@/components/explore/explore-gallery";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { copyFor, EXPLORE_COPY } from "@/lib/explore-data";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import "@/styles/explore-tokens.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const alternates = buildAlternates("/explore", locale);

  const isZh = locale === "zh";
  const title = isZh ? "探索 AI 视频灵感" : "Explore AI video ideas";
  const description = isZh
    ? "按风格浏览原创 AI 视频示例，把喜欢的提示词和模型一键带到创作页开始生成。"
    : "Browse original AI video samples by style, then reuse any prompt and its model back in the studio.";
  const ogImage = resolveOgImage();

  return {
    title,
    description,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: alternates.canonical,
      siteName: siteConfig.name,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const copy = copyFor(locale);

  return (
    <div
      className="min-h-screen w-full bg-[var(--ex-bg)]"
      data-explore-heading={EXPLORE_COPY.en.heading}
    >
      <div className="mx-auto flex max-w-[1600px] flex-col px-4 py-8">
        <h1 className="sr-only">
          {copy.heading}
        </h1>
        <div>
          <ExploreGallery lang={locale} />
        </div>
      </div>
    </div>
  );
}
