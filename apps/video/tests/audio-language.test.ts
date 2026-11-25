import { describe, expect, it, vi } from "vitest";
import { prepareAudioSamples, MAX_CLIP_SECONDS, runLanguageWorker } from "@/lib/audio-language";
import { translationModel } from "@/lib/audio-models";
import {
  cleanVoiceSettings,
  elevenDialogueInput,
  elevenSpeechInput,
  submittedVoiceSettings,
} from "@/lib/audio-voice-settings";

describe("on-device audio preparation", () => {
  it("mixes both channels without clipping the first sample", () => {
    const tracks = [Float32Array.from([1, 0.5]), Float32Array.from([-1, 0.25])];
    const source = {
      duration: 1,
      length: 2,
      numberOfChannels: 2,
      getChannelData: (index: number) => tracks[index],
    } as AudioBuffer;
    expect(Array.from(prepareAudioSamples(source))).toEqual([0, 0.375]);
  });
  it("rejects overlong and empty decodes before a model download", () => {
    for (const metadata of [
      { duration: MAX_CLIP_SECONDS + 1, length: 1 },
      { duration: 0, length: 0 },
    ]) {
      expect(() => prepareAudioSamples(metadata as AudioBuffer)).toThrow("CLIP_LIMIT");
    }
  });
  it("selects distinct, pinned models for each Chinese-English direction and a multilingual fallback", () => {
    expect(translationModel("zh", "en")).toMatchObject({
      name: "Xenova/opus-mt-zh-en",
      multilingual: false,
      mb: 113,
    });
    expect(translationModel("en", "zh")).toMatchObject({
      name: "Xenova/opus-mt-en-zh",
      multilingual: false,
      mb: 113,
    });
    expect(translationModel("ja", "fr")).toMatchObject({
      name: "Xenova/m2m100_418M",
      multilingual: true,
      mb: 632,
    });
  });
});

describe("model-specific voice controls", () => {
  it("omits defaults and hidden v2-only fields from legacy v3 retry signatures", () => {
    expect(submittedVoiceSettings("elevenlabs-v3", { stability: 0.5, expression: 0.8 })).toBeUndefined();
    expect(submittedVoiceSettings("suno-sounds", { expression: 0.8 })).toBeUndefined();
    expect(submittedVoiceSettings("elevenlabs-v3", { stability: 0.9, similarity: 0.2 })).toEqual({
      stability: 1,
    });
  });
  it("restores valid controls from old or corrupt drafts", () => {
    expect(cleanVoiceSettings(null)).toEqual({});
    expect(
      cleanVoiceSettings({ stability: -1, similarity: 0.8, expression: 2, language: "unknown" }),
    ).toEqual({ similarity: 0.8 });
  });
  it("uses the v3 stability enum when the user switches from a continuous v2 control", () => {
    expect(
      elevenDialogueInput({ stability: 0.67, similarity: 0.72, expression: 0.19, language: "zh" }),
    ).toEqual({ stability: 0.5, language_code: "zh" });
    expect(
      elevenSpeechInput({ stability: 0.67, similarity: 0.72, expression: 0.19, language: "zh" }),
    ).toEqual({ stability: 0.67, similarity_boost: 0.72, style: 0.19, language_code: "zh" });
  });
});

it("terminates a pending model worker and discards any late answer when the user cancels", async () => {
  const terminate = vi.fn();
  const postMessage = vi.fn();
  let fake: { onmessage?: (event: { data: unknown }) => void } = {};
  vi.stubGlobal(
    "Worker",
    class {
      terminate = terminate;
      postMessage = postMessage;
      onmessage?: (event: { data: unknown }) => void;
      constructor() {
        fake = this;
      }
    },
  );
  try {
    const signal = new AbortController();
    const result = runLanguageWorker(
      { kind: "translate", text: "Hello", source: "en", target: "zh" },
      signal.signal,
      vi.fn(),
    );
    signal.abort();
    fake.onmessage?.({ data: { status: "done", text: "late result" } });
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(postMessage).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
