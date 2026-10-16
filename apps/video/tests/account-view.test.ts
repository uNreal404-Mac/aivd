import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/payments", () => ({ isPaymentsConfigured: vi.fn() }));
vi.mock("@/payment/stripe-checkout", () => ({
  getStripeSecretKey: vi.fn(),
  createStripeClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@/db/schema", () => ({
  customers: {
    authUserId: "authUserId",
    stripeCustomerId: "stripeCustomerId",
  },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => "eq-condition") }));

import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import {
  createStripeClient,
  getStripeSecretKey,
} from "@/payment/stripe-checkout";
import { POST } from "@/app/api/payments/portal/route";
import {
  ACCOUNT_COPY,
  copyFor,
  formatCredits,
  parseHistoryResponse,
  parsePortalResponse,
  planLabel,
  txGroup,
  txMatchesFilter,
} from "@/lib/account-view";

const mockSelect = vi.mocked(db.select);

/** The route builds `db.select(...).from(...).where(...).limit(1)`. */
const queueCustomerRows = (rows: unknown[]) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  mockSelect.mockReturnValue({ from } as never);
  return { limit, where, from };
};

const makeRequest = (url = "https://example.com/api/payments/portal") =>
  ({ url } as unknown as NextRequest);

let portalCreate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(isPaymentsConfigured).mockReturnValue(true);
  vi.mocked(getStripeSecretKey).mockReturnValue("sk_test_dummy");
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "user_1" } as never);

  queueCustomerRows([{ stripeCustomerId: "cus_123" }]);

  portalCreate = vi
    .fn()
    .mockResolvedValue({ url: "https://billing.stripe.com/session_123" });
  vi.mocked(createStripeClient).mockReturnValue({
    billingPortal: { sessions: { create: portalCreate } },
  } as never);
});

describe("planLabel", () => {
  it("maps plan codes to English labels", () => {
    expect(planLabel("FREE")).toBe("Free");
    expect(planLabel("PRO")).toBe("Pro");
    expect(planLabel("BUSINESS")).toBe("Business");
  });

  it("falls back to Free for null or unknown plans", () => {
    expect(planLabel(null)).toBe("Free");
    expect(planLabel(undefined)).toBe("Free");
    expect(planLabel("ENTERPRISE" as never)).toBe("Free");
  });

  it("supports a custom copy dictionary", () => {
    expect(planLabel("PRO", ACCOUNT_COPY.zh)).toBe("专业版");
  });
});

describe("txGroup", () => {
  it("groups purchase types", () => {
    expect(txGroup("order_pay")).toBe("purchase");
    expect(txGroup("subscription")).toBe("purchase");
    expect(txGroup("new_user")).toBe("purchase");
  });

  it("groups usage and refund types", () => {
    expect(txGroup("video_generate")).toBe("usage");
    expect(txGroup("video_refund")).toBe("refund");
  });

  it("returns other for unknown or missing types", () => {
    expect(txGroup("something_else")).toBe("other");
    expect(txGroup(null)).toBe("other");
    expect(txGroup(undefined)).toBe("other");
  });
});

describe("txMatchesFilter", () => {
  it("matches everything on the all filter", () => {
    expect(txMatchesFilter("order_pay", "all")).toBe(true);
    expect(txMatchesFilter("unknown", "all")).toBe(true);
  });

  it("matches only the selected group", () => {
    expect(txMatchesFilter("order_pay", "purchase")).toBe(true);
    expect(txMatchesFilter("video_generate", "purchase")).toBe(false);
    expect(txMatchesFilter("video_generate", "usage")).toBe(true);
    expect(txMatchesFilter("video_refund", "refund")).toBe(true);
  });

  it("excludes 'other' from every specific filter", () => {
    expect(txMatchesFilter("new_thing", "purchase")).toBe(false);
    expect(txMatchesFilter("new_thing", "usage")).toBe(false);
    expect(txMatchesFilter("new_thing", "refund")).toBe(false);
  });
});

describe("formatCredits", () => {
  it("prefixes positive values with a plus", () => {
    expect(formatCredits(120)).toBe("+120");
  });

  it("keeps the minus sign for negative values", () => {
    expect(formatCredits(-30)).toBe("-30");
  });

  it("renders zero without a sign", () => {
    expect(formatCredits(0)).toBe("0");
  });
});

describe("copyFor", () => {
  it("returns the zh dictionary for zh", () => {
    expect(copyFor("zh")).toBe(ACCOUNT_COPY.zh);
  });

  it("defaults to en for any other locale", () => {
    expect(copyFor("en")).toBe(ACCOUNT_COPY.en);
    expect(copyFor("fr")).toBe(ACCOUNT_COPY.en);
  });
});

describe("parseHistoryResponse", () => {
  it("parses a well-formed payload", () => {
    const result = parseHistoryResponse({
      success: true,
      data: {
        transactions: [
          {
            id: "tx_1",
            credits: -30,
            balanceAfter: 970,
            transType: "video_generate",
            remark: "video",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        total: 1,
        hasMore: true,
        nextCursor: "cursor_1",
      },
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toEqual({
      id: "tx_1",
      credits: -30,
      balanceAfter: 970,
      transType: "video_generate",
      remark: "video",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("cursor_1");
  });

  it("returns an empty result for bad input", () => {
    expect(parseHistoryResponse(null)).toEqual({
      transactions: [],
      hasMore: false,
      nextCursor: null,
    });
    expect(parseHistoryResponse("nope")).toEqual({
      transactions: [],
      hasMore: false,
      nextCursor: null,
    });
    expect(parseHistoryResponse({ data: null })).toEqual({
      transactions: [],
      hasMore: false,
      nextCursor: null,
    });
  });

  it("drops malformed transactions and coerces missing fields", () => {
    const result = parseHistoryResponse({
      data: {
        transactions: [
          { id: "ok", transType: "order_pay" },
          { transType: "order_pay" },
          "nope",
          null,
        ],
      },
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toEqual({
      id: "ok",
      credits: 0,
      balanceAfter: 0,
      transType: "order_pay",
      remark: null,
      createdAt: "",
    });
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("ignores a non-string cursor and non-boolean hasMore", () => {
    const result = parseHistoryResponse({
      data: { transactions: [], hasMore: "yes", nextCursor: 42 },
    });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

describe("parsePortalResponse", () => {
  it("returns the url on success", () => {
    expect(parsePortalResponse(200, { url: "https://billing.example.com/x" })).toEqual(
      { ok: true, url: "https://billing.example.com/x" }
    );
  });

  it("maps known error codes to messages", () => {
    expect(parsePortalResponse(503, { error: "payments_not_configured" })).toEqual({
      ok: false,
      message: "Payments are not configured.",
    });
    expect(parsePortalResponse(503, { error: "test_mode_only" })).toEqual({
      ok: false,
      message: "Subscription management is only available in test mode.",
    });
    expect(parsePortalResponse(401, { error: "unauthorized" })).toEqual({
      ok: false,
      message: "You need to sign in to manage your subscription.",
    });
    expect(parsePortalResponse(404, { error: "no_customer" })).toEqual({
      ok: false,
      message: "No billing account was found for this user.",
    });
  });

  it("falls back to a generic message", () => {
    expect(parsePortalResponse(500, {})).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
    expect(parsePortalResponse(200, {})).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
    expect(parsePortalResponse(200, "nope")).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});

describe("POST /api/payments/portal", () => {
  it("returns 503 when payments are not configured", async () => {
    vi.mocked(isPaymentsConfigured).mockReturnValue(false);

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments_not_configured" });
    expect(createStripeClient).not.toHaveBeenCalled();
  });

  it("returns 503 when the secret key is missing", async () => {
    vi.mocked(getStripeSecretKey).mockReturnValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "test_mode_only" });
  });

  it("returns 503 when the secret key is not a test key", async () => {
    vi.mocked(getStripeSecretKey).mockReturnValue("sk_live_123");

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "test_mode_only" });
  });

  it("returns 401 when there is no user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no Stripe customer", async () => {
    queueCustomerRows([]);

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_customer" });
    expect(createStripeClient).not.toHaveBeenCalled();
  });

  it("returns 404 when stripeCustomerId is null", async () => {
    queueCustomerRows([{ stripeCustomerId: null }]);

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_customer" });
  });

  it("creates a billing portal session and returns the url", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://billing.stripe.com/session_123",
    });
    expect(createStripeClient).toHaveBeenCalledWith("sk_test_dummy");
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://example.com/account",
    });
  });

  it("uses the request origin for the return url", async () => {
    await POST(makeRequest("https://video.example.org/api/payments/portal"));

    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://video.example.org/account",
    });
  });
});
