import { NextRequest } from "next/server";
import { checkPages } from "@/lib/watch";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // several payer sites, checked one at a time

// Check watched pages now. Body {"pageId": n} checks one page, {"due": true}
// only pages not checked within CHECK_EVERY_HOURS, and no body checks all.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const which =
      body?.pageId !== undefined ? [parseId(String(body.pageId))] : body?.due === true ? "due" : "all";
    return ok(await checkPages(which));
  } catch (err) {
    return handleError(err);
  }
}
