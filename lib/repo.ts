import { getDb } from "./db";
import { ValidationError } from "./validate";
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

export function listPayersWithCounts(): (Payer & { policyCount: number })[] {
  return getDb()
    .prepare(
      `SELECT pay.*, COUNT(p.id) AS policyCount
       FROM payers pay
       LEFT JOIN policies p ON p.payerId = pay.id
       GROUP BY pay.id
       ORDER BY pay.name COLLATE NOCASE`
    )
    .all() as (Payer & { policyCount: number })[];
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
const STATUS_SQL = `CASE WHEN p.effectiveDate IS NOT NULL AND date(p.effectiveDate) > date('now')
  THEN 'Upcoming' ELSE 'Active' END`;

const POLICY_SELECT = `
  SELECT p.id, p.payerId, p.title, p.category, p.impact, p.effectiveDate,
         p.nextReviewDate, p.sourceUrl, p.summary, p.createdAt, p.updatedAt,
         ${STATUS_SQL} AS status,
         pay.name AS payerName, pay.type AS payerType
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
  const params: Record<string, unknown> = {};

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
  return getDb().prepare(POLICY_SELECT + " WHERE p.id = ?").get(id) as PolicyWithPayer | undefined;
}

type PolicyInput = Omit<Policy, "id" | "createdAt" | "updatedAt">;

export function createPolicy(input: PolicyInput): PolicyWithPayer {
  assertPayerExists(input.payerId);
  const info = getDb()
    .prepare(
      `INSERT INTO policies
        (payerId, title, category, impact, effectiveDate, nextReviewDate, sourceUrl, summary)
       VALUES
        (@payerId, @title, @category, @impact, @effectiveDate, @nextReviewDate, @sourceUrl, @summary)`
    )
    .run(normalizePolicy(input));
  return getPolicy(Number(info.lastInsertRowid))!;
}

// PUT semantics: the input replaces every editable field.
export function updatePolicy(id: number, input: PolicyInput): PolicyWithPayer | undefined {
  if (!getPolicy(id)) return undefined;
  assertPayerExists(input.payerId);
  getDb()
    .prepare(
      `UPDATE policies SET
        payerId=@payerId, title=@title, category=@category, impact=@impact,
        effectiveDate=@effectiveDate, nextReviewDate=@nextReviewDate,
        sourceUrl=@sourceUrl, summary=@summary, updatedAt=datetime('now')
       WHERE id=@id`
    )
    .run({ id, ...normalizePolicy(input) });
  return getPolicy(id);
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
         WHERE policyId = c.policyId AND date(changeDate) <= date('now')
         ORDER BY changeDate DESC, id DESC LIMIT 1
       )`
    )
    .all() as PolicyChange[];
  return new Map(rows.map((c) => [c.policyId, c]));
}

export function countPayers(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM payers").get() as { n: number }).n;
}
