import Link from "next/link";
import { NavLinks } from "./nav-links";

export function SyntheticBadge() {
  return (
    <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">
      Synthetic data
    </span>
  );
}

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/console" className="text-2xl font-bold text-slate-900">
            Metalurgi <span className="font-normal text-slate-500">· Bank gateway</span>
          </Link>
          <SyntheticBadge />
        </div>
        <NavLinks />
      </div>
    </header>
  );
}
