import { NextRequest, NextResponse } from "next/server";
import { deleteWatchPage } from "@/lib/watch";
import { handleError, ok, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!deleteWatchPage(parseId(params.id))) {
      return NextResponse.json({ error: "Watch page not found." }, { status: 404 });
    }
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
