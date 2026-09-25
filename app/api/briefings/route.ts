import { listBriefings } from "@/lib/repo";
import { generateBriefing } from "@/lib/summarize";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";
// Generation may call the model; give it room.
export const maxDuration = 60;

export async function GET() {
  try {
    return ok(listBriefings(20));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST() {
  try {
    const briefing = await generateBriefing();
    return ok(briefing, 201);
  } catch (err) {
    return handleError(err);
  }
}
