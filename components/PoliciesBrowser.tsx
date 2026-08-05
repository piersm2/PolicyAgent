"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import {
  IMPACTS,
  POLICY_CATEGORIES,
  POLICY_STATUSES,
  type Payer,
  type PolicyWithPayer,
} from "@/lib/types";
import { CategoryBadge, ImpactBadge, StatusBadge } from "./Badges";
import { PolicyForm } from "./PolicyForm";
import { formatDate } from "@/lib/format";

type Filters = {
  search: string;
  payerId: string;
  category: string;
  status: string;
  impact: string;
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
    status: "",
    impact: "",
    ...initialFilters,
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(openNew);
  const [editing, setEditing] = useState<PolicyWithPayer | null>(null);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (filters.search) sp.set("search", filters.search);
    if (filters.payerId) sp.set("payerId", filters.payerId);
    if (filters.category) sp.set("category", filters.category);
    if (filters.status) sp.set("status", filters.status);
    if (filters.impact) sp.set("impact", filters.impact);
    return sp.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<PolicyWithPayer[]>(`/api/policies?${query}`);
      setPolicies(data);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Debounced reload whenever filters change.
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length;

  async function remove(p: PolicyWithPayer) {
    if (!confirm(`Delete "${p.title}"? This also removes its change history.`)) return;
    await apiSend(`/api/policies/${p.id}`, "DELETE");
    load();
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

      {/* Filters */}
      <div className="card p-3">
        <div className="grid gap-2 md:grid-cols-6">
          <div className="md:col-span-2">
            <input
              className="input"
              placeholder="Search title, number, summary…"
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
          <select className="input" value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">All statuses</option>
            {POLICY_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="input" value={filters.impact} onChange={(e) => set("impact", e.target.value)}>
            <option value="">All impact</option>
            {IMPACTS.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </div>
        {activeFilterCount > 0 && (
          <button
            className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
            onClick={() => setFilters({ search: "", payerId: "", category: "", status: "", impact: "" })}
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
                    {p.policyNumber && <div className="text-xs text-slate-400">{p.policyNumber}</div>}
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
