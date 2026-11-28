/** Keep checkout redirects on this site and away from protocol-relative URLs. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n\0]/.test(value)) return null;
  return value;
}

export function goToPricingForCredits(): void {
  const returnTo = window.location.pathname;
  window.dispatchEvent(new Event("aivd:save-credit-draft"));
  const pricing = window.location.pathname.startsWith("/zh/") || window.location.pathname === "/zh" ? "/zh/pricing" : "/pricing";
  window.location.assign(`${pricing}?returnTo=${encodeURIComponent(returnTo)}`);
}
