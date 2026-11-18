"use client";

import { useState } from "react";
import { AtSign, ChevronRight, Gem, Minus, Plus, RectangleHorizontal, Sparkles } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { IMAGE_CATALOG } from "@/lib/kie-model-catalog";
import "./ai-image-studio.css";

// Tilted photo stack above the title, as on the reference image page.
const COLLAGE = [
  { src: "/home/samples/red-carpet.webp", className: "is-1" },
  { src: "/home/samples/rain-couple.webp", className: "is-2" },
  { src: "/home/samples/dancer.webp", className: "is-3" },
  { src: "/home/samples/autumn-walk.webp", className: "is-4" },
];
const ASPECTS = ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const QUALITIES = ["standard", "high"] as const;
const RESOLUTIONS = ["1K", "2K", "4K"] as const;
const MAX_COUNT = 4;

/** Small toolbar chip that cycles through its options on click. */
function CycleChip<T extends string>({
  icon,
  value,
  options,
  format,
  onChange,
  label,
}: {
  icon: React.ReactNode;
  value: T;
  options: readonly T[];
  format: (option: T) => string;
  onChange: (option: T) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="is-chip"
      aria-label={`${label}: ${format(value)}`}
      title={label}
      onClick={() => onChange(options[(options.indexOf(value) + 1) % options.length])}
    >
      {icon}
      {format(value)}
    </button>
  );
}

export function AiImageStudio({
  locale,
  initialPrompt = "",
  initialModel = "",
  initialAspect = "",
  upcomingName,
}: {
  locale: string;
  initialPrompt?: string;
  initialModel?: string;
  initialAspect?: string;
  /** A model picked from the nav that is not in our catalogue yet. */
  upcomingName?: string;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>(
    (ASPECTS as readonly string[]).includes(initialAspect) ? (initialAspect as (typeof ASPECTS)[number]) : "auto",
  );
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]>("high");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("2K");
  const [count, setCount] = useState(1);
  const [modelId, setModelId] = useState(
    IMAGE_CATALOG.some((item) => item.id === initialModel) ? initialModel : IMAGE_CATALOG[0].id,
  );
  const [notice, setNotice] = useState(false);
  const [upcoming, setUpcoming] = useState(upcomingName);
  const model = IMAGE_CATALOG.find((item) => item.id === modelId) ?? IMAGE_CATALOG[0];
  const modelName = upcoming ?? model.name;

  return (
    <main className="is-root">
      <section className="is-hero">
        <div className="is-collage" aria-hidden="true">
          {COLLAGE.map((item) => (
            <img key={item.src} src={item.src} alt="" className={`is-photo ${item.className}`} />
          ))}
        </div>
        <h1 className="is-title">
          <span>{zh ? "用" : "Create with"}</span>
          <span className="is-title-model">{modelName}</span>
          <span>{zh ? "开始创作" : "today"}</span>
        </h1>
        <p className="is-sub">
          {zh ? "描述一个场景、角色、氛围或风格，看它即刻成真" : "Describe a scene, a character, a mood or a style and watch it appear"}
        </p>
      </section>

      <form
        className="is-composer"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(true);
        }}
      >
        <div className="is-composer-main">
          <label htmlFor="image-prompt" className="sr-only">
            {zh ? "图片提示词" : "Image prompt"}
          </label>
          <textarea
            id="image-prompt"
            value={prompt}
            maxLength={2000}
            rows={2}
            onChange={(event) => {
              setPrompt(event.target.value);
              setNotice(false);
            }}
            placeholder={zh ? "描述你想象中的场景" : "Describe the scene you imagine"}
          />
          <div className="is-toolbar">
            <span className="is-chip-group">
              <button type="button" className="is-chip is-chip-icon" disabled title={zh ? "参考图上传即将上线" : "Reference upload coming soon"} aria-label={zh ? "添加参考图（即将上线）" : "Add reference image (coming soon)"}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="is-chip-sep" aria-hidden="true" />
              <button type="button" className="is-chip is-chip-icon" disabled title={zh ? "引用元素即将上线" : "Elements coming soon"} aria-label={zh ? "引用元素（即将上线）" : "Mention an element (coming soon)"}>
                <AtSign className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
            <div className="is-model">
              <KieModelPicker
                kind="image"
                locale={locale}
                value={modelId}
                valueLabel={upcoming}
                onChange={(id) => {
                  setUpcoming(undefined);
                  setModelId(id);
                }}
                placement="top"
                compact
              />
              <ChevronRight className="is-model-chevron" aria-hidden="true" />
            </div>
            <CycleChip
              icon={<RectangleHorizontal className="h-4 w-4" aria-hidden="true" />}
              label={zh ? "画面比例" : "Aspect ratio"}
              value={aspect}
              options={ASPECTS}
              format={(option) => (option === "auto" ? (zh ? "自动" : "Auto") : option)}
              onChange={setAspect}
            />
            <CycleChip
              icon={<Gem className="h-4 w-4" aria-hidden="true" />}
              label={zh ? "质量" : "Quality"}
              value={quality}
              options={QUALITIES}
              format={(option) => (option === "high" ? (zh ? "高" : "High") : zh ? "标准" : "Standard")}
              onChange={setQuality}
            />
            <CycleChip
              icon={<Gem className="h-4 w-4" aria-hidden="true" />}
              label={zh ? "分辨率" : "Resolution"}
              value={resolution}
              options={RESOLUTIONS}
              format={(option) => option}
              onChange={setResolution}
            />
            <span className="is-stepper">
              <button type="button" aria-label={zh ? "减少数量" : "Fewer images"} disabled={count <= 1} onClick={() => setCount((value) => Math.max(1, value - 1))}>
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span>
                {count}/{MAX_COUNT}
              </span>
              <button type="button" aria-label={zh ? "增加数量" : "More images"} disabled={count >= MAX_COUNT} onClick={() => setCount((value) => Math.min(MAX_COUNT, value + 1))}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
        <button type="submit" className="is-generate">
          <span>{zh ? "生成" : "Generate"}</span>
          <span className="is-generate-sub">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {zh ? "即将上线" : "Soon"}
          </span>
        </button>
      </form>
      {notice ? (
        <output className="is-notice">
          {zh
            ? `${modelName} 即将上线，这次没有提交任务，也没有扣积分。`
            : `${modelName} is coming soon, so nothing was submitted and no credits were used.`}
        </output>
      ) : null}
    </main>
  );
}
