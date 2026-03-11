import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Origin — Coffee Discovery",
  description: "Discover and compare coffees from Indian specialty roasters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
