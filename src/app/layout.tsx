import type { Metadata, Viewport } from "next";
import { Caveat, DM_Mono, DM_Sans, DM_Serif_Display } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { env } from "@/lib/env";
import "./globals.css";

const serif = DM_Serif_Display({ variable: "--font-dm-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const sans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });
const hand = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "dogear. — leave a little piece of yourself in every book", template: "%s · dogear." },
  description: "A social network for readers. Shelves, reviews, quotes and lists that look like you.",
  applicationName: "dogear.",
  openGraph: { siteName: "dogear.", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#f5f0e7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${serif.variable} ${sans.variable} ${mono.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
