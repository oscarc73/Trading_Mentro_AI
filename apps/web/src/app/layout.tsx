import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Mentor AI — Historical Simulator",
  description:
    "Practice deterministic trading decisions with generated historical candles.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
