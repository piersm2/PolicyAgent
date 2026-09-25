import { NextRequest } from "next/server";
import { createPayer, listPayers } from "@/lib/repo";
import { parsePayer, parsePayerPages } from "@/lib/validate";
import { addPayerPages } from "@/lib/catalog-install";
import { getDb } from "@/lib/db";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(listPayers());
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = parsePayer(body);
    const pages = parsePayerPages(body.pages);
    const payer = createPayer(input);
    const pagesAdded = addPayerPages(getDb(), payer.id, pages);
    return ok({ ...payer, pagesAdded }, 201);
  } catch (err) {
    return handleError(err);
  }
}
