"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { formatDate, safeHref } from "@/lib/format";
import type { HistoryEntry } from "@/lib/history";

const TYPE_LABELS: Record<string, string> = {
  new: "New policy",
  revised: "Revised",
  retired: "Retired",
  reimbursement: "Reimbursement",
  prior_authorization: "Prior auth",
  coverage: "Coverage",
  coding: "Coding",
  administrative: "Administrative",
  other: "Other",
};

const RELEVANCE_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-400",
  low: "bg-slate-300",
};

function monthKey(e: HistoryEntry): string {
  return (e.publishedDate ?? e.effectiveDate ?? "").slice(0, 7);
}

function monthLabel(key: string): string {
  if (!key) return "Date unknown";
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function HistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function track(id: number) {
    setBusy(id);
    setError(null);
    try {
      const { policyId } = await apiSend<{ policyId: number }>(`/api/history/entries/${id}/track`, "POST");
      router.push(`/policies/${policyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the policy");
      setBusy(null);
    }
  }

  const months: [string, HistoryEntry[]][] = [];
  for (const e of entries) {
    const key = monthKey(e);
    const last = months[months.length - 1];
    if (last && last[0] === key) last[1].push(e);
    else months.push([key, [e]]);
  }

  if (!entries.length) {
    return (
      <div className="card p-10 text-center text-sm text-slate-400">
        No history yet. Import past bulletins above, or loosen the filters.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {months.map(([key, list]) => (
        <section key={key || "unknown"}>
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-slate-500">
            {monthLabel(key)} <span className="font-semibold text-slate-400">· {list.length}</span>
          </h3>
          <ul className="card divide-y divide-slate-100">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${RELEVANCE_DOT[e.relevance] ?? "bg-slate-300"}`} title={`${e.relevance} relevance`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-slate-100 text-slate-700">{TYPE_LABELS[e.changeType] ?? e.changeType}</span>
                    <span className="font-bold text-slate-900">{e.policyName}</span>
                    {e.policyNumber && <span className="text-xs text-slate-400">{e.policyNumber}</span>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{e.summary}</p>
                  <div className="mt-1 text-xs text-slate-500">
                    {e.payerName}
                    {e.effectiveDate && <> · Effective {formatDate(e.effectiveDate)}</>}
                    {" · "}
                    {safeHref(e.sourceUrl) ? (
                      <a href={safeHref(e.sourceUrl)!} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                        {e.sourceTitle} ↗
                      </a>
                    ) : (
                      e.sourceTitle
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {e.policyId ? (
                    <Link href={`/policies/${e.policyId}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                      Tracked →
                    </Link>
                  ) : (
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={busy !== null} onClick={() => track(e.id)}>
                      {busy === e.id ? "Adding…" : "Track"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
