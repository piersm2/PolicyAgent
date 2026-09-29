"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { BriefState } from "@/lib/types";

/** Claude-written brief of the policy document, with states for pending, errors, and AI off. */
export function PolicyBriefCard({
  policyId,
  state,
  policyEffectiveDate,
}: {
  policyId: number;
  state: BriefState;
  policyEffectiveDate: string | null;
}) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { brief, status } = state;

  async function write() {
    setWriting(true);
    setError(null);
    try {
      const next = await apiSend<BriefState>(`/api/policies/${policyId}/brief`, "POST");
      if (next.error && next.status !== "ready") setError(next.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write the brief");
    } finally {
      setWriting(false);
    }
  }

  const canWrite = status !== "disabled" && status !== "no-document";
  const button = canWrite && (
    <button className={brief ? "btn-ghost text-sm" : "btn-primary text-sm"} onClick={write} disabled={writing}>
      {writing ? "Writing…" : brief ? "Refresh" : status === "error" ? "Try again" : "Write brief now"}
    </button>
  );

  return (
    <section className="card relative overflow-hidden p-6">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-brand-600 to-brand-800" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Policy brief</h2>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Written by Claude from the policy document
            {state.briefAt && (
              <span className="font-medium normal-case tracking-normal text-slate-400" suppressHydrationWarning>
                {" "}
                · {formatDateTime(state.briefAt)}
              </span>
            )}
          </p>
        </div>
        {button}
      </div>

      {writing && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Reading the document and writing the brief. This can take a minute for long policies.
        </p>
      )}
      {(error || (state.error && status !== "pending")) && !writing && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {brief ? "The last refresh failed: " : "Couldn't write the brief: "}
          {error ?? state.error}
        </p>
      )}

      {brief ? (
        <div className="mt-4 space-y-5">
          {status === "stale" && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              The document has changed since this brief was written. It&apos;s rewritten automatically after the next
              check, or click Refresh.
            </p>
          )}
          <p className="text-lg font-semibold leading-relaxed text-slate-900">{brief.inShort}</p>

          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700">What it means for us</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{brief.whatItMeansForUs}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <div className="label">Key requirements</div>
              {brief.keyRequirements.length ? (
                <ul className="space-y-1.5">
                  {brief.keyRequirements.map((r) => (
                    <li key={r} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">None stated.</p>
              )}
            </div>
            <div className="space-y-4 md:col-span-2">
              <div>
                <div className="label">Services &amp; codes</div>
                {brief.servicesAndCodes.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {brief.servicesAndCodes.map((c) => (
                      <span key={c} className="badge bg-slate-100 text-slate-700">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">None listed.</p>
                )}
              </div>
              {(brief.effectiveDate || brief.documentVersion) && (
                <div>
                  <div className="label">From the document</div>
                  <p className="text-sm text-slate-700">
                    {brief.effectiveDate && <>Effective {formatDate(brief.effectiveDate)}</>}
                    {brief.effectiveDate && brief.documentVersion && " · "}
                    {brief.documentVersion}
                  </p>
                  {brief.effectiveDate && policyEffectiveDate && brief.effectiveDate !== policyEffectiveDate && (
                    <p className="mt-1 text-xs text-amber-700">
                      This policy&apos;s record says {formatDate(policyEffectiveDate)}. Edit the policy if that&apos;s out of date.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {brief.whatChanged && (
            <div>
              <div className="label">What changed</div>
              <p className="text-sm leading-relaxed text-slate-700">{brief.whatChanged}</p>
            </div>
          )}
          {brief.partial && <p className="text-xs text-slate-400">{brief.partial}</p>}
          <p className="text-xs text-slate-400">
            AI-written summary; check the document before acting on anything that affects payment.
          </p>
        </div>
      ) : (
        !writing && (
          <p className="mt-3 text-sm text-slate-500">
            {status === "pending" && "The brief is written automatically after the document's first check, or write it now."}
            {status === "error" && "Check the document link, then try again."}
            {status === "no-document" && "Add the policy document link (Edit) to get a plain-language brief."}
            {status === "disabled" &&
              "Your daily Cowork task writes this brief (see Cowork tasks). With an Anthropic API key, the app writes it itself."}
          </p>
        )
      )}
    </section>
  );
}
