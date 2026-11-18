"use client";

import { useState } from "react";
import { AudioLines, BookOpen, ChevronRight, Clock, Image as ImageIcon, Minus, Music, Plus, SlidersHorizontal } from "lucide-react";
import { NAV_AUDIO_MODELS, findNavModel } from "@/lib/nav-models";
import "./ai-video-studio.css";

const MODES = ["tts", "voice", "translate"] as const;
type Mode = (typeof MODES)[number];
// URL values used by the reference site's audio page.
const MODE_PARAMS: Record<string, Mode> = { voiceover: "tts", "change-voice": "voice", translate: "translate" };
const MAX_BATCH = 4;
const SCRIPT_MAX = 5000;
const DETAIL_MAX = 500;

/**
 * Audio studio, laid out after the reference site's audio page. Audio models
 * are not connected yet, so the controls work but generation is marked as
 * coming soon and nothing is submitted.
 */
export function AiAudioStudio({
  locale,
  initialVoiceMode = "",
  initialModelId = "",
}: {
  locale: string;
  initialVoiceMode?: string;
  initialModelId?: string;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const [mode, setMode] = useState<Mode>(MODE_PARAMS[initialVoiceMode] ?? "tts");
  const [modelId, setModelId] = useState(findNavModel("audio", initialModelId)?.id ?? NAV_AUDIO_MODELS[0].id);
  const selectedModel = findNavModel("audio", modelId) ?? NAV_AUDIO_MODELS[0];
  const [script, setScript] = useState("");
  const [detail, setDetail] = useState("");
  const [batch, setBatch] = useState(1);
  const [tab, setTab] = useState<"history" | "how">("how");
  const [notice, setNotice] = useState(false);

  const t = zh
    ? {
        modes: { tts: "文本转语音", voice: "变声", translate: "翻译" } as Record<Mode, string>,
        upload: "上传媒体",
        uploadSub: "最多 3 段声音或音频，或 1 张图片",
        optional: "可选",
        script: "脚本",
        scriptHint: "逐字写下要朗读的内容。",
        model: "模型",
        batch: "批量大小",
        detail: "声音详情",
        detailHint: "例如：年轻女声，英式口音，柔和而洪亮，兴奋，略带笑意",
        advanced: "高级设置",
        generate: "生成",
        soon: "即将上线",
        notice: "语音模型还在接入中，这次没有提交任务，也没有扣积分。",
        history: "历史记录",
        how: "工作原理",
        empty: "还没有音频，生成的内容会显示在这里。",
        heroTitle: "将文字变成语音",
        heroSub: "任意脚本都能生成逼真语音，随时用于你的视频和项目",
        card1: "挑选或克隆声音",
        card1Sub: "选择预设声音，克隆自己的声音，或挑选模型",
        card2: "撰写、描述并生成",
        card2Sub: "输入脚本，描述想要的声音，开始创作",
        voices: [
          { name: "温暖男声", tag: "旁白" },
          { name: "清亮女声", tag: "广告" },
          { name: "少年音", tag: "动画" },
        ],
        demoPrompt: "温暖、沉稳的男声，语速从容，略带沙哑，像深夜的自然纪录片旁白。",
        speed: "语速",
        pitch: "音调",
      }
    : {
        modes: { tts: "Text to speech", voice: "Voice changer", translate: "Translate" } as Record<Mode, string>,
        upload: "Upload media",
        uploadSub: "Up to 3 voices or audio clips, or 1 image",
        optional: "Optional",
        script: "Script",
        scriptHint: "Write exactly what the voice should read.",
        model: "Model",
        batch: "Batch size",
        detail: "Voice details",
        detailHint: "e.g. young female voice, British accent, soft but bright, excited, a slight laugh",
        advanced: "Advanced settings",
        generate: "Generate",
        soon: "Coming soon",
        notice: "Voice models are still being connected, so nothing was submitted and no credits were used.",
        history: "History",
        how: "How it works",
        empty: "No audio yet. Your generations will show up here.",
        heroTitle: "Turn text into speech",
        heroSub: "Lifelike voices for any script, ready for your videos and projects",
        card1: "Pick or clone a voice",
        card1Sub: "Choose a preset, clone your own voice, or pick a model",
        card2: "Write, describe and generate",
        card2Sub: "Enter a script, describe the voice and create",
        voices: [
          { name: "Warm narrator", tag: "Narration" },
          { name: "Bright voice", tag: "Ads" },
          { name: "Young voice", tag: "Animation" },
        ],
        demoPrompt: "Warm, calm male voice, unhurried pace, a little gravel, like a late-night nature documentary narrator.",
        speed: "Speed",
        pitch: "Pitch",
      };

  return (
    <div className="vs-root">
      <aside aria-label={t.modes[mode]} className="vs-panel">
        <div className="vs-modes" role="tablist">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={option === mode}
              onClick={() => setMode(option)}
              className={option === mode ? "vs-mode vs-mode-on" : "vs-mode"}
            >
              {t.modes[option]}
            </button>
          ))}
        </div>

        <div className="vs-upload vs-upload-off" aria-disabled="true">
          <span className="vs-upload-tag">{t.optional}</span>
          <span className="vs-upload-icons" aria-hidden="true">
            <span><AudioLines className="h-4 w-4" /></span>
            <span><Music className="h-4 w-4" /></span>
            <span><ImageIcon className="h-4 w-4" /></span>
          </span>
          <span className="vs-upload-title">{t.upload}</span>
          <span className="vs-upload-sub">{t.uploadSub}</span>
        </div>

        <div className="vs-card vs-prompt">
          <label htmlFor="audio-script" className="vs-prompt-label vs-prompt-label-muted">{t.script}</label>
          <textarea
            id="audio-script"
            value={script}
            maxLength={SCRIPT_MAX}
            placeholder={t.scriptHint}
            onChange={(event) => {
              setScript(event.target.value);
              setNotice(false);
            }}
          />
        </div>

        <label htmlFor="audio-model" className="vs-card vs-select">
          <span className="min-w-0 flex-1">
            <span className="vs-card-label">{t.model}</span>
            <span className="vs-card-value">
              {selectedModel.name} <span className="vs-soon">{t.soon}</span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hfv-muted)]" aria-hidden="true" />
          <select id="audio-model" value={modelId} onChange={(event) => setModelId(event.target.value)}>
            {NAV_AUDIO_MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="vs-card">
          <span className="vs-card-value flex-1">{t.batch}</span>
          <span className="vs-stepper">
            <button type="button" aria-label={zh ? "减少" : "Fewer"} disabled={batch <= 1} onClick={() => setBatch((value) => Math.max(1, value - 1))}>
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span>
              {batch}/{MAX_BATCH}
            </span>
            <button type="button" aria-label={zh ? "增加" : "More"} disabled={batch >= MAX_BATCH} onClick={() => setBatch((value) => Math.min(MAX_BATCH, value + 1))}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        </div>

        <div className="vs-card vs-prompt">
          <span className="flex items-center justify-between">
            <label htmlFor="audio-detail" className="vs-prompt-label vs-prompt-label-muted">{t.detail}</label>
            <span className="vs-soon">{t.optional}</span>
          </span>
          <textarea
            id="audio-detail"
            className="vs-textarea-short"
            value={detail}
            maxLength={DETAIL_MAX}
            placeholder={t.detailHint}
            onChange={(event) => setDetail(event.target.value)}
          />
          <span className="vs-count">
            {detail.length}/{DETAIL_MAX}
          </span>
        </div>

        <div className="vs-card vs-card-off">
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="vs-card-value flex-1">{t.advanced}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hfv-muted)]" aria-hidden="true" />
        </div>

        <button type="button" className="vs-generate vs-generate-soon" onClick={() => setNotice(true)}>
          {t.generate}
          <span className="vs-generate-cost">{t.soon}</span>
        </button>
        {notice ? <output aria-live="polite" className="vs-notice">{t.notice}</output> : null}
      </aside>

      <section aria-label={t.heroTitle} className="vs-stage">
        <div className="vs-stage-tabs">
          <button type="button" aria-pressed={tab === "history"} onClick={() => setTab("history")} className={tab === "history" ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t.history}
          </button>
          <button type="button" aria-pressed={tab === "how"} onClick={() => setTab("how")} className={tab === "how" ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {t.how}
          </button>
        </div>

        {tab === "history" ? (
          <div className="vs-empty">
            <Clock className="h-6 w-6" aria-hidden="true" />
            <p>{t.empty}</p>
          </div>
        ) : (
          <div className="vs-howto vs-howto-center">
            <h2 className="vs-howto-title">{t.heroTitle}</h2>
            <p className="vs-howto-sub">{t.heroSub}</p>
            <div className="as-cards">
              <div className="as-card">
                <h3 className="vs-step-title">{t.card1}</h3>
                <p className="vs-step-body">{t.card1Sub}</p>
                <div className="as-voices">
                  {t.voices.map((voice, index) => (
                    <div key={voice.name} className={index === 0 ? "as-voice as-voice-main" : "as-voice"}>
                      <span className="as-voice-wave" aria-hidden="true">
                        <AudioLines className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="as-voice-name">{voice.name}</span>
                        <span className="as-voice-tag">{voice.tag}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="as-card">
                <h3 className="vs-step-title">{t.card2}</h3>
                <p className="vs-step-body">{t.card2Sub}</p>
                <div className="as-mock">
                  <div className="as-mock-box">
                    <span className="vs-card-label">Prompt</span>
                    <p className="as-mock-text">{t.demoPrompt}</p>
                  </div>
                  <div className="as-mock-row">
                    <span className="as-mock-box as-mock-slider">
                      {t.speed}
                      <span className="as-mock-track" aria-hidden="true" />
                      1.0
                    </span>
                    <span className="as-mock-box as-mock-slider">
                      {t.pitch}
                      <span className="as-mock-track" aria-hidden="true" />
                      1.0
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
