import { describe, expect, test, vi } from "vitest";

const { isStripePaymentsEnabledMock } = vi.hoisted(() => ({
  isStripePaymentsEnabledMock: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/site", () => ({
  isStripePaymentsEnabled: isStripePaymentsEnabledMock,
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));
vi.mock("@/constants", () => ({
  SITE_NAME: "Test",
}));

const { stripePaymentAdapter } = await import("./stripe");

describe("stripePaymentAdapter.isConfigured", () => {
  test("is false when hooks.stripe.enabled is off even if Stripe env is present", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
    isStripePaymentsEnabledMock.mockReturnValue(false);
    expect(stripePaymentAdapter.isConfigured()).toBe(false);
  });

  test("requires both billing env and the site.config Stripe hook", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_123");
    isStripePaymentsEnabledMock.mockReturnValue(true);
    expect(stripePaymentAdapter.isConfigured()).toBe(true);
  });
});
