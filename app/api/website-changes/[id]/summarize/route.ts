import { NextRequest, NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { runAiJob, summarizeChange } from "@/lib/summaries";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Have Claude explain this detected change now. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseId(params.id);
    if (!getDb().prepare("SELECT 1 FROM page_changes WHERE id = ?").get(id)) {
      return NextResponse.json({ error: "Change not found." }, { status: 404 });
    }
    if (!aiEnabled()) {
      return NextResponse.json({ error: "AI summaries are off: set ANTHROPIC_API_KEY (see the README)." }, { status: 400 });
    }
    await runAiJob(() => summarizeChange(id));
    const row = getDb().prepare("SELECT aiSummary, aiSummaryAt, aiError FROM page_changes WHERE id = ?").get(id) as {
      aiSummary: string | null;
      aiSummaryAt: string | null;
      aiError: string | null;
    };
    return ok({ ...row, aiSummary: row.aiSummary ? JSON.parse(row.aiSummary) : null });
  } catch (err) {
    return handleError(err);
  }
}
