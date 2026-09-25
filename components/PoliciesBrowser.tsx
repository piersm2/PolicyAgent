"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { POLICY_CATEGORIES, type Payer, type PolicyWithPayer } from "@/lib/types";
import { CategoryBadge, ImpactBadge, StatusBadge } from "./Badges";
import { PolicyForm } from "./PolicyForm";
import { formatDate } from "@/lib/format";

type Filters = {
  search: string;
  payerId: string;
  category: string;
};

export function PoliciesBrowser({
  payers,
  initialPolicies,
  initialFilters,
  openNew,
}: {
  payers: Payer[];
  initialPolicies: PolicyWithPayer[];
  initialFilters: Partial<Filters>;
  openNew: boolean;
}) {
  const [policies, setPolicies] = useState<PolicyWithPayer[]>(initialPolicies);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    payerId: "",
    category: "",
    ...initialFilters,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(openNew);
  const [editing, setEditing] = useState<PolicyWithPayer | null>(null);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (filters.search) sp.set("search", filters.search);
    if (filters.payerId) sp.set("payerId", filters.payerId);
    if (filters.category) sp.set("category", filters.category);
    return sp.toString();
  }, [filters]);

  // Only the newest request may update state, so a slow earlier search can't
  // overwrite the results of a later one.
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const data = await apiGet<PolicyWithPayer[]>(`/api/policies?${query}`);
      if (id !== requestId.current) return;
      setPolicies(data);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [query]);

  // Debounced reload when filters change. The server already rendered the
  // initial filters, so skip until the query actually differs from it.
  const lastQuery = useRef(query);
  useEffect(() => {
    if (query === lastQuery.current) return;
    lastQuery.current = query;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [query, load]);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length;

  async function remove(p: PolicyWithPayer) {
    if (!confirm(`Delete "${p.title}"? This also removes its change history.`)) return;
    let failure: string | null = null;
    try {
      await apiSend(`/api/policies/${p.id}`, "DELETE");
    } catch (err) {
      failure = `Couldn't delete "${p.title}": ${err instanceof Error ? err.message : "unknown error"}`;
    }
    // Reload either way (the row may already be gone), then surface any failure.
    await load();
    if (failure) setError(failure);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policies</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${policies.length} ${policies.length === 1 ? "policy" : "policies"}`}
            {activeFilterCount > 0 && !loading ? " (filtered)" : ""}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          disabled={payers.length === 0}
        >
          + Add policy
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {/* Filters */}
      <div className="card p-3">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <input
              className="input"
              placeholder="Search title or notes…"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
            />
          </div>
          <select className="input" value={filters.payerId} onChange={(e) => set("payerId", e.target.value)}>
            <option value="">All payers</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input" value={filters.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">All categories</option>
            {POLICY_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {activeFilterCount > 0 && (
          <button
            className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
            onClick={() => setFilters({ search: "", payerId: "", category: "" })}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Policy</th>
                <th className="px-4 py-3 font-semibold">Payer</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Impact</th>
                <th className="px-4 py-3 font-semibold">Effective</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/policies/${p.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.payerName}</td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={p.category} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ImpactBadge impact={p.impact} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(p.effectiveDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
                  </td>
                </tr>
              ))}
              {policies.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    No policies match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <PolicyForm
          payers={payers}
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}
