import type { NextRequest } from "next/server";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i;

/**
 * The address people and tools use to reach this app, for absolute links in the feed.
 * Order: BASE_URL setting, a proxy's forwarded host, the Codespaces address, the request itself.
 * (Behind the Codespaces proxy the request looks like it came to localhost.)
 */
export function publicOrigin(req: NextRequest): string {
  const configured = process.env.BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const first = (name: string) => req.headers.get(name)?.split(",")[0].trim();
  const forwardedHost = first("x-forwarded-host");
  if (forwardedHost && !LOCAL_HOST.test(forwardedHost)) {
    return `${first("x-forwarded-proto") || "https"}://${forwardedHost}`;
  }

  const codespace = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (codespace && domain) return `https://${codespace}-${process.env.PORT || "3000"}.${domain}`;

  return req.nextUrl.origin;
}
