/**
 * Pure helpers for the new-user onboarding welcome modal.
 * No React, no DOM globals at module scope — everything is testable in isolation.
 */

export type OnboardingLocale = "en" | "zh";

export interface OnboardingCopy {
  /** "Welcome to <siteName>" */
  title: (siteName: string) => string;
  /** "You have {amount} free credits to start." */
  gift: (amount: number) => string;
  /** "Valid for {expireDays} days." */
  giftExpiry: (expireDays: number) => string;
  /** Heading above the recommended prompts. */
  promptsHeading: string;
  /** Secondary button that just closes the modal. */
  exploreCta: string;
  /** Accessible label for the close button. */
  closeLabel: string;
}

export const ONBOARDING_COPY: Record<OnboardingLocale, OnboardingCopy> = {
  en: {
    title: (siteName) => `Welcome to ${siteName}`,
    gift: (amount) => `You have ${amount} free credits to start.`,
    giftExpiry: (expireDays) => `Valid for ${expireDays} days.`,
    promptsHeading: "Try one of these",
    exploreCta: "Explore on my own",
    closeLabel: "Close",
  },
  zh: {
    title: (siteName) => `欢迎来到 ${siteName}`,
    gift: (amount) => `已为你准备 ${amount} 个新人积分。`,
    giftExpiry: (expireDays) => `有效期 ${expireDays} 天。`,
    promptsHeading: "试试这些提示词",
    exploreCta: "我自己逛逛",
    closeLabel: "关闭",
  },
};

/** Returns the copy dictionary for a locale, falling back to English. */
export function onboardingCopy(locale: string): OnboardingCopy {
  return locale === "zh" ? ONBOARDING_COPY.zh : ONBOARDING_COPY.en;
}

export const RECOMMENDED_PROMPTS: Record<OnboardingLocale, string[]> = {
  en: [
    "A lone traveler crosses a windswept desert at golden hour, cinematic wide shot, fine dust drifting in the air, slow push-in.",
    "An empty city street after rain at night, neon signs mirrored in the puddles, gentle dolly forward, moody cinematic lighting.",
    "A small cabin beside a frozen lake at dawn, warm light glowing in the window, slow aerial drift, calm and cinematic.",
  ],
  zh: [
    "黄昏时分，一位旅人独自穿越风沙起伏的沙漠，电影感远景，空气中漂浮着细密尘埃，镜头缓慢推进。",
    "雨后夜晚空荡的城市街道，霓虹招牌倒映在水洼中，镜头平稳向前移动，氛围感十足的电影光线。",
    "黎明时分冰湖畔的一间小屋，窗内透出温暖灯光，航拍缓慢漂移，安静而富有电影质感。",
  ],
};

/** Deep link into the video generator with the prompt prefilled. */
export function promptHref(locale: string, prompt: string): string {
  return `/${locale}/ai/video?prompt=${encodeURIComponent(prompt)}`;
}

/** How long an account is considered "new" (24 hours). */
export const ONBOARDING_WINDOW_MS = 86_400_000;

/**
 * True when `createdAt` is a valid date no older than `windowMs`.
 * Missing or unparseable values are never "new".
 */
export function isNewUser(
  createdAt: Date | string | number | undefined,
  now: number = Date.now(),
  windowMs: number = ONBOARDING_WINDOW_MS
): boolean {
  let created: number;

  if (createdAt instanceof Date) {
    created = createdAt.getTime();
  } else if (typeof createdAt === "number") {
    created = createdAt;
  } else if (typeof createdAt === "string") {
    created = Date.parse(createdAt);
  } else {
    created = Number.NaN;
  }

  if (!Number.isFinite(created)) return false;

  const age = now - created;
  return age >= 0 && age <= windowMs;
}

/** localStorage key that remembers the modal was dismissed for a user. */
export function seenKey(userId: string): string {
  return `du.onboarding.seen.${userId}`;
}

/** Minimal storage surface so tests can inject a fake. */
export interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether the modal was already dismissed on this browser.
 * If storage throws (private mode, blocked, quota) we treat it as seen so the
 * modal never pops up repeatedly.
 */
export function hasSeen(storage: OnboardingStorage, userId: string): boolean {
  try {
    return storage.getItem(seenKey(userId)) === "1";
  } catch {
    return true;
  }
}

/** Remembers that the modal was dismissed. Storage errors are swallowed. */
export function markSeen(storage: OnboardingStorage, userId: string): void {
  try {
    storage.setItem(seenKey(userId), "1");
  } catch {
    // Ignore storage failures — the modal may simply show again.
  }
}

/** Shape of `CREDITS_CONFIG.registerGift`. */
export interface RegisterGiftInfo {
  enabled?: boolean;
  amount?: number;
  expireDays?: number;
}

export interface GiftInfo {
  amount: number;
  expireDays: number;
}

/**
 * Normalises the register gift config. Returns `null` when the gift is
 * disabled or the amount is not a positive number, so the credits line is
 * never rendered with made-up numbers.
 */
export function giftInfo(registerGift: RegisterGiftInfo | null | undefined): GiftInfo | null {
  if (!registerGift || !registerGift.enabled) return null;

  const amount = registerGift.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;

  const expireDays =
    typeof registerGift.expireDays === "number" && Number.isFinite(registerGift.expireDays)
      ? registerGift.expireDays
      : 0;

  return { amount, expireDays };
}
