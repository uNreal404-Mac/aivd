export type ModelStatus = "available" | "coming-soon";
export interface SeoLink { label: string; path: string } // path WITHOUT locale prefix, starts with "/"
export interface SeoFeature { title: string; body: string }
export interface SeoModelRow { name: string; status: ModelStatus; modes: string; notes: string }
export interface SeoUseCase { title: string; body: string }
export interface SeoStep { title: string; body: string }
export interface SeoFaq { q: string; a: string }
export interface AiVideoGeneratorContent {
  meta: { title: string; description: string }; // title <= 60 chars, description <= 155 chars, both contain the keyword
  breadcrumb: { home: string; current: string };
  hero: { eyebrow: string; h1: string; intro: string[]; ctaLabel: string; ctaNote: string; secondaryCta: SeoLink };
  overview: { heading: string; paragraphs: string[] };
  features: { heading: string; intro: string; items: SeoFeature[] };
  models: {
    heading: string; intro: string;
    columns: { model: string; status: string; modes: string; notes: string };
    statusLabels: Record<ModelStatus, string>;
    rows: SeoModelRow[];
    footnote: string;
  };
  pricing: { heading: string; paragraphs: string[]; tableCaption: string; columns: { duration: string; credits: string }; link: SeoLink };
  useCases: { heading: string; intro: string; items: SeoUseCase[] };
  steps: { heading: string; intro: string; items: SeoStep[] };
  tips: { heading: string; intro: string; items: string[] };
  faq: { heading: string; items: SeoFaq[] };
  related: { heading: string; links: SeoLink[] };
  finalCta: { heading: string; body: string; ctaLabel: string };
}

export const aiVideoGeneratorEn: AiVideoGeneratorContent = {
  meta: {
    title: "AI Video Generator — Text & Image to Video | aivd.ai",
    description:
      "Generate videos with the AI Video Generator on aivd.ai: Seedance 1.5 Pro text-to-video and image-to-video, 4–12 s clips, six aspect ratios, 720p output.",
  },
  breadcrumb: {
    home: "Home",
    current: "AI Video Generator",
  },
  hero: {
    eyebrow: "Seedance 1.5 Pro is live on aivd.ai",
    h1: "AI Video Generator for Text-to-Video and Image-to-Video",
    intro: [
      "Describe a scene, or upload a still image and describe how it should move. The aivd.ai AI Video Generator turns that into a finished clip you can play and download.",
      "Seedance 1.5 Pro is the model running today. Choose 4 to 12 seconds, one of six aspect ratios, and get the result back at 720p.",
      "Nothing to install and no timeline to learn: write the prompt, pick your settings, generate, then collect the file from My Creations on your account.",
    ],
    ctaLabel: "Open the AI video generator",
    ctaNote:
      "Sign in first with Google or an email magic link. Credits are bought on the Pricing page.",
    secondaryCta: { label: "Start from a written prompt instead", path: "/text-to-video" },
  },
  overview: {
    heading: "What an AI Video Generator actually does",
    paragraphs: [
      "An AI Video Generator turns a written description into a moving clip. On aivd.ai the model doing that work is Seedance 1.5 Pro. You give it either a prompt that describes the scene, the subject and the camera movement, or a still image plus a prompt that describes how that image should move. The AI Video Generator then renders the shot in the background: you watch progress on the page, and the finished video plays as soon as it is ready. Everything that matters — duration, aspect ratio and resolution — is decided before you press generate, so there are no surprises afterwards.",
      "Text-to-video and image-to-video ask for different kinds of prompts. With text-to-video you are inventing the whole frame, so describe the subject, the setting, the light and what the camera does in one or two clear sentences. With image-to-video the first frame already exists, so your prompt should focus on motion: what moves, in which direction, and how fast. This AI Video Generator follows motion descriptions far more reliably than long lists of adjectives, so keep image prompts short and physical rather than poetic.",
      "Duration and aspect ratio decide more about the result than most people expect. A four or five second clip suits a single action — a product turning, a face turning toward the light. Longer options such as eight, ten or twelve seconds give a shot room to develop, but they also ask for a simpler idea, because too many beats in one clip become hard to read. Aspect ratio should follow the destination rather than the other way round: 16:9 for landscape players, 9:16 for vertical feeds, 1:1 for square posts, and 4:3, 3:4 or 21:9 when the frame needs to be squarer, taller or wider. Output is 720p by default.",
      "You need an account before the AI Video Generator will run, because every render is tied to your credit balance and to your library. Sign in with Google or with an email magic link, buy credits on the Pricing page, then generate. If a render fails, the reserved credits come back automatically, and if you submit the same request twice in a short window you are charged once. Finished clips land in My Creations, where you can replay them, compare takes and download the file whenever you need it.",
    ],
  },
  features: {
    heading: "What you get with the aivd.ai AI Video Generator",
    intro:
      "Six things the current release does, written down plainly so you know exactly what you are working with.",
    items: [
      {
        title: "Text-to-video from a written prompt",
        body: "Type what you want to see and the model builds the shot from scratch: subject, setting, light and camera movement all come from your words. It suits concept shots, mood pieces and quick visual ideas that do not exist as photographs yet. Keep the description concrete and limit it to one clear beat.",
      },
      {
        title: "Image-to-video from your own upload",
        body: "Upload a still image — a photo, a product render, an illustration — and describe the motion you want. The first frame stays recognisably yours while the model animates what comes next. JPG, PNG and WebP style stills all work well, and only images you upload yourself can be used in your clips.",
      },
      {
        title: "Six aspect ratios for any placement",
        body: "Choose 16:9, 9:16, 1:1, 4:3, 3:4 or 21:9 before you generate. Vertical 9:16 fits short-form feeds, 16:9 fits landscape players and presentations, 1:1 fits square placements, and the 21:9 frame gives a wide look without cropping afterwards.",
      },
      {
        title: "Durations from 4 to 12 seconds",
        body: "Pick 4, 5, 6, 8, 10 or 12 seconds. Short durations are cheap to test and easy to loop; longer ones let a single camera move breathe. Because duration is what drives the credit cost, starting short and extending only the ideas that work is the most economical way to explore.",
      },
      {
        title: "Progress you can watch, files you can keep",
        body: "Rendering runs asynchronously, so the page shows progress instead of leaving you guessing. When the clip is done it plays inline, and a copy is stored in My Creations on your account. From there you can replay it, compare takes and download the file whenever you need it.",
      },
      {
        title: "Credit handling that behaves fairly",
        body: "Credits are reserved when you submit and returned automatically if the render fails, so a broken job never costs you anything. Duplicate protection means a double click or a repeated submission within a short window is charged once. Your balance lives with your account rather than with a single browser session.",
      },
    ],
  },
  models: {
    heading: "Models available in the AI Video Generator",
    intro:
      "One model is live on aivd.ai today. The others are listed so you can see what is planned, and each one is marked honestly rather than left to guesswork.",
    columns: {
      model: "Model",
      status: "Status",
      modes: "Modes",
      notes: "Notes",
    },
    statusLabels: {
      available: "Available",
      "coming-soon": "Coming soon",
    },
    rows: [
      {
        name: "Seedance 1.5 Pro",
        status: "available",
        modes: "Image to video, Text to video",
        notes:
          "Live now. Durations of 4, 5, 6, 8, 10 and 12 seconds; aspect ratios 16:9, 9:16, 1:1, 4:3, 3:4 and 21:9; 720p output.",
      },
      {
        name: "Veo 3.1",
        status: "coming-soon",
        modes: "—",
        notes: "Not available on aivd.ai yet. Planned for a future release.",
      },
      {
        name: "Sora 2",
        status: "coming-soon",
        modes: "—",
        notes: "Not available on aivd.ai yet. Planned for a future release.",
      },
      {
        name: "Wan 2.6",
        status: "coming-soon",
        modes: "—",
        notes: "Not available on aivd.ai yet. Planned for a future release.",
      },
      {
        name: "Seedance 1.0 Pro Fast",
        status: "coming-soon",
        modes: "—",
        notes: "Not available on aivd.ai yet. Planned for a future release.",
      },
      {
        name: "Seedance 1.0 Pro Quality",
        status: "coming-soon",
        modes: "—",
        notes: "Not available on aivd.ai yet. Planned for a future release.",
      },
    ],
    footnote:
      "Only the Seedance 1.5 Pro row is live. Anything marked coming soon cannot be selected in the generator yet, and no launch dates are promised on this page.",
  },
  pricing: {
    heading: "What a clip costs in credits",
    paragraphs: [
      "Every render is priced from its duration. Seedance 1.5 Pro costs 4 credits per second at 720p, so a 4-second 720p clip costs 16 credits. The table below is calculated from the current credit configuration rather than typed by hand, which means the number you read here is the number the generator reserves when you submit.",
      "Credits are bought in advance on the Pricing page and stay attached to your account. If a generation fails, the reserved credits are returned automatically, and submitting the same request twice within a short window does not charge twice. Starting with a few short clips is the cheapest way to learn how the model responds before you commit to longer durations.",
    ],
    tableCaption: "Credit cost per duration at 720p",
    columns: {
      duration: "Duration",
      credits: "Credits",
    },
    link: { label: "Buy credits on the Pricing page", path: "/pricing" },
  },
  useCases: {
    heading: "What you can make with it",
    intro:
      "These are the jobs the current model handles comfortably. Each one is built around a single shot rather than a whole edit.",
    items: [
      {
        title: "Vertical social clips",
        body: "A 9:16 clip of one action — a product turn, a pour, a step, a reveal — is a natural fit. Because the model animates one idea at a time, short vertical shots read better than busy scenes, and 720p output is enough for feed playback on a phone.",
      },
      {
        title: "Product teasers",
        body: "Upload a clean product photo, then describe a slow rotation, a light sweep or a gentle push-in. Image-to-video keeps the product recognisable while adding movement a still photograph cannot show, which makes it useful for landing pages, listings and short announcements.",
      },
      {
        title: "Storyboards and pre-visualisation",
        body: "Short generated clips are a quick way to test whether a shot idea reads on screen before anyone builds a set. Twelve seconds is long enough for a camera move and short enough to discard without regret, and the six aspect ratios let you preview the frame in the shape it will be shot.",
      },
      {
        title: "Bringing artwork and photos to life",
        body: "Illustrations, posters, old family photos and concept art all benefit from gentle motion: drifting clouds, a turning head, shifting light. Keep the movement small and physically plausible, because the first frame is preserved and large motion can pull the image away from what made it worth animating.",
      },
      {
        title: "Teaching and explainer shots",
        body: "A short loop of a mechanism turning, a diagram settling into place or a process step in motion can carry an explanation better than another paragraph. Because each clip covers one beat, explainers are usually assembled as a sequence of short generations rather than one long one.",
      },
      {
        title: "Recaps from a handful of photos",
        body: "Take the best stills from a trip, an event or a shoot and give each one a few seconds of motion. Generate the clips separately, then trim them together in any editor, and you have a recap that moves without needing footage that was never captured in the first place.",
      },
    ],
  },
  steps: {
    heading: "How to generate your first clip",
    intro: "Three steps, in the order the interface asks for them.",
    items: [
      {
        title: "Upload an image or write a prompt",
        body: "Choose image-to-video and upload a still, or choose text-to-video and start from words. For image-to-video, pick a sharp, well-lit file where the subject is clearly separated from the background, then write one or two sentences about motion: what moves, in which direction, how fast. For text-to-video, describe the subject, the setting, the light and the camera in the same short paragraph.",
      },
      {
        title: "Choose duration, aspect ratio and resolution",
        body: "Pick a duration between 4 and 12 seconds and one of the six aspect ratios. Match the ratio to where the clip will live rather than cropping later: 9:16 for phones held upright, 16:9 for landscape, 1:1 for square placements, 21:9 for a wide frame. Output resolution is 720p by default, and the duration you choose sets the credit cost shown before you submit.",
      },
      {
        title: "Generate, watch progress and download",
        body: "Press generate and the job runs asynchronously while the page shows progress. The finished clip plays inline when it is ready and is saved to My Creations on your account. Review it there, download the file, and if the result is not what you wanted, adjust the prompt or shorten the duration and run it again. Failed jobs return their credits automatically.",
      },
    ],
  },
  tips: {
    heading: "Prompt and settings tips",
    intro:
      "Small changes to wording and settings usually matter more than switching models.",
    items: [
      "Describe motion, not mood. 'The camera pushes slowly toward the window while the curtain lifts' gives the model something to animate; 'beautiful, cinematic, stunning' does not. Keep adjectives few and let the verb lead the sentence.",
      "Keep one shot per clip. A single camera move or a single action fits comfortably in four to twelve seconds. If your idea needs a cut, generate two clips and join them in an editor instead of describing both in one prompt.",
      "Choose the aspect ratio first. Decide where the video will be published before you write anything. Cropping a 16:9 render into a vertical frame loses the edges you composed, while generating in 9:16 from the start keeps the subject where you placed it.",
      "Start with the shortest duration that works. Four or five seconds is enough to test an idea and costs the least. Once a prompt behaves, regenerate at 8, 10 or 12 seconds for the version you actually publish.",
      "Prepare images the way you would for print. Use a sharp, evenly lit still, keep the subject clear of the frame edges, and avoid heavy filters. The model animates from that first frame, so any blur or noise at the start carries straight into the clip.",
      "Change one variable at a time. If a clip disappoints, adjust either the prompt or a setting, not both. Otherwise you cannot tell which change helped, and you end up guessing instead of learning how the model responds.",
    ],
  },
  faq: {
    heading: "Frequently asked questions",
    items: [
      {
        q: "What is an AI video generator?",
        a: "An AI video generator is a tool that produces a video clip from a written description, from a still image, or from both. You describe what should happen and the model renders the frames. On aivd.ai the AI Video Generator runs Seedance 1.5 Pro, renders asynchronously, shows progress, and saves the finished clip to your library.",
      },
      {
        q: "Which models can I use on aivd.ai?",
        a: "One model is live: Seedance 1.5 Pro, from ByteDance, in image-to-video and text-to-video modes. Veo 3.1, Sora 2, Wan 2.6, Seedance 1.0 Pro Fast and Seedance 1.0 Pro Quality are listed as coming soon and cannot be selected yet. The models table on this page is updated as that list changes.",
      },
      {
        q: "What is the difference between image-to-video and text-to-video?",
        a: "Text-to-video builds the whole shot from your prompt, including the first frame. Image-to-video starts from a still image you upload and animates it according to your motion prompt, so the opening frame is exactly your picture. Both modes are available with Seedance 1.5 Pro on aivd.ai.",
      },
      {
        q: "How long can a generated clip be?",
        a: "Seedance 1.5 Pro offers 4, 5, 6, 8, 10 and 12 second durations on aivd.ai. Shorter durations cost fewer credits and are useful for testing an idea; longer ones give a single camera move more room. Duration is chosen before you generate, and it sets the credit cost for that run.",
      },
      {
        q: "Which aspect ratios are supported?",
        a: "Six: 16:9, 9:16, 1:1, 4:3, 3:4 and 21:9. Vertical 9:16 suits short-form feeds, 16:9 suits landscape players, 1:1 works for square placements, and 21:9 gives a wide frame. Choosing the right ratio before generating avoids losing composition to a later crop.",
      },
      {
        q: "What resolution are the finished videos?",
        a: "Output resolution is 720p by default with Seedance 1.5 Pro. That is a practical size for feed playback on phones and for previewing shots before a final edit. You do not have to configure it on every run, because it is the standard output of the current setup.",
      },
      {
        q: "How many credits does a video cost?",
        a: "Seedance 1.5 Pro costs 4 credits per second at 720p, so a 4-second 720p clip costs 16 credits. The pricing table on this page is calculated from the live credit configuration, so the number shown for each duration is what the generator reserves when you submit.",
      },
      {
        q: "What happens if a generation fails?",
        a: "The credits reserved for that job are returned to your balance automatically. You do not need to contact support or open a ticket to get them back; the reservation is reversed when the job fails. You can then adjust your prompt or settings and submit again, paying only for the new attempt.",
      },
      {
        q: "Am I charged twice if I click generate twice?",
        a: "No. Duplicate protection means the same request submitted twice within a short window is charged once. If you change the prompt or a setting, that counts as a new request and is priced normally. Clicking generate once and waiting for the progress indicator is all you need to do.",
      },
      {
        q: "Do I need an account to generate a video?",
        a: "Yes. You sign in with Google or with an email magic link, and your credits and finished clips are tied to that account. An account is what makes the library, the download links and the credit balance persist between visits and between devices, rather than living in a single browser session.",
      },
      {
        q: "Where are my finished videos saved?",
        a: "Finished clips go to My Creations on your account as soon as the render completes. You can open the library at any time to replay a clip, compare takes or download a file. The clip also plays inline on the generator page right after generation, so you can judge it without leaving the page.",
      },
      {
        q: "Can I download the videos I generate?",
        a: "Yes. Each finished clip in My Creations can be downloaded to your device. Downloading does not use additional credits; it only moves the file you have already paid for. If you plan to edit several clips together, download them all first so your editing software works with local files.",
      },
      {
        q: "Can I upload my own image, and who can see it?",
        a: "Yes, image-to-video is built for your own uploads: a JPG, PNG or WebP style still works. Uploads are tied to your account: your clips can only use images you uploaded yourself, and other users cannot pick your uploads for their generations. Please only upload files you have the right to use.",
      },
      {
        q: "How do I write a better prompt?",
        a: "Name the subject, the setting and the motion in one or two sentences, then stop. Put the camera instruction in plain language — push in, pan left, hold steady — and describe one action rather than a sequence. For image-to-video, describe what should move inside the picture you supplied instead of describing the picture itself.",
      },
      {
        q: "Can I use the models marked coming soon?",
        a: "Not yet. Veo 3.1, Sora 2, Wan 2.6, Seedance 1.0 Pro Fast and Seedance 1.0 Pro Quality appear in the models table so you can see what is planned, but they cannot be selected in the generator. Seedance 1.5 Pro is the only live model, and this page is updated when that changes.",
      },
      {
        q: "Does it work on a phone?",
        a: "Yes. The site runs in a mobile browser, so you can upload a photo from your camera roll, write a prompt and start a generation on a phone. The layout is built for narrow screens as well as wide ones, and the finished clip plays inline wherever you started the job.",
      },
      {
        q: "Which languages is the interface available in?",
        a: "The aivd.ai interface is available in English and Simplified Chinese. Switching language changes the interface text; it does not change the model, the settings available or the credit cost. Changing language does not affect clips already saved in your library.",
      },
      {
        q: "How do I get credits?",
        a: "Credits are purchased on the Pricing page and stay attached to your account once bought. Choose what you need there, complete the purchase and return to the generator with the balance already updated. There is no way to generate without credits, so buying before your first render is the smoothest path.",
      },
    ],
  },
  related: {
    heading: "Keep exploring",
    links: [
      { label: "Text to video", path: "/text-to-video" },
      { label: "Image to video", path: "/image-to-video" },
      { label: "Seedance 1.5 Pro model details", path: "/models/seedance-1-5-pro" },
      { label: "Pricing and credits", path: "/pricing" },
      { label: "My Creations", path: "/my-creations" },
    ],
  },
  finalCta: {
    heading: "Generate your first AI video clip",
    body: "Seedance 1.5 Pro is live on aivd.ai. Sign in, pick image-to-video or text-to-video, choose your duration and aspect ratio, then let the AI Video Generator render the shot for you.",
    ctaLabel: "Start generating",
  },
};
