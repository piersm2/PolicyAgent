import { listPayers } from "@/lib/repo";
import { listWatchPages } from "@/lib/watch";
import { aiEnabled } from "@/lib/ai";
import { estimateHigh, listHistory, listJobs } from "@/lib/history";
import { HistoryImport } from "@/components/HistoryImport";
import { HistoryTimeline } from "@/components/HistoryTimeline";

export const dynamic = "force-dynamic";

export default function HistoryPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
  const payerId = Number(searchParams.payerId) || undefined;
  const relevance = searchParams.rel === "high" || searchParams.rel === "all" ? searchParams.rel : "medium";
  const search = searchParams.q?.trim() || undefined;
  const entries = listHistory({ payerId, relevance, search });
  const jobs = listJobs().map((j) => ({ ...j, estimateHigh: j.status === "ready" ? estimateHigh(j.docsFound) : null }));
  const pages = listWatchPages()
    .filter((p) => !p.policyId)
    .map((p) => ({ id: p.id, label: p.label, payerName: p.payerName }));
  const payers = listPayers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">History</h1>
        <p className="mt-1 text-sm text-slate-500">
          Policy changes from payers&apos; past bulletins and notices, month by month. Changes that match a tracked policy
          are added to its change history.
        </p>
      </div>

      <HistoryImport pages={pages} jobs={jobs} aiOn={aiEnabled()} />

      <form className="card flex flex-wrap items-end gap-2 p-3" method="get">
        <select name="payerId" defaultValue={payerId ?? ""} className="input w-auto">
          <option value="">All payers</option>
          {payers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="rel" defaultValue={relevance} className="input w-auto">
          <option value="medium">High &amp; medium relevance</option>
          <option value="high">High relevance only</option>
          <option value="all">All</option>
        </select>
        <input name="q" defaultValue={search ?? ""} placeholder="Search policy, code, or bulletin…" className="input min-w-[12rem] flex-1" />
        <button className="btn-primary" type="submit">
          Filter
        </button>
      </form>

      <p className="-mb-3 text-sm font-medium text-slate-500">
        {entries.length} change{entries.length === 1 ? "" : "s"}
        {entries.length >= 500 ? " (showing the newest 500; narrow the filters to see more)" : ""}
      </p>
      <HistoryTimeline entries={entries} />
    </div>
  );
}
