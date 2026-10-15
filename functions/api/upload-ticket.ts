import { json, error, preflight, hasMedia } from "../../libs/utils";
import { MAX_UPLOAD_BYTES } from "../../libs/media";
import type { Env } from "../../libs/utils";
import { isGenerationEnabled, generationDisabledResponse } from "../../libs/generation";

export const onRequestOptions = (): Response => preflight();

/** GET /api/upload-ticket — legacy probe; real uploads are POST /api/upload */
async function handleGet({ env, request }: { env: Env; request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return error("key required");

  return json({
    ok: true,
    key,
    mediaBound: hasMedia(env),
    maxBytes: MAX_UPLOAD_BYTES,
    uploadPath: "/api/upload",
    mediaPath: "/api/media",
    note: hasMedia(env)
      ? "MEDIA R2 bound — POST /api/upload then use the returned imageUrl with /api/generate"
      : "MEDIA R2 not bound — /api/generate still accepts a public imageUrl",
    generateUsesMedia: hasMedia(env),
  });
}

/**
 * All methods: GENERATION_ENABLED must be the exact string "true".
 * Anything else → 503 暂未开放 (no R2 write, no KIE).
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "OPTIONS") return preflight();
  if (!isGenerationEnabled(context.env)) return generationDisabledResponse();
  if (context.request.method === "GET" || context.request.method === "HEAD") {
    const res = await handleGet(context);
    if (context.request.method === "HEAD") {
      return new Response(null, { status: res.status, headers: res.headers });
    }
    return res;
  }
  return error("GET only", 405);
};
