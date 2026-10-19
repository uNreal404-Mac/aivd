import { describe, expect, it } from "vitest";

import { getPhase2Route } from "../deploy/pages-proxy/_worker.redirect-phase2.js";

describe("phase-2 old-host routing", () => {
  it("redirects the old host while preserving path and query", () => {
    expect(
      getPhase2Route("https://dreamutopia-video.pages.dev/explore/cards?q=1"),
    ).toEqual({
      type: "redirect",
      status: 301,
      location: "https://aivd-preview.pages.dev/explore/cards?q=1",
    });
  });

  it("proxies the auth callback path", () => {
    expect(
      getPhase2Route(
        "https://dreamutopia-video.pages.dev/api/auth/callback/google",
      ),
    ).toEqual({ type: "proxy" });
  });

  it("proxies Stripe webhooks", () => {
    expect(
      getPhase2Route("https://dreamutopia-video.pages.dev/api/webhooks/stripe"),
    ).toEqual({ type: "proxy" });
  });

  it("does not exempt similarly named auth paths", () => {
    expect(
      getPhase2Route("https://dreamutopia-video.pages.dev/api/authx?next=1"),
    ).toEqual({
      type: "redirect",
      status: 301,
      location: "https://aivd-preview.pages.dev/api/authx?next=1",
    });
  });

  it("proxies every request from another host", () => {
    expect(getPhase2Route("https://example.com/anything?q=1")).toEqual({
      type: "proxy",
    });
  });
});
