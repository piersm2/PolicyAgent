// Small fetch helpers for client components.

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error((await safeError(res)) || "Request failed");
  return res.json();
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await safeError(res)) || "Request failed");
  return res.json();
}

async function safeError(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    return data?.error ?? null;
  } catch {
    return null;
  }
}
