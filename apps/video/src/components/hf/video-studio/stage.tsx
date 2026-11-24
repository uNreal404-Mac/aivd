"use client";

import { BookOpen, ChevronRight, Folder, ImagePlus } from "lucide-react";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import { VIDEO_PRESETS } from "@/lib/video-presets";

export type StageTab = "History" | "How it works";

/** History / How it works, top left of the stage, one highlight gliding
 * between them. */
export function StageTabs({
  zh,
  active,
  count,
  onChange,
}: {
  zh: boolean;
  active: StageTab;
  count: number;
  onChange: (tab: StageTab) => void;
}) {
  const ref = useSegmentIndicator<HTMLDivElement>(active);
  const tabs: { id: StageTab; label: string; Icon: typeof Folder }[] = [
    { id: "History", label: zh ? "历史记录" : "History", Icon: Folder },
    { id: "How it works", label: zh ? "工作原理" : "How it works", Icon: BookOpen },
  ];
  return (
    <div ref={ref} className="vst-tabs du-seg" aria-label={zh ? "视图" : "View"}>
      {tabs.map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-pressed={active === id} className="vst-tab" onClick={() => onChange(id)}>
          <Icon aria-hidden="true" />
          {label}
          {id === "History" && count > 0 ? <span className="vst-tab-count du-num">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * How it works: a large title, a line under it and three illustrated steps
 * drawn from the studio's own parts, then a way into the templates at the
 * foot of the stage.
 */
export function HowItWorks({ zh, templatesHref }: { zh: boolean; templatesHref: string }) {
  const steps = zh
    ? [
        { title: "添加参考图", body: "上传、拖入或粘贴一张图片，也可以只写文字" },
        { title: "选一个运镜", body: "挑一个镜头预设，决定画面怎么动" },
        { title: "生成并下载", body: "点击生成，完成后在历史记录里播放和下载" },
      ]
    : [
        { title: "Add a reference", body: "Upload, drop or paste an image, or start from text" },
        { title: "Pick a camera move", body: "Choose a preset for how the shot moves" },
        { title: "Generate and download", body: "Hit generate, then play and download it from History" },
      ];
  const presets = [VIDEO_PRESETS[3], VIDEO_PRESETS[2], VIDEO_PRESETS[1]];

  return (
    <div className="vst-howto du-fade-swap">
      <div className="vst-howto-main">
        <h2 className="vst-howto-title">{zh ? "从一句话到一段视频" : "From one line to a finished clip"}</h2>
        <p className="vst-howto-sub">
          {zh
            ? "加一张参考图、挑一个运镜，或者只写提示词。生成前就能看到要花多少积分。"
            : "Add a reference image, pick a camera move, or just write a prompt. You see the credit cost before you generate."}
        </p>
        <ol className="vst-steps">
          {steps.map((step, index) => (
            <li key={step.title} className="vst-step">
              <div className="vst-illus" aria-hidden="true">
                {index === 0 ? (
                  <div className="vst-illus-upload">
                    <span className="vst-illus-drop">
                      <ImagePlus />
                      <strong>{zh ? "上传图片" : "Upload an image"}</strong>
                      <small>{zh ? "拖入或粘贴" : "Drop or paste"}</small>
                    </span>
                    <img src="/home/samples/rain-couple.webp" alt="" className="vst-illus-photo" />
                  </div>
                ) : index === 1 ? (
                  <div className="vst-illus-presets">
                    {presets.map((preset, position) => (
                      <span key={preset.id} className={position === 1 ? "vst-illus-preset vst-illus-preset-on" : "vst-illus-preset"}>
                        <img src={preset.image} alt="" />
                        <small>{zh ? preset.zh : preset.en}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="vst-illus-result">
                    <img src="/home/hero-marina-poster.webp" alt="" />
                  </div>
                )}
              </div>
              <h3 className="vst-step-title">{step.title}</h3>
              <p className="vst-step-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
      <a className="vst-tip" href={templatesHref}>
        <span className="vst-tip-art" aria-hidden="true">
          <img src="/home/samples/autumn-walk.webp" alt="" />
          <img src="/home/samples/red-carpet.webp" alt="" />
          <img src="/home/samples/boy-and-dog.webp" alt="" />
        </span>
        <span className="vst-tip-text">
          <strong>{zh ? "不知道从哪里开始？" : "Not sure where to start?"}</strong>
          <span>{zh ? "从模板挑一个，提示词会自动填好" : "Pick a template and the prompt fills itself in"}</span>
        </span>
        <ChevronRight className="vst-tip-arrow" aria-hidden="true" />
      </a>
    </div>
  );
}
