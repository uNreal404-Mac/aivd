import { json, type Env } from "../../../libs/utils";

async function respond(request: Request, env: Env, headOnly: boolean): Promise<Response> {
  if (!env.SESSIONS || !env.MEDIA) return json({ error: "storage_unavailable" }, 503);
  const token = new URL(request.url).searchParams.get("token") || "";
  const key = await env.SESSIONS.get(`zcv:provider:${token}`);
  if (!key || !/^zcv\/[a-z0-9_-]{8,80}\.(jpg|png|webp|mp4)$/.test(key)) return json({ error: "not_found" }, 404);
  const object: R2Object | R2ObjectBody | null = headOnly ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
  if (!object) return json({ error: "not_found" }, 404);
  const headers = new Headers({ "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" });
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store, max-age=0");
  return new Response(headOnly ? null : (object as R2ObjectBody).body, { headers });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => respond(request, env, false);
export const onRequestHead: PagesFunction<Env> = async ({ request, env }) => respond(request, env, true);
