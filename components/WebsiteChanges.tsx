"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { formatDateTime, safeHref } from "@/lib/format";
import type { PageChange, PageLink } from "@/lib/types";

const SHOW = 10;

export function WebsiteChanges({ changes }: { changes: PageChange[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markReviewed(id: number) {
    setBusy(id);
    setError(null);
    try {
      await apiSend(`/api/website-changes/${id}/review`, "POST");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark reviewed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-slate-900">Website changes to review</h2>
      <p className="mb-4 text-xs text-slate-500">Found on watched payer pages since your last review.</p>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <ul className="space-y-3">
        {changes.map((c) => (
          <li key={c.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-800">
                  {c.payerName} — {c.pageLabel}
                </div>
                <div className="text-xs text-slate-500" suppressHydrationWarning>
                  Detected {formatDateTime(c.detectedAt)} · {summarize(c)}
                </div>
              </div>
              <button className="btn-ghost text-xs" onClick={() => markReviewed(c.id)} disabled={busy === c.id}>
                {busy === c.id ? "Saving…" : "Mark reviewed"}
              </button>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-brand-600">Show details</summary>
              <div className="mt-2 space-y-2">
                {c.fileChanged && <p className="text-slate-700">The document at this address changed.</p>}
                <LinkList title="New links / documents" links={c.newLinks} />
                <LinkList title="Removed links / documents" links={c.removedLinks} />
                <TextList title="Text added" items={c.addedText} />
                <TextList title="Text removed" items={c.removedText} />
                {safeHref(c.pageUrl) && (
                  <a href={safeHref(c.pageUrl)!} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                    Open the page ↗
                  </a>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function summarize(c: PageChange): string {
  const parts: string[] = [];
  if (c.fileChanged) parts.push("document changed");
  if (c.newLinks.length) parts.push(`${c.newLinks.length} new link${c.newLinks.length === 1 ? "" : "s"}`);
  if (c.removedLinks.length) parts.push(`${c.removedLinks.length} removed`);
  const text = c.addedText.length + c.removedText.length;
  if (text) parts.push(`${text} text change${text === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function LinkList({ title, links }: { title: string; links: PageLink[] }) {
  if (!links.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="list-disc pl-5 text-slate-700">
        {links.slice(0, SHOW).map((l) => (
          <li key={l.url}>
            {safeHref(l.url) ? (
              <a href={safeHref(l.url)!} target="_blank" rel="noreferrer" className="hover:text-brand-700">
                {l.text}
              </a>
            ) : (
              l.text
            )}
          </li>
        ))}
      </ul>
      {links.length > SHOW && <p className="text-xs text-slate-400">…and {links.length - SHOW} more</p>}
    </div>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="list-disc pl-5 text-slate-700">
        {items.slice(0, SHOW).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {items.length > SHOW && <p className="text-xs text-slate-400">…and {items.length - SHOW} more</p>}
    </div>
  );
}
