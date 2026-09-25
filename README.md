# PolicyAgent — Payer Policy Compiler

Compiles health-plan payer policy information into one feed that Cowork (or any
tool) can read:

- **Payer websites:** the app watches payer policy and bulletin pages, and each
  policy's own document, and records what changed: new or removed documents and
  links, and text added or removed.
- **Your policies:** the policies you track, with review dates, an owner, and the
  next action, ranked by what needs attention first.
- **One feed:** everything compiled at `http://localhost:3000/api/feed`.

> Sample data is illustrative, not a substitute for each payer's official policy
> documentation.

## Run it on your computer

Requires **Node.js 20.18 or newer**. The current LTS from https://nodejs.org is fine.

**Windows:** download or clone this repo, then double-click **`Start PolicyAgent.cmd`**.
It installs what's needed, builds the app, starts it, and opens your browser. Keep the
window open while you use the app; close it to stop.

**Mac or Linux:**

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

The first run creates `data/policyagent.db` with the payers a rural Missouri hospital
deals with (Medicare, MO HealthNet and its managed care plans, Medicare Advantage
plans, and the main commercial plans), their policy pages, and 7 real sample
policies that each watch their own document. Delete that file to start over.

A database from an earlier version is upgraded in place: new fields are added, and
sample pages that had moved or returned 404 are pointed at working pages. Your own
payers, policies, and history are kept. To add the Missouri payers to an existing
database, use **Payers → Add from catalog**.

## Screens

- **Home:** website changes waiting for review, **Action items** (next actions by due
  date), the ranked **Needs attention** list, and recent logged changes. Every item
  links to its policy. **Open feed** shows the compiled feed.
- **Policies:** search and filter; add, edit, delete. The table shows each policy's
  next action.
- **Policy page:** **Edit**, **Mark reviewed** (records today's review and moves the
  next review date forward by the policy's review interval), **Open document**, the
  follow-up (owner, next action, due date, with **Done**), the document's watch status
  and any changes found in it, and the change history.
- **Payers:** the payers you track. **Add from catalog** adds known payers with their
  policy pages; **Add payer** takes the payer's policy page addresses, one per line.
- **Watch list:** the payer pages and policy documents being checked, with each one's
  last result. Add pages, check now, or remove them.

A policy's status is automatic: **Upcoming** until its effective date, then **Active**.
Deleting a payer, policy, or watched page asks first.

### Policy fields

- **Policy document link:** the policy itself (its PDF or page). With **Watch this
  document for changes** ticked, the watcher checks it and flags the policy when it
  changes.
- **Review every:** 1, 3, 6, 12, or 24 months. **Mark reviewed** uses it.
- **Follow-up:** owner, next action, and due date. Overdue actions rank the policy
  higher and show in red.

## Watching payer websites

While the app is running, it checks pages that are due about 15 seconds after it
starts and then every hour. A page is due when it hasn't been checked for 24 hours;
set the `CHECK_EVERY_HOURS` environment variable to change that. You can also click
**Check all now** on the Watch list, or run `npm run check-due`.

- **The first check records a starting point.** Changes are reported from the next
  check on.
- **For HTML pages** it compares the page's links and text, ignoring menus, headers,
  footers, and scripts. A new bulletin PDF shows up as a new link.
- **Link addresses are normalized before comparing:** `#fragments` and cache-busting
  parameters (`t`, `ts`, `_`, `cb`, `nocache`, `timestamp`, and similar) are removed,
  so a link whose only difference is `?t=1695600000` isn't reported as new. `v` is
  kept because some payers (Healthy Blue) use `?v=` for the document's version.
- **For PDFs and other files** it reports that the document changed.
- **Pages that can't be checked** show why on the Watch list and in the feed. Some
  payer sites block automated requests; others build their content with JavaScript or
  require a login. Those need a person, or Cowork in a browser, to review.

Each detected change stays in **Website changes to review** until it's marked reviewed.

### The payer catalog

`lib/catalog.ts` lists each catalog payer's policy pages. Every URL there is checked
from GitHub's network by the **Verify payer links** workflow when the catalog changes
and every Monday; a failed run means a payer moved a page. Run the same check
yourself with `npm run check-links`.

Some payer pages can't be watched because they load their lists with JavaScript:
WPS (Missouri's Medicare contractor), the Medicare Coverage Database reports, Anthem
Provider News, Healthy Blue's policy search and news, and Humana's claims payment
policies. The catalog notes these; watch individual policy documents instead.

### Scheduled checks

The built-in timer only runs while the app is running. A codespace stops after about
30 idle minutes, and a closed laptop stops too. Two options:

1. **Best: run the app on a computer that stays on** (a hospital server or a small
   always-on PC or VM). The built-in timer then does everything, or add a daily
   operating-system job (Task Scheduler or cron) that runs `npm run check-due` in the
   app folder.
2. **In Codespaces:** the **Scheduled payer check** GitHub Action wakes the codespace
   every day at about 7:15 AM Central, runs `npm run check-due`, and lets it go back to
   sleep. One-time setup:
   1. Rebuild the codespace once so it has the SSH server this needs (Command Palette →
      **Codespaces: Rebuild Container**).
   2. Create a personal access token (classic) with the **codespace** scope at
      https://github.com/settings/tokens, and save it as a repository secret named
      `CODESPACE_TOKEN` (**Settings → Secrets and variables → Actions → Secrets**).
   3. Save your codespace's name as a repository variable named `CODESPACE_NAME` (same
      page, **Variables** tab). The name is shown at https://github.com/codespaces, or
      run `echo $CODESPACE_NAME` in the codespace terminal.
   4. **Actions → Scheduled payer check → Run workflow** to test it.

   Until `CODESPACE_NAME` is set, the workflow skips itself. A codespace that isn't used
   for 30 days is deleted by GitHub, along with its database.

## Connecting Cowork

With the app running, point Cowork at:

- **`/api/feed?format=md`:** the full compiled feed as readable text. It ends with
  instructions for acting on it.
- **`/api/feed`:** the same feed as JSON.

The feed contains website changes to review (with what changed), action items, the
ranked needs-attention list with reasons, recent logged changes, watch-list status
(including errors), and every policy. Timestamps in the JSON are UTC (ISO 8601); the
text version shows them in Central time.

Links in the feed use the address the feed was requested from. In a codespace they
use the codespace's forwarded address. Set `BASE_URL` (for example
`BASE_URL=https://policies.example-hospital.org`) to force a specific address.

After reviewing, Cowork (or you) can update the app through the API below. For
example, mark a website change reviewed, mark a policy reviewed, or complete its next
action.

## Settings

| Environment variable   | Default           | Purpose                                                  |
| ---------------------- | ----------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_TIME_ZONE` | `America/Chicago` | Time zone for dates, "today", and displayed times; set before `npm run build` |
| `CHECK_EVERY_HOURS`    | `24`              | How old a page's last check must be before it's due      |
| `BASE_URL`             | (request address) | Address used for links in the feed                        |
| `PORT`                 | `3000`            | Port the app listens on                                   |

Times are stored in UTC and always displayed in the configured time zone, whatever
the viewer's computer is set to.

## API

All routes return JSON and validate input.

| Method + path                                | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| `GET  /api/feed`                             | Compiled feed (JSON); add `?format=md` for text          |
| `GET/POST /api/watch`                        | List watched pages / add one (`payerId`, `url`, `label`) |
| `DELETE /api/watch/:id`                      | Stop watching a page (removes its detected changes)      |
| `POST /api/watch/check`                      | Check all pages now; `{"pageId": n}` for one; `{"due": true}` for due pages only |
| `POST /api/website-changes/:id/review`       | Mark a detected website change reviewed                  |
| `GET/POST /api/catalog`                      | List catalog payers / add them (`{"keys": [...]}`)       |
| `GET/POST /api/payers`                       | List / create payers (`name`, `type`, `website`, `pages`) |
| `GET/PUT/DELETE /api/payers/:id`             | Read / update / delete a payer                           |
| `GET/POST /api/policies`                     | List (filters: `search`, `payerId`, `category`) / create |
| `GET/PUT/DELETE /api/policies/:id`           | Read / update / delete                                   |
| `POST /api/policies/:id/review`              | Mark reviewed: next review = today + review interval     |
| `POST /api/policies/:id/action-done`         | Clear the next action and its due date                   |
| `GET/POST /api/policies/:id/changes`         | List / log a change (`changeDate`, `summary`)            |

Payer `pages` are extra policy pages to watch: an array or newline-separated text, each
`https://…` or `Label | https://…`.

Policy fields: `payerId`, `title`, `category`, `impact` (High/Medium/Low),
`effectiveDate`, `nextReviewDate` (YYYY-MM-DD), `sourceUrl`, `watchDocument`
(true/false), `summary`, `reviewEveryMonths` (1, 3, 6, 12, 24), `owner`, `nextAction`,
`actionDue` (YYYY-MM-DD). PUT replaces every field, so send the full record.

## Run it in GitHub Codespaces

**Code → Codespaces → Create codespace on main.** The app installs, starts, and opens
in the browser. See **Scheduled checks** above to keep the watcher running while the
codespace sleeps.

## Tech

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, SQLite via
`better-sqlite3`, and `cheerio` for reading payer pages.

```
app/                    Pages and API routes
components/             Forms, lists, badges
instrumentation*.ts     Starts the page-check schedule when the server starts
lib/
  db.ts                 SQLite connection, schema, upgrades, sample data
  catalog.ts            Missouri / national payers and their verified policy pages
  catalog-install.ts    Adds catalog payers and pages to the database
  repo.ts               Policies, payers, logged changes, reviews, actions
  watch.ts              Watch list, page checks, change detection, schedule
  extract.ts            Fetches a page, reduces it to links + text, normalizes URLs
  feed.ts               The compiled feed (JSON and text)
  origin.ts             Public address for feed links
  format.ts             Dates and times in the configured time zone
  board.ts, priority.ts "Needs attention" ranking and action items
  validate.ts           Input validation
scripts/
  check-due.ts          Checks due pages (for schedulers)
  check-links.ts        Verifies catalog URLs
.github/workflows/      Scheduled payer check, Verify payer links
```
