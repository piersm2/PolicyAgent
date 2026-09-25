import { NextRequest } from "next/server";
import { CATALOG } from "@/lib/catalog";
import { installCatalog, installedCatalogKeys } from "@/lib/catalog-install";
import { getDb } from "@/lib/db";
import { ValidationError } from "@/lib/validate";
import { handleError, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Known payers and their policy pages, flagged when already added. */
export async function GET() {
  try {
    const installed = installedCatalogKeys(getDb());
    return ok(CATALOG.map((c) => ({ ...c, added: installed.has(c.key) })));
  } catch (err) {
    return handleError(err);
  }
}

/** Body: { keys: string[] }. Adds those payers and any of their pages not already watched. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keys: unknown = body?.keys;
    if (!Array.isArray(keys) || keys.length === 0) throw new ValidationError(`"keys" must list at least one payer.`);
    const unknown = keys.filter((k) => !CATALOG.some((c) => c.key === k));
    if (unknown.length) throw new ValidationError(`Unknown catalog payer: ${unknown.join(", ")}.`);
    return ok(installCatalog(getDb(), keys as string[]), 201);
  } catch (err) {
    return handleError(err);
  }
}
