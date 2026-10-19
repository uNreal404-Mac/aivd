export type LoginErrorMessageKey =
  | "invalidEmail"
  | "invalidCallbackURL"
  | "sessionExpired"
  | "accessDenied"
  | "rateLimited"
  | "generic";

const errorMessageKeys: Record<string, LoginErrorMessageKey> = {
  ACCESS_DENIED: "accessDenied",
  EMAIL_NOT_VERIFIED: "accessDenied",
  EXPIRED_TOKEN: "sessionExpired",
  INVALID_CALLBACK_URL: "invalidCallbackURL",
  INVALID_EMAIL: "invalidEmail",
  INVALID_EMAIL_OR_PASSWORD: "invalidEmail",
  INVALID_REDIRECT_URL: "invalidCallbackURL",
  INVALID_TOKEN: "sessionExpired",
  RATE_LIMIT_EXCEEDED: "rateLimited",
  SESSION_EXPIRED: "sessionExpired",
  SOCIAL_PROVIDER_ERROR: "accessDenied",
  TOO_MANY_REQUESTS: "rateLimited",
};

export function getLoginErrorMessageKey(
  error: string | null | undefined,
): LoginErrorMessageKey {
  if (!error) return "generic";

  const normalized = error.trim().toUpperCase().replaceAll("-", "_");
  return errorMessageKeys[normalized] ?? "generic";
}
