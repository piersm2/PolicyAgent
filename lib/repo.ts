import { getDb } from "./db";
import { ValidationError } from "./validate";
import { addMonths, today } from "./format";
import type {
  Payer,
  Policy,
  PolicyChange,
  PolicyChangeWithContext,
  PolicyWithPayer,
} from "./types";

// ---------------------------------------------------------------------------
// Payers
// ---------------------------------------------------------------------------
type PayerInput = Omit<Payer, "id" | "createdAt">;

export function listPayers(): Payer[] {
  return getDb().prepare("SELECT * FROM payers ORDER BY name COLLATE NOCASE").all() as Payer[];
}

export function getPayer(id: number): Payer | undefined {
  return getDb().prepare("SELECT * FROM payers WHERE id = ?").get(id) as Payer | undefined;
}

export function listPayersWithCounts(): (Payer & { policyCount: number; pageCount: number })[] {
  return getDb()
    .prepare(
      `SELECT pay.*, COUNT(p.id) AS policyCount,
         (SELECT COUNT(*) FROM watch_pages w WHERE w.payerId = pay.id AND w.policyId IS NULL) AS pageCount
       FROM payers pay
       LEFT JOIN policies p ON p.payerId = pay.id
       GROUP BY pay.id
       ORDER BY pay.name COLLATE NOCASE`
    )
    .all() as (Payer & { policyCount: number; pageCount: number })[];
}

export function createPayer(input: PayerInput): Payer {
  const info = getDb()
    .prepare("INSERT INTO payers (name, type, website) VALUES (@name, @type, @website)")
    .run({ name: input.name, type: input.type, website: input.website ?? null });
  return getPayer(Number(info.lastInsertRowid))!;
}

// PUT semantics: the input replaces every editable field.
export function updatePayer(id: number, input: PayerInput): Payer | undefined {
  if (!getPayer(id)) return undefined;
  getDb()
    .prepare("UPDATE payers SET name=@name, type=@type, website=@website WHERE id=@id")
    .run({ id, name: input.name, type: input.type, website: input.website ?? null });
  return getPayer(id);
}

export function deletePayer(id: number): boolean {
  return getDb().prepare("DELETE FROM payers WHERE id = ?").run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

// Status isn't stored: a future effective date means Upcoming, otherwise Active.
// @today is today's date in the app's time zone (not SQLite's UTC date('now')).
const STATUS_SQL = `CASE WHEN p.effectiveDate IS NOT NULL AND date(p.effectiveDate) > @today
  THEN 'Upcoming' ELSE 'Active' END`;

const POLICY_SELECT = `
  SELECT p.id, p.payerId, p.title, p.category, p.impact, p.effectiveDate,
         p.nextReviewDate, p.sourceUrl, p.summary, p.reviewEveryMonths, p.lastReviewedAt,
         p.owner, p.nextAction, p.actionDue, p.createdAt, p.updatedAt,
         ${STATUS_SQL} AS status,
         pay.name AS payerName, pay.type AS payerType,
         (SELECT w.id FROM watch_pages w WHERE w.policyId = p.id LIMIT 1) AS documentWatchId
  FROM policies p
  JOIN payers pay ON pay.id = p.payerId
`;

export interface PolicyFilter {
  search?: string;
  payerId?: number;
  category?: string;
}

export function listPolicies(filter: PolicyFilter = {}): PolicyWithPayer[] {
  const where: string[] = [];
  const params: Record<string, unknown> = { today: today() };

  if (filter.search) {
    where.push("(p.title LIKE @search OR p.summary LIKE @search)");
    params.search = `%${filter.search}%`;
  }
  if (filter.payerId) {
    where.push("p.payerId = @payerId");
    params.payerId = filter.payerId;
  }
  if (filter.category) {
    where.push("p.category = @category");
    params.category = filter.category;
  }

  const sql =
    POLICY_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY
        CASE ${STATUS_SQL} WHEN 'Upcoming' THEN 0 ELSE 1 END,
        CASE p.impact WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
        p.effectiveDate DESC`;

  return getDb().prepare(sql).all(params) as PolicyWithPayer[];
}

export function getPolicy(id: number): PolicyWithPayer | undefined {
  return getDb().prepare(POLICY_SELECT + " WHERE p.id = @id").get({ id, today: today() }) as
    | PolicyWithPayer
    | undefined;
}

export type PolicyInput = Omit<Policy, "id" | "createdAt" | "updatedAt" | "lastReviewedAt"> & {
  /** Watch the policy's own document (sourceUrl) for changes. */
  watchDocument: boolean;
};

const POLICY_FIELDS = `payerId, title, category, impact, effectiveDate, nextReviewDate, sourceUrl, summary,
  reviewEveryMonths, owner, nextAction, actionDue`;

export function createPolicy(input: PolicyInput): PolicyWithPayer {
  assertPayerExists(input.payerId);
  const db = getDb();
  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO policies (${POLICY_FIELDS})
         VALUES (@payerId, @title, @category, @impact, @effectiveDate, @nextReviewDate, @sourceUrl, @summary,
           @reviewEveryMonths, @owner, @nextAction, @actionDue)`
      )
      .run(normalizePolicy(input));
    const newId = Number(info.lastInsertRowid);
    syncDocumentWatch(newId, input);
    return newId;
  })();
  return getPolicy(id)!;
}

// PUT semantics: the input replaces every editable field.
export function updatePolicy(id: number, input: PolicyInput): PolicyWithPayer | undefined {
  if (!getPolicy(id)) return undefined;
  assertPayerExists(input.payerId);
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE policies SET
        payerId=@payerId, title=@title, category=@category, impact=@impact,
        effectiveDate=@effectiveDate, nextReviewDate=@nextReviewDate, sourceUrl=@sourceUrl,
        summary=@summary, reviewEveryMonths=@reviewEveryMonths, owner=@owner,
        nextAction=@nextAction, actionDue=@actionDue, updatedAt=datetime('now')
       WHERE id=@id`
    ).run({ id, ...normalizePolicy(input) });
    syncDocumentWatch(id, input);
  })();
  return getPolicy(id);
}

/**
 * Keep the policy's document watch in line with the form: one watch page per
 * policy, following sourceUrl. A changed URL starts a fresh baseline.
 */
function syncDocumentWatch(policyId: number, input: PolicyInput) {
  const db = getDb();
  const existing = db.prepare("SELECT id, url FROM watch_pages WHERE policyId = ?").get(policyId) as
    | { id: number; url: string }
    | undefined;
  const wanted = input.watchDocument && input.sourceUrl ? input.sourceUrl : null;
  const label = `Policy document: ${input.title}`;

  if (!wanted) {
    if (existing) db.prepare("DELETE FROM watch_pages WHERE id = ?").run(existing.id);
  } else if (!existing) {
    db.prepare("INSERT INTO watch_pages (payerId, policyId, url, label) VALUES (?, ?, ?, ?)").run(
      input.payerId,
      policyId,
      wanted,
      label
    );
  } else if (existing.url !== wanted) {
    db.prepare(
      `UPDATE watch_pages SET url = ?, label = ?, payerId = ?, snapshot = NULL, lastError = NULL,
         lastNote = NULL, lastCheckedAt = NULL, lastSuccessAt = NULL WHERE id = ?`
    ).run(wanted, label, input.payerId, existing.id);
  } else {
    db.prepare("UPDATE watch_pages SET label = ?, payerId = ? WHERE id = ?").run(label, input.payerId, existing.id);
  }
}

/** Record a review today and move the next review date forward by the policy's interval. */
export function markPolicyReviewed(id: number): PolicyWithPayer | undefined {
  const policy = getPolicy(id);
  if (!policy) return undefined;
  const reviewedOn = today();
  getDb()
    .prepare("UPDATE policies SET lastReviewedAt = ?, nextReviewDate = ?, updatedAt = datetime('now') WHERE id = ?")
    .run(reviewedOn, addMonths(reviewedOn, policy.reviewEveryMonths || 12), id);
  return getPolicy(id);
}

/** Clear the policy's next action (the owner stays). */
export function completePolicyAction(id: number): PolicyWithPayer | undefined {
  if (!getPolicy(id)) return undefined;
  getDb()
    .prepare("UPDATE policies SET nextAction = NULL, actionDue = NULL, updatedAt = datetime('now') WHERE id = ?")
    .run(id);
  return getPolicy(id);
}

/** Policies with an open next action, soonest due first (undated last). */
export function listActionItems(): PolicyWithPayer[] {
  return getDb()
    .prepare(
      POLICY_SELECT +
        ` WHERE p.nextAction IS NOT NULL
          ORDER BY p.actionDue IS NULL, p.actionDue, p.title`
    )
    .all({ today: today() }) as PolicyWithPayer[];
}

export function deletePolicy(id: number): boolean {
  return getDb().prepare("DELETE FROM policies WHERE id = ?").run(id).changes > 0;
}

function assertPayerExists(payerId: number) {
  if (!getPayer(payerId)) throw new ValidationError(`Payer ${payerId} does not exist.`);
}

function normalizePolicy(input: PolicyInput) {
  return {
    payerId: input.payerId,
    title: input.title,
    category: input.category,
    impact: input.impact,
    effectiveDate: input.effectiveDate || null,
    nextReviewDate: input.nextReviewDate || null,
    sourceUrl: input.sourceUrl ?? null,
    summary: input.summary ?? null,
    reviewEveryMonths: input.reviewEveryMonths,
    owner: input.owner ?? null,
    nextAction: input.nextAction ?? null,
    actionDue: input.nextAction ? input.actionDue || null : null,
  };
}

// ---------------------------------------------------------------------------
// Policy changes
// ---------------------------------------------------------------------------
export function listChangesForPolicy(policyId: number): PolicyChange[] {
  return getDb()
    .prepare("SELECT * FROM policy_changes WHERE policyId = ? ORDER BY changeDate DESC, id DESC")
    .all(policyId) as PolicyChange[];
}

export function recentChanges(limit: number): PolicyChangeWithContext[] {
  return getDb()
    .prepare(
      `SELECT c.*, p.title AS policyTitle, pay.name AS payerName
       FROM policy_changes c
       JOIN policies p ON p.id = c.policyId
       JOIN payers pay ON pay.id = p.payerId
       ORDER BY c.changeDate DESC, c.id DESC
       LIMIT ?`
    )
    .all(limit) as PolicyChangeWithContext[];
}

export function createChange(input: Omit<PolicyChange, "id" | "createdAt">): PolicyChange {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO policy_changes (policyId, changeDate, summary) VALUES (@policyId, @changeDate, @summary)")
    .run(input);
  // Touch the parent policy's updatedAt so lists reflect the activity.
  db.prepare("UPDATE policies SET updatedAt = datetime('now') WHERE id = ?").run(input.policyId);
  return db.prepare("SELECT * FROM policy_changes WHERE id = ?").get(Number(info.lastInsertRowid)) as PolicyChange;
}

/**
 * Each policy's most recent change dated today or earlier, keyed by policyId.
 * Future-dated (pre-announced) changes are skipped so they can't hide recent
 * activity. Used for ranking, which only needs one change per policy.
 */
export function latestPastChangeByPolicy(): Map<number, PolicyChange> {
  const rows = getDb()
    .prepare(
      `SELECT c.* FROM policy_changes c
       WHERE c.id = (
         SELECT id FROM policy_changes
         WHERE policyId = c.policyId AND date(changeDate) <= ?
         ORDER BY changeDate DESC, id DESC LIMIT 1
       )`
    )
    .all(today()) as PolicyChange[];
  return new Map(rows.map((c) => [c.policyId, c]));
}

export function countPayers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM payers").get() as { n: number }).n;
}
