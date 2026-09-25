import { latestPastChangeByPolicy, listPolicies, countPayers, recentChanges } from "./repo";
import { rankPolicies } from "./priority";
import type { Impact, PolicyChangeWithContext, PolicyStatus } from "./types";

const NEEDS_ATTENTION_SIZE = 8;
const RECENT_CHANGES_SIZE = 6;

export interface AttentionItem {
  id: number;
  title: string;
  payerName: string;
  category: string;
  status: PolicyStatus;
  impact: Impact;
  effectiveDate: string | null;
  nextReviewDate: string | null;
  score: number;
  reasons: string[];
}

export interface Board {
  counts: { policies: number; upcoming: number; highImpact: number; payers: number };
  needsAttention: AttentionItem[];
  recentChanges: PolicyChangeWithContext[];
}

/** Everything on the Home page. Also served as JSON at GET /api/board. */
export function getBoard(): Board {
  const policies = listPolicies();
  const ranked = rankPolicies(policies, latestPastChangeByPolicy());

  return {
    counts: {
      policies: policies.length,
      upcoming: policies.filter((p) => p.status === "Upcoming").length,
      highImpact: policies.filter((p) => p.impact === "High").length,
      payers: countPayers(),
    },
    needsAttention: ranked.slice(0, NEEDS_ATTENTION_SIZE).map(({ policy: p, score, reasons }) => ({
      id: p.id,
      title: p.title,
      payerName: p.payerName,
      category: p.category,
      status: p.status,
      impact: p.impact,
      effectiveDate: p.effectiveDate,
      nextReviewDate: p.nextReviewDate,
      score,
      reasons,
    })),
    recentChanges: recentChanges(RECENT_CHANGES_SIZE),
  };
}
