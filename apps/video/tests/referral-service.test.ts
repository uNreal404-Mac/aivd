import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreditTransType } from "@/db/schema";
import { REFERRAL_COOKIE } from "@/lib/referral";
import { referralService } from "@/services/referral";

const REWARD_ENV_KEYS = [
  "REFERRAL_INVITER_CREDITS",
  "REFERRAL_INVITEE_CREDITS",
  "REFERRAL_CREDITS_EXPIRY_DAYS",
] as const;

const mocks = vi.hoisted(() => {
  const state = {
    selects: [] as unknown[],
    inserts: [] as unknown[],
    updates: [] as unknown[],
  };

  function selectChain(): Record<string, unknown> {
    const next = state.selects.shift() ?? [];
    const promise = (
      next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    ) as Promise<unknown> & Record<string, unknown>;
    const passthrough = () => promise;

    promise.from = passthrough;
    promise.leftJoin = passthrough;
    promise.where = passthrough;
    promise.orderBy = passthrough;
    promise.limit = passthrough;

    return promise;
  }

  function writeChain(target: unknown[]): Record<string, unknown> {
    const promise = Promise.resolve(undefined) as Promise<undefined> &
      Record<string, unknown>;

    promise.values = (value: unknown) => {
      target.push(value);
      return promise;
    };
    promise.set = (value: unknown) => {
      target.push(value);
      return promise;
    };
    promise.onConflictDoNothing = () => promise;
    promise.where = () => promise;
    promise.returning = () => promise;

    return promise;
  }

  return {
    state,
    recharge: vi.fn(),
    dbMock: {
      select: () => selectChain(),
      insert: () => writeChain(state.inserts),
      update: () => writeChain(state.updates),
    },
  };
});

vi.mock("@/db", () => ({ db: mocks.dbMock }));
vi.mock("@/services/credit", () => ({
  creditService: { recharge: mocks.recharge },
}));

function pendingReferral(id: number) {
  return {
    id,
    inviterUserId: "inviter-1",
    inviteeUserId: "invitee-1",
    inviteeEmailNorm: "invitee@example.com",
    status: "PENDING",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    rewardedAt: null,
  };
}

function undefinedTableError(): Error {
  return Object.assign(new Error('relation "referrals" does not exist'), {
    code: "42P01",
  });
}

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of REWARD_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }

  mocks.state.selects = [];
  mocks.state.inserts = [];
  mocks.state.updates = [];
  mocks.recharge.mockReset();
  mocks.recharge.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const key of REWARD_ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  vi.restoreAllMocks();
});

describe("attachFromCookieHeader", () => {
  it("ignores a self referral", async () => {
    mocks.state.selects = [[{ userId: "user-1" }]];

    await referralService.attachFromCookieHeader(
      "user-1",
      `${REFERRAL_COOKIE}=ABCDEFGH`
    );

    expect(mocks.state.selects).toHaveLength(0);
    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("ignores an invitee that is already linked", async () => {
    mocks.state.selects = [
      [{ userId: "inviter-1" }],
      [{ email: "invitee@example.com" }],
      [{ email: "inviter@example.com" }],
      [{ id: 11 }],
    ];

    await referralService.attachFromCookieHeader(
      "invitee-1",
      `${REFERRAL_COOKIE}=ABCDEFGH`
    );

    expect(mocks.state.inserts).toHaveLength(0);
  });

  it("ignores an email that was already referred", async () => {
    mocks.state.selects = [
      [{ userId: "inviter-1" }],
      [{ email: "invitee@example.com" }],
      [{ email: "inviter@example.com" }],
      [],
      [{ id: 12 }],
    ];

    await referralService.attachFromCookieHeader(
      "invitee-1",
      `${REFERRAL_COOKIE}=ABCDEFGH`
    );

    expect(mocks.state.inserts).toHaveLength(0);
  });
});

describe("rewardOnFirstPayment", () => {
  it("leaves the referral pending while rewards are disabled", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.state.selects = [[pendingReferral(5)]];

    await referralService.rewardOnFirstPayment("invitee-1");

    expect(logSpy).toHaveBeenCalled();
    expect(mocks.recharge).not.toHaveBeenCalled();
    expect(mocks.state.updates).toHaveLength(0);
  });

  it("grants both rewards with the referral order numbers when enabled", async () => {
    process.env.REFERRAL_INVITER_CREDITS = "100";
    process.env.REFERRAL_INVITEE_CREDITS = "50";
    process.env.REFERRAL_CREDITS_EXPIRY_DAYS = "30";

    mocks.state.selects = [[pendingReferral(42)]];

    await referralService.rewardOnFirstPayment("invitee-1");

    expect(mocks.recharge).toHaveBeenCalledTimes(2);
    expect(mocks.recharge).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "inviter-1",
        credits: 100,
        orderNo: "REF_INVITER_42",
        transType: CreditTransType.SYSTEM_ADJUST,
        expiryDays: 30,
      })
    );
    expect(mocks.recharge).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: "invitee-1",
        credits: 50,
        orderNo: "REF_INVITEE_42",
        transType: CreditTransType.SYSTEM_ADJUST,
        expiryDays: 30,
      })
    );
    expect(mocks.state.updates).toEqual([
      { status: "REWARDED", rewardedAt: expect.any(Date) },
    ]);
  });

  it("does nothing when there is no pending referral", async () => {
    mocks.state.selects = [[]];

    await referralService.rewardOnFirstPayment("invitee-1");

    expect(mocks.recharge).not.toHaveBeenCalled();
    expect(mocks.state.updates).toHaveLength(0);
  });
});

describe("missing referral tables", () => {
  it("returns null from getOrCreateCode instead of throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.state.selects = [undefinedTableError()];

    await expect(referralService.getOrCreateCode("user-1")).resolves.toBeNull();
  });

  it("reports the dashboard as unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.state.selects = [undefinedTableError()];

    await expect(referralService.listForInviter("user-1")).resolves.toEqual({
      available: false,
      code: null,
      records: [],
    });
  });
});
