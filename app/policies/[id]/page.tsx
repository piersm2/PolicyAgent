import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicy, listChangesForPolicy, listPayers } from "@/lib/repo";
import { getPolicyWatch, listPageChanges } from "@/lib/watch";
import { CategoryBadge, ImpactBadge, StatusBadge } from "@/components/Badges";
import { AddChange } from "@/components/AddChange";
import { ActionCard, PolicyHeaderActions } from "@/components/PolicyControls";
import { WebsiteChanges } from "@/components/WebsiteChanges";
import { daysFromToday, formatDate, formatDateTime, relativeDays } from "@/lib/format";

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
  const watch = getPolicyWatch(id);
  const documentChanges = listPageChanges({ policyId: id, unreviewedOnly: true });
  const reviewDue = daysFromToday(policy.nextReviewDate);
  const reviewOverdue = reviewDue !== null && reviewDue < 0;

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
            </div>
          </div>
          <PolicyHeaderActions policy={policy} payers={listPayers()} />
        </div>

        {policy.summary && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700">{policy.summary}</p>
        )}

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <Field label="Effective date">
            {formatDate(policy.effectiveDate)}
            {policy.effectiveDate && (
              <span className="ml-1 text-xs text-slate-400">({relativeDays(policy.effectiveDate)})</span>
            )}
          </Field>
          <Field label="Next review">
            {formatDate(policy.nextReviewDate)}
            {policy.nextReviewDate && (
              <span className={`ml-1 text-xs ${reviewOverdue ? "font-semibold text-red-600" : "text-slate-400"}`}>
                ({reviewOverdue ? `overdue ${Math.abs(reviewDue!)}d` : relativeDays(policy.nextReviewDate)})
              </span>
            )}
            <div className="text-xs text-slate-400">
              every {policy.reviewEveryMonths} month{policy.reviewEveryMonths === 1 ? "" : "s"}
            </div>
          </Field>
          <Field label="Last reviewed">{formatDate(policy.lastReviewedAt)}</Field>
          <Field label="Last updated">{formatDateTime(policy.updatedAt)}</Field>
        </div>
      </div>

      <ActionCard policy={policy} payers={listPayers()} />

      {/* The policy's own document */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Policy document</h2>
        {!policy.sourceUrl ? (
          <p className="mt-1 text-sm text-slate-400">No document link. Edit the policy to add one and watch it.</p>
        ) : !watch ? (
          <p className="mt-1 text-sm text-slate-500">
            <span className="break-all">{policy.sourceUrl}</span>
            <br />
            Not watched. Edit the policy and tick “Watch this document for changes”.
          </p>
        ) : (
          <div className="mt-1 text-sm">
            <p className="break-all text-slate-500">{watch.url}</p>
            {watch.lastError ? (
              <p className="text-red-600">Last check failed: {watch.lastError}</p>
            ) : watch.lastSuccessAt ? (
              <p className="text-slate-500">
                Watched · last checked {formatDateTime(watch.lastCheckedAt)}
                {watch.lastNote && <span className="block text-amber-700">{watch.lastNote}</span>}
              </p>
            ) : (
              <p className="text-slate-400">Watched · not checked yet (the first check records a starting point)</p>
            )}
          </div>
        )}
      </div>

      {documentChanges.length > 0 && (
        <WebsiteChanges
          changes={documentChanges}
          title="Document changes to review"
          subtitle="Differences found in this policy's document since it was last reviewed."
        />
      )}

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
                <div className="text-sm font-medium text-slate-700">{formatDate(c.changeDate)}</div>
                <p className="mt-1 text-sm text-slate-700">{c.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
