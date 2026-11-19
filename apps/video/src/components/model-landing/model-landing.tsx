import Link from "next/link";
import { ArrowRight, AudioLines, Check, ChevronDown, Clapperboard, Image as ImageIcon, Sparkles } from "lucide-react";

import { WallCard } from "@/components/hf/wall-card";
import { InViewVideo } from "@/components/hf/in-view-video";
import { ModelPrompt } from "@/components/model-landing/model-prompt";
import { localizedHref } from "@/lib/du-home";
import { withPrompt } from "@/lib/home-showcase";
import {
  kindLabel,
  landingFaqs,
  landingHighlights,
  landingHref,
  landingIntro,
  landingMedia,
  landingPrice,
  landingSpecs,
  landingTitle,
  landingUseCases,
  liveAlternative,
  relatedModels,
  studioHref,
  type LandingModel,
} from "@/lib/model-landing";
import "@/components/hf/home-showcase.css";
import "./model-landing.css";

const WALL_RATIOS = ["3 / 4", "4 / 3", "1 / 1", "4 / 5", "16 / 10", "3 / 4"];
const KIND_ICON = { video: Clapperboard, image: ImageIcon, audio: AudioLines } as const;

/** A model's own page, from the shared landing data. */
export function ModelLanding({ model, lang }: { model: LandingModel; lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const href = (path: string) => localizedHref(lang, path);
  const kind = kindLabel(model.kind);
  const KindIcon = KIND_ICON[model.kind];
  const specs = landingSpecs(model);
  const price = landingPrice(model);
  const highlights = landingHighlights(model);
  const media = landingMedia(model);
  const faqs = landingFaqs(model, zh);
  const related = relatedModels(model);
  const alternative = model.live ? undefined : liveAlternative(model);
  const target = model.live ? model : alternative;
  const title = landingTitle(model, zh);
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: zh ? "zh-CN" : "en",
    mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })),
  };

  const steps = zh
    ? [
        { title: "写下想法", body: model.kind === "audio" ? "输入要读的文本，或描述想要的音乐和音效。" : "描述主体、场景、动作和风格，也可以上传参考图。" },
        { title: "调好参数", body: "选择比例、画质或音色，按钮上会实时显示本次要用的积分。" },
        { title: "生成下载", body: "生成完成后可以预览、下载，失败会自动退回积分。" },
      ]
    : [
        { title: "Write the idea", body: model.kind === "audio" ? "Type the script, or describe the music and sound you want." : "Describe the subject, scene, motion and style, or add references." },
        { title: "Set the options", body: "Pick ratio, quality or voice; the button shows the credit cost as you go." },
        { title: "Generate and download", body: "Preview and download when it is done. Failed runs are refunded." },
      ];

  return (
    <div className="ml">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson) }} />

      {/* 1. Hero: the picture fills the first screen, words sit centred at the foot */}
      <section className={`ml-hero ${model.kind === "audio" ? "ml-hero-audio" : ""}`}>
        <div className="ml-hero-media" aria-hidden="true">
          {model.kind === "audio" ? (
            <div className="ml-wave">
              {Array.from({ length: 64 }, (_, index) => (
                <span key={index} style={{ height: `${14 + Math.round(Math.abs(Math.sin(index * 0.55) * 64) + (index % 7) * 3)}%` }} />
              ))}
            </div>
          ) : media.hero.video ? (
            <InViewVideo src={media.hero.src} poster={media.hero.poster} threshold={0.2} />
          ) : (
            <img src={media.hero.src} alt="" />
          )}
          <span className="ml-hero-shade" />
        </div>
        <div className="ml-hero-text">
          <p className="ml-kicker">
            <KindIcon aria-hidden="true" />
            {zh ? `AI ${kind.zh}模型` : `AI ${kind.en.toLowerCase()} model`}
            {model.live ? null : <span className="ml-soon">{zh ? "即将上线" : "Coming soon"}</span>}
            {model.live && model.badge ? <span className="ml-badge">{model.badge === "hot" ? (zh ? "热门" : "Hot") : zh ? "新" : "New"}</span> : null}
          </p>
          <h1 className="ml-title">
            {model.name}
            {highlights.find((item) => item.label.en === "Top resolution") ? (
              <span className="ml-title-tag">{highlights.find((item) => item.label.en === "Top resolution")?.big}</span>
            ) : null}
          </h1>
          <p className="ml-intro">{landingIntro(model, zh)}</p>
          {target ? (
            <ModelPrompt
              href={href(studioHref(target))}
              placeholder={
                model.kind === "audio"
                  ? zh
                    ? "输入要读的文本，或描述想要的声音……"
                    : "Type a script or describe a sound…"
                  : zh
                    ? `描述你想用 ${target.name} 生成的画面……`
                    : `Describe what ${target.name} should make…`
              }
              label={model.live ? (zh ? "开始生成" : "Generate") : zh ? `用 ${target.name} 生成` : `Use ${target.name}`}
            />
          ) : null}
          <p className="ml-note">
            {model.live
              ? price
                ? zh
                  ? `${price.label.zh} · 生成前显示积分 · 失败自动退回`
                  : `${price.label.en} · cost shown before you start · failed runs refunded`
                : null
              : zh
                ? `${model.name} 还没有开放生成。现在可以先用 ${target?.name ?? "其他模型"} 创作。`
                : `${model.name} is not open yet. You can create with ${target?.name ?? "another model"} today.`}
          </p>
        </div>
        {model.kind === "audio" ? null : <span className="ml-hero-caption">{zh ? "示例画面" : "Sample"}</span>}
      </section>

      {/* 2. Headline numbers, then the full list */}
      {highlights.length || specs.length ? (
        <section className="ml-section" aria-labelledby="ml-specs">
          <div className="ml-head-c">
            <p className="ml-eyebrow">{zh ? "参数" : "Specs"}</p>
            <h2 id="ml-specs" className="ml-h2">
              {model.live ? (zh ? `${model.name} 能做到什么` : `What ${model.name} can do`) : zh ? `${model.name} 的参数` : `${model.name} specs`}
            </h2>
          </div>
          {highlights.length ? (
            <div className={`ml-bento ml-bento-${Math.min(highlights.length, 5)}`}>
              {highlights.map((item) => (
                <div key={item.label.en} className="ml-big">
                  <span className="ml-big-num">
                    {item.big}
                    {(zh ? item.unit.zh : item.unit.en) ? <small>{zh ? item.unit.zh : item.unit.en}</small> : null}
                  </span>
                  <span className="ml-big-label">{zh ? item.label.zh : item.label.en}</span>
                </div>
              ))}
            </div>
          ) : null}
          {specs.length ? (
            <dl className="ml-specs">
              {specs.map((spec) => (
                <div key={spec.label.en} className="ml-spec">
                  <dt>{zh ? spec.label.zh : spec.label.en}</dt>
                  <dd>{zh ? spec.value.zh : spec.value.en}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      {/* 3. Ideas wall */}
      {model.kind !== "audio" && target ? (
        <section className="ml-section" aria-labelledby="ml-ideas">
          <div className="ml-head-c">
            <p className="ml-eyebrow">{zh ? "灵感" : "Ideas"}</p>
            <h2 id="ml-ideas" className="ml-h2">{zh ? `用 ${model.name} 做同款` : `Make one with ${model.name}`}</h2>
            <p className="ml-sub">{zh ? "点一张，带着提示词去生成" : "Pick one to open the studio with its prompt"}</p>
          </div>
          <div className="hs-wall ml-wall">
            {media.wall.map((item, position) => {
              const text = item.prompt ? (zh ? item.prompt.zh : item.prompt.en) : undefined;
              return (
                <WallCard
                  key={item.media.src}
                  media={item.media}
                  href={href(withPrompt(studioHref(target), text))}
                  prompt={text}
                  cta={zh ? "做同款" : "Make one like this"}
                  ratio={WALL_RATIOS[position % WALL_RATIOS.length]}
                  position={position}
                  zh={zh}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 4. Steps and use cases */}
      <section className="ml-section ml-two" aria-labelledby="ml-how">
        <div>
          <h2 id="ml-how" className="ml-h2">{zh ? `三步用 ${model.name} 创作` : `Create with ${model.name} in three steps`}</h2>
          <ol className="ml-steps">
            {steps.map((step, index) => (
              <li key={step.title} className="ml-step">
                <span className="ml-step-n">{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="ml-h2">{zh ? "适合用来做" : "Good for"}</h2>
          <ul className="ml-uses">
            {landingUseCases(model, zh).map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. FAQ */}
      <section className="ml-section" aria-labelledby="ml-faq">
        <div className="ml-head-c">
          <p className="ml-eyebrow">FAQ</p>
          <h2 id="ml-faq" className="ml-h2">{zh ? "常见问题" : "Questions"}</h2>
        </div>
        <div className="ml-faq">
          {faqs.map((faq, index) => (
            <details key={faq.q} open={index === 0}>
              <summary>
                {faq.q}
                <ChevronDown aria-hidden="true" />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 6. Other models */}
      {related.length ? (
        <section className="ml-section" aria-labelledby="ml-more">
          <div className="ml-head-c">
            <p className="ml-eyebrow">{zh ? "更多模型" : "More models"}</p>
            <h2 id="ml-more" className="ml-h2">{zh ? `其他 AI ${kind.zh}模型` : `Other AI ${kind.en.toLowerCase()} models`}</h2>
          </div>
          <div className="ml-related">
            {related.map((item) => (
              <Link key={item.slug} href={href(landingHref(item.slug))} className="ml-rel">
                <span className="ml-rel-name">
                  {item.name}
                  {item.live ? null : <span className="ml-soon">{zh ? "即将上线" : "Soon"}</span>}
                </span>
                <span className="ml-rel-desc">{zh ? item.desc.zh : item.desc.en}</span>
                <ArrowRight className="ml-rel-go" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Closing call to action */}
      {target ? (
        <section className="ml-cta">
          <Sparkles aria-hidden="true" />
          <h2 className="ml-cta-title">{zh ? `现在就用 ${target.name} 试一次` : `Try ${target.name} now`}</h2>
          <p>{zh ? "新用户注册即送积分，可以免费生成第一条作品。" : "New accounts get free credits for a first creation."}</p>
          <Link href={href(studioHref(target))} className="ml-cta-btn">
            {zh ? "打开生成器" : "Open the generator"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      ) : null}
    </div>
  );
}
