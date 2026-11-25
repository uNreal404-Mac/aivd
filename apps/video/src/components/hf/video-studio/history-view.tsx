"use client";

import { FastForward, Paintbrush, RotateCcw, Sparkles } from "lucide-react";
import type { StudioResult } from "@/lib/ai-video-studio";
import { CopyPromptButton, DownloadLink, PendingCard, markReady, readyRef, type ViewerItem } from "@/components/hf/studio-results";

/** Sample reels shown while History is empty: hover plays one, a click fills
 * the studio with its prompt (real local clips and posters). */
export const SAMPLE_REELS = [
  {
    id: "japan-rain",
    video: "/home/example-japan-6s.mp4",
    poster: "/home/example-japan-6s-poster.webp",
    aspect: "16:9",
    duration: "6s",
    titleZh: "东京深夜街头食光",
    titleEn: "Tokyo Late-Night Konbini",
    promptZh: "电影级手持慢推镜头，东京深夜便利店暖光与街头霓虹交织，近景呈现日系美食与温馨都市氛围，35mm 胶片质感",
    promptEn: "Cinematic handheld slow push-in through a warm late-night Tokyo convenience store glowing against neon city streets, 35mm film grain",
  },
  {
    id: "sky-dragon",
    video: "/home/example-dragon-full.mp4",
    poster: "/home/example-dragon-full-poster.webp",
    aspect: "16:9",
    duration: "8s",
    titleZh: "苍穹巨龙穿云",
    titleEn: "Sky Dragon Aerial",
    promptZh: "史诗级航拍环绕镜头，东方巨龙破开金色云海翱翔，鳞片在逆光中折射金属光泽，气势磅礴",
    promptEn: "Epic aerial orbiting shot of a majestic dragon soaring through golden storm clouds, sunlight catching iridescent scales, cinema scale",
  },
  {
    id: "samurai-cat",
    video: "/home/example-samurai-cat-7s.mp4",
    poster: "/home/example-samurai-cat-7s-poster.webp",
    aspect: "9:16",
    duration: "7s",
    titleZh: "武士猫电影特写",
    titleEn: "Samurai Cat Cinema",
    promptZh: "浅景深近景特写，身穿精致甲胄的武士猫站在飘落的樱花雨中缓缓拔刀，微风吹动披风，电影级布光",
    promptEn: "Shallow depth-of-field close-up of an armored samurai cat standing in drifting cherry blossoms, slowly drawing its katana, dramatic rim light",
  },
  {
    id: "origami-whale",
    video: "/home/example-whale-origami-7s.mp4",
    poster: "/home/example-whale-origami-7s-poster.webp",
    aspect: "16:9",
    duration: "7s",
    titleZh: "折纸鲸鱼奇境",
    titleEn: "Origami Whale Dream",
    promptZh: "梦幻微距跟拍，一只由发光折纸折成的巨鲸在深蓝云海中优雅游动，纸张纹理清晰，柔和体积光",
    promptEn: "Dreamlike tracking shot of a luminous origami whale gliding gracefully through a deep cobalt cloud sea, crisp paper folds, volumetric rays",
  },
  {
    id: "couture-silk",
    video: "/home/example-dress-10-20.mp4",
    poster: "/home/example-dress-10-20-poster.webp",
    aspect: "9:16",
    duration: "5s",
    titleZh: "高定丝绸时尚大片",
    titleEn: "Couture Silk Editorial",
    promptZh: "高级时装棚拍慢动作，流光丝绸礼服随风舒展飘动，暗调极简背景，轮廓光勾勒织物质感",
    promptEn: "High-fashion slow-motion editorial of flowing iridescent silk couture billowing in soft studio rim light against an obsidian backdrop",
  },
  {
    id: "macro-food",
    video: "/home/example-fried-chicken-22-29.mp4",
    poster: "/home/example-fried-chicken-22-29-poster.webp",
    aspect: "16:9",
    duration: "5s",
    titleZh: "电影级美食微距广告",
    titleEn: "Macro Food Commercial",
    promptZh: "高速升格微距商业广告镜头，金黄酥脆炸鸡热气升腾，辣椒粉与香料颗粒在慢动作中凌空洒落，诱人高光",
    promptEn: "High-speed macro commercial shot of crispy golden fried chicken with rising steam and spice dust falling in dramatic slow motion",
  },
] as const;

export type SampleReel = (typeof SAMPLE_REELS)[number];

/** History with nothing in it yet: a line on what will appear here (and a
 * sign-in for visitors), then sample reels to start from. */
export function EmptyHistory({
  zh,
  signedOut,
  onSignIn,
  onRecreate,
}: {
  zh: boolean;
  signedOut: boolean;
  onSignIn: () => void;
  onRecreate: (reel: SampleReel, index: number) => void;
}) {
  return (
    <div className="vst-empty du-fade-swap">
      <div className="vst-empty-head">
        <div>
          <h2 className="vst-empty-title">{zh ? "还没有视频" : "No clips yet"}</h2>
          <p className="vst-empty-sub">
            {signedOut
              ? zh
                ? "登录后，你生成的视频会保存在这里。也可以先点一条样片，自动填好它的提示词。"
                : "Sign in and your clips are kept here. Or click a sample below to fill in its prompt."
              : zh
                ? "生成的视频会出现在这里。也可以先点一条样片，自动填好它的提示词。"
                : "Your clips will appear here. Or click a sample below to fill in its prompt."}
          </p>
        </div>
        {signedOut ? (
          <button type="button" className="vst-pill-button" onClick={onSignIn}>
            {zh ? "登录" : "Sign in"}
          </button>
        ) : null}
      </div>
      <div className="vst-reels" aria-label={zh ? "样片" : "Samples"}>
        {SAMPLE_REELS.map((reel, index) => (
          <button
            key={reel.id}
            type="button"
            className="vst-reel"
            title={zh ? reel.promptZh : reel.promptEn}
            onMouseEnter={(event) => {
              const video = event.currentTarget.querySelector("video");
              if (video) void video.play().catch(() => undefined);
            }}
            onMouseLeave={(event) => {
              const video = event.currentTarget.querySelector("video");
              if (video) {
                video.pause();
                video.currentTime = 0;
              }
            }}
            onClick={() => onRecreate(reel, index)}
          >
            <video src={reel.video} poster={reel.poster} muted loop playsInline preload="metadata" className="vst-reel-video" />
            <span className="vst-reel-shade" aria-hidden="true" />
            <span className="vst-reel-meta du-num">
              {reel.duration} · {reel.aspect}
            </span>
            <span className="vst-reel-use">
              <Sparkles aria-hidden="true" />
              {zh ? "做同款" : "Use this"}
            </span>
            <span className="vst-reel-title">{zh ? reel.titleZh : reel.titleEn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Generated clips, newest first: playing on hover, open full screen on click,
 * with copy, download, reuse and "open in the canvas" on each. */
export function ResultsGrid({
  zh,
  results,
  gallery,
  onView,
  onReuse,
  onCanvas,
  onExtend,
}: {
  zh: boolean;
  results: StudioResult[];
  gallery: ViewerItem[];
  onView: (position: number) => void;
  onReuse: (prompt: string | null | undefined) => void;
  onCanvas: (result: StudioResult) => void;
  /** 续写: continue a finished clip from its last frame. */
  onExtend?: (result: StudioResult) => void;
}) {
  return (
    <div className="vst-results du-fade-swap">
      {results.map((result) => {
        if (result.status === "completed" && result.videoUrl) {
          const position = gallery.findIndex((item) => item.key === result.id);
          return (
            <figure key={result.id} className="sr-card vst-result">
              <video
                ref={readyRef}
                onLoadedMetadata={markReady}
                onError={markReady}
                src={result.videoUrl}
                muted
                loop
                playsInline
                preload="metadata"
                onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
                onMouseLeave={(event) => {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = 0;
                }}
              />
              <button type="button" className="sr-card-open" aria-label={zh ? "全屏播放" : "Play full screen"} onClick={() => onView(position)} />
              <span className="sr-card-shade" aria-hidden="true" />
              <span className="sr-card-top">
                {result.prompt ? <CopyPromptButton prompt={result.prompt} zh={zh} /> : null}
                <DownloadLink url={result.videoUrl} zh={zh} />
              </span>
              <span className="sr-card-bottom">
                <span className="sr-card-prompt">{result.prompt}</span>
                <button type="button" className="sr-icon" title={zh ? "复用提示词" : "Reuse prompt"} aria-label={zh ? "复用提示词" : "Reuse prompt"} onClick={() => onReuse(result.prompt)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                {onExtend && result.videoUuid ? (
                  <button
                    type="button"
                    className="sr-icon"
                    title={zh ? "续写：从结尾接着往下生成" : "Extend from the last frame"}
                    aria-label={zh ? "续写这段视频" : "Extend this clip"}
                    onClick={() => onExtend(result)}
                  >
                    <FastForward className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="sr-icon"
                  title={zh ? "在无限画布中截帧 / 配音 / 编排" : "Open in Infinite Canvas"}
                  aria-label={zh ? "在无限画布中打开" : "Open in Infinite Canvas"}
                  onClick={() => onCanvas(result)}
                >
                  <Paintbrush className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </figure>
          );
        }
        return (
          <PendingCard
            key={result.id}
            className="vst-result ds-shimmer"
            status={result.status === "completed" ? "failed" : result.status}
            since={result.createdAt}
            prompt={result.prompt}
            message={result.status === "completed" ? (zh ? "没有返回视频" : "No clip came back") : result.message}
            zh={zh}
            onReuse={result.prompt ? () => onReuse(result.prompt) : undefined}
          />
        );
      })}
    </div>
  );
}
