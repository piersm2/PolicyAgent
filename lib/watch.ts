import { getDb } from "./db";
import { fetchSnapshot, type Snapshot } from "./extract";
import { ValidationError } from "./validate";
import type { PageChange, PageLink, WatchPage } from "./types";

// ---------------------------------------------------------------------------
// Watch pages
// ---------------------------------------------------------------------------
const PAGE_SELECT = `
  SELECT w.id, w.payerId, pay.name AS payerName, w.url, w.label, w.lastCheckedAt,
         w.lastSuccessAt, w.lastError, w.lastNote, w.createdAt,
         (SELECT COUNT(*) FROM page_changes c WHERE c.pageId = w.id AND c.reviewedAt IS NULL)
           AS unreviewedChanges
  FROM watch_pages w
  JOIN payers pay ON pay.id = w.payerId
`;

export function listWatchPages(): WatchPage[] {
  return getDb()
    .prepare(PAGE_SELECT + " ORDER BY pay.name COLLATE NOCASE, w.label COLLATE NOCASE")
    .all() as WatchPage[];
}

export function addWatchPage(input: { payerId: number; url: string; label: string }): WatchPage {
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM payers WHERE id = ?").get(input.payerId)) {
    throw new ValidationError(`Payer ${input.payerId} does not exist.`);
  }
  const info = db
    .prepare("INSERT INTO watch_pages (payerId, url, label) VALUES (@payerId, @url, @label)")
    .run(input);
  return db.prepare(PAGE_SELECT + " WHERE w.id = ?").get(Number(info.lastInsertRowid)) as WatchPage;
}

export function deleteWatchPage(id: number): boolean {
  return getDb().prepare("DELETE FROM watch_pages WHERE id = ?").run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// Detected changes
// ---------------------------------------------------------------------------
const MAX_ITEMS_PER_LIST = 100;

export function listPageChanges(opts: { unreviewedOnly?: boolean; limit?: number } = {}): PageChange[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, w.label AS pageLabel, w.url AS pageUrl, pay.name AS payerName
       FROM page_changes c
       JOIN watch_pages w ON w.id = c.pageId
       JOIN payers pay ON pay.id = w.payerId
       ${opts.unreviewedOnly ? "WHERE c.reviewedAt IS NULL" : ""}
       ORDER BY c.detectedAt DESC, c.id DESC
       LIMIT ?`
    )
    .all(opts.limit ?? 50) as any[];
  return rows.map((r) => ({
    ...r,
    newLinks: JSON.parse(r.newLinks),
    removedLinks: JSON.parse(r.removedLinks),
    addedText: JSON.parse(r.addedText),
    removedText: JSON.parse(r.removedText),
    fileChanged: Boolean(r.fileChanged),
  }));
}

export function markChangeReviewed(id: number): boolean {
  return (
    getDb()
      .prepare("UPDATE page_changes SET reviewedAt = datetime('now') WHERE id = ? AND reviewedAt IS NULL")
      .run(id).changes > 0
  );
}

// ---------------------------------------------------------------------------
// Checking pages
// ---------------------------------------------------------------------------
export type CheckResult =
  | { pageId: number; outcome: "baseline" | "unchanged" }
  | { pageId: number; outcome: "changed"; changeId: number }
  | { pageId: number; outcome: "error"; error: string };

declare global {
  // eslint-disable-next-line no-var
  var __policyAgentCheckQueue: Promise<unknown> | undefined;
  // eslint-disable-next-line no-var
  var __policyAgentScheduler: boolean | undefined;
}

/**
 * Check the given pages ("all", "due", or specific ids). Runs are queued so a
 * scheduled check and a "Check now" click never fetch the same page at once.
 */
export function checkPages(which: "all" | "due" | number[]): Promise<CheckResult[]> {
  const run = (global.__policyAgentCheckQueue ?? Promise.resolve())
    .catch(() => {})
    .then(() => runChecks(which));
  global.__policyAgentCheckQueue = run;
  return run;
}

async function runChecks(which: "all" | "due" | number[]): Promise<CheckResult[]> {
  const db = getDb();
  let ids: number[];
  if (which === "all") {
    ids = (db.prepare("SELECT id FROM watch_pages ORDER BY id").all() as { id: number }[]).map((r) => r.id);
  } else if (which === "due") {
    ids = (
      db
        .prepare(
          `SELECT id FROM watch_pages
           WHERE lastCheckedAt IS NULL OR lastCheckedAt <= datetime('now', ?)
           ORDER BY id`
        )
        .all(`-${checkEveryHours()} hours`) as { id: number }[]
    ).map((r) => r.id);
  } else {
    ids = which;
  }

  const results: CheckResult[] = [];
  for (const [i, id] of ids.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000)); // be polite to payer sites
    results.push(await checkPage(id));
  }
  return results;
}

async function checkPage(pageId: number): Promise<CheckResult> {
  const db = getDb();
  const page = db.prepare("SELECT id, url, snapshot FROM watch_pages WHERE id = ?").get(pageId) as
    | { id: number; url: string; snapshot: string | null }
    | undefined;
  if (!page) return { pageId, outcome: "error", error: "Watch page not found." };

  let snap: Snapshot;
  try {
    snap = await fetchSnapshot(page.url);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Check failed.";
    db.prepare("UPDATE watch_pages SET lastCheckedAt = datetime('now'), lastError = ? WHERE id = ?").run(error, pageId);
    return { pageId, outcome: "error", error };
  }

  const prev: Snapshot | null = page.snapshot ? JSON.parse(page.snapshot) : null;
  let result: CheckResult = { pageId, outcome: prev ? "unchanged" : "baseline" };

  const save = db.transaction(() => {
    if (prev && prev.hash !== snap.hash) {
      const diff = diffSnapshots(prev, snap);
      if (diff) {
        const info = db
          .prepare(
            `INSERT INTO page_changes (pageId, newLinks, removedLinks, addedText, removedText, fileChanged)
             VALUES (@pageId, @newLinks, @removedLinks, @addedText, @removedText, @fileChanged)`
          )
          .run({ pageId, ...diff });
        result = { pageId, outcome: "changed", changeId: Number(info.lastInsertRowid) };
      }
    }
    db.prepare(
      `UPDATE watch_pages SET lastCheckedAt = datetime('now'), lastSuccessAt = datetime('now'),
         lastError = NULL, lastNote = ?, snapshot = ? WHERE id = ?`
    ).run(snap.note, JSON.stringify(snap), pageId);
  });
  save();
  return result;
}

function diffSnapshots(prev: Snapshot, next: Snapshot) {
  const fileChanged = prev.kind === "file" || next.kind === "file";
  const prevUrls = new Set(prev.links.map((l) => l.url));
  const nextUrls = new Set(next.links.map((l) => l.url));
  const prevLines = new Set(prev.lines);
  const nextLines = new Set(next.lines);

  const newLinks: PageLink[] = next.links.filter((l) => !prevUrls.has(l.url)).slice(0, MAX_ITEMS_PER_LIST);
  const removedLinks: PageLink[] = prev.links.filter((l) => !nextUrls.has(l.url)).slice(0, MAX_ITEMS_PER_LIST);
  // A list item that is just a new link's title is already reported as a link.
  const newLinkText = new Set(newLinks.map((l) => l.text));
  const removedLinkText = new Set(removedLinks.map((l) => l.text));
  const addedText = next.lines
    .filter((l) => !prevLines.has(l) && !newLinkText.has(l))
    .slice(0, MAX_ITEMS_PER_LIST);
  const removedText = prev.lines
    .filter((l) => !nextLines.has(l) && !removedLinkText.has(l))
    .slice(0, MAX_ITEMS_PER_LIST);

  if (!fileChanged && !newLinks.length && !removedLinks.length && !addedText.length && !removedText.length) {
    return null;
  }
  return {
    newLinks: JSON.stringify(newLinks),
    removedLinks: JSON.stringify(removedLinks),
    addedText: JSON.stringify(addedText),
    removedText: JSON.stringify(removedText),
    fileChanged: fileChanged ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Background schedule
// ---------------------------------------------------------------------------
export function checkEveryHours(): number {
  const hours = Number(process.env.CHECK_EVERY_HOURS);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}

/** While the app runs, check pages that are due shortly after start and then hourly. */
export function startWatchScheduler() {
  if (global.__policyAgentScheduler) return;
  global.__policyAgentScheduler = true;

  const runDue = () =>
    checkPages("due")
      .then((results) => {
        if (results.length) {
          const changed = results.filter((r) => r.outcome === "changed").length;
          const failed = results.filter((r) => r.outcome === "error").length;
          console.log(`[watch] checked ${results.length} page(s): ${changed} changed, ${failed} failed`);
        }
      })
      .catch((err) => console.error("[watch] scheduled check failed:", err));

  setTimeout(runDue, 15_000).unref();
  setInterval(runDue, 60 * 60 * 1000).unref();
}
