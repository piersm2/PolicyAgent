"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { Modal } from "./Modal";
import { todayLocal } from "@/lib/format";

export function AddChange({ policyId }: { policyId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    changeDate: todayLocal(),
    summary: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiSend(`/api/policies/${policyId}/changes`, "POST", form);
      setOpen(false);
      setForm({ changeDate: todayLocal(), summary: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="btn-ghost text-sm" onClick={() => setOpen(true)}>
        + Log change
      </button>
      {open && (
        <Modal title="Log a policy change" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.changeDate} onChange={(e) => set("changeDate", e.target.value)} />
            </div>
            <div>
              <label className="label">What changed *</label>
              <textarea
                className="input min-h-[80px] resize-y"
                required
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                placeholder="What changed in this revision…"
              />
            </div>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Log change"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
