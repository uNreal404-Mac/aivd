import { json, type Env } from "../../../libs/utils";
import { ZCV_PRODUCT } from "../../../libs/zcvCore";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const secret = env.STRIPE_SECRET_KEY || "";
  const testKey = secret.startsWith("sk_test_") || secret.startsWith("rk_test_");
  const checkoutConfigured = testKey && !!env.STRIPE_WEBHOOK_SECRET && !!env.DB && !!env.MEDIA && !!env.SESSIONS;
  return json({
    ok: true,
    product: ZCV_PRODUCT,
    priceLabel: `$${(ZCV_PRODUCT.usdCents / 100).toFixed(2)}`,
    oneTime: true,
    checkoutConfigured,
    previewConfigured: !!env.KIE_API_KEY && !!env.DB && !!env.MEDIA && !!env.SESSIONS,
  });
};
