/**
 * Site configuration
 * Central place for website settings, auth providers, and features
 */
export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  supportEmail: string;
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

// Single source of truth for the support address (bot inbox).
export const SUPPORT_EMAIL = "tuapi@mail.grokbot.com";

export const siteConfig: SiteConfig = {
  name: "aidv.ai",
  description: "AI Video Generation Platform - Create stunning videos with Sora 2, Veo 3.1, and more",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://dreamutopia-video.pages.dev",
  ogImage: "/og.png",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || SUPPORT_EMAIL,
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
