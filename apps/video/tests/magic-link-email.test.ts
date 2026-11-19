import { describe, expect, it } from "vitest";

import { buildMagicLinkEmail, escapeHtml, isChineseLink } from "@/lib/emails/magic-link-html";

const link = (callback: string) =>
  `https://aivd.ai/api/auth/magic-link/verify?token=abc&callbackURL=${encodeURIComponent(callback)}`;

describe("magic link email", () => {
  it("follows the language of the page the visitor came from", () => {
    expect(isChineseLink(link("/zh/ai/video"))).toBe(true);
    expect(isChineseLink(link("/zh"))).toBe(true);
    expect(isChineseLink(link("/ai/video"))).toBe(false);
    expect(isChineseLink(link("/zhuanti"))).toBe(false);
    expect(isChineseLink("not a url")).toBe(false);
  });

  it("writes Chinese and English versions", () => {
    const zh = buildMagicLinkEmail({ url: link("/zh"), siteName: "aivd.ai", name: "小明", verified: true, zh: true });
    expect(zh.subject).toBe("登录 aivd.ai");
    expect(zh.html).toContain("小明，你好");
    expect(zh.html).toContain('lang="zh-CN"');
    const en = buildMagicLinkEmail({ url: link("/"), siteName: "aivd.ai", verified: false, zh: false });
    expect(en.subject).toBe("Activate your aivd.ai account");
    expect(en.html).toContain("Hi there,");
  });

  it("escapes the name and the link", () => {
    const mail = buildMagicLinkEmail({
      url: 'https://aivd.ai/x?a=1&b="2"',
      siteName: "aivd.ai",
      name: '<img src=x onerror="alert(1)">',
      verified: true,
      zh: false,
    });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x");
    expect(mail.html).toContain("a=1&amp;b=&quot;2&quot;");
    expect(escapeHtml("<a>&'\"")).toBe("&lt;a&gt;&amp;&#39;&quot;");
  });
});
