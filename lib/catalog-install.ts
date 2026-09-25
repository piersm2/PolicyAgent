import type Database from "better-sqlite3";
import { CATALOG } from "./catalog";

// Adds catalog payers and their policy pages to a database. Takes the
// connection as an argument so db.ts can use it for the seed without a cycle.

export interface InstallResult {
  payersAdded: number;
  pagesAdded: number;
}

/** Watch each page for the payer, skipping URLs it already watches. Returns how many were added. */
export function addPayerPages(
  db: Database.Database,
  payerId: number,
  pages: { url: string; label: string }[]
): number {
  const exists = db.prepare("SELECT 1 FROM watch_pages WHERE payerId = ? AND url = ? AND policyId IS NULL");
  const insert = db.prepare("INSERT INTO watch_pages (payerId, url, label) VALUES (?, ?, ?)");
  let added = 0;
  for (const page of pages) {
    if (exists.get(payerId, page.url)) continue;
    insert.run(payerId, page.url, page.label);
    added++;
  }
  return added;
}

/**
 * Add the catalog payers with these keys. A payer that already exists (same
 * name) is reused, so running this twice only fills in missing pages.
 */
export function installCatalog(db: Database.Database, keys: string[]): InstallResult {
  const result: InstallResult = { payersAdded: 0, pagesAdded: 0 };
  const findPayer = db.prepare("SELECT id FROM payers WHERE name = ? COLLATE NOCASE");
  const insertPayer = db.prepare("INSERT INTO payers (name, type, website) VALUES (?, ?, ?)");

  db.transaction(() => {
    for (const entry of CATALOG.filter((c) => keys.includes(c.key))) {
      let payerId = (findPayer.get(entry.name) as { id: number } | undefined)?.id;
      if (payerId === undefined) {
        payerId = Number(insertPayer.run(entry.name, entry.type, entry.website).lastInsertRowid);
        result.payersAdded++;
      }
      result.pagesAdded += addPayerPages(db, payerId, entry.pages);
    }
  })();
  return result;
}

/** Catalog keys whose payer (by name) is already in the database. */
export function installedCatalogKeys(db: Database.Database): Set<string> {
  const names = new Set(
    (db.prepare("SELECT name FROM payers").all() as { name: string }[]).map((p) => p.name.toLowerCase())
  );
  return new Set(CATALOG.filter((c) => names.has(c.name.toLowerCase())).map((c) => c.key));
}
