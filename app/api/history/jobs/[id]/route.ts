import { NextRequest } from "next/server";
import { updateJob } from "@/lib/history";
import { ValidationError } from "@/lib/validate";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Body: {"action": "start" | "cancel" | "retry"}. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { action } = await req.json().catch(() => ({}));
    if (!["start", "cancel", "retry"].includes(action)) throw new ValidationError('"action" must be start, cancel, or retry.');
    return ok(updateJob(parseId(params.id), action));
  } catch (err) {
    return handleError(err);
  }
}
