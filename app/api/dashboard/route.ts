import { dashboardStats } from "@/lib/repo";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(dashboardStats());
  } catch (err) {
    return handleError(err);
  }
}
