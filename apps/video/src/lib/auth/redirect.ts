const CALLBACK_ORIGIN = "https://aivd.ai";

/**
 * Keep auth callbacks on this site and within a relative path.
 */
export function getSafeCallbackURL(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const url = new URL(value, CALLBACK_ORIGIN);
    return url.origin === CALLBACK_ORIGIN ? value : "/";
  } catch {
    return "/";
  }
}

export function getLoginRedirectURL(
  loginPath: string,
  callbackURL: string | null | undefined,
): string {
  const separator = loginPath.includes("?") ? "&" : "?";
  return `${loginPath}${separator}callbackURL=${encodeURIComponent(
    getSafeCallbackURL(callbackURL),
  )}`;
}
