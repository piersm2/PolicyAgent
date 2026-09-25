// Shared date/time helpers.
//
// Timestamps are stored in UTC ("YYYY-MM-DD HH:MM:SS", SQLite datetime('now')).
// Calendar dates (effective, review, change, due dates) are plain "YYYY-MM-DD".
// Everything is shown, and "today" is decided, in one time zone so the server
// and browser always agree.
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Chicago";

const DAY_MS = 86_400_000;

/** Today's calendar date (YYYY-MM-DD) in TIME_ZONE. */
export function today(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** A calendar date shifted by whole days, e.g. addDays("2026-09-25", 30). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A calendar date shifted by whole months (end-of-month clamped: Jan 31 + 1 → Feb 28). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function parseTimestamp(ts: string): Date {
  return new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
}

/** UTC timestamp as ISO 8601 with Z, for JSON consumers. */
export function isoUtc(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = parseTimestamp(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString();
}

/** "Sep 25, 2026". A plain date is shown as-is; a timestamp is converted to TIME_ZONE first. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const isTimestamp = value.length > 10;
  const date = isTimestamp ? parseTimestamp(value) : new Date(value + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: isTimestamp ? TIME_ZONE : "UTC",
  });
}

/** UTC timestamp shown in TIME_ZONE, e.g. "Sep 24, 10:25 PM CDT". */
export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = parseTimestamp(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  });
}

/** Whole days from today (in TIME_ZONE) to a calendar date. Negative = in the past. */
export function daysFromToday(date: string | null | undefined): number | null {
  if (!date) return null;
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const [ty, tm, td] = today().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
}

export function relativeDays(date: string | null | undefined): string {
  const diff = daysFromToday(date);
  if (diff === null) return "";
  if (diff === 0) return "today";
  if (diff === 1) return "in 1 day";
  if (diff === -1) return "1 day ago";
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}

/** Returns the URL only if it is http(s); anything else (e.g. javascript:) is dropped. */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
