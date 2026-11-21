import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/config/i18n-config";
import {
  NAMED_CRAWLERS,
  PRIVATE_PATHS,
  PUBLIC_ROUTES,
  isPrivatePath,
  privateDisallowPaths,
} from "@/config/indexing-paths";
import { SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";
import { INDEXED_LANDING_SLUGS, LANDING_SLUGS } from "@/lib/model-landing";
import { breadcrumbList, jsonLd, pricingOffers, sameAsLinks, siteGraph } from "@/lib/structured-data";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { legacyRedirects } from "../redirects.mjs";

const BASE = "http://localhost:3000";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("private paths", () => {
  it("matches private pages with and without a locale prefix", () => {
    expect(isPrivatePath("/account")).toBe(true);
    expect(isPrivatePath("/zh/checkout/success")).toBe(true);
    expect(isPrivatePath("/my-creations/abc")).toBe(true);
    expect(isPrivatePath("/pricing")).toBe(false);
    expect(isPrivatePath("/zh")).toBe(false);
    expect(isPrivatePath("/accounting")).toBe(false);
  });

  it("disallows every private path under every locale, and the API once", () => {
    const disallow = privateDisallowPaths();
    expect(disallow.filter((path) => path.includes("/api/"))).toEqual(["/api/"]);
    for (const locale of i18n.locales) {
      const prefix = locale === i18n.defaultLocale ? "" : `/${locale}`;
      for (const path of PRIVATE_PATHS) {
        expect(disallow).toContain(`${prefix}${path}`);
      }
    }
  });
});

describe("robots.txt", () => {
  it("blocks everything on a noindex (preview) deploy", () => {
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "true");
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("gives each named crawler its own group with the full Disallow list", () => {
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "false");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = privateDisallowPaths();
    for (const agent of [...NAMED_CRAWLERS, "*"]) {
      const group = rules.find((rule) => rule.userAgent === agent);
      expect(group, agent).toBeDefined();
      expect(group?.allow).toBe("/");
      expect(group?.disallow).toEqual(disallow);
    }
    expect(result.sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});

describe("sitemap", () => {
  it("is empty on a noindex deploy", () => {
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "true");
    expect(sitemap()).toEqual([]);
  });

  it("lists every public page and live model in both languages, with hreflang", () => {
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "false");
    const entries = sitemap();
    const paths = [...PUBLIC_ROUTES.map((route) => route.path), ...INDEXED_LANDING_SLUGS.map((slug) => `/models/${slug}`)];
    expect(entries).toHaveLength(paths.length * i18n.locales.length);

    const pricing = entries.find((entry) => entry.url === `${BASE}/pricing`);
    expect(pricing?.alternates?.languages).toEqual({
      en: `${BASE}/pricing`,
      "zh-CN": `${BASE}/zh/pricing`,
      "x-default": `${BASE}/pricing`,
    });
    expect(entries.some((entry) => entry.url === `${BASE}/zh/pricing`)).toBe(true);
    expect(entries.some((entry) => entry.url === BASE)).toBe(true);
    expect(entries.some((entry) => entry.url === `${BASE}/zh`)).toBe(true);
  });

  it("leaves out private pages and addresses that redirect", () => {
    vi.stubEnv("NEXT_PUBLIC_NOINDEX", "false");
    const redirected = new Set(legacyRedirects().map((rule) => rule.source));
    for (const entry of sitemap()) {
      const path = entry.url.slice(BASE.length) || "/";
      expect(isPrivatePath(path), path).toBe(false);
      expect(redirected.has(path), path).toBe(false);
      expect(path.startsWith("/en"), path).toBe(false);
    }
  });
});

describe("legacy redirects", () => {
  const rules = legacyRedirects();

  it("are 301s to one canonical address, for English and Chinese", () => {
    for (const rule of rules) {
      expect(rule.statusCode).toBe(301);
    }
    expect(rules).toContainEqual({ source: "/sora-2", destination: "/models/sora-2", statusCode: 301 });
    expect(rules).toContainEqual({ source: "/zh/privacy-policy", destination: "/zh/privacy", statusCode: 301 });
    expect(rules).toContainEqual({ source: "/en/:path*", destination: "/:path*", statusCode: 301 });
  });

  it("never catch the sample pictures under public/explore", () => {
    expect(rules.some((rule) => rule.source.includes("explore/"))).toBe(false);
  });

  it("send every model address to a model page that exists", () => {
    for (const rule of rules) {
      const match = rule.destination.match(/\/models\/([^/]+)$/);
      if (match) expect(LANDING_SLUGS, rule.destination).toContain(match[1]);
    }
  });

  it("have no leftover page files for the old addresses", () => {
    const marketing = path.resolve(__dirname, "..", "src", "app", "[locale]", "(marketing)");
    for (const dir of ["seedance-1-5", "sora-2", "veo-3-1", "wan-2-6", "privacy-policy", "terms-of-service", "explore"]) {
      expect(existsSync(path.join(marketing, dir, "page.tsx")), dir).toBe(false);
    }
  });
});

describe("structured data", () => {
  it("links the WebSite to the Organization by @id", () => {
    const graph = siteGraph()["@graph"] as Record<string, unknown>[];
    const org = graph.find((node) => node["@type"] === "Organization");
    const site = graph.find((node) => node["@type"] === "WebSite");
    expect(org?.["@id"]).toBe(`${BASE}/#organization`);
    expect(org?.description).toBeTruthy();
    expect(site?.publisher).toEqual({ "@id": `${BASE}/#organization` });
  });

  it("only puts filled profile links in sameAs", () => {
    expect(sameAsLinks({ x: "https://x.com/aivd", youtube: "", productHunt: undefined })).toEqual(["https://x.com/aivd"]);
  });

  it("offers the free credits and every enabled plan at its list price", () => {
    const offers = pricingOffers("en");
    expect(offers[0]).toMatchObject({ price: "0", priceCurrency: "USD" });
    const prices = offers.slice(1).map((offer) => offer.price);
    const enabled = SUBSCRIPTION_PRODUCTS.filter((plan) => plan.enabled).map((plan) => plan.priceUsd.toFixed(2));
    expect(prices).toEqual(enabled);
    expect(prices).toContain("9.90");
    expect(prices).toContain("29.90");
    expect(prices).toContain("79.90");
  });

  it("builds breadcrumbs with locale-prefixed URLs", () => {
    const list = breadcrumbList(
      [
        { name: "首页", path: "/" },
        { name: "Veo 3.1", path: "/models/veo-3-1" },
      ],
      "zh",
    );
    expect(list.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "首页", item: `${BASE}/zh` },
      { "@type": "ListItem", position: 2, name: "Veo 3.1", item: `${BASE}/zh/models/veo-3-1` },
    ]);
  });

  it("escapes < so the data cannot close its script element", () => {
    expect(jsonLd({ text: "</script>" })).not.toContain("</script>");
  });
});
