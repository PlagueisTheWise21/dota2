import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { SiteBackground } from "@/components/SiteBackground";
import { getSiteSettings } from "@/lib/site-settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Condensed display font for headings (use with the "font-display" class).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

/** The live site's address (Vercel sets this), for full URLs in link previews. */
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

/**
 * Tab title and icon come from the admin page's Site settings
 * (lib/site-settings.ts). Pages set their own part of the title, e.g. an
 * event's name, and get " | <site title>" added.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { site_title, favicon_url } = await getSiteSettings();
  const description = "Tier lists and pick'ems for Dota 2 events: rank the teams and call the results.";
  return {
    // Turns relative image paths into full URLs for link previews.
    metadataBase: new URL(SITE_URL),
    title: { default: site_title, template: `%s | ${site_title}` },
    description,
    icons: { icon: favicon_url ?? "/favicon.ico" },
    // Link previews on Discord, X, etc. Event pages replace these with their own.
    openGraph: {
      type: "website",
      siteName: site_title,
      title: site_title,
      description,
      images: [{ url: "/og", width: 1200, height: 630, alt: site_title }],
    },
    twitter: { card: "summary_large_image", title: site_title, description, images: ["/og"] },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteBackground />
        {children}
      </body>
    </html>
  );
}
