import { describe, expect, it } from "vitest";

import { portalPreflight } from "../src/lib/portal-guard";

describe("portalPreflight", () => {
  it("returns 401 when unauthenticated and payments are unconfigured", () => {
    expect(
      portalPreflight({
        authenticated: false,
        paymentsConfigured: false,
        secretKey: undefined,
      })
    ).toEqual({ status: 401, error: "unauthorized" });
  });

  it("returns 401 when unauthenticated and payments are configured", () => {
    expect(
      portalPreflight({
        authenticated: false,
        paymentsConfigured: true,
        secretKey: "sk_test_123",
      })
    ).toEqual({ status: 401, error: "unauthorized" });
  });

  it("returns 503 payments_not_configured when authenticated and unconfigured", () => {
    expect(
      portalPreflight({
        authenticated: true,
        paymentsConfigured: false,
        secretKey: "sk_test_123",
      })
    ).toEqual({ status: 503, error: "payments_not_configured" });
  });

  it("returns 503 test_mode_only when authenticated with a live key", () => {
    expect(
      portalPreflight({
        authenticated: true,
        paymentsConfigured: true,
        secretKey: "sk_live_123",
      })
    ).toEqual({ status: 503, error: "test_mode_only" });
  });

  it("returns 503 test_mode_only when authenticated and the key is missing", () => {
    expect(
      portalPreflight({
        authenticated: true,
        paymentsConfigured: true,
        secretKey: null,
      })
    ).toEqual({ status: 503, error: "test_mode_only" });
  });

  it("returns null when authenticated with a test key", () => {
    expect(
      portalPreflight({
        authenticated: true,
        paymentsConfigured: true,
        secretKey: "sk_test_123",
      })
    ).toBeNull();
  });
});
