import * as React from "react";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import zh from "../src/messages/zh.json";
import en from "../src/messages/en.json";
import { HfPromoBar } from "../src/components/hf/promo-bar";
import { HfTopNav } from "../src/components/hf/top-nav";
import { DuHome } from "../src/components/hf/du-home";
import { LandingFooter } from "../src/components/landing/footer";

// Components are compiled with the classic JSX runtime in this test setup.
(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    useLocalePathname: () => "/",
    LocaleLink: (props: { href?: string; className?: string; children?: ReactNode }) =>
      createElement("a", { href: props.href, className: props.className }, props.children),
  };
});

vi.mock("@/components/gallery/gallery-section", () => ({
  GallerySection: () => null,
}));

vi.mock("@/components/user-avatar", () => ({
  UserAvatar: () => null,
}));

const ENGLISH_PHRASES = [
  "New here?",
  "See plans",
  "Explore",
  "Pricing",
  "Login",
  "Sign up",
  "Bring stories",
  "to life.",
  "Start Creating",
  "Find your next direction",
  "The right model for every frame",
  "Describe it",
  "Pick a model",
  "Start creating with free credits",
  "View all",
  "Learn more",
  "Try it",
  "Made with",
];

const CJK = /[\u4e00-\u9fff]/;
const BRAND_OR_SYMBOL = /^(🎬\s*)?DreamUtopia$|@|^[\d\s.,:%→·©+\-/]+$/;

function render(locale: string, messages: Record<string, any>, node: ReactNode): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages,
      timeZone: "Asia/Shanghai",
      // biome-ignore lint/correctness/noChildrenProp: createElement typing for the provider requires children in props
      children: node,
    }),
  );
}

function visibleText(html: string): string[] {
  const decoded = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');

  return decoded
    .split(/<[^>]*>/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && /[A-Za-z\u4e00-\u9fff]/.test(segment));
}

function expectFullyLocalized(html: string): void {
  const text = visibleText(html).join("\n");

  for (const phrase of ENGLISH_PHRASES) {
    expect(text, `unexpected English phrase: ${phrase}`).not.toContain(phrase);
  }

  for (const segment of visibleText(html)) {
    if (BRAND_OR_SYMBOL.test(segment)) continue;
    expect(segment, `expected CJK text in: ${segment}`).toMatch(CJK);
  }
}

describe("zh render", () => {
  it("renders the promo bar fully in Chinese", () => {
    const html = render("zh", zh, createElement(HfPromoBar, { lang: "zh" }));

    expectFullyLocalized(html);
    expect(html).toContain("查看方案");
  });

  it("renders the top nav fully in Chinese", () => {
    const html = render("zh", zh, createElement(HfTopNav, { user: null, lang: "zh" }));

    expectFullyLocalized(html);
    expect(html).toContain("注册");
    expect(html).toContain("价格");
  });

  it("renders the home page fully in Chinese", () => {
    const html = render("zh", zh, createElement(DuHome, { lang: "zh" }));

    expectFullyLocalized(html);
    expect(html).toContain(zh.DuHome.hero.titleLead);
  });

  it("renders the footer fully in Chinese", () => {
    const html = render("zh", zh, createElement(LandingFooter, { lang: "zh" }));

    expectFullyLocalized(html);
  });
});

describe("en render", () => {
  it("renders the home page and top nav with English copy", () => {
    const home = render("en", en, createElement(DuHome, { lang: "en" }));
    expect(home).toContain("Bring stories");

    const nav = render("en", en, createElement(HfTopNav, { user: null, lang: "en" }));
    expect(nav).toContain("Sign up");
  });
});
