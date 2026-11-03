import type { Locale } from "@/config/i18n-config";
import { getModelConfig } from "@/config/credits";
import { localizedHref } from "@/lib/du-home";
import { fallbackModel, seedanceGuides, supportFaq, supportTitle, type SeedanceVersion } from "@/lib/seedance-support";
import { ModelCreditTable } from "@/components/pricing/model-credit-table";
import { PromptBox } from "@/components/hf/prompt-box";
import s from "./seedance-support-page.module.css";

const exercises = {
  "2.5": [
    ["shore", "Establish the coastline", "沿岸开场", "Track parallel to a basalt beach. Let one line of white surf enter the foreground as the horizon stays level.", "平行于玄武岩海滩向前移动。保持地平线水平，让一道白色海浪进入前景。"],
    ["arch", "Reveal a landmark", "揭示地标", "Start behind a lone explorer. Push toward a stone arch as fog clears from its opening.", "从探险者身后向前推镜。薄雾散开，露出前方石拱的轮廓。"],
    ["optics", "Finish on a detail", "以细节收尾", "Rotate a lens assembly against black. Rack focus to the thin reflection on its outer rim.", "让镜头组件在黑底前旋转，把焦点拉向外圈的细窄反光。"],
  ],
  "2.0": [
    ["portrait", "Keep one face in focus", "对焦面部", "Frame a close portrait through a glass prism. Shift focus from the glass edge to the nearest eye.", "透过玻璃棱镜拍一张近景肖像，把焦点从玻璃边缘移到靠近镜头的眼睛。"],
    ["marina", "Give the camera a path", "给镜头一条轨迹", "Glide along a yacht’s stern as friends raise their glasses. Hold the horizon steady as spray crosses the frame.", "贴着游艇船尾滑行，朋友们举起酒杯。水花掠过，地平线保持稳定。"],
    ["ember", "Direct a small gesture", "设计一个细微动作", "Hold a two-shot as the couple turns toward each other. Let a warm reflection catch their eyes.", "固定双人近景，两人慢慢转头相望。一点暖色反光落入眼中。"],
  ],
} as const;

export function SeedanceSupportPage({ version, lang }: { version: SeedanceVersion; lang: Locale }) {
  const zh = lang === "zh";
  const newer = version === "2.5";
  const sibling: SeedanceVersion = newer ? "2.0" : "2.5";
  const faq = supportFaq(version, lang);
  const guide = seedanceGuides[version];
  const model = getModelConfig(fallbackModel);
  const durations = model?.durations.join(", ");
  const qualities = model?.qualities?.map((q) => q.toLowerCase()).join(" / ");
  const comparisons = [
    ["Seedance 2.5", zh ? "尚未接入" : "Not connected", zh ? "官方单次最长 30 秒，支持多镜头和多模态参考。" : "ByteDance documents up to 30 seconds, shot changes and multimodal references."],
    ["Seedance 2.0", zh ? "尚未接入" : "Not connected", zh ? "官方单次最长 15 秒，接受文字、图像、视频和音频参考。" : "ByteDance documents up to 15 seconds with text, image, video and audio references."],
    ["Seedance 1.5 Pro", zh ? "本站工具可选" : "Selectable here", zh ? `可用时长 ${durations} 秒；${qualities}。` : `${durations} seconds at ${qualities}.`],
    ["Kling 4.0", zh ? "尚未接入" : "Not connected", zh ? "此版本没有本站生成入口或积分价格。" : "No generation workflow or credit rate is listed for this version."],
    ["Veo 3.1", zh ? "工作室目录" : "Studio listing", zh ? "工作室列有此模型，现有积分配置未启用它。" : "The studio lists this model; the current billing catalog has it disabled."],
  ];
  const steps = zh ? [
    "在上方选择文生视频或图生视频。确认模型显示 Seedance 1.5 Pro。",
    "描述一个主体动作、一种运镜和光线。使用图生视频时，到工作台添加有权使用的参考图。",
    "在工作台确认时长、画质和所需积分，再决定是否提交。需要成片时，按镜头分别生成并剪辑。",
  ] : [
    "Choose text-to-video or image-to-video in the composer. Confirm that the model reads Seedance 1.5 Pro.",
    "Describe one subject action, a camera move and the light. For image-to-video, add a reference still in the studio.",
    "Review the duration, resolution and credit estimate in the studio before submitting. Generate and edit separate clips for a sequence.",
  ];
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([name, answer]) => ({
      "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <div className={s.page}>
      <header className={s.hero}>
        <p className={s.kicker}>{zh ? "模型支持 / Seedance" : "Model support / Seedance"}</p>
        <h1>{supportTitle(version, lang)}</h1>
        <p className={s.lead}>{zh
          ? `本站尚未接入 Seedance ${version}。${newer ? "想制作更长的段落，可以先把故事拆成几个短镜头。" : "想用一张参考图控制构图，可以先从一个主体动作试起。"}下方工作台使用 Seedance 1.5 Pro。`
          : `Seedance ${version} is not connected to aidv.ai. ${newer ? "To work on a longer sequence now, plan it as separate shots." : "To try a reference-image workflow now, start with one subject and one movement."} The composer below uses Seedance 1.5 Pro.`}
        </p>
        <div id="seedance-composer" className={s.composer}><PromptBox lang={lang} preferredModel={fallbackModel} /></div>
      </header>

      <section className={s.section}>
        <h2>{zh ? (newer ? "用三个镜头设计一段叙事" : "三个参考镜头练习") : (newer ? "Plan a sequence in three shots" : "Three reference-shot exercises")}</h2>
        <p>{zh ? "以下为工作室参考片和配套练习提示词。点击播放后，按自己的项目调整镜头描述。" : "These studio reference films accompany the prompt exercises. Play a clip, then adapt its direction to your own scene."}</p>
        <div className={s.films}>{exercises[version].map(([file, en, cn, prompt, promptZh]) => (
          <figure key={file}>
            <video controls playsInline preload="none" poster={`/conversion/showcase/${file}.webp`} src={`/conversion/showcase/${file}.mp4`} aria-label={zh ? cn : en} />
            <figcaption><strong>{zh ? cn : en}</strong><span>{zh ? promptZh : prompt}</span></figcaption>
          </figure>
        ))}</div>
      </section>

      <section className={s.section}>
        <h2>{zh ? "模型与本站支持情况" : "Which models can you use here?"}</h2>
        <div className={s.comparison}><table>
          <thead><tr>{(zh ? ["模型", "本站状态", "能力与限制"] : ["Model", "On aidv.ai", "Capabilities and limits"]).map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{comparisons.map(([name, status, note]) => <tr key={name}><th scope="row">{name}</th><td>{status}</td><td>{note}</td></tr>)}</tbody>
        </table></div>
        <p className={s.links}>{zh ? "模型开发者资料" : "Developer sources"} · <a href={seedanceGuides["2.5"].official}>ByteDance Seedance 2.5</a> · <a href={seedanceGuides["2.0"].official}>ByteDance Seedance 2.0</a></p>
      </section>

      <section className={s.section}>
        <h2>{zh ? "用 1.5 Pro 开始" : "Start a shot in 1.5 Pro"}</h2>
        <ol className={s.steps}>{steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <section className={s.section}>
        <h2>{zh ? "构图、时长和参考素材" : "Framing, duration and reference inputs"}</h2>
        <p>{zh
          ? `本站 1.5 Pro 可以从文字或参考图开始，单个镜头最长 ${model?.maxDuration} 秒。${newer ? "若要规划 30 秒片段，可以先试三个 10 秒镜头，再到剪辑工具中拼接。" : "先写明保持不变的构图，再描述要变化的动作，调整提示词时一次只改一项。"} 当前输入框不提供参考音频、参考视频或原生音轨开关。`
          : `The 1.5 Pro workflow starts from text or a reference still, with clips up to ${model?.maxDuration} seconds. ${newer ? "For a 30-second piece, plan three 10-second shots and assemble them in your editor." : "Name the framing that should stay fixed, then direct the motion. Change one instruction at a time between takes."} The composer has no reference-audio, reference-video or soundtrack control.`}</p>
        <p className={s.links}><a href={guide.official}>{zh ? `查看 Seedance ${version} 官方能力说明` : `Read the official Seedance ${version} model description`}</a></p>
      </section>
      <ModelCreditTable lang={lang} modelId={fallbackModel} />
      <section className={s.section}>
        <h2>{zh ? "常见问题" : "Frequently asked questions"}</h2>
        <div className={s.faq}>{faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
        <p className={s.links}><a href={localizedHref(lang, "/pricing")}>{zh ? "方案与积分包" : "Plans and credit packs"}</a> · <a href={localizedHref(lang, "/terms")}>{zh ? "服务条款" : "Terms of service"}</a> · <a href={localizedHref(lang, "/" + seedanceGuides[sibling].slug)}>{supportTitle(sibling, lang)}</a></p>
      </section>
      <div className={s.end}><h2>{zh ? "为下一条短片写下镜头" : "Write your next shot"}</h2>
        <a href={localizedHref(lang, "/text-to-video") + "?model=" + fallbackModel} className="du-primary">{zh ? "打开 1.5 Pro 工作台" : "Open the 1.5 Pro studio"}</a>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    </div>
  );
}
