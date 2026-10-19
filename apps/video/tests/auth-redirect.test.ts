import { describe, expect, it } from "vitest";

import {
  getSafeCallbackURL,
  getLoginRedirectURL,
} from "@/lib/auth/redirect";

describe("auth redirect URLs", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/pricing?x=1", "/pricing?x=1"],
    ["/zh/settings", "/zh/settings"],
  ])("keeps same-origin relative path %s", (value, expected) => {
    expect(getSafeCallbackURL(value)).toBe(expected);
  });

  it.each(["//evil.example", "https://evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects unsafe callback %s",
    (value) => {
      expect(getSafeCallbackURL(value)).toBe("/");
    },
  );

  it("adds the encoded callbackURL to a login path", () => {
    expect(getLoginRedirectURL("/zh/login", "/zh/settings?tab=profile")).toBe(
      "/zh/login?callbackURL=%2Fzh%2Fsettings%3Ftab%3Dprofile",
    );
  });
});
