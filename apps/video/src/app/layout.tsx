import localFont from "next/font/local";
import { getLocale, getMessages } from "next-intl/server";

import "@/styles/theme.css";
import "@/styles/globals.css";
import "@/styles/hf-theme.css";
import "@/styles/hf-video-tokens.css";
import "@/styles/hf-home-tokens.css";
import "@/styles/ds.css";
import "@/styles/typography.css";
import "@/styles/motion.css";
import "@/styles/states.css";
import "@/styles/touch.css";

import { NextIntlClientProvider } from "next-intl";

import { cn } from "@/components/ui";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { ModalProvider } from "@/components/modal-provider";

import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { PlausibleAnalytics } from "@/components/plausible-provider";
import { AttributionCapture } from "@/components/attribution-capture";
import { RouteProgress } from "@/components/route-progress";
import { i18n } from "@/config/i18n-config";
import { getSiteTitle, siteConfig } from "@/config/site";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";
import { defaultShareImages, openGraphLocale } from "@/lib/seo";
import { jsonLd, siteGraph } from "@/lib/structured-data";

// Self-hosted variable fonts (latin subset) so every build gets the real
// faces without fetching Google Fonts. Chinese falls back to the system font.
const fontSans = localFont({
  src: "../styles/fonts/Inter-Variable-latin.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
});

const fontDisplay = localFont({
  src: "../styles/fonts/SpaceGrotesk-Variable-latin.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-display",
});

// Font files can be colocated inside of `pages`
const fontHeading = localFont({
  src: "../styles/fonts/CalSans-SemiBold.woff2",
  variable: "--font-heading",
});

const defaultSiteTitle = getSiteTitle();

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

const baseMetadata = {
  title: {
    default: defaultSiteTitle,
    template: `%s | ${defaultSiteTitle}`,
  },
  description: siteConfig.description,
  keywords: [
    "AI video generator",
    "text to video",
    "image to video",
    "AI video",
    "video generation",
    "AI tools",
  ],
  authors: [
    {
      name: siteConfig.name,
    },
  ],
  creator: siteConfig.name,
  // No og:url here: a page without its own openGraph would otherwise share
  // the homepage's address. Pages that set openGraph give their own url.
  openGraph: {
    type: "website",
    title: defaultSiteTitle,
    description: siteConfig.description,
    siteName: defaultSiteTitle,
    images: defaultShareImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: defaultSiteTitle,
    description: siteConfig.description,
    images: defaultShareImages(),
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  metadataBase: new URL(siteConfig.url),
};

export async function generateMetadata() {
  const locale = await getLocale();
  const siteTitle = getSiteTitle(locale);

  return {
    ...baseMetadata,
    title: {
      default: siteTitle,
      template: `%s | ${siteTitle}`,
    },
    openGraph: {
      ...baseMetadata.openGraph,
      ...openGraphLocale(locale),
      title: siteTitle,
      siteName: siteTitle,
    },
    twitter: {
      ...baseMetadata.twitter,
      title: siteTitle,
    },
    robots: isNoIndexEnvironment()
      ? NOINDEX_ROBOTS
      : { index: true, follow: true },
  };
}

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({
  children,
}: RootLayoutProps) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(siteGraph()),
          }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontDisplay.variable,
          fontHeading.variable,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <PlausibleAnalytics />
              <AttributionCapture />
              <RouteProgress />
              <ModalProvider>{children}</ModalProvider>
              <Toaster richColors position="top-right" offset={{ top: 64, right: 16 }} />
              <TailwindIndicator />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
