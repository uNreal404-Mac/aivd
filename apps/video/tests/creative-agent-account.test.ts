import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/creative-space/agent/route";
import { runCreativeAgent } from "@/lib/creative-space/agent";

vi.mock("@/lib/api/auth", () => ({ requireAuth: async () => ({ id: "second-account" }) }));
vi.mock("@/lib/creative-space/agent", () => ({ runCreativeAgent: vi.fn() }));

it("rejects an Agent request from a previous account before reading the attached media", async () => {
  const request = new Request("https://site.test/api/v1/creative-space/agent", {
    method: "POST",
    headers: { "X-Media-Account": "first-account" },
  });
  const readMedia = vi.spyOn(request, "formData");
  const result = await POST(request);
  expect(result.status).toBe(409);
  expect(await result.json()).toMatchObject({ error: { details: { code: "ACCOUNT_CHANGED" } } });
  expect(readMedia).not.toHaveBeenCalled();
  expect(runCreativeAgent).not.toHaveBeenCalled();
});
