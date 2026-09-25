"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { PAYER_TYPES, type Payer } from "@/lib/types";
import type { CatalogPayer } from "@/lib/catalog";
import { Modal } from "./Modal";
import { safeHref } from "@/lib/format";

type PayerWithCount = Payer & { policyCount: number; pageCount: number };

export function PayersManager({ payers }: { payers: PayerWithCount[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [editing, setEditing] = useState<PayerWithCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function remove(p: PayerWithCount) {
    const msg =
      p.policyCount > 0
        ? `Delete ${p.name}? This also deletes its ${p.policyCount} ${p.policyCount === 1 ? "policy" : "policies"} and their history.`
        : `Delete ${p.name}?`;
    if (!confirm(msg)) return;
    try {
      await apiSend(`/api/payers/${p.id}`, "DELETE");
      setError(null);
    } catch (err) {
      setError(`Couldn't delete ${p.name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    router.refresh();
  }

  function saved(text: string) {
    setShowForm(false);
    setShowCatalog(false);
    setMessage(text);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payers</h1>
          <p className="text-sm text-slate-500">{payers.length} payers tracked</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowCatalog(true)}>
            + Add from catalog
          </button>
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
      </div>

      {message && <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{message}</div>}
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
              <span className="badge shrink-0 bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                {p.policyCount} {p.policyCount === 1 ? "policy" : "policies"}
              </span>
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-500">
              {safeHref(p.website) && (
                <a href={safeHref(p.website)!} target="_blank" rel="noreferrer" className="block truncate text-brand-600 hover:underline">
                  {p.website!.replace(/^https?:\/\//, "")}
                </a>
              )}
              <Link href="/watch" className="block hover:text-brand-700">
                {p.pageCount} policy page{p.pageCount === 1 ? "" : "s"} watched
              </Link>
            </div>

            <div className="mt-auto flex items-center gap-1 border-t border-slate-100 pt-3">
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

      {showForm && <PayerForm initial={editing} onClose={() => setShowForm(false)} onSaved={saved} />}
      {showCatalog && <CatalogPicker onClose={() => setShowCatalog(false)} onSaved={saved} />}
    </div>
  );
}

function PayerForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: PayerWithCount | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? PAYER_TYPES[0],
    website: initial?.website ?? "",
    pages: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = editing
        ? await apiSend<{ pagesAdded: number }>(`/api/payers/${initial!.id}`, "PUT", form)
        : await apiSend<{ pagesAdded: number }>("/api/payers", "POST", form);
      const pages = result.pagesAdded ? ` and ${result.pagesAdded} page${result.pagesAdded === 1 ? "" : "s"} to watch` : "";
      onSaved(`${editing ? "Saved" : "Added"} ${form.name}${pages}.`);
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
        <div>
          <label className="label">{editing ? "More policy pages to watch" : "Policy pages to watch"}</label>
          <textarea
            className="input min-h-[90px] resize-y font-mono text-xs"
            value={form.pages}
            onChange={(e) => set("pages", e.target.value)}
            placeholder={"One per line. Optional label before a |, e.g.\nPolicy updates | https://example.com/provider/policy-updates"}
          />
          <p className="mt-1 text-xs text-slate-400">
            Pages that list the payer&apos;s policies or monthly policy updates.
            {editing && initial ? ` ${initial.pageCount} already watched — manage them on the Watch list.` : ""}
          </p>
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

type CatalogEntry = CatalogPayer & { added: boolean };

/** Pick known Missouri / national payers and add them with their policy pages. */
function CatalogPicker({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<CatalogEntry[]>("/api/catalog")
      .then((list) => {
        setCatalog(list);
        setSelected(new Set(list.filter((c) => !c.added).map((c) => c.key)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the catalog"));
  }, []);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const r = await apiSend<{ payersAdded: number; pagesAdded: number }>("/api/catalog", "POST", {
        keys: Array.from(selected),
      });
      onSaved(
        `Added ${r.payersAdded} payer${r.payersAdded === 1 ? "" : "s"} and ${r.pagesAdded} page${
          r.pagesAdded === 1 ? "" : "s"
        } to watch. Run “Check all now” on the Watch list to record a starting point.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add payers");
    } finally {
      setSaving(false);
    }
  }

  const groups = [
    { title: "Missouri", items: catalog?.filter((c) => c.region === "Missouri") ?? [] },
    { title: "National", items: catalog?.filter((c) => c.region === "National") ?? [] },
  ];

  return (
    <Modal title="Add payers from the catalog" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Payers for a rural Missouri hospital, each with policy pages checked to load without JavaScript. Payers you
          already have are marked; selecting one again adds any of its pages you&apos;re missing.
        </p>
        {!catalog && !error && <p className="text-sm text-slate-400">Loading…</p>}
        {catalog &&
          groups.map((g) => (
            <div key={g.title}>
              <div className="label">{g.title}</div>
              <ul className="space-y-2">
                {g.items.map((c) => (
                  <li key={c.key} className="rounded-lg border border-slate-200 p-3">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(c.key)}
                        onChange={() => toggle(c.key)}
                        aria-label={c.name}
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-slate-800">{c.name}</span>{" "}
                        <span className="text-xs text-slate-500">· {c.type}</span>
                        {c.added && (
                          <span className="badge ml-2 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                            Added
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-slate-500">
                          Watches: {c.pages.map((pg) => pg.label).join(" · ")}
                        </span>
                        {c.note && <span className="mt-1 block text-xs text-amber-700">{c.note}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={add} disabled={saving || selected.size === 0}>
            {saving ? "Adding…" : `Add ${selected.size} payer${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
