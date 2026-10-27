// src/app/layout.tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Apex POS — Footwear Business Management",
  description:
    "Multi-shop footwear POS: billing, cashier shifts, shoe repair, customer returns and inter-branch transfers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={ibmPlexSans.variable} suppressHydrationWarning>
      <body
        style={{ fontFamily: "var(--font-ibm-plex), system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
