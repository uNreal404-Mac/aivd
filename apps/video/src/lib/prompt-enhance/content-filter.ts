/**
 * Lightweight, deterministic content gate for prompt enhancement.
 *
 * The lists below are exported so they can be extended and unit tested. The
 * filter is intentionally conservative: it errs on the side of blocking.
 */

export type ContentBlockReason = "adult" | "minor" | "real_person";

export type ContentCheckResult =
  | { ok: true }
  | { ok: false; reason: ContentBlockReason };

export const ADULT_TERMS_EN: readonly string[] = [
  "nude",
  "naked",
  "nsfw",
  "porn",
  "sex",
  "sexual",
  "erotic",
  "topless",
  "genitals",
  "orgasm",
  "fetish",
  "hentai",
  "strip tease",
  "striptease",
  "lingerie shoot",
];

export const ADULT_TERMS_ZH: readonly string[] = [
  "裸体",
  "裸露",
  "色情",
  "情色",
  "成人片",
  "做爱",
  "性爱",
  "性交",
  "脱光",
  "露点",
  "黄片",
  "淫秽",
  "淫荡",
  "爆乳",
  "无码",
];

export const ADULT_TERMS: readonly string[] = [
  ...ADULT_TERMS_EN,
  ...ADULT_TERMS_ZH,
];

export const MINOR_TERMS: readonly string[] = [
  "child",
  "kid",
  "kids",
  "minor",
  "underage",
  "teen",
  "teenager",
  "schoolgirl",
  "schoolboy",
  "loli",
  "shota",
  "baby",
  "儿童",
  "小孩",
  "幼女",
  "幼童",
  "未成年",
  "萝莉",
  "正太",
  "小学生",
  "初中生",
  "女童",
  "男童",
];

export const SEXUALIZING_TERMS: readonly string[] = [
  "sexy",
  "seductive",
  "lingerie",
  "bikini",
  "kiss",
  "性感",
  "诱惑",
  "内衣",
  "比基尼",
];

export const DEEPFAKE_TERMS: readonly string[] = [
  "deepfake",
  "face swap",
  "faceswap",
  "换脸",
  "深度伪造",
  "AI换脸",
  "in the likeness of",
];

/**
 * Any mention of a listed public figure blocks the request — we do not
 * generate real people, so no further context is required.
 */
export const REAL_PERSON_NAMES: readonly string[] = [
  "Taylor Swift",
  "Elon Musk",
  "Donald Trump",
  "Joe Biden",
  "Barack Obama",
  "Kim Jong Un",
  "Xi Jinping",
  "Vladimir Putin",
  "Scarlett Johansson",
  "Emma Watson",
  "Tom Cruise",
  "Keanu Reeves",
  "Beyonce",
  "Rihanna",
  "Kim Kardashian",
  "BTS",
  "Blackpink",
  "Jackie Chan",
  "Leonardo DiCaprio",
  "Brad Pitt",
  "Angelina Jolie",
  "Bill Gates",
  "Mark Zuckerberg",
  "Kanye West",
  "Ariana Grande",
  "Justin Bieber",
  "Cristiano Ronaldo",
  "Lionel Messi",
  "Michael Jackson",
  "刘德华",
  "周杰伦",
  "杨幂",
  "赵丽颖",
  "迪丽热巴",
  "范冰冰",
  "李小龙",
  "周星驰",
  "特朗普",
  "拜登",
  "马斯克",
  "普京",
  "习近平",
  "奥巴马",
  "泰勒斯威夫特",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAsciiTerm(term: string): boolean {
  return /^[ -~]+$/.test(term);
}

/**
 * Case-insensitive, NFKC-normalized term lookup. ASCII terms are matched with
 * word boundaries so short tokens ("sex", "nude") do not fire inside longer
 * words such as "Sussex" or "Essex". CJK terms are matched by substring.
 */
function containsAny(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => {
    if (isAsciiTerm(term)) {
      const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      return pattern.test(haystack);
    }
    return haystack.includes(term);
  });
}

export function checkPromptSafety(text: string): ContentCheckResult {
  const normalized = text.normalize("NFKC").toLowerCase();

  // 1. Minors in any sexualized context.
  const hasMinorTerm = containsAny(normalized, MINOR_TERMS);
  if (
    hasMinorTerm &&
    (containsAny(normalized, ADULT_TERMS) ||
      containsAny(normalized, SEXUALIZING_TERMS))
  ) {
    return { ok: false, reason: "minor" };
  }

  // 2. Explicit adult content.
  if (containsAny(normalized, ADULT_TERMS)) {
    return { ok: false, reason: "adult" };
  }

  // 3. Deepfakes and real people.
  if (containsAny(normalized, DEEPFAKE_TERMS)) {
    return { ok: false, reason: "real_person" };
  }
  if (containsAny(normalized, REAL_PERSON_NAMES)) {
    return { ok: false, reason: "real_person" };
  }

  return { ok: true };
}
