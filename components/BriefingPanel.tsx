"use client";

import { useState } from "react";
import Link from "next/link";
import { apiSend } from "@/lib/client";
import type { Briefing, Impact, PolicyStatus } from "@/lib/types";
import { ImpactBadge, StatusBadge } from "./Badges";
import { SummaryText } from "./SummaryText";
import { formatDate } from "@/lib/format";

export interface RankedItem {
  id: number;
  title: string;
  payerName: string;
  category: string;
  status: PolicyStatus;
  impact: Impact;
  score: number;
  reasons: string[];
}

export function BriefingPanel({
  priorities,
  initialBriefings,
  aiEnabled,
}: {
  priorities: RankedItem[];
  initialBriefings: Briefing[];
  aiEnabled: boolean;
}) {
  const [briefings, setBriefings] = useState<Briefing[]>(initialBriefings);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = briefings[0];
  const history = briefings.slice(1);
  const maxScore = Math.max(1, ...priorities.map((p) => p.score));

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const b = await apiSend<Briefing>("/api/briefings", "POST");
      setBriefings((prev) => [b, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Briefing</h1>
          <p className="text-sm text-slate-500">
            The important ones, surfaced and summarized — ranked by urgency and impact.
          </p>
        </div>
        <button className="btn-primary" onClick={generate} disabled={generating}>
          {generating ? "Generating…" : latest ? "Regenerate summary" : "Generate summary"}
        </button>
      </div>

      {!aiEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Summaries are generated from the priority engine. Set{" "}
          <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to have Claude write them.
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Priority queue */}
        <section className="card p-5 lg:col-span-3">
          <h2 className="mb-3 font-semibold text-slate-900">Priority queue</h2>
          {priorities.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No active or upcoming policies to rank.
            </p>
          ) : (
            <ol className="space-y-3">
              {priorities.map((p, i) => (
                <li key={p.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/policies/${p.id}`}
                        className="font-medium text-slate-800 hover:text-brand-700"
                      >
                        {p.title}
                      </Link>
                      <StatusBadge status={p.status} />
                      <ImpactBadge impact={p.impact} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.payerName} · {p.category}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${(p.score / maxScore) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-medium tabular-nums text-slate-400">
                        {p.score}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.reasons.map((r, ri) => (
                        <span
                          key={ri}
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

        {/* Latest summary */}
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Executive summary</h2>
            {latest && <SourceBadge briefing={latest} />}
          </div>
          {latest ? (
            <>
              <div className="mb-2 text-xs text-slate-400">Generated {formatDate(latest.generatedAt)}</div>
              <SummaryText text={latest.summary} />
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No summary yet. Click “Generate summary” to write one from the priority queue.
            </p>
          )}
        </section>
      </div>

      {/* History */}
      {history.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Past briefings</h2>
          <div className="space-y-3">
            {history.map((b) => (
              <details key={b.id} className="group rounded-lg border border-slate-200">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="text-slate-600">{formatDate(b.generatedAt)}</span>
                  <SourceBadge briefing={b} />
                </summary>
                <div className="border-t border-slate-100 px-4 py-3">
                  <SummaryText text={b.summary} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SourceBadge({ briefing }: { briefing: Briefing }) {
  if (briefing.source === "ai") {
    return (
      <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        ✨ {briefing.model ?? "AI"}
      </span>
    );
  }
  return (
    <span className="badge bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200">
      Rule-based
    </span>
  );
}
