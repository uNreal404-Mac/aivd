/**
 * Turns a provider's failure text into something a visitor can read: the
 * provider's name is internal and dropped, and a few common reasons are put in
 * plain words in the page's language. Anything else is shown as given.
 */
const PROVIDER_PREFIX = /^\s*(?:kie|evolink|fal|replicate|provider)\b[^:]{0,24}:\s*/i;

const KNOWN: { test: RegExp; zh: string; en: string }[] = [
  { test: /aspect[_ ]?ratio/i, zh: "这个模型不支持所选的画面比例，换一个比例再试。", en: "This model does not support the chosen aspect ratio. Try another one." },
  { test: /content|safety|nsfw|policy|moderation|sensitive/i, zh: "提示词或参考图没有通过内容安全审核，改一下再试。", en: "The prompt or reference did not pass the content check. Change it and try again." },
  { test: /time(?:d)?\s?out|timeout/i, zh: "生成超时了，可以直接再试一次。", en: "Generation timed out. Try again." },
  { test: /overload|busy|rate limit|capacity|429|503/i, zh: "模型服务繁忙，稍后再试。", en: "The model is busy right now. Try again shortly." },
];

export function failureReason(raw: string | null | undefined, zh: boolean): string | null {
  const text = (raw ?? "").replace(PROVIDER_PREFIX, "").trim();
  if (!text) return null;
  const known = KNOWN.find((item) => item.test.test(text));
  if (known) return zh ? known.zh : known.en;
  // A Chinese page does not show raw English from a provider: say what to do,
  // and keep the original after it for anyone reporting the problem.
  if (zh && !/[\u4e00-\u9fff]/.test(text)) return `生成没有成功，可以再试一次，或换一个模型。（${text}）`;
  return text;
}
