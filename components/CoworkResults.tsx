"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import type { CoworkReport } from "@/lib/cowork";

/** Paste box for Cowork's results. */
export function CoworkResults() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<CoworkReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setReport(null);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (err) {
      setError(`That isn't valid JSON: ${err instanceof Error ? err.message : "parse error"}`);
      setSaving(false);
      return;
    }
    try {
      const r = await apiSend<CoworkReport>("/api/cowork/results", "POST", body);
      setReport(r);
      if (!r.errors.length) setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="results" className="card scroll-mt-24 p-5">
      <h2 className="text-lg font-bold text-slate-900">Results</h2>
      <p className="mt-1 text-sm text-slate-500">Paste the results JSON here and click Save results.</p>
      <textarea
        aria-label="Results JSON"
        className="input mt-3 min-h-[220px] resize-y font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"briefs": [...], "summaries": [...], "history": [...], "importsDone": [...]}'
      />
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving || !text.trim()}>
          {saving ? "Saving…" : "Save results"}
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {report && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm" role="status">
          <p className="font-semibold text-slate-800">
            Saved: {report.briefs} brief{report.briefs === 1 ? "" : "s"}, {report.summaries} summar
            {report.summaries === 1 ? "y" : "ies"}, {report.bulletins} bulletin{report.bulletins === 1 ? "" : "s"} (
            {report.entries} change{report.entries === 1 ? "" : "s"}), {report.importsDone} import
            {report.importsDone === 1 ? "" : "s"} finished.
          </p>
          {report.skipped.map((s) => (
            <p key={s} className="text-slate-500">
              Skipped: {s}
            </p>
          ))}
          {report.errors.map((e) => (
            <p key={e} className="text-rose-700">
              Error: {e}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
