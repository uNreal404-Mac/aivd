import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCuratedGallery, curatedSampleId } from "../src/lib/curated-gallery";
import examplePrompts from "../src/lib/home-example-prompts.json";
import { MEDIA, SAMPLE_PROMPTS, SHORTS_PRESETS, VIRAL_TEMPLATES } from "../src/lib/home-showcase";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const FIX =
  "Sample prompts live in two places only: src/lib/home-example-prompts.json (the original prompt, keyed by sample ID) and SAMPLE_PROMPTS in src/lib/home-showcase.ts (what the picture shows). Look at the media, put the text there, and point to it.";

describe("built-in gallery examples", () => {
  for (const zh of [false, true]) {
    const lang = zh ? "zh" : "en";
    for (const entry of buildCuratedGallery(zh)) {
      const asset = entry.videoUrl ?? entry.thumbnailUrl ?? "";

      it(`${entry.uuid} (${lang}) takes its prompt from the shared tables`, () => {
        const expected = entry.sampleId ? examplePrompts[entry.sampleId] : SAMPLE_PROMPTS[asset]?.[lang];
        expect(expected, `${entry.uuid}: no prompt on file for ${asset}. ${FIX}`).toBeTruthy();
        expect(entry.publicPrompt, `${entry.uuid}: prompt differs from the one on file. ${FIX}`).toBe(expected);
      });

      if (!zh) {
        it(`${entry.uuid} points at files that exist`, () => {
          for (const url of [entry.videoUrl, entry.thumbnailUrl]) {
            if (url) expect(existsSync(join(root, "public", url)), `${url} is missing from public/`).toBe(true);
          }
        });

        if (entry.sampleId) {
          it(`${entry.uuid} uses the sample ID that belongs to its clip`, () => {
            const media = Object.values(MEDIA).find((item) => item.promptId === entry.sampleId);
            expect(media?.src, `sample "${entry.sampleId}" belongs to ${media?.src}, not ${asset}`).toBe(asset);
            expect(curatedSampleId(entry.uuid)).toBe(entry.sampleId);
          });
        }
      }
    }
  }

  it("has no prompt text written inline", () => {
    for (const file of ["src/lib/curated-gallery.ts", "src/components/gallery/gallery-section.tsx"]) {
      const inline = read(file).match(/publicPrompt:\s*(zh\s*\?|["'`])/g);
      expect(inline, `${file} writes a prompt inline. ${FIX}`).toBeNull();
    }
  });
});

describe("homepage presets", () => {
  const onFile = new Set(Object.values(SAMPLE_PROMPTS));

  it("take every prompt from SAMPLE_PROMPTS", () => {
    for (const preset of [...VIRAL_TEMPLATES, ...SHORTS_PRESETS]) {
      expect(onFile.has(preset.prompt), `preset "${preset.id}" has its own prompt text. ${FIX}`).toBe(true);
    }
  });

  it("describe only media that exists", () => {
    for (const asset of Object.keys(SAMPLE_PROMPTS)) {
      expect(existsSync(join(root, "public", asset)), `SAMPLE_PROMPTS describes ${asset}, which is not in public/`).toBe(true);
    }
  });
});
