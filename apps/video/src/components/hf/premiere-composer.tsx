"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ProviderType } from "@/ai/types";
import { localizedHref } from "@/lib/du-home";
import { MAX_PROMPT_LENGTH } from "@/lib/image-to-video";
import {
  estimatePremiereCredits, getPremiereModels, resolvePremiereSettings, savePremiereDraft,
  type PremiereMode, type PremiereSettings,
} from "@/lib/premiere-generator";
import s from "./premiere-composer.module.css";

const samples = [
  ["海岸航拍", "沿黑沙海岸低空飞行，让浪花从画面右侧涌入。", "Coastal flyover", "Fly low along a black-sand coast. Let a breaking wave enter from the right."],
  ["棱镜人像", "固定镜头对准眼睛。慢慢转动玻璃棱镜，让折射光从面颊移到瞳孔。", "Prism portrait", "Hold on the eye. Rotate a glass prism until a band of refracted light travels across the cheek to the pupil."],
  ["石拱推进", "从雾中缓慢推向石拱，把门洞下的行人留在画面中央。", "Stone arch", "Push slowly through the mist toward a stone arch, keeping the walker centered in the opening."],
  ["船尾跟拍", "沿船尾平移，跟随举杯的两个人，让午后的日光落在水面上。", "Track the stern", "Track along the stern as two people raise their glasses. Catch the afternoon sun on the water."],
  ["逆光转身", "用固定中景拍人物缓缓转身，让发梢的逆光从轮廓扫到眼睛。", "Backlit turn", "Hold a medium shot as the subject turns, bringing a rim of light from their hair to their eye."],
  ["金属环绕", "环绕黑底上的金属镜组移动半圈，用一道窄光扫出金属拉丝纹理。", "Product orbit", "Circle halfway around a metal lens assembly against black. Rake a narrow reflection over its brushed surface."],
] as const;

function Choice({ label, value, options, onChange, name, disabled = false }: {
  label: string; value: string; name: string; options: { value: string; text: string }[];
  onChange: (value: string) => void; disabled?: boolean;
}) {
  return <label className={s.choice}>
    <span className="sr-only">{label}</span>
    <select name={name} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option.value} value={option.value}>{option.text}</option>)}
    </select>
    {!disabled && <ChevronDown aria-hidden="true" size={12}/>}
  </label>;
}

export function PremiereComposer({ lang, provider, shot }: { lang: string; provider?: ProviderType; shot: string }) {
  const zh = lang.startsWith("zh");
  const [mode, setMode] = useState<PremiereMode>("text-to-video");
  const [prompt, setPrompt] = useState("");
  const [choice, setChoice] = useState<Partial<PremiereSettings>>({ quality: "720p" });
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const models = getPremiereModels(mode, provider);
  const settings = resolvePremiereSettings(models, choice);
  const active = models.find(model => model.id === settings?.model);
  const estimated = settings ? estimatePremiereCredits(settings) : null;
  const estimate = typeof estimated === "number" && Number.isFinite(estimated) ? estimated : null;
  const isImage = mode === "image-to-video";
  const destination = localizedHref(lang, "/" + mode);
  const max = isImage ? MAX_PROMPT_LENGTH : 2000;
  useEffect(() => {
    const ready = () => setLeaving(false);
    window.addEventListener("pageshow", ready);
    return () => window.removeEventListener("pageshow", ready);
  }, []);

  function switchMode(next: PremiereMode) {
    setMode(next);
    setError("");
  }
  function fill(value: string) {
    setPrompt(value);
    setError("");
    input.current?.focus({preventScroll: true});
  }
  function change(values: Partial<PremiereSettings>) {
    if (settings) setChoice({ ...settings, ...values });
    setError("");
  }
  function openStudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || leaving) return;
    const draft = prompt.trim();
    if (!draft || draft.length > max) {
      setError(!draft ? (zh ? "写一句镜头描述，或选择下方示例。" : "Describe a shot or choose a sample below.")
        : (zh ? `请把提示词缩短到 ${max} 字以内。` : `Shorten the prompt to ${max} characters.`));
      input.current?.focus();
      return;
    }
    try {
      savePremiereDraft(mode, draft, settings);
      setLeaving(true);
      window.location.assign(destination);
    } catch {
      setLeaving(false);
      setError(zh ? "草稿未能带入工作台。你的文字仍在这里，可以复制后重试。" : "Your draft could not be transferred. The text is still here to copy or retry.");
    }
  }
  return <div className={s.group}>
    <form className={s.composer} action={destination} method="get" onSubmit={openStudio} aria-busy={leaving} aria-label={zh ? "视频生成器" : "Video composer"}>
      <div className={s.top}>
        <fieldset className={s.modes} aria-label={zh ? "生成方式" : "Generation mode"}>
          <button type="button" aria-pressed={!isImage} onClick={() => switchMode("text-to-video")}>{zh ? "文生视频" : "Text to video"}</button>
          <button type="button" aria-pressed={isImage} onClick={() => switchMode("image-to-video")}>{zh ? "图生视频" : "Image to video"}</button>
        </fieldset>
        <button className={s.ghost} type="button" onClick={() => fill(shot)}>{zh ? "用这段分镜" : "Use this shot"}</button>
      </div>
      <label className="sr-only" htmlFor="premiere-prompt">{zh ? "镜头描述" : "Shot description"}</label>
      <textarea id="premiere-prompt" ref={input} name="prompt" value={prompt} maxLength={max} rows={2} autoComplete="off"
        aria-invalid={error ? true : undefined} aria-describedby={error ? "premiere-error" : undefined}
        placeholder={zh ? samples[0][1] : samples[0][3]} onChange={event => { setPrompt(event.target.value); setError(""); }} />
      {active && settings ? <fieldset className={s.settings} aria-label={zh ? "镜头参数" : "Shot settings"}>
        <Choice label={zh ? "模型" : "Model"} name="model" options={models.map(m => ({ value:m.id, text:m.name }))} value={active.id} onChange={model => change({ model })} />
        <Choice label={zh ? "画幅比例" : "Aspect ratio"} name="aspectRatio" options={active.aspectRatios.map(value => ({value, text:value}))} value={settings.aspectRatio} onChange={aspectRatio => change({aspectRatio})} />
        <Choice label={zh ? "时长" : "Duration"} name="duration" options={active.durations.map(n => ({value:String(n), text:zh ? n+" 秒" : n+" s"}))} value={String(settings.duration)} onChange={n => change({duration:Number(n)})} />
        {active.qualities?.length && settings.quality ? <Choice label={zh ? "分辨率" : "Resolution"} name="quality"
          options={active.qualities.map(value => ({value, text:value}))} value={settings.quality} onChange={quality => change({quality})} />
          : <span className={s.fixed}>{zh ? "画质随模型" : "Model quality"}</span>}
      </fieldset> : <output className={s.message}>{zh ? "此模式暂无可用模型，可切换生成方式。" : "No models are available in this mode. Choose another mode."}</output>}
      <div className={s.actions}>
        {isImage ? <span className={s.hint}>{zh ? "下一步添加图片" : "Add an image in the studio"}</span> :
          <button className={s.ghost} type="button" onClick={() => {switchMode("image-to-video");input.current?.focus({ preventScroll:true });}}>{zh ? "从图片开始" : "Start with an image"}</button>}
        <button className={s.primary} type="submit" disabled={!settings || leaving}>
          {leaving ? (zh ? "进入工作台…" : "Opening studio…") : (zh ? "免费生成视频" : "Generate Video Free")}
          {!leaving && estimate !== null && <span> · {estimate} {zh ? "积分" : "credits"}</span>}
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
      {error && <p id="premiere-error" role="alert" className={s.message}>{error}</p>}
    </form>
    <fieldset className={s.samples} aria-label={zh ? "使用示例提示词" : "Use a sample prompt"}>
      {samples.map(([cn, cnPrompt, en, enPrompt]) => <button type="button" key={en} onClick={() => fill(zh ? cnPrompt : enPrompt)}>{zh ? cn : en}</button>)}
    </fieldset>
  </div>;
}
