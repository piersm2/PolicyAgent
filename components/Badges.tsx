import type { Impact, PolicyStatus } from "@/lib/types";

const STATUS_STYLES: Record<PolicyStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  Upcoming: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
};

export function StatusBadge({ status }: { status: PolicyStatus }) {
  return <span className={`badge ${STATUS_STYLES[status]}`}>{status}</span>;
}

const IMPACT_STYLES: Record<Impact, string> = {
  High: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  Medium: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  Low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

export function ImpactBadge({ impact }: { impact: Impact }) {
  return (
    <span className={`badge ${IMPACT_STYLES[impact]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {impact}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
      {category}
    </span>
  );
}
