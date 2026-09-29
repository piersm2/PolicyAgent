import { NextRequest } from "next/server";
import { applyCoworkResults } from "@/lib/cowork";
import { ValidationError } from "@/lib/validate";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Save what Cowork wrote (see GET /api/cowork for the format). Items are saved independently. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new ValidationError("The results aren't valid JSON.");
    });
    return ok(applyCoworkResults(body));
  } catch (err) {
    return handleError(err);
  }
}
