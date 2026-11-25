import type { LanguageWorkerRequest, LanguageWorkerResponse } from "./audio-language-worker";
import type { VoiceLanguage } from "./audio-voice-settings";

export const MAX_CLIP_BYTES = 32 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 180;
export function prepareAudioSamples(buffer: AudioBuffer): Float32Array {
  if (buffer.duration > MAX_CLIP_SECONDS || !buffer.length) throw new Error("CLIP_LIMIT");
  const pcm = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < pcm.length; i++) pcm[i] += data[i] / buffer.numberOfChannels;
  }
  return pcm;
}
export async function decodeClip(file: File) {
  if (!file.size || file.size > MAX_CLIP_BYTES) throw new Error("CLIP_LIMIT");
  const ctx = new OfflineAudioContext(1, 1, 16000);
  return prepareAudioSamples(await ctx.decodeAudioData(await file.arrayBuffer()));
}
export function runLanguageWorker(
  request: LanguageWorkerRequest,
  signal: AbortSignal,
  onProgress: (progress: number, file?: string) => void,
): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./audio-language-worker.ts", import.meta.url), { type: "module" });
    const close = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      close();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<LanguageWorkerResponse>) => {
      if (data.status === "progress") {
        onProgress(data.progress, data.file);
        return;
      }
      close();
      if (data.status === "done") resolve(data.text);
      else {
        console.warn("Local audio model error", data.reason);
        reject(new Error("LOCAL_MODEL"));
      }
    };
    worker.onerror = (e) => {
      console.warn("Local audio worker could not start", e.message);
      close();
      reject(new Error("LOCAL_MODEL"));
    };
    worker.postMessage(request, request.kind === "speech" ? [request.pcm.buffer as ArrayBuffer] : []);
  });
}
type Options = { sourceLanguage: VoiceLanguage; targetLanguage: VoiceLanguage };
type TranslatorFactory = {
  availability: (o: Options) => Promise<string>;
  create: (o: Options & { signal: AbortSignal; monitor: (m: EventTarget) => void }) => Promise<{
    translate: (text: string, options: { signal: AbortSignal }) => Promise<string>;
    destroy: () => void;
  }>;
};
export const browserTranslator = () => (window as Window & { Translator?: TranslatorFactory }).Translator;
