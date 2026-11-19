/**
 * Site configuration
 * Central place for website settings, auth providers, and features
 */
export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  supportEmail?: string;
  links: {
    github?: string;
    twitter?: string;
    discord?: string;
  };
  auth: {
    enableGoogleLogin: boolean;
    enableMagicLinkLogin: boolean;
    defaultProvider: "google" | "email";
  };
  routes: {
    defaultLoginRedirect: string;
  };
}

export function getSupportEmail(value = process.env.NEXT_PUBLIC_SUPPORT_EMAIL) {
  const email = value?.trim();
  return email || undefined;
}

const configuredAppUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";

export const SUPPORT_EMAIL = getSupportEmail();

export function isPreviewSiteFor(
  appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL,
  previewFlag = process.env.NEXT_PUBLIC_IS_PREVIEW,
) {
  if (previewFlag === "true") return true;
  if (!appUrl) return false;

  try {
    return new URL(appUrl).hostname.endsWith(".pages.dev");
  } catch {
    return false;
  }
}

export const isPreviewSite = isPreviewSiteFor(configuredAppUrl);

export function getSiteTitle(locale = "en", preview = isPreviewSite) {
  if (!preview) return "aivd.ai";
  return locale === "zh" ? "aivd.ai 预览站" : "aivd.ai Preview";
}

export const siteConfig: SiteConfig = {
  name: "aivd.ai",
  description: "AI Video Generation Platform - Create videos with Veo 3.1, Seedance 2.5, Kling 4.0 and more",
  url: configuredAppUrl,
  ogImage: "/og.png",
  supportEmail: SUPPORT_EMAIL,
  links: {},
  auth: {
    enableGoogleLogin: true,
    enableMagicLinkLogin: true,
    defaultProvider: "google",
  },
  routes: {
    defaultLoginRedirect: "/text-to-video",
  },
};

// Helper to get enabled auth providers
export function getEnabledAuthProviders() {
  const providers: string[] = [];
  if (siteConfig.auth.enableGoogleLogin) providers.push("google");
  if (siteConfig.auth.enableMagicLinkLogin) providers.push("email");
  return providers;
}
