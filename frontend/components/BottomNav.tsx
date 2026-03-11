"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Feed" },
  { href: "/compare", label: "Compare" },
  { href: "/settings", label: "Settings" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [mockEnabled, setMockEnabled] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setMockEnabled(query.get("mock") === "1");
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl items-center justify-around px-4 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const href = mockEnabled ? `${item.href}?mock=1` : item.href;
          return (
            <li key={item.href}>
              <Link
                href={href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
