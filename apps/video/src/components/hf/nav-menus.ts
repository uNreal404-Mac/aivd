// The top-nav dropdown menus: features and models per section. Shared by the
// nav and the site search, which builds them in both languages.
import {
  AudioLines,
  BookOpen,
  Brush,
  Clapperboard,
  Eraser,
  Expand,
  FastForward,
  Film,
  Folder,
  Image as ImageIcon,
  ImagePlus,
  Languages,
  Layers,
  LayoutGrid,
  Mic,
  Music,
  Orbit,
  ScanFace,
  Sparkles,
  SunMedium,
  Tv,
  UserRound,
  Users,
  Volume2,
  Wand2,
  Workflow,
  ZoomIn,
  type LucideIcon,
} from "lucide-react";

import { MARKET_MODELS } from "@/ai/kie-market";
import { NAV_AUDIO_MODELS, NAV_IMAGE_MODELS, NAV_VIDEO_MODELS, navModelHref, type NavModelKind } from "@/lib/nav-models";

/** One row in a dropdown: icon tile, title and a one-line description. */
export type DropItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
  /** Omitted for features that are not live yet; those render greyed out. */
  href?: string;
  badge?: "hot" | "new";
  /** Linked, but generation is not connected yet: show a small tag. */
  soon?: boolean;
  /** Extra label after the title, e.g. "4K". */
  tag?: string;
};
export type DropColumn = { title: string; items: DropItem[] };
export type Dropdown = {
  id: string;
  label: string;
  /** Landing page of the section; the top-level item links here. */
  path: string;
  /** Routes that belong to the section, for the active state and the tab strip. */
  routes: string[];
  columns: DropColumn[];
};

// Models that can generate today; every other listed model is coming soon.
export const LIVE_MODEL_IDS = ["veo-3.1", "wan2.6", ...MARKET_MODELS.map((model) => model.id)];

export function modelIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.startsWith("seedance") || n.startsWith("minimax")) return Clapperboard;
  if (n.startsWith("kling") || n.startsWith("happyhorse")) return Film;
  if (n.startsWith("wan") || n.startsWith("flux") || n.startsWith("recraft")) return Orbit;
  if (n.startsWith("gpt") || n.startsWith("nano") || n.startsWith("seedream")) return ImageIcon;
  if (n.startsWith("eleven") || n.startsWith("seed ") || n.startsWith("qwen") || n.includes("speech")) return AudioLines;
  return Sparkles;
}

/** The nav dropdowns in one language. Search builds both, to match either. */
export function buildDropdowns(zh: boolean): Dropdown[] {
  // Model rows: every model links to its studio with the model selected.
  const modelItems = (kind: NavModelKind): DropItem[] =>
    (kind === "image" ? NAV_IMAGE_MODELS : kind === "video" ? NAV_VIDEO_MODELS : NAV_AUDIO_MODELS).map((model) => ({
      title: model.name,
      desc: zh ? model.desc.zh : model.desc.en,
      icon: modelIcon(model.name),
      href: navModelHref(kind, model.id),
      badge: model.badge,
      tag: model.tag,
      soon: !LIVE_MODEL_IDS.includes(model.id),
    }));

  // Only pages that exist get a link. Everything else is listed so visitors
  // can see what is coming, but it is greyed out and not clickable.
  return [
    {
      id: "image",
      label: zh ? "图像" : "Image",
      path: "/ai/image",
      routes: ["/ai/image", "/image"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "创建图像" : "Create image", desc: zh ? "用文字生成 AI 图像" : "Generate AI images from text", icon: ImageIcon, href: "/ai/image" },
            { title: zh ? "图片转视频" : "Image to video", desc: zh ? "让一张静态图片动起来" : "Bring a still image to life", icon: ImagePlus, href: "/image-to-video", badge: "hot" },
            { title: zh ? "编辑图像" : "Edit image", desc: zh ? "用一句话修改图片内容" : "Change an image with one sentence", icon: Layers },
            { title: zh ? "局部重绘" : "Inpaint", desc: zh ? "选中区域，描述修改内容" : "Select an area and describe the change", icon: Brush },
            { title: zh ? "重新打光" : "Relight", desc: zh ? "调整光源位置、颜色和亮度" : "Move the light, change its colour and strength", icon: SunMedium },
            { title: zh ? "背景去除" : "Remove background", desc: zh ? "一键抠出主体" : "Cut out the subject in one click", icon: Eraser },
            { title: zh ? "图像高清放大" : "Upscale image", desc: zh ? "提升图像清晰度" : "Sharpen and enlarge images", icon: ZoomIn },
            { title: zh ? "图片扩展" : "Expand image", desc: zh ? "向画面外延展内容" : "Extend the picture beyond its edges", icon: Expand },
          ],
        },
        {
          title: zh ? "模型" : "Models",
          items: modelItems("image"),
        },
      ],
    },
    {
      id: "video",
      label: zh ? "视频" : "Video",
      path: "/ai/video",
      routes: ["/ai/video", "/video", "/text-to-video", "/image-to-video", "/reference-to-video"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "创建视频" : "Create video", desc: zh ? "在视频工作室里生成和管理视频" : "Generate and manage clips in the studio", icon: Film, href: "/ai/video", badge: "hot" },
            { title: zh ? "文生视频" : "Text to video", desc: zh ? "一句话描述，直接生成视频" : "Describe it and get a video", icon: Clapperboard, href: "/text-to-video" },
            { title: zh ? "图生视频" : "Image to video", desc: zh ? "以图片为起始帧生成视频" : "Use an image as the first frame", icon: ImagePlus, href: "/image-to-video" },
            { title: zh ? "参考生视频" : "Reference to video", desc: zh ? "用多张参考图锁定人物和风格" : "Lock characters and style with references", icon: Layers, href: "/reference-to-video" },
            { title: zh ? "AI 视频特效" : "AI video effects", desc: zh ? "热门特效模板，一键套用" : "Trending effect templates in one click", icon: Wand2, href: "/effects" },
            { title: zh ? "AI 数字人" : "AI avatar", desc: zh ? "让数字人开口说话" : "Make an avatar talk", icon: UserRound },
            { title: zh ? "动作模仿" : "Motion mimic", desc: zh ? "把参考视频的动作迁移到人物上" : "Copy motion from a reference clip", icon: ScanFace },
            { title: zh ? "视频延长" : "Extend video", desc: zh ? "让视频继续往下播" : "Continue a clip past its end", icon: FastForward },
            { title: zh ? "视频画质提升" : "Upscale video", desc: zh ? "提升视频清晰度" : "Sharpen and enlarge video", icon: ZoomIn },
          ],
        },
        {
          title: zh ? "模型" : "Models",
          items: modelItems("video"),
        },
      ],
    },
    {
      id: "audio",
      label: zh ? "音频" : "Audio",
      path: "/audio",
      routes: ["/audio"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "文本转语音" : "Text to speech", desc: zh ? "把脚本读成自然的人声" : "Turn a script into a natural voice", icon: AudioLines, href: "/audio?voiceMode=voiceover", badge: "new" },
            { title: zh ? "音乐与音效" : "Music & sound", desc: zh ? "一句话生成歌曲和音效" : "Songs and sound effects from one line", icon: Music, href: "/audio?voiceMode=music", badge: "new" },
            { title: zh ? "变声" : "Voice changer", desc: zh ? "把一段声音换成另一种音色" : "Swap a recording into another voice", icon: Mic, href: "/audio?voiceMode=change-voice", soon: true },
            { title: zh ? "翻译" : "Translate", desc: zh ? "把配音翻译成其他语言" : "Translate a voiceover into other languages", icon: Languages, href: "/audio?voiceMode=translate", soon: true },
            { title: zh ? "视频原生音效" : "Native video sound", desc: zh ? "Veo 3.1 生成画面时同步生成声音" : "Veo 3.1 renders sound with the picture", icon: Volume2, href: "/models/veo-3-1", badge: "hot" },
          ],
        },
        {
          title: zh ? "模型" : "Models",
          items: modelItems("audio"),
        },
      ],
    },
    {
      id: "creative",
      label: zh ? "创作空间" : "Creative Space",
      path: "/creative-space",
      routes: ["/creative-space", "/ai-canvas"],
      columns: [
        {
          title: zh ? "功能" : "Features",
          items: [
            { title: zh ? "创作空间" : "Creative Space", desc: zh ? "说出想法，Agent 拆成镜头再生成" : "Say the idea; the agent plans the shots", icon: Sparkles, href: "/creative-space", badge: "new" },
            { title: zh ? "AI 画布" : "AI canvas", desc: zh ? "节点连线，串联文本、图片、视频和音频生成" : "Wire nodes to chain text, image, video and audio", icon: Workflow, href: "/ai-canvas", badge: "new" },
            { title: zh ? "画布" : "Canvas", desc: zh ? "在画布上整理素材，用 @ 交给 Agent" : "Arrange assets and @-mention them to the agent", icon: LayoutGrid, href: "/creative-space/canvas" },
            { title: zh ? "视频工作室" : "Video studio", desc: zh ? "选模型、调参数、批量生成" : "Pick a model, tune settings, generate", icon: Film, href: "/ai/video" },
            { title: zh ? "我的作品" : "My creations", desc: zh ? "查看和下载生成的视频" : "Find and download your videos", icon: Folder, href: "/my-creations" },
          ],
        },
        {
          title: zh ? "即将推出" : "Coming next",
          items: [
            { title: zh ? "AI 故事视频" : "AI story video", desc: zh ? "一段剧本生成多场景故事" : "A script becomes a multi-scene story", icon: BookOpen },
            { title: zh ? "AI 短剧" : "AI short drama", desc: zh ? "按集生成连续剧情" : "Generate a series episode by episode", icon: Tv },
            { title: zh ? "情绪板" : "Moodboard", desc: zh ? "把参考素材整理成统一风格" : "Turn references into one look", icon: Layers },
          ],
        },
      ],
    },
    {
      id: "templates",
      label: zh ? "模板" : "Templates",
      path: "/templates",
      routes: ["/templates", "/effects"],
      columns: [
        {
          title: zh ? "模板" : "Templates",
          items: [
            { title: zh ? "全部模板" : "All templates", desc: zh ? "挑一个模板，提示词一键带入" : "Pick one and its prompt loads for you", icon: LayoutGrid, href: "/templates" },
            { title: zh ? "故事视频" : "Story video", desc: zh ? "有情节、有人物的短片" : "Short clips with characters and plot", icon: BookOpen, href: "/templates#tpl-story" },
            { title: zh ? "动态创作" : "Motion", desc: zh ? "自然、粒子和舞蹈的动态画面" : "Nature, particles and dance in motion", icon: Orbit, href: "/templates#tpl-motion" },
            { title: zh ? "创意重构" : "Recast", desc: zh ? "科幻、奇幻和超现实场景" : "Sci-fi, fantasy and surreal scenes", icon: Wand2, href: "/templates#tpl-recast" },
          ],
        },
        {
          title: zh ? "灵感" : "Inspiration",
          items: [
            { title: zh ? "特效模板" : "Effect templates", desc: zh ? "热门视频特效" : "Trending video effects", icon: Sparkles, href: "/effects", badge: "hot" },
            { title: zh ? "社区画廊" : "Community gallery", desc: zh ? "看看大家都在做什么" : "See what others are making", icon: Users, href: "/gallery" },
          ],
        },
      ],
    },
  ];
}
