"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { formatDateTime, safeHref } from "@/lib/format";
import type { Payer, WatchPage } from "@/lib/types";
import { Modal } from "./Modal";

type CheckResult = { pageId: number; outcome: string; error?: string };

export function WatchManager({
  pages,
  payers,
  checkEveryHours,
}: {
  pages: WatchPage[];
  payers: Payer[];
  checkEveryHours: number;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState<number | "all" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function check(pageId?: number) {
    setChecking(pageId ?? "all");
    setMessage(null);
    setError(null);
    try {
      const results = await apiSend<CheckResult[]>(
        "/api/watch/check",
        "POST",
        pageId !== undefined ? { pageId } : {}
      );
      const changed = results.filter((r) => r.outcome === "changed").length;
      const failed = results.filter((r) => r.outcome === "error").length;
      setMessage(
        `Checked ${results.length} page${results.length === 1 ? "" : "s"}: ` +
          `${changed} with changes, ${failed} failed.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setChecking(null);
    }
  }

  async function remove(page: WatchPage) {
    if (!confirm(`Stop watching "${page.label}" for ${page.payerName}? Its detected changes are removed too.`)) return;
    try {
      await apiSend(`/api/watch/${page.id}`, "DELETE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Watch list</h1>
          <p className="text-sm text-slate-500">
            Payer pages and policy documents checked for changes every {checkEveryHours} hours while the app is
            running. In a codespace, the “Scheduled payer check” GitHub Action wakes it daily (see the README).
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setAdding(true)} disabled={payers.length === 0}>
            + Add page
          </button>
          <button className="btn-primary" onClick={() => check()} disabled={checking !== null || pages.length === 0}>
            {checking === "all" ? "Checking…" : "Check all now"}
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="card divide-y divide-slate-100">
        {pages.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No pages yet. Add a payer&apos;s policy or bulletin page to start watching it.
          </p>
        )}
        {pages.map((p) => {
          const href = safeHref(p.url);
          return (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {p.policyId ? (
                    <a href={`/policies/${p.policyId}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {p.payerName} — {p.policyTitle}
                    </a>
                  ) : (
                    <span className="font-medium text-slate-800">
                      {p.payerName} — {p.label}
                    </span>
                  )}
                  {p.policyId && (
                    <span className="badge bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
                      Policy document
                    </span>
                  )}
                  {p.unreviewedChanges > 0 && (
                    <span className="badge bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                      {p.unreviewedChanges} to review
                    </span>
                  )}
                </div>
                {href && (
                  <a href={href} target="_blank" rel="noreferrer" className="block truncate text-xs text-brand-600 hover:underline">
                    {p.url}
                  </a>
                )}
                <div className="mt-1 text-xs" suppressHydrationWarning>
                  {p.lastError ? (
                    <span className="text-red-600">Last check failed: {p.lastError}</span>
                  ) : p.lastSuccessAt ? (
                    <span className="text-slate-500">Checked {formatDateTime(p.lastCheckedAt)}</span>
                  ) : (
                    <span className="text-slate-400">Not checked yet</span>
                  )}
                  {p.lastNote && !p.lastError && <span className="block text-amber-700">{p.lastNote}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  onClick={() => check(p.id)}
                  disabled={checking !== null}
                >
                  {checking === p.id ? "Checking…" : "Check"}
                </button>
                <button
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                  onClick={() => remove(p)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {adding && (
        <AddPageForm
          payers={payers}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddPageForm({ payers, onClose, onSaved }: { payers: Payer[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ payerId: payers[0]?.id ?? 0, url: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiSend("/api/watch", "POST", form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Watch a payer page" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Payer *</label>
          <select className="input" value={form.payerId} onChange={(e) => setForm({ ...form, payerId: Number(e.target.value) })}>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Page address *</label>
          <input
            className="input"
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://… (policy list or bulletin page)"
          />
        </div>
        <div>
          <label className="label">Label</label>
          <input
            className="input"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="e.g. Monthly network bulletin"
          />
        </div>
        <p className="text-xs text-slate-400">
          The first check records a starting point; changes are reported from the next check on.
        </p>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Watch page"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
