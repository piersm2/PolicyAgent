import { NextRequest } from "next/server";
import { createImportJobs, listJobs } from "@/lib/history";
import { ValidationError } from "@/lib/validate";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(listJobs());
  } catch (err) {
    return handleError(err);
  }
}

/** Queue an import for each page. Body: {"pageIds": [n, ...], "months": 12}. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pageIds: unknown = body?.pageIds;
    if (!Array.isArray(pageIds) || !pageIds.length || !pageIds.every((n) => Number.isInteger(n) && n > 0)) {
      throw new ValidationError('"pageIds" must list at least one watched page id.');
    }
    return ok(createImportJobs(pageIds as number[], Number(body.months ?? 12)), 201);
  } catch (err) {
    return handleError(err);
  }
}
