import Link from "next/link";
import { getBoard } from "@/lib/board";
import { ImpactBadge, StatusBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";
import { listPageChanges } from "@/lib/watch";
import { WebsiteChanges } from "@/components/WebsiteChanges";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { counts, needsAttention, recentChanges } = getBoard();
  const websiteChanges = listPageChanges({ unreviewedOnly: true, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Home</h1>
          <p className="text-sm text-slate-500">
            {counts.policies} policies · {counts.upcoming} upcoming · {counts.highImpact} high impact ·{" "}
            {counts.payers} payers
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/feed?format=md" target="_blank" className="btn-ghost">
            Open feed
          </a>
          <Link href="/policies?new=1" className="btn-primary">
            + Add policy
          </Link>
        </div>
      </div>

      {websiteChanges.length > 0 && <WebsiteChanges changes={websiteChanges} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="font-semibold text-slate-900">Needs attention</h2>
          <p className="mb-4 text-xs text-slate-500">Ranked by impact, upcoming dates, and recent changes.</p>
          {needsAttention.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No policies yet. Add one to get started.</p>
          ) : (
            <ol className="space-y-4">
              {needsAttention.map((p, i) => (
                <li key={p.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/policies/${p.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                        {p.title}
                      </Link>
                      <StatusBadge status={p.status} />
                      <ImpactBadge impact={p.impact} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.payerName} · {p.category}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.reasons.map((r) => (
                        <span
                          key={r}
                          className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-inset ring-slate-200"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Recent changes</h2>
          {recentChanges.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No changes logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentChanges.map((c) => (
                <li key={c.id}>
                  <div className="text-sm text-slate-800">{c.summary}</div>
                  <div className="text-xs text-slate-500">
                    <Link href={`/policies/${c.policyId}`} className="hover:text-brand-700">
                      {c.payerName} · {c.policyTitle}
                    </Link>{" "}
                    · {formatDate(c.changeDate)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
