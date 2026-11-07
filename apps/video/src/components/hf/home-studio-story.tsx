import Link from "next/link";
import { ArrowRight, Film, ImagePlus, SlidersHorizontal } from "lucide-react";

export function HomeStudioStory({ lang, modelName }: { lang: string; modelName: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  return (
    <section className="mx-auto max-w-[1680px] px-6 py-16 text-[var(--du-text)]">
      <div className="mb-9 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--du-accent-text)]">{zh ? "一个工作空间" : "One workspace"}</p>
        <h2 className="mt-3 text-[clamp(2rem,4vw,4.5rem)] font-semibold leading-tight">{zh ? "选模型、定镜头，一站完成视频创作。" : "Choose a model. Direct the shot. Create in one place."}</h2>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[var(--du-text-muted)] sm:text-base">{zh ? "写下提示词，按需要添加起始画面，再调整时长和比例。所有设置都在同一个视频工作台中。" : "Write a prompt, add a start frame when you need one, and adjust duration and aspect ratio in the same video studio."}</p>
      </div>
      <div className="grid overflow-hidden rounded-[28px] border border-[var(--du-border)] bg-[var(--du-surface)] lg:grid-cols-[1fr_1.55fr_0.9fr]">
        <div className="flex flex-col gap-4 border-b border-[var(--du-border)] p-5 lg:border-b-0 lg:border-r">
          <div className="rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface-2)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--du-accent-text)]"><Film className="h-4 w-4" />{zh ? "视频生成器" : "Video generator"}</div>
            <div className="mt-4 rounded-xl border border-[var(--du-border)] bg-[var(--du-bg)] p-4 text-sm text-[var(--du-text-muted)]">{zh ? "描述主体、动作、镜头运动和光线……" : "Describe the subject, motion, camera and light…"}</div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-[var(--du-border)] px-2.5 py-2">{modelName}</span>
              <span className="rounded-lg border border-[var(--du-border)] px-2.5 py-2">{zh ? "时长" : "Duration"}</span>
              <span className="rounded-lg border border-[var(--du-border)] px-2.5 py-2">16:9</span>
            </div>
            <div className="mt-5 rounded-xl bg-[var(--du-accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--du-on-accent)]">{zh ? "生成视频" : "Generate video"}</div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[var(--du-text-muted)]"><span className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-[var(--du-accent-text)]" />{zh ? "可选起始帧" : "Optional start frame"}</span><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[var(--du-accent-text)]" />{zh ? "按模型调整参数" : "Model-specific settings"}</span></div>
        </div>
        <div className="relative min-h-[300px] bg-[var(--du-bg)] lg:min-h-[480px]">
          <video className="absolute inset-0 h-full w-full object-cover" src="/home/hero-showcase-02.mp4" autoPlay muted loop playsInline preload="metadata" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <span className="absolute bottom-5 left-5 rounded-full border border-white/30 bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur">{zh ? "从构想到画面" : "From idea to frame"}</span>
        </div>
        <div className="flex flex-col justify-between gap-5 p-6">
          <div><p className="text-xs uppercase tracking-[0.18em] text-[var(--du-accent-text)]">{zh ? "创作方法" : "How it works"}</p><h3 className="mt-4 text-2xl font-semibold">{zh ? "把创意写成可执行的镜头。" : "Turn your idea into a directed shot."}</h3><p className="mt-4 text-sm leading-7 text-[var(--du-text-muted)]">{zh ? "选用当前可用的视频模型，写清场景与运动方式。需要控制构图时可以上传一张起始图片，作品会留在你的创作记录中。" : "Choose an available video model and describe the scene and movement. Add a start image to guide composition, then find the result in your creations."}</p></div>
          <Link href={`/${lang}/ai/video`} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--du-accent-text)] hover:underline">{zh ? "打开视频工作台" : "Open the video studio"}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}
