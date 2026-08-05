"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { CHANGE_TYPES } from "@/lib/types";
import { Modal } from "./Modal";

export function AddChange({ policyId }: { policyId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    changeDate: new Date().toISOString().slice(0, 10),
    changeType: "Revised",
    version: "",
    summary: "",
    notedBy: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiSend(`/api/policies/${policyId}/changes`, "POST", form);
      setOpen(false);
      setForm({ changeDate: new Date().toISOString().slice(0, 10), changeType: "Revised", version: "", summary: "", notedBy: "" });
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.changeDate} onChange={(e) => set("changeDate", e.target.value)} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.changeType} onChange={(e) => set("changeType", e.target.value)}>
                  {CHANGE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Version</label>
                <input className="input" value={form.version} onChange={(e) => set("version", e.target.value)} placeholder="e.g. v2.2" />
              </div>
              <div>
                <label className="label">Noted by</label>
                <input className="input" value={form.notedBy} onChange={(e) => set("notedBy", e.target.value)} placeholder="e.g. Policy Desk" />
              </div>
            </div>
            <div>
              <label className="label">Summary *</label>
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
