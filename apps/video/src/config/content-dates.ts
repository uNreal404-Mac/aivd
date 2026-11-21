/**
 * When the facts on each kind of page (prices, credits, model limits) were
 * last checked against the config and the providers. Shown on the pages as
 * "Last updated" and given to search engines as dateModified.
 *
 * Set by hand, on the day the facts are checked: a date that moves on every
 * build would claim checks that never happened.
 */
export const CONTENT_UPDATED = {
  pricing: "2026-11-21",
  models: "2026-11-21",
  features: "2026-11-21",
} as const;

/** "21 November 2026" / "2026 年 11 月 21 日", without time zone surprises. */
export function formatUpdated(date: string, zh: boolean): string {
  const [year, month, day] = date.split("-").map(Number);
  if (zh) return `${year} 年 ${month} 月 ${day} 日`;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[month - 1]} ${year}`;
}
