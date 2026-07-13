import type { Metadata, Viewport } from "next";
import { spaceGrotesk, spaceMono, plexSans, plexMono } from "@/lib/fonts";
import ClientLayout from "@/components/client-layout";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141210",
};

const DESCRIPTION =
  "The operator's ledger of Matthew Dumas — applications, writing, and On Label, a weekly letter on all things consumer — CPG, health, and tech.";

export const metadata: Metadata = {
  title: "LNKD",
  description: DESCRIPTION,
  metadataBase: new URL("https://lnkd.world"),
  openGraph: {
    title: "LNKD",
    description: DESCRIPTION,
    url: "https://lnkd.world",
    siteName: "LNKD",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "LNKD",
    description: DESCRIPTION,
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
