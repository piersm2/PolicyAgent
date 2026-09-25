import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { PageLink } from "./types";

// Fetch a payer policy/bulletin page and reduce it to a snapshot that can be
// compared with the previous check: its text lines and the documents it links to.

export interface Snapshot {
  kind: "html" | "file"; // "file" = PDF or other non-HTML document
  hash: string;
  finalUrl: string; // after redirects
  lines: string[];
  links: PageLink[];
  // Set when the page may not have loaded fully (e.g. built by JavaScript).
  note: string | null;
}

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LINES = 5000;
const MAX_LINKS = 3000;
const MAX_LINE_LENGTH = 500;
// Many payer sites reject requests that don't look like a browser.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PolicyAgent/1.0";

export async function fetchSnapshot(url: string): Promise<Snapshot> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : describe(err);
    throw new Error(`Couldn't reach the page (${reason}).`);
  }
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 429 ? " The site may be blocking automated checks." : "";
    throw new Error(`The page returned HTTP ${res.status}.${hint}`);
  }

  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error("The page is larger than 10 MB; skipped.");

  const contentType = res.headers.get("content-type") ?? "";
  if (!/html|xml/i.test(contentType)) {
    // PDFs and other documents: detect changes by content hash only.
    return { kind: "file", hash: sha256(body), finalUrl: res.url || url, lines: [], links: [], note: null };
  }
  return parseHtml(body.toString("utf8"), res.url || url);
}

export function parseHtml(html: string, baseUrl: string): Snapshot {
  const $ = cheerio.load(html);
  // Drop code and site chrome that change often but never carry policy content.
  $("script, style, noscript, svg, template, iframe, nav, header, footer").remove();

  const lines = new Set<string>();
  $("h1, h2, h3, h4, h5, h6, p, li, td, th, dt, dd, caption, blockquote, pre").each((_, el) => {
    const text = clean($(el).text());
    if (text.length >= 3) lines.add(text.slice(0, MAX_LINE_LENGTH));
  });

  const links = new Map<string, PageLink>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || href.startsWith("#")) return;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    const key = normalizeLinkUrl(url.toString());
    if (!links.has(key)) links.set(key, { url: key, text: clean($(el).text()).slice(0, 200) || key });
  });

  const sortedLines = Array.from(lines).sort().slice(0, MAX_LINES);
  const sortedLinks = Array.from(links.values())
    .sort((a, b) => a.url.localeCompare(b.url))
    .slice(0, MAX_LINKS);

  const textLength = sortedLines.reduce((n, l) => n + l.length, 0);
  const note =
    textLength < 300 && sortedLinks.length < 5
      ? "Very little content found. This page may be built by JavaScript or need a login, so changes may be missed."
      : null;

  return {
    kind: "html",
    hash: sha256(JSON.stringify([sortedLines, sortedLinks.map((l) => l.url)])),
    finalUrl: baseUrl,
    lines: sortedLines,
    links: sortedLinks,
    note,
  };
}

// Query parameters sites add to bust caches (e.g. CMS "?t=1727..."); they change on
// every page load without the linked document changing. "v" is deliberately kept:
// sites such as Healthy Blue use ?v=<date> as the document's version, so a new
// value there means the document really changed.
const CACHE_BUSTING_PARAMS = new Set([
  "t", "ts", "_", "_t", "cb", "cache", "cachebust", "cachebuster", "nocache",
  "timestamp", "rnd", "rand", "random", "bust",
]);

/** Canonical form of a link for comparing snapshots: no fragment, no cache-busting params. */
export function normalizeLinkUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  url.hash = "";
  const kept = Array.from(url.searchParams.entries())
    .filter(([key]) => !CACHE_BUSTING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();
  return url.toString();
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    return cause?.code ?? err.message;
  }
  return "unknown error";
}
