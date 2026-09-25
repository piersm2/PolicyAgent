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

// Status is derived from the effective date, never entered by hand:
// a future effective date means Upcoming, otherwise Active.
export type PolicyStatus = "Active" | "Upcoming";

export type Impact = "High" | "Medium" | "Low";

export const IMPACTS: Impact[] = ["High", "Medium", "Low"];

export interface Payer {
  id: number;
  name: string;
  type: PayerType;
  website: string | null;
  createdAt: string;
}

export interface Policy {
  id: number;
  payerId: number;
  title: string;
  category: PolicyCategory;
  impact: Impact;
  effectiveDate: string | null; // ISO date (YYYY-MM-DD)
  nextReviewDate: string | null;
  sourceUrl: string | null;
  summary: string | null; // shown as "Notes"
  createdAt: string;
  updatedAt: string;
}

export interface PolicyWithPayer extends Policy {
  status: PolicyStatus;
  payerName: string;
  payerType: PayerType;
}

export interface PolicyChange {
  id: number;
  policyId: number;
  changeDate: string; // ISO date
  summary: string;
  createdAt: string;
}

export interface PolicyChangeWithContext extends PolicyChange {
  policyTitle: string;
  payerName: string;
}
