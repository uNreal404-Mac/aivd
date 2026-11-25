import { describe, expect, it } from "vitest";
import {
  ELEVENLABS_VOICES,
} from "@/ai/kie-market";
import {
  filterAudioJobs,
  historyRangeStart,
  VOICE_META,
  voiceGender,
  voiceHue,
  voiceWave,
} from "@/components/hf/audio-studio/audio-data";

const DAY = 24 * 60 * 60 * 1000;
// 2026-11-24 15:00 local time.
const NOW = new Date(2026, 10, 24, 15, 0, 0).getTime();

const jobs = [
  { uuid: "speech-now", model: "elevenlabs-v3", createdAt: NOW - 60_000 },
  { uuid: "music-yesterday", model: "suno-music", createdAt: NOW - DAY },
  { uuid: "sfx-10d", model: "suno-sounds", createdAt: NOW - 10 * DAY },
  { uuid: "speech-40d", model: "gemini-3-8-flash-tts", createdAt: NOW - 40 * DAY },
  { uuid: "undated", model: "suno-speech" },
];
const ids = (list: { uuid: string }[]) => list.map((job) => job.uuid);

describe("audio history filter", () => {
  it("keeps everything with no filter, in order", () => {
    expect(ids(filterAudioJobs(jobs, { type: "all", range: "all" }, NOW))).toEqual(ids(jobs));
  });

  it("narrows by kind of audio", () => {
    expect(ids(filterAudioJobs(jobs, { type: "speech", range: "all" }, NOW))).toEqual(["speech-now", "speech-40d", "undated"]);
    expect(ids(filterAudioJobs(jobs, { type: "music", range: "all" }, NOW))).toEqual(["music-yesterday"]);
    expect(ids(filterAudioJobs(jobs, { type: "sfx", range: "all" }, NOW))).toEqual(["sfx-10d"]);
  });

  it("narrows by date: today starts at local midnight; undated entries only show under all time", () => {
    expect(historyRangeStart("today", NOW)).toBe(new Date(2026, 10, 24).getTime());
    expect(ids(filterAudioJobs(jobs, { type: "all", range: "today" }, NOW))).toEqual(["speech-now"]);
    expect(ids(filterAudioJobs(jobs, { type: "all", range: "7d" }, NOW))).toEqual(["speech-now", "music-yesterday"]);
    expect(ids(filterAudioJobs(jobs, { type: "all", range: "30d" }, NOW))).toEqual(["speech-now", "music-yesterday", "sfx-10d"]);
  });

  it("combines both", () => {
    expect(filterAudioJobs(jobs, { type: "sfx", range: "7d" }, NOW)).toEqual([]);
  });
});

describe("voice helpers", () => {
  it("knows the gender of every voice the studio offers (the voice filter relies on it)", () => {
    const names = [...ELEVENLABS_VOICES.map((voice) => voice.name), "Fola", "Kore", "Puck", "Charon", "Zephyr", "Aoede", "Enceladus", "Leda", "Orus", "Achird"];
    for (const name of names) expect(VOICE_META[name], name).toBeDefined();
    expect(voiceGender("James")).toBe("M");
    expect(voiceGender("Bella")).toBe("F");
    expect(voiceGender("Nobody")).toBeNull();
  });

  it("gives each voice a stable colour and waveform", () => {
    expect(voiceHue("James")).toBe(voiceHue("James"));
    expect(voiceHue("James")).toBeGreaterThanOrEqual(0);
    expect(voiceHue("James")).toBeLessThan(360);
    const wave = voiceWave("Bella");
    expect(wave).toEqual(voiceWave("Bella"));
    expect(wave).toHaveLength(36);
    for (const height of wave) {
      expect(height).toBeGreaterThan(0);
      expect(height).toBeLessThanOrEqual(100);
    }
  });
});
