import type { Metadata, Viewport } from "next";
import { playfair, lora } from "@/lib/fonts";
import ClientLayout from "@/components/client-layout";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B3A5C",
};

export const metadata: Metadata = {
  title: "LNKD",
  description: "Philosophy, politics, and ideas worth exploring",
  metadataBase: new URL("https://lnkd.world"),
  openGraph: {
    title: "LNKD",
    description: "Philosophy, politics, and ideas worth exploring",
    url: "https://lnkd.world",
    siteName: "LNKD",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "LNKD",
    description: "Philosophy, politics, and ideas worth exploring",
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
    <html lang="en" className={`${playfair.variable} ${lora.variable}`}>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
