export type ReferralConfig = {
  /** Rewards are only handed out when both credit amounts are configured. */
  enabled: boolean;
  inviterCredits: number;
  inviteeCredits: number;
  expiryDays: number;
};

export const REFERRAL_DEFAULT_EXPIRY_DAYS = 365;

/**
 * Parses a strictly positive integer out of an env value.
 * Returns null for anything that is not a positive integer
 * (empty, whitespace, "0", "-1", "1.5", "abc", ...).
 */
function parsePositiveInt(value: string | undefined | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

/**
 * Reads the referral program configuration from the environment.
 *
 * Rewards are "off" unless BOTH credit amounts are positive integers, so a
 * half-configured environment never hands out credits.
 */
export function getReferralConfig(
  env: Record<string, string | undefined> = process.env
): ReferralConfig {
  const inviterCredits = parsePositiveInt(env.REFERRAL_INVITER_CREDITS);
  const inviteeCredits = parsePositiveInt(env.REFERRAL_INVITEE_CREDITS);
  const expiryDays =
    parsePositiveInt(env.REFERRAL_CREDITS_EXPIRY_DAYS) ??
    REFERRAL_DEFAULT_EXPIRY_DAYS;

  const enabled = inviterCredits !== null && inviteeCredits !== null;

  return {
    enabled,
    inviterCredits: inviterCredits ?? 0,
    inviteeCredits: inviteeCredits ?? 0,
    expiryDays,
  };
}

export function isReferralRewardConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getReferralConfig(env).enabled;
}
