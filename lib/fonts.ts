import { Space_Grotesk, Space_Mono, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// Site-wide ledger identity: Space Grotesk display, Space Mono data/labels,
// Georgia (system) body — matching the On Label newsletter template.
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-mono",
});

// Growth-console voice (admin dashboard only) — not preloaded so the public
// site pays nothing for them.
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
  preload: false,
});
