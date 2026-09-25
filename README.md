# PolicyAgent — Payer Policy Tracker

A simple app for provider revenue-cycle teams to track health-plan **payer policies**
(prior auth, medical necessity, reimbursement, coverage, coding), log their changes,
and see which ones need attention first.

> Sample data is illustrative, not a substitute for each payer's official policy
> documentation.

## Screens

- **Home** — a ranked **Needs attention** list (with the reason each policy ranks
  where it does) and the latest **Recent changes** across all payers.
- **Policies** — search and filter by payer or category; add, edit, and delete.
  Open a policy to see its details and change history, and log new changes.
- **Payers** — the payers you track, with policy counts.

A policy's status is automatic: **Upcoming** until its effective date, then **Active**.

### How "Needs attention" ranks policies

Each policy is scored on its impact, how soon it takes effect, whether its review is
due or overdue, how recently it changed, and its category (prior auth and
reimbursement rank highest). The reasons are shown under each policy.

## Run it in GitHub Codespaces

1. On GitHub, click **Code → Codespaces → Create codespace on main**.
2. Wait for setup to finish. Dependencies install automatically, the app starts, and
   it opens in a new browser tab. If the tab doesn't open, use the **Ports** tab and
   click the globe icon next to port 3000.

The codespace stops after about 30 minutes idle; reopening it starts the app again.
Your data is kept in the codespace until you delete the codespace.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

On first run the database (`data/policyagent.db`) is created with 6 sample payers
and 10 policies. Delete that file to start over with the sample data.

## Reading the board from another tool

`GET /api/board` returns what's on the Home page as JSON: counts, the ranked
**needsAttention** list with each policy's reasons and dates, and recent changes.
It's read-only, for scripts or scheduled reviews that summarize the board.

## API

All routes return JSON and validate input.

| Method + path                        | Description                              |
| ------------------------------------ | ---------------------------------------- |
| `GET  /api/board`                    | Home board: counts, needs attention, recent changes |
| `GET/POST /api/payers`               | List / create payers                     |
| `GET/PUT/DELETE /api/payers/:id`     | Read / update / delete a payer           |
| `GET/POST /api/policies`             | List (filters: `search`, `payerId`, `category`) / create |
| `GET/PUT/DELETE /api/policies/:id`   | Read (with changes) / update / delete    |
| `GET/POST /api/policies/:id/changes` | List / log a change (`changeDate`, `summary`) |

PUT replaces every field, so send the full record. Deleting a payer deletes its
policies; deleting a policy deletes its changes.

## Tech

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, and SQLite via
`better-sqlite3`.

```
app/            Pages (Home, Policies, Payers) and API routes
components/     Forms, lists, and badges
lib/
  db.ts         SQLite connection, schema, upgrades, sample data
  repo.ts       Data access
  board.ts      Home board data (also served at /api/board)
  priority.ts   "Needs attention" ranking
  validate.ts   Input validation
```
