import { getMarketModel } from "@/ai/kie-market";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { STUDIO_MODELS } from "@/lib/ai-video-studio";
import { HOME_TEMPLATES } from "@/lib/home-templates";
import { MAX_BYTES } from "@/lib/image-to-video";
import { LANDING_MODELS } from "@/lib/model-landing";
import { planCostRange } from "@/lib/pricing-offers";
import { PRICING_UNITS, type PricingUnit } from "@/lib/pricing-units";
import { maxVideoReferences } from "@/lib/video-references";

/**
 * The two feature pages under the generator: /text-to-video and
 * /image-to-video. Each answers one search ("text to video ai", "image to
 * video ai"): what it is, how to do it here, prompts that work, which models
 * and what they cost, and the usual questions. Numbers come from the pricing,
 * model and upload config, so the copy cannot promise what the site does not do.
 */

export type FeatureKind = "text-to-video" | "image-to-video" | "reference-to-video" | "audio";

export type FeatureModel = { name: string; spec: string; credits: number; cost: string; href?: string };

export type FeatureCopy = {
  /** <title> without the site suffix, and the meta description. */
  title: string;
  description: string;
  h1: string;
  intro: string[];
  stepsTitle: string;
  steps: { title: string; body: string }[];
  tipsTitle: string;
  tips: { title: string; body: string }[];
  examplesTitle: string;
  examplesIntro: string;
  examples: { title: string; prompt: string }[];
  useCasesTitle?: string;
  useCases?: { title: string; body: string }[];
  modelsTitle: string;
  modelsIntro: string;
  models: FeatureModel[];
  creditsLabel: string;
  /** Column heads for the models table: model, length and quality, credits, cost on a plan. */
  columns: [string, string, string, string];
  tryLabel: string;
  /** Example prompts link into the generator, filled in. */
  tryable?: boolean;
  faqTitle: string;
  faqs: { q: string; a: string }[];
  relatedTitle: string;
  related: { href: string; label: string }[];
};

const num = (value: number) => value.toLocaleString("en-US");

/** "A, B and C" / "A、B 和 C". */
function list(items: string[], zh: boolean, last = zh ? "和" : "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(zh ? "、" : ", ")}${zh ? last : ` ${last} `}${items[items.length - 1]}`;
}

function modelsFor(kind: FeatureKind, zh: boolean): FeatureModel[] {
  const fits = (unit: PricingUnit) => {
    if (unit.credits <= 0) return false;
    if (kind === "audio") return unit.kind === "audio";
    if (unit.kind !== "video") return false;
    if (kind === "image-to-video") return maxVideoReferences(unit.id) >= 1;
    if (kind === "reference-to-video") return maxVideoReferences(unit.id) >= 2;
    return !getMarketModel(unit.id)?.options.requiresImage;
  };
  return PRICING_UNITS.filter(fits)
    .sort((a, b) => a.credits - b.credits)
    .map((unit) => {
      const landing = LANDING_MODELS.find((model) => model.id === unit.id && model.live);
      return { name: unit.name, spec: zh ? unit.spec.zh : unit.spec.en, credits: unit.credits, cost: planCostRange(unit.credits), href: landing ? `/models/${landing.slug}` : undefined };
    });
}

/** Clip lengths the generator offers, across the models that can generate. */
function lengths(): { min: number; max: number; veo?: number[] } {
  const all = STUDIO_MODELS.filter((model) => model.available).flatMap((model) => model.durations);
  const veo = STUDIO_MODELS.find((model) => model.id === "veo-3.1")?.durations;
  return { min: Math.min(...all), max: Math.max(...all), veo };
}

function freeAnswer(zh: boolean, noun: string): string {
  const gift = NEW_USER_GIFT.enabled ? NEW_USER_GIFT.credits : 0;
  if (!gift) return zh ? `目前没有免费额度，需要订阅套餐或购买积分包。` : `There are no free credits at the moment; ${noun} needs a plan or a credit pack.`;
  const covered = PRICING_UNITS.filter((unit) => unit.kind === "video" && unit.credits > 0 && unit.credits <= gift).map((unit) =>
    zh ? `${unit.name}（${unit.spec.zh}，${unit.credits} 积分）` : `${unit.name} (${unit.spec.en}, ${unit.credits} credits)`,
  );
  const dearer = PRICING_UNITS.some((unit) => unit.kind === "video" && unit.credits > gift);
  return zh
    ? `新注册的账号送 ${gift} 积分，${NEW_USER_GIFT.validDays} 天内有效。${covered.length ? `够用 ${list(covered, true, "或")} 生成一条。` : ""}${dearer ? `单条超过 ${gift} 积分的模型，需要订阅套餐或购买积分包。` : ""}`
    : `New accounts get ${gift} free credits, valid for ${NEW_USER_GIFT.validDays} days.${covered.length ? ` That is enough for one clip on ${list(covered, false, "or")}.` : ""}${dearer ? ` Models that cost more than ${gift} credits a clip need a plan or a credit pack.` : ""}`;
}

function examples(ids: string[], zh: boolean): { title: string; prompt: string }[] {
  return ids
    .map((id) => HOME_TEMPLATES.find((template) => template.id === id))
    .filter((template): template is (typeof HOME_TEMPLATES)[number] => Boolean(template))
    .map((template) => ({ title: zh ? template.title.zh : template.title.en, prompt: zh ? template.prompt.zh : template.prompt.en }));
}

export function featureCopy(kind: FeatureKind, zh: boolean): FeatureCopy {
  const gift = NEW_USER_GIFT.enabled ? NEW_USER_GIFT.credits : 0;
  const veo = PRICING_UNITS.find((unit) => unit.id === "veo-3.1");
  const veoFits = Boolean(veo && gift >= veo.credits);
  const { min, max, veo: veoLengths } = lengths();
  const veoLength = veoLengths?.length === 1 ? veoLengths[0] : undefined;
  const maxMb = Math.round(MAX_BYTES / 1024 / 1024);
  const klingRefs = maxVideoReferences("kling/v4-reference-to-video");
  const models = modelsFor(kind, zh);
  const giftLine = gift
    ? zh
      ? `新注册的账号送 ${gift} 积分，${NEW_USER_GIFT.validDays} 天内有效${veoFits && veo ? `，够生成一条 ${veo.name} 视频（${veo.credits} 积分）` : ""}。`
      : `New accounts get ${gift} free credits for ${NEW_USER_GIFT.validDays} days${veoFits && veo ? `, enough for one ${veo.name} clip (${veo.credits} credits)` : ""}.`
    : "";

  const shared = {
    tryable: kind !== "audio",
    creditsLabel: kind === "audio" ? (zh ? "积分" : "credits") : zh ? "积分 / 条" : "credits a clip",
    columns: (zh
      ? ["模型", kind === "audio" ? "计价" : "时长和画质", "积分", "套餐内约合"]
      : ["Model", kind === "audio" ? "Charged" : "Length and quality", "Credits", "Cost on a plan"]) as [string, string, string, string],
    tryLabel: zh ? "用这条提示词生成" : "Use this prompt",
    relatedTitle: zh ? "继续了解" : "Keep exploring",
  };

  const commonFaqs = zh
    ? [
        {
          q: "生成的视频有声音吗？",
          a: "Veo 3.1 和 Seedance 2.5 可以把声音和画面一起生成：生成前在设置里打开声音，并在提示词里写清楚想听到什么，比如雨声、脚步声或一句台词。其他模型生成的是无声视频。",
        },
        { q: "生成的视频可以商用吗？", a: "付费套餐可以：成片没有水印，可以用在商业项目里。" },
        { q: "生成失败了怎么办？", a: "失败的那次所用的积分会自动退回到你的账号，不需要申请。" },
      ]
    : [
        {
          q: `Can ${kind === "text-to-video" ? "text" : kind === "reference-to-video" ? "reference" : "image"} to video AI add sound?`,
          a: "Yes, on Veo 3.1 and Seedance 2.5: turn sound on in the settings before you generate and say in the prompt what we should hear, such as rain on pavement, footsteps or a line of dialogue. The other models make silent clips.",
        },
        { q: "Can I use the videos commercially?", a: "Yes on paid plans: videos come without a watermark and can be used in commercial work." },
        { q: "What happens if a generation fails?", a: "The credits it used go back to your account automatically; there is nothing to claim." },
      ];

  if (kind === "reference-to-video") {
    return zh
      ? {
          ...shared,
          title: "AI 参考图生成视频：人物和风格保持一致",
          description: `上传 1 到 ${klingRefs} 张参考图，用 Kling 4.0 生成人物、商品和画风都保持一致的视频。生成前显示积分，失败自动退回。`,
          h1: "AI 参考图生成视频",
          intro: [
            "参考图生成视频，是把一张或几张参考图交给模型，让视频里的人物、商品或画风和参考图保持一致。只写文字的时候，同一个角色在不同视频里很容易“换了一张脸”；有了参考图，模型知道这个人长什么样、穿什么衣服、产品是什么形状，拍出来的每一条都更像同一个。",
            `页面上方就是生成工具，默认用 Kling 4.0：上传 1 到 ${klingRefs} 张参考图，写一句画面描述，选好时长和比例，生成按钮上会显示要花多少积分。${giftLine}`,
          ],
          stepsTitle: "怎么用参考图生成视频",
          steps: [
            { title: "上传参考图", body: `上传 1 到 ${klingRefs} 张图片：可以是同一个人物的正脸和侧脸，也可以是人物加一件商品，或者一张风格参考图。支持 PNG、JPG 和 WebP，每张最大 ${maxMb} MB。` },
            { title: "写清楚这一镜发生什么", body: "参考图负责“像不像”，提示词负责“做什么”：写人物在什么场景、做什么动作、镜头怎么动。可以在提示词里用 @图片1、@图片2 指明哪张图是谁。" },
            { title: "生成并下载", body: "选好时长、比例和画质后生成。视频在后台生成，完成后保存在“我的作品”里；生成失败会自动退回积分。" },
          ],
          tipsTitle: "让人物保持一致的方法",
          tips: [
            { title: "参考图要清楚、主体要大", body: "人物参考图最好是光线均匀、脸部清楚的半身或全身照，主体占画面大部分。背景越简单，模型越不容易把背景当成要保留的东西。" },
            { title: "多角度比多张同角度有用", body: "一张正脸、一张侧脸、一张全身，比三张差不多的正脸更能帮模型理解这个人。" },
            { title: "同一个角色用同一组参考图", body: "拍一个系列的时候，每一条都用同一组参考图和相同的人物描述，人物在不同镜头之间最稳定。" },
            { title: "参考图和提示词别打架", body: "如果参考图里人物穿红衣服，提示词里就别写蓝衣服。描述和参考图一致，结果最可控。" },
            { title: "先用 Flash 版试", body: "Kling 4.0 Flash 积分更少、出片更快，适合先试动作和镜头，满意了再用 Kling 4.0 出正式版本。" },
          ],
          useCasesTitle: "参考图生成视频适合做什么",
          useCases: [
            { title: "系列短剧和故事", body: "同一个主角出现在多条视频里，长相和服装保持一致，适合做连续的小故事。" },
            { title: "商品展示", body: "用商品照片做参考，让同一件商品出现在不同场景和镜头里。" },
            { title: "虚拟形象和品牌角色", body: "给品牌吉祥物、虚拟主播或游戏角色做一系列视频，形象不走样。" },
            { title: "统一画风", body: "用一张风格参考图，让一组视频保持同样的色调和质感。" },
          ],
          examplesTitle: "参考图生成视频的提示词示例",
          examplesIntro: "上传参考图后，可以参考这些提示词来写场景和镜头。",
          examples: examples(["rain-couple", "autumn-walk", "mountain-wind", "boy-and-dog"], true),
          modelsTitle: "支持多张参考图的模型",
          modelsIntro: `下面这些模型都可以同时使用多张参考图（最多 ${klingRefs} 张）。价格是一条视频的典型积分，实际以生成按钮上显示的为准。`,
          models,
          faqTitle: "AI 参考图生成视频常见问题",
          faqs: [
            { q: "参考图生成视频免费吗？", a: freeAnswer(true, "参考图生成视频") },
            { q: "最多可以上传几张参考图？", a: `Kling 4.0 和 Kling 4.0 Flash 最多 ${klingRefs} 张，支持 PNG、JPG 和 WebP，每张最大 ${maxMb} MB。` },
            { q: "参考图生成视频和图片生成视频有什么区别？", a: "图片生成视频是把一张图当作视频的第一帧，从这一帧开始动；参考图生成视频是让模型参考图里的人物、商品或画风，画面可以完全是新的场景。" },
            { q: "人物能保持多像？", a: "参考图越清楚、角度越全，人物越稳定。动作幅度很大或者镜头离得很远时，细节仍然可能有变化，建议先用 Flash 版试几条。" },
            ...commonFaqs,
          ],
          related: [
            { href: "/", label: "AI 视频生成器" },
            { href: "/image-to-video", label: "AI 图片生成视频" },
            { href: "/text-to-video", label: "AI 文字生成视频" },
            { href: "/pricing", label: "价格" },
          ],
        }
      : {
          ...shared,
          title: "Reference to Video AI: Consistent Characters",
          description: `Upload 1 to ${klingRefs} reference images and Kling 4.0 makes videos where the same person, product or style carries through. See the cost first.`,
          h1: "Reference to Video AI",
          intro: [
            "Reference to video AI gives the model one or more reference images, so the person, product or style in your video matches them. With a text prompt alone, the same character tends to get a new face in every clip; with references, the model knows what they look like, what they wear and what the product is shaped like, so every clip looks like part of the same set.",
            `The generator above is the whole tool and opens on Kling 4.0: upload 1 to ${klingRefs} reference images, write a line about the shot, set the length and ratio, and the button shows the credits it will cost. ${giftLine}`,
          ],
          stepsTitle: "How to make a video from reference images",
          steps: [
            { title: "Upload the references", body: `Add 1 to ${klingRefs} images: the same person from the front and the side, a person and a product, or one picture for the style. PNG, JPG and WebP, up to ${maxMb} MB each.` },
            { title: "Say what happens in the shot", body: "The references decide how things look; the prompt decides what they do. Describe the scene, the action and the camera, and name the images in the prompt as @Image1, @Image2 to say who is who." },
            { title: "Generate and download", body: "Set the length, ratio and quality, then generate. The clip renders in the background and is saved to My creations; if a generation fails, its credits come back automatically." },
          ],
          tipsTitle: "Tips for keeping a character consistent",
          tips: [
            { title: "Use clear references with a large subject", body: "For a person, an evenly lit half- or full-body photo with a clear face works best, with the subject filling most of the frame. The plainer the background, the less the model tries to keep it." },
            { title: "Different angles beat more of the same", body: "One front view, one profile and one full-body shot tell the model more about a person than three similar front views." },
            { title: "Keep one set of references per character", body: "For a series, use the same references and the same description of the character in every clip; that keeps them steadiest from shot to shot." },
            { title: "Don't let the prompt fight the references", body: "If the person wears red in the reference, don't ask for blue in the prompt. When the words and the images agree, the result is easiest to control." },
            { title: "Try it on Flash first", body: "Kling 4.0 Flash costs fewer credits and renders faster, so use it to test the motion and the camera, then make the final version on Kling 4.0." },
          ],
          useCasesTitle: "What people make with reference to video",
          useCases: [
            { title: "Series and short stories", body: "The same lead in clip after clip, with the same face and outfit, for a story told over several videos." },
            { title: "Product videos", body: "Use product photos as references and put the same product in different scenes and shots." },
            { title: "Mascots and virtual characters", body: "A run of videos for a brand mascot, a virtual presenter or a game character that stays on model." },
            { title: "A consistent look", body: "One style reference keeps a set of videos in the same colours and texture." },
          ],
          examplesTitle: "Reference to video prompt examples",
          examplesIntro: "With the references uploaded, prompts like these set the scene and the camera.",
          examples: examples(["rain-couple", "autumn-walk", "mountain-wind", "boy-and-dog"], false),
          modelsTitle: "Models that take several references",
          modelsIntro: `Each model below can use several reference images at once (up to ${klingRefs}). Prices are typical credits for one clip; the generate button shows the exact cost.`,
          models,
          faqTitle: "Reference to video AI FAQ",
          faqs: [
            { q: "Is reference to video AI free?", a: freeAnswer(false, "reference to video") },
            { q: "How many reference images can I use?", a: `Up to ${klingRefs} with Kling 4.0 and Kling 4.0 Flash, as PNG, JPG or WebP files of up to ${maxMb} MB each.` },
            { q: "How is it different from image to video?", a: "Image to video uses one image as the first frame and moves on from it. Reference to video uses the images as a guide to the person, product or style, so the scene itself can be completely new." },
            { q: "How closely will the character match?", a: "The clearer the references and the more angles they cover, the steadier the character. Big movements or a distant camera can still change details, so test a few clips on Flash first." },
            ...commonFaqs,
          ],
          related: [
            { href: "/", label: "AI video generator" },
            { href: "/image-to-video", label: "Image to video AI" },
            { href: "/text-to-video", label: "Text to video AI" },
            { href: "/pricing", label: "Pricing" },
          ],
        };
  }

  if (kind === "audio") {
    const tts = getMarketModel("elevenlabs-v3");
    const voices = tts?.options.voices?.length ?? 0;
    const maxScript = tts?.options.maxPromptLength ?? 5000;
    const audioFaqs = zh
      ? [
          { q: "支持中文配音吗？", a: "支持。Eleven Multilingual v2 和 Eleven v3 都能读中文、英文等多种语言，Gemini 3.8 Flash TTS 也能读多种语言。挑音色时先用一句中文试听。" },
          { q: "生成失败了怎么办？", a: "失败的那次所用的积分会自动退回到你的账号，不需要申请。" },
        ]
      : [
          { q: "Which languages can it speak?", a: "Eleven Multilingual v2 and Eleven v3 read many languages, including English, Spanish, Chinese and Japanese, and Gemini 3.8 Flash TTS is multilingual too. Audition a voice on a line in your language first." },
          { q: "What happens if a generation fails?", a: "The credits it used go back to your account automatically; there is nothing to claim." },
        ];
    return zh
      ? {
          ...shared,
          title: "AI 文字转语音：配音、音乐和音效生成",
          description: "把一段文字变成自然的配音，或者用一句话生成歌曲和音效。ElevenLabs、Gemini、Suno 等模型一站可用，生成前显示积分。",
          h1: "AI 文字转语音",
          intro: [
            "AI 文字转语音，就是把一段文字变成听起来像真人的配音：选一个音色，贴上脚本，几秒钟后就能拿到可以下载的音频。在 aivd.ai，除了配音，你还可以用一句话描述生成一首歌或一段音效，给你的视频配上声音。",
            `页面上方就是生成工具：选择配音、音乐或音效，选模型和音色，写下脚本或描述，生成按钮上会显示要花多少积分。${gift ? `新注册的账号送 ${gift} 积分，${NEW_USER_GIFT.validDays} 天内有效。` : ""}`,
          ],
          stepsTitle: "怎么用 AI 把文字变成语音",
          steps: [
            { title: "选模型和音色", body: `ElevenLabs v3 表现力最强，Turbo 2.5 更快更省，Multilingual v2 适合多语言，Gemini 3.8 Flash TTS 也有自己的一组音色。ElevenLabs 提供 ${voices} 个预设音色可以直接选。` },
            { title: "贴上脚本", body: `把要读的文字贴进去，单次最多 ${num(maxScript)} 个字符。可以再用一句话描述想要的语气，比如“温暖、放慢一点、像深夜纪录片的旁白”。` },
            { title: "生成并下载", body: "生成在后台进行，完成后保存在“我的作品”里，可以试听和下载。生成失败会自动退回积分。" },
          ],
          tipsTitle: "让配音更自然的方法",
          tips: [
            { title: "用标点控制停顿", body: "逗号是短停顿，句号是长停顿，省略号会拖一下。想让某处停一下，加一个标点比加描述更直接。" },
            { title: "数字和缩写写成要读的样子", body: "“2026”可能被读成“二零二六”或“两千零二十六”，按你想听到的写出来，结果更可控。" },
            { title: "一段只要一种情绪", body: "长脚本分段生成，每段描述一种语气，比一次读完更容易控制情绪变化。" },
            { title: "先用短句试音色", body: "挑音色时先用一两句话试，满意了再贴完整脚本，省积分也省时间。" },
            { title: "音乐写风格和情绪", body: "用 Suno 生成音乐时，写清楚风格、情绪、乐器和用途，比如“轻快的钢琴和吉他，适合旅行 vlog 的片头”。" },
          ],
          useCasesTitle: "AI 配音和音乐可以用来做什么",
          useCases: [
            { title: "视频配音和旁白", body: "给短视频、讲解视频和纪录片风格的内容配上旁白。" },
            { title: "广告和产品介绍", body: "为产品视频、广告和落地页生成清楚、有感染力的配音。" },
            { title: "背景音乐", body: "用一句话描述生成一首适合视频的背景音乐。" },
            { title: "音效", body: "生成脚步声、雨声、转场“嗖”声这类音效，补齐视频里的声音细节。" },
          ],
          examplesTitle: "配音和音乐的描述示例",
          examplesIntro: "可以直接参考这些写法来描述音色和音乐。",
          examples: [
            { title: "纪录片旁白", prompt: "温暖、沉稳的男声，语速不急，带一点沙哑，像深夜自然纪录片的旁白。" },
            { title: "产品介绍", prompt: "清楚、自信的女声，语速中等，语气友好但专业，适合一分钟的产品介绍视频。" },
            { title: "旅行 vlog 背景音乐", prompt: "轻快的原声吉他和钢琴，明亮温暖，节奏适中，适合旅行 vlog 的开场。" },
            { title: "转场音效", prompt: "短促的“嗖”一声风声，从左到右划过，适合视频转场。" },
          ],
          modelsTitle: "可以用的音频模型",
          modelsIntro: "配音按字数计积分，音乐按首计积分。下面是典型价格，实际以生成按钮上显示的为准。",
          models,
          faqTitle: "AI 文字转语音常见问题",
          faqs: [
            { q: "AI 文字转语音免费吗？", a: gift ? `新注册的账号送 ${gift} 积分，${NEW_USER_GIFT.validDays} 天内有效，可以用来生成配音、音乐和音效；用完后需要订阅套餐或购买积分包。` : "目前没有免费额度，需要订阅套餐或购买积分包。" },
            { q: "一次最多能转多少字？", a: `单次最多 ${num(maxScript)} 个字符。更长的脚本可以分段生成，再在剪辑软件里接起来。` },
            { q: "有哪些音色可以选？", a: `ElevenLabs 提供 ${voices} 个预设音色，Gemini 3.8 Flash TTS 也有自己的一组音色。还可以用一句话描述想要的语气和风格。` },
            { q: "可以生成音乐吗？", a: "可以。用 Suno V6 写一句话描述风格和情绪，就能生成一首歌；Suno Sounds 可以生成音效。" },
            ...audioFaqs,
          ],
          related: [
            { href: "/", label: "AI 视频生成器" },
            { href: "/text-to-video", label: "AI 文字生成视频" },
            { href: "/image-to-video", label: "AI 图片生成视频" },
            { href: "/pricing", label: "价格" },
          ],
        }
      : {
          ...shared,
          title: "AI Text to Speech: Voiceover, Music and Sound",
          description: "Turn a script into a natural voiceover, or make a song or a sound effect from one line. ElevenLabs, Gemini and Suno in one place, with the cost shown first.",
          h1: "AI Text to Speech",
          intro: [
            "AI text to speech turns written words into a voice that sounds like a person: pick a voice, paste the script, and a few seconds later you have audio to download. On aivd.ai you can also describe a song or a sound effect in one line and generate it, so your videos get their sound in the same place.",
            `The generator above is the whole tool: choose voice, music or sound effects, pick the model and the voice, write the script or the description, and the button shows the credits it will cost.${gift ? ` New accounts get ${gift} free credits for ${NEW_USER_GIFT.validDays} days.` : ""}`,
          ],
          stepsTitle: "How to turn text into speech with AI",
          steps: [
            { title: "Pick a model and a voice", body: `Eleven v3 is the most expressive, Turbo 2.5 is faster and cheaper, Multilingual v2 suits other languages, and Gemini 3.8 Flash TTS brings its own set of voices. ElevenLabs offers ${voices} ready-made voices to choose from.` },
            { title: "Paste the script", body: `Paste the text to be read, up to ${num(maxScript)} characters at a time, and add a line about the delivery if you like, such as “warm, a little slower, like a late-night documentary narrator”.` },
            { title: "Generate and download", body: "The audio renders in the background and is saved to My creations, where you can play and download it. If a generation fails, its credits come back automatically." },
          ],
          tipsTitle: "Tips for a natural voiceover",
          tips: [
            { title: "Use punctuation for pauses", body: "A comma is a short pause, a full stop a longer one, an ellipsis a drawn-out beat. A punctuation mark is the most direct way to get a pause where you want it." },
            { title: "Write numbers and acronyms as they are said", body: "“2026” can come out as “twenty twenty-six” or “two thousand twenty-six”. Spell it the way you want it heard." },
            { title: "One mood per passage", body: "Split a long script and give each part its own delivery note; that controls changes of mood better than one long read." },
            { title: "Audition voices on a short line", body: "Try a voice on a sentence or two before pasting the whole script. It saves credits and time." },
            { title: "Describe music by style and use", body: "For Suno, name the style, mood, instruments and what it is for, such as “light piano and acoustic guitar for a travel vlog intro”." },
          ],
          useCasesTitle: "What people make with AI voice and music",
          useCases: [
            { title: "Voiceover and narration", body: "Narration for short videos, explainers and documentary-style content." },
            { title: "Ads and product videos", body: "Clear, persuasive voiceovers for product videos, ads and landing pages." },
            { title: "Background music", body: "A track that fits the video, from a one-line description." },
            { title: "Sound effects", body: "Footsteps, rain, a whoosh for a transition: the small sounds that finish a video." },
          ],
          examplesTitle: "Voice and music prompt examples",
          examplesIntro: "Use these as a starting point for describing a voice or a track.",
          examples: [
            { title: "Documentary narrator", prompt: "Warm, calm male voice, unhurried pace, a little gravel, like a late-night nature documentary narrator." },
            { title: "Product explainer", prompt: "Clear, confident female voice at a medium pace, friendly but professional, for a one-minute product video." },
            { title: "Travel vlog music", prompt: "Light acoustic guitar and piano, bright and warm, mid tempo, for the opening of a travel vlog." },
            { title: "Transition whoosh", prompt: "A short whoosh of wind sweeping from left to right, for a video transition." },
          ],
          modelsTitle: "Audio models you can use",
          modelsIntro: "Voice is charged by length and music by the song. These are typical prices; the generate button shows the exact cost.",
          models,
          faqTitle: "AI text to speech FAQ",
          faqs: [
            { q: "Is AI text to speech free?", a: gift ? `New accounts get ${gift} free credits, valid for ${NEW_USER_GIFT.validDays} days, for voice, music and sound effects. After that, a plan or a credit pack.` : "There are no free credits at the moment; voice and music need a plan or a credit pack." },
            { q: "How much text can I convert at once?", a: `Up to ${num(maxScript)} characters per generation. For a longer script, generate it in parts and join them in your editor.` },
            { q: "Which voices can I choose?", a: `ElevenLabs offers ${voices} ready-made voices and Gemini 3.8 Flash TTS has its own set. You can also describe the tone and style you want in a line.` },
            { q: "Can it make music too?", a: "Yes. Describe the style and mood in a line and Suno V6 writes a song; Suno Sounds makes sound effects." },
            ...audioFaqs,
          ],
          related: [
            { href: "/", label: "AI video generator" },
            { href: "/text-to-video", label: "Text to video AI" },
            { href: "/image-to-video", label: "Image to video AI" },
            { href: "/pricing", label: "Pricing" },
          ],
        };
  }

  if (kind === "text-to-video") {
    return zh
      ? {
          ...shared,
          title: "AI 文字生成视频：一句话生成带声音的视频",
          description: "输入一句画面描述，用 Veo 3.1、Seedance 2.5、Kling 4.0 等模型生成视频，可以带声音。选好时长和比例，生成前就能看到要花多少积分。",
          h1: "AI 文字生成视频",
          intro: [
            "文字生成视频，就是把一段文字描述变成一条视频：你写下画面里有谁、发生了什么、镜头怎么动、光线是什么样，AI 模型按描述生成一段可以直接下载的短片。在 aivd.ai，你可以在 Veo 3.1、Seedance 2.5、Kling 4.0 等模型之间切换，其中 Veo 3.1 和 Seedance 2.5 还能同时生成和画面匹配的声音。",
            `页面上方就是生成工具：写好提示词，设置时长、画面比例、画质和声音，生成按钮上会显示这条视频要花多少积分。${giftLine}`,
          ],
          stepsTitle: "怎么用文字生成视频",
          steps: [
            { title: "写下画面", body: "用一两句话写清楚：画面里是谁或什么、正在发生什么、镜头怎么运动、光线和氛围如何。具体的描述比一串形容词有用，比如“镜头缓慢推近雨夜路灯下的男孩和小狗”，比“唯美、高级、电影感”能告诉模型更多。" },
            { title: "选模型和设置", body: `想要电影感和声音选 Veo 3.1，想要动作丰富、时长更长选 Seedance 2.5，需要人物和参考图保持一致选 Kling 4.0，想便宜地先试几版选 Grok Imagine。然后选时长（${min} 到 ${max} 秒，看模型）、画面比例（横屏 16:9 适合 YouTube，竖屏 9:16 适合抖音和视频号，1:1 适合社交帖子）和画质。` },
            { title: "生成并下载", body: "视频在后台生成，你可以离开页面，完成后会保存在“我的作品”里，随时下载。如果生成失败，这次用掉的积分会自动退回。" },
          ],
          tipsTitle: "写好提示词的几个方法",
          tips: [
            { title: "先写主体和动作", body: "第一句交代谁在做什么，模型最先抓住的就是这部分。“一个女孩在海边奔跑”比“夕阳、海浪、自由的感觉”更容易出效果。" },
            { title: "写出镜头怎么动", body: "推近、拉远、环绕、跟拍、手持晃动，这些镜头词会直接改变视频的节奏和情绪。一条视频只写一种主要的镜头运动。" },
            { title: "交代光线和色调", body: "黄金时段的逆光、霓虹灯下的雨夜、阴天的冷色调，光线决定了画面质感，也让同一场景拍出完全不同的情绪。" },
            { title: "一条提示词只写一个镜头", body: "一个场景、一段连续的动作最稳定。想拍一个小故事，就按镜头一条条生成，再用参考图让人物保持一致。" },
            { title: "把声音写进提示词", body: "用 Veo 3.1 或 Seedance 2.5 并打开声音时，写清楚想听到什么：远处的雷声、咖啡馆里的人声、角色说的一句话。" },
          ],
          examplesTitle: "文字生成视频的提示词示例",
          examplesIntro: "下面这些提示词可以直接放进生成工具里改着用。",
          examples: examples(["boy-and-dog", "autumn-walk", "rain-couple", "mountain-wind"], true),
          modelsTitle: "可以用来文字生成视频的模型",
          modelsIntro: `每个模型在画质、动作、时长和价格上各有长处。下面是一条视频的典型价格，实际积分以生成按钮上显示的为准，会随时长和画质变化。${veoLength ? `Veo 3.1 每条 ${veoLength} 秒。` : ""}`,
          models,
          faqTitle: "AI 文字生成视频常见问题",
          faqs: [
            { q: "AI 文字生成视频免费吗？", a: freeAnswer(true, "文字生成视频") },
            { q: "文字生成的视频最长多少秒？", a: `${min} 到 ${max} 秒，取决于模型${veoLength ? `：Veo 3.1 每条 ${veoLength} 秒，Seedance 2.5、Kling 4.0、Wan 2.6 最长可到 ${max} 秒` : ""}。想要更长的内容，可以分镜头生成后再剪到一起。` },
            { q: "可以生成竖屏视频吗？", a: "可以。大多数模型支持 16:9 横屏、9:16 竖屏和 1:1 方形，部分模型还支持 4:3、3:4 和 21:9，在生成工具的比例选项里可以看到当前模型支持哪些。" },
            ...commonFaqs,
          ],
          related: [
            { href: "/", label: "AI 视频生成器" },
            { href: "/image-to-video", label: "AI 图片生成视频" },
            { href: "/templates", label: "视频模板" },
            { href: "/pricing", label: "价格" },
          ],
        }
      : {
          ...shared,
          title: "Text to Video AI Generator with Sound",
          description: "Type a prompt and get a video clip, with sound on Veo 3.1 and Seedance 2.5. Pick the model, length and ratio, and see the credit cost before you generate.",
          h1: "Text to Video AI",
          intro: [
            "Text to video AI turns a written description into a video clip. You write what should be on screen — who or what is there, what happens, how the camera moves and what the light is like — and the model renders a short clip you can download. On aivd.ai you can switch between Veo 3.1, Seedance 2.5, Kling 4.0 and other models, and Veo 3.1 and Seedance 2.5 can generate sound that matches the picture.",
            `The generator above is the whole tool: write the prompt, set the length, ratio, quality and sound, and the button shows how many credits the clip will cost before you start. ${giftLine}`,
          ],
          stepsTitle: "How to turn text into a video",
          steps: [
            { title: "Describe the shot", body: "Write one or two sentences: who or what is on screen, what happens, how the camera moves and what the light is like. Specific beats long. “Slow push-in on a boy and his dog under a streetlight on a rainy night” tells the model far more than a list of adjectives like “cinematic, beautiful, epic”." },
            { title: "Pick a model and the settings", body: `Choose Veo 3.1 for cinematic clips with sound, Seedance 2.5 for rich motion and longer clips, Kling 4.0 when a character has to match reference images, and Grok Imagine for quick, low-cost drafts. Then set the length (${min} to ${max} seconds, depending on the model), the ratio (16:9 for YouTube, 9:16 for TikTok, Reels and Shorts, 1:1 for feed posts) and the quality.` },
            { title: "Generate and download", body: "The clip renders in the background, so you can leave the page. It is saved to My creations, where you can play and download it. If a generation fails, the credits it used go straight back to your account." },
          ],
          tipsTitle: "Prompt tips that work",
          tips: [
            { title: "Lead with the subject and the action", body: "The first sentence should say who is doing what; that is what the model locks onto first. “A girl runs along the beach” works better than “sunset, waves, a feeling of freedom”." },
            { title: "Name the camera move", body: "Push-in, pull-back, orbit, follow shot, handheld: camera words change the pace and the mood of a clip more than anything else. Use one main move per clip." },
            { title: "Set the light and the colour", body: "Golden-hour backlight, a neon-lit rainy street, a cool overcast morning. Light decides how a frame feels, and the same scene can tell a different story under different light." },
            { title: "Keep one shot per prompt", body: "One scene and one continuous action give the most stable results. To tell a story, generate it shot by shot, and use reference images to keep the characters the same." },
            { title: "Ask for the sound in words", body: "With Veo 3.1 or Seedance 2.5 and sound on, say what we should hear: thunder in the distance, a busy café, a line a character speaks." },
          ],
          examplesTitle: "Text to video prompt examples",
          examplesIntro: "Drop any of these into the generator and change the details to fit your idea.",
          examples: examples(["boy-and-dog", "autumn-walk", "rain-couple", "mountain-wind"], false),
          modelsTitle: "Models for text to video",
          modelsIntro: `Each model has its own strengths in look, motion, length and price. These are typical prices for one clip; the generate button shows the exact cost, which changes with the length and the quality.${veoLength ? ` Veo 3.1 makes ${veoLength}-second clips.` : ""}`,
          models,
          faqTitle: "Text to video AI FAQ",
          faqs: [
            { q: "Is text to video AI free?", a: freeAnswer(false, "text to video") },
            { q: "How long can a text to video clip be?", a: `Between ${min} and ${max} seconds, depending on the model${veoLength ? `: Veo 3.1 makes ${veoLength}-second clips, while Seedance 2.5, Kling 4.0 and Wan 2.6 go up to ${max} seconds` : ""}. For something longer, generate it shot by shot and cut the clips together.` },
            { q: "Can I make vertical videos?", a: "Yes. Most models offer 16:9 landscape, 9:16 vertical and 1:1 square, and some add 4:3, 3:4 or 21:9. The ratio menu in the generator shows what the current model supports." },
            ...commonFaqs,
          ],
          related: [
            { href: "/", label: "AI video generator" },
            { href: "/image-to-video", label: "Image to video AI" },
            { href: "/templates", label: "Video templates" },
            { href: "/pricing", label: "Pricing" },
          ],
        };
  }

  return zh
    ? {
        ...shared,
        title: "AI 图片生成视频：让照片动起来",
        description: `上传一张照片，描述它该怎么动，Veo 3.1、Seedance 2.5、Kling 4.0 等模型会把它变成一段视频。支持 PNG、JPG、WebP，生成前显示积分。`,
        h1: "AI 图片生成视频",
        intro: [
          "图片生成视频，就是让一张静态图片动起来：你上传一张照片或插画作为第一帧，再描述它该怎么动，模型会从这一帧开始把画面延续下去。和只用文字相比，它能留住你图片里的样子——人物的脸、颜色、构图——这些都很难只靠文字描述清楚。",
          `页面上方就是生成工具：上传图片（PNG、JPG 或 WebP，最大 ${maxMb} MB），写一句动作描述，选好模型、时长和比例，生成按钮上会显示要花多少积分。${giftLine}`,
        ],
        stepsTitle: "怎么把照片变成视频",
        steps: [
          { title: "上传图片", body: `点“上传起始帧”选一张图片（也可以直接拖进来或粘贴），支持 PNG、JPG 和 WebP，最大 ${maxMb} MB。这张图会成为视频的第一帧。画面比例尽量选得和图片接近，避免被裁掉重要部分。` },
          { title: "描述它怎么动", body: "写清楚什么在动、怎么动：头发被风吹起、人物慢慢露出笑容、镜头缓缓拉远。图片里已经有的东西不用再描述一遍，把字留给动作和镜头。" },
          { title: "生成并下载", body: "选好模型、时长和声音后点生成。视频在后台生成，完成后保存在“我的作品”里，随时下载；生成失败会自动退回积分。" },
        ],
        tipsTitle: "让图片生成视频效果更好的方法",
        tips: [
          { title: "用清晰、光线好的图", body: "模糊、太暗或压缩严重的图片，动起来以后瑕疵会被放大。主体清楚、光线均匀的照片效果最稳定。" },
          { title: "主体别贴着画面边缘", body: "如果人物或产品紧贴边缘，镜头一动就容易被切掉。主体在画面中间、周围留一点空间更好。" },
          { title: "写动作，不写外观", body: "外观已经在图片里了。提示词里写“缓缓转头看向镜头、风吹动裙摆”，比重复描述衣服颜色和发型有用得多。" },
          { title: "小幅度的动作更自然", body: "眨眼、微笑、轻微的镜头推进，看起来最真实。动作越大，模型需要“编”的部分越多，人脸和细节越容易变形。" },
          { title: "多张图保持同一个人物", body: `需要同一个角色出现在多条视频里时，用 Kling 4.0 加参考图（最多 ${klingRefs} 张），人物在不同镜头里会更一致。` },
        ],
        useCasesTitle: "图片生成视频可以用来做什么",
        useCases: [
          { title: "让老照片动起来", body: "给家里的老照片加上眨眼、微笑或轻微的镜头移动，做成一段可以分享的小视频。" },
          { title: "产品展示", body: "让产品图转动、反光或在场景里出现，做成电商和社交媒体用的短视频素材。" },
          { title: "人像和角色", body: "把人像照片、头像或游戏角色变成一段有表情和动作的短片。" },
          { title: "插画和艺术作品", body: "给插画、海报和概念图加上风、光影和镜头运动，让画面活起来。" },
        ],
        examplesTitle: "图片生成视频的动作描述示例",
        examplesIntro: "上传图片后，可以参考这些提示词来描述镜头和动作。",
        examples: examples(["boy-and-dog", "rain-couple", "mountain-wind", "autumn-walk"], true),
        modelsTitle: "可以从图片开始生成视频的模型",
        modelsIntro: "下面这些模型都可以用一张图片作为起始帧。价格是一条视频的典型积分，实际以生成按钮上显示的为准。",
        models,
        faqTitle: "AI 图片生成视频常见问题",
        faqs: [
          { q: "AI 图片生成视频免费吗？", a: freeAnswer(true, "图片生成视频") },
          { q: "支持上传哪些图片格式？", a: `支持 PNG、JPG 和 WebP，单张最大 ${maxMb} MB。分辨率越高、画面越清楚，生成的视频细节越好。` },
          { q: "视频能保留照片里的人脸和细节吗？", a: "视频从你的图片开始，所以开头几帧会保留照片里的样子。动作幅度越大，越往后变化越多；想让人脸保持得更像，动作写得小一些、镜头运动慢一些。" },
          { q: "可以用多张图片吗？", a: `可以。Kling 4.0 支持最多 ${klingRefs} 张参考图，用来让同一个人物或物体在视频里保持一致；其他模型用一张图作为起始帧。` },
          ...commonFaqs,
        ],
        related: [
          { href: "/", label: "AI 视频生成器" },
          { href: "/text-to-video", label: "AI 文字生成视频" },
          { href: "/templates", label: "视频模板" },
          { href: "/pricing", label: "价格" },
        ],
      }
    : {
        ...shared,
        title: "Image to Video AI: Turn Photos into Videos",
        description: "Upload a photo and describe how it should move. Veo 3.1, Seedance 2.5, Kling 4.0 and more turn it into a clip, and the credit cost shows before you start.",
        h1: "Image to Video AI",
        intro: [
          "Image to video AI animates a still picture. You upload a photo or an illustration as the first frame, describe how it should move, and the model carries the scene on from there. Unlike a text prompt alone, it keeps the look of your image — the faces, the colours, the composition — which words can hardly pin down.",
          `The generator above is the whole tool: upload the image (PNG, JPG or WebP, up to ${maxMb} MB), write a line about the motion, pick the model, length and ratio, and the button shows the credits the clip will cost. ${giftLine}`,
        ],
        stepsTitle: "How to turn a photo into a video",
        steps: [
          { title: "Upload the image", body: `Click “Upload a start frame” (or drop or paste the image there) and add a PNG, JPG or WebP up to ${maxMb} MB. The image becomes the first frame of the video. Pick a ratio close to the image's so nothing important gets cropped.` },
          { title: "Describe the motion", body: "Say what moves and how: hair lifting in the wind, a slow smile, the camera pulling back. There is no need to describe what is already in the picture; spend the words on movement and the camera." },
          { title: "Generate and download", body: "Choose the model, the length and the sound, then generate. The clip renders in the background and is saved to My creations, ready to download. If a generation fails, its credits come back automatically." },
        ],
        tipsTitle: "Tips for better image to video results",
        tips: [
          { title: "Start from a sharp, well-lit image", body: "Blur, darkness and heavy compression get worse once the picture moves. A clear subject in even light gives the steadiest results." },
          { title: "Keep the subject away from the edges", body: "A person or product pressed against the frame gets cut off as soon as the camera moves. Leave some room around the subject." },
          { title: "Describe motion, not appearance", body: "The look is already in the image. “Slowly turns to look at the camera as the wind moves her dress” does more than repeating the colour of the clothes or the hairstyle." },
          { title: "Small moves look most natural", body: "A blink, a smile, a gentle push-in look the most real. The bigger the motion, the more the model has to invent, and the more faces and details can drift." },
          { title: "Use reference images for a recurring character", body: `When the same character has to appear in several clips, use Kling 4.0 with reference images (up to ${klingRefs}) so they stay consistent from shot to shot.` },
        ],
        useCasesTitle: "What people make with image to video",
        useCases: [
          { title: "Old photos that move", body: "Add a blink, a smile or a slow camera move to a family photo and share it as a short clip." },
          { title: "Product shots", body: "Make a product turn, catch the light or appear in a scene, for shop listings and social posts." },
          { title: "Portraits and characters", body: "Turn a portrait, an avatar or a game character into a short clip with expression and motion." },
          { title: "Illustrations and artwork", body: "Give an illustration, a poster or concept art wind, light and camera movement." },
        ],
        examplesTitle: "Image to video motion prompt examples",
        examplesIntro: "Once the image is in, prompts like these describe the camera and the movement.",
        examples: examples(["boy-and-dog", "rain-couple", "mountain-wind", "autumn-walk"], false),
        modelsTitle: "Models that start from a photo",
        modelsIntro: "Every model below can take an image as the first frame. Prices are typical credits for one clip; the generate button shows the exact cost.",
        models,
        faqTitle: "Image to video AI FAQ",
        faqs: [
          { q: "Is image to video AI free?", a: freeAnswer(false, "image to video") },
          { q: "Which image formats can I upload?", a: `PNG, JPG and WebP, up to ${maxMb} MB each. The sharper and higher-resolution the image, the better the detail in the video.` },
          { q: "Will the video keep the faces and details in my photo?", a: "The video starts from your image, so the first frames keep its look. The bigger the motion, the more it changes later in the clip; for a likeness that holds, keep the movement small and the camera slow." },
          { q: "Can I use more than one image?", a: `Yes. Kling 4.0 takes up to ${klingRefs} reference images to keep the same person or object consistent; the other models use one image as the start frame.` },
          ...commonFaqs,
        ],
        related: [
          { href: "/", label: "AI video generator" },
          { href: "/text-to-video", label: "Text to video AI" },
          { href: "/templates", label: "Video templates" },
          { href: "/pricing", label: "Pricing" },
        ],
      };
}
