import Link from "next/link";
import { getBoard, type AttentionItem } from "@/lib/board";
import { ImpactBadge } from "@/components/Badges";
import { TIME_ZONE, daysFromToday, formatDate } from "@/lib/format";
import { listPageChanges, listWatchPages } from "@/lib/watch";
import { WebsiteChanges } from "@/components/WebsiteChanges";
import { aiEnabled } from "@/lib/ai";
import { usageSummary, type UsagePeriod } from "@/lib/summaries";

export const dynamic = "force-dynamic";

type Tone = "rose" | "brand" | "amber" | "emerald" | "slate";

const TONE_BAR: Record<Tone, string> = {
  rose: "bg-rose-500",
  brand: "bg-brand-500",
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  slate: "bg-slate-300",
};

const TONE_TEXT: Record<Tone, string> = {
  rose: "text-rose-600",
  brand: "text-brand-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  slate: "text-slate-900",
};

const TONE_CHIP: Record<Tone, string> = {
  rose: "bg-rose-50 text-rose-700",
  brand: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-800",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-600",
};

/** Color a Needs attention card by its most urgent reason. */
function attentionTone(p: AttentionItem): Tone {
  const text = p.reasons.join(" ");
  if (/overdue/i.test(text)) return "rose";
  if (/changed/i.test(text)) return "brand";
  if (/due in|effective in|upcoming/i.test(text) || p.impact === "High") return "amber";
  return "slate";
}

export default function HomePage() {
  const { counts, needsAttention, recentChanges, actionItems } = getBoard();
  const websiteChanges = listPageChanges({ unreviewedOnly: true, limit: 20 });
  const pages = listWatchPages();
  const toReview = pages.reduce((n, p) => n + p.unreviewedChanges, 0);
  const pageErrors = pages.filter((p) => p.lastError).length;
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-600">{todayLabel}</p>
          <h1 className="page-title">Overview</h1>
        </div>
        <div className="flex gap-2">
          <a href="/api/feed?format=md" target="_blank" rel="noreferrer" className="btn-ghost">
            Open feed
          </a>
          <Link href="/policies?new=1" className="btn-primary">
            + Add policy
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          href="#changes"
          value={toReview}
          label="Changes to review"
          note={toReview ? "on watched pages" : "all caught up"}
          tone={toReview ? "brand" : "emerald"}
        />
        <StatTile
          href="#actions"
          value={counts.overdueActions}
          label="Overdue actions"
          note={`${counts.openActions} open in total`}
          tone={counts.overdueActions ? "rose" : "emerald"}
        />
        <StatTile
          href="/policies"
          value={counts.reviewsDue}
          label="Reviews due"
          note="overdue or next 30 days"
          tone={counts.reviewsDue ? "amber" : "emerald"}
        />
        <StatTile
          href="/watch"
          value={pages.length}
          label="Pages watched"
          note={pageErrors ? `${pageErrors} can't be checked` : "all checking fine"}
          tone={pageErrors ? "amber" : "slate"}
        />
      </div>

      <section>
        <SectionTitle title="Needs attention" subtitle="Ranked by impact, dates, overdue work, and changes." />
        {needsAttention.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-400">No policies yet. Add one to get started.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
            {needsAttention.map((p, i) => {
              const tone = attentionTone(p);
              return (
                <Link
                  key={p.id}
                  href={`/policies/${p.id}`}
                  className="card group relative flex min-h-[9.5rem] flex-col overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${TONE_BAR[tone]}`} />
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {p.payerName}
                    </span>
                    <span className="text-xs font-extrabold text-slate-300">#{i + 1}</span>
                  </div>
                  <div className="mt-1.5 font-bold leading-snug text-slate-900 group-hover:text-brand-700">{p.title}</div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
                    <span className={`badge ${TONE_CHIP[tone]}`}>{p.reasons[0]}</span>
                    <ImpactBadge impact={p.impact} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div id="changes" className="min-w-0 scroll-mt-24 lg:col-span-3">
          {websiteChanges.length > 0 ? (
            <WebsiteChanges changes={websiteChanges} aiOn={aiEnabled()} />
          ) : (
            <section className="card flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg text-emerald-600">
                ✓
              </span>
              <div>
                <h2 className="font-bold text-slate-900">No website changes to review</h2>
                <p className="text-sm text-slate-500">New documents and wording changes on watched pages show up here.</p>
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section id="actions" className="card scroll-mt-24 p-5">
            <h2 className="font-bold text-slate-900">Action items</h2>
            <p className="mb-3 text-xs text-slate-500">Next actions on policies, soonest due first.</p>
            {actionItems.length === 0 ? (
              <p className="py-4 text-sm text-slate-400">No open actions.</p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {actionItems.map((a) => (
                  <li key={a.policyId}>
                    <Link href={`/policies/${a.policyId}`} className="block rounded-xl px-2 py-2 transition hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-800">{a.nextAction}</span>
                        <DuePill due={a.actionDue} overdue={a.overdue} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {a.owner || "Unassigned"} · {a.payerName} · {a.title}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <UsageCard />

          <section className="card p-5">
            <h2 className="mb-3 font-bold text-slate-900">Recent logged changes</h2>
            {recentChanges.length === 0 ? (
              <p className="py-2 text-sm text-slate-400">No changes logged yet.</p>
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
    </div>
  );
}

function StatTile({
  href,
  value,
  label,
  note,
  tone,
}: {
  href: string;
  value: number;
  label: string;
  note: string;
  tone: Tone;
}) {
  return (
    <Link href={href} className="card group relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lg lg:p-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${TONE_BAR[tone]}`} />
      <div className={`text-4xl font-extrabold tracking-tight lg:text-5xl ${value ? TONE_TEXT[tone] : "text-slate-900"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-800">{label}</div>
      <div className="text-xs text-slate-500">{note}</div>
    </Link>
  );
}

function UsageCard() {
  const usage = usageSummary();
  const on = aiEnabled();
  if (!on && usage.month.calls === 0) {
    return (
      <section className="card p-5">
        <h2 className="font-bold text-slate-900">Claude usage</h2>
        <p className="mt-1 text-sm text-slate-500">
          AI briefs and summaries are off. Add an Anthropic API key to turn them on (README → AI briefs and summaries).
        </p>
      </section>
    );
  }
  const periods: [string, UsagePeriod][] = [
    ["Today", usage.today],
    ["This week", usage.week],
    ["This month", usage.month],
  ];
  return (
    <section className="card p-5">
      <h2 className="font-bold text-slate-900">Claude usage</h2>
      <p className="mb-3 text-xs text-slate-500">Estimated cost of AI briefs and change summaries.</p>
      <div className="grid grid-cols-3 gap-2">
        {periods.map(([label, p]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">{formatCost(p.cost)}</div>
            <div className="text-xs text-slate-500">
              {p.calls} {p.calls === 1 ? "summary" : "summaries"}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">From token counts at list prices; your Anthropic bill is the final word.</p>
    </section>
  );
}

function formatCost(cost: number | null): string {
  if (cost === null) return "n/a";
  if (cost === 0) return "$0";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function DuePill({ due, overdue }: { due: string | null; overdue: boolean }) {
  if (!due) return <span className="badge shrink-0 bg-slate-100 text-slate-500">No date</span>;
  const days = daysFromToday(due) ?? 0;
  const soon = !overdue && days <= 7;
  const style = overdue ? "bg-rose-600 text-white" : soon ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";
  return (
    <span className={`badge shrink-0 ${style}`}>{overdue ? `${Math.abs(days)}d overdue` : `Due ${formatDate(due)}`}</span>
  );
}
