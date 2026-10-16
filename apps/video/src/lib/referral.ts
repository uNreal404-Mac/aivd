import { customAlphabet } from "nanoid";

/** Cookie that carries the invite code through the signup flow. */
export const REFERRAL_COOKIE = "du_ref";

export const REFERRAL_CODE_LENGTH = 8;

/** 30 days, in seconds (used as the cookie maxAge). */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * A-Z0-9 with the ambiguous characters 0, O, 1 and I removed, so codes are
 * easy to read out loud / retype.
 */
export const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const createCode = customAlphabet(
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH
);

export function generateCode(): string {
  return createCode();
}

export function isValidCode(code: string | null | undefined): boolean {
  if (typeof code !== "string" || code.length !== REFERRAL_CODE_LENGTH) {
    return false;
  }

  for (const char of code) {
    if (!REFERRAL_CODE_ALPHABET.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Lowercases + trims an email. For Gmail addresses the local part is also
 * canonicalised: "+tag" suffixes are dropped and dots are removed, so
 * "Foo.Bar+promo@gmail.com" and "foobar@gmail.com" are the same person.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (typeof email !== "string") {
    return "";
  }

  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return trimmed;
  }

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plus = local.indexOf("+");
    if (plus !== -1) {
      local = local.slice(0, plus);
    }
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

/**
 * Masks an email for display: "alice@example.com" -> "a***@e***.com".
 */
export function maskEmail(email: string | null | undefined): string {
  if (typeof email !== "string") {
    return "";
  }

  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return "***";
  }

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const maskedLocal = `${local.slice(0, 1)}***`;

  const dot = domain.lastIndexOf(".");
  if (dot <= 0) {
    return `${maskedLocal}@${domain.slice(0, 1)}***`;
  }

  const domainName = domain.slice(0, dot);
  const tld = domain.slice(dot); // keeps the leading "."

  return `${maskedLocal}@${domainName.slice(0, 1)}***${tld}`;
}

export type SelfReferralInput = {
  inviterId?: string | null;
  inviteeId?: string | null;
  inviterEmail?: string | null;
  inviteeEmail?: string | null;
};

/**
 * A user cannot invite themselves, nor can someone be invited by the owner of
 * the email address they signed up with.
 */
export function isSelfReferral(input: SelfReferralInput): boolean {
  const { inviterId, inviteeId, inviterEmail, inviteeEmail } = input;

  if (inviterId && inviteeId && inviterId === inviteeId) {
    return true;
  }

  const inviter = normalizeEmail(inviterEmail);
  const invitee = normalizeEmail(inviteeEmail);

  return inviter !== "" && inviter === invitee;
}

/**
 * Reads the (valid) invite code out of a raw `Cookie:` header, or null.
 */
export function parseRefCookie(
  cookieHeader: string | null | undefined
): string | null {
  if (typeof cookieHeader !== "string" || cookieHeader === "") {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const name = part.slice(0, eq).trim();
    if (name !== REFERRAL_COOKIE) {
      continue;
    }

    const raw = part.slice(eq + 1).trim();

    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      value = raw;
    }

    return isValidCode(value) ? value : null;
  }

  return null;
}

/** Postgres `undefined_table`. */
const UNDEFINED_TABLE_CODE = "42P01";

/**
 * True when the error (or anything in its `cause` chain) is Postgres'
 * "relation does not exist" — used to degrade gracefully when the referral
 * tables have not been migrated yet.
 */
export function isUndefinedTableError(err: unknown): boolean {
  let current: unknown = err;

  for (let depth = 0; depth < 5; depth += 1) {
    if (current === null || current === undefined) {
      return false;
    }

    if (typeof current !== "object") {
      return false;
    }

    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === UNDEFINED_TABLE_CODE) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

export type ReferralCopy = {
  title: string;
  subtitle: string;
  linkLabel: string;
  copy: string;
  copied: string;
  howItWorksTitle: string;
  steps: string[];
  rewardsTitle: string;
  rewardsLine: string;
  rewardsOff: string;
  recordsTitle: string;
  recordsEmpty: string;
  unavailable: string;
  colFriend: string;
  colStatus: string;
  colDate: string;
  statusLabels: Record<string, string>;
};

export const REFERRAL_COPY: Record<"en" | "zh", ReferralCopy> = {
  en: {
    title: "Invite friends",
    subtitle:
      "Share your invite link. When a friend signs up and makes their first purchase, you both earn credits.",
    linkLabel: "Your invite link",
    copy: "Copy link",
    copied: "Copied",
    howItWorksTitle: "How it works",
    steps: [
      "Send your invite link to a friend.",
      "Your friend opens the link and creates an account.",
      "After their first purchase, both of you receive credits.",
    ],
    rewardsTitle: "Rewards",
    rewardsLine:
      "You get {inviter} credits; your friend gets {invitee} credits.",
    rewardsOff: "Rewards are not open yet.",
    recordsTitle: "Friends you invited",
    recordsEmpty: "You haven't invited anyone yet.",
    unavailable: "Referrals are not available yet.",
    colFriend: "Friend",
    colStatus: "Status",
    colDate: "Invited",
    statusLabels: {
      PENDING: "Pending",
      REWARDED: "Rewarded",
    },
  },
  zh: {
    title: "邀请好友",
    subtitle: "分享你的邀请链接。好友注册并完成首次付费后，双方都能获得积分。",
    linkLabel: "你的邀请链接",
    copy: "复制链接",
    copied: "已复制",
    howItWorksTitle: "如何运作",
    steps: [
      "把你的邀请链接发给好友。",
      "好友打开链接并注册账号。",
      "好友完成首次付费后，双方获得积分。",
    ],
    rewardsTitle: "奖励",
    rewardsLine: "你将获得 {inviter} 积分，你的好友将获得 {invitee} 积分。",
    rewardsOff: "奖励功能尚未开放。",
    recordsTitle: "我邀请的好友",
    recordsEmpty: "你还没有邀请任何好友。",
    unavailable: "邀请功能尚未开放。",
    colFriend: "好友",
    colStatus: "状态",
    colDate: "邀请时间",
    statusLabels: {
      PENDING: "待完成",
      REWARDED: "已发放",
    },
  },
};

export function referralCopy(
  locale: string | null | undefined
): ReferralCopy {
  return locale === "zh" ? REFERRAL_COPY.zh : REFERRAL_COPY.en;
}

export function referralStatusLabel(
  copy: ReferralCopy,
  status: string
): string {
  return copy.statusLabels[status] ?? status;
}
