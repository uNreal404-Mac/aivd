/**
 * SEO landing copy for the job42d batch: animation, anime, cartoon, logo
 * animation and real estate routes.
 *
 * Same content shape and copy rules as the earlier batches: original English +
 * Simplified Chinese, only the enabled Seedance models, no invented metrics, no
 * promise of free generation, and entry points that only link to the existing
 * generator. Visual style is steered by the prompt itself — the site has no
 * style preset, style picker or style model.
 */

import type { SeoLandingContent } from "./seo-landing";

/* ------------------------------------------------------------------ */
/* English                                                             */
/* ------------------------------------------------------------------ */

export const EN_AI_ANIMATION: SeoLandingContent = {
  path: "/ai-animation-generator",
  title: "AI Animation Generator — Bring Drawings to Life",
  description:
    "Turn a text prompt or a still drawing into animation with an AI animation generator. Learn how it works, compare models, and open the generator.",
  h1: "AI Animation Generator",
  heroSub:
    "Describe the movement you want, or hand the model a drawing, and it builds the animated clip.",
  promptPlaceholder: "Describe the animation you want to create…",
  ctaLabel: "Open the generator",
  whatTitle: "What can an AI animation generator do?",
  whatBody: [
    "An AI animation generator turns a description — or a drawing, sketch or still image — into a moving clip. You set the subject and the action in words, and the model builds the motion frame by frame.",
    "The look itself comes from your prompt. There is no separate style menu to choose from, so describe the visual language you want: soft pencil shading, flat shapes, glossy highlights, whatever fits the idea.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Describe the scene or upload a drawing",
      body: "Write what should move and how, or use a still drawing as the starting frame. Plain language works best.",
    },
    {
      title: "Choose a model",
      body: "Pick the model that suits the idea, then open the generator and run the prompt.",
    },
    {
      title: "Refine the wording",
      body: "If the motion or the look is off, rewrite a few words and generate again until it matches what you pictured.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively motion, rich scene detail and audio generation",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What can I use it for?",
      a: "Short animated clips: a character walking, an object turning, or a scene that shifts from one drawing to the next. Results depend on the prompt and the model.",
    },
    {
      q: "Do I need software to draw the frames?",
      a: "No. You can start from text alone, or from a single drawing or still image that the model animates.",
    },
    {
      q: "How do I control the visual style?",
      a: "Describe it in the prompt: line weight, shading, colours and level of detail. The model follows your wording rather than a preset.",
    },
    {
      q: "Can I keep the same character across clips?",
      a: "Yes. Reference to Video keeps a character or subject consistent from reference images.",
    },
    {
      q: "What if the motion looks wrong?",
      a: "Simplify the sentence, name one clear movement at a time, and generate again.",
    },
  ],
  related: [
    {
      label: "Start from a picture instead: Image to Video",
      path: "/image-to-video",
    },
    {
      label: "Want a photo or portrait to move? See Make Your Photo Move",
      path: "/animate-image-ai",
    },
  ],
};

export const EN_AI_ANIME_VIDEO: SeoLandingContent = {
  path: "/ai-anime-video-generator",
  title: "AI Anime Video Generator — Stylised Clips From a Prompt",
  description:
    "Create anime-style clips with an AI anime video generator. Describe the style and scene in your prompt, or start from an illustration.",
  h1: "AI Anime Video Generator",
  heroSub:
    "Describe the scene and the drawing style in the prompt, then open the generator to create the clip.",
  promptPlaceholder: "Describe the scene and the drawing style you want…",
  ctaLabel: "Open the generator",
  whatTitle: "How anime-style clips are made",
  whatBody: [
    "The model follows your prompt: name the setting, the characters and the mood, then describe the drawing style — line work, shading, colour palette. The style lives in the wording, not in a preset.",
    "You can also start from an existing illustration. Upload an anime-style image and the model animates it, keeping that frame as the first moment of the clip.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Write the scene",
      body: "Who is on screen, where it happens, and what the camera does.",
    },
    {
      title: "Describe the drawing style",
      body: "Line weight, shading and palette all shape the result. Put the style words in the prompt every time.",
    },
    {
      title: "Generate and refine",
      body: "Open the generator, run the prompt, then adjust the wording until the clip matches the idea.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively motion, rich scene detail and audio generation",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Do I need an illustration to start?",
      a: "No. Text alone is enough. If you already have an illustration, Image to Video can animate it and keep that frame as the opening moment.",
    },
    {
      q: "How do I get a specific look?",
      a: "Describe it in words: the line style, the shading, the palette and the level of detail. The prompt drives the look.",
    },
    {
      q: "Can the same character appear in several clips?",
      a: "Yes. Reference to Video keeps a character or subject consistent using reference images.",
    },
    {
      q: "Which model should I start with?",
      a: "Seedance 1.5 Pro handles the liveliest motion and can add audio. The Seedance 1.0 Pro models are good for straightforward clips.",
    },
    {
      q: "What if the style drifts between clips?",
      a: "Repeat the style words in the same order every time, and keep each prompt short and specific.",
    },
  ],
  related: [
    {
      label: "Animate an existing illustration: Image to Video",
      path: "/image-to-video",
    },
    {
      label: "Keep a character consistent: Reference to Video",
      path: "/reference-to-video",
    },
  ],
};

export const EN_AI_CARTOON_VIDEO: SeoLandingContent = {
  path: "/ai-cartoon-video-generator",
  title: "AI Cartoon Video Generator — Playful Clips",
  description:
    "Make playful cartoon-style clips with an AI cartoon video generator. Describe the characters and action in the prompt, then open the generator to create.",
  h1: "AI Cartoon Video Generator",
  heroSub:
    "Describe the characters, the setting and the action, then let the model build the clip.",
  promptPlaceholder: "Describe the characters and the action you want…",
  ctaLabel: "Open the generator",
  whatTitle: "What you can create",
  whatBody: [
    "Cartoon-style clips start from a simple description: who is in the scene, what they do, and how the camera follows them. The model turns that into moving footage with a bright, drawn look.",
    "Keep the wording consistent across clips if you want the same characters to return. Reference to Video helps hold a character or subject steady using reference images.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Set up the characters",
      body: "Name each character, the outfit and the setting in a sentence or two.",
    },
    {
      title: "Add the action",
      body: "Say what happens in the clip and how the camera moves — a pan, a push in, a wide shot.",
    },
    {
      title: "Generate and tighten the prompt",
      body: "Open the generator, run the prompt, and reword anything the model misreads.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively motion, rich scene detail and audio generation",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What kind of clips can I make?",
      a: "Short character moments, simple gags, product mascots and scene setters — anything you can describe in a sentence or two.",
    },
    {
      q: "Can the same character come back in a later clip?",
      a: "Yes. Reference to Video keeps a character or subject consistent using reference images.",
    },
    {
      q: "How do I describe the look?",
      a: "Put the look in the prompt: bold outlines, flat fills, soft shading. The wording steers the result.",
    },
    {
      q: "Do I need drawing skills?",
      a: "No. You can start from text alone, or from an existing illustration used as a still frame.",
    },
    {
      q: "Can the clips include sound?",
      a: "Seedance 1.5 Pro supports audio generation. The Seedance 1.0 Pro models produce silent clips.",
    },
  ],
  related: [
    {
      label: "Keep a character consistent: Reference to Video",
      path: "/reference-to-video",
    },
    {
      label: "Animate a still image: Image to Video",
      path: "/image-to-video",
    },
  ],
};

export const EN_AI_LOGO_ANIMATION: SeoLandingContent = {
  path: "/ai-logo-animation",
  title: "AI Logo Animation — Simple Motion From a Logo Image",
  description:
    "Try AI logo animation: start from a logo image, describe a simple move like a reveal or a glow, and open the generator to create the clip.",
  h1: "AI Logo Animation",
  heroSub:
    "Upload a logo image, describe the motion you want, and see what the model produces.",
  promptPlaceholder: "Describe how the logo should move…",
  ctaLabel: "Open the generator",
  whatTitle: "What logo animation can do here",
  whatBody: [
    "This tool animates a logo image with model-generated motion: a reveal, a soft glow, a slow rotation or a push in. You describe the movement and the model renders the clip.",
    "It is a way to explore motion ideas quickly, not a replacement for a design tool. The model may alter fine details, so check the result closely before you use it anywhere.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Upload the logo image",
      body: "Use a clear image with the mark centred and a simple background.",
    },
    {
      title: "Describe simple motion",
      body: "One movement at a time works best: a fade in, a glow, a rotation, a slow zoom.",
    },
    {
      title: "Review the output closely",
      body: "Check the lettering and the shapes in the clip. If details shifted, adjust the prompt or keep the original artwork for the final version.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively motion, rich scene detail and audio generation",
      input: "Logo image, text",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: "Logo image, text",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: "Logo image, text",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Will the logo stay exactly the same?",
      a: "Not guaranteed. The model may change fine details or lettering, so review the clip and compare it with the original artwork.",
    },
    {
      q: "Which motions work best?",
      a: "Simple moves: a fade or reveal, a glow, a gentle rotation, a slow push in. Complicated choreography is harder to keep clean.",
    },
    {
      q: "Which image should I upload?",
      a: "A clear logo image on a plain background, with the mark centred and large enough to read.",
    },
    {
      q: "Can I export a finished file from here?",
      a: "Do the final finishing and export in a design tool, where the exact brand assets and lettering stay under your control.",
    },
    {
      q: "Which model should I choose?",
      a: "Seedance 1.5 Pro handles the liveliest motion and adds audio. Seedance 1.0 Pro Fast and Seedance 1.0 Pro Quality suit straightforward clips.",
    },
  ],
  related: [
    {
      label: "Animate a still image instead: Image to Video",
      path: "/image-to-video",
    },
    {
      label: "Start from a written prompt: Text to Video",
      path: "/text-to-video",
    },
  ],
};

export const EN_AI_REAL_ESTATE_VIDEO: SeoLandingContent = {
  path: "/ai-real-estate-video-generator",
  title: "AI Real Estate Video Generator — From One Photo",
  description:
    "Turn a property photo into a moving clip with an AI real estate video generator. Describe a slow push in or a gentle pan, then open the generator.",
  h1: "AI Real Estate Video Generator",
  heroSub:
    "Upload a property photo, describe a slow camera move, and generate a walkthrough-style or push-in clip.",
  promptPlaceholder: "Describe how the camera should move across the space…",
  ctaLabel: "Open the generator",
  whatTitle: "How it works for property photos",
  whatBody: [
    "Start from a single photograph of a room or a building. Describe the camera move — a slow push in, a gentle pan across the space, a short tilt upward — and the model renders a clip that feels like a walkthrough.",
    "The clip is generated motion, not a recording. The model can add or change details that were not in the room, so treat it as a visual starting point rather than a record of the property.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Pick the photo",
      body: "Choose a sharp, wide shot with even light. Straight verticals and an uncluttered frame give the model more to work with.",
    },
    {
      title: "Describe the camera move",
      body: "Use a slow push in for a living room, a gentle pan across a facade, or a short tilt up a building.",
    },
    {
      title: "Choose the frame shape",
      body: "16:9 suits listings and websites; 9:16 suits vertical social feeds. Open the generator to run the prompt.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively motion, rich scene detail and audio generation",
      input: "Property photo, text",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: "Property photo, text",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: "Property photo, text",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Is this a real tour of the property?",
      a: "No. The clip is generated motion built from one photo. It may invent details that were not in the room, so do not present it as a real walkthrough.",
    },
    {
      q: "What should I upload?",
      a: "One clear property photo: a wide room shot, a facade or an exterior. Sharp, evenly lit images work best.",
    },
    {
      q: "Which aspect ratio should I use?",
      a: "16:9 for listings, brochures and websites. 9:16 for vertical social feeds.",
    },
    {
      q: "Can I show the same property from several angles?",
      a: "Yes. Upload a different photo for each change of view and describe the camera move for each one.",
    },
    {
      q: "Which model should I choose?",
      a: "Seedance 1.5 Pro for the liveliest motion and audio. Seedance 1.0 Pro Fast for quick drafts, Seedance 1.0 Pro Quality for the most detail.",
    },
  ],
  related: [
    {
      label: "Animate any still photo: Image to Video",
      path: "/image-to-video",
    },
    {
      label: "Make a photo move: Make Your Photo Move",
      path: "/animate-image-ai",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Chinese                                                             */
/* ------------------------------------------------------------------ */

export const ZH_AI_ANIMATION: SeoLandingContent = {
  path: "/ai-animation-generator",
  title: "AI 动画生成器 — 把文字或画稿变成动画",
  description:
    "用 AI 动画生成器把文字提示或一张画稿变成动态片段：了解它的工作方式与可选模型，再打开生成器开始创作。",
  h1: "AI 动画生成器",
  heroSub: "描述你想要的运动，或者直接给出一张画稿，让模型生成动画片段。",
  promptPlaceholder: "描述你想生成的动画内容…",
  ctaLabel: "打开生成器",
  whatTitle: "什么是 AI 动画生成器？",
  whatBody: [
    "AI 动画生成器可以把一段描述，或者一张素描、草图、静态图，变成动态片段。你用文字设定主体和动作，模型逐帧补上运动。",
    "画面的风格来自你的提示词。这里没有独立的风格选项，所以在提示词里直接描述你想要的视觉语言：铅笔质感、扁平色块、光泽高光，都可以写进去。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "描述场景或上传画稿",
      body: "写清什么在动、怎么动，或者用一张静态画稿作为起始帧。日常语言就足够。",
    },
    {
      title: "选择模型",
      body: "挑选更贴合想法的模型，然后打开生成器运行提示词。",
    },
    {
      title: "调整措辞",
      body: "如果运动或画风不对，改几个词再生成一次，直到接近你的设想。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "运动生动、场景细节丰富，支持生成音频",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: "Text, image",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "可以用它做什么？",
      a: "制作短片动画：人物走动、物体转动，或者从一个画面过渡到另一个画面。效果取决于提示词和模型。",
    },
    {
      q: "需要自己画每一帧吗？",
      a: "不需要。你可以只写文字，也可以从一张画稿或静态图开始，让模型把它变成动态。",
    },
    {
      q: "画风该怎么控制？",
      a: "在提示词里描述：线条粗细、明暗处理、配色和细节程度。模型跟随文字，而不是某个预设风格。",
    },
    {
      q: "多个片段能保持同一个角色吗？",
      a: "可以。参考图生视频会用参考图让角色或主体保持一致。",
    },
    {
      q: "运动效果不对怎么办？",
      a: "把句子写短，一次只写一个明确的动作，然后重新生成。",
    },
  ],
  related: [
    {
      label: "想从图片开始：图片生成视频",
      path: "/image-to-video",
    },
    {
      label: "想让照片或人像动起来？看看「让照片动起来」",
      path: "/animate-image-ai",
    },
  ],
};

export const ZH_AI_ANIME_VIDEO: SeoLandingContent = {
  path: "/ai-anime-video-generator",
  title: "AI 动漫视频生成器 — 用提示词描述画面风格",
  description:
    "用 AI 动漫视频生成器制作动漫风片段：在提示词里描述风格与场景，或者从一张插画开始，再打开生成器创作。",
  h1: "AI 动漫视频生成器",
  heroSub: "在提示词里写清场景和绘画风格，再打开生成器生成片段。",
  promptPlaceholder: "描述你想要的场景和绘画风格…",
  ctaLabel: "打开生成器",
  whatTitle: "动漫风片段是怎么生成的",
  whatBody: [
    "模型会跟随你的提示词：先写清场景、角色和情绪，再描述绘画风格——线条、明暗和配色。风格来自文字描述，而不是某个预设选项。",
    "你也可以从现成的插画开始。上传一张动漫风图片，模型会以这一帧为起点，把它变成动态片段。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "写好场景",
      body: "镜头里有谁、发生在哪里、镜头怎么运动。",
    },
    {
      title: "描述绘画风格",
      body: "线条粗细、明暗处理和配色都会影响结果。每次生成都把风格词写进提示词。",
    },
    {
      title: "生成并微调",
      body: "打开生成器运行提示词，再调整措辞，直到片段符合设想。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "运动生动、场景细节丰富，支持生成音频",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: "Text, image",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "必须有一张插画才能开始吗？",
      a: "不需要。只写文字也可以。如果已经有插画，可以用图片生成视频把它变成动态画面，并保留这一帧作为开场。",
    },
    {
      q: "怎么得到想要的风格？",
      a: "用文字描述：线条风格、明暗、配色和细节程度。风格由提示词决定。",
    },
    {
      q: "同一个角色能出现在多个片段里吗？",
      a: "可以。参考图生视频会用参考图让角色或主体保持一致。",
    },
    {
      q: "应该先选哪个模型？",
      a: "想要更生动的运动并支持音频，选 Seedance 1.5 Pro；常规片段用 Seedance 1.0 Pro 系列即可。",
    },
    {
      q: "如果风格在片段之间漂移了怎么办？",
      a: "每次用同样的顺序重复风格词，并让每段提示词尽量简短具体。",
    },
  ],
  related: [
    {
      label: "让现成的插画动起来：图片生成视频",
      path: "/image-to-video",
    },
    {
      label: "保持角色一致：参考图生视频",
      path: "/reference-to-video",
    },
  ],
};

export const ZH_AI_CARTOON_VIDEO: SeoLandingContent = {
  path: "/ai-cartoon-video-generator",
  title: "AI 卡通视频生成器 — 轻松有趣的短片",
  description:
    "用 AI 卡通视频生成器制作轻松有趣的卡通片段：在提示词里写清角色和动作，再打开生成器开始创作。",
  h1: "AI 卡通视频生成器",
  heroSub: "描述角色、场景和动作，让模型生成卡通风格的片段。",
  promptPlaceholder: "描述你想要的卡通角色和动作…",
  ctaLabel: "打开生成器",
  whatTitle: "可以生成什么",
  whatBody: [
    "卡通风片段从一句简单的描述开始：画面里有谁、做什么、镜头怎么跟。模型会把这段描述变成明亮、手绘感的动态画面。",
    "如果希望同一个角色反复出现，尽量保持措辞一致。参考图生视频会用参考图让角色或主体保持稳定。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "设定角色",
      body: "用一两句话写清每个角色、穿着和场景。",
    },
    {
      title: "加入动作",
      body: "写清片段里发生了什么，以及镜头如何运动——横摇、推近或全景。",
    },
    {
      title: "生成并收紧提示词",
      body: "打开生成器运行提示词，如果模型理解有偏差就重新措辞。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "运动生动、场景细节丰富，支持生成音频",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: "Text, image",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "可以做什么样的片段？",
      a: "角色小片段、简单情节、产品吉祥物和场景铺垫——凡是能用一两句话描述清楚的都可以。",
    },
    {
      q: "同一个角色能在后面的片段里再次出现吗？",
      a: "可以。参考图生视频会用参考图让角色或主体保持一致。",
    },
    {
      q: "风格该怎么写？",
      a: "把画风写进提示词：粗描边、平涂色块、柔和明暗。措辞决定最终效果。",
    },
    {
      q: "需要绘画基础吗？",
      a: "不需要。可以只写文字，也可以用一张现成的插画作为起始帧。",
    },
    {
      q: "片段可以带声音吗？",
      a: "Seedance 1.5 Pro 支持生成音频，Seedance 1.0 Pro 系列生成无声片段。",
    },
  ],
  related: [
    {
      label: "保持角色一致：参考图生视频",
      path: "/reference-to-video",
    },
    {
      label: "让静态图片动起来：图片生成视频",
      path: "/image-to-video",
    },
  ],
};

export const ZH_AI_LOGO_ANIMATION: SeoLandingContent = {
  path: "/ai-logo-animation",
  title: "AI 标志动画 — 用一张标志图做出简单动效",
  description:
    "试试 AI 标志动画：上传一张标志图片，描述淡入、发光或旋转这类简单运动，再打开生成器生成片段。",
  h1: "AI 标志动画",
  heroSub: "上传标志图片，描述你想要的运动，看看模型生成的效果。",
  promptPlaceholder: "描述标志应该如何运动…",
  ctaLabel: "打开生成器",
  whatTitle: "这里的标志动画能做什么",
  whatBody: [
    "这个工具会用模型生成的运动让标志图片动起来：淡入、发光、缓慢旋转或推近。你描述动作，模型渲染片段。",
    "它适合快速试运动想法，并不能替代设计工具。模型可能会改变细节，所以使用前请仔细检查生成结果。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "上传标志图片",
      body: "用一张清晰、主体居中、背景简单的图片。",
    },
    {
      title: "描述简单的运动",
      body: "一次一个动作效果最好：淡入、发光、旋转或缓慢缩放。",
    },
    {
      title: "仔细检查结果",
      body: "核对片段里的文字和形状。如果细节发生变化，可以调整提示词，或者用原始素材完成最终版本。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "运动生动、场景细节丰富，支持生成音频",
      input: "Logo image, text",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: "Logo image, text",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: "Logo image, text",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "标志会完全保持不变吗？",
      a: "无法保证。模型可能会改动细节或文字，请对照原始素材检查生成的片段。",
    },
    {
      q: "什么运动效果比较稳？",
      a: "简单动作：淡入或揭幕、发光、轻微旋转、缓慢推近。复杂的连续动作更难保持干净。",
    },
    {
      q: "应该上传什么文件？",
      a: "背景干净、标志居中且清晰的图片。",
    },
    {
      q: "能直接得到可交付的文件吗？",
      a: "最终的收尾和导出建议在设计工具里完成，这样品牌素材和文字都完全可控。",
    },
    {
      q: "该选哪个模型？",
      a: "Seedance 1.5 Pro 运动更生动并支持音频；Seedance 1.0 Pro Fast 和 Seedance 1.0 Pro Quality 适合简单片段。",
    },
  ],
  related: [
    {
      label: "想让静态图片动起来：图片生成视频",
      path: "/image-to-video",
    },
    {
      label: "从文字开始：文字生成视频",
      path: "/text-to-video",
    },
  ],
};

export const ZH_AI_REAL_ESTATE_VIDEO: SeoLandingContent = {
  path: "/ai-real-estate-video-generator",
  title: "AI 房产视频生成器 — 用一张照片生成短片",
  description:
    "用 AI 房产视频生成器把一张房源照片变成动态片段：描述缓慢推近或平移镜头，再打开生成器开始创作。",
  h1: "AI 房产视频生成器",
  heroSub: "上传一张房源照片，描述缓慢的运镜，生成推近或漫游感的短片。",
  promptPlaceholder: "描述镜头应该如何运动…",
  ctaLabel: "打开生成器",
  whatTitle: "房源照片可以怎么用",
  whatBody: [
    "从一张房间或建筑的照片开始。描述运镜方式——缓慢推近、横向平移、向上抬起——模型会渲染出一段有漫游感的短片。",
    "片段是模型生成的动态画面，不是实拍。模型可能会补上原房间里并不存在的细节，请把它当作视觉起点，而不是房源的记录。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "挑选照片",
      body: "选一张清晰、光线均匀的广角照片。画面垂直、干净利落，模型能利用的信息更多。",
    },
    {
      title: "描述运镜",
      body: "客厅用缓慢推近，外立面用横向平移，建筑用短距离上抬。",
    },
    {
      title: "选择画幅",
      body: "16:9 适合房源页面和网站，9:16 适合竖屏社交内容。打开生成器运行提示词。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "运动生动、场景细节丰富，支持生成音频",
      input: "Property photo, text",
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: "Property photo, text",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: "Property photo, text",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "这算真实的看房视频吗？",
      a: "不算。片段是根据一张照片生成的动态画面，可能会加入房间里原本没有的细节，因此不要把它当作真实看房视频。",
    },
    {
      q: "应该上传什么照片？",
      a: "一张清晰的房源照片：房间广角、外立面或建筑外观。画面清晰、光线均匀的效果更好。",
    },
    {
      q: "应该用哪种画幅？",
      a: "房源页面、宣传资料和网站用 16:9；竖屏社交内容用 9:16。",
    },
    {
      q: "可以展示同一个房源的不同角度吗？",
      a: "可以。每个视角上传一张照片，并分别描述对应的运镜。",
    },
    {
      q: "该选哪个模型？",
      a: "想要更生动的运动并支持音频，选 Seedance 1.5 Pro；快速草稿用 Seedance 1.0 Pro Fast，细节优先用 Seedance 1.0 Pro Quality。",
    },
  ],
  related: [
    {
      label: "让任意静态照片动起来：图片生成视频",
      path: "/image-to-video",
    },
    {
      label: "想让照片动起来？看看「让照片动起来」",
      path: "/animate-image-ai",
    },
  ],
};
