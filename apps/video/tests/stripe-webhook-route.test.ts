import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/webhooks/stripe/route";

const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects live secret keys with 503 test_mode_only", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "test_mode_only" });
  });

  it("rejects a missing secret key with 503 test_mode_only", async () => {
    Reflect.deleteProperty(process.env, "STRIPE_SECRET_KEY");
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";

    const res = await POST(makeRequest() as never);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "test_mode_only" });
  });
});
