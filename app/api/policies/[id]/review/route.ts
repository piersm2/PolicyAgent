import { NextRequest, NextResponse } from "next/server";
import { markPolicyReviewed } from "@/lib/repo";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

// Mark the policy reviewed today; its next review date moves forward by its review interval.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const policy = markPolicyReviewed(parseId(params.id));
    if (!policy) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return ok(policy);
  } catch (err) {
    return handleError(err);
  }
}
