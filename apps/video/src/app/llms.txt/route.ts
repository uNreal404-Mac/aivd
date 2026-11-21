import { CONTENT_UPDATED } from "@/config/content-dates";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { siteConfig } from "@/config/site";
import { featureCopy, type FeatureKind } from "@/lib/feature-pages";
import { LANDING_MODELS, landingHref, landingPriceRows } from "@/lib/model-landing";
import { packOffers, planOffers, usd } from "@/lib/pricing-offers";

/**
 * /llms.txt: a short, plain-text map of the site for AI assistants and
 * agents (llmstxt.org). Built from the same config as the pages, so its
 * prices and model list cannot drift from them.
 */
export function GET() {
  const url = (path: string) => `${siteConfig.url}${path === "/" ? "" : path}`;
  const features: FeatureKind[] = ["text-to-video", "image-to-video", "reference-to-video", "audio"];
  const gift = NEW_USER_GIFT.enabled ? NEW_USER_GIFT.credits : 0;
  const models = LANDING_MODELS.filter((model) => model.live).map((model) => {
    const first = landingPriceRows(model)[0];
    const price = first ? `: from ${first.credits} credits (${first.option.en}, about ${first.cost} on a plan)` : "";
    return `- [${model.name}](${url(landingHref(model.slug))})${price}`;
  });

  const body = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.name} is a multi-model AI video generator: text to video, image to video and reference to video with Veo 3.1, Kling 4.0, Seedance 2.5 and other models on one credit balance, plus AI images and text to speech. The cost of each generation is shown before it starts, and failed generations are refunded.`,
    "",
    `Plans start at ${usd(planOffers()[0].monthlyPriceUsd)} a month; credit packs without a subscription start at ${usd(Math.min(...packOffers().map((pack) => pack.priceUsd)))}.${gift ? ` New accounts get ${gift} free credits for ${NEW_USER_GIFT.validDays} days.` : ""} Prices and model details last updated ${CONTENT_UPDATED.models}. Every page is also available in Simplified Chinese under /zh.`,
    "",
    "## Tools",
    "",
    `- [AI video generator](${url("/")}): the homepage generator`,
    ...features.map((kind) => {
      const copy = featureCopy(kind, false);
      return `- [${copy.h1}](${url(`/${kind}`)}): ${copy.description}`;
    }),
    "",
    "## Models",
    "",
    ...models,
    "",
    "## Pricing and company",
    "",
    `- [Pricing](${url("/pricing")}): plans, credit packs and what each model costs`,
    `- [About](${url("/about")})`,
    `- [Contact](${url("/contact")})`,
    `- [Terms](${url("/terms")}), [Privacy](${url("/privacy")}), [Refund policy](${url("/refund-policy")})`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
