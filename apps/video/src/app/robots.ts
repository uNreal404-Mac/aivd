import type { MetadataRoute } from "next";

import { NAMED_CRAWLERS, privateDisallowPaths } from "@/config/indexing-paths";
import { siteConfig } from "@/config/site";
import { isNoIndexEnvironment } from "@/lib/indexing";

// Evaluate per request so runtime env vars are respected.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (isNoIndexEnvironment()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const disallow = privateDisallowPaths();

  return {
    rules: [
      ...NAMED_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
      { userAgent: "*", allow: "/", disallow },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
