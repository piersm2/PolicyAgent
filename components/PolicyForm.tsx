"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { apiSend } from "@/lib/client";
import { IMPACTS, POLICY_CATEGORIES, type Payer, type PolicyWithPayer } from "@/lib/types";

type Props = {
  payers: Payer[];
  initial?: PolicyWithPayer | null;
  onClose: () => void;
  onSaved: () => void;
};

export function PolicyForm({ payers, initial, onClose, onSaved }: Props) {
  const editing = Boolean(initial);
  const [form, setForm] = useState({
    payerId: initial?.payerId ?? payers[0]?.id ?? 0,
    title: initial?.title ?? "",
    category: initial?.category ?? POLICY_CATEGORIES[0],
    impact: initial?.impact ?? "Medium",
    effectiveDate: initial?.effectiveDate ?? "",
    nextReviewDate: initial?.nextReviewDate ?? "",
    sourceUrl: initial?.sourceUrl ?? "",
    summary: initial?.summary ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) await apiSend(`/api/policies/${initial!.id}`, "PUT", form);
      else await apiSend("/api/policies", "POST", form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit policy" : "Add policy"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Prior Authorization — Advanced Imaging"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Payer *</label>
            <select className="input" value={form.payerId} onChange={(e) => set("payerId", Number(e.target.value))}>
              {payers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {POLICY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Impact</label>
            <select className="input" value={form.impact} onChange={(e) => set("impact", e.target.value)}>
              {IMPACTS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Effective date</label>
            <input type="date" className="input" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Review date</label>
            <input type="date" className="input" value={form.nextReviewDate} onChange={(e) => set("nextReviewDate", e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-400">
          Status is automatic: Upcoming until the effective date, then Active.
        </p>

        <div>
          <label className="label">Link to policy</label>
          <input className="input" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://…" />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[90px] resize-y"
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="What the policy does and why it matters…"
          />
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || payers.length === 0}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add policy"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
