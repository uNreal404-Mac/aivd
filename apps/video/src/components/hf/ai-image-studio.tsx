"use client";

import { useState } from "react";
import { ChevronDown, Settings2, Shield } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { IMAGE_CATALOG } from "@/lib/kie-model-catalog";

const EXAMPLES = [
  { src: "/home/hero-marina-poster.png", rotate: "-rotate-6", shape: "rounded-[22px]" },
  { src: "/images/blog/blog-post-1.jpg", rotate: "rotate-3", shape: "rounded-[22px]" },
  { src: "/images/blog/blog-post-2.jpg", rotate: "-rotate-2", shape: "rounded-full" },
  { src: "/images/blog/blog-post-3.jpg", rotate: "rotate-6", shape: "rounded-[22px]" },
];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const QUALITIES = ["Standard", "High"];

export function AiImageStudio({ locale, initialPrompt = "", initialModel = "", initialAspect = "" }: { locale: string; initialPrompt?: string; initialModel?: string; initialAspect?: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState(ASPECTS.includes(initialAspect) ? initialAspect : "1:1");
  const [quality, setQuality] = useState("Standard");
  const [count, setCount] = useState(1);
  const [modelId, setModelId] = useState(IMAGE_CATALOG.some((item) => item.id === initialModel) ? initialModel : IMAGE_CATALOG[0].id);
  const [menu, setMenu] = useState<"settings" | "publish" | null>(null);
  const [notice, setNotice] = useState(false);
  const settingButton = (label: string, selected: boolean, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={selected} onClick={onClick} className={`min-h-10 rounded-xl px-3 text-sm transition-colors ${selected ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{label}</button>
  );

  return <main className="min-h-[calc(100svh-80px)] w-full min-w-0 flex-1 bg-[var(--du-bg)] px-4 pb-8 pt-8 text-[var(--du-text)] sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto">
    <div className="mx-auto flex min-h-[calc(100svh-140px)] w-full flex-col">
      <div className="flex justify-end"><span className="rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] px-4 py-2 text-xs text-[var(--du-text-muted)]">{zh ? "图片模型待接入" : "Image model coming soon"}</span></div>

      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <div className="mb-8 flex h-36 items-center justify-center -space-x-5 sm:h-44 sm:-space-x-7">
          {EXAMPLES.map((item) => <div key={item.src} className={`relative h-28 w-24 overflow-hidden border-[5px] border-[var(--du-border-strong)] shadow-2xl sm:h-40 sm:w-32 ${item.shape} ${item.rotate}`}><img src={item.src} alt="" className="h-full w-full object-cover" /></div>)}
        </div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--du-accent-text)]">aivd.ai · {zh ? "图片工作台" : "Image studio"}</p>
        <h1 className="mt-4 max-w-[840px] text-[clamp(2.4rem,5vw,5rem)] font-bold leading-[1.04] tracking-[-0.05em]">{zh ? <>让想象<span className="text-[var(--du-accent-text)]">跃然成像</span></> : <>Make imagination <span className="text-[var(--du-accent-text)]">visible</span></>}</h1>
        <p className="mt-5 max-w-[650px] text-sm text-[var(--du-text-muted)] sm:text-lg">{zh ? "描述一个场景、角色、氛围或风格。图片生成模型接入后，作品会直接显示在这里。" : "Describe a scene, character, mood or style. Your images will appear here when an image model is connected."}</p>
        {prompt.trim() ? <div className="mt-8 rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] px-5 py-3 text-sm text-[var(--du-text-muted)]">{zh ? "你的创意已就绪 · 图片模型待接入" : "Your idea is ready · Image model coming soon"}</div> : null}
      </div>

      <div className="du-glass relative mx-auto w-full rounded-[22px] p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.35)] sm:p-4 lg:w-4/5 2xl:max-w-[2200px]">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
          <button type="button" disabled title={zh ? "参考图上传待接入" : "Reference upload coming soon"} aria-label={zh ? "添加参考图片（待接入）" : "Add reference images (coming soon)"} className="flex h-14 w-14 shrink-0 cursor-not-allowed flex-col items-center justify-center rounded-lg border border-dashed border-white/30 text-xs text-white/75 opacity-60"><span className="text-xl leading-none">+</span><span>{zh ? "参考图" : "Images"}</span></button>
          <span className="text-xs text-white/55">{zh ? "参考图上传待接入" : "Reference image upload coming soon"}</span>
        </div>
        <label htmlFor="image-prompt" className="sr-only">{zh ? "图片提示词" : "Image prompt"}</label>
        <textarea id="image-prompt" value={prompt} maxLength={2000} onChange={(event) => { setPrompt(event.target.value); setNotice(false); }} placeholder={zh ? "描述你的创意，选择模型开始创作……" : "Describe your idea, then choose a model…"} rows={3} className="min-h-[100px] w-full resize-none bg-transparent px-2 py-2 text-sm text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)] sm:text-base" />
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--du-border)] pb-3 sm:gap-x-3">
          <div className="relative min-w-0 rounded-xl bg-[var(--du-surface-2)] px-2"><KieModelPicker kind="image" locale={locale} value={modelId} onChange={setModelId} placement="top" showConnectionStatus={false} compact /></div>
          <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-[var(--du-border-strong)] sm:block" />
          <div className="relative">
            <button type="button" aria-expanded={menu === "settings"} onClick={() => setMenu(menu === "settings" ? null : "settings")} className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap px-1 text-xs text-[var(--du-text)] hover:text-[var(--du-accent-text)] sm:text-sm"><Settings2 className="h-4 w-4" />{aspect} / {quality === "High" ? "2K" : "1K"} / {count}</button>
            {menu === "settings" ? <div className="fixed bottom-28 left-4 right-4 z-50 max-h-[min(42vh,320px)] overflow-y-auto rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-4 shadow-2xl sm:absolute sm:bottom-11 sm:left-auto sm:right-0 sm:w-[min(92vw,420px)]">
              <p className="text-sm font-semibold">{zh ? "生成设置" : "Generation settings"}</p>
              <p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "画面比例" : "Aspect ratio"}</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{ASPECTS.map((value) => settingButton(value, aspect === value, () => setAspect(value)))}</div>
              <p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "清晰度" : "Quality"}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{QUALITIES.map((value) => settingButton(value === "High" ? "2K" : "1K", quality === value, () => setQuality(value)))}</div>
              <p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "生成数量" : "Output count"}</p>
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{[1, 2, 3, 4].map((value) => settingButton(String(value), count === value, () => setCount(value)))}</div>
            </div> : null}
          </div>
          <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-[var(--du-border-strong)] sm:block" />
          <div className="relative"><button type="button" aria-expanded={menu === "publish"} onClick={() => setMenu(menu === "publish" ? null : "publish")} className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap px-1 text-xs text-[var(--du-text)] hover:text-[var(--du-accent-text)] sm:text-sm"><Shield className="h-4 w-4" />{zh ? "发布设置" : "Publish settings"}<ChevronDown className="h-3 w-3" /></button>{menu === "publish" ? <div className="fixed bottom-28 left-4 right-4 z-50 rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-4 text-xs text-[var(--du-text-muted)] shadow-2xl sm:absolute sm:bottom-11 sm:left-auto sm:right-0 sm:w-[min(92vw,350px)]">{zh ? "图片模型接入后，可在发布作品时设置公开展示。" : "Public sharing options will be available when image generation is connected."}</div> : null}</div>
        </div>
        <div className="mt-3 flex w-full flex-wrap items-center justify-end gap-2"><span className="text-xs text-[var(--du-text-muted)]">{zh ? "积分待模型接入后显示" : "Credits available after model connection"}</span><button type="button" onClick={() => setNotice(true)} className="min-h-10 rounded-xl bg-[var(--du-accent)] px-6 text-sm font-bold text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)]">{zh ? "继续创建图片" : "Continue to image"}</button></div>
        {notice ? <output className="mt-2 block text-xs text-[var(--du-accent-text)]">{zh ? "图片生成接口尚未接入，因此没有提交任务或扣除积分。" : "No image API is connected, so no task was submitted and no credits were charged."}</output> : null}
      </div>
    </div>
  </main>;
}
