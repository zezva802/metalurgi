"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/console", label: "Console" },
  { href: "/bank-app", label: "Bank app" },
  { href: "/agent", label: "Agent" },
  { href: "/audit", label: "Audit" },
  { href: "/nbg", label: "NBG" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1">
      {NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-lg font-medium ${
              active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
