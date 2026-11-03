type Copy = [string, string];
type Cue = { at: number; label: Copy; prompt: Copy };
export type CutroomFilm = { video: string; poster: string; strip: string; title: Copy; display: [string, string]; genre: Copy; duration: number; cues: Cue[] };
export const cutroomFilms: CutroomFilm[] = [
  { video: "/home/cutroom-optics.mp4", poster: "/home/cutroom-optics.webp", strip: "/home/cutroom-strip-optics.webp", title: ["折光引擎", "Optical Engine"], display: ["Optical", "Engine"], genre: ["实验影像 · 机械光学", "Motion study · Mechanical optics"], duration: 10, cues: [
    { at: 0, label: ["镜组轮廓", "The silhouette"], prompt: ["让一组悬浮的光学镜片占据画面右侧，左侧留出黑色负空间。用一道冷白色轮廓光擦亮金属环的边缘，让观众先看见外形，再看见玻璃。", "Suspend an optical assembly on the right of a black frame, leaving negative space on the left. Skim the outer metal rings with a cool white rim light so the silhouette reads before the glass."] },
    { at: .34, label: ["机械转动", "Rotating elements"], prompt: ["微距观察缓缓转动的精密镜组。让抛光金属在窄束灯光下逐层反射，保持背景纯黑，焦点落在两道轮廓交错的位置。", "Study the rotating lens elements in macro. Let a narrow strip of light travel across the polished metal, holding focus where two arcs cross against black."] },
    { at: .69, label: ["折射光心", "Refracted light"], prompt: ["拍摄光学装置的玻璃核心，让冰青色的光从玻璃内侧折出。保持转动平稳，把最亮的一笔高光留在镜片边缘。", "Frame the glass heart of an optical instrument. Refract an icy cyan light through it, keeping the rotation smooth and the brightest highlight on the edge of the lens."] }
  ] },
  { video: "/home/premiere-overture.mp4", poster: "/home/premiere-overture.webp", strip: "/home/cutroom-strip-tide.webp", title: ["潮汐序曲", "Tidal Overture"], display: ["Tidal", "Overture"], genre: ["诗意短片 · 自然", "Poetic short · Landscape"], duration: 13, cues: [
    { at: 0, label: ["海岸远景", "Coastal wide"], prompt: ["以极远景拍摄黑色玄武岩海岸。让银青色海浪沿画面对角线涌入，用低云压住地平线，人物只占画面的一小点。", "Open wide on a black basalt coast. Run the silver-green surf diagonally into the frame beneath low clouds; hold a lone figure very small against the shoreline."] },
    { at: .42, label: ["棱镜人像", "Prism portrait"], prompt: ["切到一张被水晶棱镜照亮的面孔。固定机位，浅景深，让一道细窄光谱缓缓划过眼睛。", "Cut to a face lit through a crystal prism. Lock the camera, keep the depth of field shallow, and drift a narrow spectrum across the eyes."] },
    { at: .635, label: ["石拱全景", "Monument wide"], prompt: ["以对称全景拍摄雾中的巨大石拱，人物背对镜头，站在门洞下。让侧光勾出湿润石面的纹理。", "Frame a monumental stone arch in mist with a symmetrical wide shot. Place a figure with their back to us inside the opening and rake soft light across the wet stone."] },
    { at: .88, label: ["海岸回声", "Coastal reprise"], prompt: ["回到黑沙海岸的远景。让浅色浪线切过深色岩岸，保持地平线平稳，以留白收住影片。", "Return to a wide frame of the black coast. Let a pale ribbon of surf cross the dark rocks and hold the horizon still to end on negative space."] }
  ] },
  { video: "/home/hero-marina-loop.mp4", poster: "/home/hero-marina-poster.png", strip: "/home/cutroom-strip-harbor.webp", title: ["港湾日光", "Harbor Light"], display: ["Harbor", "Light"], genre: ["生活短片 · 外景", "Lifestyle short · Exterior"], duration: 9.72, cues: [
    { at: 0, label: ["船尾跟拍", "On the stern"], prompt: ["午后，手持镜头沿游艇船尾缓缓移动。让碰杯的朋友们留在中景，海面反射的日光在他们身后跳动。", "Glide a handheld camera along the stern of a yacht in the afternoon. Hold friends clinking glasses in a medium shot, letting points of sunlight dance on the water behind them."] }
  ] },
  { video: "/home/hero-showcase-02.mp4", poster: "/home/premiere-scene-02.webp", strip: "/home/cutroom-strip-glimmer.webp", title: ["微光初现", "First Glimmer"], display: ["First", "Glimmer"], genre: ["叙事习作 · 双人近景", "Narrative study · Two-shot"], duration: 5.04, cues: [
    { at: 0, label: ["双人近景", "The two-shot"], prompt: ["用固定双人近景拍下林荫间的两个人。他们转头相望，一道温暖而奇异的光从面庞掠过，让背景保持柔和。", "Hold a close two-shot of two people in a leafy park. As they turn toward one another, let a strange warm light cross their faces against the soft background."] }
  ] },
  { video: "/home/hero-showcase-03.mp4", poster: "/home/premiere-scene-03.webp", strip: "/home/cutroom-strip-amber.webp", title: ["琥珀目光", "Amber Eyes"], display: ["Amber", "Eyes"], genre: ["视效习作 · 人像", "VFX study · Portrait"], duration: 5.04, cues: [
    { at: 0, label: ["目光特写", "The amber gaze"], prompt: ["两人在洒满阳光的树下握住彼此的手。目光相遇时让瞳孔泛出琥珀色的光，机位保持稳定，树叶在背景中柔和虚化。", "Two people clasp hands beneath sunlit trees. When their eyes meet, let their irises glow amber. Hold the camera still and keep the leaves softly out of focus."] }
  ] }
];
