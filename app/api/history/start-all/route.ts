import { startAllReady } from "@/lib/history";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Start every import that has found its documents. */
export async function POST() {
  try {
    return ok({ started: startAllReady() });
  } catch (err) {
    return handleError(err);
  }
}
