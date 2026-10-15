import { json, preflight, type Env } from "../../libs/utils";

export const onRequestOptions = (): Response => preflight();

function gone(): Response {
  return json(
    {
      ok: false,
      error: "gone",
      code: "gone",
      message: "Business inquiries are no longer available",
    },
    410
  );
}

export const onRequest: PagesFunction<Env> = async () => gone();
export const onRequestGet: PagesFunction<Env> = async () => gone();
export const onRequestPost: PagesFunction<Env> = async () => gone();
