import { headers } from "next/headers";

import { getSafeCallbackURL } from "./redirect";

/**
 * The middleware records the original path before locale processing so that a
 * protected server component can return the user to the exact URL requested.
 */
export async function getRequestCallbackURL(): Promise<string> {
  const requestHeaders = await headers();
  return getSafeCallbackURL(requestHeaders.get("x-aidv-original-path"));
}
