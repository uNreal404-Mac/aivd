"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { TOOL_PREFILL_KEY } from "@/components/gallery/use-template";
import { CATEGORY_FILTERS, EFFECT_CARDS, localizedHref } from "@/lib/du-home";
import styles from "./premiere-collection.module.css";

const films = [
  {
    slug: "shore",
    chapter: "I",
    href: "/text-to-video",
    en: { title: "Basalt shore", entry: "Text to video", alt: "Turquoise surf breaking across a black basalt shore, viewed from above." },
    zh: { title: "玄武海岸", entry: "文字生成视频", alt: "从上空俯视青色浪花拍上玄武岩黑沙岸。" },
  },
  {
    slug: "prism",
    chapter: "II",
    href: "/image-to-video",
    en: { title: "Refracted portrait", entry: "Image to video", alt: "A fashion portrait refracted through a faceted piece of optical glass." },
    zh: { title: "折光人像", entry: "图片生成视频", alt: "光学玻璃的切面折射出时装模特的肖像。" },
  },
  {
    slug: "arch",
    chapter: "III",
    href: "/reference-to-video",
    en: { title: "Beyond the arch", entry: "Reference to video", alt: "A lone astronaut approaching a monumental stone arch in the mist." },
    zh: { title: "石拱之外", entry: "参考图生成视频", alt: "一名宇航员独自走向薄雾里的巨大石拱。" },
  },
] as const;

const models = [
  { name: "Sora 2", href: "/sora-2" },
  { name: "Veo 3.1", href: "/veo-3-1" },
  { name: "Wan 2.6", href: "/wan-2-6" },
  { name: "Seedance 1.5", href: "/seedance-1-5" },
];

type Preset = { name: string; zhName: string; en: string; zh: string };
type PromptCopy = Pick<Preset, "zhName" | "en" | "zh">;

const stylesByName: Record<string, PromptCopy> = {
  Cinematic: { zhName: "电影感", en: "A train pulls away at dusk. Track slowly along the platform as the last window catches the light.", zh: "黄昏时列车离站。镜头沿站台缓缓移动，最后一扇车窗掠过一缕夕光。" },
  Anime: { zhName: "动漫", en: "A red kite climbs above a windswept hill. Follow its ribbon in a hand-drawn tracking shot.", zh: "红色风筝越过长满青草的山坡。以手绘动画的线条跟随飘带，让云影掠过地面。" },
  Portrait: { zhName: "人像", en: "Frame a face beside a tall window. Let dust drift through the light as the subject turns toward the camera.", zh: "人物立在高窗旁。尘埃飘过侧光，人物缓缓转向镜头，焦点落在双眼。" },
  Fantasy: { zhName: "幻想", en: "A glass city rises from a sleeping lake. Drift between the spires as the first lamps come on.", zh: "一座玻璃城从沉寂的湖面升起。镜头穿行于塔尖之间，窗里的灯依次亮起。" },
  "Sci-Fi": { zhName: "科幻", en: "Follow a lone astronaut toward a stone arch. The fog parts to reveal a planet above the horizon.", zh: "跟随一名宇航员走向巨石拱门。薄雾散开，远处地平线上浮现一颗行星。" },
  Nature: { zhName: "自然", en: "Watch a silver-green wave fold onto black basalt from above. Hold the frame as the foam traces the shore.", zh: "从上空俯拍银青色的浪头覆上玄武岩海岸。保持镜头平稳，看泡沫勾出岸线。" },
  Stylize: { zhName: "风格化", en: "Film a dancer in profile. At the turn, let the silhouette dissolve into broad strokes of wet ink.", zh: "侧面拍摄一名舞者。转身时让轮廓化为湿墨的笔触，随着动作在画面中铺开。" },
};

const effectsById: Record<string, PromptCopy> = {
  "float-away": { zhName: "轻盈漂浮", en: "A figure lifts gently from the pavement. Tilt up with their shoes as the street falls out of focus.", zh: "人物的鞋尖轻轻离开地面。镜头随双脚慢慢抬高，身后的街道渐渐虚化。" },
  "style-swap": { zhName: "风格切换", en: "Hold a street corner in the same composition as the rain stops. Change its surface from live action to ink and wash.", zh: "固定镜头拍雨停后的街角。保持构图不变，让实拍质感逐渐转为水墨。" },
  "fire-light": { zhName: "火光", en: "Frame a face in shadow. Let the light from an unseen fire flicker across one cheek and catch in the eyes.", zh: "近景拍摄暗处的一张脸。画外火焰的光影在一侧脸颊跳动，映入双眼。" },
  "world-grow": { zhName: "世界生长", en: "Start with moss on a stone. Pull back as roots branch across the rock and a forest grows around it.", zh: "从石面的一簇青苔开始。镜头后退，根系沿岩石蔓延，四周长成森林。" },
  "orbit-360": { zhName: "360° 环绕", en: "Circle a glass sculpture through one complete turn at eye level. Keep its center still while the background moves.", zh: "保持平视，围绕玻璃雕塑匀速拍摄完整一周。让主体稳居画面中心，背景随环绕移动。" },
  "slow-time": { zhName: "慢时光", en: "A drop strikes a still pool. Slow the impact until each bead of water hangs in the light, then let the ripples spread.", zh: "一滴水击中平静水面。把撞击放慢到每颗水珠都悬在光里，再让波纹缓缓散开。" },
};

const stylePresets = CATEGORY_FILTERS.filter((name) => name in stylesByName)
  .map((name) => ({ name, ...stylesByName[name] }));
const effectPresets = EFFECT_CARDS.map((effect) => ({ name: effect.title, ...effectsById[effect.id] }));

const copy = {
  zh: {
    selected: "精选镜头",
    gallery: "浏览作品库",
    directory: "创作目录",
    resources: [
      { title: "按风格找灵感", description: "选一种视觉风格，试写它的第一幕。", href: "/explore", browse: "探索更多风格", presets: stylePresets },
      { title: "选择视频特效", description: "为镜头加入环绕、光影或动态变化。", href: "/effects", browse: "浏览特效库", presets: effectPresets },
    ],
    models: "视频模型",
    studio: "打开视频工作台",
    pricing: "查看套餐与积分",
  },
  en: {
    selected: "Selected frames",
    gallery: "Browse the gallery",
    directory: "Studio directory",
    resources: [
      { title: "Explore by style", description: "Choose a visual style and try its opening shot.", href: "/explore", browse: "Explore more styles", presets: stylePresets },
      { title: "Browse video effects", description: "Give a shot a camera move, a change of light or a transformation.", href: "/effects", browse: "Full effects library", presets: effectPresets },
    ],
    models: "Video models",
    studio: "Open the video studio",
    pricing: "Plans and credits",
  },
};

type PresetGroup = { title: string; description: string; href: string; browse: string; presets: Preset[] };

function PresetPicker({ group, lang }: { group: PresetGroup; lang: string }) {
  const language = lang.startsWith("zh") ? "zh" : "en";
  const [index, setIndex] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const selected = group.presets[index];
  const prompt = selected[language];

  function openShot() {
    try {
      sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify({ prompt }));
    } catch {
      setStorageError(true);
      return;
    }
    window.location.assign(localizedHref(lang, "/text-to-video"));
  }

  return (
    <details className={styles.picker}>
      <summary className={styles.row}>
        <span>
          <strong>{group.title}</strong>
          <span className={styles.rowNote}>{group.description}</span>
        </span>
        <ChevronDown size={19} aria-hidden="true" />
      </summary>
      <div className={styles.pickerBody}>
        <fieldset className={styles.options} aria-label={group.title}>
          {group.presets.map((preset, i) => (
            <button key={preset.name} type="button" aria-pressed={i === index} onClick={() => { setIndex(i); setStorageError(false); }}>
              {language === "zh" ? preset.zhName : preset.name}
            </button>
          ))}
        </fieldset>
        <p className={styles.shot} aria-live="polite">{prompt}</p>
        <div className={styles.pickerActions}>
          <button className={styles.studio} type="button" onClick={openShot}>
            {language === "zh" ? "用这段分镜创作" : "Use this shot in the studio"}<ArrowRight size={15} aria-hidden="true" />
          </button>
          <Link className={styles.textLink} href={localizedHref(lang, group.href)}>{group.browse}<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
        {storageError && <p role="alert">{language === "zh" ? "请允许网站存储，或复制上方分镜到视频工作台。" : "Allow site storage, or copy the shot into the video studio."}</p>}
      </div>
    </details>
  );
}

export function PremiereCollection({ lang }: { lang: string }) {
  const language = lang.startsWith("zh") ? "zh" : "en";
  const text = copy[language];
  const href = (route: string) => localizedHref(lang, route);

  return (
    <div className={styles.collection}>
      <section className={styles.section} aria-labelledby="selected-frames">
        <header className={styles.heading}>
          <h2 id="selected-frames">{text.selected}</h2>
          <Link className={styles.textLink} href={href("/gallery")}>
            {text.gallery}<ArrowRight aria-hidden="true" size={16} />
          </Link>
        </header>
        <div className={styles.films}>
          {films.map((film) => (
            <Link className={styles.film} href={href(film.href)} key={film.slug}>
              <div className={styles.still}>
                <img src={`/home/premiere-${film.slug}.webp`} alt={film[language].alt} width={724} height={724} loading="lazy" decoding="async" />
              </div>
              <div className={styles.caption}>
                <div className={styles.filmTitle}>
                  <span className={styles.chapter} aria-hidden="true">{film.chapter}</span>
                  <h3>{film[language].title}</h3>
                </div>
                <span className={styles.entry}>{film[language].entry}<ArrowUpRight size={14} aria-hidden="true" /></span>
              </div>
            </Link>
          ))}
        </fieldset>
      </section>
      <section className={styles.directory} aria-labelledby="studio-directory">
        <h2 id="studio-directory">{text.directory}</h2>
        <div className={styles.index}>
          {text.resources.map((group) => <PresetPicker key={group.href} group={group} lang={lang} />)}
          <div className={styles.modelRow}>
            <h3>{text.models}</h3>
            <div className={styles.modelLinks}>
              {models.map((model) => <Link key={model.href} href={href(model.href)}>{model.name}</Link>)}
            </div>
          </div>
          <div className={styles.studioLinks}>
            <Link className={styles.studio} href={href("/ai/video")}>{text.studio}<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className={styles.textLink} href={href("/pricing")}>{text.pricing}</Link>
          </div>
        </div>
      </section>
      <GallerySection />
    </div>
  );
}
