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
  // Read by loading the page in a headless browser.
  rendered?: boolean;
}

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LINES = 5000;
const MAX_LINKS = 3000;
const MAX_LINE_LENGTH = 500;
// Many payer sites reject requests that don't look like a browser.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PayerPolicyWatch/1.0";

interface Fetched {
  body: Buffer;
  contentType: string;
  finalUrl: string;
}

async function fetchBody(url: string): Promise<Fetched> {
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
  return { body, contentType: res.headers.get("content-type") ?? "", finalUrl: res.url || url };
}

function isPdf(f: Fetched): boolean {
  return /pdf/i.test(f.contentType) || f.body.subarray(0, 5).toString("latin1") === "%PDF-";
}

function isDocx(f: Fetched): boolean {
  return (
    /wordprocessingml/i.test(f.contentType) ||
    (/\.docx($|\?)/i.test(f.finalUrl) && f.body.subarray(0, 2).toString("latin1") === "PK")
  );
}

function isHtml(f: Fetched): boolean {
  return /html|xml/i.test(f.contentType) && !isPdf(f) && !isDocx(f);
}

/** Text of each page of a PDF, in reading order. Empty strings for pages with no text (scans). */
async function pdfPages(body: Buffer): Promise<string[]> {
  try {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(body));
    const { text } = await extractText(pdf, { mergePages: false });
    return text;
  } catch {
    return [];
  }
}

/** Plain text of a Word (.docx) document; MO HealthNet publishes its provider manuals this way. */
async function docxText(body: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: body })).value;
  } catch {
    return "";
  }
}

function textToLines(texts: string[]): string[] {
  const lines = new Set<string>();
  for (const text of texts) {
    for (const raw of text.split(/\r?\n/)) {
      const line = clean(raw);
      if (line.length >= 3) lines.add(line.slice(0, MAX_LINE_LENGTH));
    }
  }
  return Array.from(lines).sort().slice(0, MAX_LINES);
}

const THIN_NOTE =
  "Very little content found. This page may be built by JavaScript or need a login, so changes may be missed.";
const NO_BROWSER_NOTE =
  "Very little content found, and the page reader isn't installed. Run “npm run install-browser” so pages built by JavaScript can be read.";
const STILL_THIN_NOTE =
  "Very little content found, even after loading the page in a browser. It may need a login, so changes may be missed.";

export async function fetchSnapshot(url: string): Promise<Snapshot> {
  const f = await fetchBody(url);
  return isHtml(f) ? snapshotHtml(f.body.toString("utf8"), f.finalUrl) : snapshotFile(f);
}

/** A PDF, Word, or other document: the content hash detects any change; text lines show what changed. */
async function snapshotFile(f: Fetched): Promise<Snapshot> {
  const hash = sha256(f.body);
  const base = { kind: "file" as const, hash, finalUrl: f.finalUrl, links: [] as PageLink[] };
  if (isPdf(f)) {
    const lines = textToLines(await pdfPages(f.body));
    return {
      ...base,
      lines,
      note: lines.length ? null : "No text found in this PDF (it may be a scan). Changes are detected but can't be shown line by line.",
    };
  }
  if (isDocx(f)) return { ...base, lines: textToLines([await docxText(f.body)]), note: null };
  return { ...base, lines: [], note: null };
}

async function snapshotHtml(html: string, url: string): Promise<Snapshot> {
  const snap = parseHtml(html, url);
  if (!isThin(snap)) return snap;

  // A landing page for documents (e.g. a MO HealthNet manual page that only links to
  // the current .docx): the links themselves are tracked, so a new version shows up as
  // a new link. With exactly one document, its text is compared too.
  const docs = documentLinks(snap);
  if (docs.length === 1) {
    try {
      const f = await fetchBody(docs[0].url);
      if (!isHtml(f)) {
        const file = await snapshotFile(f);
        return { ...file, hash: sha256(snap.hash + file.hash), finalUrl: snap.finalUrl, links: snap.links };
      }
    } catch {
      // Fall back to watching the landing page's links.
    }
  }
  if (docs.length) return { ...snap, note: null };

  // Probably built by JavaScript: load it in a headless browser.
  const rendered = await renderPage(url);
  if (rendered === "unavailable") return { ...snap, note: NO_BROWSER_NOTE };
  const full = parseHtml(rendered.html, rendered.finalUrl);
  return { ...full, rendered: true, note: isThin(full) ? STILL_THIN_NOTE : null };
}

function isThin(snap: Snapshot): boolean {
  const textLength = snap.lines.reduce((n, l) => n + l.length, 0);
  return textLength < 300 && snap.links.length < 5;
}

const DOCUMENT_EXT = /\.(pdf|docx?|xlsx?|rtf)$/i;

function documentLinks(snap: Snapshot): PageLink[] {
  return snap.links.filter((l) => {
    try {
      return DOCUMENT_EXT.test(new URL(l.url).pathname);
    } catch {
      return false;
    }
  });
}

const RENDER_TIMEOUT_MS = 45_000;

/**
 * Load a page in headless Chromium and return the HTML after scripts run. "unavailable"
 * when no browser is installed; throws if the browser couldn't load the page, so the
 * check fails (and is retried) instead of recording a half-loaded page as a change.
 */
async function renderPage(url: string): Promise<{ html: string; finalUrl: string } | "unavailable"> {
  if (process.env.RENDER_JS_PAGES === "0") return "unavailable";
  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    return "unavailable";
  }
  let browser: import("playwright-core").Browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  } catch (err) {
    if (/executable doesn't exist|install/i.test(String(err))) return "unavailable";
    throw new Error("The page needs a browser to load, and the browser couldn't start.");
  }
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.goto(url, { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return { html: await page.content(), finalUrl: page.url() };
  } catch {
    throw new Error("The page is built by JavaScript and didn't finish loading in the browser.");
  } finally {
    await browser.close().catch(() => {});
  }
}

/** A document's readable content for summarizing: text in reading order, or the PDF itself for scans. */
export interface DocumentContent {
  kind: "html" | "pdf" | "docx" | "other";
  finalUrl: string;
  text: string;
  pages: number | null;
  /** Base64 PDF, only when the PDF has no extractable text. */
  pdfBase64: string | null;
}

export async function fetchDocument(url: string): Promise<DocumentContent> {
  const f = await fetchBody(url);
  if (!isHtml(f)) return documentFromFile(f);

  const html = f.body.toString("utf8");
  const text = readableText(html);
  const snap = parseHtml(html, f.finalUrl);
  if (isThin(snap)) {
    // Same fallbacks as checks: follow a single linked document, or render the page.
    const docs = documentLinks(snap);
    if (docs.length === 1) {
      const inner = await fetchBody(docs[0].url).catch(() => null);
      if (inner && !isHtml(inner)) return documentFromFile(inner);
    } else if (!docs.length) {
      const rendered = await renderPage(url).catch(() => "unavailable" as const);
      if (rendered !== "unavailable") {
        const renderedText = readableText(rendered.html);
        if (renderedText.length > text.length) {
          return { kind: "html", finalUrl: rendered.finalUrl, text: renderedText, pages: null, pdfBase64: null };
        }
      }
    }
  }
  return { kind: "html", finalUrl: f.finalUrl, text, pages: null, pdfBase64: null };
}

async function documentFromFile(f: Fetched): Promise<DocumentContent> {
  if (isPdf(f)) {
    const pages = await pdfPages(f.body);
    const text = pages
      .map((t, i) => (t.trim() ? `[Page ${i + 1}]\n${t.trim()}` : ""))
      .filter(Boolean)
      .join("\n\n");
    return {
      kind: "pdf",
      finalUrl: f.finalUrl,
      text,
      pages: pages.length || null,
      pdfBase64: text.trim() ? null : f.body.toString("base64"),
    };
  }
  if (isDocx(f)) return { kind: "docx", finalUrl: f.finalUrl, text: (await docxText(f.body)).trim(), pages: null, pdfBase64: null };
  return { kind: "other", finalUrl: f.finalUrl, text: "", pages: null, pdfBase64: null };
}

/** Page text in reading order, for summarizing. */
function readableText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, template, iframe, nav, header, footer").remove();
  const parts: string[] = [];
  $("h1, h2, h3, h4, h5, h6, p, li, td, th, dt, dd, caption, blockquote, pre").each((_, el) => {
    // Skip containers whose text is repeated by a nested block element.
    if ($(el).find("p, li, td, th, dd, dt").length) return;
    const text = clean($(el).text());
    if (text.length >= 2 && parts[parts.length - 1] !== text) parts.push(text);
  });
  return parts.join("\n");
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
  const note = textLength < 300 && sortedLinks.length < 5 ? THIN_NOTE : null;

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
