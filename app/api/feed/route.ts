import { NextRequest, NextResponse } from "next/server";
import { compileFeed, feedToMarkdown } from "@/lib/feed";
import { handleError } from "@/lib/http";

export const dynamic = "force-dynamic";

// The compiled feed. JSON by default; ?format=md returns readable text.
export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const feed = compileFeed(origin);
    if (req.nextUrl.searchParams.get("format") === "md") {
      // text/plain so browsers display it instead of downloading it.
      return new NextResponse(feedToMarkdown(feed, origin), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.json(feed);
  } catch (err) {
    return handleError(err);
  }
}
