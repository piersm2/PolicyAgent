import { NextRequest } from "next/server";
import { createPayer, listPayers } from "@/lib/repo";
import { parsePayer } from "@/lib/validate";
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
    const payer = createPayer(parsePayer(body));
    return ok(payer, 201);
  } catch (err) {
    return handleError(err);
  }
}
