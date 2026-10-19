import { describe, expect, it } from "vitest";

import { getLoginErrorMessageKey } from "@/lib/auth/login-error";

describe("login auth error messages", () => {
  it.each([
    ["INVALID_EMAIL", "invalidEmail"],
    ["INVALID_CALLBACK_URL", "invalidCallbackURL"],
    ["SESSION_EXPIRED", "sessionExpired"],
    ["ACCESS_DENIED", "accessDenied"],
    ["RATE_LIMIT_EXCEEDED", "rateLimited"],
  ])("maps %s to %s", (code, expected) => {
    expect(getLoginErrorMessageKey(code)).toBe(expected);
  });

  it("uses the generic message for unknown or missing codes", () => {
    expect(getLoginErrorMessageKey("some_new_error")).toBe("generic");
    expect(getLoginErrorMessageKey(null)).toBe("generic");
  });
});
