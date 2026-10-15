/** B2B /business inquiry validation + D1 insert. No payment, no KIE. */

export const SUCCESS_MESSAGE = "我们会在 24 小时内联系您报价";

export const FIELD_LIMITS = {
  company: 120,
  contact: 120,
  industry: 80,
  needType: 80,
  quantity: 40,
  budget: 80,
  notes: 2000,
  website: 200,
} as const;

export const INSERT_INQUIRY_SQL = `INSERT INTO business_inquiries
  (company, contact, industry, need_type, quantity, budget, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

export type InquiryInput = {
  company?: unknown;
  contact?: unknown;
  industry?: unknown;
  needType?: unknown;
  quantity?: unknown;
  budget?: unknown;
  notes?: unknown;
  website?: unknown;
};

export type ValidInquiry = {
  company: string;
  contact: string;
  industry: string;
  needType: string;
  quantity: string;
  budget: string;
  notes: string;
};

export type InquiryResult =
  | { ok: true; spam: true }
  | { ok: true; spam: false; value: ValidInquiry }
  | { ok: false; code: string; message: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clip(value: unknown): string {
  return asString(value).trim();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{5,19}$/;
const WECHAT_RE = /^[a-zA-Z][-_a-zA-Z0-9]{2,39}$/;

export function isPlausibleContact(value: string): boolean {
  if (EMAIL_RE.test(value)) return true;
  if (PHONE_RE.test(value)) return true;
  if (WECHAT_RE.test(value)) return true;
  return false;
}

export function validateBusinessInquiry(body: InquiryInput): InquiryResult {
  const website = clip(body.website);
  if (website.length > FIELD_LIMITS.website) {
    return { ok: false, code: "field_too_long", message: "字段过长" };
  }
  if (website) {
    return { ok: true, spam: true };
  }

  const company = clip(body.company);
  const contact = clip(body.contact);
  const industry = clip(body.industry);
  const needType = clip(body.needType);
  const quantity = clip(body.quantity);
  const budget = clip(body.budget);
  const notes = clip(body.notes);

  if (company.length > FIELD_LIMITS.company) return { ok: false, code: "field_too_long", message: "公司/称呼过长" };
  if (contact.length > FIELD_LIMITS.contact) return { ok: false, code: "field_too_long", message: "联系方式过长" };
  if (industry.length > FIELD_LIMITS.industry) return { ok: false, code: "field_too_long", message: "行业过长" };
  if (needType.length > FIELD_LIMITS.needType) return { ok: false, code: "field_too_long", message: "需求类型过长" };
  if (quantity.length > FIELD_LIMITS.quantity) return { ok: false, code: "field_too_long", message: "数量过长" };
  if (budget.length > FIELD_LIMITS.budget) return { ok: false, code: "field_too_long", message: "预算过长" };
  if (notes.length > FIELD_LIMITS.notes) return { ok: false, code: "field_too_long", message: "备注过长" };

  if (!company) return { ok: false, code: "company_required", message: "请填写公司/称呼" };
  if (!contact) return { ok: false, code: "contact_required", message: "请填写联系方式" };
  if (!isPlausibleContact(contact)) {
    return { ok: false, code: "contact_invalid", message: "请填写邮箱或微信/电话" };
  }

  return {
    ok: true,
    spam: false,
    value: { company, contact, industry, needType, quantity, budget, notes },
  };
}

export async function insertBusinessInquiry(
  db: D1Database,
  value: ValidInquiry
): Promise<{ id: number }> {
  const result = await db
    .prepare(INSERT_INQUIRY_SQL)
    .bind(
      value.company,
      value.contact,
      value.industry,
      value.needType,
      value.quantity,
      value.budget,
      value.notes
    )
    .run();
  return { id: Number(result.meta.last_row_id) || 0 };
}
