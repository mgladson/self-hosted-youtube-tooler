import type { Metadata, Viewport } from "next";
import {
  Inter,
  JetBrains_Mono,
  Noto_Sans_Myanmar,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { ViewerAuthProvider } from "@/components/ViewerAuthProvider";
import { BRAND, SITE_URL } from "@/lib/seo";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const notoMyanmar = Noto_Sans_Myanmar({
  variable: "--font-noto-myanmar",
  subsets: ["myanmar"],
  weight: ["400", "500", "700"],
  preload: false,
});

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
      className={`${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} ${notoMyanmar.variable} h-full antialiased [overflow-x:clip]`}
      suppressHydrationWarning
    >
      <body className="bea-paper relative min-h-full font-body text-ink [overflow-x:clip]">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <LanguageProvider>
          <ViewerAuthProvider>
            <div className="relative z-10 flex min-h-screen flex-col">
              {children}
            </div>
            <ScrollTopButton />
            <AnalyticsTracker />
          </ViewerAuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
