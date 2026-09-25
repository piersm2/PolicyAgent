import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Single shared connection. Next.js dev reloads modules, so cache on globalThis.
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "policyagent.db");

declare global {
  // eslint-disable-next-line no-var
  var __policyAgentDb: Database.Database | undefined;
}

function initSchema(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS payers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL,
      website    TEXT,
      createdAt  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policies (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      payerId        INTEGER NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      category       TEXT NOT NULL,
      impact         TEXT NOT NULL DEFAULT 'Medium',
      effectiveDate  TEXT,
      nextReviewDate TEXT,
      sourceUrl      TEXT,
      summary        TEXT,
      createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policy_changes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      policyId    INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
      changeDate  TEXT NOT NULL,
      summary     TEXT NOT NULL,
      createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_policies_payer ON policies(payerId);
    CREATE INDEX IF NOT EXISTS idx_changes_policy ON policy_changes(policyId);
  `);
}

const SCHEMA_VERSION = 2;

// Fields removed when the app was simplified. Databases created by earlier
// versions still have these columns; drop them so the current inserts work
// (e.g. policy_changes.changeType was NOT NULL with no default).
const LEGACY_COLUMNS: Record<string, string[]> = {
  payers: ["contact", "notes"],
  policies: ["policyNumber", "status", "endDate", "version"],
  policy_changes: ["changeType", "version", "notedBy"],
};

function dropLegacyColumns(db: Database.Database) {
  db.transaction(() => {
    for (const [table, columns] of Object.entries(LEGACY_COLUMNS)) {
      const existing = new Set(
        (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
      );
      for (const col of columns) {
        if (existing.has(col)) db.exec(`ALTER TABLE ${table} DROP COLUMN ${col}`);
      }
    }
    db.exec("DROP TABLE IF EXISTS briefings");
  })();
}

export function getDb(): Database.Database {
  if (global.__policyAgentDb) return global.__policyAgentDb;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  initSchema(db);

  // user_version: 0 = brand-new file, 1 = earlier app version, 2 = current.
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < SCHEMA_VERSION) {
    dropLegacyColumns(db);
    // Seed only a brand-new database, so a user who deletes every payer
    // doesn't get the demo data back.
    const count = (db.prepare("SELECT COUNT(*) AS n FROM payers").get() as { n: number }).n;
    if (version === 0 && count === 0) seed(db);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  global.__policyAgentDb = db;
  return db;
}

// ---------------------------------------------------------------------------
// Seed data — realistic payers and policies for a hospital/provider RCM team.
// ---------------------------------------------------------------------------
function seed(db: Database.Database) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return iso(d);
  };

  const insertPayer = db.prepare(
    `INSERT INTO payers (name, type, website) VALUES (@name, @type, @website)`
  );
  const insertPolicy = db.prepare(
    `INSERT INTO policies
      (payerId, title, category, impact, effectiveDate, nextReviewDate, sourceUrl, summary)
     VALUES
      (@payerId, @title, @category, @impact, @effectiveDate, @nextReviewDate, @sourceUrl, @summary)`
  );
  const insertChange = db.prepare(
    `INSERT INTO policy_changes (policyId, changeDate, summary) VALUES (@policyId, @changeDate, @summary)`
  );

  const tx = db.transaction(() => {
    const payers = [
      {
        name: "UnitedHealthcare",
        type: "Commercial",
        website: "https://www.uhcprovider.com/en/policies-protocols.html",
      },
      {
        name: "Aetna",
        type: "Commercial",
        website: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html",
      },
      {
        name: "Cigna Healthcare",
        type: "Commercial",
        website: "https://static.cigna.com/coverage-policies",
      },
      {
        name: "Humana",
        type: "Medicare Advantage",
        website: "https://www.humana.com/provider/medical-resources/clinical/policies",
      },
      {
        name: "Anthem Blue Cross Blue Shield",
        type: "Commercial",
        website: "https://www.anthem.com/provider/policies/clinical-guidelines",
      },
      {
        name: "CMS — Medicare",
        type: "Medicare (Traditional)",
        website: "https://www.cms.gov/medicare-coverage-database",
      },
    ];

    const payerIds = payers.map((p) => Number(insertPayer.run(p).lastInsertRowid));

    // [payerIndex, policy fields, changes[]]
    const policies: Array<{
      p: number;
      policy: Record<string, unknown>;
      changes: Array<Record<string, unknown>>;
    }> = [
      {
        p: 0,
        policy: {
          title: "Site of Service — Outpatient Surgical Procedures",
          category: "Reimbursement",
          impact: "High",
          effectiveDate: shift(35),
          nextReviewDate: shift(200),
          sourceUrl: "https://www.uhcprovider.com/en/policies-protocols.html",
          summary:
            "Select outpatient surgical procedures will require an approved site-of-service review before they are covered in a hospital outpatient department (HOPD). Redirects lower-acuity cases to ASC settings.",
        },
        changes: [
          {
            changeDate: shift(-5),
            summary:
              "Added 14 CPT codes to the site-of-service review list; effective date set 35 days out. HOPD claims without approval will deny CO-50.",
          },
          {
            changeDate: shift(-190),
            summary: "Initial site-of-service program launched for a limited musculoskeletal code set.",
          },
        ],
      },
      {
        p: 0,
        policy: {
          title: "Modifier 25 — Significant, Separately Identifiable E/M",
          category: "Billing & Coding",
          impact: "Medium",
          effectiveDate: shift(-120),
          nextReviewDate: shift(20),
          sourceUrl: "https://www.uhcprovider.com/en/policies-protocols.html",
          summary:
            "Reduces reimbursement for E/M services billed with modifier 25 on the same day as a minor procedure unless documentation supports a separately identifiable service.",
        },
        changes: [
          {
            changeDate: shift(-120),
            summary: "Reimbursement reduction increased from 25% to 50% for flagged claims.",
          },
        ],
      },
      {
        p: 1,
        policy: {
          title: "Continuous Glucose Monitoring (CGM) Devices",
          category: "Medical Necessity",
          impact: "Medium",
          effectiveDate: shift(-60),
          nextReviewDate: shift(120),
          sourceUrl: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html",
          summary:
            "Defines medical-necessity criteria for personal and professional CGM. Expanded eligibility to include certain Type 2 diabetes patients on basal insulin.",
        },
        changes: [
          {
            changeDate: shift(-60),
            summary: "Broadened coverage to basal-insulin Type 2 patients; removed 4x/day testing precondition.",
          },
        ],
      },
      {
        p: 1,
        policy: {
          title: "Prior Authorization — Advanced Imaging (MRI/CT/PET)",
          category: "Prior Authorization",
          impact: "High",
          effectiveDate: shift(-240),
          nextReviewDate: shift(-8),
          sourceUrl: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html",
          summary:
            "Outpatient advanced imaging requires prior authorization through the radiology benefit manager. Retro-authorization window is 2 business days for emergent studies.",
        },
        changes: [
          {
            changeDate: shift(-30),
            summary: "Retro-auth window shortened from 5 to 2 business days for emergent imaging.",
          },
        ],
      },
      {
        p: 2,
        policy: {
          title: "Skilled Nursing Facility — Level of Care",
          category: "Coverage / Benefit",
          impact: "Medium",
          effectiveDate: shift(-400),
          nextReviewDate: shift(45),
          sourceUrl: "https://static.cigna.com/coverage-policies",
          summary:
            "Applies MCG criteria for SNF admission and continued-stay review. Concurrent review required every 3 days.",
        },
        changes: [
          {
            changeDate: shift(-14),
            summary: "Adopted MCG 28th edition criteria for level-of-care determinations.",
          },
        ],
      },
      {
        p: 2,
        policy: {
          title: "Telehealth — Coverage & Place of Service",
          category: "Coverage / Benefit",
          impact: "High",
          effectiveDate: shift(70),
          nextReviewDate: shift(300),
          sourceUrl: "https://static.cigna.com/coverage-policies",
          summary:
            "Post-PHE telehealth coverage rules. Audio-only coverage narrowed; POS 10 required for home-based telehealth to receive non-facility rate.",
        },
        changes: [
          {
            changeDate: shift(-2),
            summary:
              "Announced 90-day notice: audio-only limited to behavioral health after effective date; POS 02 vs 10 distinction enforced.",
          },
        ],
      },
      {
        p: 3,
        policy: {
          title: "Inpatient Admission — Two-Midnight Alignment",
          category: "Medical Necessity",
          impact: "High",
          effectiveDate: shift(-90),
          nextReviewDate: shift(10),
          sourceUrl: "https://www.humana.com/provider/medical-resources/clinical/policies",
          summary:
            "Aligns MA inpatient decisions with the CMS two-midnight rule per the 2024 final rule. Observation vs inpatient status determinations follow CMS guidance.",
        },
        changes: [
          {
            changeDate: shift(-90),
            summary: "Updated to reflect CMS 2024 MA final rule requiring two-midnight adherence.",
          },
        ],
      },
      {
        p: 4,
        policy: {
          title: "Prior Authorization — Spinal Fusion (Lumbar)",
          category: "Prior Authorization",
          impact: "High",
          effectiveDate: shift(-30),
          nextReviewDate: shift(160),
          sourceUrl: "https://www.anthem.com/provider/policies/clinical-guidelines",
          summary:
            "Lumbar fusion requires prior authorization via Carelon. Adds documentation requirements for 6 months of conservative therapy.",
        },
        changes: [
          {
            changeDate: shift(-30),
            summary: "Conservative-care documentation extended from 3 to 6 months.",
          },
        ],
      },
      {
        p: 5,
        policy: {
          title: "Implantable Cardioverter Defibrillators (ICDs)",
          category: "Coverage / Benefit",
          impact: "Medium",
          effectiveDate: shift(-1000),
          nextReviewDate: shift(80),
          sourceUrl: "https://www.cms.gov/medicare-coverage-database",
          summary:
            "National Coverage Determination for ICDs. Registry participation requirement and indications per NCD 20.4.",
        },
        changes: [
          {
            changeDate: shift(-365),
            summary: "Clarified shared decision-making documentation expectations.",
          },
        ],
      },
      {
        p: 5,
        policy: {
          title: "Local Coverage — Wound Care & Debridement",
          category: "Billing & Coding",
          impact: "Medium",
          effectiveDate: shift(21),
          nextReviewDate: shift(220),
          sourceUrl: "https://www.cms.gov/medicare-coverage-database",
          summary:
            "Local Coverage Determination revision tightening frequency limits and documentation for surgical debridement (CPT 11042-11047).",
        },
        changes: [
          {
            changeDate: shift(-3),
            summary: "MAC posted revision R12 with 21-day notice; adds wound-measurement documentation requirement.",
          },
        ],
      },
    ];

    for (const entry of policies) {
      const policyId = Number(
        insertPolicy.run({ payerId: payerIds[entry.p], ...entry.policy }).lastInsertRowid
      );
      for (const c of entry.changes) {
        insertChange.run({ policyId, ...c });
      }
    }
  });

  tx();
}
