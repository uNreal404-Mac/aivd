/** Wan 2.6 accepts up to three videos. These two container types can also be previewed by our uploader. */
export const WAN_REFERENCE_MAX_FILES = 3;
export const WAN_REFERENCE_MAX_BYTES = 10 * 1024 * 1024;

export function isWanVideoMime(type: string): boolean {
  return type === "video/mp4" || type === "video/quicktime";
}
