/** Authenticated same-origin download for a generated media file. */
export function generatedDownloadUrl(uuid: string, index = 0): string {
  return `/api/v1/creative-space/asset?uuid=${encodeURIComponent(uuid)}&index=${index}&download=1`;
}
