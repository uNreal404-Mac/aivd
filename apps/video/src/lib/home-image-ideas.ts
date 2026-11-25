/**
 * Example prompts offered under the homepage composer on the Image tab
 * ("try these"), each written for one of our own sample images.
 */
export type ImageIdea = { id: string; image: string; prompt: { zh: string; en: string } };

export const HOME_IMAGE_IDEAS: ImageIdea[] = [
  {
    id: "studio-room",
    image: "/home/samples/studio-room.webp",
    prompt: {
      zh: "夜晚的创意工作室，清水混凝土墙和整面落地窗，一面墙是巨大的海底水族屏，几台显示器亮着紫蓝色画面，桌下暖色灯带，电影感广角",
      en: "A creative studio at night: raw concrete, floor-to-ceiling windows, a wall-sized undersea aquarium screen, monitors glowing violet and blue, warm light strips under the desks, cinematic wide angle",
    },
  },
  {
    id: "tomb-light",
    image: "/home/samples/tomb-light.webp",
    prompt: {
      zh: "古埃及墓室内部，一束阳光从顶部的缺口照进来，落在彩绘的木棺上，墙上满是壁画和象形文字，空气里有尘埃，写实摄影",
      en: "Inside an ancient Egyptian tomb, a shaft of sunlight falls through a gap in the ceiling onto a painted wooden sarcophagus, walls covered in murals and hieroglyphs, dust in the air, realistic photography",
    },
  },
  {
    id: "mech-warrior",
    image: "/home/samples/mech-warrior.webp",
    prompt: {
      zh: "身穿银白机甲的女战士握着武器，身后是一只张开巨口的红色巨兽，沙漠黄昏的逆光，科幻电影海报质感",
      en: "A woman warrior in silver-white power armour holding a weapon, a huge red beast roaring behind her, backlit desert dusk, sci-fi film poster look",
    },
  },
  {
    id: "red-carpet",
    image: "/home/samples/red-carpet.webp",
    prompt: {
      zh: "电影节红毯上的女士，粉色抹胸长裙带珠饰和高开衩，身后是一排摄影记者，傍晚自然光，时尚杂志摄影",
      en: "A woman on a film festival red carpet in a pink strapless gown with beading and a high slit, a row of photographers behind her, early evening light, fashion magazine photography",
    },
  },
  {
    id: "autumn-walk",
    image: "/home/samples/autumn-walk.webp",
    prompt: {
      zh: "一对白发老人在满是红叶的林间小路上并肩散步，柔和的秋日阳光，暖色调，温暖的纪实摄影",
      en: "An elderly couple walking side by side on a forest path under red autumn leaves, soft autumn sunlight, warm tones, tender documentary photography",
    },
  },
  {
    id: "rain-couple",
    image: "/home/samples/rain-couple.webp",
    prompt: {
      zh: "雨夜霓虹灯下，一对恋人额头相抵，雨水打湿了头发和衣服，背景是虚化的城市灯光，电影感特写",
      en: "A couple forehead to forehead under neon on a rainy night, rain soaking their hair and clothes, blurred city lights behind, cinematic close-up",
    },
  },
];
