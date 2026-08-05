import { NextRequest, NextResponse } from "next/server";
import { createChange, getPolicy, listChangesForPolicy } from "@/lib/repo";
import { parseChange } from "@/lib/validate";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return ok(listChangesForPolicy(parseId(params.id)));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseId(params.id);
    if (!getPolicy(id)) return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    const body = await req.json();
    const change = createChange({ policyId: id, ...parseChange(body) });
    return ok(change, 201);
  } catch (err) {
    return handleError(err);
  }
}
