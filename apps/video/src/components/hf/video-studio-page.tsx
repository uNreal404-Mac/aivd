import { AiVideoStudio } from "@/components/hf/ai-video-studio";
import { getConfiguredAIProvider } from "@/ai/provider-config";
import { marketModelsOf } from "@/ai/kie-market";
import { getAvailableModels } from "@/config/credits";
import { settingsFromSearchParams, selectModel } from "@/lib/ai-video-studio";
import { findNavModel } from "@/lib/nav-models";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The video studio as a page. /ai/video uses it as is; the older tool routes
 * (text, image and reference to video) use it with their own default model.
 */
export function VideoStudioPage({
  locale,
  searchParams,
  defaultModel,
}: {
  locale: string;
  searchParams: SearchParams;
  /** Model to open with when the link does not name one. */
  defaultModel?: string;
}) {
  const modelParam = (Array.isArray(searchParams.model) ? searchParams.model[0] : searchParams.model) ?? defaultModel;
  const availableModelIds = [
    ...getAvailableModels({
      provider: getConfiguredAIProvider() ?? "kie",
      mode: "text-to-video",
    }).map((model) => model.id),
    ...marketModelsOf("video").map((model) => model.id),
  ];
  // A nav model that cannot generate yet opens as coming soon, under the
  // same name the menu shows.
  const upcoming = modelParam && !availableModelIds.includes(modelParam) ? findNavModel("video", modelParam) : undefined;
  const parsed = settingsFromSearchParams(searchParams);
  const initialSettings = modelParam && modelParam !== parsed.modelId ? selectModel(parsed, modelParam) : parsed;

  return (
    <AiVideoStudio
      // Remount when the nav switches models, so the new choice is applied.
      key={modelParam ?? "default"}
      upcomingModel={upcoming ? { name: upcoming.name, desc: locale === "zh" ? upcoming.desc.zh : upcoming.desc.en } : undefined}
      generationEnabled={process.env.VIDEO_GENERATION_ENABLED === "true"}
      initialSettings={initialSettings}
      initialCatalogModelId={modelParam}
      locale={locale}
      availableModelIds={availableModelIds}
    />
  );
}
