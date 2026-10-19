import { describe, expect, it } from "vitest";

import { getSiteTitle, isPreviewSiteFor } from "@/config/site";

describe("preview site configuration", () => {
  it("detects the explicit preview flag and pages.dev hosts", () => {
    expect(isPreviewSiteFor("https://example.com", "true")).toBe(true);
    expect(isPreviewSiteFor("https://aivd-preview.pages.dev", undefined)).toBe(true);
    expect(isPreviewSiteFor("https://example.com", undefined)).toBe(false);
  });

  it("uses the localized preview title", () => {
    expect(getSiteTitle("zh", true)).toBe("aidv.ai 预览站");
    expect(getSiteTitle("en", true)).toBe("aidv.ai Preview");
    expect(getSiteTitle("en", false)).toBe("aidv.ai");
  });
});
