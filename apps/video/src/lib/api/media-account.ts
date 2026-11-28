import { ApiError } from "./error";

/** A tab can change accounts during upload or submission. Old clients
 * omit the headers and continue to use the authenticated session as before. */
export function assertMediaAccount(request: Request, userId: string): void {
  for (const header of ["X-Media-Account", "X-Extend-Account"]) {
    const expected = request.headers.get(header);
    if (expected !== null && expected !== userId) {
      throw new ApiError("Your account changed. Please try again.", 409, { code: "ACCOUNT_CHANGED" });
    }
  }
}
