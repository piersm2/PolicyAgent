# PolicyAgent — Payer Policy Tracker

A lightweight app for provider revenue-cycle and utilization-management teams to
track health-plan **payer policies** — medical, reimbursement, coverage, prior-auth,
and coding policies — along with their **effective dates**, **version history**, and
the day-to-day **changes** payers publish.

It answers the questions a policy desk actually asks:

- What's taking effect in the next 90 days that we need to operationalize?
- Which policies are **overdue** or coming **due for review**?
- What changed recently, and for which payer?
- What's the full change history behind a given policy?

> Data shipped with the app is illustrative sample data, not a substitute for each
> payer's official policy documentation.

## Screens

- **Dashboard** — KPI tiles, "effective within 90 days", "review due" (with overdue
  flags), a recent-changes feed, and a policies-by-category breakdown.
- **Policies** — searchable, filterable table (by payer, category, status, impact)
  with inline add / edit / delete.
- **Policy detail** — full metadata plus a change-history timeline you can append to.
- **Payers** — payer directory with per-payer policy counts and contact info.
- **Change Log** — every logged change across all payers, grouped by date.
- **Briefing** — surfaces and summarizes the important ones (see below).

## Finding the important ones — the Briefing

Tracking is only half the job; the Briefing tells you *what to act on*.

- **Priority engine** — a deterministic scorer ranks every active/upcoming policy
  by impact, status, days-to-effective-date, review-overdue pressure, recent
  change activity, and category weight (prior-auth / reimbursement rank highest).
  Each policy shows its score and the plain-English reasons behind it.
- **Executive summary** — one click writes a briefing over the top of that queue.
  When `ANTHROPIC_API_KEY` is set, **Claude** authors it; otherwise a built-in
  rule-based narrative is used, so the feature works with zero configuration.
- **Logged & stored** — every generated briefing is saved (AI or rule-based,
  with model + timestamp) and kept as browsable history.

Configure the model with `POLICYAGENT_MODEL` (defaults to `claude-opus-5`).

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS**
- **SQLite** via `better-sqlite3` — a single local file at `data/policyagent.db`,
  created and **seeded automatically on first run** (no migrations to run)
- **Claude** via `@anthropic-ai/sdk` for the executive summary (optional — falls
  back to a rule-based summary when no API key is present)

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

For a production build:

```bash
npm run build
npm run start
```

On first launch the database is created at `data/policyagent.db` and seeded with six
payers and eleven representative policies. Delete that file to reset to a clean seed.

## Data model

| Entity           | Notes                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| `payers`         | Insurer / plan — name, type (Commercial, MA, Medicaid, …), website, contact.     |
| `policies`       | Belongs to a payer — title, category, status, impact, effective/review dates.    |
| `policy_changes` | Append-only history entries per policy — date, type (New/Revised/Retired), note. |
| `briefings`      | Stored executive summaries — source (`ai`/`rule`), model, text, ranked policy ids. |

Deleting a payer cascades to its policies; deleting a policy cascades to its changes.

## API

All routes return JSON and validate input server-side.

| Method + path                        | Description                           |
| ------------------------------------ | ------------------------------------- |
| `GET  /api/dashboard`                | Aggregated dashboard stats            |
| `GET/POST /api/payers`               | List / create payers                  |
| `GET/PUT/DELETE /api/payers/:id`     | Read / update / delete a payer        |
| `GET/POST /api/policies`             | List (with filters) / create          |
| `GET/PUT/DELETE /api/policies/:id`   | Read (with changes) / update / delete |
| `GET/POST /api/policies/:id/changes` | List / append change-history entries  |
| `GET  /api/briefings`                | List stored briefings (history)       |
| `POST /api/briefings`                | Generate + store an executive briefing |

Policy list filters (query params): `search`, `payerId`, `category`, `status`, `impact`.

## Project layout

```
app/
  page.tsx              Dashboard (server component)
  policies/             Policy list + [id] detail
  payers/               Payer directory
  changes/              Change log
  api/                  REST route handlers
components/             Client UI (forms, modal, badges, browsers)
lib/
  db.ts                 SQLite connection, schema, seed data
  repo.ts               Typed data-access layer
  validate.ts           Input validation
  types.ts              Domain types + enums
  format.ts             Date helpers
```
