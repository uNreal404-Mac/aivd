import type { Env } from "../libs/utils";

/** Legacy human-service page — send visitors to the generator. */
export const onRequest: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 301,
    headers: {
      Location: "/workspace",
      "cache-control": "public, max-age=3600",
    },
  });
};
