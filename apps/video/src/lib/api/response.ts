import { ZodError } from "zod";

import { ApiError } from "./error";

/**
 * Standard success response
 */
export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit) {
  return Response.json({ success: true, data }, { status, headers });
}

/**
 * Standard error response
 */
export function apiError(message: string, status = 400, details?: unknown) {
  return Response.json(
    {
      success: false,
      error: { message, details },
    },
    { status }
  );
}

/**
 * Handle errors and return appropriate response
 */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiError(error.message, error.status, error.details);
  }
  // A request that fails its schema is the caller's mistake, not a server
  // error: answer 400 and say which field (any route that uses .parse()).
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".") || "body";
    return apiError(`The request is not valid: ${field}.`, 400, {
      code: issue?.code === "too_big" && field === "prompt" ? "PROMPT_TOO_LONG" : "INVALID_REQUEST",
      field,
    });
  }
  console.error("Unexpected error:", error);
  return apiError("Internal server error", 500);
}
