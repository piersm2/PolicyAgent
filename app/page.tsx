import Link from "next/link";
import { dashboardStats } from "@/lib/repo";
import { CategoryBadge, ChangeTypeBadge, ImpactBadge, StatusBadge } from "@/components/Badges";
import { formatDate, relativeDays, daysFromToday } from "@/lib/format";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent: string;
  href: string;
}) {
  return (
    <Link href={href} className="card p-4 transition hover:shadow-md">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent}`}>{value}</div>
    </Link>
  );
}

export default function DashboardPage() {
  const s = dashboardStats();
  const maxCat = Math.max(1, ...s.byCategory.map((c) => c.count));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Payer policy activity at a glance — what&apos;s changing and what needs attention.
          </p>
        </div>
        <Link href="/policies?new=1" className="btn-primary">
          + Add policy
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total Policies" value={s.totalPolicies} accent="text-slate-900" href="/policies" />
        <StatCard label="Active" value={s.activePolicies} accent="text-emerald-600" href="/policies?status=Active" />
        <StatCard label="Upcoming" value={s.upcomingPolicies} accent="text-amber-600" href="/policies?status=Upcoming" />
        <StatCard label="High Impact" value={s.highImpact} accent="text-red-600" href="/policies?impact=High" />
        <StatCard label="Payers" value={s.totalPayers} accent="text-brand-600" href="/payers" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming effective dates */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Effective within 90 days</h2>
            <span className="badge bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
              {s.upcomingEffective.length}
            </span>
          </div>
          {s.upcomingEffective.length === 0 ? (
            <EmptyLine text="No policies taking effect in the next 90 days." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.upcomingEffective.map((p) => {
                const days = daysFromToday(p.effectiveDate);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/policies/${p.id}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                        {p.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {p.payerName} · {p.category}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-slate-800">{formatDate(p.effectiveDate)}</div>
                      <div className={`text-xs ${days !== null && days <= 30 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                        {relativeDays(p.effectiveDate)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Review due */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Review due</h2>
            <span className="badge bg-red-50 text-red-700 ring-1 ring-inset ring-red-200">
              {s.reviewDue.length}
            </span>
          </div>
          {s.reviewDue.length === 0 ? (
            <EmptyLine text="Nothing due for review in the next 30 days." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.reviewDue.map((p) => {
                const days = daysFromToday(p.nextReviewDate);
                const overdue = days !== null && days < 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/policies/${p.id}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                        {p.title}
                      </Link>
                      <div className="text-xs text-slate-500">{p.payerName}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-slate-800">{formatDate(p.nextReviewDate)}</div>
                      <div className={`text-xs font-semibold ${overdue ? "text-red-600" : "text-amber-600"}`}>
                        {overdue ? `overdue ${Math.abs(days!)}d` : relativeDays(p.nextReviewDate)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent changes */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent changes</h2>
            <Link href="/changes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all →
            </Link>
          </div>
          <ul className="space-y-3">
            {s.recentChanges.map((c) => (
              <li key={c.id} className="flex gap-3">
                <div className="mt-0.5">
                  <ChangeTypeBadge type={c.changeType} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-slate-800">{c.summary}</div>
                  <div className="text-xs text-slate-500">
                    {c.payerName} · {c.policyTitle} · {formatDate(c.changeDate)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* By category */}
        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Policies by category</h2>
          <ul className="space-y-2.5">
            {s.byCategory.map((c) => (
              <li key={c.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{c.category}</span>
                  <span className="font-medium text-slate-500">{c.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(c.count / maxCat) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
}
