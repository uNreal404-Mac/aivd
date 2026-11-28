import { describe, expect, it, vi } from "vitest";
import { POST as resolve } from "@/app/api/v1/creative-space/resolve/route";
import { POST as upload } from "@/app/api/v1/creative-space/video-assets/route";
import { POST as create } from "@/app/api/v1/creative-space/workflows/route";
import { PUT as save } from "@/app/api/v1/creative-space/workflows/[id]/route";

vi.mock("@/lib/api/auth", () => ({ requireAuth: async () => ({ id: "current-user" }) }));

describe("canvas requests after the browser changes accounts", () => {
  const ctx = { params: Promise.resolve({ id: "owner-a-workflow" }) };
  it.each([
    ["create a workflow", create],
    ["save a workflow", (request: Request) => save(request, ctx)],
    ["upload a clip", upload],
    ["resolve private previews", resolve],
  ] as const)("rejects the previous account before reading the body to %s", async (_name, handle) => {
    const request = new Request("https://example.test/api", {
      method: "POST",
      headers: { "X-Media-Account": "previous-user" },
      body: "unread payload",
    });
    const response = await handle(request);
    expect(response.status).toBe(409);
    expect((await response.json()).error.details.code).toBe("ACCOUNT_CHANGED");
    expect(request.bodyUsed).toBe(false);
  });
});
