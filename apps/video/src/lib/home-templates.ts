// Idea starters shown under the homepage generator. Each one pairs a site
// sample image with a prompt the visitor can drop into the generator. The
// images are illustrative samples, not outputs of these exact prompts, so the
// UI calls them ideas rather than results.

export type HomeTemplateCategory = "story" | "motion" | "recast";

export type HomeTemplate = {
  id: string;
  category: HomeTemplateCategory;
  image: string;
  title: { zh: string; en: string };
  prompt: { zh: string; en: string };
  aspect: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
};

export const HOME_TEMPLATE_CATEGORIES: {
  id: HomeTemplateCategory;
  zh: string;
  en: string;
}[] = [
  { id: "story", zh: "故事视频", en: "Story video" },
  { id: "motion", zh: "动态创作", en: "Motion" },
  { id: "recast", zh: "创意重构", en: "Recast" },
];

const template = (
  category: HomeTemplateCategory,
  id: string,
  title: [string, string],
  prompt: [string, string],
  aspect: HomeTemplate["aspect"] = "16:9",
): HomeTemplate => ({
  id,
  category,
  image: `/home/samples/${id}.webp`,
  title: { zh: title[0], en: title[1] },
  prompt: { zh: prompt[0], en: prompt[1] },
  aspect,
});

export const HOME_TEMPLATES: HomeTemplate[] = [
  template("story", "boy-and-dog", ["雨夜街角", "Rainy Street Corner"], [
    "雨夜的街角，一个男孩和他的小狗站在路灯下等待，镜头缓慢推近，湿润的路面映出暖色灯光，电影感，浅景深。",
    "A boy and his dog wait under a streetlight on a rainy street corner at night. Slow push-in, warm light reflecting on wet pavement, cinematic, shallow depth of field.",
  ]),
  template("story", "autumn-walk", ["秋日同行", "Autumn Walk"], [
    "两个人并肩走在落叶铺满的林荫道上，逆光，金色的树叶缓缓飘落，镜头从身后平稳跟随，温暖的秋日色调。",
    "Two people walk side by side down a tree-lined path covered in fallen leaves. Backlit, golden leaves drifting down, steady follow shot from behind, warm autumn tones.",
  ]),
  template("story", "rain-couple", ["雨中重逢", "Reunion in the Rain"], [
    "大雨中的街道，两个人在人群里认出彼此，停下脚步，镜头环绕半圈，霓虹灯在雨幕里晕开，情绪克制。",
    "On a street in heavy rain, two people recognise each other in the crowd and stop. Half-orbit camera move, neon lights blooming through the rain, restrained emotion.",
  ]),
  template("story", "mountain-wind", ["山顶的风", "Wind on the Summit"], [
    "一个人站在山顶，风吹动衣角和头发，远处云层翻涌，镜头从近景缓缓拉远成大全景，清晨的冷色光线。",
    "A lone figure stands on a summit as wind pulls at their clothes and hair, clouds rolling in the distance. Slow pull-back from close-up to wide shot, cool early-morning light.",
  ]),
  template("motion", "cosmic-bloom", ["星云绽放", "Cosmic Bloom"], [
    "深空中一团星云像花朵一样缓缓绽放，粒子向外扩散，色彩由深蓝过渡到品红，镜头缓慢向前穿行。",
    "A nebula slowly blooms like a flower in deep space, particles spreading outward, colour shifting from deep blue to magenta, the camera drifting forward through it.",
  ]),
  template("motion", "mountain-valley", ["云海山谷", "Valley of Clouds"], [
    "航拍视角飞越山谷，云海在山峰之间流动，阳光穿过云层形成光束，镜头平稳向前，延时摄影质感。",
    "Aerial flight over a mountain valley as a sea of clouds flows between the peaks, sunbeams breaking through. Smooth forward motion with a time-lapse feel.",
  ]),
  template("motion", "storm-sea", ["风暴之海", "Storm Sea"], [
    "风暴中的大海，巨浪翻涌拍击礁石，闪电照亮乌云，低机位镜头随海浪起伏，冷峻的蓝灰色调。",
    "A sea in a storm, huge waves crashing against rocks while lightning lights the clouds. Low camera rising and falling with the swell, cold blue-grey palette.",
  ]),
  template("motion", "dancer", ["舞者", "Dancer"], [
    "一位舞者在空旷的舞台上旋转起舞，衣摆随动作展开，一束侧光勾勒出轮廓，镜头缓慢环绕，慢动作。",
    "A dancer spins across an empty stage, fabric flaring with each movement, a single side light tracing the silhouette. Slow orbiting camera, slow motion.",
  ], "9:16"),
  template("recast", "planet-impact", ["星球撞击", "Planet Impact"], [
    "两颗行星在太空中缓慢相撞，碎片和熔岩向四周飞散，冲击波扩散，镜头缓慢环绕，史诗感的科幻画面。",
    "Two planets collide slowly in space, debris and molten rock scattering outward as a shockwave spreads. Slow orbiting camera, epic science-fiction scale.",
  ]),
  template("recast", "tomb-light", ["古墓之光", "Light in the Tomb"], [
    "探险者举着火把走进古老的墓室，光线照亮墙上的壁画，尘埃在光束中漂浮，镜头跟随向前，悬疑氛围。",
    "An explorer carries a torch into an ancient tomb chamber, light revealing murals on the walls and dust floating in the beam. Follow shot moving forward, suspenseful mood.",
  ]),
  template("recast", "mech-warrior", ["机甲战士", "Mech Warrior"], [
    "一台巨型机甲在废墟城市中站起，金属关节发出光芒，烟尘散开，低角度仰拍，镜头缓慢上移。",
    "A giant mech rises to its feet in a ruined city, metal joints glowing as smoke clears. Low-angle shot with the camera slowly tilting up.",
  ]),
  template("recast", "dreaming", ["梦境", "Dreaming"], [
    "一个人漂浮在柔和的云层之间，周围的物体缓慢失重上升，光线柔和梦幻，镜头轻轻旋转，超现实风格。",
    "A person floats among soft clouds while objects around them drift upward, weightless. Gentle dreamy light, slowly rotating camera, surreal style.",
  ]),
];

export function templatesFor(category: HomeTemplateCategory): HomeTemplate[] {
  return HOME_TEMPLATES.filter((item) => item.category === category);
}
