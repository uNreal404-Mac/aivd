import { notFound } from "next/navigation";
import { Inter as FontSans, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import "@/styles/theme.css";
import "@/styles/globals.css";
import "@/styles/hf-theme.css";
import "@/styles/hf-video-tokens.css";
import "@/styles/hf-home-tokens.css";

import { cn } from "@/components/ui";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";

import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "@/components/theme-provider";
import { PlausibleAnalytics } from "@/components/plausible-provider";
import { AttributionCapture } from "@/components/attribution-capture";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/site";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

// Font files can be colocated inside of `pages`
const fontHeading = localFont({
  src: "../../styles/fonts/CalSans-SemiBold.woff2",
  variable: "--font-heading",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const baseMetadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
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
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
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
  return {
    ...baseMetadata,
    robots: isNoIndexEnvironment()
      ? NOINDEX_ROBOTS
      : { index: true, follow: true },
  };
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

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
          <NextIntlClientProvider locale={locale} messages={messages}>
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
