"use client";

import { useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { PAYER_TYPES, type Payer } from "@/lib/types";
import { Modal } from "./Modal";
import { safeHref } from "@/lib/format";

type PayerWithCount = Payer & { policyCount: number };

export function PayersManager({ initial }: { initial: PayerWithCount[] }) {
  const [payers, setPayers] = useState<PayerWithCount[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Payer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    // Counts come from the server page; re-fetch the base list and preserve counts where possible.
    const list = await apiGet<Payer[]>("/api/payers");
    setPayers(
      list.map((p) => ({
        ...p,
        policyCount: payers.find((x) => x.id === p.id)?.policyCount ?? 0,
      }))
    );
  }

  async function remove(p: PayerWithCount) {
    const msg =
      p.policyCount > 0
        ? `Delete ${p.name}? This also deletes its ${p.policyCount} ${p.policyCount === 1 ? "policy" : "policies"} and their history.`
        : `Delete ${p.name}?`;
    if (!confirm(msg)) return;
    try {
      await apiSend(`/api/payers/${p.id}`, "DELETE");
      setPayers((prev) => prev.filter((x) => x.id !== p.id));
      setError(null);
    } catch (err) {
      setError(`Couldn't delete ${p.name}: ${err instanceof Error ? err.message : "unknown error"}`);
      reload().catch(() => {}); // resync; the payer may already be gone
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payers</h1>
          <p className="text-sm text-slate-500">{payers.length} payers tracked</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + Add payer
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {payers.map((p) => (
          <div key={p.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <span className="badge mt-1 bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
                  {p.type}
                </span>
              </div>
              <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                {p.policyCount} {p.policyCount === 1 ? "policy" : "policies"}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-500">
              {safeHref(p.website) && (
                <a href={safeHref(p.website)!} target="_blank" rel="noreferrer" className="block truncate text-brand-600 hover:underline">
                  {p.website!.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3">
              <Link href={`/policies?payerId=${p.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
                View policies →
              </Link>
              <div className="ml-auto flex gap-1">
                <button
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                  onClick={() => {
                    setEditing(p);
                    setShowForm(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                  onClick={() => remove(p)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <PayerForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PayerForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Payer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? PAYER_TYPES[0],
    website: initial?.website ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) await apiSend(`/api/payers/${initial!.id}`, "PUT", form);
      else await apiSend("/api/payers", "POST", form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Edit payer" : "Add payer"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {PAYER_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add payer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
