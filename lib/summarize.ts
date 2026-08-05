import Anthropic from "@anthropic-ai/sdk";
import type { Briefing } from "./types";
import { changesByPolicy, listPolicies, storeBriefing } from "./repo";
import { rankPolicies, type RankedPolicy } from "./priority";
import { formatDate, relativeDays } from "./format";

// Default to the latest Opus; override with POLICYAGENT_MODEL if desired.
const MODEL = process.env.POLICYAGENT_MODEL || "claude-opus-5";
const TOP_N = 6;

/**
 * Generate a briefing that summarizes the most important tracked policies and
 * stores it. Uses Claude when ANTHROPIC_API_KEY is set; otherwise falls back to
 * a deterministic, rule-based narrative so the feature always works.
 */
export async function generateBriefing(): Promise<Briefing> {
  const ranked = rankPolicies(listPolicies(), changesByPolicy());
  const top = ranked.slice(0, TOP_N);

  if (top.length === 0) {
    return storeBriefing({
      source: "rule",
      model: null,
      summary: "No active or upcoming policies are being tracked yet. Add policies to generate a briefing.",
      policyIds: [],
    });
  }

  const policyIds = top.map((r) => r.policy.id);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const summary = await writeWithClaude(top, ranked.length);
      return storeBriefing({ source: "ai", model: MODEL, summary, policyIds });
    } catch (err) {
      // Any API error / refusal falls back to the deterministic summary.
      console.error("[summarize] AI generation failed, using rule-based fallback:", err);
    }
  }

  return storeBriefing({
    source: "rule",
    model: null,
    summary: ruleBasedSummary(top, ranked.length),
    policyIds,
  });
}

// ---------------------------------------------------------------------------
// Claude-authored briefing
// ---------------------------------------------------------------------------
async function writeWithClaude(top: RankedPolicy[], totalRanked: number): Promise<string> {
  const client = new Anthropic();

  const system =
    "You are a payer-policy analyst for a hospital/provider revenue-cycle team. " +
    "You write tight, factual executive briefings that help a policy desk act. " +
    "Keep it concise and scannable; do not invent facts beyond the data provided; " +
    "do not add disclaimers. Use plain text with short markdown (a lead paragraph, " +
    "then a bulleted list of the priority policies).";

  const prompt =
    `Here are the ${top.length} highest-priority payer policies (out of ${totalRanked} active/upcoming), ` +
    `pre-ranked by an urgency+impact engine. Write an executive briefing.\n\n` +
    `${top.map((r, i) => policyBlock(r, i)).join("\n")}\n` +
    `Write:\n` +
    `1. A 2-3 sentence lead on the overall picture (what's most urgent this cycle).\n` +
    `2. A bullet per policy: bold the payer + short title, then one sentence on why it matters and the deadline/action.\n` +
    `Lead with the deadline-driven items. Keep the whole thing under ~250 words.`;

  // `output_config.effort` keeps thinking shallow so the short summary isn't
  // truncated by the max_tokens budget. Cast the body: the field is newer than
  // the installed SDK's types, but the SDK forwards it to the API as-is.
  const res = (await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: prompt }],
  } as any)) as Anthropic.Message;

  if (res.stop_reason === "refusal") {
    throw new Error("Model declined the request");
  }
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Empty response");
  return text;
}

function policyBlock(r: RankedPolicy, i: number): string {
  const p = r.policy;
  const lines = [
    `${i + 1}. ${p.payerName} — ${p.title} [${p.category}]`,
    `   status: ${p.status}, impact: ${p.impact}`,
    `   effective: ${formatDate(p.effectiveDate)}${p.effectiveDate ? ` (${relativeDays(p.effectiveDate)})` : ""}`,
    `   next review: ${formatDate(p.nextReviewDate)}${p.nextReviewDate ? ` (${relativeDays(p.nextReviewDate)})` : ""}`,
    `   why it ranks: ${r.reasons.join("; ")}`,
  ];
  if (p.summary) lines.push(`   detail: ${p.summary}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Deterministic fallback briefing
// ---------------------------------------------------------------------------
function ruleBasedSummary(top: RankedPolicy[], totalRanked: number): string {
  const highImpact = top.filter((r) => r.policy.impact === "High").length;
  const upcoming = top.filter((r) => r.policy.status === "Upcoming").length;

  const lead =
    `Across ${totalRanked} active and upcoming policies, ${top.length} rise to the top of the queue this cycle — ` +
    `${highImpact} high-impact and ${upcoming} not yet in effect. ` +
    `The list below is ordered by urgency and financial exposure; work the deadline-driven items first.`;

  const bullets = top
    .map((r) => {
      const p = r.policy;
      return `- **${p.payerName} — ${p.title}** (${p.category}, ${p.impact} impact): ${r.reasons.join("; ")}.`;
    })
    .join("\n");

  return `${lead}\n\n${bullets}`;
}
