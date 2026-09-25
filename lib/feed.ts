import { getBoard } from "./board";
import { listPolicies } from "./repo";
import { checkEveryHours, listPageChanges, listWatchPages } from "./watch";

// The compiled feed Cowork (or any tool) reads: website changes waiting for
// review, the ranked "needs attention" list, recent logged changes, watch-list
// health, and every policy. Served at GET /api/feed (JSON, or ?format=md).

export function compileFeed(origin: string) {
  const board = getBoard();
  const watchList = listWatchPages();
  const toReview = listPageChanges({ unreviewedOnly: true, limit: 50 });

  return {
    generatedAt: new Date().toISOString(),
    checkEveryHours: checkEveryHours(),
    counts: {
      ...board.counts,
      websiteChangesToReview: toReview.length,
      watchedPages: watchList.length,
      watchedPagesWithErrors: watchList.filter((p) => p.lastError).length,
    },
    websiteChangesToReview: toReview.map((c) => ({
      ...c,
      markReviewed: `POST ${origin}/api/website-changes/${c.id}/review`,
    })),
    needsAttention: board.needsAttention.map((p) => ({ ...p, url: `${origin}/policies/${p.id}` })),
    recentChanges: board.recentChanges,
    watchList: watchList.map((p) => ({
      id: p.id,
      payer: p.payerName,
      label: p.label,
      url: p.url,
      lastCheckedAt: p.lastCheckedAt,
      lastSuccessAt: p.lastSuccessAt,
      error: p.lastError,
      note: p.lastNote,
      unreviewedChanges: p.unreviewedChanges,
    })),
    policies: listPolicies().map((p) => ({
      id: p.id,
      payer: p.payerName,
      title: p.title,
      category: p.category,
      impact: p.impact,
      status: p.status,
      effectiveDate: p.effectiveDate,
      reviewDate: p.nextReviewDate,
      link: p.sourceUrl,
      notes: p.summary,
      url: `${origin}/policies/${p.id}`,
    })),
  };
}

export type Feed = ReturnType<typeof compileFeed>;

const MD_LIST_LIMIT = 15;

/** The same feed as readable Markdown, for reading in a browser or pasting into a prompt. */
export function feedToMarkdown(feed: Feed, origin: string): string {
  const out: string[] = [];
  const c = feed.counts;
  out.push(`# PolicyAgent feed`);
  out.push(`Generated ${feed.generatedAt} (UTC). Payer pages are checked every ${feed.checkEveryHours} hours while the app runs.`);
  out.push(
    `${c.policies} policies · ${c.upcoming} upcoming · ${c.highImpact} high impact · ${c.payers} payers · ` +
      `${c.watchedPages} watched pages (${c.watchedPagesWithErrors} with errors) · ` +
      `**${c.websiteChangesToReview} website change(s) to review**`
  );

  out.push(`\n## Website changes to review (${feed.websiteChangesToReview.length})`);
  if (!feed.websiteChangesToReview.length) out.push("None.");
  for (const ch of feed.websiteChangesToReview) {
    out.push(`\n### ${ch.payerName} — ${ch.pageLabel} (change #${ch.id}, detected ${ch.detectedAt} UTC)`);
    out.push(`Page: ${ch.pageUrl}`);
    if (ch.fileChanged) out.push(`- The document at this address changed.`);
    list(out, "New links / documents", ch.newLinks.map((l) => `${l.text} — ${l.url}`));
    list(out, "Removed links / documents", ch.removedLinks.map((l) => `${l.text} — ${l.url}`));
    list(out, "Text added", ch.addedText);
    list(out, "Text removed", ch.removedText);
  }

  out.push(`\n## Needs attention (ranked)`);
  if (!feed.needsAttention.length) out.push("No policies yet.");
  feed.needsAttention.forEach((p, i) => {
    out.push(`${i + 1}. **${p.payerName} — ${p.title}** (${p.category}, ${p.impact} impact, ${p.status}): ${p.reasons.join("; ")}. ${p.url}`);
  });

  out.push(`\n## Recent logged changes`);
  if (!feed.recentChanges.length) out.push("None.");
  for (const r of feed.recentChanges) out.push(`- ${r.changeDate} · ${r.payerName} — ${r.policyTitle}: ${r.summary}`);

  out.push(`\n## Watch list`);
  if (!feed.watchList.length) out.push("No pages are being watched.");
  for (const w of feed.watchList) {
    const status = w.error
      ? `ERROR: ${w.error}`
      : w.lastSuccessAt
        ? `OK, last checked ${w.lastCheckedAt} UTC${w.note ? ` (note: ${w.note})` : ""}`
        : "not checked yet";
    out.push(`- ${w.payer} — ${w.label}: ${w.url} — ${status}`);
  }

  out.push(`\n## All policies (${feed.policies.length})`);
  for (const p of feed.policies) {
    out.push(
      `- **${p.payer} — ${p.title}** | ${p.category} | ${p.impact} impact | ${p.status}` +
        ` | effective ${p.effectiveDate ?? "—"} | review ${p.reviewDate ?? "—"}` +
        (p.link ? ` | ${p.link}` : "") +
        (p.notes ? `\n  ${p.notes}` : "")
    );
  }

  out.push(`\n## Using this feed`);
  out.push(`- JSON version: ${origin}/api/feed`);
  out.push(`- After reviewing a website change, mark it reviewed: POST ${origin}/api/website-changes/<id>/review`);
  out.push(`- Log a change on a policy: POST ${origin}/api/policies/<id>/changes with {"changeDate":"YYYY-MM-DD","summary":"..."}`);
  out.push(`- Add a policy: POST ${origin}/api/policies (see README for fields)`);
  out.push(`- Check watched pages now: POST ${origin}/api/watch/check`);

  return out.join("\n") + "\n";
}

function list(out: string[], title: string, items: string[]) {
  if (!items.length) return;
  out.push(`- ${title} (${items.length}):`);
  for (const item of items.slice(0, MD_LIST_LIMIT)) out.push(`  - ${item}`);
  if (items.length > MD_LIST_LIMIT) out.push(`  - …and ${items.length - MD_LIST_LIMIT} more (see JSON feed)`);
}
