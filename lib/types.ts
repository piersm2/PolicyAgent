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
  sourceUrl: string | null; // the policy's own document
  summary: string | null; // shown as "Notes"
  reviewEveryMonths: number;
  lastReviewedAt: string | null; // date
  owner: string | null;
  nextAction: string | null;
  actionDue: string | null; // date
  createdAt: string;
  updatedAt: string;
}

export interface PolicyWithPayer extends Policy {
  status: PolicyStatus;
  payerName: string;
  payerType: PayerType;
  /** Id of the watch page following this policy's document, if any. */
  documentWatchId: number | null;
}

export const REVIEW_INTERVALS = [1, 3, 6, 12, 24] as const;

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

export interface PageLink {
  url: string;
  text: string;
}

/** A payer web page the app checks for changes. */
export interface WatchPage {
  id: number;
  payerId: number;
  payerName: string;
  policyId: number | null;
  policyTitle: string | null;
  url: string;
  label: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastNote: string | null;
  unreviewedChanges: number;
  createdAt: string;
}

/** What differed on a watched page between two checks. */
export interface PageChange {
  id: number;
  pageId: number;
  policyId: number | null;
  policyTitle: string | null;
  payerName: string;
  pageLabel: string;
  pageUrl: string;
  detectedAt: string;
  newLinks: PageLink[];
  removedLinks: PageLink[];
  addedText: string[];
  removedText: string[];
  fileChanged: boolean;
  reviewedAt: string | null;
}
