import { NextRequest } from "next/server";
import { trackHistoryEntry } from "@/lib/history";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Start tracking the policy this history entry is about. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return ok({ policyId: trackHistoryEntry(parseId(params.id)) }, 201);
  } catch (err) {
    return handleError(err);
  }
}
