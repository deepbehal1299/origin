import type { Metadata } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Origin — Coffee Discovery",
  description: "Discover and compare coffees from Indian specialty roasters",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 antialiased">
        <ServiceWorkerRegistrar />
        <div className="mx-auto min-h-screen max-w-3xl px-4 pb-24 pt-4">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
