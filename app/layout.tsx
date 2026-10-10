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

/**
 * Tab title and icon come from the admin page's Site settings
 * (lib/site-settings.ts). Pages set their own part of the title, e.g. an
 * event's name, and get " | <site title>" added.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { site_title, favicon_url } = await getSiteSettings();
  return {
    title: { default: site_title, template: `%s | ${site_title}` },
    description: "Browse Dota 2 esports events, rank the teams and predict the results.",
    icons: { icon: favicon_url ?? "/favicon.ico" },
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
