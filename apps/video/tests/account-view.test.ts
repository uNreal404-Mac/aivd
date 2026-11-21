import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/payments", () => ({ isPaymentsConfigured: vi.fn() }));
vi.mock("@/payment/stripe-checkout", () => ({
  getUsableStripeKey: vi.fn(),
  createStripeClient: vi.fn(),
}));
vi.mock("@/payment/stripe-customer", () => ({
  findStripeSubscriber: vi.fn(),
  recordStripeSubscriber: vi.fn(),
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
  getUsableStripeKey,
} from "@/payment/stripe-checkout";
import {
  findStripeSubscriber,
  recordStripeSubscriber,
} from "@/payment/stripe-customer";
import { POST } from "@/app/api/payments/portal/route";
import {
  ACCOUNT_COPY,
  copyFor,
  formatCredits,
  parseHistoryResponse,
  parsePortalResponse,
  planLabel,
  showManageSubscription,
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

const makeRequest = (
  url = "https://example.com/api/payments/portal",
  referer: string | null = null
) =>
  ({
    url,
    headers: { get: (name: string) => (name === "referer" ? referer : null) },
  } as unknown as NextRequest);

let portalCreate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(isPaymentsConfigured).mockReturnValue(true);
  vi.mocked(getUsableStripeKey).mockReturnValue({
    ok: true,
    key: "sk_test_dummy",
    mode: "test",
  });
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
  it("names every plan tier in English", () => {
    expect(planLabel("free")).toBe("Free");
    expect(planLabel("basic")).toBe("Basic");
    expect(planLabel("pro")).toBe("Pro");
    expect(planLabel("ultimate")).toBe("Ultimate");
  });

  it("falls back to Free for null or unknown tiers", () => {
    expect(planLabel(null)).toBe("Free");
    expect(planLabel(undefined)).toBe("Free");
    expect(planLabel("ENTERPRISE" as never)).toBe("Free");
  });

  it("uses the pricing page's Chinese names", () => {
    expect(planLabel("basic", ACCOUNT_COPY.zh)).toBe("基础版");
    expect(planLabel("pro", ACCOUNT_COPY.zh)).toBe("专业版");
    expect(planLabel("ultimate", ACCOUNT_COPY.zh)).toBe("旗舰版");
  });
});

describe("showManageSubscription", () => {
  it("shows for every paid tier, Basic included", () => {
    expect(showManageSubscription("basic", null)).toBe(true);
    expect(showManageSubscription("pro", null)).toBe(true);
    expect(showManageSubscription("ultimate", undefined)).toBe(true);
  });

  it("shows for a free-tier account already linked to Stripe", () => {
    expect(showManageSubscription("free", "cus_123")).toBe(true);
  });

  it("hides for a free account with no Stripe customer", () => {
    expect(showManageSubscription("free", null)).toBe(false);
    expect(showManageSubscription(undefined, undefined)).toBe(false);
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
    expect(parsePortalResponse(503, { error: "live_mode_disabled" })).toEqual({
      ok: false,
      message: "Payments are not configured.",
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
    vi.mocked(getUsableStripeKey).mockReturnValue({
      ok: false,
      error: "stripe_not_configured",
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "stripe_not_configured" });
  });

  it("returns 503 for a live key while live mode is off", async () => {
    vi.mocked(getUsableStripeKey).mockReturnValue({
      ok: false,
      error: "live_mode_disabled",
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "live_mode_disabled" });
  });

  it("accepts a live key once live mode is on", async () => {
    vi.mocked(getUsableStripeKey).mockReturnValue({
      ok: true,
      key: "sk_live_123",
      mode: "live",
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(createStripeClient).toHaveBeenCalledWith("sk_live_123");
  });

  it("returns 401 when there is no user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns 404 when neither the database nor Stripe knows a customer", async () => {
    queueCustomerRows([]);
    vi.mocked(findStripeSubscriber).mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_customer" });
    expect(findStripeSubscriber).toHaveBeenCalledWith(expect.anything(), "user_1");
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("finds an unrecorded subscriber in Stripe, saves the link and opens the portal", async () => {
    queueCustomerRows([]);
    const found = {
      userId: "user_1",
      stripeCustomerId: "cus_found",
      subscriptionId: "sub_1",
      active: true,
      renewsAt: new Date("2026-12-21T00:00:00Z"),
    };
    vi.mocked(findStripeSubscriber).mockResolvedValue(found);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(recordStripeSubscriber).toHaveBeenCalledWith(found);
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_found",
      return_url: "https://example.com/account",
    });
  });

  it("returns a Chinese portal to the Chinese account page", async () => {
    await POST(
      makeRequest(
        "https://example.com/api/payments/portal",
        "https://example.com/zh/account"
      )
    );

    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://example.com/zh/account",
      locale: "zh",
    });
  });

  it("returns 404 when stripeCustomerId is null", async () => {
    queueCustomerRows([{ stripeCustomerId: null }]);
    vi.mocked(findStripeSubscriber).mockResolvedValue(null);

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
