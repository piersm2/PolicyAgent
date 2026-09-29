import { NextRequest, NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { getPolicy } from "@/lib/repo";
import { getBriefState, runAiJob, writePolicyBrief } from "@/lib/summaries";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // reading a long policy document can take a minute or two

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseId(params.id);
    if (!getPolicy(id)) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return ok(getBriefState(id));
  } catch (err) {
    return handleError(err);
  }
}

/** Write (or rewrite) the policy's brief now. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseId(params.id);
    if (!getPolicy(id)) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    if (!aiEnabled()) {
      return NextResponse.json({ error: "AI briefs are off: set ANTHROPIC_API_KEY (see the README)." }, { status: 400 });
    }
    return ok(await runAiJob(() => writePolicyBrief(id)));
  } catch (err) {
    return handleError(err);
  }
}
