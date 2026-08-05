import Link from "next/link";
import { recentChanges } from "@/lib/repo";
import { ChangeTypeBadge } from "@/components/Badges";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function ChangesPage() {
  const changes = recentChanges(100);

  // Group by calendar date for a readable feed.
  const groups = new Map<string, typeof changes>();
  for (const c of changes) {
    const key = c.changeDate.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Change Log</h1>
        <p className="text-sm text-slate-500">
          Every logged policy change across all payers, newest first.
        </p>
      </div>

      {changes.length === 0 ? (
        <div className="card p-12 text-center text-sm text-slate-400">No changes logged yet.</div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([date, items]) => (
            <div key={date}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {formatDate(date)}
              </div>
              <div className="card divide-y divide-slate-100">
                {items.map((c) => (
                  <div key={c.id} className="flex gap-3 p-4">
                    <div className="pt-0.5">
                      <ChangeTypeBadge type={c.changeType} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{c.summary}</p>
                      <div className="mt-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-600">{c.payerName}</span>
                        {" · "}
                        <Link href={`/policies/${c.policyId}`} className="hover:text-brand-700">
                          {c.policyTitle}
                        </Link>
                        {c.version && <> · {c.version}</>}
                        {c.notedBy && <> · {c.notedBy}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
