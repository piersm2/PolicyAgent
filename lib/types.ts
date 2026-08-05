// Domain model for the payer policy tracker.

export type PayerType =
  | "Commercial"
  | "Medicare Advantage"
  | "Managed Medicaid"
  | "Medicare (Traditional)"
  | "Medicaid (State)"
  | "TPA / Self-Funded"
  | "Other";

export const PAYER_TYPES: PayerType[] = [
  "Commercial",
  "Medicare Advantage",
  "Managed Medicaid",
  "Medicare (Traditional)",
  "Medicaid (State)",
  "TPA / Self-Funded",
  "Other",
];

export type PolicyCategory =
  | "Prior Authorization"
  | "Medical Necessity"
  | "Reimbursement"
  | "Coverage / Benefit"
  | "Billing & Coding"
  | "Credentialing"
  | "Appeals & Disputes"
  | "Pharmacy";

export const POLICY_CATEGORIES: PolicyCategory[] = [
  "Prior Authorization",
  "Medical Necessity",
  "Reimbursement",
  "Coverage / Benefit",
  "Billing & Coding",
  "Credentialing",
  "Appeals & Disputes",
  "Pharmacy",
];

export type PolicyStatus = "Active" | "Upcoming" | "Draft" | "Retired";

export const POLICY_STATUSES: PolicyStatus[] = [
  "Active",
  "Upcoming",
  "Draft",
  "Retired",
];

export type Impact = "High" | "Medium" | "Low";

export const IMPACTS: Impact[] = ["High", "Medium", "Low"];

export type ChangeType = "New" | "Revised" | "Retired" | "Reinstated";

export const CHANGE_TYPES: ChangeType[] = [
  "New",
  "Revised",
  "Retired",
  "Reinstated",
];

export interface Payer {
  id: number;
  name: string;
  type: PayerType;
  website: string | null;
  contact: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Policy {
  id: number;
  payerId: number;
  policyNumber: string | null;
  title: string;
  category: PolicyCategory;
  status: PolicyStatus;
  impact: Impact;
  effectiveDate: string | null; // ISO date (YYYY-MM-DD)
  endDate: string | null;
  nextReviewDate: string | null;
  version: string | null;
  sourceUrl: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyWithPayer extends Policy {
  payerName: string;
  payerType: PayerType;
}

export interface PolicyChange {
  id: number;
  policyId: number;
  changeDate: string; // ISO date
  changeType: ChangeType;
  version: string | null;
  summary: string;
  notedBy: string | null;
  createdAt: string;
}

export interface PolicyChangeWithContext extends PolicyChange {
  policyTitle: string;
  payerName: string;
}

export interface DashboardStats {
  totalPolicies: number;
  activePolicies: number;
  upcomingPolicies: number;
  highImpact: number;
  totalPayers: number;
  upcomingEffective: PolicyWithPayer[]; // effective within the next 90 days
  reviewDue: PolicyWithPayer[]; // next review date in the past or within 30 days
  recentChanges: PolicyChangeWithContext[];
  byCategory: { category: string; count: number }[];
  byPayer: { payerName: string; count: number }[];
}
