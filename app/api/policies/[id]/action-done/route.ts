import { NextRequest, NextResponse } from "next/server";
import { completePolicyAction } from "@/lib/repo";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

// Mark the policy's next action done (clears the action and its due date).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const policy = completePolicyAction(parseId(params.id));
    if (!policy) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return ok(policy);
  } catch (err) {
    return handleError(err);
  }
}
