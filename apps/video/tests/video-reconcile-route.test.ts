import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { reconcile } = vi.hoisted(() => ({
  reconcile: vi.fn(async () => [{ uuid: "vid_1", action: "synced", status: "COMPLETED" }]),
}));
vi.mock("@/services/video", () => ({ videoService: { reconcileStuckGenerations: reconcile } }));

import { POST } from "@/app/api/v1/video/reconcile/route";

const call = (authorization?: string) =>
  POST(new NextRequest("https://aivd.test/api/v1/video/reconcile", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  }));

describe("POST /api/v1/video/reconcile", () => {
  const previous = process.env.RECONCILE_SECRET;
  beforeEach(() => { reconcile.mockClear(); });
  afterEach(() => {
    if (previous === undefined) Reflect.deleteProperty(process.env, "RECONCILE_SECRET");
    else process.env.RECONCILE_SECRET = previous;
  });

  it("is off until a secret is configured", async () => {
    Reflect.deleteProperty(process.env, "RECONCILE_SECRET");
    expect((await call("Bearer anything")).status).toBe(503);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong token", async () => {
    process.env.RECONCILE_SECRET = "s3cret-value";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-value")).status).toBe(401);
    expect((await call("s3cret-value")).status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("runs the reconciliation with the right token", async () => {
    process.env.RECONCILE_SECRET = "s3cret-value";
    const response = await call("Bearer s3cret-value");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, checked: 1 });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
