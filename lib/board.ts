import { latestPastChangeByPolicy, listActionItems, listPolicies, countPayers, recentChanges } from "./repo";
import { daysFromToday } from "./format";
import { rankPolicies } from "./priority";
import { policiesWithUnreviewedChanges } from "./watch";
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

export interface ActionItem {
  policyId: number;
  title: string;
  payerName: string;
  owner: string | null;
  nextAction: string;
  actionDue: string | null;
  overdue: boolean;
}

export interface Board {
  counts: { policies: number; upcoming: number; highImpact: number; payers: number; openActions: number; overdueActions: number };
  needsAttention: AttentionItem[];
  actionItems: ActionItem[];
  recentChanges: PolicyChangeWithContext[];
}

/** Home page board data; also part of the compiled feed (lib/feed.ts). */
export function getBoard(): Board {
  const policies = listPolicies();
  const ranked = rankPolicies(policies, latestPastChangeByPolicy(), policiesWithUnreviewedChanges());
  const actionItems: ActionItem[] = listActionItems().map((p) => ({
    policyId: p.id,
    title: p.title,
    payerName: p.payerName,
    owner: p.owner,
    nextAction: p.nextAction!,
    actionDue: p.actionDue,
    overdue: (daysFromToday(p.actionDue) ?? 0) < 0,
  }));

  return {
    counts: {
      policies: policies.length,
      upcoming: policies.filter((p) => p.status === "Upcoming").length,
      highImpact: policies.filter((p) => p.impact === "High").length,
      payers: countPayers(),
      openActions: actionItems.length,
      overdueActions: actionItems.filter((a) => a.overdue).length,
    },
    actionItems,
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
