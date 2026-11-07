"use client";

import { useState } from "react";
import { ImageIcon, Info, Sparkles } from "lucide-react";

export function AiImageStudio({ locale }: { locale: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const copy = zh ? {
    title: "文字生成图片",
    subtitle: "描述你想象中的画面，作品将直接显示在这里。",
    result: "生成后的图片将在这里展示",
    resultHint: "当前尚未接入图片生成模型。",
    prompt: "提示词",
    placeholder: "描述主体、构图、光线、色彩和风格……",
    model: "图片模型",
    unavailable: "待接入图片模型",
    aspect: "画面比例",
    generate: "生成图片",
    disabled: "图片生成接口尚未配置。接入图片模型后，这里会直接显示生成结果。不会扣除积分。",
  } : {
    title: "Text to Image",
    subtitle: "Describe the image you imagine. Your result will appear here.",
    result: "Your generated image will appear here",
    resultHint: "No image generation model is connected yet.",
    prompt: "Prompt",
    placeholder: "Describe the subject, composition, light, color and style…",
    model: "Image model",
    unavailable: "Image model coming soon",
    aspect: "Aspect ratio",
    generate: "Generate image",
    disabled: "The image generation API is not configured yet. Once connected, results will appear here. No credits will be charged.",
  };

  return <div className="h-full w-full overflow-y-auto bg-[var(--du-bg)] px-4 py-7 text-[var(--du-text)] sm:px-8 lg:px-12">
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-7"><p className="text-xs uppercase tracking-[0.18em] text-[var(--du-accent-text)]">aivd.ai · {zh ? "图片工作台" : "Image studio"}</p><h1 className="mt-2 text-3xl font-semibold sm:text-5xl">{copy.title}</h1><p className="mt-3 text-sm text-[var(--du-text-muted)] sm:text-base">{copy.subtitle}</p></div>
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[28px] border border-[var(--du-border)] bg-[var(--du-surface)] px-6 text-center sm:min-h-[340px]">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--du-border-strong)] bg-[var(--du-accent-soft)] text-[var(--du-accent-text)]"><ImageIcon className="h-8 w-8" /></span>
        <p className="mt-5 text-lg font-medium">{copy.result}</p><p className="mt-2 text-sm text-[var(--du-text-muted)]">{copy.resultHint}</p>
      </div>
      <div className="mx-auto mt-7 max-w-[980px] rounded-[28px] border border-[var(--du-border)] bg-[var(--du-surface)] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{copy.title}</h2><p className="mt-1 text-sm text-[var(--du-text-muted)]">{copy.model}: {copy.unavailable}</p></div><Sparkles className="h-5 w-5 text-[var(--du-accent-text)]" /></div>
        <label htmlFor="image-prompt" className="mt-6 block text-sm font-medium">{copy.prompt}</label>
        <textarea id="image-prompt" value={prompt} maxLength={2000} onChange={(event) => setPrompt(event.target.value)} placeholder={copy.placeholder} rows={4} className="mt-2 w-full resize-y rounded-2xl border border-[var(--du-border)] bg-[var(--du-bg)] p-4 text-sm outline-none focus:border-[var(--du-accent)]" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label htmlFor="image-model" className="block text-sm font-medium">{copy.model}</label><select id="image-model" disabled className="mt-2 w-full rounded-xl border border-[var(--du-border)] bg-[var(--du-bg)] px-3 py-3 text-sm text-[var(--du-text-muted)]"><option>{copy.unavailable}</option></select></div><div><label htmlFor="image-aspect" className="block text-sm font-medium">{copy.aspect}</label><select id="image-aspect" value={aspect} onChange={(event) => setAspect(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--du-border)] bg-[var(--du-bg)] px-3 py-3 text-sm"><option>1:1</option><option>16:9</option><option>9:16</option><option>4:3</option><option>3:4</option></select></div></div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-[var(--du-text-muted)]"><Info className="mt-0.5 h-4 w-4 shrink-0" />{copy.disabled}</p><button type="button" disabled aria-disabled="true" className="min-h-12 shrink-0 cursor-not-allowed rounded-xl bg-[var(--du-accent)] px-7 text-sm font-semibold text-[var(--du-on-accent)] opacity-55">{copy.generate}</button></div>
      </div>
    </div>
  </div>;
}
