"use client";

import { AudioFillSlider } from "./audio-controls";
import {
  LANGUAGE_NAMES,
  VOICE_DEFAULTS,
  VOICE_LANGUAGES,
  type VoiceLanguage,
  type VoiceSettings,
} from "@/lib/audio-voice-settings";

export function ElevenControls({
  model,
  settings,
  onChange,
  zh,
  language = true,
}: {
  model: string;
  settings: VoiceSettings;
  onChange: (next: VoiceSettings) => void;
  zh: boolean;
  language?: boolean;
}) {
  const v3 = model === "elevenlabs-v3";
  const set = (field: keyof VoiceSettings, value: number | VoiceLanguage | undefined) =>
    onChange({ ...settings, [field]: value });
  return (
    <>
      {v3 ? (
        <label className="au-effect-choice au-settings-select">
          <span>{zh ? "稳定性" : "Stability"}</span>
          <select
            value={Math.round((settings.stability ?? 0.5) * 2) / 2}
            onChange={(e) => set("stability", Number(e.target.value))}
          >
            <option value={0}>{zh ? "创意" : "Creative"}</option>
            <option value={0.5}>{zh ? "自然" : "Natural"}</option>
            <option value={1}>{zh ? "稳健" : "Robust"}</option>
          </select>
        </label>
      ) : (
        (
          [
            ["stability", zh ? "稳定性" : "Stability"],
            ["similarity", zh ? "相似度" : "Similarity"],
            ["expression", zh ? "风格强度" : "Style intensity"],
          ] as const
        ).map(([field, label]) => (
          <AudioFillSlider
            key={field}
            label={label}
            value={settings[field] ?? VOICE_DEFAULTS[field]}
            min={0}
            max={1}
            step={0.01}
            format={(n) => `${Math.round(n * 100)}%`}
            onChange={(n) => set(field, n)}
          />
        ))
      )}
      {language ? (
        <label className="au-effect-choice au-settings-select">
          <span>{zh ? "朗读语言" : "Speech language"}</span>
          <select
            value={settings.language ?? ""}
            onChange={(e) => set("language", (e.target.value as VoiceLanguage) || undefined)}
          >
            <option value="">{zh ? "自动检测" : "Automatic"}</option>
            {VOICE_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
