import { NextRequest } from "next/server";
import { deletePayer, getPayer, updatePayer } from "@/lib/repo";
import { parsePayer } from "@/lib/validate";
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
    const updated = updatePayer(parseId(params.id), parsePayer(body));
    if (!updated) return NextResponse.json({ error: "Payer not found." }, { status: 404 });
    return ok(updated);
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
