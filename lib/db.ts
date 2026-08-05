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
      contact    TEXT,
      notes      TEXT,
      createdAt  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policies (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      payerId        INTEGER NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
      policyNumber   TEXT,
      title          TEXT NOT NULL,
      category       TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'Active',
      impact         TEXT NOT NULL DEFAULT 'Medium',
      effectiveDate  TEXT,
      endDate        TEXT,
      nextReviewDate TEXT,
      version        TEXT,
      sourceUrl      TEXT,
      summary        TEXT,
      createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS policy_changes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      policyId    INTEGER NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
      changeDate  TEXT NOT NULL,
      changeType  TEXT NOT NULL,
      version     TEXT,
      summary     TEXT NOT NULL,
      notedBy     TEXT,
      createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS briefings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      generatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      source      TEXT NOT NULL,             -- 'ai' | 'rule'
      model       TEXT,                      -- model id when source = 'ai'
      summary     TEXT NOT NULL,             -- generated narrative (markdown)
      policyIds   TEXT NOT NULL DEFAULT '[]' -- JSON array of the ranked policy ids
    );

    CREATE INDEX IF NOT EXISTS idx_policies_payer ON policies(payerId);
    CREATE INDEX IF NOT EXISTS idx_changes_policy ON policy_changes(policyId);
  `);
}

export function getDb(): Database.Database {
  if (global.__policyAgentDb) return global.__policyAgentDb;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  initSchema(db);

  // Seed on first run (empty payers table).
  const count = (db.prepare("SELECT COUNT(*) AS n FROM payers").get() as { n: number }).n;
  if (count === 0) seed(db);

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
    `INSERT INTO payers (name, type, website, contact, notes)
     VALUES (@name, @type, @website, @contact, @notes)`
  );
  const insertPolicy = db.prepare(
    `INSERT INTO policies
      (payerId, policyNumber, title, category, status, impact, effectiveDate, endDate, nextReviewDate, version, sourceUrl, summary)
     VALUES
      (@payerId, @policyNumber, @title, @category, @status, @impact, @effectiveDate, @endDate, @nextReviewDate, @version, @sourceUrl, @summary)`
  );
  const insertChange = db.prepare(
    `INSERT INTO policy_changes (policyId, changeDate, changeType, version, summary, notedBy)
     VALUES (@policyId, @changeDate, @changeType, @version, @summary, @notedBy)`
  );

  const tx = db.transaction(() => {
    const payers = [
      {
        name: "UnitedHealthcare",
        type: "Commercial",
        website: "https://www.uhcprovider.com/en/policies-protocols.html",
        contact: "Provider Services 877-842-3210",
        notes: "Reimbursement policies updated monthly; medical policies quarterly.",
      },
      {
        name: "Aetna",
        type: "Commercial",
        website: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html",
        contact: "Provider Services 888-632-3862",
        notes: "Clinical Policy Bulletins (CPBs) reviewed on a rolling basis.",
      },
      {
        name: "Cigna Healthcare",
        type: "Commercial",
        website: "https://static.cigna.com/coverage-policies",
        contact: "Provider Services 800-882-4462",
        notes: "Coverage policies posted with 90-day advance notice for material changes.",
      },
      {
        name: "Humana",
        type: "Medicare Advantage",
        website: "https://www.humana.com/provider/medical-resources/clinical/policies",
        contact: "Provider Services 800-457-4708",
        notes: "MA plan; follows CMS NCD/LCD plus internal medical coverage policies.",
      },
      {
        name: "Anthem Blue Cross Blue Shield",
        type: "Commercial",
        website: "https://www.anthem.com/provider/policies/clinical-guidelines",
        contact: "Provider Services 800-676-2583",
        notes: "AIM Specialty Health / Carelon manages many prior-auth programs.",
      },
      {
        name: "CMS — Medicare",
        type: "Medicare (Traditional)",
        website: "https://www.cms.gov/medicare-coverage-database",
        contact: "MAC: Novitas / Palmetto (region-dependent)",
        notes: "National (NCD) and Local (LCD) coverage determinations.",
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
          policyNumber: "2024R0123A",
          title: "Site of Service — Outpatient Surgical Procedures",
          category: "Reimbursement",
          status: "Upcoming",
          impact: "High",
          effectiveDate: shift(35),
          endDate: null,
          nextReviewDate: shift(200),
          version: "v4.0",
          sourceUrl: "https://www.uhcprovider.com/en/policies-protocols.html",
          summary:
            "Select outpatient surgical procedures will require an approved site-of-service review before they are covered in a hospital outpatient department (HOPD). Redirects lower-acuity cases to ASC settings.",
        },
        changes: [
          {
            changeDate: shift(-5),
            changeType: "Revised",
            version: "v4.0",
            summary:
              "Added 14 CPT codes to the site-of-service review list; effective date set 35 days out. HOPD claims without approval will deny CO-50.",
            notedBy: "Policy Desk",
          },
          {
            changeDate: shift(-190),
            changeType: "New",
            version: "v3.0",
            summary: "Initial site-of-service program launched for a limited musculoskeletal code set.",
            notedBy: "Policy Desk",
          },
        ],
      },
      {
        p: 0,
        policy: {
          policyNumber: "2023R7001B",
          title: "Modifier 25 — Significant, Separately Identifiable E/M",
          category: "Billing & Coding",
          status: "Active",
          impact: "Medium",
          effectiveDate: shift(-120),
          endDate: null,
          nextReviewDate: shift(20),
          version: "v2.1",
          sourceUrl: "https://www.uhcprovider.com/en/policies-protocols.html",
          summary:
            "Reduces reimbursement for E/M services billed with modifier 25 on the same day as a minor procedure unless documentation supports a separately identifiable service.",
        },
        changes: [
          {
            changeDate: shift(-120),
            changeType: "Revised",
            version: "v2.1",
            summary: "Reimbursement reduction increased from 25% to 50% for flagged claims.",
            notedBy: "Coding Compliance",
          },
        ],
      },
      {
        p: 1,
        policy: {
          policyNumber: "CPB-0140",
          title: "Continuous Glucose Monitoring (CGM) Devices",
          category: "Medical Necessity",
          status: "Active",
          impact: "Medium",
          effectiveDate: shift(-60),
          endDate: null,
          nextReviewDate: shift(120),
          version: "2025.2",
          sourceUrl: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html",
          summary:
            "Defines medical-necessity criteria for personal and professional CGM. Expanded eligibility to include certain Type 2 diabetes patients on basal insulin.",
        },
        changes: [
          {
            changeDate: shift(-60),
            changeType: "Revised",
            version: "2025.2",
            summary: "Broadened coverage to basal-insulin Type 2 patients; removed 4x/day testing precondition.",
            notedBy: "Utilization Mgmt",
          },
        ],
      },
      {
        p: 1,
        policy: {
          policyNumber: "CPB-0658",
          title: "Prior Authorization — Advanced Imaging (MRI/CT/PET)",
          category: "Prior Authorization",
          status: "Active",
          impact: "High",
          effectiveDate: shift(-240),
          endDate: null,
          nextReviewDate: shift(-8),
          version: "2025.1",
          sourceUrl: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html",
          summary:
            "Outpatient advanced imaging requires prior authorization through the radiology benefit manager. Retro-authorization window is 2 business days for emergent studies.",
        },
        changes: [
          {
            changeDate: shift(-30),
            changeType: "Revised",
            version: "2025.1",
            summary: "Retro-auth window shortened from 5 to 2 business days for emergent imaging.",
            notedBy: "Prior Auth Team",
          },
        ],
      },
      {
        p: 2,
        policy: {
          policyNumber: "CPG-0345",
          title: "Skilled Nursing Facility — Level of Care",
          category: "Coverage / Benefit",
          status: "Active",
          impact: "Medium",
          effectiveDate: shift(-400),
          endDate: null,
          nextReviewDate: shift(45),
          version: "v6",
          sourceUrl: "https://static.cigna.com/coverage-policies",
          summary:
            "Applies MCG criteria for SNF admission and continued-stay review. Concurrent review required every 3 days.",
        },
        changes: [
          {
            changeDate: shift(-14),
            changeType: "Revised",
            version: "v6",
            summary: "Adopted MCG 28th edition criteria for level-of-care determinations.",
            notedBy: "Case Management",
          },
        ],
      },
      {
        p: 2,
        policy: {
          policyNumber: "CPG-0912",
          title: "Telehealth — Coverage & Place of Service",
          category: "Coverage / Benefit",
          status: "Upcoming",
          impact: "High",
          effectiveDate: shift(70),
          endDate: null,
          nextReviewDate: shift(300),
          version: "v3",
          sourceUrl: "https://static.cigna.com/coverage-policies",
          summary:
            "Post-PHE telehealth coverage rules. Audio-only coverage narrowed; POS 10 required for home-based telehealth to receive non-facility rate.",
        },
        changes: [
          {
            changeDate: shift(-2),
            changeType: "Revised",
            version: "v3",
            summary:
              "Announced 90-day notice: audio-only limited to behavioral health after effective date; POS 02 vs 10 distinction enforced.",
            notedBy: "Policy Desk",
          },
        ],
      },
      {
        p: 3,
        policy: {
          policyNumber: "MCP-2044",
          title: "Inpatient Admission — Two-Midnight Alignment",
          category: "Medical Necessity",
          status: "Active",
          impact: "High",
          effectiveDate: shift(-90),
          endDate: null,
          nextReviewDate: shift(10),
          version: "2025",
          sourceUrl: "https://www.humana.com/provider/medical-resources/clinical/policies",
          summary:
            "Aligns MA inpatient decisions with the CMS two-midnight rule per the 2024 final rule. Observation vs inpatient status determinations follow CMS guidance.",
        },
        changes: [
          {
            changeDate: shift(-90),
            changeType: "Revised",
            version: "2025",
            summary: "Updated to reflect CMS 2024 MA final rule requiring two-midnight adherence.",
            notedBy: "UM Physician Advisor",
          },
        ],
      },
      {
        p: 4,
        policy: {
          policyNumber: "CG-SURG-97",
          title: "Prior Authorization — Spinal Fusion (Lumbar)",
          category: "Prior Authorization",
          status: "Active",
          impact: "High",
          effectiveDate: shift(-30),
          endDate: null,
          nextReviewDate: shift(160),
          version: "Carelon 2025",
          sourceUrl: "https://www.anthem.com/provider/policies/clinical-guidelines",
          summary:
            "Lumbar fusion requires prior authorization via Carelon. Adds documentation requirements for 6 months of conservative therapy.",
        },
        changes: [
          {
            changeDate: shift(-30),
            changeType: "Revised",
            version: "Carelon 2025",
            summary: "Conservative-care documentation extended from 3 to 6 months.",
            notedBy: "Prior Auth Team",
          },
        ],
      },
      {
        p: 4,
        policy: {
          policyNumber: "CG-LAB-22",
          title: "Genetic & Molecular Pathology Testing",
          category: "Medical Necessity",
          status: "Retired",
          impact: "Low",
          effectiveDate: shift(-800),
          endDate: shift(-40),
          nextReviewDate: null,
          version: "v9 (retired)",
          sourceUrl: "https://www.anthem.com/provider/policies/clinical-guidelines",
          summary:
            "Retired standalone molecular pathology policy; criteria folded into the consolidated lab management program.",
        },
        changes: [
          {
            changeDate: shift(-40),
            changeType: "Retired",
            version: "v9",
            summary: "Policy retired; superseded by consolidated Genetic Testing Program guidelines.",
            notedBy: "Policy Desk",
          },
        ],
      },
      {
        p: 5,
        policy: {
          policyNumber: "NCD 20.4",
          title: "Implantable Cardioverter Defibrillators (ICDs)",
          category: "Coverage / Benefit",
          status: "Active",
          impact: "Medium",
          effectiveDate: shift(-1000),
          endDate: null,
          nextReviewDate: shift(80),
          version: "NCD",
          sourceUrl: "https://www.cms.gov/medicare-coverage-database",
          summary:
            "National Coverage Determination for ICDs. Registry participation requirement and indications per NCD 20.4.",
        },
        changes: [
          {
            changeDate: shift(-365),
            changeType: "Revised",
            version: "NCD",
            summary: "Clarified shared decision-making documentation expectations.",
            notedBy: "MAC Bulletin",
          },
        ],
      },
      {
        p: 5,
        policy: {
          policyNumber: "LCD L34567",
          title: "Local Coverage — Wound Care & Debridement",
          category: "Billing & Coding",
          status: "Upcoming",
          impact: "Medium",
          effectiveDate: shift(21),
          endDate: null,
          nextReviewDate: shift(220),
          version: "R12",
          sourceUrl: "https://www.cms.gov/medicare-coverage-database",
          summary:
            "Local Coverage Determination revision tightening frequency limits and documentation for surgical debridement (CPT 11042-11047).",
        },
        changes: [
          {
            changeDate: shift(-3),
            changeType: "Revised",
            version: "R12",
            summary: "MAC posted revision R12 with 21-day notice; adds wound-measurement documentation requirement.",
            notedBy: "MAC Bulletin",
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
