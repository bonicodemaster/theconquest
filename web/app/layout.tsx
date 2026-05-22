import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter_Tight, Fraunces, JetBrains_Mono } from "next/font/google";

const sans = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
  display: "swap",
});
const serif = Fraunces({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-serif",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "World Conquest Quiz",
  description:
    "Conquiers le monde en tapant les noms de pays — quiz de géographie multijoueur en temps réel.",
};

export const viewport: Viewport = {
  themeColor: "#f5f0e6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
