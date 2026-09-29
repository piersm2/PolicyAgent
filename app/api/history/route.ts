import { NextRequest } from "next/server";
import { listHistory } from "@/lib/history";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Imported history entries. Query: payerId, relevance (high | medium | all), q, since (YYYY-MM-DD), limit. */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const rel = q.get("relevance");
    return ok(
      listHistory({
        payerId: Number(q.get("payerId")) || undefined,
        relevance: rel === "high" || rel === "all" ? rel : "medium",
        search: q.get("q") || undefined,
        sinceDate: q.get("since") || undefined,
        limit: Math.min(Number(q.get("limit")) || 500, 2000),
      })
    );
  } catch (err) {
    return handleError(err);
  }
}
