import { getBoard } from "@/lib/board";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// Read-only snapshot of the Home board (counts, ranked "needs attention"
// list with reasons, recent changes) for scripts and scheduled reviews.
export async function GET() {
  try {
    return ok(getBoard());
  } catch (err) {
    return handleError(err);
  }
}
