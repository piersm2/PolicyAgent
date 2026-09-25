import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolicyAgent — Payer Policy Tracker",
  description:
    "Track health-plan medical, reimbursement, and coverage policies, their effective dates, and change history.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/briefing", label: "Briefing" },
  { href: "/policies", label: "Policies" },
  { href: "/payers", label: "Payers" },
  { href: "/changes", label: "Change Log" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path
                      d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="leading-tight">
                  <div className="font-semibold text-slate-900">PolicyAgent</div>
                  <div className="text-xs text-slate-500">Payer Policy Tracker</div>
                </div>
              </Link>
              <nav className="flex items-center gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
            PolicyAgent · Local demo tracker · Data is illustrative and not a substitute for the payer&apos;s
            official policy documentation.
          </footer>
        </div>
      </body>
    </html>
  );
}
