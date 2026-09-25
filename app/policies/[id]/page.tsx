import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicy, listChangesForPolicy } from "@/lib/repo";
import { CategoryBadge, ChangeTypeBadge, ImpactBadge, StatusBadge } from "@/components/Badges";
import { AddChange } from "@/components/AddChange";
import { formatDate, relativeDays, safeHref } from "@/lib/format";

export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}

export default function PolicyDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const policy = getPolicy(id);
  if (!policy) notFound();
  const changes = listChangesForPolicy(id);
  const sourceHref = safeHref(policy.sourceUrl);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/policies" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← All policies
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={policy.status} />
              <ImpactBadge impact={policy.impact} />
              <CategoryBadge category={policy.category} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{policy.title}</h1>
            <div className="mt-1 text-sm text-slate-500">
              <Link href={`/policies?payerId=${policy.payerId}`} className="hover:text-brand-700">
                {policy.payerName}
              </Link>
              {policy.policyNumber && <> · {policy.policyNumber}</>}
              {policy.version && <> · {policy.version}</>}
            </div>
          </div>
          <div className="flex gap-2">
            {sourceHref && (
              <a href={sourceHref} target="_blank" rel="noreferrer" className="btn-primary text-sm">
                Open source ↗
              </a>
            )}
          </div>
        </div>

        {policy.summary && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">{policy.summary}</p>
        )}

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Effective date">
            {formatDate(policy.effectiveDate)}
            {policy.effectiveDate && (
              <span className="ml-1 text-xs text-slate-400">({relativeDays(policy.effectiveDate)})</span>
            )}
          </Field>
          <Field label="End date">{formatDate(policy.endDate)}</Field>
          <Field label="Next review">
            {formatDate(policy.nextReviewDate)}
            {policy.nextReviewDate && (
              <span className="ml-1 text-xs text-slate-400">({relativeDays(policy.nextReviewDate)})</span>
            )}
          </Field>
          <Field label="Last updated">{formatDate(policy.updatedAt)}</Field>
        </div>
      </div>

      {/* Change history */}
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Change history</h2>
            <p className="text-sm text-slate-500">
              {changes.length} {changes.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <AddChange policyId={policy.id} />
        </div>

        {changes.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No changes logged yet. Use “Log change” to start a history.
          </p>
        ) : (
          <ol className="relative space-y-5 border-l-2 border-slate-100 pl-6">
            {changes.map((c) => (
              <li key={c.id} className="relative">
                <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
                <div className="flex flex-wrap items-center gap-2">
                  <ChangeTypeBadge type={c.changeType} />
                  <span className="text-sm font-medium text-slate-700">{formatDate(c.changeDate)}</span>
                  {c.version && <span className="text-xs text-slate-400">{c.version}</span>}
                  {c.notedBy && <span className="text-xs text-slate-400">· {c.notedBy}</span>}
                </div>
                <p className="mt-1 text-sm text-slate-700">{c.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
