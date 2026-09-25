"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/client";
import { daysFromToday, formatDate, relativeDays, safeHref } from "@/lib/format";
import type { Payer, PolicyWithPayer } from "@/lib/types";
import { PolicyForm } from "./PolicyForm";

/** Edit, Mark reviewed, and Open document buttons for the policy page header. */
export function PolicyHeaderActions({ policy, payers }: { policy: PolicyWithPayer; payers: Payer[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentHref = safeHref(policy.sourceUrl);

  async function markReviewed() {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/policies/${policy.id}/review`, "POST");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark reviewed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-ghost text-sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn-ghost text-sm"
          onClick={markReviewed}
          disabled={busy}
          title={`Sets the next review ${policy.reviewEveryMonths} month${policy.reviewEveryMonths === 1 ? "" : "s"} from today`}
        >
          {busy ? "Saving…" : "Mark reviewed"}
        </button>
        {documentHref && (
          <a href={documentHref} target="_blank" rel="noreferrer" className="btn-primary text-sm">
            Open document ↗
          </a>
        )}
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {editing && (
        <PolicyForm
          payers={payers}
          initial={policy}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Owner / next action / due date, with a Done button. */
export function ActionCard({ policy, payers }: { policy: PolicyWithPayer; payers: Payer[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const due = daysFromToday(policy.actionDue);
  const overdue = due !== null && due < 0;

  async function done() {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/policies/${policy.id}/action-done`, "POST");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Follow-up</h2>
        {policy.nextAction ? (
          <button className="btn-ghost text-sm" onClick={done} disabled={busy}>
            {busy ? "Saving…" : "Done"}
          </button>
        ) : (
          <button className="btn-ghost text-sm" onClick={() => setEditing(true)}>
            + Add next action
          </button>
        )}
      </div>
      {policy.nextAction ? (
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800">{policy.nextAction}</p>
          <p className="text-sm text-slate-500">
            Owner: {policy.owner || "unassigned"} ·{" "}
            {policy.actionDue ? (
              <span className={overdue ? "font-semibold text-red-600" : ""}>
                Due {formatDate(policy.actionDue)} ({overdue ? `overdue ${Math.abs(due!)}d` : relativeDays(policy.actionDue)})
              </span>
            ) : (
              "no due date"
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          No next action{policy.owner ? ` · Owner: ${policy.owner}` : ""}.
        </p>
      )}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      {editing && (
        <PolicyForm
          payers={payers}
          initial={policy}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
