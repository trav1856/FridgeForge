import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Nav } from "@/components/Nav";
import { StruggleModeProvider } from "@/components/StruggleModeProvider";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "FridgeForge Community Edition — Cook what you have",
  description:
    "FridgeForge Community Edition (stable). Turn pantry staples into great meals with smart suggestions and Struggle Meal mode.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/Favorite.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <StruggleModeProvider>
          <Suspense fallback={<header className="h-24 border-b border-cream-300/70 bg-cream-50/90" />}>
            <Nav />
          </Suspense>
          <main className="mx-auto max-w-5xl px-4 py-6 pb-16">{children}</main>
        </StruggleModeProvider>
      </body>
    </html>
  );
}
