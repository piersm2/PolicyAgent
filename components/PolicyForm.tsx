"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { apiSend } from "@/lib/client";
import {
  IMPACTS,
  POLICY_CATEGORIES,
  POLICY_STATUSES,
  type Payer,
  type PolicyWithPayer,
} from "@/lib/types";

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
    policyNumber: initial?.policyNumber ?? "",
    category: initial?.category ?? POLICY_CATEGORIES[0],
    status: initial?.status ?? "Active",
    impact: initial?.impact ?? "Medium",
    effectiveDate: initial?.effectiveDate ?? "",
    endDate: initial?.endDate ?? "",
    nextReviewDate: initial?.nextReviewDate ?? "",
    version: initial?.version ?? "",
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
      if (editing) {
        await apiSend(`/api/policies/${initial!.id}`, "PUT", form);
      } else {
        await apiSend("/api/policies", "POST", form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit policy" : "Add policy"} onClose={onClose} wide>
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
            <label className="label">Policy #</label>
            <input className="input" value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {POLICY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {POLICY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Impact</label>
            <select className="input" value={form.impact} onChange={(e) => set("impact", e.target.value)}>
              {IMPACTS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Effective date</label>
            <input type="date" className="input" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
          </div>
          <div>
            <label className="label">End date</label>
            <input type="date" className="input" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          <div>
            <label className="label">Next review</label>
            <input type="date" className="input" value={form.nextReviewDate} onChange={(e) => set("nextReviewDate", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Version</label>
            <input className="input" value={form.version} onChange={(e) => set("version", e.target.value)} placeholder="e.g. v2.1" />
          </div>
          <div>
            <label className="label">Source URL</label>
            <input className="input" value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <div>
          <label className="label">Summary</label>
          <textarea
            className="input min-h-[90px] resize-y"
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="What the policy does and why it matters for reimbursement…"
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
