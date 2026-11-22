/**
 * The homepage's title, description and H1, in one place.
 *
 * The page targets "ai video generator" through one smaller phrase people
 * search for and the site can honestly claim: "with sound" (Veo 3.1 and
 * Seedance 2.5 generate audio with the picture). Once the site has search
 * traffic, the title, the H1 and the topic stay as they are: changing them
 * makes search engines rank the page afresh. tests/home-seo.test.ts pins
 * them, so a change has to be deliberate.
 */
export const HOME_SEO = {
  en: {
    title: "AI Video Generator with Sound, from Text or Images",
    description:
      "Turn a prompt or photo into a video with sound. Veo 3.1, Seedance 2.5, Kling 4.0 and more in one place, plus images and audio. See the cost before you generate.",
    h1: "AI Video Generator — Turn Dreams into Reality",
  },
  zh: {
    title: "AI 视频生成器：文字或图片生成有声视频",
    description: "用 AI 把一句话或一张图片变成带声音的视频。Veo 3.1、Seedance 2.5、Kling 4.0 等模型一站可用，还能生成图片和音频，生成前就能看到要花多少积分。",
    h1: "AI视频生成器 把梦想照进现实",
  },
} as const;

export type HomeSeoLocale = keyof typeof HOME_SEO;

export function homeSeo(locale: string) {
  return locale.toLowerCase().startsWith("zh") ? HOME_SEO.zh : HOME_SEO.en;
}
