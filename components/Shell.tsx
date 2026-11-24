"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/live", label: "Console" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/archive", label: "Archive" },
];

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`block border-l-2 px-3 py-2 font-display text-lg uppercase tracking-wide ${active ? "border-pit-red bg-white/[0.04] text-pit-text" : "border-transparent text-pit-muted hover:border-pit-line hover:text-pit-text"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-pit-red`}
    >
      {label}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const live = pathname.startsWith("/live");
  return (
    <div className="flex h-dvh flex-col lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden border-r border-pit-line bg-pit-sunken lg:flex lg:flex-col">
        <Link href="/" className="block px-4 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pit-red">
          <span className="font-display text-xs uppercase tracking-[0.22em] text-pit-red">Unofficial</span>
          <span className="mt-1 block font-display text-4xl uppercase leading-none">Pitwall</span>
        </Link>
        <nav className="mt-2 flex-1 space-y-1 px-2">
          {LINKS.map((link) => (
            <NavLink key={link.href} {...link} pathname={pathname} />
          ))}
        </nav>
        <p className="px-4 py-4 text-xs leading-relaxed text-pit-dim">
          Pitwall is an unofficial fan project and is not affiliated with Formula 1, the FIA, or the teams.
        </p>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-hidden">
        <header className="flex items-center justify-between border-b border-pit-line px-4 py-3 lg:hidden">
          <Link href="/" className="font-display text-2xl uppercase leading-none">
            Pitwall
          </Link>
          <span className="text-xs uppercase tracking-[0.16em] text-pit-muted">Fan timing</span>
        </header>
        <div className={live ? "min-h-0 min-w-0 flex-1 lg:overflow-hidden" : "min-w-0 flex-1 pb-20 lg:overflow-y-auto lg:pb-0"}>{children}</div>
      </div>
      {!live && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-pit-line bg-[#14161b]/95 backdrop-blur lg:hidden">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={`px-1 py-3 text-center font-display text-sm uppercase tracking-wide ${active ? "text-pit-red" : "text-pit-muted"}`}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
