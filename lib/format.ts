// Shared, timezone-stable formatting helpers.

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Parse as a plain calendar date to avoid off-by-one from UTC conversion.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days from today (UTC) to the given ISO date. Negative = in the past. */
export function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - todayUtc) / 86_400_000);
}

export function relativeDays(iso: string | null | undefined): string {
  const diff = daysFromToday(iso);
  if (diff === null) return "";
  if (diff === 0) return "today";
  if (diff === 1) return "in 1 day";
  if (diff === -1) return "1 day ago";
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}
