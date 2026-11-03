"use client";

import Link from "next/link";
import { useState } from "react";
import { Aperture, ArrowRight, ArrowUpRight, ChevronDown, Crosshair } from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { TOOL_PREFILL_KEY, type ToolPrefill } from "@/components/gallery/use-template";
import { CATEGORY_FILTERS, EFFECT_CARDS, localizedHref } from "@/lib/du-home";
import styles from "./premiere-collection.module.css";

const films = [
  {
    slug: "shore",
    chapter: "I",
    duration: 5, href: "/text-to-video",
    en: { title: "Basalt shore", entry: "Stage this shot", genre: "Nature film", alt: "Turquoise surf breaking across a black basalt shore, viewed from above.", framing: "Extreme wide, overhead", motion: "Drift with the shoreline", light: "Soft silver daylight", prompt: "In a five-second overhead wide shot, drift parallel to a black basalt shore. Keep a lone walker near the edge of the frame as turquoise foam runs diagonally across the sand. Use soft silver daylight." },
    zh: { title: "玄武海岸", entry: "用文字搭建镜头", genre: "自然短片", alt: "从上空俯视青色浪花拍上玄武岩黑沙岸。", framing: "垂直俯视的大远景", motion: "沿岸线平缓横移", light: "银灰色漫射天光", prompt: "五秒的大远景，从正上方沿黑色玄武岩海岸缓缓横移。让独行的人留在画面一侧，青色泡沫斜穿黑沙。保留阴天柔和的银灰色天光。" },
  },
  {
    slug: "prism",
    chapter: "II",
    duration: 4, href: "/ai/video",
    en: { title: "Refracted portrait", entry: "Direct this portrait", genre: "Fashion film", alt: "A fashion portrait refracted through a faceted piece of optical glass.", framing: "Tight close-up on the eye", motion: "Rack focus through glass", light: "A narrow shaft of side light", prompt: "Hold a tight four-second portrait behind a prism. Start sharp on the glass, then pull focus to the model's eye as she turns slightly. A narrow beam of side light splits into gold and teal across her cheek." },
    zh: { title: "折光人像", entry: "在工作台设计运镜", genre: "时装短片", alt: "光学玻璃的切面折射出时装模特的肖像。", framing: "贴近眼睛的特写", motion: "从棱镜转焦至瞳孔", light: "窄束侧光穿过玻璃", prompt: "四秒的人像特写，模特从棱镜后轻轻转头。焦点先落在玻璃边缘，再缓慢移到眼睛。让窄束侧光穿过棱镜，在面颊上分成青色和金色。" },
  },
  {
    slug: "arch",
    chapter: "III",
    duration: 5, href: "/reference-to-video",
    en: { title: "Beyond the arch", entry: "Use this frame as a reference", genre: "Science fiction", alt: "A lone astronaut approaching a monumental stone arch in the mist.", framing: "Wide, with a small silhouette", motion: "Push in from behind", light: "Haze lit from the far side", prompt: "Use the reference frame for this five-second wide shot. Follow a lone astronaut slowly toward the stone arch, keeping the figure small beneath it. Let backlight through the fog reveal the opening before the terrain beyond it." },
    zh: { title: "石拱之外", entry: "用这张图作参考", genre: "科幻短片", alt: "一名宇航员独自走向薄雾里的巨大石拱。", framing: "远景，小人物与巨构", motion: "从人物身后慢推", light: "拱门背后的逆光薄雾", prompt: "以这张参考图构图，拍五秒远景。镜头从宇航员身后缓慢推向石拱，人物始终小于拱洞。让逆光透过薄雾，先勾出石拱的轮廓，再露出远方地形。" },
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
const effectPresets = EFFECT_CARDS.filter(({ id }) => id in effectsById)
  .map(({ id, title }) => ({ name: title, ...effectsById[id] }));

const copy = {
  zh: {
    selected: "摄影分镜手册",
    lead: "翻看三个镜头的摄影笔记，选一段分镜带到工作台。",
    gallery: "浏览作品库",
    directory: "创作目录",
    indexHint: "从风格或特效开始，也可以直接选择影片模型。",
    imageTool: "从图片开始",
    resources: [
      { title: "按风格找灵感", description: "选一种视觉风格，试写它的第一幕。", href: "/explore", browse: "探索更多风格", presets: stylePresets },
      { title: "选择视频特效", description: "为镜头加入环绕、光影或动态变化。", href: "/effects", browse: "浏览特效库", presets: effectPresets },
    ],
    models: "视频模型",
    studio: "打开视频工作台",
    pricing: "查看套餐与积分",
  },
  en: {
    selected: "The shot book",
    lead: "Look inside three setups, then take the shot you want to the studio.",
    gallery: "Browse the gallery",
    directory: "Studio directory",
    indexHint: "Start with a style, choose an effect, or go straight to a video model.",
    imageTool: "Start with an image",
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

function useStudioHandoff(lang: string) {
  const [storageError, setStorageError] = useState(false);
  function handoff(path: string, prefill: ToolPrefill) {
    try {
      sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      setStorageError(true);
      return;
    }
    window.location.assign(localizedHref(lang, path));
  }
  return { handoff, storageError, clearError: () => setStorageError(false) };
}

const cameraTraces = {
  shore: "M12 61 Q34 46 67 24 M58 24 L67 24 65 32",
  prism: "M34 20V13H41 M54 13H61V20 M61 27V34H54 M41 34H34V27 M47 21V26 M44.5 23.5H49.5",
  arch: "M16 56L43 35 M36 35H43V41 M84 56L57 35 M64 35H57V41",
};

function ShotPlate({ film, number, lang }: { film: (typeof films)[number]; number: number; lang: string }) {
  const zh = lang.startsWith("zh");
  const shot = film[zh ? "zh" : "en"];
  const image = `/home/premiere-${film.slug}.webp`;
  const [pinned, setPinned] = useState(false);
  const { handoff, storageError } = useStudioHandoff(lang);
  const notes = [
    [zh ? "景别" : "Framing", shot.framing],
    [zh ? "运镜" : "Movement", shot.motion],
    [zh ? "用光" : "Light", shot.light],
  ];
  const notesId = `notes-${film.slug}`;
  const studioLink = localizedHref(lang, "/ai/video") + "?" + new URLSearchParams({ prompt: shot.prompt }).toString();

  return (
    <article className={styles.film} data-shot={film.slug}>
      <div className={styles.slate}>
        <span><b>{film.chapter}</b> {zh ? "镜号" : "Shot"} {String(number).padStart(2, "0")}</span>
        <span>{shot.genre} <i aria-hidden="true">/</i> {film.duration}{zh ? " 秒分镜" : "s setup"}</span>
      </div>
      <button type="button" className={styles.viewfinder} aria-pressed={pinned}
        aria-label={zh ? `${shot.title}：固定摄影笔记` : `Pin camera notes for ${shot.title}`}
        aria-describedby={notesId} onClick={() => setPinned(!pinned)}>
        <img src={image} alt={shot.alt} width={724} height={724} loading="lazy" decoding="async" />
        <svg className={styles.cameraTrace} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={cameraTraces[film.slug]} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={styles.viewTag}><Crosshair size={14} aria-hidden="true" />{zh ? "摄影笔记" : "Camera notes"}</span>
        <span className={styles.overlay} id={notesId}>
          {notes.map(([label, value]) => <span className={styles.stat} key={label}><small>{label}</small><strong>{value}</strong></span>)}
        </span>
      </button>
      <div className={styles.caption}>
        <h3>{shot.title}</h3>
        <span className={styles.method}>{shot.motion}</span>
      </div>
      {film.href === "/ai/video" ? (
        <a className={styles.entry} href={studioLink}>{shot.entry}<ArrowUpRight size={15} aria-hidden="true" /></a>
      ) : (
        <button type="button" className={styles.entry}
          onClick={() => handoff(film.href, {
            prompt: shot.prompt, duration: film.duration,
            ...(film.href === "/reference-to-video" ? { imageUrl: new URL(image, location.origin).href } : {}),
          })}>
          {shot.entry}<ArrowUpRight size={15} aria-hidden="true" />
        </button>
      )}
      {storageError && <p role="alert">{zh ? "请允许网站保存分镜，或复制这段文字。" : "Allow site storage, or copy this shot."} {shot.prompt}</p>}
    </article>
  );
}

function PresetPicker({ group, lang }: { group: PresetGroup; lang: string }) {
  const language = lang.startsWith("zh") ? "zh" : "en";
  const [index, setIndex] = useState(0);
  const { handoff, storageError, clearError } = useStudioHandoff(lang);
  const selected = group.presets[index];
  const prompt = selected[language];

  return (
    <details className={styles.picker}>
      <summary className={styles.row}>
        <span>
          <strong>{group.title}</strong>
          <span className={styles.rowNote}>{group.description}</span>
        </span>
        <span className={styles.pickerCount}>{String(group.presets.length).padStart(2, "0")} <ChevronDown size={17} aria-hidden="true" /></span>
      </summary>
      <div className={styles.pickerBody}>
        <div className={styles.options} role="group" aria-label={group.title}>
          {group.presets.map((preset, i) => (
            <button key={preset.name} type="button" aria-pressed={i === index} onClick={() => { setIndex(i); clearError(); }}>
              {language === "zh" ? preset.zhName : preset.name}
            </button>
          ))}
        </div>
        <p className={styles.shot} aria-live="polite">{prompt}</p>
        <div className={styles.pickerActions}>
          <button className={styles.studio} type="button" onClick={() => handoff("/text-to-video", { prompt })}>
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
          <div className={styles.bookTitle}>
            <Aperture aria-hidden="true" />
            <div><h2 id="selected-frames">{text.selected}</h2><p>{text.lead}</p></div>
          </div>
          <div className={styles.headLinks}>
            <a className={styles.textLink} href="#studio-directory">{text.directory}<ChevronDown aria-hidden="true" size={15} /></a>
            <Link className={styles.textLink} href={href("/gallery")}>
              {text.gallery}<ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </header>
        <div className={styles.films}>
          {films.map((film, i) => <ShotPlate film={film} number={i + 1} lang={lang} key={film.slug} />)}
        </div>
      </section>
      <section className={styles.directory} aria-labelledby="studio-directory">
        <div className={styles.indexTitle}>
          <h2 id="studio-directory">{text.directory}</h2><p>{text.indexHint}</p>
          <Link className={styles.textLink} href={href("/image-to-video")}>{text.imageTool}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
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
