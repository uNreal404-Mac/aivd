import type { SeoLandingContent } from "./seo-landing";

/**
 * SEO landing copy for the additional video entry pages:
 *  - /reference-to-video            (existing tool route, landing appended below the tool)
 *  - /frames-to-video               (new route)
 *  - /ai-video-generator-with-audio (new route)
 *  - /ai-short-video-generator      (new route)
 *  - /ai-video-generator-for-tiktok (new route)
 *
 * Copy rules: original English + Chinese, no invented metrics (no user counts,
 * ratings, speeds or prices), only the real enabled model names (Seedance 1.5
 * Pro, Seedance 1.0 Pro Fast, Seedance 1.0 Pro Quality) and no promise of free
 * generation. Entry points only link to the existing generator routes.
 */

export const EN_REFERENCE_TO_VIDEO: SeoLandingContent = {
  path: "/reference-to-video",
  title: "Reference to Video — Consistent Subjects",
  description:
    "Use a reference image to keep a character or subject consistent across a clip. See how reference to video works, then open the tool.",
  h1: "Reference to Video",
  heroSub:
    "Upload a reference image, describe the shot, and open the tool to keep the same subject across the clip.",
  promptPlaceholder: "Describe the shot and how the subject should look…",
  ctaLabel: "Open the tool",
  whatTitle: "What is reference to video?",
  whatBody: [
    "Reference to video starts from an image of the subject you want to keep. The tool uses it as a guide, so the character, product or look stays recognisable as the clip plays.",
    "It suits recurring characters and branded objects, where a small change in appearance would be noticeable. You still describe the shot; the reference only anchors who or what is on screen.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Upload a reference image",
      body: "Pick a clear image of the character, product or subject you want to keep consistent.",
    },
    {
      title: "Describe the shot",
      body: "Write what should happen around the subject: the setting, the action and the camera movement.",
    },
    {
      title: "Open the tool and generate",
      body: "Run it in the reference to video tool, then adjust the wording if the subject drifts.",
    },
  ],
  compareTitle: "Model you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Keeps a subject consistent from a reference image",
      input: "Reference image, text",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What is reference to video for?",
      a: "It keeps a character or subject consistent. You supply a reference image, and the model uses it as a guide while it generates the clip.",
    },
    {
      q: "How is it different from image to video?",
      a: "Image to video animates one still frame as the opening moment. Reference to video treats the image as a guide for how the subject should look.",
    },
    {
      q: "What makes a good reference image?",
      a: "A clear, well-lit picture of the subject, ideally on a simple background with the whole subject visible.",
    },
    {
      q: "Which model supports it?",
      a: "Reference to video uses Seedance 1.5 Pro.",
    },
    {
      q: "Can I change the scene?",
      a: "Yes. The reference anchors the subject, while the prompt sets the setting, the action and the camera movement.",
    },
  ],
};

export const ZH_REFERENCE_TO_VIDEO: SeoLandingContent = {
  path: "/reference-to-video",
  title: "参考图生成视频 — 保持主体一致",
  description:
    "用一张参考图让角色或主体在整段视频中保持一致。了解参考图生成视频的原理，然后打开工具开始创作。",
  h1: "参考图生成视频",
  heroSub: "上传一张参考图，描述镜头内容，再打开工具让同一个主体贯穿整段视频。",
  promptPlaceholder: "描述镜头内容以及主体应有的样子…",
  ctaLabel: "打开工具",
  whatTitle: "什么是参考图生成视频？",
  whatBody: [
    "参考图生成视频会从一张主体图片出发，把它当作参照，让角色、产品或特定形象在整段视频中保持可辨认。",
    "它适合反复出现的角色和品牌物件——这类主体只要外观稍有变化就会被看出来。镜头内容仍由你描述，参考图只负责锚定画面里的是谁或是什么。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "上传参考图",
      body: "选择一张清晰的角色、产品或主体图片，尽量主体完整、光线均匀。",
    },
    {
      title: "描述镜头",
      body: "写下主体周围发生的事：场景、动作和镜头运动。",
    },
    {
      title: "打开工具生成",
      body: "在参考图生成视频工具中运行，如果主体有偏移就调整描述再试。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "根据参考图保持主体一致",
      input: "参考图、文字",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "参考图生成视频有什么用？",
      a: "它能让角色或主体保持一致。你提供参考图，模型在生成时以它作为参照。",
    },
    {
      q: "它和图片生成视频有什么区别？",
      a: "图片生成视频把一张静态画面当作开场的瞬间；参考图生成视频则把图片当作主体外观的参照。",
    },
    {
      q: "什么样的参考图更好？",
      a: "主体清晰、光线均匀的图片，最好背景简洁、主体完整可见。",
    },
    {
      q: "支持哪个模型？",
      a: "参考图生成视频使用 Seedance 1.5 Pro。",
    },
    {
      q: "可以更换场景吗？",
      a: "可以。参考图锚定主体，提示词负责设定场景、动作和镜头运动。",
    },
  ],
};

export const EN_FRAMES_TO_VIDEO: SeoLandingContent = {
  path: "/frames-to-video",
  title: "Frames to Video — Animate Between Two Frames",
  description:
    "Set a start frame and an end frame, then let the model fill the motion between them. See how frames to video works and open the tool.",
  h1: "Frames to Video",
  heroSub: "Give a start frame and an end frame, and let the model fill the motion in between.",
  promptPlaceholder: "Describe what should happen between the two frames…",
  ctaLabel: "Open the tool",
  whatTitle: "What is frames to video?",
  whatBody: [
    "Frames to video takes two images: the first frame and the last frame. The model generates the motion that connects them.",
    "It gives you control over where a shot begins and ends, which is useful when the clip has to land on a particular composition.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Choose the start frame",
      body: "Pick the image the shot should open on.",
    },
    {
      title: "Choose the end frame",
      body: "Pick the image the shot should finish on, with a composition that follows naturally.",
    },
    {
      title: "Generate in between",
      body: "Open the tool, add any text guidance, and let the model fill the motion between the two frames.",
    },
  ],
  compareTitle: "Model you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Connects two frames with controlled motion",
      input: "Start frame, end frame, text",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "How does frames to video work?",
      a: "You provide a start frame and an end frame. The model generates the movement between them.",
    },
    {
      q: "How close should the two frames be?",
      a: "Close enough that the motion is believable, such as a subject turning or the camera pushing in.",
    },
    {
      q: "Can I add text as well?",
      a: "Yes. A short line describing the movement helps guide the result.",
    },
    {
      q: "Which aspect ratios are available?",
      a: "Frames to video works in landscape 16:9 and vertical 9:16.",
    },
    {
      q: "Which model supports it?",
      a: "Frames to video uses Seedance 1.5 Pro.",
    },
  ],
};

export const ZH_FRAMES_TO_VIDEO: SeoLandingContent = {
  path: "/frames-to-video",
  title: "首尾帧生成视频 — 补足中间运动",
  description:
    "上传起始帧和结束帧，由模型补足两帧之间的运动。了解首尾帧生成视频的原理，然后打开工具开始创作。",
  h1: "首尾帧生成视频",
  heroSub: "给出起始帧和结束帧，让模型把两者之间的运动补全。",
  promptPlaceholder: "描述两帧之间应该发生什么…",
  ctaLabel: "打开工具",
  whatTitle: "什么是首尾帧生成视频？",
  whatBody: [
    "首尾帧生成视频需要两张图片：起始帧和结束帧。模型会生成连接两者的运动过程。",
    "它能控制一个镜头的起点和终点，适合需要落在特定构图上收尾的画面。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "选择起始帧",
      body: "挑一张作为镜头开头的图片。",
    },
    {
      title: "选择结束帧",
      body: "挑一张作为镜头结尾的图片，构图衔接尽量自然。",
    },
    {
      title: "补足中间过程",
      body: "打开工具，可以附加文字说明，让模型补全两帧之间的运动。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "支持首尾帧控制",
      input: "起始帧、结束帧、文字",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "首尾帧生成视频是怎么工作的？",
      a: "你提供起始帧和结束帧，模型生成它们之间的运动。",
    },
    {
      q: "两帧之间应该差多少？",
      a: "差异要让运动显得自然，比如主体转身或镜头推近。",
    },
    {
      q: "可以同时加文字吗？",
      a: "可以。用一句话描述运动方式，有助于引导结果。",
    },
    {
      q: "支持哪些画幅？",
      a: "首尾帧生成视频支持横屏 16:9 和竖屏 9:16。",
    },
    {
      q: "支持哪个模型？",
      a: "首尾帧生成视频使用 Seedance 1.5 Pro。",
    },
  ],
};

export const EN_AI_VIDEO_WITH_AUDIO: SeoLandingContent = {
  path: "/ai-video-generator-with-audio",
  title: "AI Video Generator With Audio — Clips With Sound",
  description:
    "Generate a clip together with its sound. See how an AI video generator with audio works and which model supports it, then open the tool.",
  h1: "AI Video Generator With Audio",
  heroSub: "Describe the picture and the sound you want, then open the generator to create both together.",
  promptPlaceholder: "Describe the scene and the sound in it…",
  ctaLabel: "Open the generator",
  whatTitle: "What is an AI video generator with audio?",
  whatBody: [
    "An AI video generator with audio produces a clip and its soundtrack together. Sound is generated alongside the picture instead of being added later.",
    "That keeps dialogue, ambience and movement on the same timeline, which is handy for short scenes that need sound from the first take.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Describe the scene and its sound",
      body: "Say what happens and what should be heard: ambience, footsteps, a line of dialogue.",
    },
    {
      title: "Choose Seedance 1.5 Pro",
      body: "Audio generation is supported by this model.",
    },
    {
      title: "Generate and listen",
      body: "Open the generator, run the prompt, then adjust the description if the sound does not match the scene.",
    },
  ],
  compareTitle: "Model you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Generates the clip and its audio together",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Does the generator create sound?",
      a: "Yes. With Seedance 1.5 Pro the clip and its audio are generated together.",
    },
    {
      q: "Which model supports audio?",
      a: "Seedance 1.5 Pro. The Seedance 1.0 models generate video without audio.",
    },
    {
      q: "How do I describe the sound?",
      a: "Name it in the prompt, the same way you describe the picture: ambience, footsteps, music or a spoken line.",
    },
    {
      q: "Can I use an image as well?",
      a: "Yes. You can start from a still image or from text, and add a description of the sound.",
    },
    {
      q: "How long can the clip be?",
      a: "Seedance 1.5 Pro generates clips from four to twelve seconds.",
    },
  ],
};

export const ZH_AI_VIDEO_WITH_AUDIO: SeoLandingContent = {
  path: "/ai-video-generator-with-audio",
  title: "带音频的 AI 视频生成器",
  description:
    "同时生成画面与声音。了解带音频的 AI 视频生成器如何工作、由哪个模型支持，然后打开生成器开始创作。",
  h1: "带音频的 AI 视频生成器",
  heroSub: "描述画面，也描述应该听到的声音，再打开生成器一起生成。",
  promptPlaceholder: "描述画面以及其中应该出现的声音…",
  ctaLabel: "打开生成器",
  whatTitle: "什么是带音频的 AI 视频生成器？",
  whatBody: [
    "带音频的 AI 视频生成器会把画面和声音一起生成，音效不是后期再补上去的。",
    "对白、环境声和动作因此处在同一条时间线上，适合需要一次成声的短片场景。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "描述画面和声音",
      body: "写清发生什么，以及应该听到什么：环境声、脚步声、一句对白。",
    },
    {
      title: "选择 Seedance 1.5 Pro",
      body: "音频生成由该模型支持。",
    },
    {
      title: "生成并试听",
      body: "打开生成器运行提示词，如果声音与画面不符就调整描述。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "画面与音频一起生成",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "生成器会生成声音吗？",
      a: "会。使用 Seedance 1.5 Pro 时，画面和音频一起生成。",
    },
    {
      q: "哪个模型支持音频？",
      a: "Seedance 1.5 Pro。Seedance 1.0 系列模型只生成画面，不带音频。",
    },
    {
      q: "声音该怎么描述？",
      a: "像描述画面一样把它写进提示词：环境声、脚步声、音乐或一句台词。",
    },
    {
      q: "也可以用图片作为起点吗？",
      a: "可以。既可以从文字开始，也可以从一张静态图片开始，再补上对声音的描述。",
    },
    {
      q: "片段可以多长？",
      a: "Seedance 1.5 Pro 可生成四到十二秒的片段。",
    },
  ],
};

export const EN_AI_SHORT_VIDEO: SeoLandingContent = {
  path: "/ai-short-video-generator",
  title: "AI Short Video Generator — Quick Short Clips",
  description:
    "Create short clips from a prompt. See how an AI short video generator works, compare models, and open the tool to start a quick scene.",
  h1: "AI Short Video Generator",
  heroSub: "Build a brief clip around a single action or moment.",
  promptPlaceholder: "Describe the short scene you want to create…",
  ctaLabel: "Open the generator",
  whatTitle: "What is an AI short video generator?",
  whatBody: [
    "A short video generator is built for brief clips: a single beat, one action, a quick product moment.",
    "Short clips are easier to steer, because there is less time for the model to drift from the prompt. They are also quick to review and regenerate.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Write a single beat",
      body: "Keep the prompt to one action or one moment, so the clip has a clear focus.",
    },
    {
      title: "Compare models",
      body: "Pick between Seedance 1.5 Pro, Seedance 1.0 Pro Fast and Seedance 1.0 Pro Quality.",
    },
    {
      title: "Generate and trim the wording",
      body: "Run it, then rewrite the prompt until the short clip lands.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Audio, frame control and lively motion",
      input: "Text, image, start and end frames",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Lower-cost option for straightforward ideas",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Most detail in the Seedance 1.0 line",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What counts as a short video?",
      a: "A brief clip built around one action or one moment, rather than a full scene with several beats.",
    },
    {
      q: "Which models can I use?",
      a: "Seedance 1.5 Pro, Seedance 1.0 Pro Fast and Seedance 1.0 Pro Quality.",
    },
    {
      q: "Which model should I start with?",
      a: "Seedance 1.0 Pro Fast suits simple ideas. Seedance 1.5 Pro adds audio and start and end frame control.",
    },
    {
      q: "How short can a clip be?",
      a: "The Seedance 1.0 models generate clips from two to twelve seconds, and Seedance 1.5 Pro from four to twelve seconds.",
    },
    {
      q: "Can I make vertical short clips?",
      a: "Yes. Choose 9:16 for a vertical frame.",
    },
  ],
};

export const ZH_AI_SHORT_VIDEO: SeoLandingContent = {
  path: "/ai-short-video-generator",
  title: "AI 短视频生成器",
  description:
    "用提示词生成简短片段。了解 AI 短视频生成器如何工作、可选哪些模型，然后打开生成器开始一个快速画面。",
  h1: "AI 短视频生成器",
  heroSub: "围绕一个动作或一个瞬间，生成节奏紧凑的短片段。",
  promptPlaceholder: "描述你想生成的短画面…",
  ctaLabel: "打开生成器",
  whatTitle: "什么是 AI 短视频生成器？",
  whatBody: [
    "短视频生成器面向简短片段：一个节拍、一个动作，或者产品的一个瞬间。",
    "片段越短越容易控制，因为模型偏离提示词的空间更小，也更快看完和重新生成。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "只写一个节拍",
      body: "把提示词控制在单个动作或瞬间，让画面重点明确。",
    },
    {
      title: "比较可选模型",
      body: "在 Seedance 1.5 Pro、Seedance 1.0 Pro Fast 和 Seedance 1.0 Pro Quality 之间选择。",
    },
    {
      title: "生成并精简措辞",
      body: "运行提示词，再改写文字，直到短片达到预期。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "支持音频、首尾帧控制，运动生动",
      input: "文字、图片、首尾帧",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合简单想法的低成本选择",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 系列中细节最丰富",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "什么算短视频？",
      a: "围绕一个动作或一个瞬间的简短片段，而不是包含多个节拍的完整场景。",
    },
    {
      q: "可以用哪些模型？",
      a: "Seedance 1.5 Pro、Seedance 1.0 Pro Fast 和 Seedance 1.0 Pro Quality。",
    },
    {
      q: "应该先用哪个模型？",
      a: "Seedance 1.0 Pro Fast 更适合简单想法；Seedance 1.5 Pro 提供音频以及首尾帧控制。",
    },
    {
      q: "片段可以多短？",
      a: "Seedance 1.0 系列可生成二到十二秒的片段，Seedance 1.5 Pro 为四到十二秒。",
    },
    {
      q: "可以生成竖屏短片吗？",
      a: "可以。选择 9:16 即可得到竖屏画面。",
    },
  ],
};

export const EN_AI_VIDEO_FOR_TIKTOK: SeoLandingContent = {
  path: "/ai-video-generator-for-tiktok",
  title: "AI Video Generator for TikTok — Vertical Clips",
  description:
    "Create vertical clips for short-form feeds. See how an AI video generator for TikTok-style videos works, then open the tool to begin.",
  h1: "AI Video Generator for TikTok",
  heroSub: "Start from a vertical 9:16 frame and describe a moment made for a phone screen.",
  promptPlaceholder: "Describe a shot that suits a vertical frame…",
  ctaLabel: "Open the generator",
  whatTitle: "Why do short-form feeds favour vertical?",
  whatBody: [
    "Short-form feeds are vertical, so this page focuses on 9:16 clips made for a phone screen rather than a wide frame.",
    "You describe the moment, choose a vertical aspect ratio, and the generator produces a clip that fills the screen.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Describe a vertical shot",
      body: "Write the moment with a tall frame in mind: a subject centred, a product held up, a face close to the camera.",
    },
    {
      title: "Set a vertical aspect ratio",
      body: "Choose 9:16 in the generator so the clip is built for a phone screen.",
    },
    {
      title: "Generate and review on a phone",
      body: "Run the prompt, then watch the result at phone size and adjust the framing notes.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Audio, frame control and lively motion",
      input: "Text, image, start and end frames",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Lower-cost option for straightforward ideas",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Most detail in the Seedance 1.0 line",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What makes a clip work in a vertical feed?",
      a: "A tall 9:16 frame, one clear subject and a single moment that reads instantly.",
    },
    {
      q: "Which aspect ratio should I choose?",
      a: "9:16. The generator also offers 16:9, 1:1, 4:3, 3:4 and 21:9 for other formats.",
    },
    {
      q: "Do I need special tools to publish?",
      a: "No. The generator produces a video file; where you share it afterwards is up to you.",
    },
    {
      q: "Which models can I use for vertical clips?",
      a: "Seedance 1.5 Pro, Seedance 1.0 Pro Fast and Seedance 1.0 Pro Quality all support 9:16.",
    },
    {
      q: "Can I keep a character consistent across clips?",
      a: "Yes. The reference to video tool uses a reference image to keep a subject consistent.",
    },
  ],
};

export const ZH_AI_VIDEO_FOR_TIKTOK: SeoLandingContent = {
  path: "/ai-video-generator-for-tiktok",
  title: "面向 TikTok 的 AI 视频生成器 — 竖屏片段",
  description:
    "为短内容信息流制作竖屏片段。了解面向 TikTok 风格的 AI 视频生成器如何工作，然后打开生成器开始创作。",
  h1: "面向 TikTok 的 AI 视频生成器",
  heroSub: "以竖屏 9:16 为起点，描述一个适合手机屏幕的瞬间。",
  promptPlaceholder: "描述一个适合竖屏的镜头…",
  ctaLabel: "打开生成器",
  whatTitle: "为什么短内容偏爱竖屏？",
  whatBody: [
    "短内容信息流以竖屏为主，所以这个页面聚焦 9:16 画面，而不是横向宽幅。",
    "你描述一个瞬间，选择竖屏比例，生成器就会输出填满手机屏幕的片段。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "描述竖屏镜头",
      body: "带着竖幅构图来写：主体居中、举起的产品、靠近镜头的脸。",
    },
    {
      title: "设置竖屏比例",
      body: "在生成器中选择 9:16，让片段面向手机屏幕。",
    },
    {
      title: "生成并在手机上查看",
      body: "运行提示词，用手机尺寸观看结果，再调整构图描述。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "支持音频、首尾帧控制，运动生动",
      input: "文字、图片、首尾帧",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合简单想法的低成本选择",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 系列中细节最丰富",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "什么样的片段适合竖屏信息流？",
      a: "9:16 的竖幅画面、一个清晰的主体，以及一眼就能读懂的单个瞬间。",
    },
    {
      q: "应该选择哪个画幅？",
      a: "9:16。生成器同时提供 16:9、1:1、4:3、3:4 和 21:9 等其他画幅。",
    },
    {
      q: "发布需要特殊工具吗？",
      a: "不需要。生成器输出的是视频文件，之后在哪里分享由你决定。",
    },
    {
      q: "竖屏片段可以用哪些模型？",
      a: "Seedance 1.5 Pro、Seedance 1.0 Pro Fast 和 Seedance 1.0 Pro Quality 都支持 9:16。",
    },
    {
      q: "多个片段能保持同一角色吗？",
      a: "可以。参考图生成视频工具会用一张参考图保持主体一致。",
    },
  ],
};
