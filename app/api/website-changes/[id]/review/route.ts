import { NextRequest, NextResponse } from "next/server";
import { markChangeReviewed } from "@/lib/watch";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!markChangeReviewed(parseId(params.id))) {
      return NextResponse.json({ error: "Change not found or already reviewed." }, { status: 404 });
    }
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
