// Readable labels for credit transactions. The ledger stores types in two
// spellings (old lowercase ones such as video_generate, and the enum names)
// and remarks written for engineers ("Video generation settled: vid_…"). The
// credits page shows both in plain words instead.

export type CreditKind = "gift" | "purchase" | "subscription" | "spend" | "refund" | "expired" | "adjust";

const KIND_BY_TYPE: Record<string, CreditKind> = {
  new_user: "gift",
  order_pay: "purchase",
  subscription: "subscription",
  video_consume: "spend",
  video_generate: "spend",
  refund: "refund",
  video_refund: "refund",
  expired: "expired",
  system_adjust: "adjust",
  admin_adjust: "adjust",
};

export function creditKind(transType: string): CreditKind {
  return KIND_BY_TYPE[transType.toLowerCase()] ?? "adjust";
}

const KIND_LABEL: Record<CreditKind, { zh: string; en: string }> = {
  gift: { zh: "新用户赠送", en: "Welcome credits" },
  purchase: { zh: "购买积分包", en: "Credit pack" },
  subscription: { zh: "订阅发放", en: "Subscription" },
  spend: { zh: "生成消耗", en: "Generation" },
  refund: { zh: "退回", en: "Returned" },
  expired: { zh: "过期", en: "Expired" },
  adjust: { zh: "系统调整", en: "Adjustment" },
};

export function creditKindLabel(kind: CreditKind, zh: boolean): string {
  return zh ? KIND_LABEL[kind].zh : KIND_LABEL[kind].en;
}

/** One plain line for a ledger remark, without internal ids. */
export function describeRemark(remark: string | null | undefined, zh: boolean): string | null {
  const text = (remark ?? "").trim();
  if (!text) return null;
  const plan = text.match(/payment:\s*(.+?)\s*(?:plan)?$/i)?.[1];
  if (/^stripe payment|^creem payment|^payment/i.test(text)) {
    return zh ? `购买${plan ? ` ${plan.replace(/\s*plan$/i, "")} 套餐` : "套餐"}` : `Bought${plan ? ` the ${plan.replace(/\s*plan$/i, "")} plan` : " a plan"}`;
  }
  if (/refund/i.test(text) && /stripe|creem|order/i.test(text)) return zh ? "订单退款" : "Order refunded";
  if (/generation settled/i.test(text)) return zh ? "生成完成" : "Generation finished";
  if (/generation failed|credits release/i.test(text)) return zh ? "生成失败，积分已退回" : "Generation failed; credits returned";
  if (/welcome/i.test(text)) return zh ? "新用户欢迎积分" : "Welcome credits";
  if (/credits expired/i.test(text)) return zh ? "到期未用完的积分已失效" : "Unused credits reached their expiry date";
  // Anything else is shown as written, minus long ids.
  return text.replace(/\b(?:vid|cs|stripe_cs|pi|sub|in)_[A-Za-z0-9_]{6,}\b/g, "").replace(/[:\s]+$/, "").trim() || null;
}
