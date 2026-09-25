// Check payer policy URLs the way the watcher sees them.
// Usage: npx tsx scripts/check-links.ts [file.json]
// The file holds [{ "url": "...", "label": "...", "explore": true }]; with no file,
// every URL in the payer catalog (lib/catalog.ts) is checked.
import { readFileSync } from "node:fs";
import { fetchSnapshot } from "../lib/extract";

type Entry = { url: string; label?: string; explore?: boolean; match?: string };

const POLICY_WORDS = /polic|bulletin|update|guideline|coverage|reimburs|payment|manual|news|\.pdf/i;

async function loadEntries(): Promise<Entry[]> {
  const file = process.argv[2];
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  const { catalogUrls } = await import("../lib/catalog");
  return catalogUrls();
}

async function main() {
  const entries = await loadEntries();
  let failures = 0;
  for (const e of entries) {
    console.log(`\n== ${e.label ?? e.url}\n   ${e.url}`);
    try {
      const snap = await fetchSnapshot(e.url);
      const redirected = snap.finalUrl !== e.url ? ` -> ${snap.finalUrl}` : "";
      console.log(`   OK ${snap.kind}${redirected} | ${snap.lines.length} text lines, ${snap.links.length} links`);
      if (snap.note) console.log(`   NOTE: ${snap.note}`);
      for (const line of snap.lines.slice(0, e.explore ? 12 : 4)) console.log(`   | ${line.slice(0, 140)}`);
      const pattern = e.match ? new RegExp(e.match, "i") : POLICY_WORDS;
      const links = snap.links.filter((l) => pattern.test(l.url) || pattern.test(l.text));
      for (const l of links.slice(0, e.explore ? 60 : 8)) console.log(`   > ${l.text.slice(0, 70)} — ${l.url}`);
      if (links.length > (e.explore ? 60 : 8)) console.log(`   > …${links.length} policy-related links total`);
    } catch (err) {
      failures++;
      console.log(`   FAIL ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\n${entries.length - failures}/${entries.length} URLs loaded.`);
  if (process.argv.includes("--strict") && failures) process.exit(1);
}

main();
