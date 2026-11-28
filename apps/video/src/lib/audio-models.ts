import type { VoiceLanguage } from "./audio-voice-settings";

export const WHISPER = {
  name: "Xenova/whisper-tiny",
  revision: "5332fcc35e32a33b86612b9a57a89be7906102b1",
  card: "https://huggingface.co/Xenova/whisper-tiny",
  mb: 41,
};

/** Select small bilingual weights for the most common pairs. Each revision identifies the published ONNX conversion. */
export function translationModel(source: VoiceLanguage, target: VoiceLanguage) {
  if (source === "en" && target === "zh")
    return {
      name: "Xenova/opus-mt-en-zh",
      revision: "046f55aec303cdee3e0318604406d4df20f1e8ea",
      multilingual: false,
      mb: 113,
      credit: "Helsinki-NLP OPUS-MT · Apache 2.0",
      card: "https://huggingface.co/Helsinki-NLP/opus-mt-en-zh",
    };
  if (source === "zh" && target === "en")
    return {
      name: "Xenova/opus-mt-zh-en",
      revision: "39d480d52a9ea3065a1f117adfe4dbc55de10e6f",
      multilingual: false,
      mb: 113,
      credit: "Helsinki-NLP OPUS-MT · CC BY 4.0",
      card: "https://huggingface.co/Helsinki-NLP/opus-mt-zh-en",
    };
  return {
    name: "Xenova/m2m100_418M",
    revision: "9c374f0b7aca709787cea97b047bfbbd1559d177",
    multilingual: true,
    mb: 632,
    credit: "Meta M2M100 · MIT",
    card: "https://huggingface.co/facebook/m2m100_418M",
  };
}

export async function modelWeightsCached(model: { name: string; revision: string }) {
  try {
    if (!(await caches.has("transformers-cache"))) return false;
    const cache = await caches.open("transformers-cache");
    const prefix = `https://huggingface.co/${model.name}/resolve/${model.revision}/onnx/`;
    const matches = await Promise.all(
      ["encoder_model_quantized.onnx", "decoder_model_merged_quantized.onnx"].map((file) =>
        cache.keys(prefix + file),
      ),
    );
    return matches.every((keys) => keys.length > 0);
  } catch {
    return false;
  }
}
