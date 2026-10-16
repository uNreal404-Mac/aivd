import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { isNoIndexEnvironment } from "@/lib/indexing";

const PRIVATE_PATHS = [
  "/api/",
  "/my-creations",
  "/credits",
  "/settings",
  "/admin",
  "/login",
  "/register",
];

export default function robots(): MetadataRoute.Robots {
  if (isNoIndexEnvironment()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const disallow = [
    ...PRIVATE_PATHS,
    ...PRIVATE_PATHS.map((path) => `/zh${path}`),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
