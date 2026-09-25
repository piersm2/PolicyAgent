import { getDb } from "./db";
import { ValidationError } from "./validate";
import type {
  Briefing,
  DashboardStats,
  Payer,
  Policy,
  PolicyChange,
  PolicyChangeWithContext,
  PolicyWithPayer,
} from "./types";

// ---------------------------------------------------------------------------
// Payers
// ---------------------------------------------------------------------------
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

export function createPayer(input: Omit<Payer, "id" | "createdAt">): Payer {
  const info = getDb()
    .prepare(
      `INSERT INTO payers (name, type, website, contact, notes)
       VALUES (@name, @type, @website, @contact, @notes)`
    )
    .run({
      name: input.name,
      type: input.type,
      website: input.website ?? null,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
    });
  return getPayer(Number(info.lastInsertRowid))!;
}

// PUT semantics: the input replaces every editable field.
export function updatePayer(id: number, input: Omit<Payer, "id" | "createdAt">): Payer | undefined {
  if (!getPayer(id)) return undefined;
  getDb()
    .prepare(
      `UPDATE payers SET name=@name, type=@type, website=@website, contact=@contact, notes=@notes WHERE id=@id`
    )
    .run({
      id,
      name: input.name,
      type: input.type,
      website: input.website ?? null,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
    });
  return getPayer(id);
}

export function deletePayer(id: number): boolean {
  return getDb().prepare("DELETE FROM payers WHERE id = ?").run(id).changes > 0;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
const POLICY_SELECT = `
  SELECT p.*, pay.name AS payerName, pay.type AS payerType
  FROM policies p
  JOIN payers pay ON pay.id = p.payerId
`;

export interface PolicyFilter {
  search?: string;
  payerId?: number;
  category?: string;
  status?: string;
  impact?: string;
}

export function listPolicies(filter: PolicyFilter = {}): PolicyWithPayer[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.search) {
    where.push("(p.title LIKE @search OR p.policyNumber LIKE @search OR p.summary LIKE @search)");
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
  if (filter.status) {
    where.push("p.status = @status");
    params.status = filter.status;
  }
  if (filter.impact) {
    where.push("p.impact = @impact");
    params.impact = filter.impact;
  }

  const sql =
    POLICY_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY
        CASE p.status WHEN 'Upcoming' THEN 0 WHEN 'Active' THEN 1 WHEN 'Draft' THEN 2 ELSE 3 END,
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
        (payerId, policyNumber, title, category, status, impact, effectiveDate, endDate, nextReviewDate, version, sourceUrl, summary)
       VALUES
        (@payerId, @policyNumber, @title, @category, @status, @impact, @effectiveDate, @endDate, @nextReviewDate, @version, @sourceUrl, @summary)`
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
        payerId=@payerId, policyNumber=@policyNumber, title=@title, category=@category,
        status=@status, impact=@impact, effectiveDate=@effectiveDate, endDate=@endDate,
        nextReviewDate=@nextReviewDate, version=@version, sourceUrl=@sourceUrl, summary=@summary,
        updatedAt=datetime('now')
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
    policyNumber: input.policyNumber ?? null,
    title: input.title,
    category: input.category,
    status: input.status,
    impact: input.impact,
    effectiveDate: input.effectiveDate || null,
    endDate: input.endDate || null,
    nextReviewDate: input.nextReviewDate || null,
    version: input.version ?? null,
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

export function recentChanges(limit = 15): PolicyChangeWithContext[] {
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

export function createChange(
  input: Omit<PolicyChange, "id" | "createdAt">
): PolicyChange {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO policy_changes (policyId, changeDate, changeType, version, summary, notedBy)
       VALUES (@policyId, @changeDate, @changeType, @version, @summary, @notedBy)`
    )
    .run({
      policyId: input.policyId,
      changeDate: input.changeDate,
      changeType: input.changeType,
      version: input.version ?? null,
      summary: input.summary,
      notedBy: input.notedBy ?? null,
    });
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

// ---------------------------------------------------------------------------
// Briefings (stored/logged AI or rule-based summaries)
// ---------------------------------------------------------------------------
function rowToBriefing(row: any): Briefing {
  return { ...row, policyIds: JSON.parse(row.policyIds || "[]") };
}

export function storeBriefing(input: Omit<Briefing, "id" | "generatedAt">): Briefing {
  const info = getDb()
    .prepare(
      `INSERT INTO briefings (source, model, summary, policyIds)
       VALUES (@source, @model, @summary, @policyIds)`
    )
    .run({
      source: input.source,
      model: input.model ?? null,
      summary: input.summary,
      policyIds: JSON.stringify(input.policyIds ?? []),
    });
  return getBriefing(Number(info.lastInsertRowid))!;
}

export function getBriefing(id: number): Briefing | undefined {
  const row = getDb().prepare("SELECT * FROM briefings WHERE id = ?").get(id);
  return row ? rowToBriefing(row) : undefined;
}

export function listBriefings(limit = 20): Briefing[] {
  return (
    getDb()
      .prepare("SELECT * FROM briefings ORDER BY id DESC LIMIT ?")
      .all(limit) as any[]
  ).map(rowToBriefing);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function dashboardStats(): DashboardStats {
  const db = getDb();
  const n = (sql: string, ...args: unknown[]) =>
    (db.prepare(sql).get(...args) as { n: number }).n;

  const totalPolicies = n("SELECT COUNT(*) AS n FROM policies");
  const activePolicies = n("SELECT COUNT(*) AS n FROM policies WHERE status = 'Active'");
  const upcomingPolicies = n("SELECT COUNT(*) AS n FROM policies WHERE status = 'Upcoming'");
  const highImpact = n(
    "SELECT COUNT(*) AS n FROM policies WHERE impact = 'High' AND status IN ('Active','Upcoming')"
  );
  const totalPayers = n("SELECT COUNT(*) AS n FROM payers");

  const upcomingEffective = db
    .prepare(
      POLICY_SELECT +
        ` WHERE p.effectiveDate IS NOT NULL
            AND date(p.effectiveDate) >= date('now')
            AND date(p.effectiveDate) <= date('now', '+90 day')
          ORDER BY date(p.effectiveDate) ASC`
    )
    .all() as PolicyWithPayer[];

  const reviewDue = db
    .prepare(
      POLICY_SELECT +
        ` WHERE p.nextReviewDate IS NOT NULL
            AND p.status IN ('Active','Upcoming')
            AND date(p.nextReviewDate) <= date('now', '+30 day')
          ORDER BY date(p.nextReviewDate) ASC`
    )
    .all() as PolicyWithPayer[];

  const byCategory = db
    .prepare(
      "SELECT category, COUNT(*) AS count FROM policies GROUP BY category ORDER BY count DESC"
    )
    .all() as { category: string; count: number }[];

  const byPayer = db
    .prepare(
      `SELECT pay.name AS payerName, COUNT(*) AS count
       FROM policies p JOIN payers pay ON pay.id = p.payerId
       GROUP BY pay.id ORDER BY count DESC`
    )
    .all() as { payerName: string; count: number }[];

  return {
    totalPolicies,
    activePolicies,
    upcomingPolicies,
    highImpact,
    totalPayers,
    upcomingEffective,
    reviewDue,
    recentChanges: recentChanges(8),
    byCategory,
    byPayer,
  };
}
