import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiImageStudio } from "@/components/hf/ai-image-studio";
import { getMarketModel, marketCredits } from "@/ai/kie-market";

const session = vi.hoisted(() => ({ user: { id: "test-user", isAdmin: false, isSuperAccount: false } }));
vi.mock("@/lib/auth/client", () => ({ useSession: () => ({ data: session, isPending: false }) }));
vi.mock("@/components/hf/home-media-picker", () => ({ HomeMediaPicker: () => null }));
vi.mock("@/components/hf/image-showcase", () => ({ ImageShowcase: () => null }));
vi.mock("@/components/hf/kie-model-picker", () => ({ KieModelPicker: () => null }));

// Keep the real BarSelect, and expose the real resolution-menu options during
// the server render (normally they only mount after opening the menu).
vi.mock("@/hooks/use-presence", () => ({
  usePresence: () => ({ mounted: true, state: "open" }),
}));

type Draft = { modelId: string; prompt: string; resolution?: string; aspect: string; count: number; refs: { key: string; name: string; preview: string }[] };
let returningDraft: Draft | undefined;
vi.mock("@/hooks/use-credit-return-draft", () => ({
  useCreditReturnDraft(_scope: string, _snapshot: () => Draft, restore: (draft: Draft) => void) {
    const [restored, setRestored] = React.useState(false);
    if (returningDraft && !restored) {
      setRestored(true);
      restore(returningDraft);
    }
  },
}));
vi.mock("@/lib/home-media-library", async original => ({
  ...await original<typeof import("@/lib/home-media-library")>(),
  currentUploadUrls: async () => new Map(),
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubEnv("NEXT_PUBLIC_IS_PREVIEW", "false");
  session.user.isAdmin = false;
  session.user.isSuperAccount = false;
  returningDraft = undefined;
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function render(model?: string, initialResolution?: string, initialCount = 1) {
  return renderToStaticMarkup(React.createElement(AiImageStudio, { locale: "en", initialModel: model, initialResolution, initialCount }));
}

function buttonCost(markup: string) {
  const button = markup.match(/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  return Number(button?.match(/<span class="du-num">(\d+)<\/span>/)?.[1]);
}

const defaults = [
  ["seedream-5-5", "2K", "1:1", 9],
  ["gpt-image-2-6-sunburst", "1K", "Auto", 12], ["gpt-image-2-6-flare", "1K", "Auto", 12],
  ["gpt-image-2", "1K", "Auto", 9], ["nano-banana-2-1", "1K", "Auto", 6], ["nano-banana-pro", "1K", "3:4", 25],
  ["kling-image-4", "2K", "Auto", 16], ["minimax-h3-image", "2K", "Auto", 3],
  ["flux3/klein-text-to-image", "1K", "1:1", 3], ["grok-imagine-image-2-0/text-to-image", "", "1:1", 6],
] as const;

it.each(defaults)("renders the %s default, plus every selectable resolution and batch price", (id, size, aspect, credits) => {
  const model = getMarketModel(id)!;
  const markup = render(id);
  expect(buttonCost(markup)).toBe(credits);
  expect(markup).toContain(`aria-label="Aspect ratio: ${aspect}"`);
  if (size) expect(markup).toContain(`aria-label="Resolution: ${size}"`);
  else expect(markup).not.toContain('aria-label="Resolution:');

  for (let count = 1; count <= model.options.maxCount!; count++) {
    // A pricing-return draft supplies the reference images already attached
    // by the user. The separate wire/ledger matrix pins the independent amounts.
    const refs = Array.from({ length: model.options.maxImages! }, (_, i) => ({
      key: "uploads/test-user/" + i, name: String(i), preview: "https://image.test/" + i,
    }));
    for (const resolution of model.options.resolutions?.length ? model.options.resolutions : [undefined]) {
      returningDraft = { modelId: id, prompt: "draw", aspect: "1:1", count, refs, resolution };
      const edited = render(id);
      const quote = (size?: string) => marketCredits(model, { prompt: "draw", resolution: size, count, imageUrls: refs.map(r => r.key) });
      expect(buttonCost(edited)).toBe(quote(resolution));
      for (const option of model.options.resolutions ?? []) {
        expect(edited).toContain(quote(option) + " credits");
      }
    }
  }
});

it("renders the default studio and applies the preview waiver only with both account flags", () => {
  expect(buttonCost(render())).toBe(25);
  vi.stubEnv("NEXT_PUBLIC_IS_PREVIEW", "true");
  session.user.isAdmin = true;
  expect(buttonCost(render())).toBe(25);
  session.user.isSuperAccount = true;
  expect(buttonCost(render())).toBe(0);
});
