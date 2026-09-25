import {
  CHANGE_TYPES,
  IMPACTS,
  PAYER_TYPES,
  POLICY_CATEGORIES,
  POLICY_STATUSES,
} from "./types";

import { safeHref, todayLocal } from "./format";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function required(v: unknown, field: string): string {
  const s = str(v);
  if (!s) throw new ValidationError(`"${field}" is required.`);
  return s;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  const s = required(v, field);
  if (!(allowed as readonly string[]).includes(s)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(", ")}.`);
  }
  return s as T;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function optDate(v: unknown, field: string): string | null {
  const s = str(v);
  if (!s) return null;
  const invalid = new ValidationError(`"${field}" must be a valid date (YYYY-MM-DD).`);
  if (!DATE_RE.test(s)) throw invalid;
  // Reject impossible dates like 2026-02-30, which JS would roll over to March.
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw invalid;
  return s;
}

function optUrl(v: unknown, field: string): string | null {
  const s = str(v);
  if (!s) return null;
  if (!safeHref(s)) throw new ValidationError(`"${field}" must be an http:// or https:// URL.`);
  return s;
}

export function parsePayer(body: any) {
  return {
    name: required(body.name, "name"),
    type: oneOf(body.type, PAYER_TYPES, "type"),
    website: optUrl(body.website, "website"),
    contact: str(body.contact),
    notes: str(body.notes),
  };
}

export function parsePolicy(body: any) {
  const payerId = Number(body.payerId);
  if (!Number.isInteger(payerId) || payerId <= 0) {
    throw new ValidationError(`"payerId" must reference a valid payer.`);
  }
  return {
    payerId,
    policyNumber: str(body.policyNumber),
    title: required(body.title, "title"),
    category: oneOf(body.category, POLICY_CATEGORIES, "category"),
    status: oneOf(body.status ?? "Active", POLICY_STATUSES, "status"),
    impact: oneOf(body.impact ?? "Medium", IMPACTS, "impact"),
    effectiveDate: optDate(body.effectiveDate, "effectiveDate"),
    endDate: optDate(body.endDate, "endDate"),
    nextReviewDate: optDate(body.nextReviewDate, "nextReviewDate"),
    version: str(body.version),
    sourceUrl: optUrl(body.sourceUrl, "sourceUrl"),
    summary: str(body.summary),
  };
}

export function parseChange(body: any) {
  return {
    changeDate: optDate(body.changeDate, "changeDate") ?? todayLocal(),
    changeType: oneOf(body.changeType ?? "Revised", CHANGE_TYPES, "changeType"),
    version: str(body.version),
    summary: required(body.summary, "summary"),
    notedBy: str(body.notedBy),
  };
}
