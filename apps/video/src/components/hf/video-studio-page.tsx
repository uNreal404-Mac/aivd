import { AiVideoStudio } from "@/components/hf/ai-video-studio";
import { getConfiguredAIProvider } from "@/ai/provider-config";
import { marketModelsOf } from "@/ai/kie-market";
import { getAvailableModels } from "@/config/credits";
import { KLING_KEYFRAME_MODEL } from "@/lib/kling-keyframes";
import { settingsFromSearchParams } from "@/lib/ai-video-studio";
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
  const requestedTool = searchParams.tool ?? searchParams.mode;
  const homeHandoffToken = typeof searchParams.autostart === "string" ? searchParams.autostart : "";
  const rawModel = (Array.isArray(searchParams.model) ? searchParams.model[0] : searchParams.model) ?? defaultModel;
  const modelParam = rawModel === "kling-4.0" ? KLING_KEYFRAME_MODEL : rawModel === "seedance_2_5" ? "bytedance/seedance-2-5" : rawModel;
  const keyframes = searchParams.input === "keyframes" && modelParam === KLING_KEYFRAME_MODEL;
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
  const modelDefaults = modelParam === "bytedance/seedance-2-5"
    ? { duration: "5", resolution: "1080p", aspect: "16:9", audio: "true" }
    : keyframes ? { duration: "10", resolution: "1080p" } : {};
  const initialSettings = settingsFromSearchParams({ ...modelDefaults, ...searchParams, model: modelParam });

  return (
    <AiVideoStudio
      // Remount when the nav switches models, so the new choice is applied.
      key={`${modelParam ?? "default"}:${requestedTool ?? (keyframes ? "keyframes" : "create")}`}
      initialKeyframes={keyframes}
      initialExtend={requestedTool === "extend"}
      initialTool={requestedTool === "motion" || requestedTool === "edit" ? requestedTool : "create"}
      upcomingModel={upcoming ? { name: upcoming.name, desc: locale === "zh" ? upcoming.desc.zh : upcoming.desc.en } : undefined}
      generationEnabled={process.env.VIDEO_GENERATION_ENABLED === "true"}
      initialSettings={initialSettings}
      homeHandoffToken={homeHandoffToken}
      initialCatalogModelId={modelParam}
      locale={locale}
      availableModelIds={availableModelIds}
    />
  );
}
