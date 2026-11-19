"use client";

import { useMemo, useRef, useState } from "react";
import { AudioLines, BookOpen, ChevronRight, Clock, Image as ImageIcon, Music, RotateCcw, Sparkles } from "lucide-react";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import { submitMedia, useMediaJobs } from "@/lib/media-studio";
import { CopyPromptButton, DownloadLink, PendingCard, WaveformPlayer } from "@/components/hf/studio-results";
import { StateBlock } from "@/components/states/state-block";
import "./ai-video-studio.css";

const MODES = ["tts", "music", "voice", "translate"] as const;
type Mode = (typeof MODES)[number];
// URL values used by the reference site's audio page, plus our music tab.
const MODE_PARAMS: Record<string, Mode> = { voiceover: "tts", music: "music", "change-voice": "voice", translate: "translate" };
// Which models each tab offers. Voice changing and translation need an audio
// upload that no connected model accepts yet.
const MODE_MODELS: Record<Mode, string[]> = {
  tts: ["elevenlabs-v3", "elevenlabs-multilingual-v2", "elevenlabs-turbo-2-5", "gemini-3-8-flash-tts", "suno-speech"],
  music: ["suno-music", "suno-sounds"],
  voice: [],
  translate: [],
};
const DETAIL_MAX = 500;
const AUDIO_MODELS = marketModelsOf("audio");

/** Audio studio, laid out after the reference site's audio page. */
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
  const signIn = useSigninModal();
  const initialModel = getMarketModel(initialModelId);
  // A model link opens the tab that offers that model.
  const startMode: Mode =
    initialModel?.kind === "audio"
      ? ((Object.keys(MODE_MODELS) as Mode[]).find((key) => MODE_MODELS[key].includes(initialModel.id)) ?? "tts")
      : (MODE_PARAMS[initialVoiceMode] ?? "tts");
  const [mode, setMode] = useState<Mode>(startMode);
  const [modelId, setModelId] = useState(
    initialModel?.kind === "audio" ? initialModel.id : (MODE_MODELS[startMode][0] ?? AUDIO_MODELS[0].id),
  );
  const model = getMarketModel(modelId) ?? AUDIO_MODELS[0];
  const [voice, setVoice] = useState(model.options.voices?.[0]?.id ?? "");
  const [script, setScript] = useState("");
  const { data: session, isPending: sessionLoading } = useSession();
  const signedOut = !sessionLoading && !session;
  const draft = usePromptDraft("audio", script, setScript, false);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { jobs, add } = useMediaJobs("audio");
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const reuse = (text: string) => {
    setScript(text);
    setNotice(null);
    scriptRef.current?.focus();
  };
  const [tab, setTab] = useState<"history" | "how">("how");
  const shownTab = tab;

  const modeModels = MODE_MODELS[mode]
    .map((id) => getMarketModel(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  const available = modeModels.length > 0;
  const maxScript = model.options.maxPromptLength ?? 5000;
  const credits = useMemo(() => marketCredits(model, { prompt: script, voice, style: detail }), [model, script, voice, detail]);

  const chooseModel = (id: string) => {
    const next = getMarketModel(id);
    if (!next) return;
    setModelId(id);
    setVoice((current) => (next.options.voices?.some((item) => item.id === current) ? current : (next.options.voices?.[0]?.id ?? "")));
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    const first = MODE_MODELS[next][0];
    if (first && !MODE_MODELS[next].includes(modelId)) chooseModel(first);
  };

  const t = zh
    ? {
        modes: { tts: "文本转语音", music: "音乐与音效", voice: "变声", translate: "翻译" } as Record<Mode, string>,
        upload: "上传媒体",
        uploadSub: "变声和翻译需要上传音频，即将上线",
        optional: "可选",
        script: mode === "music" ? "描述" : "脚本",
        scriptHint: mode === "music" ? "描述想要的歌曲或音效，例如：雨夜城市的慢节奏爵士。" : "逐字写下要朗读的内容。",
        model: "模型",
        voice: "音色",
        detail: mode === "music" ? "曲风" : "声音详情",
        detailHint: mode === "music" ? "例如：爵士、钢琴、慢节奏、温暖" : "例如：语速放慢，带一点笑意（Gemini 支持）",
        generate: "生成",
        submitting: "提交中…",
        soon: "即将上线",
        soonNote: "变声和翻译需要上传音频，目前接入的模型还不支持，即将上线。",
        history: "历史记录",
        how: "工作原理",
        empty: "还没有音频，生成的内容会显示在这里。",
        generating: "生成中…",
        failed: "生成失败，积分已退回",
        heroTitle: "将文字变成语音",
        heroSub: "任意脚本都能生成逼真语音，也能一句话生成歌曲和音效",
        card1: "挑选声音",
        card1Sub: "选择 ElevenLabs 或 Gemini 的预设音色",
        card2: "撰写、描述并生成",
        card2Sub: "输入脚本，描述想要的声音，开始创作",
        demoVoices: [
          { name: "James", tag: "ElevenLabs" },
          { name: "Bella", tag: "ElevenLabs" },
          { name: "Kore", tag: "Gemini" },
        ],
        demoPrompt: "温暖、沉稳的男声，语速从容，略带沙哑，像深夜的自然纪录片旁白。",
      }
    : {
        modes: { tts: "Text to speech", music: "Music & sound", voice: "Voice changer", translate: "Translate" } as Record<Mode, string>,
        upload: "Upload media",
        uploadSub: "Voice changing and translation need an audio upload; coming soon",
        optional: "Optional",
        script: mode === "music" ? "Description" : "Script",
        scriptHint: mode === "music" ? "Describe the song or sound, e.g. slow jazz for a rainy city night." : "Write exactly what the voice should read.",
        model: "Model",
        voice: "Voice",
        detail: mode === "music" ? "Style" : "Voice details",
        detailHint: mode === "music" ? "e.g. jazz, piano, slow, warm" : "e.g. slower, with a smile (Gemini)",
        generate: "Generate",
        submitting: "Submitting…",
        soon: "Coming soon",
        soonNote: "Voice changing and translation need an audio upload that the connected models do not take yet.",
        history: "History",
        how: "How it works",
        empty: "No audio yet. Your generations will show up here.",
        generating: "Generating…",
        failed: "Failed, credits returned",
        heroTitle: "Turn text into speech",
        heroSub: "Lifelike voices for any script, plus songs and sound effects from one line",
        card1: "Pick a voice",
        card1Sub: "Choose a preset voice from ElevenLabs or Gemini",
        card2: "Write, describe and generate",
        card2Sub: "Enter a script, describe the voice and create",
        demoVoices: [
          { name: "James", tag: "ElevenLabs" },
          { name: "Bella", tag: "ElevenLabs" },
          { name: "Kore", tag: "Gemini" },
        ],
        demoPrompt: "Warm, calm male voice, unhurried pace, a little gravel, like a late-night nature documentary narrator.",
      };

  const generate = async () => {
    if (!available || submitting) return;
    // An empty script gets a hint and the cursor, not a dead button.
    if (!script.trim()) {
      setNotice(zh ? "先写下要朗读的内容。" : "Write what should be read out first.");
      scriptRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const result = await submitMedia(
      { model: model.id, prompt: script.trim(), voice: voice || undefined, style: detail.trim() || undefined },
      zh,
    );
    setSubmitting(false);
    if (!result.ok) {
      setNotice(result.message);
      if (result.needsLogin) signIn.onOpen();
      return;
    }
    add({ uuid: result.uuid, status: "queued", urls: [], prompt: script.trim(), model: model.id, createdAt: Date.now() });
    setTab("history");
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
              onClick={() => chooseMode(option)}
              className={option === mode ? "vs-mode vs-mode-on" : "vs-mode"}
            >
              {t.modes[option]}
            </button>
          ))}
        </div>

        {!available ? (
          <>
            <div className="vs-upload vs-upload-off" aria-disabled="true">
              <span className="vs-upload-tag">{t.soon}</span>
              <span className="vs-upload-icons" aria-hidden="true">
                <span><AudioLines className="h-4 w-4" /></span>
                <span><Music className="h-4 w-4" /></span>
                <span><ImageIcon className="h-4 w-4" /></span>
              </span>
              <span className="vs-upload-title">{t.upload}</span>
              <span className="vs-upload-sub">{t.uploadSub}</span>
            </div>
            <p className="vs-hint">{t.soonNote}</p>
          </>
        ) : (
          <>
            <div className="vs-card vs-prompt">
              <label htmlFor="audio-script" className="vs-prompt-label vs-prompt-label-muted">{t.script}</label>
              <textarea
                id="audio-script"
                ref={scriptRef}
                value={script}
                maxLength={maxScript}
                placeholder={t.scriptHint}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && script.trim() && !submitting) {
                    event.preventDefault();
                    void generate();
                  }
                }}
                onChange={(event) => {
                  setScript(event.target.value);
                  setNotice(null);
                }}
              />
              {draft.restored ? (
                <p className="draft-note">
                  {zh ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
                  <button type="button" onClick={draft.discard}>
                    {zh ? "清空" : "Clear"}
                  </button>
                </p>
              ) : null}
              <span className="vs-count">
                {script.length}/{maxScript}
              </span>
            </div>

            <label htmlFor="audio-model" className="vs-card vs-select">
              <span className="min-w-0 flex-1">
                <span className="vs-card-label">{t.model}</span>
                <span className="vs-card-value">{model.name}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hfv-muted)]" aria-hidden="true" />
              <select id="audio-model" value={modelId} onChange={(event) => chooseModel(event.target.value)}>
                {modeModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            {model.options.voices?.length ? (
              <fieldset className="as-voice-pick">
                <legend className="vs-card-label">{t.voice}</legend>
                <div className="as-voice-grid">
                  {model.options.voices.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={voice === item.id}
                      className={voice === item.id ? "as-voice-opt as-voice-opt-on" : "as-voice-opt"}
                      onClick={() => setVoice(item.id)}
                    >
                      <span className="as-voice-avatar" aria-hidden="true">
                        {item.name.slice(0, 1)}
                      </span>
                      {item.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {model.id === "gemini-3-8-flash-tts" || model.id === "suno-music" ? (
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
              </div>
            ) : null}

            <button type="button" className="vs-generate as-generate" disabled={submitting} onClick={() => void generate()}>
              {submitting ? t.submitting : t.generate}
              <span className="vs-generate-cost">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {credits}
              </span>
            </button>
          </>
        )}
        {notice ? <output aria-live="polite" className="vs-notice">{notice}</output> : null}
      </aside>

      <section aria-label={t.heroTitle} className="vs-stage">
        <div className="vs-stage-tabs">
          <button type="button" aria-pressed={shownTab === "history"} onClick={() => setTab("history")} className={shownTab === "history" ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t.history}
            {jobs.length > 0 ? <span className="vs-stage-count">{jobs.length}</span> : null}
          </button>
          <button type="button" aria-pressed={shownTab === "how"} onClick={() => setTab("how")} className={shownTab === "how" ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {t.how}
          </button>
        </div>

        {shownTab === "history" ? (
          jobs.length === 0 ? (
            <StateBlock
              icon={AudioLines}
              title={signedOut ? (zh ? "登录后查看你的音频" : "Sign in to see your audio") : zh ? "还没有生成过音频" : "No audio yet"}
              body={
                signedOut
                  ? zh
                    ? "生成过的配音和音乐都保存在账户里，换设备也能听到。也可以先从一句示例开始："
                    : "Your voiceovers and music are kept in your account, on any device. Or start from an example:"
                  : zh
                    ? "在左边写好文本再点生成，配音和音乐会出现在这里。也可以从一句示例开始："
                    : "Write your text on the left and generate; voiceovers and music land here. Or start from an example:"
              }
              actions={signedOut ? [{ label: zh ? "登录" : "Sign in", onClick: () => signIn.onOpen(), primary: true }] : []}
            >
              <div className="st-ideas">
                {(zh
                  ? ["欢迎收看本期节目，今天我们聊聊 AI 视频。", "清晨的海边，轻柔的钢琴与海浪声。", "一段热血的游戏预告片旁白。"]
                  : ["Welcome back to the show. Today we talk about AI video.", "A calm morning by the sea, soft piano and waves.", "An epic voiceover for a game trailer."]
                ).map((line) => (
                  <button key={line} type="button" className="st-idea" onClick={() => reuse(line)}>
                    <Sparkles aria-hidden="true" />
                    {line}
                  </button>
                ))}
              </div>
            </StateBlock>
          ) : (
            <div className="as-list">
              {jobs.map((job) => {
                const done = job.status === "completed" && job.urls.length > 0;
                return (
                  <div key={job.uuid} className="as-item">
                    <div className="as-item-head">
                      <span className="as-item-model">{getMarketModel(job.model)?.name ?? job.model}</span>
                      <span className="as-item-prompt" title={job.prompt}>{job.prompt}</span>
                      {done ? (
                        <span className="as-item-tools">
                          <CopyPromptButton prompt={job.prompt} zh={zh} />
                          <button type="button" className="sr-icon" title={zh ? "复用文本" : "Reuse text"} aria-label={zh ? "复用文本" : "Reuse text"} onClick={() => reuse(job.prompt)}>
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                    {done ? (
                      job.urls.map((url, index) => (
                        <div key={`${job.uuid}-${index}`} className="as-item-player">
                          <WaveformPlayer url={url} zh={zh} />
                          <DownloadLink url={url} zh={zh} className="as-item-dl" />
                        </div>
                      ))
                    ) : (
                      <PendingCard
                        className="as-pending"
                        status={job.status === "completed" ? "failed" : job.status}
                        since={job.createdAt}
                        message={job.status === "completed" ? (zh ? "没有返回音频" : "No audio came back") : job.message}
                        zh={zh}
                        onReuse={() => reuse(job.prompt)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="vs-howto vs-howto-center">
            <h2 className="vs-howto-title">{t.heroTitle}</h2>
            <p className="vs-howto-sub">{t.heroSub}</p>
            <div className="as-cards">
              <div className="as-card">
                <h3 className="vs-step-title">{t.card1}</h3>
                <p className="vs-step-body">{t.card1Sub}</p>
                <div className="as-voices">
                  {t.demoVoices.map((item, index) => (
                    <div key={item.name} className={index === 0 ? "as-voice as-voice-main" : "as-voice"}>
                      <span className="as-voice-wave" aria-hidden="true">
                        <AudioLines className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="as-voice-name">{item.name}</span>
                        <span className="as-voice-tag">{item.tag}</span>
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
                    <span className="vs-card-label">{zh ? "提示词" : "Prompt"}</span>
                    <p className="as-mock-text">{t.demoPrompt}</p>
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
