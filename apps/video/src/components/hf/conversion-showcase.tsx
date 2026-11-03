import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { hasDbBinding } from "@/db";
import { creationLabel } from "@/lib/creation-label";
import { localizedHref } from "@/lib/du-home";
import { galleryService } from "@/services/gallery";
import { FeatureFilm, TemplateWall } from "./conversion-media-tile";
import s from "./conversion-showcase.module.css";

const media = "/conversion/showcase/";
type Copy = { en: string; zh: string };
type Language = keyof Copy;
type Scene = { file: string; name: Copy; prompt: Copy };

const templates: Scene[] = [
  { file: "shore", name: { en: "Coastal flyover", zh: "沿岸航拍" }, prompt: { en: "Fly parallel to a dark basalt coastline as pale surf washes over the sand. Keep the horizon steady under a silver sky.", zh: "贴着黑色玄武岩海岸平稳飞行，让银白浪花掠过黑沙，地平线保持水平。" } },
  { file: "marina", name: { en: "Harbor celebration", zh: "港湾庆祝" }, prompt: { en: "Glide past friends on the stern of a yacht as they raise their glasses. Catch the spray in the late afternoon light.", zh: "镜头沿游艇船尾掠过，朋友们举杯庆祝。午后的侧光照亮溅起的酒花。" } },
  { file: "portrait", name: { en: "Prism portrait", zh: "棱镜肖像" }, prompt: { en: "Hold a close portrait behind a glass prism. Pull focus from the edge of the glass to the model's eye as a band of light crosses her face.", zh: "透过玻璃棱镜拍摄人像特写。焦点从玻璃边缘移向眼睛，一道折射光掠过面颊。" } },
  { file: "optics", name: { en: "Product in rotation", zh: "旋转产品镜头" }, prompt: { en: "Rotate the lens assembly against black. Trace its glass and brushed metal edges with narrow white reflections.", zh: "让镜头组件在黑底前缓缓旋转，用一束窄光勾出玻璃和金属的边缘。" } },
  { file: "arch", name: { en: "Monument reveal", zh: "巨构揭幕" }, prompt: { en: "Follow an astronaut toward a giant stone arch. Push in slowly as a wind carries the fog through its opening.", zh: "跟随宇航员缓步接近石拱，镜头缓慢前推，风把薄雾从拱洞中吹过。" } },
  { file: "ember", name: { en: "Ember eyes", zh: "琥珀目光" }, prompt: { en: "Hold a two-shot in a sunlit park. As the couple turns to face each other, their eyes take on an amber glow.", zh: "固定近景拍摄阳光下的两个人。当他们转头相望，让双眼泛出琥珀色的微光。" } },
];

const ideas: Scene[] = [
  { file: "basalt-coast", name: { en: "Black sand", zh: "玄武海岸" }, prompt: { en: "Look straight down as turquoise waves sweep diagonally across black sand. Hold a lone walker near the edge of the frame.", zh: "从正上方拍摄黑沙海岸，让青色泡沫斜穿画面，一名独行的人停在岸边。" } },
  { file: "glass-portrait", name: { en: "Through glass", zh: "玻璃之后" }, prompt: { en: "Place a pane of faceted glass in front of a fashion portrait. Move the glass slightly so the light shifts without changing the framing.", zh: "把一块多切面玻璃放在肖像前，轻轻转动玻璃，让面部光影变化而构图不动。" } },
  { file: "sunlit-room", name: { en: "Window light", zh: "窗下光束" }, prompt: { en: "In a still room, let a shaft of sunlight catch floating dust. Push slowly toward the illuminated wall.", zh: "在静室内拍摄一道斜射的窗光，看尘埃在光束中漂浮，镜头慢慢推向墙面。" } },
  { file: "autumn-road", name: { en: "Autumn walk", zh: "秋日小径" }, prompt: { en: "Track two people walking under autumn maples. Let fallen leaves cross the foreground as the path recedes.", zh: "跟拍两个人走在秋日枫林，落叶从前景飞过，小径延伸向远处。" } },
  { file: "ember-dragon", name: { en: "Dragon rider", zh: "龙背骑手" }, prompt: { en: "Follow a rider on a rust-red dragon, then tilt up along the scales as the creature turns toward the light.", zh: "跟随红色巨龙背上的骑手，再沿鳞片缓缓仰拍，让巨龙转向光源。" } },
  { file: "stone-arch", name: { en: "Beyond the arch", zh: "石拱之外" }, prompt: { en: "Keep the astronaut small beneath a monumental stone arch. Backlight the drifting fog to reveal the opening.", zh: "让宇航员在巨石拱门下显得渺小，用逆光照亮移过的薄雾，露出拱门后的空间。" } },
];

const studioPicks: Scene[] = [
  { file: "coastal-portrait", name: { en: "Seaward", zh: "向海而坐" }, prompt: { en: "Hold a wide portrait of a woman seated on the coastal rocks. Catch the fabric moving in the wind against a grey-blue sky.", zh: "以远景拍坐在岸边岩石上的人物。让裙摆迎风飘动，灰蓝天空留在身后。" } },
  { file: "after-dark", name: { en: "After dark", zh: "暮色之间" }, prompt: { en: "Two people lean close in a dimly lit street. Hold the camera steady and let the reflections from passing lights cross their faces.", zh: "在昏暗的街灯下拍摄靠近的两个人，镜头固定，掠过的光斑扫过侧脸。" } },
  { file: "moon-impact", name: { en: "Impact", zh: "撞击瞬间" }, prompt: { en: "Watch a fiery celestial body descend through dust over a dark horizon. Keep the terrain in silhouette.", zh: "一颗燃烧的星体穿过尘云，落向暗色地平线。将前景的地形保留为剪影。" } },
];

const models = [
  { name: "Sora 2", href: "/sora-2", en: "Stage a scene from a written prompt.", zh: "从一段文字搭建镜头。" },
  { name: "Veo 3.1", href: "/veo-3-1", en: "Build a cinematic scene with sound.", zh: "创作带声音的电影感画面。" },
  { name: "Wan 2.6", href: "/wan-2-6", en: "Bring motion to a product or portrait.", zh: "为产品或肖像画面加入动态。" },
  { name: "Seedance 1.5 Pro", href: "/seedance-1-5", en: "Try a short shot from text or a still.", zh: "用文字或静帧尝试一条短片。" },
];

function sceneHref(lang: string, shot: Scene, language: Language) {
  return localizedHref(lang, "/ai/video") + "?" + new URLSearchParams({ prompt: shot.prompt[language] }).toString();
}

function CreationCTA({ lang, placement }: { lang: string; placement: string }) {
  return <a className="du-primary" data-cta-location={placement} href={localizedHref(lang, "/text-to-video")}>
    {creationLabel(lang)}
  </a>;
}

function SectionHeading({ title, note, id }: { title: string; note?: string; id: string }) {
  return <header className={s.heading}>
    <h2 id={id}>{title}</h2>
    {note && <p>{note}</p>}
  </header>;
}

type GalleryTile = { name: string; image: string; href: string; credit?: string };

async function ConversionGallery({ lang, language }: { lang: string; language: Language }) {
  let items: GalleryTile[] = [];
  if (hasDbBinding()) {
    try {
      const page = await galleryService.listPublic({ limit: 6 });
      items = page.items.flatMap((item) => item.thumbnailUrl ? [{
        name: item.title, image: item.thumbnailUrl, credit: item.authorName,
        href: localizedHref(lang, "/gallery") + "?" + new URLSearchParams({ video: item.uuid }).toString(),
      }] : []).slice(0, 3);
    } catch {
      // Preview builds can have no usable gallery data; render the studio selection below.
    }
  }
  const community = items.length > 0;
  if (!community) items = studioPicks.map((shot) => ({
    name: shot.name[language], image: media + shot.file + ".webp", href: sceneHref(lang, shot, language),
  }));
  return <section id="gallery" className={s.section} aria-labelledby="showcase-gallery-title" data-showcase-gallery="">
    <SectionHeading id="showcase-gallery-title" title={language === "zh" ? (community ? "社区作品" : "工作室精选") : (community ? "Community gallery" : "Studio gallery")} />
    <div className={s.gallery}>
      {items.map((item) => <a href={item.href} key={item.href} aria-label={item.name} className={s.galleryTile}>
        <img width={640} height={440} src={item.image} alt="" loading="lazy" decoding="async" />
        <span><strong>{item.name}</strong>{item.credit && <small>{item.credit}</small>}</span>
      </a>)}
    </div>
  </section>;
}

export function ConversionShowcase({ lang }: { lang: string }) {
  const language = lang.startsWith("zh") ? "zh" : "en";
  const zh = language === "zh";
  return <div className={s.showcase}>
    <section id="templates" className={s.section} aria-labelledby="showcase-templates-title">
      <SectionHeading id="showcase-templates-title" title={zh ? "视频模板" : "Video templates"}
        note={zh ? "选一段你喜欢的运镜，在工作台改写它。" : "Pick a camera move and make the shot your own."} />
      <TemplateWall zh={zh} items={templates.map((shot) => ({
        name: shot.name[language], href: sceneHref(lang, shot, language), alt: "",
        video: media + shot.file + ".mp4", poster: media + shot.file + ".webp",
      }))} />
      <div className={s.sectionCta}><CreationCTA lang={lang} placement="templates" /></div>
    </section>
    <section id="image-ideas" className={s.section} aria-labelledby="showcase-ideas-title">
      <SectionHeading id="showcase-ideas-title" title={zh ? "图片灵感" : "Image inspiration"}
        note={zh ? "从构图和光线开始，把一张静帧发展成一幕。" : "Start with the framing or the light, then turn it into a scene."} />
      <div className={s.ideas} data-showcase-ideas="">
        {ideas.map((shot) => <a key={shot.file} className={s.idea} href={sceneHref(lang, shot, language)} aria-label={shot.name[language]}>
          <img width={720} height={720} src={media + shot.file + ".webp"} loading="lazy" decoding="async" alt="" />
          <span className={s.tileName}>{shot.name[language]}</span>
        </a>)}
      </div>
    </section>
    <section id="long-film" className={s.featureSection} aria-labelledby="showcase-film-title">
      <div className={s.featureHeading}><h2 id="showcase-film-title">{zh ? "从镜头到长片" : "From shot to sequence"}</h2></div>
      <FeatureFilm poster={media + "tidal-overture.webp"} src={media + "tidal-overture.mp4"} label={zh ? "潮汐序曲" : "Tidal Overture"} playLabel={zh ? "播放《潮汐序曲》" : "Play Tidal Overture"} />
      <div className={s.filmFooter}>
        <p>{zh ? "在《潮汐序曲》中，看海岸的广角、人物特写和远景如何剪成同一段故事。" : "See how Tidal Overture cuts from a coastal wide shot to a portrait and out to a sweeping final frame."}</p>
        <CreationCTA lang={lang} placement="long-film" />
      </div>
    </section>
    <section id="models" className={s.section} aria-labelledby="showcase-models-title">
      <SectionHeading id="showcase-models-title" title={zh ? "视频模型" : "Video models"} />
      <div className={s.models} data-showcase-models="">
        {models.map((model) => <a key={model.href} className={s.model} href={localizedHref(lang, model.href)} aria-label={model.name}>
          <div><h3>{model.name}</h3><ArrowUpRight aria-hidden="true" size={18} /></div>
          <p>{model[language]}</p>
        </a>)}
      </div>
    </section>
    <Suspense fallback={null}><ConversionGallery lang={lang} language={language} /></Suspense>
  </div>;
}

export function ConversionFinalCTA({ lang }: { lang: string }) {
  const zh = lang.startsWith("zh");
  return <section className={s.final} aria-labelledby="showcase-final-title">
    <div className={s.finalInner}>
      <h2 id="showcase-final-title">{zh ? "下一幕，由你开拍。" : "Make your next shot."}</h2>
      <CreationCTA lang={lang} placement="final" />
    </div>
  </section>;
}
