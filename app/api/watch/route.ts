import { NextRequest } from "next/server";
import { addWatchPage, listWatchPages } from "@/lib/watch";
import { parseWatchPage } from "@/lib/validate";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(listWatchPages());
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    return ok(addWatchPage(parseWatchPage(await req.json())), 201);
  } catch (err) {
    return handleError(err);
  }
}
