"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import type { ImportJob } from "@/lib/history";

export interface ListingPage {
  id: number;
  label: string;
  payerName: string;
}

type JobView = ImportJob & { estimateHigh: number | null };

const ACTIVE = new Set(["discovering", "queued", "running"]);

const STATUS: Record<ImportJob["status"], { label: string; style: string }> = {
  discovering: { label: "Finding bulletins", style: "bg-brand-50 text-brand-700" },
  ready: { label: "Ready to import", style: "bg-amber-100 text-amber-800" },
  queued: { label: "In queue", style: "bg-slate-100 text-slate-600" },
  running: { label: "Importing", style: "bg-brand-600 text-white" },
  done: { label: "Done", style: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Stopped", style: "bg-rose-50 text-rose-700" },
  cancelled: { label: "Cancelled", style: "bg-slate-100 text-slate-500" },
  cowork: { label: "Waiting for Cowork", style: "bg-amber-100 text-amber-800" },
};

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "n/a";
  return n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
}

export function HistoryImport({ pages, jobs, aiOn }: { pages: ListingPage[]; jobs: JobView[]; aiOn: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePages = useMemo(
    () =>
      new Set(jobs.filter((j) => ACTIVE.has(j.status) || j.status === "ready" || j.status === "cowork").map((j) => j.pageId)),
    [jobs]
  );
  const anyActive = jobs.some((j) => ACTIVE.has(j.status));
  const ready = jobs.filter((j) => j.status === "ready");

  // Keep progress fresh while something is running.
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [anyActive, router]);

  const byPayer = useMemo(() => {
    const groups = new Map<string, ListingPage[]>();
    for (const p of pages) groups.set(p.payerName, [...(groups.get(p.payerName) ?? []), p]);
    return Array.from(groups.entries());
  }, [pages]);

  async function call(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectable = pages.filter((p) => !activePages.has(p.id));

  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold text-slate-900">Import past bulletins</h2>
      <p className="mt-1 text-sm text-slate-500">
        {aiOn
          ? "Pick payer pages that list bulletins, notices, or transmittals. Claude finds what was published in the chosen period and shows the count and estimated cost before anything is imported."
          : "Pick payer pages that list bulletins, notices, or transmittals. Your daily Cowork task finds what was published in the chosen period and reads a few bulletins each day (see the Cowork tasks page)."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byPayer.map(([payer, list]) => (
          <div key={payer} className="rounded-xl border border-slate-200 p-3">
            <div className="text-sm font-bold text-slate-800">{payer}</div>
            <ul className="mt-1.5 space-y-1">
              {list.map((p) => {
                const queued = activePages.has(p.id);
                return (
                  <li key={p.id}>
                    <label className={`flex items-start gap-2 text-sm ${queued ? "text-slate-400" : "cursor-pointer text-slate-600"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={queued}
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                      <span>
                        {p.label}
                        {queued && <span className="ml-1 text-xs">(in the queue)</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-ghost text-sm"
          onClick={() =>
            setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((p) => p.id)))
          }
          disabled={!selectable.length}
        >
          {selected.size === selectable.length && selectable.length ? "Clear" : "Select all"}
        </button>
        <select className="input w-auto" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {[3, 6, 12, 24].map((m) => (
            <option key={m} value={m}>
              Last {m} months
            </option>
          ))}
        </select>
        <button
          className="btn-primary text-sm"
          disabled={busy || selected.size === 0}
          onClick={() =>
            call(async () => {
              await apiSend("/api/history/jobs", "POST", { pageIds: Array.from(selected), months });
              setSelected(new Set());
            })
          }
        >
          {aiOn ? "Find past bulletins" : "Queue for Cowork"}
          {selected.size ? ` (${selected.size})` : ""}
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {jobs.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900">Import queue</h3>
            {ready.length > 1 && (
              <button
                className="btn-primary text-sm"
                disabled={busy}
                onClick={() => call(() => apiSend("/api/history/start-all", "POST"))}
              >
                Start all {ready.length} (about {money(ready.reduce((n, j) => n + (j.estimatedCost ?? 0), 0))})
              </button>
            )}
          </div>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {jobs.map((j) => (
              <JobRow key={j.id} job={j} busy={busy} act={(action) => call(() => apiSend(`/api/history/jobs/${j.id}`, "POST", { action }))} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function JobRow({ job: j, busy, act }: { job: JobView; busy: boolean; act: (a: "start" | "cancel" | "retry") => void }) {
  const s = STATUS[j.status];
  const processed = j.docsDone + j.docsFailed;
  const pct = j.docsFound ? Math.round((processed / j.docsFound) * 100) : 0;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800">
            {j.payerName} — {j.pageLabel}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Since {j.sinceDate}
            {j.status === "discovering" && " · Claude is reading the page and its archive…"}
            {j.status === "cowork" &&
              ` · Imported by your daily Cowork task · ${j.docsDone} bulletin${j.docsDone === 1 ? "" : "s"} read · ${j.entriesFound} change${
                j.entriesFound === 1 ? "" : "s"
              } found`}
            {j.status === "ready" &&
              ` · Found ${j.docsFound} document${j.docsFound === 1 ? "" : "s"} · about ${money(j.estimatedCost)}${
                j.estimateHigh ? ` (up to ${money(j.estimateHigh)} if they're long)` : ""
              }`}
            {["queued", "running", "done", "cancelled", "failed"].includes(j.status) &&
              j.docsFound > 0 &&
              ` · ${j.docsDone} of ${j.docsFound} read · ${j.entriesFound} change${j.entriesFound === 1 ? "" : "s"} found`}
            {j.docsFailed > 0 && ` · ${j.docsFailed} failed`}
            {(j.spent ?? 0) > 0 && ` · ${money(j.spent)} spent`}
          </div>
          {j.error && <div className="mt-1 text-xs text-rose-600">{j.error}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${s.style}`}>{s.label}</span>
          {j.status === "ready" && (
            <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => act("start")}>
              Start import
            </button>
          )}
          {["discovering", "ready", "queued", "running", "cowork"].includes(j.status) && (
            <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act("cancel")}>
              Cancel
            </button>
          )}
          {(j.status === "failed" || j.status === "cancelled" || (j.status === "done" && j.docsFailed > 0)) && (
            <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act("retry")}>
              {j.status === "cancelled" ? "Resume" : "Retry failed"}
            </button>
          )}
        </div>
      </div>
      {(j.status === "running" || j.status === "queued") && j.docsFound > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </li>
  );
}
