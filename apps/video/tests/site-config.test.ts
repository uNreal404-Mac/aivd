import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getSiteTitle,
  getSupportEmail,
  isPreviewSiteFor,
  siteConfig,
} from "@/config/site";
import { PreviewBadge } from "@/components/layout/preview-badge";

describe("preview site configuration", () => {
  it("detects the explicit preview flag and pages.dev hosts", () => {
    expect(isPreviewSiteFor("https://example.com", "true")).toBe(true);
    expect(isPreviewSiteFor("https://aivd-preview.pages.dev", undefined)).toBe(true);
    expect(isPreviewSiteFor("https://example.com", undefined)).toBe(false);
  });

  it("uses the localized preview title", () => {
    expect(getSiteTitle("zh", true)).toBe("aivd.ai 预览站");
    expect(getSiteTitle("en", true)).toBe("aivd.ai Preview");
    expect(getSiteTitle("en", false)).toBe("aivd.ai");
  });

  it("only exposes a trimmed support email when the environment provides one", () => {
    expect(getSupportEmail(undefined)).toBeUndefined();
    expect(getSupportEmail("")).toBeUndefined();
    expect(getSupportEmail("   ")).toBeUndefined();
    expect(getSupportEmail(" support@example.com ")).toBe("support@example.com");
    expect(siteConfig.supportEmail).toBeUndefined();
  });

  it("renders the shared preview badge", () => {
    const markup = renderToStaticMarkup(
      createElement(PreviewBadge, { show: true }),
    );

    expect(markup).toContain('data-testid="preview-badge"');
    expect(markup).toContain(">Preview</span>");
  });
});
