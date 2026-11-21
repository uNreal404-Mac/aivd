/**
 * Legal configuration
 *
 * Central place for the operator-supplied details that appear on the
 * /terms, /privacy, /refund-policy and /contact pages.
 *
 * Company name, address and governing law are intentionally left empty so the
 * operator can fill them in through environment variables. When a value is
 * missing, the legal pages render a neutral fallback rather than inventing one.
 */
import { siteConfig } from "@/config/site";

/**
 * Parse a positive integer from an environment value, falling back when the
 * value is unset, non-numeric, zero, or negative.
 */
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const LEGAL_CONFIG = {
  /** Operator legal name. Empty by default — never invent a value. */
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "",
  /** Operator postal address. Empty by default — the address line is omitted. */
  companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? "",
  /** Governing law / jurisdiction. Empty by default — a neutral fallback is used. */
  governingLaw: process.env.NEXT_PUBLIC_GOVERNING_LAW ?? "",
  /**
   * Refund window (in days) for unused credits. The operator/boss sets the
   * final number via NEXT_PUBLIC_REFUND_WINDOW_DAYS; defaults to 7 when unset
   * or invalid. The pricing FAQ points users here.
   */
  refundWindowDays: parsePositiveInt(
    process.env.NEXT_PUBLIC_REFUND_WINDOW_DAYS,
    7,
  ),
  /** Date shown as "Last updated" / "最后更新" on every legal page. */
  lastUpdated: "2026-11-21",
} as const;

/**
 * Support inbox used across the legal pages. Backed by the single source of
 * truth in `@/config/site` (SUPPORT_EMAIL) so the address never diverges.
 */
export function legalSupportEmail(): string | undefined {
  return siteConfig.supportEmail;
}
