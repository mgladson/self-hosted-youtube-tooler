import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { ViewerAuthProvider } from "@/components/ViewerAuthProvider";
import { BRAND, SITE_URL } from "@/lib/seo";

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: BRAND.themeColor,
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.shortName}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  generator: "Next.js",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  robots: { index: true, follow: true },
};

// Applies the persisted (or system-preferred) theme to <html> before first
// paint, so dark mode never flashes light on load. Kept in sync by ThemeToggle.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased [overflow-x:clip]"
      suppressHydrationWarning
    >
      <body className="bea-paper relative min-h-full font-body text-ink [overflow-x:clip]">
        {/* Warm up the origins used after a search (thumbnails, embedded player). */}
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ViewerAuthProvider>
          <div className="relative z-10 flex min-h-screen flex-col">
            {children}
          </div>
          <ScrollTopButton />
          <AnalyticsTracker />
        </ViewerAuthProvider>
      </body>
    </html>
  );
}
