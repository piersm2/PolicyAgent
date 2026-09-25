import { IMPACTS, PAYER_TYPES, POLICY_CATEGORIES, REVIEW_INTERVALS } from "./types";
import { safeHref, today } from "./format";

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
  };
}

/**
 * Policy pages entered on the payer form, one per line: "https://…" or
 * "Label | https://…". Blank lines are skipped.
 */
export function parsePayerPages(v: unknown): { url: string; label: string }[] {
  if (v === undefined || v === null || v === "") return [];
  const lines = Array.isArray(v) ? v.map(String) : String(v).split(/\r?\n/);
  const pages: { url: string; label: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const bar = line.lastIndexOf("|");
    const url = (bar >= 0 ? line.slice(bar + 1) : line).trim();
    if (!safeHref(url)) throw new ValidationError(`Policy page "${line}" must be an http:// or https:// URL.`);
    const label = bar >= 0 ? line.slice(0, bar).trim() : "";
    pages.push({ url, label: label || defaultLabel(url) });
  }
  return pages;
}

function defaultLabel(url: string): string {
  const { hostname, pathname } = new URL(url);
  const last = pathname.split("/").filter(Boolean).pop();
  const name = last ? decodeURIComponent(last).replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ") : hostname;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function parsePolicy(body: any) {
  const payerId = Number(body.payerId);
  if (!Number.isInteger(payerId) || payerId <= 0) {
    throw new ValidationError(`"payerId" must reference a valid payer.`);
  }
  return {
    payerId,
    title: required(body.title, "title"),
    category: oneOf(body.category, POLICY_CATEGORIES, "category"),
    impact: oneOf(body.impact ?? "Medium", IMPACTS, "impact"),
    effectiveDate: optDate(body.effectiveDate, "effectiveDate"),
    nextReviewDate: optDate(body.nextReviewDate, "nextReviewDate"),
    sourceUrl: optUrl(body.sourceUrl, "sourceUrl"),
    summary: str(body.summary),
    reviewEveryMonths: reviewInterval(body.reviewEveryMonths),
    owner: str(body.owner),
    nextAction: str(body.nextAction),
    actionDue: optDate(body.actionDue, "actionDue"),
    // Default on: a policy with a document link is watched unless told otherwise.
    watchDocument: body.watchDocument === undefined ? true : Boolean(body.watchDocument),
  };
}

function reviewInterval(v: unknown): number {
  if (v === undefined || v === null || v === "") return 12;
  const n = Number(v);
  if (!(REVIEW_INTERVALS as readonly number[]).includes(n)) {
    throw new ValidationError(`"reviewEveryMonths" must be one of: ${REVIEW_INTERVALS.join(", ")}.`);
  }
  return n;
}

export function parseChange(body: any) {
  return {
    changeDate: optDate(body.changeDate, "changeDate") ?? today(),
    summary: required(body.summary, "summary"),
  };
}

export function parseWatchPage(body: any) {
  const payerId = Number(body.payerId);
  if (!Number.isInteger(payerId) || payerId <= 0) {
    throw new ValidationError(`"payerId" must reference a valid payer.`);
  }
  const url = optUrl(body.url, "url");
  if (!url) throw new ValidationError(`"url" is required.`);
  return { payerId, url, label: str(body.label) ?? "Policy page" };
}
