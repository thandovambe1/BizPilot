import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeInit } from "@/components/theme-init";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "BizPilot — Your AI business manager for South African SMEs",
    template: "%s · BizPilot",
  },
  description:
    "BizPilot is the AI business manager for South African service businesses. It handles your WhatsApp enquiries, leads, quotes, bookings, invoices and follow-ups — so you can focus on running your business. AI receptionist, AI CRM, smart scheduling and invoicing built for SA.",
  keywords: [
    "AI business manager South Africa",
    "AI receptionist South Africa",
    "AI CRM South Africa",
    "WhatsApp business automation South Africa",
    "AI for small businesses South Africa",
    "AI for plumbers",
    "AI for electricians",
    "AI business software South Africa",
  ],
  openGraph: {
    title: "BizPilot — Your AI business manager",
    description: "Never miss a customer again. BizPilot handles your leads, WhatsApp, quotes, bookings, invoices and follow-ups.",
    type: "website",
    locale: "en_ZA",
    siteName: "BizPilot",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/icons/icon-512.png", apple: "/icons/icon-512.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInit />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function () {});
              });
            }`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${grotesk.variable} font-sans bg-canvas text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
