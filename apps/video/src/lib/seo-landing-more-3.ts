/**
 * Third batch of SEO landing copy for the video app.
 *
 *  - /animate-image-ai                 (new route)
 *  - /ai-video-ad-generator            (new route)
 *  - /ai-product-video-generator       (new route)
 *  - /ai-cinematic-video-generator     (new route)
 *  - /ai-b-roll-generator              (new route)
 *
 * Copy rules: original English + Chinese, real capabilities only (the enabled
 * models are Seedance 1.5 Pro, Seedance 1.0 Pro Fast and Seedance 1.0 Pro
 * Quality), no invented metrics, no prices, no promise of free generation and
 * no third-party platform claims. Entry points only link to the existing
 * generator.
 */

import type { SeoLandingContent } from "./seo-landing";

/* ------------------------------------------------------------------ */
/* 1. Animate an image                                                 */
/* ------------------------------------------------------------------ */

const EN_ANIMATE_IMAGE_AI: SeoLandingContent = {
  path: "/animate-image-ai",
  title: "Make Your Photo Move — Bring Old Photos to Life",
  description:
    "Bring old family photos, portraits and illustrations to life with subtle motion — a smile, a blink, hair in the wind or a slow camera push.",
  h1: "Make Your Photo Move",
  heroSub:
    "Start from a single photograph and describe the small movements that make it feel alive.",
  promptPlaceholder: "Describe how the photo should move…",
  ctaLabel: "Open the generator",
  whatTitle: "What does it mean to make a photo move?",
  whatBody: [
    "Making a photo move keeps the picture you already have and adds movement inside it. The framing, the subject and the light stay as they were — only the motion is new.",
    "That suits old family photos, portraits and illustrations where you want a gentle change: a smile forming, a blink, hair lifted by the wind, a slow camera push. The picture stays recognisable instead of turning into another scene.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Pick the photo",
      body: "Choose one clear picture — an old family photo, a portrait or a finished illustration. A readable subject gives the motion something to hold on to.",
    },
    {
      title: "Describe the small movements",
      body: "Name the change you want: a smile, a blink, hair in the wind, a slow push in. Gentle wording usually reads better than large movements.",
    },
    {
      title: "Generate and refine",
      body: "Open the generator, run the prompt, then adjust the wording until the motion sits naturally inside the photograph.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Gentle, believable motion for old photos, portraits and illustrations",
      input: "Photo, text",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Straightforward motion from a single photo",
      input: "Photo, text",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 look for a photo",
      input: "Photo, text",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Which photos can I make move?",
      a: "Old family photos, portraits, illustrations and other stills with a readable subject and a simple background.",
    },
    {
      q: "How much motion should I ask for?",
      a: "Subtle motion is usually the most believable, and small movements keep the original picture recognisable.",
    },
    {
      q: "Will it restore or colorize my old photo?",
      a: "No. It adds motion to the photo exactly as it is — the original picture, its tone and its character stay as they were.",
    },
    {
      q: "What is the difference from the Image to Video tool?",
      a: "This page is about bringing a single photo to life with gentle motion, such as a smile or a slow push in. The Image to Video tool is the general workflow for turning any image into a clip.",
    },
    {
      q: "Can I choose the shape of the clip?",
      a: "Yes. Vertical, widescreen and square ratios are available, and you pick one in the generator.",
    },
  ],
  related: [
    {
      label: "Need the general Image to Video tool? Open Image to Video",
      path: "/image-to-video",
    },
  ],
};

const ZH_ANIMATE_IMAGE_AI: SeoLandingContent = {
  path: "/animate-image-ai",
  title: "让照片动起来 — 让老照片、人像和插画活过来",
  description:
    "让老照片、家人合影、人像和插画获得细微的运动——一个微笑、一次眨眼、风吹动头发，或者镜头缓慢推近。",
  h1: "让照片动起来",
  heroSub: "从一张照片出发，描述让它活起来的细微动作。",
  promptPlaceholder: "描述这张照片应该如何运动…",
  ctaLabel: "打开生成器",
  whatTitle: "让照片动起来是什么意思？",
  whatBody: [
    "让照片动起来，是在保留原有画面的基础上加入运动。构图、主体和光线保持原样，只有运动是新的。",
    "这适合老照片、人像和插画：你想要的是微笑浮现、眨眼、头发被风吹动、镜头缓慢推近这样的细微变化，让照片保持可辨识，而不是变成另一个场景。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "挑选照片",
      body: "选择一张主体清晰的照片：老照片、人像或完成的插画。主体越明确，运动越有依托。",
    },
    {
      title: "描述细微的运动",
      body: "写出你想要的变化：微笑、眨眼、头发被风吹动、缓慢推近。细微的措辞通常比大幅运动更自然。",
    },
    {
      title: "生成并微调",
      body: "打开生成器运行提示词，再调整措辞，直到运动自然地融入照片。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "老照片、人像与插画的细微自然运动",
      input: "照片、文字",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "从单张照片出发的简洁运动",
      input: "照片、文字",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 系列中细节最丰富的照片效果",
      input: "照片、文字",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "可以给哪些照片加上运动？",
      a: "老照片、人像、插画等主体清晰、背景简洁的静态画面都可以。",
    },
    {
      q: "运动幅度应该写多大？",
      a: "细微运动通常最自然，小幅度变化也能让照片保持可辨识。",
    },
    {
      q: "会修复或上色我的老照片吗？",
      a: "不会。这里做的是在照片原样基础上加入运动，原有画面、色调和质感都保持不变。",
    },
    {
      q: "和「图片生成视频」工具有什么区别？",
      a: "这一页关注的是让单张照片以细微运动活起来，比如一个微笑或缓慢推近；「图片生成视频」工具则是把任意图片转成视频片段的通用流程。",
    },
    {
      q: "可以自己选择画面比例吗？",
      a: "可以。生成器里提供竖版、宽银幕和方形等比例，可以自行选择。",
    },
  ],
  related: [
    {
      label: "需要通用的图片生成视频工具？前往「图片生成视频」",
      path: "/image-to-video",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 2. Ad clips                                                         */
/* ------------------------------------------------------------------ */

const EN_AI_VIDEO_AD: SeoLandingContent = {
  path: "/ai-video-ad-generator",
  title: "AI Video Ad Generator — Draft Ad Clips",
  description:
    "Draft short ad clips from text or a product image in 16:9, 9:16 and 1:1. See how it works, then open the generator to create your clip.",
  h1: "AI Video Ad Generator",
  heroSub:
    "Write an ad idea or upload a product image, then open the generator to draft the clip.",
  promptPlaceholder: "Describe the ad clip you want to draft…",
  ctaLabel: "Open the generator",
  whatTitle: "What can an AI video ad generator do?",
  whatBody: [
    "It drafts the clip itself: a product turning in the light, a scene that sets a mood, a visual idea you can judge before committing to a shoot. You can work from text alone or from a product image.",
    "You also choose the placement shape in the generator — widescreen, vertical or square. The generator produces the footage; editing, logos and text overlays are added afterwards in your editing tool.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Write the idea",
      body: "Describe the product, the setting and the mood in a sentence or two, or start from a product image you already have.",
    },
    {
      title: "Choose the placement shape",
      body: "Pick the aspect ratio that matches where the clip will run: 16:9, 9:16 or 1:1.",
    },
    {
      title: "Generate and review",
      body: "Open the generator, run the prompt, then change the wording or the image until the clip matches the idea.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively ad concepts; can generate audio",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Simple product or scene clips from text or an image",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Detailed product and setting shots",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Does it add my logo or on-screen text?",
      a: "No. It produces the clip; logos, captions and text overlays are added afterwards in your editing tool.",
    },
    {
      q: "Which aspect ratios are available?",
      a: "16:9, 9:16, 1:1 and other standard ratios, so the same idea can be drafted for different placements.",
    },
    {
      q: "Can I start from a product image?",
      a: "Yes. A clear product photo fixes the subject, and your text describes the motion around it.",
    },
    {
      q: "How long are the clips?",
      a: "They are short clips: Seedance 1.5 Pro generates 4–12 s and the Seedance 1.0 models generate 2–12 s. You set the duration in the generator.",
    },
    {
      q: "Can I use my own script text?",
      a: "Yes. Paste the line or the script into the prompt box and generate from it.",
    },
  ],
};

const ZH_AI_VIDEO_AD: SeoLandingContent = {
  path: "/ai-video-ad-generator",
  title: "AI 广告视频生成器 — 起草广告片段",
  description:
    "用文字或产品图片起草短广告片段，支持 16:9、9:16 和 1:1。了解工作方式，然后打开生成器开始创作。",
  h1: "AI 广告视频生成器",
  heroSub: "写下广告创意或上传产品图片，再打开生成器起草片段。",
  promptPlaceholder: "描述你想起草的广告片段…",
  ctaLabel: "打开生成器",
  whatTitle: "AI 广告视频生成器能做什么？",
  whatBody: [
    "它产出的是片段本身：光线中缓缓转动的产品、建立情绪的场面，以及一个可以先看效果、再决定是否拍摄的视觉创意。你也可以只用文字，或从产品图片出发。",
    "画幅同样在生成器里选择——横版、竖版或方形。它负责生成画面，剪辑、Logo 和文字叠加需要之后在剪辑工具里完成。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "写下创意",
      body: "用一两句话描述产品、场景和情绪，也可以直接从已有的产品图片开始。",
    },
    {
      title: "选择画幅",
      body: "根据片段的使用位置选择比例：16:9、9:16 或 1:1。",
    },
    {
      title: "生成并查看",
      body: "打开生成器运行提示词，调整措辞或更换图片，直到片段符合创意。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "生动的广告创意，支持音频生成",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "用文字或图片做简洁的产品与场景片段",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "细节更丰富的产品与场景镜头",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "会自动加上 Logo 或字幕吗？",
      a: "不会。它只生成片段本身，Logo、字幕和文字叠加需要之后在剪辑工具里添加。",
    },
    {
      q: "支持哪些画幅比例？",
      a: "16:9、9:16、1:1 等常用比例，同一个创意可以为不同位置各起草一版。",
    },
    {
      q: "可以从产品图片开始吗？",
      a: "可以。清晰的产品图会给片段一个固定的主体，文字则用来描述它周围的运动。",
    },
    {
      q: "片段有多长？",
      a: "都是短片：Seedance 1.5 Pro 生成 4–12 秒，Seedance 1.0 系列生成 2–12 秒，时长在生成器里选择。",
    },
    {
      q: "可以粘贴自己的脚本文字吗？",
      a: "可以。把句子或脚本粘贴到提示词框里即可生成。",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 3. Product clips                                                    */
/* ------------------------------------------------------------------ */

const EN_AI_PRODUCT_VIDEO: SeoLandingContent = {
  path: "/ai-product-video-generator",
  title: "AI Product Video Generator — From a Photo",
  description:
    "Turn a product photo into a product video clip. Reference to Video keeps the product consistent, with output up to 1080P. Open the generator to start.",
  h1: "AI Product Video Generator",
  heroSub:
    "Start from a product photo and describe the shot you want around it.",
  promptPlaceholder: "Describe the product shot you want…",
  ctaLabel: "Open the generator",
  whatTitle: "How product clips are made",
  whatBody: [
    "A product photo already shows the item clearly. The generator adds motion around it — a slow turn, light moving across the surface, a gentle camera move — so the still becomes a shot.",
    "When the product has to look the same throughout, Reference to Video is the right mode: reference images keep the subject consistent across the clip. Output goes up to 1080P.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Prepare the product photo",
      body: "Use a clear shot of the item on a simple background, and cut out clutter so the product stays the subject.",
    },
    {
      title: "Describe the shot",
      body: "Say how the product should be shown: turning slowly, lit from one side, framed closer as the clip moves.",
    },
    {
      title: "Generate and refine",
      body: "Open the generator, run the prompt, then adjust the description or add reference images to keep the product consistent.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Keeps a product consistent using reference images",
      input: "Product photo, reference images, text",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Simple product shots from a photo",
      input: "Product photo, text",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Highest-detail Seedance 1.0 product shots",
      input: "Product photo, text",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "How do I keep the product consistent?",
      a: "Use Reference to Video with Seedance 1.5 Pro: reference images hold the product's look steady through the clip.",
    },
    {
      q: "Which photo should I start from?",
      a: "A sharp, well-lit product shot on a simple background. The clearer the item, the easier it is to follow it.",
    },
    {
      q: "What resolution can I get?",
      a: "Output goes up to 1080P, and you choose the resolution in the generator.",
    },
    {
      q: "Can I describe the background too?",
      a: "Yes. Name the surface, the setting and the lighting in the prompt along with the camera move.",
    },
    {
      q: "Can I create a product clip from text only?",
      a: "Yes. Text to video works without a photo, though starting from a product image keeps the item recognisable.",
    },
  ],
};

const ZH_AI_PRODUCT_VIDEO: SeoLandingContent = {
  path: "/ai-product-video-generator",
  title: "AI 产品视频生成器 — 用一张照片做产品片",
  description:
    "把产品照片变成产品视频片段。Reference to Video 可以让产品保持一致，输出最高 1080P，打开生成器即可开始。",
  h1: "AI 产品视频生成器",
  heroSub: "从一张产品照片出发，描述你想要的镜头。",
  promptPlaceholder: "描述你想要的产品镜头…",
  ctaLabel: "打开生成器",
  whatTitle: "产品片段是怎样生成的",
  whatBody: [
    "产品照片已经把商品展示得很清楚，生成器要做的是围绕它加入运动：缓慢旋转、光线扫过表面、轻柔的运镜，让静物变成一个镜头。",
    "如果产品在整段画面里都必须保持一致，Reference to Video 就是合适的方式：参考图能让主体在外观上保持稳定。输出最高支持 1080P。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "准备产品照片",
      body: "选择背景简洁、商品清晰的图片，去掉多余杂物，让产品始终是主体。",
    },
    {
      title: "描述镜头",
      body: "写出产品应该如何呈现：缓慢旋转、单侧打光、随着镜头推进逐渐拉近。",
    },
    {
      title: "生成并微调",
      body: "打开生成器运行提示词，调整描述或加入参考图，让产品保持一致。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "用参考图保持产品一致",
      input: "产品照片、参考图、文字",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "从照片生成简洁的产品镜头",
      input: "产品照片、文字",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 系列中细节最丰富的产品镜头",
      input: "产品照片、文字",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "怎么让产品保持一致？",
      a: "使用 Reference to Video 配合 Seedance 1.5 Pro，参考图能让产品的外观在整段片段中保持稳定。",
    },
    {
      q: "应该用什么样的照片？",
      a: "清晰、光线均匀、背景简洁的产品图。商品越清楚，越容易被准确延续。",
    },
    {
      q: "可以输出多高的分辨率？",
      a: "输出最高支持 1080P，具体分辨率在生成器里选择。",
    },
    {
      q: "可以描述背景吗？",
      a: "可以。在提示词里写清台面、场景和光线，再补上镜头运动。",
    },
    {
      q: "只用文字能生成产品片段吗？",
      a: "可以。文字生成视频不需要照片，不过从产品图开始更容易保持商品的可辨识度。",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 4. Cinematic clips                                                  */
/* ------------------------------------------------------------------ */

const EN_AI_CINEMATIC_VIDEO: SeoLandingContent = {
  path: "/ai-cinematic-video-generator",
  title: "AI Cinematic Video Generator — Widescreen",
  description:
    "Create cinematic clips in 21:9 and 16:9 up to 1080P, guided by camera-direction prompts. See the workflow, then open the generator to create.",
  h1: "AI Cinematic Video Generator",
  heroSub:
    "Write the shot the way a camera direction is written, then open the generator to film it.",
  promptPlaceholder: "Describe the shot, the lens and the camera move…",
  ctaLabel: "Open the generator",
  whatTitle: "What makes a clip look cinematic?",
  whatBody: [
    "Cinematic framing starts with the shape of the frame and the way the camera moves. Widescreen 21:9 and 16:9 give a scene room to breathe, and output goes up to 1080P.",
    "The prompt carries the direction: where the camera sits, how it moves and what the light is doing. Written with care, a prompt reads like a shot list, and the model follows it.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Choose the frame",
      body: "Pick a widescreen ratio — 21:9 or 16:9 — and a resolution up to 1080P.",
    },
    {
      title: "Write the camera direction",
      body: "Describe the shot size, the lens and the move: a slow dolly in, a wide establishing pan, a low angle looking up.",
    },
    {
      title: "Generate and adjust",
      body: "Open the generator, run the prompt, then rewrite the direction until the shot reads the way you pictured it.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Widescreen shots guided by camera direction; can generate audio",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Straightforward widescreen coverage",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Highest-detail Seedance 1.0 cinematic look",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Which aspect ratios suit cinematic shots?",
      a: "Widescreen 21:9 and 16:9, so the frame is already wide without adding letterboxing.",
    },
    {
      q: "How do I write camera direction?",
      a: "Name the shot size, the angle and the move, for example a wide establishing shot from a low angle with a slow dolly in.",
    },
    {
      q: "Can the prompt set the lighting?",
      a: "Yes. Describe the light — backlit, golden hour, hard shadows — and the model works from that description.",
    },
    {
      q: "Which model gives the most detail?",
      a: "Seedance 1.0 Pro Quality is the highest-detail Seedance 1.0 option.",
    },
    {
      q: "Is audio generated too?",
      a: "Seedance 1.5 Pro supports audio generation, while the Seedance 1.0 models produce silent clips.",
    },
  ],
};

const ZH_AI_CINEMATIC_VIDEO: SeoLandingContent = {
  path: "/ai-cinematic-video-generator",
  title: "AI 电影感视频生成器 — 宽银幕画面",
  description:
    "用运镜提示词生成 21:9 和 16:9 的电影感片段，输出最高 1080P。了解工作流程，然后打开生成器开始创作。",
  h1: "AI 电影感视频生成器",
  heroSub: "像写镜位一样写下你的描述，再打开生成器把它拍出来。",
  promptPlaceholder: "描述镜头、焦段与运镜方式…",
  ctaLabel: "打开生成器",
  whatTitle: "什么让画面更有电影感？",
  whatBody: [
    "电影感从画幅和运镜开始。21:9 与 16:9 的宽银幕比例给场景留出呼吸空间，输出最高支持 1080P。",
    "提示词承担导演的部分：摄影机在哪里、如何移动、光线是什么状态。写得足够具体，它就像一份镜头清单，模型会照着执行。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "选择画幅",
      body: "选择宽银幕比例 21:9 或 16:9，以及最高 1080P 的分辨率。",
    },
    {
      title: "写出运镜方式",
      body: "描述景别、焦段和运动：缓慢推轨前进、广角摇镜建立环境、低角度仰拍。",
    },
    {
      title: "生成并调整",
      body: "打开生成器运行提示词，再改写运镜描述，直到画面接近你的设想。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "按运镜描述生成宽银幕镜头，支持音频生成",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "简洁的宽银幕镜头",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 系列中细节最丰富的电影感画面",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "哪些比例适合电影感镜头？",
      a: "21:9 和 16:9 的宽银幕比例，画幅本身就是宽的，不需要额外加黑边。",
    },
    {
      q: "运镜描述该怎么写？",
      a: "写清景别、角度和运动，例如低角度广角建立镜头配合缓慢推轨前进。",
    },
    {
      q: "可以指定光线吗？",
      a: "可以。描述逆光、黄昏金色光线或强烈阴影，模型会按照描述呈现。",
    },
    {
      q: "哪个模型细节更丰富？",
      a: "Seedance 1.0 Pro Quality 是 Seedance 1.0 系列中细节最丰富的选项。",
    },
    {
      q: "会同时生成声音吗？",
      a: "Seedance 1.5 Pro 支持音频生成，Seedance 1.0 系列则生成无声片段。",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 5. B-roll                                                           */
/* ------------------------------------------------------------------ */

const EN_AI_B_ROLL: SeoLandingContent = {
  path: "/ai-b-roll-generator",
  title: "AI B-Roll Generator — Cutaway Clips",
  description:
    "Generate short b-roll cutaways from a prompt to place between main footage. See the workflow, then open the generator to create your clips.",
  h1: "AI B-Roll Generator",
  heroSub:
    "Describe the cutaway you need, then open the generator to create the clip.",
  promptPlaceholder: "Describe the b-roll shot you need…",
  ctaLabel: "Open the generator",
  whatTitle: "What is b-roll?",
  whatBody: [
    "B-roll is the cutaway footage that sits between the main shots: a hand on a keyboard, traffic at dusk, clouds moving over a skyline. It covers edits and gives a scene texture.",
    "Generated b-roll only needs the few seconds a cut requires. The Seedance 1.0 models generate 2–12 s and Seedance 1.5 Pro generates 4–12 s, which suits a cutaway or a short sequence.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "List the cutaways",
      body: "Write down the small shots your edit needs: a close-up of hands, a street at dusk, an object on a desk.",
    },
    {
      title: "Describe each shot",
      body: "Keep the prompt simple: the subject, the setting and one camera move. Cutaways rarely need more than that.",
    },
    {
      title: "Generate and place",
      body: "Open the generator, create the clip, then drop it between your main footage in the edit.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Cutaways with optional audio, 4–12 s",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Short filler clips, 2–12 s",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Detailed filler clips, 2–12 s",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "How long are b-roll clips?",
      a: "The Seedance 1.0 models generate 2–12 s and Seedance 1.5 Pro generates 4–12 s, and you set the duration for each clip.",
    },
    {
      q: "Do b-roll clips need audio?",
      a: "Usually not, because they sit under your main audio track. Seedance 1.5 Pro can generate audio if you want it.",
    },
    {
      q: "Can I match the look of my main footage?",
      a: "Describe the same lighting, palette and lens each time so the cutaways sit with the rest of the edit.",
    },
    {
      q: "Which shots work as b-roll?",
      a: "Simple, specific ones: a detail, a texture, a passing scene. The subject should read instantly.",
    },
    {
      q: "Which aspect ratio should I use?",
      a: "Match your main footage. 16:9 is the usual choice for widescreen edits, with vertical and square available for other formats.",
    },
  ],
};

const ZH_AI_B_ROLL: SeoLandingContent = {
  path: "/ai-b-roll-generator",
  title: "AI 空镜生成器 — 补充镜头片段",
  description:
    "用提示词生成短空镜，插入主镜头之间使用。了解工作流程，然后打开生成器开始创作。",
  h1: "AI 空镜生成器",
  heroSub: "描述你需要的空镜，再打开生成器生成片段。",
  promptPlaceholder: "描述你需要的空镜画面…",
  ctaLabel: "打开生成器",
  whatTitle: "什么是空镜（B-roll）？",
  whatBody: [
    "空镜是插在主镜头之间的补拍画面：键盘上的手、黄昏的车流、掠过高楼的云。它能遮住剪辑点，也让场景更有质感。",
    "生成空镜只需要剪接所需的几秒钟。Seedance 1.0 系列可生成 2–12 秒，Seedance 1.5 Pro 可生成 4–12 秒，正好适合一个剪接点或一小段序列。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "列出需要的空镜",
      body: "写下剪辑需要的小镜头：手部特写、黄昏街道、桌面上的物件。",
    },
    {
      title: "逐条描述画面",
      body: "提示词保持简单：主体、场景，加上一个运镜。空镜通常不需要更多。",
    },
    {
      title: "生成并放入剪辑",
      body: "打开生成器生成片段，再把它放在主镜头之间。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "可带音频的空镜，4–12 秒",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "简短补位片段，2–12 秒",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "细节更丰富的补位片段，2–12 秒",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "空镜片段有多长？",
      a: "Seedance 1.0 系列生成 2–12 秒，Seedance 1.5 Pro 生成 4–12 秒，每段时长可以自行设置。",
    },
    {
      q: "空镜需要声音吗？",
      a: "通常不需要，它们会放在主音轨下方。如果想要声音，Seedance 1.5 Pro 可以生成音频。",
    },
    {
      q: "可以让空镜和主镜头风格一致吗？",
      a: "每次都描述相同的光线、色调和镜头风格，剪接时就会更统一。",
    },
    {
      q: "什么样的画面适合做空镜？",
      a: "简单而具体的画面：一个细节、一种质感、一段经过的场景。主体要一眼就能看懂。",
    },
    {
      q: "应该用哪个画幅比例？",
      a: "与主镜头保持一致。宽银幕剪辑通常用 16:9，其他格式也有竖版和方形可选。",
    },
  ],
};

export {
  EN_ANIMATE_IMAGE_AI,
  EN_AI_VIDEO_AD,
  EN_AI_PRODUCT_VIDEO,
  EN_AI_CINEMATIC_VIDEO,
  EN_AI_B_ROLL,
  ZH_ANIMATE_IMAGE_AI,
  ZH_AI_VIDEO_AD,
  ZH_AI_PRODUCT_VIDEO,
  ZH_AI_CINEMATIC_VIDEO,
  ZH_AI_B_ROLL,
};
