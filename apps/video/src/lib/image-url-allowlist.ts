export type ImageUrlEnv = Record<string, string | undefined>;

/** Bucket that holds user-uploaded video source media. */
export const MEDIA_BUCKET = "dreamutopia-video-media";

/**
 * R2 account hosts are always <32 hex account id>.r2.cloudflarestorage.com.
 * Anything else (custom domains, *.r2.dev, lookalikes) is not our bucket.
 */
const OWN_BUCKET_HOST_PATTERN =
  /^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/;

/**
 * Extract the hostname of our own storage bucket from STORAGE_ENDPOINT.
 * Returns null when the endpoint is missing, unparseable, or does not look
 * like an R2 account endpoint.
 */
export function getOwnBucketHost(
  env: ImageUrlEnv = process.env,
): string | null {
  const endpoint = (env.STORAGE_ENDPOINT ?? "").trim();
  if (!endpoint) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  return OWN_BUCKET_HOST_PATTERN.test(hostname) ? hostname : null;
}

/**
 * True only for a signed URL that points at our own bucket and carries a
 * complete set of X-Amz-* signing parameters. Rejects credentials, ports,
 * non-https schemes, other buckets/accounts, and path traversal.
 */
export function isOwnSignedUrl(
  input: string,
  env: ImageUrlEnv = process.env,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  if (parsed.port) {
    return false;
  }

  const ownHost = getOwnBucketHost(env);
  if (!ownHost) {
    return false;
  }

  if (parsed.hostname.toLowerCase() !== ownHost) {
    return false;
  }

  const prefix = `/${MEDIA_BUCKET}/`;
  const pathname = parsed.pathname;
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  if (pathname.length <= prefix.length) {
    return false;
  }

  if (pathname.includes("..")) {
    return false;
  }

  if (/%(2e|2f)/i.test(pathname)) {
    return false;
  }

  const params = parsed.searchParams;
  if (!params.has("X-Amz-Algorithm")) {
    return false;
  }
  if (!params.has("X-Amz-Credential")) {
    return false;
  }
  if (!params.has("X-Amz-Signature")) {
    return false;
  }

  return true;
}

/**
 * True only for an object key scoped to the given user under uploads/.
 * Keys are storage object names, not URLs, so they must not contain schemes,
 * traversal, backslashes, query strings, or fragments.
 */
export function isOwnUploadKey(input: string, userId: string): boolean {
  if (!userId) {
    return false;
  }

  if (!input || input.length > 1024) {
    return false;
  }

  if (input.startsWith("/")) {
    return false;
  }

  const prefix = `uploads/${userId}/`;
  if (!input.startsWith(prefix)) {
    return false;
  }

  if (input.length <= prefix.length) {
    return false;
  }

  if (input.includes("..")) {
    return false;
  }

  if (input.includes("\\")) {
    return false;
  }

  if (input.includes("://")) {
    return false;
  }

  if (input.includes("?") || input.includes("#")) {
    return false;
  }

  return true;
}

/**
 * Accepts either a signed URL for our own bucket or an upload key owned by
 * the requesting user.
 */
export function isAllowedImageInput(
  input: string,
  opts: { userId: string; env?: ImageUrlEnv },
): boolean {
  return (
    isOwnSignedUrl(input, opts.env ?? process.env) ||
    isOwnUploadKey(input, opts.userId)
  );
}
