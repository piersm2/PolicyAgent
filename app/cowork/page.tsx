import { COWORK_INSTRUCTIONS, RESULT_EXAMPLE, coworkTasks } from "@/lib/cowork";
import { CoworkResults } from "@/components/CoworkResults";
import { formatDateTime, today } from "@/lib/format";

export const dynamic = "force-dynamic";

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all font-medium text-brand-600 hover:underline">
      {children}
    </a>
  );
}

function Lines({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <div className="label">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CoworkPage() {
  const tasks = coworkTasks();
  const total = tasks.briefs.length + tasks.summaries.length + tasks.imports.length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand-600">{today()}</p>
        <h1 className="page-title">Cowork tasks</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Today&apos;s reading for the daily Claude Cowork task: policy briefs, change summaries, and history imports.
          Results saved here appear across the app just like ones written with an API key.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-slate-900">How to do these tasks</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {COWORK_INSTRUCTIONS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          {total === 0
            ? "Nothing to do today."
            : `Today: ${tasks.briefs.length} brief(s) to write, ${tasks.summaries.length} change(s) to summarize, ${tasks.imports.length} history import(s) in progress.`}
        </p>
      </section>

      {tasks.briefs.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold text-slate-900">1. Write policy briefs ({tasks.briefs.length})</h2>
          <p className="mt-1 text-sm text-slate-500">
            Open each policy document and write a brief. Put it under <code>briefs</code> with its policyId.
          </p>
          <ol className="mt-3 space-y-3">
            {tasks.briefs.map((b) => (
              <li key={b.policyId} className="rounded-xl border border-slate-200 p-3">
                <div className="font-semibold text-slate-900">
                  policyId {b.policyId}: {b.title}
                </div>
                <div className="text-sm text-slate-600">
                  {b.payer} · {b.category}
                  {b.stale && " · The document changed since the last brief; rewrite it and say what changed."}
                </div>
                <div className="mt-1 text-sm">
                  Document: <Ext href={b.documentUrl}>{b.documentUrl}</Ext>
                </div>
                {b.notes && <div className="mt-1 text-sm text-slate-600">Our notes: {b.notes}</div>}
                {b.latestChange && (
                  <div className="mt-2">
                    <div className="label">Latest detected change</div>
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{b.latestChange}</pre>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {tasks.summaries.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold text-slate-900">2. Summarize website changes ({tasks.summaries.length})</h2>
          <p className="mt-1 text-sm text-slate-500">
            Explain each change for our team. Open new linked documents to say what&apos;s in them. Put each under{" "}
            <code>summaries</code> with its changeId.
          </p>
          <ol className="mt-3 space-y-3">
            {tasks.summaries.map((c) => (
              <li key={c.changeId} className="rounded-xl border border-slate-200 p-3">
                <div className="font-semibold text-slate-900">
                  changeId {c.changeId}: {c.payer} — {c.policyTitle ? `policy document "${c.policyTitle}"` : c.page}
                </div>
                <div className="text-sm">
                  Page: <Ext href={c.pageUrl}>{c.pageUrl}</Ext>
                </div>
                <div className="text-xs text-slate-500">
                  Detected {formatDateTime(c.detectedAt)}
                  {c.documentChanged && " · the document file itself changed"}
                </div>
                <Lines title="New links / documents" items={c.newLinks.map((l) => `${l.text} — ${l.url}`)} />
                <Lines title="Removed links / documents" items={c.removedLinks.map((l) => `${l.text} — ${l.url}`)} />
                <Lines title="Text added" items={c.addedText} />
                <Lines title="Text removed" items={c.removedText} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {tasks.imports.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold text-slate-900">3. Import past bulletins ({tasks.imports.length})</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            For each import, open the listing page (and its archive or older pages if needed) and find the bulletins,
            notices, or transmittals published on or after the date shown that aren&apos;t in its already-imported list.
            Read up to {tasks.limits.bulletins} bulletins in total today, newest first. For each bulletin, add an item to{" "}
            <code>history</code> listing every policy change it announces (new, revised, or retired policies,
            reimbursement, prior authorization, coverage, and coding changes). Set trackedPolicyId when a change is about
            one of the import&apos;s tracked policies. When an import has no unread bulletins left in its period, add its
            jobId to <code>importsDone</code>.
          </p>
          <ol className="mt-3 space-y-3">
            {tasks.imports.map((j) => (
              <li key={j.jobId} className="rounded-xl border border-slate-200 p-3">
                <div className="font-semibold text-slate-900">
                  jobId {j.jobId}: {j.payer} — {j.listingPage}
                </div>
                <div className="text-sm">
                  Listing page: <Ext href={j.listingUrl}>{j.listingUrl}</Ext>
                </div>
                <div className="text-sm text-slate-600">
                  Published on or after {j.since} · {j.bulletinsRead} bulletin{j.bulletinsRead === 1 ? "" : "s"} read so far
                </div>
                <Lines
                  title="Tracked policies (id: title)"
                  items={j.trackedPolicies.map((t) => `${t.id}: ${t.title}`)}
                />
                {j.alreadyImported.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-600">
                      Already imported ({j.alreadyImported.length}) — skip these
                    </summary>
                    <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                      {j.alreadyImported.map((u) => (
                        <li key={u} className="break-all">
                          {u}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-bold text-slate-900">Result format</h2>
        <p className="mt-1 text-sm text-slate-500">
          One JSON object; include only the parts you have. Dates are YYYY-MM-DD. Use null (not a string) where a value
          is unknown.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(RESULT_EXAMPLE, null, 2)}
        </pre>
      </section>

      <CoworkResults />
    </div>
  );
}
