// Skills shown on the Creative Space entry page. A skill is a goal the
// visitor starts from: picking one loads its brief into the composer, and the
// canvas agent turns that brief into a shot plan and a generation prompt.
// Images are site samples that illustrate the mood, not outputs of the brief.

export type CreativeSkillCategory = "story" | "ads" | "social" | "cinematic";

export type CreativeSkill = {
  id: string;
  category: CreativeSkillCategory;
  image: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  brief: { zh: string; en: string };
};

export const CREATIVE_SKILL_CATEGORIES: { id: CreativeSkillCategory; zh: string; en: string }[] = [
  { id: "story", zh: "故事视频", en: "Story video" },
  { id: "ads", zh: "视频广告", en: "Video ads" },
  { id: "social", zh: "社交内容", en: "Social content" },
  { id: "cinematic", zh: "电影美学", en: "Cinematic looks" },
];

const skill = (
  category: CreativeSkillCategory,
  id: string,
  image: string,
  title: [string, string],
  description: [string, string],
  brief: [string, string],
): CreativeSkill => ({
  id,
  category,
  image,
  title: { zh: title[0], en: title[1] },
  description: { zh: description[0], en: description[1] },
  brief: { zh: brief[0], en: brief[1] },
});

export const CREATIVE_SKILLS: CreativeSkill[] = [
  skill(
    "story",
    "bedtime-story",
    "/home/samples/boy-and-dog.webp",
    ["睡前故事", "Bedtime story"],
    ["温柔的童话节奏，适合讲给孩子听的短篇故事。", "A gentle fairy-tale pace for short stories told to kids."],
    [
      "做一个睡前故事短片：一个小男孩和他的小狗在雨夜的街角等待回家的路，画面温暖，节奏缓慢，适合讲给孩子听。",
      "Make a bedtime story clip: a little boy and his dog wait on a rainy street corner for the way home. Warm light, slow pace, suited to telling a child.",
    ],
  ),
  skill(
    "story",
    "love-story",
    "/home/samples/rain-couple.webp",
    ["爱情故事", "Love story"],
    ["电影感的重逢与告白，把情绪放在镜头里。", "Cinematic reunions and confessions, with the emotion carried by the camera."],
    [
      "做一个爱情短片：两个人在大雨的街头认出彼此，停下脚步，镜头环绕半圈，霓虹在雨里晕开，情绪克制。",
      "Make a love story clip: two people recognise each other on a rainy street, stop, and the camera circles half way round them as neon blurs in the rain. Restrained emotion.",
    ],
  ),
  skill(
    "story",
    "adventure",
    "/home/samples/mountain-valley.webp",
    ["冒险旅程", "Adventure"],
    ["山川、远征和发现，适合有大场面的故事开场。", "Mountains, expeditions and discovery for stories that open big."],
    [
      "做一个冒险故事开场：一支小队穿过云雾缭绕的山谷，镜头从高空俯冲到队伍身后，远处露出一座古老的城门。",
      "Make an adventure opening: a small party crosses a mist-filled valley, the camera dives from high above to just behind them, and an ancient gate appears in the distance.",
    ],
  ),
  skill(
    "story",
    "sci-fi",
    "/home/samples/mech-warrior.webp",
    ["科幻短片", "Sci-fi short"],
    ["机甲、星球和未来城市，适合做预告片式开场。", "Mechs, planets and future cities, cut like a trailer opening."],
    [
      "做一个科幻预告片开场：一台巨型机甲在废墟城市中缓缓站起，尘土落下，远处的天空有行星正在逼近。",
      "Make a sci-fi trailer opening: a giant mech slowly rises in a ruined city, dust falling, while a planet looms closer in the sky.",
    ],
  ),
  skill(
    "ads",
    "product-launch",
    "/home/samples/studio-room.webp",
    ["产品发布", "Product launch"],
    ["上传产品图，做一条有质感的发布短片。", "Upload a product shot and get a polished launch clip."],
    [
      "用我上传的产品图做一条产品发布短片：干净的影棚灯光，产品缓慢旋转，镜头推近到细节，结尾留出放标志的位置。",
      "Make a product launch clip from the product image I upload: clean studio light, the product slowly turning, a push-in to the details, and room at the end for a logo.",
    ],
  ),
  skill(
    "ads",
    "fashion-ad",
    "/home/silver-muse.webp",
    ["时尚广告", "Fashion ad"],
    ["模特、服装和光影，适合品牌和电商。", "Models, clothing and light for brands and e-commerce."],
    [
      "做一条时尚广告：模特在银色光线中转身，衣料随动作飘起，镜头慢动作跟拍，整体高级、克制。",
      "Make a fashion ad: a model turns in silver light, fabric lifting with the motion, slow-motion tracking camera, refined and restrained.",
    ],
  ),
  skill(
    "ads",
    "travel-promo",
    "/home/coast-drive.webp",
    ["旅行宣传", "Travel promo"],
    ["目的地风光和公路镜头，适合文旅和酒店。", "Destination scenery and road shots for tourism and hotels."],
    [
      "做一条旅行宣传片：黄昏的海岸公路，一辆车沿着海边行驶，航拍镜头跟随，阳光洒在海面上。",
      "Make a travel promo: a coastal road at dusk, a car driving along the sea, an aerial shot following it, sunlight on the water.",
    ],
  ),
  skill(
    "ads",
    "food-promo",
    "/home/fire-light.webp",
    ["餐饮宣传", "Food promo"],
    ["火光、蒸汽和特写，让食物看起来更好吃。", "Firelight, steam and close-ups that make food look better."],
    [
      "做一条餐饮宣传短片：炉火映照下的厨房，食物在锅里翻动，蒸汽升起，镜头特写到最后装盘。",
      "Make a food promo: a kitchen lit by flame, food tossed in the pan, steam rising, close-ups through to the final plating.",
    ],
  ),
  skill(
    "social",
    "dance-clip",
    "/home/samples/dancer.webp",
    ["舞蹈短视频", "Dance clip"],
    ["竖屏、节奏感强，适合短视频平台。", "Vertical and rhythmic, made for short-video platforms."],
    [
      "做一条竖屏舞蹈短视频：舞者在空旷的舞台上随节奏转身跳跃，灯光跟着节拍变化，动作干净利落。",
      "Make a vertical dance clip: a dancer turns and jumps to the beat on an empty stage, lights changing with the rhythm, crisp movement.",
    ],
  ),
  skill(
    "social",
    "portrait-motion",
    "/home/portrait-girl.webp",
    ["人像动起来", "Living portrait"],
    ["让一张人像照片自然地动起来。", "Bring a portrait photo to life with natural motion."],
    [
      "用我上传的人像照片做一个短视频：人物轻轻转头看向镜头，发丝被风吹动，背景虚化，表情自然。",
      "Make a short clip from the portrait I upload: the person gently turns to the camera, hair moving in the wind, background soft, natural expression.",
    ],
  ),
  skill(
    "social",
    "city-vlog",
    "/home/neon-streets.webp",
    ["城市夜景", "City nights"],
    ["霓虹街头和延时感，适合 vlog 开场。", "Neon streets and a time-lapse feel for vlog openers."],
    [
      "做一个城市夜景 vlog 开场：霓虹灯下的街道，行人和车流拉出光轨，镜头缓缓穿过人群向前推进。",
      "Make a city-night vlog opener: neon streets, people and traffic leaving light trails, the camera slowly pushing forward through the crowd.",
    ],
  ),
  skill(
    "social",
    "pet-moment",
    "/home/samples/autumn-walk.webp",
    ["温暖瞬间", "Warm moments"],
    ["日常里的温柔画面，适合情感类账号。", "Gentle everyday scenes for heartfelt accounts."],
    [
      "做一个温暖的日常短片：一对老人在落叶铺满的林荫道上散步，金色树叶缓缓飘落，镜头从身后平稳跟随。",
      "Make a warm everyday clip: an elderly couple walks a leaf-covered avenue, golden leaves drifting down, the camera following steadily from behind.",
    ],
  ),
  skill(
    "cinematic",
    "golden-hour",
    "/home/golden-hour.webp",
    ["黄金时刻", "Golden hour"],
    ["逆光、暖色和柔焦，最常用的电影感。", "Backlight, warm tones and soft focus, the classic cinematic look."],
    [
      "做一个黄金时刻风格的短片：逆光下的人物剪影，暖色光晕，浅景深，镜头缓慢横移。",
      "Make a golden-hour clip: a backlit silhouette, warm halation, shallow depth of field, a slow lateral camera move.",
    ],
  ),
  skill(
    "cinematic",
    "noir",
    "/home/samples/tomb-light.webp",
    ["暗调悬疑", "Dark mystery"],
    ["低调光和强对比，适合悬疑与惊悚。", "Low-key light and hard contrast for mystery and thrillers."],
    [
      "做一个悬疑氛围的短片：昏暗的古墓里，一束光从石缝中射入，照亮尘埃，镜头缓慢向前推进，气氛压抑。",
      "Make a mystery clip: in a dark tomb a single beam of light cuts through a crack and lights the dust, the camera slowly pushing in, tense atmosphere.",
    ],
  ),
  skill(
    "cinematic",
    "epic-nature",
    "/home/samples/storm-sea.webp",
    ["史诗自然", "Epic nature"],
    ["风暴、海浪和云层，适合大场面的空镜。", "Storms, waves and clouds for big establishing shots."],
    [
      "做一个史诗感的自然空镜：风暴中的大海，巨浪拍向礁石，乌云翻滚，航拍镜头低空掠过海面。",
      "Make an epic nature shot: a sea in a storm, huge waves hitting rocks, rolling clouds, an aerial camera skimming low over the water.",
    ],
  ),
  skill(
    "cinematic",
    "dreamlike",
    "/home/samples/cosmic-bloom.webp",
    ["梦幻超现实", "Dreamlike"],
    ["发光的花、漂浮的粒子，适合 MV 和艺术短片。", "Glowing flowers and floating particles for music videos and art films."],
    [
      "做一个梦幻风格的短片：一朵发光的花在宇宙中缓慢绽放，粒子在周围漂浮，色彩柔和，镜头缓慢环绕。",
      "Make a dreamlike clip: a glowing flower slowly blooms in space, particles drifting around it, soft colours, the camera slowly orbiting.",
    ],
  ),
];

export function skillsFor(category: CreativeSkillCategory) {
  return CREATIVE_SKILLS.filter((item) => item.category === category);
}
