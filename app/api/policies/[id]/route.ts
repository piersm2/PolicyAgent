import { NextRequest, NextResponse } from "next/server";
import { deletePolicy, getPolicy, listChangesForPolicy, updatePolicy } from "@/lib/repo";
import { parsePolicy } from "@/lib/validate";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseId(params.id);
    const policy = getPolicy(id);
    if (!policy) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return ok({ ...policy, changes: listChangesForPolicy(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = updatePolicy(parseId(params.id), parsePolicy(body));
    if (!updated) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const removed = deletePolicy(parseId(params.id));
    if (!removed) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
