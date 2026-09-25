// Check watched pages that are due, for schedulers outside the app (the
// "Scheduled payer check" GitHub Action, or cron on an always-on machine).
//
//   npm run check-due
//
// If the app is running, the check goes through it so it joins the app's
// queue; otherwise the pages are checked directly against the database.

import { checkPages, type CheckResult } from "../lib/watch";

const port = process.env.PORT || "3000";

async function viaServer(): Promise<CheckResult[] | null> {
  try {
    const res = await fetch(`http://localhost:${port}/api/watch/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ due: true }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return (await res.json()) as CheckResult[];
  } catch (err) {
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (code === "ECONNREFUSED" || code === "ECONNRESET") return null; // app not running
    throw err;
  }
}

async function main() {
  let results = await viaServer();
  const where = results ? "through the running app" : "directly (app not running)";
  if (!results) results = await checkPages("due");

  const count = (o: string) => results!.filter((r) => r.outcome === o).length;
  console.log(
    `Checked ${results.length} due page(s) ${where}: ${count("changed")} changed, ` +
      `${count("baseline")} baseline, ${count("unchanged")} unchanged, ${count("error")} failed.`
  );
  for (const r of results) if (r.outcome === "error") console.log(`  page ${r.pageId}: ${r.error}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
