import { describe, expect, it } from "vitest";

import { isPaymentsConfigured } from "@/lib/payments";

describe("isPaymentsConfigured", () => {
  it("returns false when the API key is missing", () => {
    expect(isPaymentsConfigured({})).toBe(false);
  });

  it("returns false when the API key is empty or whitespace", () => {
    expect(
      isPaymentsConfigured({
        CREEM_API_KEY: "",
        NEXT_PUBLIC_PAYMENTS_ENABLED: "true",
      })
    ).toBe(false);

    expect(
      isPaymentsConfigured({
        CREEM_API_KEY: "   ",
        NEXT_PUBLIC_PAYMENTS_ENABLED: "true",
      })
    ).toBe(false);
  });

  it("returns false when the key is present but the flag is missing", () => {
    expect(isPaymentsConfigured({ CREEM_API_KEY: "creem_test_key" })).toBe(
      false
    );
  });

  it("returns true when the key is present and the flag is 'true'", () => {
    expect(
      isPaymentsConfigured({
        CREEM_API_KEY: "creem_test_key",
        NEXT_PUBLIC_PAYMENTS_ENABLED: "true",
      })
    ).toBe(true);
  });

  it("returns false when the flag is 'true' but the key is missing", () => {
    expect(
      isPaymentsConfigured({ NEXT_PUBLIC_PAYMENTS_ENABLED: "true" })
    ).toBe(false);
  });
});
