import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type TranslationPipeline,
} from "@huggingface/transformers";
import { WHISPER, translationModel } from "./audio-models";
import type { VoiceLanguage } from "./audio-voice-settings";

type Operation =
  | { kind: "speech"; pcm: Float32Array; source: VoiceLanguage; toEnglish: boolean }
  | { kind: "translate"; text: string; source: VoiceLanguage; target: VoiceLanguage };
export type LanguageWorkerRequest = Operation;
export type LanguageWorkerResponse =
  | { status: "progress"; file: string; progress: number }
  | { status: "done"; text: string }
  | { status: "error"; reason: string };

env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
let speech: AutomaticSpeechRecognitionPipeline | undefined;
let translation: TranslationPipeline | undefined;
const reply = (event: LanguageWorkerResponse) => self.postMessage(event);
const progress = (event: { status: string; file?: string; progress?: number }) => {
  if (event.status === "progress" && event.file && typeof event.progress === "number")
    reply({ status: "progress", file: event.file.split("/").at(-1)!, progress: Math.round(event.progress) });
};

self.onmessage = async (event: MessageEvent<Operation>) => {
  try {
    const input = event.data;
    let text = "";
    if (input.kind === "speech") {
      speech ??= await pipeline<"automatic-speech-recognition">(
        "automatic-speech-recognition",
        WHISPER.name,
        {
          revision: WHISPER.revision,
          device: "wasm",
          dtype: "q8",
          progress_callback: progress,
        },
      );
      const result = await speech(input.pcm, {
        language: input.source,
        task: input.toEnglish ? "translate" : "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      text = (Array.isArray(result) ? result[0] : result).text;
    } else {
      const model = translationModel(input.source, input.target);
      translation ??= await pipeline<"translation">("translation", model.name, {
        revision: model.revision,
        device: "wasm",
        dtype: "q8",
        progress_callback: progress,
      });
      // Keep long scripts below the model's token limit at sentence boundaries.
      const pieces = input.text.match(/[^.!?。！？\n]{1,220}[.!?。！？\n]*|[.!?。！？\n]+/gu) ?? [];
      const translated: string[] = [];
      for (const piece of pieces) {
        if (!piece.trim()) continue;
        const options = {
          ...(model.multilingual ? { src_lang: input.source, tgt_lang: input.target } : {}),
          max_new_tokens: 360,
        };
        // The translation pipeline documents these tokenizer options but types them as a full GenerationConfig.
        const result = await translation(
          piece.trim(),
          options as typeof options & Parameters<TranslationPipeline>[1],
        );
        const entry = Array.isArray(result[0]) ? result[0][0] : result[0];
        if (!entry?.translation_text?.trim()) throw new Error("Missing translation");
        translated.push(entry.translation_text.trim());
      }
      text = translated.join(" ");
    }
    if (!text.trim()) throw new Error("Empty output");
    reply({ status: "done", text: text.trim() });
  } catch (error) {
    reply({ status: "error", reason: error instanceof Error ? error.message : "Model processing failed" });
  }
};
