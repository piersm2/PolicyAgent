import { NextResponse } from "next/server";
import { ValidationError } from "./validate";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[api]", err);
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError("Invalid id.");
  return id;
}
