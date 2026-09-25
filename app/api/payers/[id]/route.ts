import { NextRequest } from "next/server";
import { deletePayer, getPayer, updatePayer } from "@/lib/repo";
import { parsePayer, parsePayerPages } from "@/lib/validate";
import { addPayerPages } from "@/lib/catalog-install";
import { getDb } from "@/lib/db";
import { handleError, ok, parseId } from "@/lib/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payer = getPayer(parseId(params.id));
    if (!payer) return NextResponse.json({ error: "Payer not found." }, { status: 404 });
    return ok(payer);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const input = parsePayer(body);
    const pages = parsePayerPages(body.pages);
    const updated = updatePayer(parseId(params.id), input);
    if (!updated) return NextResponse.json({ error: "Payer not found." }, { status: 404 });
    const pagesAdded = addPayerPages(getDb(), updated.id, pages);
    return ok({ ...updated, pagesAdded });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const removed = deletePayer(parseId(params.id));
    if (!removed) return NextResponse.json({ error: "Payer not found." }, { status: 404 });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
