import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/webhooks/stripe/route";

const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const ORIGINAL_LIVE_MODE = process.env.STRIPE_LIVE_MODE;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body: JSON.stringify({ id: "evt_test" }),
  });
}

afterEach(() => {
  restoreEnv("STRIPE_SECRET_KEY", ORIGINAL_SECRET_KEY);
  restoreEnv("STRIPE_WEBHOOK_SECRET", ORIGINAL_WEBHOOK_SECRET);
  restoreEnv("STRIPE_LIVE_MODE", ORIGINAL_LIVE_MODE);
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects a live secret key with 503 live_mode_disabled when live mode is off", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    Reflect.deleteProperty(process.env, "STRIPE_LIVE_MODE");

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "live_mode_disabled" });
  });

  it("rejects a live restricted key with 503 live_mode_disabled", async () => {
    process.env.STRIPE_SECRET_KEY = "rk_live_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    Reflect.deleteProperty(process.env, "STRIPE_LIVE_MODE");

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "live_mode_disabled" });
  });

  it("rejects a missing secret key with 503 stripe_not_configured", async () => {
    Reflect.deleteProperty(process.env, "STRIPE_SECRET_KEY");
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "stripe_not_configured",
    });
  });

  it("rejects a publishable key with 503 invalid_key", async () => {
    process.env.STRIPE_SECRET_KEY = "pk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    Reflect.deleteProperty(process.env, "STRIPE_LIVE_MODE");

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "invalid_key" });
  });
});
