import { ArrowUpRight } from "lucide-react";
import { hasDbBinding } from "@/db";
import { getAvailableModels } from "@/config/credits";
import { STUDIO_MODELS } from "@/lib/ai-video-studio";
import { creationLabel } from "@/lib/creation-label";
import { localizedHref } from "@/lib/du-home";
import { galleryService } from "@/services/gallery";
import { EndFrame, FeatureFilm, TemplateWall } from "./conversion-media-tile";
import s from "./conversion-showcase.module.css";

const media = "/conversion/showcase/";
type Copy = { en: string; zh: string };
type Language = keyof Copy;
type Scene = { file: string; name: Copy; prompt: Copy };

const templates: Scene[] = [
  { file: "optics", name: { en: "Product in rotation", zh: "旋转产品镜头" }, prompt: { en: "Rotate the lens assembly against black. Trace its glass and brushed metal edges with narrow white reflections.", zh: "让镜头组件在黑底前缓缓旋转，用一束窄光勾出玻璃和金属的边缘。" } },
  { file: "shore", name: { en: "Coastal flyover", zh: "沿岸航拍" }, prompt: { en: "Fly parallel to a dark basalt coastline as pale surf washes over the sand. Keep the horizon steady under a silver sky.", zh: "贴着黑色玄武岩海岸平稳飞行，让银白浪花掠过黑沙，地平线保持水平。" } },
  { file: "marina", name: { en: "Harbor celebration", zh: "港湾庆祝" }, prompt: { en: "Glide past friends on the stern of a yacht as they raise their glasses. Catch the spray in the late afternoon light.", zh: "镜头沿游艇船尾掠过，朋友们举杯庆祝。午后的侧光照亮溅起的酒花。" } },
  { file: "portrait", name: { en: "Prism portrait", zh: "棱镜肖像" }, prompt: { en: "Hold a close portrait behind a glass prism. Pull focus from the edge of the glass to the model's eye as a band of light crosses her face.", zh: "透过玻璃棱镜拍摄人像特写。焦点从玻璃边缘移向眼睛，一道折射光掠过面颊。" } },
  { file: "ember", name: { en: "Ember eyes", zh: "琥珀目光" }, prompt: { en: "Hold a two-shot in a sunlit park. As the couple turns to face each other, their eyes take on an amber glow.", zh: "固定近景拍摄阳光下的两个人。当他们转头相望，让双眼泛出琥珀色的微光。" } },
  { file: "arch", name: { en: "Monument reveal", zh: "巨构揭幕" }, prompt: { en: "Follow an astronaut toward a giant stone arch. Push in slowly as a wind carries the fog through its opening.", zh: "跟随宇航员缓步接近石拱，镜头缓慢前推，风把薄雾从拱洞中吹过。" } },
];

const ideas: Scene[] = [
  { file: "shadow-portrait", name: { en: "Portrait in shadow", zh: "暗处的侧脸" }, prompt: { en: "Frame the face in profile. Let one narrow patch of daylight skim the cheek while the rest of the room stays in shadow.", zh: "用近景取侧脸，让一小束日光擦过面颊，房间其余部分留在阴影里。" } },
  { file: "poolside", name: { en: "Pool reflections", zh: "池边反光" }, prompt: { en: "Hold a woman at the edge of a swimming pool in a medium shot. Catch the light reflected from the water on her shoulders.", zh: "用中景拍摄坐在泳池边的人物，让水面反射的日光落在肩膀上。" } },
  { file: "sunlit-room", name: { en: "Window light", zh: "窗下光束" }, prompt: { en: "In a still room, let a shaft of sunlight catch floating dust. Push slowly toward the illuminated wall.", zh: "在静室内拍摄一道斜射的窗光，看尘埃在光束中漂浮，镜头慢慢推向墙面。" } },
  { file: "autumn-road", name: { en: "Autumn walk", zh: "秋日小径" }, prompt: { en: "Track two people walking under autumn maples. Let fallen leaves cross the foreground as the path recedes.", zh: "跟拍两个人走在秋日枫林，落叶从前景飞过，小径延伸向远处。" } },
  { file: "ember-dragon", name: { en: "Dragon rider", zh: "龙背骑手" }, prompt: { en: "Follow a rider on a rust-red dragon, then tilt up along the scales as the creature turns toward the light.", zh: "跟随红色巨龙背上的骑手，再沿鳞片缓缓仰拍，让巨龙转向光源。" } },
];

const studioPicks: Scene[] = [
  { file: "coastal-portrait", name: { en: "Seaward", zh: "向海而坐" }, prompt: { en: "Hold a wide portrait of a woman seated on the coastal rocks. Catch the fabric moving in the wind against a grey-blue sky.", zh: "以远景拍坐在岸边岩石上的人物。让裙摆迎风飘动，灰蓝天空留在身后。" } },
  { file: "after-dark", name: { en: "After dark", zh: "暮色之间" }, prompt: { en: "Two people lean close in a dimly lit street. Hold the camera steady and let the reflections from passing lights cross their faces.", zh: "在昏暗的街灯下拍摄靠近的两个人，镜头固定，掠过的光斑扫过侧脸。" } },
  { file: "moon-impact", name: { en: "Impact", zh: "撞击瞬间" }, prompt: { en: "Watch a fiery celestial body descend through dust over a dark horizon. Keep the terrain in silhouette.", zh: "一颗燃烧的星体穿过尘云，落向暗色地平线。将前景的地形保留为剪影。" } },
];

function sceneHref(lang: string, shot: Scene, language: Language) {
  return localizedHref(lang, "/ai/video") + "?" + new URLSearchParams({ prompt: shot.prompt[language] }).toString();
}

function CreationCTA({ lang, placement }: { lang: string; placement: string }) {
  return <a className="du-primary" data-cta-location={placement} href={localizedHref(lang, "/text-to-video")}>
    {creationLabel(lang)}
  </a>;
}

function SectionHeading({ title, id }: { title: string; id: string }) {
  return <header className={s.heading}><h2 id={id}>{title}</h2></header>;
}

function durationList(values: number[], zh: boolean) {
  if (!values.length) return "";
  const continuous = values.length > 2 && values.every((value, i) => !i || value === values[i - 1] + 1);
  const range = continuous ? values[0] + "–" + values[values.length - 1] : values.join(" / ");
  return range + (zh ? " 秒" : " s");
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
  const models = getAvailableModels({ mode: "text-to-video" });
  const sharedQualities = models[0]?.qualities?.filter(quality =>
    models.every(model => model.qualities?.includes(quality))) ?? [];
  return <div className={s.showcase}>
    <section id="models" className={s.section} aria-labelledby="showcase-models-title">
      <SectionHeading id="showcase-models-title" title={zh ? "选择视频模型" : "Choose a video model"} />
      <div className={s.modelIndex}>
        <figure className={s.modelPlate}>
          <img src={media + "cloud-ridge.webp"} width={720} height={420} loading="lazy" decoding="async" alt={zh ? "白色云雾沿山脊爬升" : "Clouds rising along a mountain ridge"} />
          <figcaption>{zh ? "山脊云海" : "Cloud ridge"}</figcaption>
        </figure>
        <div className={s.models} data-showcase-models="">
          {models.map((model) => {
            const editorial = STUDIO_MODELS.find((item) => item.id === model.id)?.badge;
            const badge = editorial === "New" ? "NEW" : undefined;
            const extraQualities = model.qualities?.filter(quality => !sharedQualities.includes(quality));
            const specs = [durationList(model.durations ?? [], zh), extraQualities?.join(" / ")].filter(Boolean);
            return (
              <a key={model.id} className={s.model} href={localizedHref(lang, "/text-to-video") + "?model=" + encodeURIComponent(model.id)}>
                <div><h3>{model.name}</h3>{badge && <span className={s.modelBadge}>{badge}</span>}</div>
                <p>{specs.join(" · ")}</p>
                <ArrowUpRight aria-hidden="true" size={16} />
              </a>
            );
          })}
          {sharedQualities.length > 0 && <p className={s.sharedSpec}>
            {zh ? "共有画质" : "Available on all models"} · {sharedQualities.join(" / ")}
          </p>}
        </div>
      </div>
    </section>
    <section id="long-film" className={s.featureSection} aria-labelledby="showcase-film-title">
      <div className={s.featureHeading}><h2 id="showcase-film-title">{zh ? "同一机位，三次试镜" : "One setup, three takes"}</h2></div>
      <FeatureFilm zh={zh} src={media + "daylight-takes.mp4"} label={zh ? "同一机位，三次试镜" : "One setup, three takes"} playLabel={zh ? "播放三段试镜" : "Play the three takes"} />
      <div className={s.filmFooter}>
        <p>{zh ? "12 秒，同一个双人机位。前两条改变眼部光效，最后一条让小狗入画。" : "12 seconds from one camera position. Two takes change the light around the eyes. In the third, a dog enters the frame."}</p>
        <CreationCTA lang={lang} placement="long-film" />
      </div>
    </section>
    <section id="templates" className={s.section} aria-labelledby="showcase-templates-title">
      <SectionHeading id="showcase-templates-title" title={zh ? "镜头模板" : "Camera moves"} />
      <TemplateWall zh={zh} items={templates.map((shot) => ({
        name: shot.name[language], href: sceneHref(lang, shot, language), alt: "",
        video: media + shot.file + ".mp4", poster: media + shot.file + ".webp",
      }))} />
      <div className={s.sectionCta}><CreationCTA lang={lang} placement="templates" /></div>
    </section>
    <section id="image-ideas" className={s.section} aria-labelledby="showcase-ideas-title">
      <SectionHeading id="showcase-ideas-title" title={zh ? "画面参考" : "Frame studies"} />
      <div className={s.ideas} data-showcase-ideas="">
        {ideas.map((shot) => <a key={shot.file} className={s.idea} href={sceneHref(lang, shot, language)} aria-label={shot.name[language]}>
          <img width={720} height={720} src={media + shot.file + ".webp"} loading="lazy" decoding="async" alt="" />
          <span className={s.tileName}>{shot.name[language]}</span>
        </a>)}
      </div>
    </section>
    <ConversionGallery lang={lang} language={language} />
  </div>;
}

export function ConversionFinalCTA({ lang }: { lang: string }) {
  const zh = lang.startsWith("zh");
  return (
    <section className={s.final} aria-labelledby="showcase-final-title">
      <div className={s.finalInner}>
        <EndFrame zh={zh} />
        <div className={s.finalContent}>
          <h2 id="showcase-final-title">{zh ? "写下你的第一个分镜" : "Write your first shot"}</h2>
          <CreationCTA lang={lang} placement="final" />
        </div>
      </div>
    </section>
  );
}
