import { COWORK_INSTRUCTIONS, RESULT_EXAMPLE, coworkTasks } from "@/lib/cowork";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Today's reading tasks for the daily Cowork task, with instructions and the result format. */
export async function GET() {
  try {
    return ok({ ...coworkTasks(), instructions: COWORK_INSTRUCTIONS, resultFormat: RESULT_EXAMPLE });
  } catch (err) {
    return handleError(err);
  }
}
