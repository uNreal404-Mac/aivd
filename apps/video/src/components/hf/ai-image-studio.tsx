"use client";

import { useState } from "react";
import { ChevronDown, ImagePlus, Maximize, Plus, Sparkles } from "lucide-react";

const EXAMPLES = [
  { src: "/home/hero-marina-poster.png", rotate: "-rotate-6", shape: "rounded-[22px]" },
  { src: "/images/blog/blog-post-1.jpg", rotate: "rotate-3", shape: "rounded-[22px]" },
  { src: "/images/blog/blog-post-2.jpg", rotate: "-rotate-2", shape: "rounded-full" },
  { src: "/images/blog/blog-post-3.jpg", rotate: "rotate-6", shape: "rounded-[22px]" },
];
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const QUALITIES = ["Standard", "High"];

export function AiImageStudio({ locale }: { locale: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [quality, setQuality] = useState("Standard");
  const [count, setCount] = useState(1);
  const [menu, setMenu] = useState<"aspect" | "quality" | null>(null);
  const [notice, setNotice] = useState(false);

  return <main className="min-h-[calc(100svh-80px)] bg-[var(--du-bg)] px-4 pb-8 pt-8 text-[var(--du-text)] sm:px-8">
    <div className="mx-auto flex min-h-[calc(100svh-140px)] max-w-[1500px] flex-col">
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

      <div className="relative mx-auto w-full max-w-[1040px] rounded-[28px] border border-[var(--du-border)] bg-[var(--du-surface)] p-3 shadow-[0_20px_70px_rgba(0,0,0,.28)] sm:p-5">
        <label htmlFor="image-prompt" className="sr-only">{zh ? "图片提示词" : "Image prompt"}</label>
        <textarea id="image-prompt" value={prompt} maxLength={2000} onChange={(event) => { setPrompt(event.target.value); setNotice(false); }} placeholder={zh ? "描述一个场景、角色、氛围或风格……" : "Describe a scene, character, mood or style…"} rows={3} className="min-h-20 w-full resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--du-text-muted)] sm:text-base" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled title={zh ? "参考图上传待接入" : "Reference upload coming soon"} className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl bg-[var(--du-surface-2)] text-[var(--du-text-muted)] opacity-60"><Plus size={19} /></button>
            <button type="button" disabled className="flex h-10 cursor-not-allowed items-center gap-2 rounded-xl bg-[var(--du-surface-2)] px-3 text-sm text-[var(--du-text-muted)] opacity-70"><ImagePlus size={17} />{zh ? "模型待接入" : "Model coming soon"}</button>
            <div className="relative"><button type="button" aria-expanded={menu === "aspect"} onClick={() => setMenu(menu === "aspect" ? null : "aspect")} className="flex h-10 items-center gap-2 rounded-xl bg-[var(--du-surface-2)] px-3 text-sm"><Maximize size={16} />{aspect}<ChevronDown size={14} /></button>{menu === "aspect" ? <div className="absolute bottom-12 left-0 z-20 grid w-36 gap-1 rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] p-2 shadow-xl">{ASPECTS.map((value) => <button key={value} type="button" onClick={() => { setAspect(value); setMenu(null); }} className={`rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--du-surface-2)] ${value === aspect ? "text-[var(--du-accent-text)]" : ""}`}>{value}</button>)}</div> : null}</div>
            <div className="relative"><button type="button" aria-expanded={menu === "quality"} onClick={() => setMenu(menu === "quality" ? null : "quality")} className="flex h-10 items-center gap-2 rounded-xl bg-[var(--du-surface-2)] px-3 text-sm"><Sparkles size={16} />{quality}<ChevronDown size={14} /></button>{menu === "quality" ? <div className="absolute bottom-12 left-0 z-20 grid w-36 gap-1 rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] p-2 shadow-xl">{QUALITIES.map((value) => <button key={value} type="button" onClick={() => { setQuality(value); setMenu(null); }} className={`rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--du-surface-2)] ${value === quality ? "text-[var(--du-accent-text)]" : ""}`}>{zh ? (value === "High" ? "高质量" : "标准") : value}</button>)}</div> : null}</div>
            <div className="flex h-10 items-center rounded-xl bg-[var(--du-surface-2)] text-sm"><button type="button" aria-label={zh ? "减少图片数量" : "Fewer images"} disabled={count <= 1} onClick={() => setCount(count - 1)} className="px-3 disabled:opacity-40">−</button><span>{count}/4</span><button type="button" aria-label={zh ? "增加图片数量" : "More images"} disabled={count >= 4} onClick={() => setCount(count + 1)} className="px-3 disabled:opacity-40">+</button></div>
          </div>
          <button type="button" onClick={() => setNotice(true)} className="min-h-12 rounded-xl bg-[var(--du-accent)] px-8 text-sm font-semibold text-[var(--du-on-accent)] hover:bg-[var(--du-accent-hover)]">{zh ? "生成图片" : "Generate image"}</button>
        </div>
        {notice ? <p role="status" className="mt-3 text-xs text-[var(--du-text-muted)]">{zh ? "图片生成接口尚未接入，因此没有提交任务或扣除积分。" : "No image API is connected, so no task was submitted and no credits were charged."}</p> : null}
      </div>
    </div>
  </main>;
}
