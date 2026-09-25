import { NextRequest } from "next/server";
import { createPolicy, listPolicies } from "@/lib/repo";
import { parsePolicy } from "@/lib/validate";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const payerId = sp.get("payerId");
    const policies = listPolicies({
      search: sp.get("search") || undefined,
      payerId: payerId ? Number(payerId) : undefined,
      category: sp.get("category") || undefined,
    });
    return ok(policies);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const policy = createPolicy(parsePolicy(body));
    return ok(policy, 201);
  } catch (err) {
    return handleError(err);
  }
}
