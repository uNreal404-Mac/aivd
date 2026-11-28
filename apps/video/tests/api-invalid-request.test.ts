import { describe, expect, it } from "vitest";
import { z } from "zod";

import { handleApiError } from "@/lib/api/response";

describe("handleApiError", () => {
  it("answers a schema failure with 400 and the field, not a 500", async () => {
    let caught: unknown;
    try {
      z.object({ prompt: z.string().max(5) }).parse({ prompt: "too long here" });
    } catch (error) {
      caught = error;
    }
    const response = handleApiError(caught);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.details).toMatchObject({ code: "PROMPT_TOO_LONG", field: "prompt" });
  });

  it("still answers an unexpected error with 500", () => {
    expect(handleApiError(new Error("boom")).status).toBe(500);
  });
});
