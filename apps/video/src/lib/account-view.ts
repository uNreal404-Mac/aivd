/**
 * Pure, side-effect-free helpers for the /account page.
 *
 * Nothing in here touches the network, the database or React — every function
 * is deterministic and safe to call with untrusted input (API payloads).
 */

import type { PlanTier } from "@/config/pricing-user";

export type TxGroup = "purchase" | "usage" | "refund" | "other";

export type TxFilter = "all" | TxGroup;

export const PURCHASE_TX_TYPES = ["order_pay", "subscription", "new_user"];
export const USAGE_TX_TYPES = ["video_generate"];
export const REFUND_TX_TYPES = ["video_refund"];

const PURCHASE_SET = new Set(PURCHASE_TX_TYPES);
const USAGE_SET = new Set(USAGE_TX_TYPES);
const REFUND_SET = new Set(REFUND_TX_TYPES);

export interface AccountTypeLabels {
  purchase: string;
  usage: string;
  refund: string;
  other: string;
}

export interface AccountCopy {
  title: string;
  creditsHeading: string;
  available: string;
  total: string;
  used: string;
  frozen: string;
  expiringSoon: string;
  buyCredits: string;
  planHeading: string;
  planFree: string;
  planBasic: string;
  planPro: string;
  planUltimate: string;
  renewsOn: string;
  manageSubscription: string;
  endsOn: string;
  notRenewing: string;
  cancelSubscription: string;
  cancelConfirm: string;
  cancelKeep: string;
  /** `{date}` is replaced with the end of the paid period. */
  cancelHint: string;
  resumeSubscription: string;
  comingSoon: string;
  activityHeading: string;
  filterAll: string;
  filterPurchases: string;
  filterUsage: string;
  filterRefunds: string;
  colDate: string;
  colType: string;
  colCredits: string;
  colBalance: string;
  loadMore: string;
  empty: string;
  loading: string;
  errorGeneric: string;
  typeLabels: AccountTypeLabels;
}

export const ACCOUNT_COPY: Record<"en" | "zh", AccountCopy> = {
  en: {
    title: "Account",
    creditsHeading: "Credits",
    available: "Available",
    total: "Total",
    used: "Used",
    frozen: "Frozen",
    expiringSoon: "Expiring soon",
    buyCredits: "Buy credits",
    planHeading: "Current plan",
    planFree: "Free",
    planBasic: "Basic",
    planPro: "Pro",
    planUltimate: "Ultimate",
    renewsOn: "Renews on",
    manageSubscription: "Manage subscription",
    endsOn: "Ends on",
    notRenewing: "will not renew",
    cancelSubscription: "Cancel subscription",
    cancelConfirm: "Yes, cancel",
    cancelKeep: "Keep my plan",
    cancelHint: "Your plan stays active until {date} and is not charged again. Credits you already have stay until they expire.",
    resumeSubscription: "Resume subscription",
    comingSoon: "Coming soon",
    activityHeading: "Credit activity",
    filterAll: "All",
    filterPurchases: "Purchases",
    filterUsage: "Usage",
    filterRefunds: "Refunds",
    colDate: "Date",
    colType: "Type",
    colCredits: "Credits",
    colBalance: "Balance after",
    loadMore: "Load more",
    empty: "No activity yet.",
    loading: "Loading activity…",
    errorGeneric: "Something went wrong. Please try again.",
    typeLabels: {
      purchase: "Purchase",
      usage: "Usage",
      refund: "Refund",
      other: "Other",
    },
  },
  zh: {
    title: "账户",
    creditsHeading: "积分",
    available: "可用积分",
    total: "总计",
    used: "已用",
    frozen: "冻结",
    expiringSoon: "即将过期",
    buyCredits: "购买积分",
    planHeading: "当前套餐",
    planFree: "免费版",
    planBasic: "基础版",
    planPro: "专业版",
    planUltimate: "旗舰版",
    renewsOn: "续费日期",
    manageSubscription: "管理订阅",
    endsOn: "到期日期",
    notRenewing: "到期后不再续费",
    cancelSubscription: "取消订阅",
    cancelConfirm: "确认取消",
    cancelKeep: "先不取消",
    cancelHint: "套餐会用到 {date}，之后不再扣款。已有的积分保留到各自的过期日。",
    resumeSubscription: "恢复订阅",
    comingSoon: "即将开放",
    activityHeading: "积分记录",
    filterAll: "全部",
    filterPurchases: "购买",
    filterUsage: "消耗",
    filterRefunds: "退款",
    colDate: "日期",
    colType: "类型",
    colCredits: "积分",
    colBalance: "变动后余额",
    loadMore: "加载更多",
    empty: "暂无记录。",
    loading: "正在加载记录…",
    errorGeneric: "出错了，请重试。",
    typeLabels: {
      purchase: "购买",
      usage: "消耗",
      refund: "退款",
      other: "其他",
    },
  },
};

/** Pick the dictionary for a locale; anything other than "zh" falls back to English. */
export function copyFor(locale: string): AccountCopy {
  return locale === "zh" ? ACCOUNT_COPY.zh : ACCOUNT_COPY.en;
}

/** Localized label for the account's plan tier (from `getUserPlanTier`). */
export function planLabel(
  tier: PlanTier | null | undefined,
  copy: AccountCopy = ACCOUNT_COPY.en
): string {
  switch (tier) {
    case "basic":
      return copy.planBasic;
    case "pro":
      return copy.planPro;
    case "ultimate":
      return copy.planUltimate;
    default:
      return copy.planFree;
  }
}

/**
 * Whether the account page offers "Manage subscription" (the Stripe billing
 * portal, where a subscriber cancels). Shown to any paid tier, and to any
 * account already linked to a Stripe customer, so a subscriber whose credits
 * ran out can still reach cancel and invoices.
 */
export function showManageSubscription(
  tier: PlanTier | null | undefined,
  stripeCustomerId: string | null | undefined
): boolean {
  return (tier != null && tier !== "free") || Boolean(stripeCustomerId);
}

/** Bucket a transaction type into one of the filter groups. */
export function txGroup(transType: string | null | undefined): TxGroup {
  if (typeof transType !== "string") {
    return "other";
  }
  if (PURCHASE_SET.has(transType)) {
    return "purchase";
  }
  if (USAGE_SET.has(transType)) {
    return "usage";
  }
  if (REFUND_SET.has(transType)) {
    return "refund";
  }
  return "other";
}

/** Whether a transaction belongs to the selected filter chip. */
export function txMatchesFilter(
  transType: string | null | undefined,
  filter: TxFilter
): boolean {
  if (filter === "all") {
    return true;
  }
  return txGroup(transType) === filter;
}

/** Signed credit delta: `+120`, `-30` or `0`. */
export function formatCredits(n: number): string {
  const value = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return value > 0 ? `+${value}` : String(value);
}

export interface CreditTransactionView {
  id: string;
  credits: number;
  balanceAfter: number;
  transType: string;
  remark: string | null;
  createdAt: string;
}

export interface HistoryResult {
  transactions: CreditTransactionView[];
  hasMore: boolean;
  nextCursor: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toTransaction = (value: unknown): CreditTransactionView | null => {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }
  return {
    id: value.id,
    credits: typeof value.credits === "number" ? value.credits : 0,
    balanceAfter: typeof value.balanceAfter === "number" ? value.balanceAfter : 0,
    transType: typeof value.transType === "string" ? value.transType : "",
    remark: typeof value.remark === "string" ? value.remark : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
  };
};

/** Parse the credit history payload defensively — never throws on bad input. */
export function parseHistoryResponse(json: unknown): HistoryResult {
  const result: HistoryResult = {
    transactions: [],
    hasMore: false,
    nextCursor: null,
  };

  if (!isRecord(json) || !isRecord(json.data)) {
    return result;
  }

  const raw = json.data.transactions;
  if (Array.isArray(raw)) {
    result.transactions = raw
      .map(toTransaction)
      .filter((tx): tx is CreditTransactionView => tx !== null);
  }

  result.hasMore = json.data.hasMore === true;

  const cursor = json.data.nextCursor;
  result.nextCursor = typeof cursor === "string" ? cursor : null;

  return result;
}

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

const PORTAL_ERROR_MESSAGES: Record<string, string> = {
  payments_not_configured: "Payments are not configured.",
  stripe_not_configured: "Payments are not configured.",
  live_mode_disabled: "Payments are not configured.",
  invalid_key: "Payments are not configured.",
  unauthorized: "You need to sign in to manage your subscription.",
  no_customer: "No billing account was found for this user.",
  portal_unavailable: "The billing page could not be opened. Please try again later or contact support.",
  no_subscription: "No active subscription was found for this account.",
  subscription_update_failed: "The subscription could not be changed. Please try again later or contact support.",
  invalid_body: "The request could not be processed.",
  default: "Something went wrong. Please try again.",
};

/** Map the billing portal API response into a render-ready result. */
export function parsePortalResponse(status: number, json: unknown): PortalResult {
  const payload = isRecord(json) ? json : {};
  const url = typeof payload.url === "string" ? payload.url : "";

  if (status >= 200 && status < 300 && url.length > 0) {
    return { ok: true, url };
  }

  const code = typeof payload.error === "string" ? payload.error : "";
  return {
    ok: false,
    message: PORTAL_ERROR_MESSAGES[code] ?? PORTAL_ERROR_MESSAGES.default,
  };
}

export type SubscriptionChangeResult =
  | { ok: true; state: "renewing" | "ending" | "ended"; date: string | null }
  | { ok: false; message: string };

/** Map the cancel/resume API response into a render-ready result. */
export function parseSubscriptionChangeResponse(status: number, json: unknown): SubscriptionChangeResult {
  const payload = isRecord(json) ? json : {};
  const state = payload.state;
  if (status >= 200 && status < 300 && (state === "renewing" || state === "ending" || state === "ended")) {
    return { ok: true, state, date: typeof payload.date === "string" ? payload.date : null };
  }
  const code = typeof payload.error === "string" ? payload.error : "";
  return { ok: false, message: PORTAL_ERROR_MESSAGES[code] ?? PORTAL_ERROR_MESSAGES.default };
}
