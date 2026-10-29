import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { CartProvider } from "@/components/cart-provider";
import { SiteNavShell } from "@/components/site-nav-shell";
import { SiteFooter } from "@/components/site-footer";
import { SiteOcean } from "@/components/site-ocean";
import { SiteOrnaments } from "@/components/site-ornaments";
import { Suspense } from "react";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "mars",
  description: "mars — posters, commissions, and visual work.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          enableColorScheme={false}
          disableTransitionOnChange
        >
          <CartProvider>
            <div className="site-layout">
              <a className="ocean-skip-link" href="#ocean-controls">Skip to animation controls</a>
              <Suspense fallback={null}>
                <SiteNavShell />
              </Suspense>
              <SiteOrnaments />
              {children}
              <SiteOcean />
              <SiteFooter />
            </div>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
