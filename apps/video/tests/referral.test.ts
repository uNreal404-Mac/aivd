import { describe, expect, it } from "vitest";

import { getReferralConfig } from "@/config/referral";
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_COOKIE,
  REFERRAL_COPY,
  generateCode,
  isSelfReferral,
  isUndefinedTableError,
  isValidCode,
  maskEmail,
  normalizeEmail,
  parseRefCookie,
  referralCopy,
  referralStatusLabel,
} from "@/lib/referral";

describe("generateCode / isValidCode", () => {
  it("generates valid codes of the expected length", () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      expect(isValidCode(code)).toBe(true);
    }
  });

  it("never generates ambiguous characters", () => {
    for (let i = 0; i < 500; i += 1) {
      for (const char of generateCode()) {
        expect("0O1I").not.toContain(char);
        expect(REFERRAL_CODE_ALPHABET).toContain(char);
      }
    }
  });

  it("rejects malformed codes", () => {
    expect(isValidCode("ABCD2345")).toBe(true);
    expect(isValidCode("ABCD23O5")).toBe(false); // ambiguous O
    expect(isValidCode("abcd2345")).toBe(false); // lowercase
    expect(isValidCode("ABCD234")).toBe(false); // too short
    expect(isValidCode("ABCD23456")).toBe(false); // too long
    expect(isValidCode("")).toBe(false);
    expect(isValidCode(null)).toBe(false);
    expect(isValidCode(undefined)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });

  it("strips gmail dots and +tags", () => {
    expect(normalizeEmail("Foo.Bar+promo@Gmail.com")).toBe("foobar@gmail.com");
    expect(normalizeEmail("foo.bar@googlemail.com")).toBe("foobar@googlemail.com");
  });

  it("leaves other providers alone", () => {
    expect(normalizeEmail("Foo.Bar+promo@Example.com")).toBe(
      "foo.bar+promo@example.com"
    );
  });

  it("handles junk input", () => {
    expect(normalizeEmail("not-an-email")).toBe("not-an-email");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("maskEmail", () => {
  it("masks the local part and the domain label", () => {
    expect(maskEmail("alice@example.com")).toBe("a***@e***.com");
    expect(maskEmail("bob@sub.domain.co.uk")).toBe("b***@s***.uk");
  });

  it("handles junk input", () => {
    expect(maskEmail(null)).toBe("");
    expect(maskEmail("nope")).toBe("***");
  });
});

describe("isSelfReferral", () => {
  it("rejects the same user id", () => {
    expect(isSelfReferral({ inviterId: "u1", inviteeId: "u1" })).toBe(true);
  });

  it("rejects the same normalized email", () => {
    expect(
      isSelfReferral({
        inviterId: "u1",
        inviteeId: "u2",
        inviterEmail: "Foo.Bar+tag@gmail.com",
        inviteeEmail: "foobar@gmail.com",
      })
    ).toBe(true);
  });

  it("allows genuinely different people", () => {
    expect(
      isSelfReferral({
        inviterId: "u1",
        inviteeId: "u2",
        inviterEmail: "a@example.com",
        inviteeEmail: "b@example.com",
      })
    ).toBe(false);
  });

  it("does not treat two empty emails as a match", () => {
    expect(isSelfReferral({ inviterId: "u1", inviteeId: "u2" })).toBe(false);
  });
});

describe("parseRefCookie", () => {
  it("extracts a valid code", () => {
    expect(parseRefCookie(`${REFERRAL_COOKIE}=ABCD2345; other=1`)).toBe(
      "ABCD2345"
    );
    expect(parseRefCookie(`a=1; ${REFERRAL_COOKIE}=ABCD2345`)).toBe("ABCD2345");
  });

  it("decodes url-encoded values", () => {
    expect(parseRefCookie(`${REFERRAL_COOKIE}=ABCD2345%3D`)).toBeNull();
    expect(parseRefCookie(`${REFERRAL_COOKIE}=ABCD2345`)).toBe("ABCD2345");
  });

  it("returns null for missing or invalid codes", () => {
    expect(parseRefCookie("other=1")).toBeNull();
    expect(parseRefCookie(`${REFERRAL_COOKIE}=oops`)).toBeNull();
    expect(parseRefCookie(`${REFERRAL_COOKIE}=`)).toBeNull();
    expect(parseRefCookie("")).toBeNull();
    expect(parseRefCookie(null)).toBeNull();
    expect(parseRefCookie(undefined)).toBeNull();
  });
});

describe("isUndefinedTableError", () => {
  it("detects 42P01 on the error or its cause", () => {
    expect(isUndefinedTableError({ code: "42P01" })).toBe(true);
    expect(isUndefinedTableError(new Error("boom"))).toBe(false);
    expect(isUndefinedTableError({ cause: { code: "42P01" } })).toBe(true);
    expect(
      isUndefinedTableError({
        code: "23505",
        cause: { cause: { code: "42P01" } },
      })
    ).toBe(true);
  });

  it("handles non-error values", () => {
    expect(isUndefinedTableError(null)).toBe(false);
    expect(isUndefinedTableError(undefined)).toBe(false);
    expect(isUndefinedTableError("42P01")).toBe(false);
    expect(isUndefinedTableError({ code: "42P02" })).toBe(false);
  });
});

describe("referralCopy", () => {
  it("defaults to english", () => {
    expect(referralCopy("en")).toBe(REFERRAL_COPY.en);
    expect(referralCopy(undefined)).toBe(REFERRAL_COPY.en);
    expect(referralCopy("fr")).toBe(REFERRAL_COPY.en);
  });

  it("returns chinese for the zh locale", () => {
    expect(referralCopy("zh")).toBe(REFERRAL_COPY.zh);
    expect(referralCopy("zh")).not.toBe(REFERRAL_COPY.en);
  });

  it("exposes reward placeholders for both locales", () => {
    for (const copy of Object.values(REFERRAL_COPY)) {
      expect(copy.rewardsLine).toContain("{inviter}");
      expect(copy.rewardsLine).toContain("{invitee}");
    }
    expect(REFERRAL_COPY.en.rewardsOff.length).toBeGreaterThan(0);
  });

  it("labels statuses with a fallback", () => {
    const zh = referralCopy("zh");
    expect(referralStatusLabel(zh, "PENDING")).toBe(
      REFERRAL_COPY.zh.statusLabels.PENDING
    );
    expect(referralStatusLabel(zh, "WHATEVER")).toBe("WHATEVER");
  });
});

describe("getReferralConfig", () => {
  it("is disabled when nothing is configured", () => {
    const config = getReferralConfig({});
    expect(config.enabled).toBe(false);
    expect(config.inviterCredits).toBe(0);
    expect(config.inviteeCredits).toBe(0);
    expect(config.expiryDays).toBe(365);
  });

  it("is enabled when both amounts are positive integers", () => {
    const config = getReferralConfig({
      REFERRAL_INVITER_CREDITS: "100",
      REFERRAL_INVITEE_CREDITS: "50",
    });
    expect(config).toEqual({
      enabled: true,
      inviterCredits: 100,
      inviteeCredits: 50,
      expiryDays: 365,
    });
  });

  it("stays disabled when only one side is configured", () => {
    expect(
      getReferralConfig({ REFERRAL_INVITER_CREDITS: "100" }).enabled
    ).toBe(false);
    expect(
      getReferralConfig({ REFERRAL_INVITEE_CREDITS: "100" }).enabled
    ).toBe(false);
  });

  it("rejects non-positive or non-numeric amounts", () => {
    for (const value of ["0", "-5", "1.5", "abc", ""]) {
      expect(
        getReferralConfig({
          REFERRAL_INVITER_CREDITS: value,
          REFERRAL_INVITEE_CREDITS: "50",
        }).enabled
      ).toBe(false);
    }
  });

  it("honours a custom expiry and falls back on garbage", () => {
    expect(
      getReferralConfig({
        REFERRAL_INVITER_CREDITS: "1",
        REFERRAL_INVITEE_CREDITS: "1",
        REFERRAL_CREDITS_EXPIRY_DAYS: "30",
      }).expiryDays
    ).toBe(30);

    expect(
      getReferralConfig({
        REFERRAL_INVITER_CREDITS: "1",
        REFERRAL_INVITEE_CREDITS: "1",
        REFERRAL_CREDITS_EXPIRY_DAYS: "0",
      }).expiryDays
    ).toBe(365);
  });
});
