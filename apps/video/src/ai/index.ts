import type { AIVideoProvider, ProviderType } from "./types";
import { EvolinkProvider } from "./providers/evolink";
import { KieProvider } from "./providers/kie";
import { ApimartProvider } from "./providers/apimart";
import { MockVideoProvider } from "./providers/mock";
import {
  getConfiguredAIProvider,
  requireProviderApiKey,
} from "./provider-config";

const providers: Map<ProviderType, AIVideoProvider> = new Map();

let mockProviderWarned = false;

export function isMockProviderEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VIDEO_MOCK_PROVIDER === "true"
  );
}

export function getProvider(type: ProviderType): AIVideoProvider {
  if (providers.has(type)) return providers.get(type)!;

  let provider: AIVideoProvider;

  if (isMockProviderEnabled()) {
    if (!mockProviderWarned) {
      mockProviderWarned = true;
      console.warn(
        "[mock-provider] VIDEO_MOCK_PROVIDER=true — using MOCK video provider (dev/test only)"
      );
    }
    provider = new MockVideoProvider(type);
    providers.set(type, provider);
    return provider;
  }

  switch (type) {
    case "evolink":
      provider = new EvolinkProvider(requireProviderApiKey("evolink"));
      break;
    case "kie":
      provider = new KieProvider(requireProviderApiKey("kie"));
      break;
    case "apimart":
      provider = new ApimartProvider(requireProviderApiKey("apimart"));
      break;
    default:
      throw new Error(`Unknown provider: ${type}`);
  }

  providers.set(type, provider);
  return provider;
}

export function getDefaultProvider(): AIVideoProvider {
  const type = getConfiguredAIProvider() || "evolink";
  return getProvider(type);
}

export * from "./types";
export * from "./provider-config";
