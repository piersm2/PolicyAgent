import { getDb } from "./db";
import { AI_MODEL, AiError, aiEnabled, askClaude, estimateCost } from "./ai";
import { fetchSnapshot } from "./extract";
import { addDays, addMonths, today } from "./format";
import { SYSTEM, logUsage, nullableString, readDocument, runAiJob } from "./summaries";
import { ValidationError } from "./validate";
import type { PageLink, PolicyCategory, Relevance } from "./types";

// Historical import: for a watched listing page (monthly bulletins, transmittals,
// provider news), find the documents published in the last N months, then have
// Claude read each one and list the policy changes it announced. Jobs are queued
// and processed one document at a time in the background; they survive restarts.

export type JobStatus = "discovering" | "ready" | "queued" | "running" | "done" | "failed" | "cancelled";

export interface ImportJob {
  id: number;
  pageId: number;
  pageLabel: string;
  pageUrl: string;
  payerName: string;
  sinceDate: string;
  status: JobStatus;
  error: string | null;
  docsFound: number;
  docsDone: number;
  docsFailed: number;
  entriesFound: number;
  estimatedCost: number | null;
  spent: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export const CHANGE_TYPES = [
  "new",
  "revised",
  "retired",
  "reimbursement",
  "prior_authorization",
  "coverage",
  "coding",
  "administrative",
  "other",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface HistoryEntry {
  id: number;
  payerId: number;
  payerName: string;
  sourceUrl: string;
  sourceTitle: string;
  publishedDate: string | null;
  policyName: string;
  policyNumber: string | null;
  changeType: ChangeType;
  effectiveDate: string | null;
  summary: string;
  relevance: Relevance;
  policyId: number | null;
  policyTitle: string | null;
}

const MAX_DISCOVERY_PAGES = 4; // the listing page plus up to 3 archive pages
const MAX_LINKS_PER_PAGE = 600;
const MAX_DOCS_PER_JOB = 60;
const PAUSE_MS = 1500; // between documents, to be polite to payer sites
// Rough tokens per document, for the estimate shown before an import starts.
const EST_DOC = { input: 30_000, output: 3_000 };
const EST_DOC_HIGH = { input: 90_000, output: 6_000 };

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
const JOB_SELECT = `
  SELECT j.*, w.label AS pageLabel, w.url AS pageUrl, pay.name AS payerName,
         (SELECT SUM(u.inputTokens) FROM ai_usage u WHERE u.kind = 'import' AND u.refId = j.id) AS inTok,
         (SELECT SUM(u.outputTokens) FROM ai_usage u WHERE u.kind = 'import' AND u.refId = j.id) AS outTok
  FROM import_jobs j
  JOIN watch_pages w ON w.id = j.pageId
  JOIN payers pay ON pay.id = w.payerId
`;

function toJob(r: any): ImportJob {
  const { inTok, outTok, ...rest } = r;
  return { ...rest, spent: inTok ? estimateCost(AI_MODEL, inTok, outTok ?? 0) : 0 };
}

export function listJobs(): ImportJob[] {
  return (getDb().prepare(JOB_SELECT + " ORDER BY j.id DESC").all() as any[]).map(toJob);
}

function getJob(id: number): ImportJob | undefined {
  const r = getDb().prepare(JOB_SELECT + " WHERE j.id = ?").get(id);
  return r ? toJob(r) : undefined;
}

/** Queue discovery for each listing page; documents are imported after you start the job. */
export function createImportJobs(pageIds: number[], months: number): ImportJob[] {
  if (!aiEnabled()) throw new ValidationError("The historical import needs an Anthropic API key (see the README).");
  if (![3, 6, 12, 24].includes(months)) throw new ValidationError('"months" must be 3, 6, 12, or 24.');
  const db = getDb();
  const since = addMonths(today(), -months);
  const ids: number[] = [];
  db.transaction(() => {
    for (const pageId of pageIds) {
      const page = db.prepare("SELECT id, policyId FROM watch_pages WHERE id = ?").get(pageId) as
        | { id: number; policyId: number | null }
        | undefined;
      if (!page) throw new ValidationError(`Watched page ${pageId} doesn't exist.`);
      if (page.policyId) throw new ValidationError("Pick listing pages, not a single policy's document.");
      const active = db
        .prepare("SELECT 1 FROM import_jobs WHERE pageId = ? AND status IN ('discovering','ready','queued','running')")
        .get(pageId);
      if (active) continue; // already in the queue
      ids.push(Number(db.prepare("INSERT INTO import_jobs (pageId, sinceDate, status) VALUES (?, ?, 'discovering')").run(pageId, since).lastInsertRowid));
    }
  })();
  kickImportWorker();
  return ids.map((id) => getJob(id)!);
}

export function updateJob(id: number, action: "start" | "cancel" | "retry"): ImportJob {
  const db = getDb();
  const job = getJob(id);
  if (!job) throw new ValidationError("Import not found.");
  if (action === "start") {
    if (job.status !== "ready") throw new ValidationError("Only an import that has found its documents can be started.");
    db.prepare("UPDATE import_jobs SET status = 'queued' WHERE id = ?").run(id);
  } else if (action === "cancel") {
    if (["done", "cancelled"].includes(job.status)) throw new ValidationError("This import has already finished.");
    db.prepare("UPDATE import_jobs SET status = 'cancelled', finishedAt = datetime('now') WHERE id = ?").run(id);
  } else {
    if (!["failed", "done", "cancelled"].includes(job.status)) throw new ValidationError("This import is still going.");
    db.transaction(() => {
      const retried = db.prepare("UPDATE import_docs SET status = 'pending', error = NULL WHERE jobId = ? AND status = 'failed'").run(id).changes;
      const pending = (db.prepare("SELECT COUNT(*) AS n FROM import_docs WHERE jobId = ? AND status = 'pending'").get(id) as { n: number }).n;
      const next = job.docsFound === 0 ? "discovering" : pending ? "queued" : "done";
      db.prepare(
        "UPDATE import_jobs SET status = ?, error = NULL, docsFailed = docsFailed - ?, finishedAt = NULL WHERE id = ?"
      ).run(next, retried, id);
    })();
  }
  kickImportWorker();
  return getJob(id)!;
}

export function startAllReady(): number {
  const n = getDb().prepare("UPDATE import_jobs SET status = 'queued' WHERE status = 'ready'").run().changes;
  kickImportWorker();
  return n;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __policyAgentImportWorker: Promise<void> | undefined;
}

/** Start processing the import queue in the background (no-op if already running). */
export function kickImportWorker(): void {
  if (!aiEnabled() || global.__policyAgentImportWorker) return;
  global.__policyAgentImportWorker = (async () => {
    try {
      while (await runAiJob(processNextUnit)) await new Promise((r) => setTimeout(r, PAUSE_MS));
    } catch (err) {
      console.error("[import] worker stopped:", err);
    } finally {
      global.__policyAgentImportWorker = undefined;
    }
  })();
}

/** Process up to `max` units (for scripts/check-due.ts when the app isn't running). */
export async function processImports(max: number): Promise<number> {
  if (!aiEnabled()) return 0;
  let done = 0;
  while (done < max && (await runAiJob(processNextUnit))) {
    done++;
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  return done;
}

/** Discover one job's documents, or import one document. False when there's nothing to do. */
async function processNextUnit(): Promise<boolean> {
  const db = getDb();
  const discovering = db.prepare("SELECT id FROM import_jobs WHERE status = 'discovering' ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (discovering) {
    await discover(discovering.id);
    return true;
  }
  const next = db
    .prepare(
      `SELECT d.id, d.jobId FROM import_docs d JOIN import_jobs j ON j.id = d.jobId
       WHERE j.status IN ('queued','running') AND d.status = 'pending'
       ORDER BY j.id, d.publishedDate DESC, d.id LIMIT 1`
    )
    .get() as { id: number; jobId: number } | undefined;
  if (!next) {
    for (const j of db.prepare("SELECT id FROM import_jobs WHERE status IN ('queued','running')").all() as { id: number }[]) {
      finishIfComplete(j.id);
    }
    return false;
  }
  db.prepare("UPDATE import_jobs SET status = 'running' WHERE id = ? AND status = 'queued'").run(next.jobId);
  await importDocument(next.id);
  return true;
}

function failJob(jobId: number, message: string) {
  getDb().prepare("UPDATE import_jobs SET status = 'failed', error = ?, finishedAt = datetime('now') WHERE id = ?").run(message, jobId);
}

/** Errors that will repeat for every document: stop the job instead of burning through it. */
function isAccountError(message: string): boolean {
  return /api key|credit balance|billing|isn't allowed|wasn't found\. Check AI_MODEL/i.test(message);
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------
const DISCOVER_SCHEMA = {
  type: "object",
  properties: {
    documents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string", description: "Copied exactly from the link list." },
          title: { type: "string" },
          publishedDate: { ...nullableString, description: "YYYY-MM-DD (use the 1st for month-only dates), or null if unknown." },
        },
        required: ["url", "title", "publishedDate"],
        additionalProperties: false,
      },
    },
    archivePages: {
      type: "array",
      items: { type: "string" },
      description: "Links (copied exactly) to older listings, archives, or next pages likely to hold items from the period.",
    },
  },
  required: ["documents", "archivePages"],
  additionalProperties: false,
};

interface Discovered {
  documents: { url: string; title: string; publishedDate: string | null }[];
  archivePages: string[];
}

async function discover(jobId: number): Promise<void> {
  const db = getDb();
  const job = getJob(jobId);
  if (!job || job.status !== "discovering") return;
  const found = new Map<string, { title: string; publishedDate: string | null }>();
  const queue = [job.pageUrl];
  const seen = new Set<string>();
  const host = new URL(job.pageUrl).host;

  try {
    for (let i = 0; i < queue.length && seen.size < MAX_DISCOVERY_PAGES; i++) {
      const url = queue[i];
      if (seen.has(url)) continue;
      seen.add(url);
      let links: PageLink[];
      let lines: string[];
      try {
        const snap = await fetchSnapshot(url);
        links = snap.links.slice(0, MAX_LINKS_PER_PAGE);
        lines = snap.lines;
      } catch (err) {
        if (url === job.pageUrl) throw err;
        continue; // an archive page failed; keep what we have
      }
      if (!links.length) continue;

      const result = await askClaude<Discovered>({
        system: SYSTEM,
        schema: DISCOVER_SCHEMA,
        content: [
          {
            type: "text",
            text: [
              `Today is ${today()}. We're importing history from ${job.payerName}'s page "${job.pageLabel}" (${url}).`,
              `From the links below, list the bulletins, policy update notices, newsletters, transmittals, or policy documents published on or after ${job.sinceDate}.`,
              "Use the link text, the address, and the page text to work out each item's date. Include an item with no clear date only if it looks recent.",
              "Leave out navigation, general pages, and items clearly unrelated to a hospital's services (for example dental-only, vision-only, or supplier-only notices).",
              "In archivePages, list links to older listings, archives, or next pages that likely hold items from the period (none if this page already covers it).",
              "",
              `<page_text>\n${lines.slice(0, 250).join("\n")}\n</page_text>`,
              "",
              `<links>\n${links.map((l) => `- ${l.text} | ${l.url}`).join("\n")}\n</links>`,
            ].join("\n"),
          },
        ],
      });
      logUsage("import", jobId, result);

      const known = new Set(links.map((l) => l.url));
      for (const d of result.data.documents) {
        if (!known.has(d.url)) continue; // only links that are really on the page
        if (d.publishedDate && d.publishedDate < job.sinceDate) continue;
        if (!found.has(d.url)) found.set(d.url, { title: d.title.slice(0, 300), publishedDate: validDate(d.publishedDate) });
      }
      for (const a of result.data.archivePages) {
        if (known.has(a) && safeHost(a) === host && !seen.has(a)) queue.push(a);
      }
    }
  } catch (err) {
    failJob(jobId, err instanceof Error ? err.message : "Couldn't read the page.");
    return;
  }

  // Skip documents this payer has already imported.
  const alreadyDone = new Set(
    (
      db
        .prepare(
          `SELECT d.url FROM import_docs d JOIN import_jobs j ON j.id = d.jobId JOIN watch_pages w ON w.id = j.pageId
           WHERE d.status = 'done' AND w.payerId = (SELECT payerId FROM watch_pages WHERE id = ?)`
        )
        .all(job.pageId) as { url: string }[]
    ).map((r) => r.url)
  );
  const docs = Array.from(found.entries())
    .filter(([url]) => !alreadyDone.has(url))
    .sort(([, a], [, b]) => (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""))
    .slice(0, MAX_DOCS_PER_JOB);

  const perDoc = estimateCost(AI_MODEL, EST_DOC.input, EST_DOC.output);
  db.transaction(() => {
    const insert = db.prepare("INSERT OR IGNORE INTO import_docs (jobId, url, title, publishedDate) VALUES (?, ?, ?, ?)");
    for (const [url, d] of docs) insert.run(jobId, url, d.title, d.publishedDate);
    db.prepare(
      `UPDATE import_jobs SET status = ?, docsFound = ?, estimatedCost = ?, error = ?,
         finishedAt = CASE WHEN ? = 0 THEN datetime('now') END
       WHERE id = ? AND status = 'discovering'`
    ).run(
      docs.length ? "ready" : "done",
      docs.length,
      perDoc === null ? null : perDoc * docs.length,
      docs.length ? null : "No bulletins or notices from this period were found on the page.",
      docs.length,
      jobId
    );
  })();
}

/** High-end estimate for a job, for "could be up to" wording. */
export function estimateHigh(docs: number): number | null {
  const per = estimateCost(AI_MODEL, EST_DOC_HIGH.input, EST_DOC_HIGH.output);
  return per === null ? null : per * docs;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------
const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    publishedDate: { ...nullableString, description: "The document's publication date, YYYY-MM-DD, or null." },
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          policyName: { type: "string" },
          policyNumber: { ...nullableString, description: "Policy ID/number as printed, or null." },
          changeType: { type: "string", enum: [...CHANGE_TYPES] },
          effectiveDate: { ...nullableString, description: "YYYY-MM-DD, or null if not stated." },
          summary: { type: "string", description: "1-2 sentences: what changed, with codes and dates as stated." },
          relevance: {
            type: "string",
            enum: ["high", "medium", "low", "none"],
            description: "For our hospital: high if it affects payment, authorization, coverage, or deadlines for services we provide.",
          },
          trackedPolicyId: {
            anyOf: [{ type: "integer" }, { type: "null" }],
            description: "The id of the matching policy from our tracked list, or null.",
          },
        },
        required: ["policyName", "policyNumber", "changeType", "effectiveDate", "summary", "relevance", "trackedPolicyId"],
        additionalProperties: false,
      },
    },
  },
  required: ["publishedDate", "entries"],
  additionalProperties: false,
};

interface Extracted {
  publishedDate: string | null;
  entries: {
    policyName: string;
    policyNumber: string | null;
    changeType: ChangeType;
    effectiveDate: string | null;
    summary: string;
    relevance: Relevance;
    trackedPolicyId: number | null;
  }[];
}

async function importDocument(docId: number): Promise<void> {
  const db = getDb();
  const doc = db
    .prepare(
      `SELECT d.*, w.payerId, pay.name AS payerName, pay.type AS payerType
       FROM import_docs d JOIN import_jobs j ON j.id = d.jobId
       JOIN watch_pages w ON w.id = j.pageId JOIN payers pay ON pay.id = w.payerId
       WHERE d.id = ?`
    )
    .get(docId) as
    | { id: number; jobId: number; url: string; title: string; publishedDate: string | null; payerId: number; payerName: string; payerType: string }
    | undefined;
  if (!doc) return;
  const tracked = db.prepare("SELECT id, title FROM policies WHERE payerId = ? ORDER BY id").all(doc.payerId) as {
    id: number;
    title: string;
  }[];

  try {
    const content = await readDocument(doc.url);
    const intro = [
      `This is "${doc.title}" from ${doc.payerName} (${doc.payerType}), published ${doc.publishedDate ?? "on an unknown date"}.`,
      `Address: ${doc.url}`,
      content.partial ? `Note: ${content.partial}` : "",
      "",
      "List each policy change it announces or describes: new, revised, or retired policies, reimbursement and payment changes, prior authorization and coverage changes, and coding changes. One entry per policy. If the document is itself a single policy, return one entry describing it.",
      "Leave out marketing, event announcements, and general reminders that don't change a policy.",
      tracked.length
        ? `Our tracked policies for this payer (match by meaning, not exact wording; use null when none match):\n${tracked.map((t) => `[${t.id}] ${t.title}`).join("\n")}`
        : "We don't track any policies for this payer yet; use null for trackedPolicyId.",
    ]
      .filter((l) => l !== "")
      .join("\n");
    const blocks = content.pdfBase64
      ? [
          { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: content.pdfBase64 } },
          { type: "text" as const, text: intro },
        ]
      : [{ type: "text" as const, text: `${intro}\n\n<document>\n${content.text}\n</document>` }];

    const result = await askClaude<Extracted>({ system: SYSTEM, schema: EXTRACT_SCHEMA, content: blocks, maxTokens: 32000 });
    logUsage("import", doc.jobId, result);

    const trackedIds = new Set(tracked.map((t) => t.id));
    const published = doc.publishedDate ?? validDate(result.data.publishedDate);
    const keep = result.data.entries.filter((e) => e.relevance !== "none");
    db.transaction(() => {
      const insert = db.prepare(
        `INSERT INTO history_entries
           (payerId, importDocId, sourceUrl, sourceTitle, publishedDate, policyName, policyNumber, changeType,
            effectiveDate, summary, relevance, policyId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const logChange = db.prepare("INSERT INTO policy_changes (policyId, changeDate, summary, sourceUrl) VALUES (?, ?, ?, ?)");
      const exists = db.prepare("SELECT 1 FROM policy_changes WHERE policyId = ? AND sourceUrl = ? AND summary = ?");
      for (const e of keep) {
        const policyId = e.trackedPolicyId !== null && trackedIds.has(e.trackedPolicyId) ? e.trackedPolicyId : null;
        const type = (CHANGE_TYPES as readonly string[]).includes(e.changeType) ? e.changeType : "other";
        const effective = validDate(e.effectiveDate);
        insert.run(doc.payerId, doc.id, doc.url, doc.title, published, e.policyName.slice(0, 300), e.policyNumber, type, effective, e.summary, e.relevance, policyId);
        if (policyId) {
          const summary = `${TYPE_LABELS[type as ChangeType]} (from ${doc.title}): ${e.summary}`;
          if (!exists.get(policyId, doc.url, summary)) logChange.run(policyId, effective ?? published ?? today(), summary, doc.url);
        }
      }
      db.prepare("UPDATE import_docs SET status = 'done', entries = ?, publishedDate = ?, processedAt = datetime('now') WHERE id = ?").run(
        keep.length,
        published,
        doc.id
      );
      db.prepare("UPDATE import_jobs SET docsDone = docsDone + 1, entriesFound = entriesFound + ? WHERE id = ?").run(keep.length, doc.jobId);
    })();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't import the document.";
    db.prepare("UPDATE import_docs SET status = 'failed', error = ?, processedAt = datetime('now') WHERE id = ?").run(message, doc.id);
    db.prepare("UPDATE import_jobs SET docsFailed = docsFailed + 1 WHERE id = ?").run(doc.jobId);
    if (err instanceof AiError && isAccountError(message)) failJob(doc.jobId, message);
  }
  finishIfComplete(doc.jobId);
}

function finishIfComplete(jobId: number) {
  getDb()
    .prepare(
      `UPDATE import_jobs SET status = 'done', finishedAt = datetime('now')
       WHERE id = ? AND status IN ('queued','running')
         AND NOT EXISTS (SELECT 1 FROM import_docs d WHERE d.jobId = ? AND d.status = 'pending')`
    )
    .run(jobId, jobId);
}

export const TYPE_LABELS: Record<ChangeType, string> = {
  new: "New policy",
  revised: "Revised",
  retired: "Retired",
  reimbursement: "Reimbursement",
  prior_authorization: "Prior authorization",
  coverage: "Coverage",
  coding: "Coding",
  administrative: "Administrative",
  other: "Other",
};

// ---------------------------------------------------------------------------
// History entries
// ---------------------------------------------------------------------------
export interface HistoryFilter {
  payerId?: number;
  relevance?: "high" | "medium" | "all";
  search?: string;
  sinceDate?: string;
  limit?: number;
}

export function listHistory(f: HistoryFilter = {}): HistoryEntry[] {
  const where: string[] = [];
  const params: Record<string, unknown> = { limit: f.limit ?? 500 };
  if (f.payerId) {
    where.push("h.payerId = @payerId");
    params.payerId = f.payerId;
  }
  if (f.relevance === "high") where.push("h.relevance = 'high'");
  else if (f.relevance !== "all") where.push("h.relevance IN ('high','medium')");
  if (f.search) {
    where.push("(h.policyName LIKE @q OR h.summary LIKE @q OR h.policyNumber LIKE @q OR h.sourceTitle LIKE @q)");
    params.q = `%${f.search}%`;
  }
  if (f.sinceDate) {
    where.push("COALESCE(h.publishedDate, h.effectiveDate) >= @since");
    params.since = f.sinceDate;
  }
  return getDb()
    .prepare(
      `SELECT h.*, pay.name AS payerName, pol.title AS policyTitle
       FROM history_entries h
       JOIN payers pay ON pay.id = h.payerId
       LEFT JOIN policies pol ON pol.id = h.policyId
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY COALESCE(h.publishedDate, h.effectiveDate, '0000') DESC, h.relevance = 'high' DESC, h.id
       LIMIT @limit`
    )
    .all(params) as HistoryEntry[];
}

const CATEGORY_FOR: Record<ChangeType, PolicyCategory> = {
  new: "Medical Necessity",
  revised: "Medical Necessity",
  retired: "Coverage / Benefit",
  reimbursement: "Reimbursement",
  prior_authorization: "Prior Authorization",
  coverage: "Coverage / Benefit",
  coding: "Billing & Coding",
  administrative: "Billing & Coding",
  other: "Medical Necessity",
};

/** Start tracking the policy a history entry is about. Returns the new policy's id. */
export function trackHistoryEntry(entryId: number): number {
  const db = getDb();
  const e = db.prepare("SELECT * FROM history_entries WHERE id = ?").get(entryId) as
    | (Omit<HistoryEntry, "payerName" | "policyTitle"> & { importDocId: number | null })
    | undefined;
  if (!e) throw new ValidationError("History entry not found.");
  if (e.policyId) return e.policyId;
  return db.transaction(() => {
    const title = e.policyNumber && !e.policyName.includes(e.policyNumber) ? `${e.policyName} (${e.policyNumber})` : e.policyName;
    const policyId = Number(
      db
        .prepare(
          `INSERT INTO policies (payerId, title, category, impact, effectiveDate, nextReviewDate, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          e.payerId,
          title,
          CATEGORY_FOR[e.changeType] ?? "Medical Necessity",
          e.relevance === "high" ? "High" : "Medium",
          e.effectiveDate,
          addDays(today(), 30),
          `Added from ${e.sourceTitle}. Add the policy's own document link to watch it.`
        ).lastInsertRowid
    );
    // Link every imported entry about the same policy from this payer, and log them as history.
    const same = db
      .prepare(
        `SELECT * FROM history_entries WHERE payerId = ? AND policyId IS NULL
           AND (id = ? OR (policyNumber IS NOT NULL AND policyNumber = ?) OR lower(policyName) = lower(?))`
      )
      .all(e.payerId, e.id, e.policyNumber, e.policyName) as (typeof e)[];
    for (const s of same) {
      db.prepare("UPDATE history_entries SET policyId = ? WHERE id = ?").run(policyId, s.id);
      db.prepare("INSERT INTO policy_changes (policyId, changeDate, summary, sourceUrl) VALUES (?, ?, ?, ?)").run(
        policyId,
        s.effectiveDate ?? s.publishedDate ?? today(),
        `${TYPE_LABELS[s.changeType] ?? "Change"} (from ${s.sourceTitle}): ${s.summary}`,
        s.sourceUrl
      );
    }
    return policyId;
  })();
}

function validDate(v: string | null | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
