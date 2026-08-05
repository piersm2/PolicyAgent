import { changesByPolicy, listBriefings, listPolicies } from "@/lib/repo";
import { rankPolicies } from "@/lib/priority";
import { BriefingPanel, type RankedItem } from "@/components/BriefingPanel";

export const dynamic = "force-dynamic";

export default function BriefingPage() {
  const ranked = rankPolicies(listPolicies(), changesByPolicy());
  const priorities: RankedItem[] = ranked.slice(0, 8).map((r) => ({
    id: r.policy.id,
    title: r.policy.title,
    payerName: r.policy.payerName,
    category: r.policy.category,
    status: r.policy.status,
    impact: r.policy.impact,
    score: r.score,
    reasons: r.reasons,
  }));

  return (
    <BriefingPanel
      priorities={priorities}
      initialBriefings={listBriefings(20)}
      aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
