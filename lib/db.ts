import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { addDays, today } from "./format";
import { CATALOG, SAMPLE_POLICIES, catalogPage } from "./catalog";
import { installCatalog } from "./catalog-install";

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
      sourceUrl      TEXT,           -- the policy's own document
      summary        TEXT,
      reviewEveryMonths INTEGER NOT NULL DEFAULT 12,
      lastReviewedAt TEXT,           -- date
      owner          TEXT,
      nextAction     TEXT,
      actionDue      TEXT,           -- date
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

    -- Payer web pages the app checks for changes, with the last snapshot taken.
    CREATE TABLE IF NOT EXISTS watch_pages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      payerId       INTEGER NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
      policyId      INTEGER REFERENCES policies(id) ON DELETE CASCADE, -- set when watching one policy's document
      url           TEXT NOT NULL,
      label         TEXT NOT NULL,
      lastCheckedAt TEXT,
      lastSuccessAt TEXT,
      lastError     TEXT,
      lastNote      TEXT,
      snapshot      TEXT,            -- JSON Snapshot from lib/extract.ts
      createdAt     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Differences found between two checks of a watched page.
    CREATE TABLE IF NOT EXISTS page_changes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      pageId       INTEGER NOT NULL REFERENCES watch_pages(id) ON DELETE CASCADE,
      detectedAt   TEXT NOT NULL DEFAULT (datetime('now')),
      newLinks     TEXT NOT NULL DEFAULT '[]',  -- JSON PageLink[]
      removedLinks TEXT NOT NULL DEFAULT '[]',
      addedText    TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
      removedText  TEXT NOT NULL DEFAULT '[]',
      fileChanged  INTEGER NOT NULL DEFAULT 0,  -- non-HTML document changed
      reviewedAt   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_watch_payer ON watch_pages(payerId);
    CREATE INDEX IF NOT EXISTS idx_page_changes_page ON page_changes(pageId);
  `);
}

const SCHEMA_VERSION = 3;

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

// Columns added after the first release, created in place on older databases
// (CREATE TABLE IF NOT EXISTS never alters an existing table).
const ADDED_COLUMNS: Record<string, [name: string, definition: string][]> = {
  policies: [
    ["reviewEveryMonths", "INTEGER NOT NULL DEFAULT 12"],
    ["lastReviewedAt", "TEXT"],
    ["owner", "TEXT"],
    ["nextAction", "TEXT"],
    ["actionDue", "TEXT"],
  ],
  watch_pages: [["policyId", "INTEGER REFERENCES policies(id) ON DELETE CASCADE"]],
};

function addNewColumns(db: Database.Database) {
  db.transaction(() => {
    for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
      const existing = new Set(
        (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
      );
      for (const [name, definition] of columns) {
        if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      }
    }
  })();
}

// Sample URLs from earlier versions that are dead (404) or only show
// JavaScript-loaded content, mapped to verified catalog pages. Watch pages,
// payer websites and policy links still pointing at them are repointed;
// anything the user changed is left alone.
const SAMPLE_URL_FIXES: { old: string; key: string; page: number }[] = [
  { old: "https://www.uhcprovider.com/en/policies-protocols.html", key: "uhc-commercial", page: 0 },
  { old: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html", key: "aetna", page: 0 },
  { old: "https://static.cigna.com/coverage-policies", key: "cigna", page: 0 },
  { old: "https://www.humana.com/provider/medical-resources/clinical/policies", key: "humana-ma", page: 0 },
  { old: "https://www.anthem.com/provider/policies/clinical-guidelines", key: "anthem-mo", page: 0 },
  { old: "https://www.cms.gov/medicare-coverage-database", key: "cms-medicare", page: 0 },
];

function fixSampleUrls(db: Database.Database) {
  const updateWatch = db.prepare(
    `UPDATE watch_pages SET url = @url, label = @label, snapshot = NULL, lastError = NULL, lastNote = NULL,
       lastCheckedAt = NULL, lastSuccessAt = NULL
     WHERE url = @old AND policyId IS NULL`
  );
  const updateWebsite = db.prepare("UPDATE payers SET website = @website WHERE website = @old");
  const updatePolicy = db.prepare("UPDATE policies SET sourceUrl = @url WHERE sourceUrl = @old");
  db.transaction(() => {
    for (const fix of SAMPLE_URL_FIXES) {
      const { url, label } = catalogPage(fix.key, fix.page);
      const website = CATALOG.find((c) => c.key === fix.key)!.website;
      const params = { old: fix.old, url, label, website };
      updateWatch.run(params);
      updateWebsite.run(params);
      updatePolicy.run(params);
    }
  })();
}

export function getDb(): Database.Database {
  if (global.__policyAgentDb) return global.__policyAgentDb;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  initSchema(db);

  // user_version: 0 = brand-new file, 1-2 = earlier app versions, 3 = current.
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < SCHEMA_VERSION) {
    dropLegacyColumns(db);
    addNewColumns(db);
    if (version > 0) fixSampleUrls(db);
    // Seed only a brand-new database, so a user who deletes every payer
    // doesn't get the demo data back.
    const count = (db.prepare("SELECT COUNT(*) AS n FROM payers").get() as { n: number }).n;
    if (version === 0 && count === 0) seed(db);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_watch_policy ON watch_pages(policyId)");

  global.__policyAgentDb = db;
  return db;
}

// ---------------------------------------------------------------------------
// Seed data — the Missouri payer catalog plus a few real policies, each
// watching its own document. No change history is invented: it builds up as
// the watcher and the team record changes.
// ---------------------------------------------------------------------------
function seed(db: Database.Database) {
  const start = today();
  installCatalog(db, CATALOG.map((c) => c.key));

  const payerId = db.prepare("SELECT id FROM payers WHERE name = ?");
  const insertPolicy = db.prepare(
    `INSERT INTO policies
      (payerId, title, category, impact, nextReviewDate, sourceUrl, summary, owner, nextAction, actionDue)
     VALUES
      (@payerId, @title, @category, @impact, @nextReviewDate, @sourceUrl, @summary, @owner, @nextAction, @actionDue)`
  );
  const insertWatch = db.prepare("INSERT INTO watch_pages (payerId, policyId, url, label) VALUES (?, ?, ?, ?)");

  db.transaction(() => {
    for (const sample of SAMPLE_POLICIES) {
      const payer = CATALOG.find((c) => c.key === sample.payer)!;
      const id = (payerId.get(payer.name) as { id: number }).id;
      const extra = sample as { owner?: string; nextAction?: string; actionInDays?: number };
      const policyId = Number(
        insertPolicy.run({
          payerId: id,
          title: sample.title,
          category: sample.category,
          impact: sample.impact,
          nextReviewDate: addDays(start, sample.reviewInDays),
          sourceUrl: sample.sourceUrl,
          summary: sample.summary,
          owner: extra.owner ?? null,
          nextAction: extra.nextAction ?? null,
          actionDue: extra.actionInDays === undefined ? null : addDays(start, extra.actionInDays),
        }).lastInsertRowid
      );
      insertWatch.run(id, policyId, sample.sourceUrl, `Policy document: ${sample.title}`);
    }
  })();
}
