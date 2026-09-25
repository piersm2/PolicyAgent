import type { PolicyChange, PolicyWithPayer } from "./types";
import { daysFromToday } from "./format";

// A ranked, explained view of which policies most need attention right now.
// Deterministic, so the Home page and the compiled feed always agree.

export interface RankedPolicy {
  policy: PolicyWithPayer;
  score: number;
  reasons: string[];
}

const IMPACT_POINTS: Record<string, number> = { High: 40, Medium: 20, Low: 5 };
const STATUS_POINTS: Record<string, number> = { Upcoming: 25, Active: 10 };
// Categories that tend to hit reimbursement/denials hardest get a nudge.
const CATEGORY_POINTS: Record<string, number> = {
  "Prior Authorization": 8,
  Reimbursement: 8,
  "Medical Necessity": 5,
  "Billing & Coding": 5,
};

export function rankPolicies(
  policies: PolicyWithPayer[],
  latestChange: Map<number, PolicyChange>
): RankedPolicy[] {
  return policies
    .map((p) => score(p, latestChange.get(p.id)))
    .sort((a, b) => b.score - a.score);
}

function score(policy: PolicyWithPayer, mostRecent: PolicyChange | undefined): RankedPolicy {
  let score = 0;
  const reasons: string[] = [];

  score += IMPACT_POINTS[policy.impact] ?? 0;
  if (policy.impact === "High") reasons.push("High operational/financial impact");

  score += STATUS_POINTS[policy.status] ?? 0;

  // Urgency toward the effective date (upcoming changes need operationalizing).
  const toEffective = daysFromToday(policy.effectiveDate);
  if (toEffective !== null && toEffective >= 0) {
    if (toEffective <= 14) {
      score += 25;
      reasons.push(`Takes effect in ${toEffective} day${toEffective === 1 ? "" : "s"}`);
    } else if (toEffective <= 30) {
      score += 18;
      reasons.push(`Takes effect in ${toEffective} days`);
    } else if (toEffective <= 60) {
      score += 10;
      reasons.push(`Takes effect in ${toEffective} days`);
    } else if (toEffective <= 90) {
      score += 5;
      reasons.push(`Takes effect in ${toEffective} days`);
    }
  }

  // Review pressure.
  const toReview = daysFromToday(policy.nextReviewDate);
  if (toReview !== null) {
    if (toReview < 0) {
      score += 20;
      reasons.push(`Review overdue by ${Math.abs(toReview)} day${toReview === -1 ? "" : "s"}`);
    } else if (toReview <= 14) {
      score += 12;
      reasons.push(`Review due in ${toReview} day${toReview === 1 ? "" : "s"}`);
    } else if (toReview <= 30) {
      score += 6;
      reasons.push(`Review due in ${toReview} days`);
    }
  }

  // Recent activity (latest change dated today or earlier).
  if (mostRecent) {
    const age = daysFromToday(mostRecent.changeDate);
    if (age !== null && age <= 0) {
      if (age >= -14) {
        score += 12;
        reasons.push(`Changed ${describeAge(age)}`);
      } else if (age >= -30) {
        score += 6;
        reasons.push(`Changed ${describeAge(age)}`);
      }
    }
  }

  const categoryPoints = CATEGORY_POINTS[policy.category] ?? 0;
  if (categoryPoints > 0) {
    score += categoryPoints;
    reasons.push(`${policy.category} policy`);
  }

  if (reasons.length === 0) reasons.push("Baseline tracking");

  return { policy, score, reasons };
}

function describeAge(age: number): string {
  if (age === 0) return "today";
  const n = Math.abs(age);
  return `${n} day${n === 1 ? "" : "s"} ago`;
}
