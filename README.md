# Payer Policy Watch

Compiles health-plan payer policy information into one feed that Cowork (or any
tool) can read:

- **Payer websites:** the app watches payer policy and bulletin pages, and each
  policy's own document, and records what changed: new or removed documents and
  links, and text added or removed.
- **Your policies:** the policies you track, with review dates, an owner, and the
  next action, ranked by what needs attention first.
- **Plain-language summaries (optional):** Claude reads each policy document and writes
  a brief, and explains each detected change and why it matters.
- **One feed:** everything compiled at `http://localhost:3000/api/feed`.

> Sample data is illustrative, not a substitute for each payer's official policy
> documentation.

## Run it on your computer

Requires **Node.js 20.18 or newer**. The current LTS from https://nodejs.org is fine.

**Windows:** download or clone this repo, then double-click **`Start Payer Policy Watch.cmd`**.
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
- **Policy page:** the **policy brief** (see below), **Edit**, **Mark reviewed** (records today's review and moves the
  next review date forward by the policy's review interval), **Open document**, the
  follow-up (owner, next action, due date, with **Done**), the document's watch status
  and any changes found in it, and the change history.
- **History:** policy changes imported from payers' past bulletins, month by month,
  and the import queue (see **Importing past bulletins**).
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
- **For PDFs and Word (.docx) files** it compares the document's text, so a change shows
  the lines added and removed. **Other files** are reported as changed.
- **Document landing pages** (like MO HealthNet's manual pages, which only link to the
  current .docx) are followed to the document, and its text is compared. A new version
  with a new file name also shows up as a new link.
- **Pages built by JavaScript:** when a page comes back nearly empty, the app loads it
  in a headless browser (Chromium) and reads it after its scripts run. The codespace
  and the Windows launcher install the browser; otherwise run `npm run install-browser`
  once. A page that's still nearly empty probably needs a login.
- **Pages that can't be checked** show why on the Watch list and in the feed. Some
  payer sites block automated requests or require a login. Those need a person, or
  Cowork in a browser, to review.

Each detected change stays in **Website changes to review** until it's marked reviewed.

### The payer catalog

`lib/catalog.ts` lists each catalog payer's policy pages. Every URL there is checked
from GitHub's network by the **Verify payer links** workflow when the catalog changes
and every Monday; a failed run means a payer moved a page. Run the same check
yourself with `npm run check-links`.

Some payer pages load their lists with JavaScript: WPS (Missouri's Medicare
contractor), the Medicare Coverage Database reports, Anthem Provider News, Healthy
Blue's policy search and news, and Humana's claims payment policies. With the page
reader installed you can add them on the Watch list, but they aren't in the catalog
because they haven't been verified yet.

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

## AI briefs and summaries

With an Anthropic API key, the app uses Claude (Claude Opus 5.5 by default) to write:

- **A brief on each policy page:** in short, key requirements, services and codes,
  what it means for us, what changed in the latest version, and the effective date and
  version the document states. It's written after the policy document's first check,
  rewritten whenever the document changes, and can be refreshed any time.
- **A summary of each detected change:** a headline, what changed, why it matters, a
  suggested next step, and a relevance rating. When a page adds a link to a new
  bulletin or policy, Claude reads the new document too.

Both appear in the app and in the feed. Summaries run in the background after each
check; **Write brief now** and **Summarize now** do it on demand.

### Turn it on

1. Create an API key at https://console.anthropic.com (**API keys**), and add credits
   under **Billing**.
2. Give the app the key:
   - **Codespaces:** at https://github.com/settings/codespaces, under **Codespaces
     secrets**, click **New secret**. Name it `ANTHROPIC_API_KEY`, paste the key, and
     give it access to this repository. Then stop and restart the codespace.
   - **On your computer:** create a file named `.env.local` in the app folder containing
     `ANTHROPIC_API_KEY=sk-ant-...` and restart the app.
3. On the Watch list, click **Check all now**. Briefs and summaries appear over the next
   few minutes.

### Cost and data

- Claude Opus 5.5 costs $4 per million input tokens and $20 per million output tokens.
  A brief of a typical 10-30 page policy uses roughly 10,000-40,000 input tokens, about
  $0.05-0.25; a change summary usually costs a few cents. Very long documents are read up
  to about 100,000 tokens (roughly $0.50 per brief), and the brief says so. The Watch list
  shows this month's count and estimated cost.
- At most 10 summaries are written per check run (`AI_MAX_PER_RUN`). A failed document
  isn't retried until it changes or you click **Try again**.
- `AI_MODEL=claude-sonnet-5-5` halves the price; quality on dense policies may drop.
- What's sent: the payer document or page text, the policy's title, payer, category, and
  **notes**. Keep patient information out of policy notes. Nothing else leaves the app.
- Summaries are AI-written. Check the document before acting on anything that affects
  payment.

## Daily Cowork task (no API key needed)

Without an Anthropic API key, a daily Claude Cowork task can do the reading instead,
using your Claude subscription. The **Cowork tasks** page (`/cowork`) lists the day's
work: policy briefs to write, website changes to summarize, and history imports queued
on the History page, with instructions and the exact result format. Cowork reads each
document, pastes its results into the page, and clicks **Save results**. Results are
stored exactly as if the app had called Claude: briefs on policy pages, summaries on
website changes, and imported history with matches added to tracked policies. The page
limits each day's work (5 briefs, 10 summaries, 10 bulletins), and the same list is at
`GET /api/cowork`.

Create a scheduled task in Cowork (daily, for example 7:30 AM) with this prompt, using
your codespace's name and address:

```
Daily Payer Policy Watch reading. Use Chrome, where I'm signed in to GitHub.
1. Open https://github.com/codespaces. If the codespace "<codespace-name>" isn't running,
   open it in the browser and wait until its terminal shows "Ready" (up to 3 minutes).
   Leave that tab open.
2. Open https://<codespace-name>-3000.app.github.dev/cowork. If GitHub shows a
   "Continue" page, click Continue. If the page doesn't load, wait a minute and retry,
   up to 5 times.
3. Follow the instructions on that page: do the tasks up to the limits shown, paste the
   results JSON into the Results box, and click Save results. Fix and re-save anything
   it lists as an error.
4. Reply with a short summary: briefs written, changes summarized, bulletins imported,
   and anything you couldn't open.
```

## Importing past bulletins

The **History** page pulls policy changes out of payers' past bulletins and notices
(for example UHC's monthly policy update bulletins, CMS transmittals, Aetna OfficeLink,
Home State Health notices). With an Anthropic API key the app does the import itself,
as below. Without one, **Queue for Cowork** hands it to the daily Cowork task, which
reads up to 10 bulletins a day.

1. Tick the watched listing pages to import from, pick the period (12 months by
   default), and click **Find past bulletins**. Claude reads each page, and up to three
   of its archive pages, and picks out the documents published in that period.
2. Each page shows how many documents it found and the estimated cost. Click **Start
   import** (or **Start all**).
3. Documents are read one at a time in the background. Claude lists each policy change
   in them: policy, type (new, revised, retired, reimbursement, prior authorization,
   coverage, coding), effective date, summary, and relevance. Changes rated not
   relevant are dropped.
4. Changes that match a policy you track are added to its change history with a link to
   the bulletin. **Track** starts tracking any other policy in the list.

The queue survives restarts: an interrupted import continues when the app starts again,
and the daily scheduled check works through `IMPORT_PER_RUN` documents when the app
is closed. **Cancel**, **Resume**, and **Retry failed** are on each import. A document
already imported for a payer isn't read again. Estimates assume about 30,000 tokens per
document (about $0.18 on Claude Opus 5.5); long monthly bulletins cost more, which the
"up to" figure allows for. Twelve months of UHC's three monthly bulletins is about 36
documents.

## Connecting Cowork

With the app running, point Cowork at:

- **`/api/feed?format=md`:** the full compiled feed as readable text. It ends with
  instructions for acting on it.
- **`/api/feed`:** the same feed as JSON.

The feed contains website changes to review (with what changed), action items, the
ranked needs-attention list with reasons, recent logged changes, imported bulletin
history from the last 90 days, watch-list status (including errors), and every policy. Timestamps in the JSON are UTC (ISO 8601); the
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
| `RENDER_JS_PAGES`      | `1`               | `0` turns off loading nearly empty pages in a browser     |
| `CHROMIUM_PATH`        | (installed one)   | Use a specific Chrome/Chromium for the page reader        |
| `ANTHROPIC_API_KEY`    | (none)            | Turns on AI briefs and change summaries                   |
| `AI_MODEL`             | `claude-opus-5-5` | Claude model for briefs and summaries                     |
| `AI_EFFORT`            | `medium`          | `low` to `max`; higher is more thorough and costs more    |
| `AI_MAX_PER_RUN`       | `10`              | Most briefs/summaries written after one check run         |
| `IMPORT_PER_RUN`       | `20`              | Import steps the scheduled check runs when the app is closed |
| `ORGANIZATION_PROFILE` | rural Missouri hospital | Who "us" is in briefs, e.g. services and main payers |

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
| `POST /api/website-changes/:id/summarize`    | Have Claude summarize a detected change now              |
| `GET/POST /api/catalog`                      | List catalog payers / add them (`{"keys": [...]}`)       |
| `GET/POST /api/payers`                       | List / create payers (`name`, `type`, `website`, `pages`) |
| `GET/PUT/DELETE /api/payers/:id`             | Read / update / delete a payer                           |
| `GET/POST /api/policies`                     | List (filters: `search`, `payerId`, `category`) / create |
| `GET/PUT/DELETE /api/policies/:id`           | Read / update / delete                                   |
| `POST /api/policies/:id/review`              | Mark reviewed: next review = today + review interval     |
| `POST /api/policies/:id/action-done`         | Clear the next action and its due date                   |
| `GET/POST /api/policies/:id/brief`           | Read the policy brief / write or refresh it now          |
| `GET/POST /api/policies/:id/changes`         | List / log a change (`changeDate`, `summary`)            |
| `GET /api/history`                           | Imported changes (`payerId`, `relevance`=high/medium/all, `q`, `since`, `limit`) |
| `GET/POST /api/history/jobs`                 | List imports / queue one per page (`{"pageIds":[..],"months":12}`) |
| `POST /api/history/jobs/:id`                 | `{"action": "start" \| "cancel" \| "retry"}`             |
| `POST /api/history/start-all`                | Start every import that has found its documents          |
| `POST /api/history/entries/:id/track`        | Start tracking the policy an imported change is about    |
| `GET /api/cowork`                            | The day's reading tasks for Cowork, with the result format |
| `POST /api/cowork/results`                   | Save Cowork's briefs, summaries, and imported bulletins  |

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
  extract.ts            Fetches pages, PDFs, and Word files (headless browser for JavaScript
                        pages), reduces them to links + text, normalizes URLs
  feed.ts               The compiled feed (JSON and text)
  ai.ts                 Claude API client (structured replies, errors, cost estimate)
  summaries.ts          Policy briefs, change summaries, background queue
  history.ts            Historical import: find past bulletins, extract changes, queue
  cowork.ts             Daily task list for Cowork and saving its results
  origin.ts             Public address for feed links
  format.ts             Dates and times in the configured time zone
  board.ts, priority.ts "Needs attention" ranking and action items
  validate.ts           Input validation
scripts/
  check-due.ts          Checks due pages (for schedulers)
  check-links.ts        Verifies catalog URLs
.github/workflows/      Scheduled payer check, Verify payer links
```
