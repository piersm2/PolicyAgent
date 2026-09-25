# PolicyAgent — Payer Policy Compiler

Compiles health-plan payer policy information into one feed that Cowork (or any
tool) can read:

- **Payer websites:** the app watches payer policy and bulletin pages and records
  what changed: new or removed documents and links, and text added or removed.
- **Your policies:** the policies and changes you enter, ranked by what needs
  attention first.
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

The first run creates `data/policyagent.db` with 6 sample payers, 10 policies, and one
watched page per payer. Delete that file to start over.

## Screens

- **Home:** website changes waiting for review, the ranked **Needs attention** list,
  and recent logged changes. **Open feed** shows the compiled feed.
- **Policies:** search and filter; add, edit, delete; each policy's page has its
  change history.
- **Payers:** the payers you track.
- **Watch list:** the payer pages being checked, with each one's last result.
  Add pages, check now, or remove them.

A policy's status is automatic: **Upcoming** until its effective date, then **Active**.

## Watching payer websites

While the app is running, it checks each watched page about 15 seconds after it
starts and then once every 24 hours. Set the `CHECK_EVERY_HOURS` environment
variable to change the interval. You can also click **Check all now** on the Watch
list.

- **The first check records a starting point.** Changes are reported from the next
  check on.
- **For HTML pages** it compares the page's links and text, ignoring menus, headers,
  footers, and scripts. A new bulletin PDF shows up as a new link.
- **For PDFs and other files** it reports that the document changed.
- **Pages that can't be checked** show why on the Watch list and in the feed. Some
  payer sites block automated requests; others build their content with JavaScript or
  require a login. Those need a person, or Cowork in a browser, to review.

Each detected change stays in **Website changes to review** until it's marked reviewed.

## Connecting Cowork

With the app running, point Cowork at:

- **`http://localhost:3000/api/feed?format=md`:** the full compiled feed as readable
  text. It ends with instructions for acting on it.
- **`http://localhost:3000/api/feed`:** the same feed as JSON.

The feed contains website changes to review (with what changed), the ranked needs-attention
list with reasons, recent logged changes, watch-list status (including errors), and
every policy.

`localhost` only works on the computer running the app. If Cowork can't fetch the
link directly, have it open the link in its browser.

After reviewing, Cowork (or you) can update the app through the API below. For
example, mark a website change reviewed, or log what it means as a change on a policy.

## API

All routes return JSON and validate input.

| Method + path                                | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| `GET  /api/feed`                             | Compiled feed (JSON); add `?format=md` for text          |
| `GET/POST /api/watch`                        | List watched pages / add one (`payerId`, `url`, `label`) |
| `DELETE /api/watch/:id`                      | Stop watching a page (removes its detected changes)      |
| `POST /api/watch/check`                      | Check all pages now, or one with `{"pageId": n}`         |
| `POST /api/website-changes/:id/review`       | Mark a detected website change reviewed                  |
| `GET/POST /api/payers`                       | List / create payers (`name`, `type`, `website`)         |
| `GET/PUT/DELETE /api/payers/:id`             | Read / update / delete a payer                           |
| `GET/POST /api/policies`                     | List (filters: `search`, `payerId`, `category`) / create |
| `GET/PUT/DELETE /api/policies/:id`           | Read (with changes) / update / delete                    |
| `GET/POST /api/policies/:id/changes`         | List / log a change (`changeDate`, `summary`)            |

Policy fields: `payerId`, `title`, `category`, `impact` (High/Medium/Low),
`effectiveDate`, `nextReviewDate` (YYYY-MM-DD), `sourceUrl`, `summary`. PUT replaces
every field, so send the full record.

## Run it in GitHub Codespaces

**Code → Codespaces → Create codespace on main.** The app installs, starts, and opens
in the browser. A codespace stops after about 30 minutes idle, so for a feed Cowork
can rely on, run the app on your computer instead.

## Tech

Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, SQLite via
`better-sqlite3`, and `cheerio` for reading payer pages.

```
app/                    Pages and API routes
components/             Forms, lists, badges
instrumentation*.ts     Starts the page-check schedule when the server starts
lib/
  db.ts                 SQLite connection, schema, upgrades, sample data
  repo.ts               Policies, payers, logged changes
  watch.ts              Watch list, page checks, change detection, schedule
  extract.ts            Fetches a page and reduces it to links + text
  feed.ts               The compiled feed (JSON and text)
  board.ts, priority.ts "Needs attention" ranking
  validate.ts           Input validation
```
