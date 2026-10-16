export type ImageUrlEnv = Record<string, string | undefined>;

/**
 * Hosts that R2 issues signed URLs on. These are always trusted for image
 * fetches because the signature itself authorizes access.
 */
export const SIGNED_URL_HOST_SUFFIXES = [
  ".r2.cloudflarestorage.com",
  ".r2.dev",
] as const;

/**
 * Collect the image hosts we are willing to fetch from. Includes the
 * configured storage domain (with or without a scheme) and any extra hosts
 * provided as a comma-separated list.
 */
export function getAllowedImageHosts(
  env: ImageUrlEnv = process.env,
): string[] {
  const hosts: string[] = [];

  const storageDomain = (env.STORAGE_DOMAIN ?? "").trim();
  if (storageDomain) {
    try {
      const parsed = new URL(
        storageDomain.includes("://")
          ? storageDomain
          : `https://${storageDomain}`,
      );
      if (parsed.hostname) {
        hosts.push(parsed.hostname.toLowerCase());
      }
    } catch {
      // Ignore empty or invalid STORAGE_DOMAIN values.
    }
  }

  const extraHosts = (env.IMAGE_URL_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  hosts.push(...extraHosts);

  return hosts;
}

/**
 * Returns true only for https URLs on an allowlisted host (exact match) or a
 * trusted signed-URL host suffix. URLs with credentials or non-https schemes
 * are always rejected.
 */
export function isAllowedImageUrl(
  url: string,
  env: ImageUrlEnv = process.env,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (SIGNED_URL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return true;
  }

  return getAllowedImageHosts(env).includes(hostname);
}
