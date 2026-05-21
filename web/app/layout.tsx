import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "World Conquest Quiz",
  description: "Conquiers le monde en tapant les noms de pays — quiz de géographie multijoueur en temps réel.",
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-ink-950 text-white antialiased bg-grid">
        {children}
      </body>
    </html>
  );
}
