import { Inter as FontSans, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { getLocale, getMessages } from "next-intl/server";

import "@/styles/theme.css";
import "@/styles/globals.css";
import "@/styles/hf-theme.css";
import "@/styles/hf-video-tokens.css";
import "@/styles/hf-home-tokens.css";

import { NextIntlClientProvider } from "next-intl";

import { cn } from "@/components/ui";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";

import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { PlausibleAnalytics } from "@/components/plausible-provider";
import { AttributionCapture } from "@/components/attribution-capture";
import { i18n } from "@/config/i18n-config";
import { getSiteTitle, siteConfig } from "@/config/site";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
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
    "AI image generator",
    "AI music generator",
    "Seedance",
    "Seedance 2.0 mini",
    "text to video",
    "image to video",
    "AI video",
    "video generation",
    "aivd.ai",
  ],
  authors: [
    {
      name: siteConfig.name,
    },
  ],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: defaultSiteTitle,
    description: siteConfig.description,
    siteName: defaultSiteTitle,
  },
  twitter: {
    card: "summary_large_image",
    title: defaultSiteTitle,
    description: siteConfig.description,
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
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: siteConfig.name,
                  url: siteConfig.url,
                  description: siteConfig.description,
                  inLanguage: ["en", "zh"],
                },
                {
                  "@type": "Organization",
                  name: siteConfig.name,
                  url: siteConfig.url,
                  logo: `${siteConfig.url}/logo.svg`,
                },
              ],
            }),
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
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <PlausibleAnalytics />
              <AttributionCapture />
              {children}
              <Toaster richColors position="top-right" />
              <TailwindIndicator />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
