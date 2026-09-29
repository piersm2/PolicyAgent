"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Icon = () => JSX.Element;

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Overview", icon: GridIcon },
  { href: "/policies", label: "Policies", icon: DocIcon },
  { href: "/payers", label: "Payers", icon: BuildingIcon },
  { href: "/watch", label: "Watch list", icon: RadarIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Dark app sidebar on large screens; a top bar with the same links on small ones. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-900 px-4 py-6 lg:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <LogoMark />
          <span className="text-[15px] font-bold leading-tight tracking-tight text-white">
            Payer Policy
            <br />
            Watch
          </span>
        </Link>

        <nav className="mt-10 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className={active ? "text-brand-300" : ""}>
                  <Icon />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 px-2">
          <a
            href="/api/feed?format=md"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            <FeedIcon />
            Open feed
            <span className="ml-auto text-slate-500">↗</span>
          </a>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Sample data is illustrative and not a substitute for the payer&apos;s official policy documentation.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 bg-ink-900 lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark small />
            <span className="text-sm font-bold tracking-tight text-white">Payer Policy Watch</span>
          </Link>
          <a href="/api/feed?format=md" target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold text-slate-400">
            Feed ↗
          </a>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                isActive(pathname, href) ? "bg-white/10 text-white" : "text-slate-400"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}

function LogoMark({ small }: { small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-900/40 ${
        small ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      <svg viewBox="0 0 24 24" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="8" strokeOpacity="0.5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 12l5.5-5.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.8" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.8" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.8" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...iconProps}>
      <path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3.5 20.5h17M5.5 20.5v-14l6.5-3 6.5 3v14" />
      <path d="M9.5 10h.01M14.5 10h.01M9.5 14h.01M14.5 14h.01M10.5 20.5v-3h3v3" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" />
      <circle cx="6" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
