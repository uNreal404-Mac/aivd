"use client";

import Link from "next/link";
import { ArrowRight, Clapperboard, Grid3x3, ImagePlus, Images, Sparkles, Type, ZoomIn, type LucideIcon } from "lucide-react";

import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { localizedHref } from "@/lib/du-home";
import { navModelHref } from "@/lib/nav-models";
import "./home-showcase.css";
import "./home-pricing.css";
import "./image-showcase.css";

const S = (name: string) => `/home/samples/${name}.webp`;

/** Cheapest credit price the model can run at, over its resolutions. */
function fromCredits(id: string): number | null {
  const model = getMarketModel(id);
  if (!model) return null;
  const sizes = model.options.resolutions?.length ? model.options.resolutions : [undefined];
  const prices = sizes.map((resolution) => marketCredits(model, { prompt: "", resolution })).filter((value) => value > 0);
  return prices.length ? Math.min(...prices) : null;
}

const MODELS: { id: string; title: string; zh: string; en: string; image: string; wall: string[] }[] = [
  { id: "nano-banana-pro", title: "NANO BANANA PRO", zh: "Google 出品，4K 细节和文字渲染出色", en: "Google's 4K model with fine detail and text", image: S("red-carpet"), wall: ["red-carpet", "studio-room", "dreaming", "rain-couple", "mountain-wind", "cosmic-bloom", "autumn-walk", "tomb-light"] },
  { id: "seedream-5-5", title: "SEEDREAM 5.5", zh: "字节跳动新一代图像模型，支持透明背景", en: "ByteDance's new model, with transparent backgrounds", image: S("mountain-valley"), wall: ["mountain-valley", "storm-sea", "planet-impact", "dancer", "boy-and-dog", "mech-warrior", "red-carpet", "dreaming"] },
  { id: "gpt-image-2-6-sunburst", title: "GPT IMAGE 2.6", zh: "品质出众，海报和文字排版精准", en: "Outstanding quality; posters and type land right", image: S("studio-room"), wall: ["studio-room", "cosmic-bloom", "rain-couple", "tomb-light", "autumn-walk", "planet-impact", "mountain-wind", "storm-sea"] },
  { id: "kling-image-4", title: "KLING IMAGE 4.0", zh: "最高 8K，一次最多 9 张", en: "Up to 8K and nine images at once", image: S("dancer"), wall: [] },
  { id: "flux3/klein-text-to-image", title: "FLUX 3", zh: "Black Forest Labs 出品，快速又便宜", en: "Black Forest Labs; fast and affordable", image: S("cosmic-bloom"), wall: [] },
  { id: "grok-imagine-image-2-0/text-to-image", title: "GROK IMAGINE 2.0", zh: "xAI 出品的高分辨率图像", en: "High-resolution images from xAI", image: S("mech-warrior"), wall: [] },
];

const WALL_RATIOS = ["3 / 4", "4 / 3", "1 / 1", "4 / 5", "16 / 10", "3 / 4", "1 / 1", "4 / 3"];

const TILES: { zh: string; en: string; bodyZh: string; bodyEn: string; href: string; icon: LucideIcon; badge?: { zh: string; en: string } }[] = [
  { zh: "文字生成图片", en: "Text to image", bodyZh: "一句话描述，直接出图", bodyEn: "Describe it and get an image", href: "/ai/image", icon: Type },
  { zh: "参考图生成", en: "From references", bodyZh: "上传最多 10 张参考图", bodyEn: "Upload up to 10 references", href: "/ai/image?model=seedream-5-5", icon: ImagePlus },
  { zh: "一次多张", en: "Image sets", bodyZh: "Kling 一次最多出 9 张", bodyEn: "Kling makes up to 9 at once", href: "/ai/image?model=kling-image-4", icon: Grid3x3, badge: { zh: "新", en: "New" } },
  { zh: "4K / 8K 高清", en: "4K / 8K", bodyZh: "印刷和大屏也够清晰", bodyEn: "Sharp enough for print and big screens", href: "/ai/image?model=nano-banana-pro", icon: ZoomIn, badge: { zh: "热门", en: "Hot" } },
  { zh: "海报与文字", en: "Posters and type", bodyZh: "GPT Image 排版更准", bodyEn: "GPT Image sets type cleanly", href: "/ai/image?model=gpt-image-2-6-sunburst", icon: Images },
  { zh: "图片转视频", en: "Image to video", bodyZh: "让生成的图动起来", bodyEn: "Bring a generated image to life", href: "/image-to-video", icon: Clapperboard },
];

/** Homepage-style sections for the image pages (studio and intro page). */
export function ImageShowcase({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const href = (path: string) => localizedHref(lang, path);
  const cheapest = Math.min(...MODELS.map((model) => fromCredits(model.id) ?? Number.POSITIVE_INFINITY));
  const credit = (id: string) => {
    const value = fromCredits(id);
    return value === null ? "" : zh ? ` · ${value} 积分起` : ` · from ${value} credits`;
  };

  return (
    <div className="hs is-showcase">
      {/* 1. Model carousel */}
      <section className="hs-carousel" aria-label={zh ? "图片模型" : "Image models"}>
        <div className="hs-carousel-track">
          {MODELS.map((model) => (
            <Link key={model.id} href={href(navModelHref("image", model.id))} className="hs-slide">
              <span className="hs-slide-media">
                <img src={model.image} alt="" loading="lazy" />
              </span>
              <span className="hs-slide-title">{model.title}</span>
              <span className="hs-slide-body">
                {zh ? model.zh : model.en}
                {credit(model.id)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 2. Offer card and feature tiles */}
      <section className="hs-offer-grid" aria-label={zh ? "图片功能" : "Image features"}>
        <Link href={href("/ai/image")} className="hs-offer">
          <span className="hs-offer-glow" aria-hidden="true" />
          <span className="hs-offer-kicker">{zh ? "9 个图片模型" : "9 image models"}</span>
          <span className="hs-offer-title">{zh ? `${cheapest} 积分起一张` : `From ${cheapest} credits`}</span>
          <span className="hs-offer-body">{zh ? "生成前就能看到积分，失败自动退回" : "See the cost first; failed runs are refunded"}</span>
          <span className="hs-offer-cta">{zh ? "开始生成图片" : "Start making images"}</span>
        </Link>
        <div className="hs-tiles">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.en} href={href(tile.href)} className="hs-tile">
                <Icon className="hs-tile-icon" aria-hidden="true" />
                <span className="hs-tile-title">
                  {zh ? tile.zh : tile.en}
                  {tile.badge ? <span className="hs-badge">{zh ? tile.badge.zh : tile.badge.en}</span> : null}
                </span>
                <span className="hs-tile-body">{zh ? tile.bodyZh : tile.bodyEn}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Model walls with a banner between them */}
      {MODELS.filter((model) => model.wall.length > 0).map((model, index) => (
        <ImageWall key={model.id} lang={lang} model={model} offset={index} showBanner={index === 1} />
      ))}

      {/* 4. Steps as gradient cards */}
      <section className="hs-section" aria-labelledby="is-steps-title">
        <div className="hs-head">
          <div>
            <h2 id="is-steps-title" className="hs-title">{zh ? "三步生成一张好图" : "A GREAT IMAGE IN THREE STEPS"}</h2>
            <p className="hs-sub">{zh ? "从一句话到一张可以直接用的图。" : "From one line to an image you can use."}</p>
          </div>
        </div>
        <div className="hp-plans">
          {[
            { zh: "写描述", en: "Describe", bodyZh: "写清主体、场景和风格，也可以上传参考图。", bodyEn: "Write the subject, scene and style, or add references." },
            { zh: "选模型和尺寸", en: "Pick a model", bodyZh: "选模型、比例和分辨率，按钮上实时显示积分。", bodyEn: "Choose model, ratio and size; the button shows the cost." },
            { zh: "生成下载", en: "Generate", bodyZh: "几秒出图，悬停即可下载原图。", bodyEn: "Images arrive in seconds; hover to download." },
          ].map((step, index) => (
            <article key={step.en} className={`hp-plan hp-plan-${(["basic", "pro", "ultimate"] as const)[index]}`}>
              <div className="hp-plan-top is-step-card">
                <span className="is-step-n">{index + 1}</span>
                <p className="hp-plan-name">{zh ? step.zh : step.en}</p>
                <p className="hp-plan-blurb">{zh ? step.bodyZh : step.bodyEn}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ImageWall({
  lang,
  model,
  offset,
  showBanner,
}: {
  lang: string;
  model: (typeof MODELS)[number];
  offset: number;
  showBanner: boolean;
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const link = localizedHref(lang, navModelHref("image", model.id));
  const name = getMarketModel(model.id)?.name ?? model.title;
  const cta = zh ? `用 ${name} 生成` : `Create with ${name}`;
  return (
    <>
      {showBanner ? (
        <section className="hs-banner hs-banner-photo" aria-labelledby="is-banner-title">
          <div className="hs-banner-text">
            <span className="hs-banner-tag">KLING IMAGE 4.0</span>
            <h2 id="is-banner-title" className="hs-banner-title">
              {zh ? <>不同场景<br />同一主角</> : <>New scenes,<br />same lead</>}
            </h2>
            <p className="hs-banner-body">{zh ? "上传角色参考图，一次生成整组画面" : "Upload a character reference and get a whole set at once"}</p>
            <Link href={localizedHref(lang, navModelHref("image", "kling-image-4"))} className="hs-btn hs-btn-light">
              {zh ? "试试 Kling Image 4.0" : "Try Kling Image 4.0"}
            </Link>
          </div>
          <div className="hs-banner-fan" aria-hidden="true">
            {["rain-couple", "red-carpet", "autumn-walk", "dreaming", "dancer"].map((name, index) => (
              <img key={name} src={S(name)} alt="" loading="lazy" style={{ ["--i" as string]: index }} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="hs-section" aria-labelledby={`is-wall-${offset}`}>
        <div className="hs-head">
          <div>
            <h2 id={`is-wall-${offset}`} className="hs-title">{model.title}</h2>
            <p className="hs-sub">{zh ? model.zh : model.en}</p>
          </div>
          <Link href={link} className="hs-btn hs-btn-accent">
            {cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="hs-wall">
          {model.wall.map((name, position) => (
            <Link
              key={`${model.id}-${name}`}
              href={link}
              className="hs-wall-item"
              style={{ aspectRatio: WALL_RATIOS[(position + offset) % WALL_RATIOS.length] }}
            >
              <img src={S(name)} alt="" loading="lazy" />
              <span className="hs-wall-hover">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {cta}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
