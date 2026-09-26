# hiphi-tracker-app (frontend) — Claude Code instructions

Public repo `natehiphi/hiphi-tracker-app`, deployed by GitHub Pages from `main` at
https://natehiphi.github.io/hiphi-tracker-app/. The backend (schema, migrations, sync, runbooks, `HANDOFF.md`) is
the private repo in `../backend`. **Read `../backend/HANDOFF.md` first** in any session: section 3 holds the
newest entries (3.19, 3.18, …) with every decision Nate has made and what is still open.

## Who this is for

Nate Hix runs a real advocacy team (11 staff) on a real legislative calendar. He is a non-developer, does not
use the terminal, and reviews on his phone AND a laptop. He wants direct answers, working software, and
screenshots for anything visual. When he says something is bad, fix it rather than defend it. He approves
direction; Claude builds, tests, pushes and verifies the published site.

## Where things stand (2026-09-21)

**Staff v2 is the staff app, at the old address (R-022, 9/21; `../backend/HANDOFF.md` 3.19).** `index.html` and
`staff.html` are the same page (both load `staff/app.js`), so every bookmark, Slack link and email link opens Staff v2
without a redirect. The old staff app is at `classic.html` for a week as a way back (until about 9/28; its avatar
menu in Staff v2 is "Open the old app"), then its code is deleted. Old links are mapped by the router (`#emails` ->
`#/review`, `#calendar=msg` -> `#/me`, `#bill=` as before). The same build added conversations with legislators
filed by issue, a hearing page, coalition pages, and the Today and Week rework from the staff review (3.13).

**People follow ISSUES, not bills (R-018, built 9/21; `../backend/HANDOFF.md` 3.14).** Six categories group
91 issues (migration 063: `categories`, `issues`, `issue_categories`, `bill_issues`, `issue_follows`,
`category_follows`, `bill_skips`, and the internal `follow_set` view that alerts and counts read). A person
follows an issue, or a whole category ("Follow all" also brings issues HIPHI takes up there later), and every
bill HIPHI takes a position on that is on a followed issue reaches them; following one bill still works, and
"Not for me" drops one bill without leaving its issue. In `pub/core.js`: `S.watch` = bills followed on their
own (`S.direct`) + the bills of followed issues and categories for `followYear()` - `S.skips`
(`recomputeWatch`); `issueFollowed`, `issueBills`, `viaIssue`, `setFollows`, `unfollowIssue`. Signed out, follows
live in localStorage (`hiphi_issue_follows`, `hiphi_cat_follows`, `hiphi_skips`, `_demo` in the sandbox). The
first visit's first two screens are categories -> "Your issues"; the tab is **My issues** (one row per issue,
`issueItem` in `pub/mybills.js`, shared with Find); Find has category and issue pages (`#/find/category/<key>`,
`#/issue/<slug>`); a bill page says "Part of <issue>". Staff keep the list in Staff v2, Outreach > Issues
(`staff/issues.js`). The first list came from the team's nicknames: `../backend/docs/issues_2026.json`, loaded with
`node ../backend/tools/apply_issues.js` (it never overwrites wording staff have edited).

**The first visit was rebuilt 9/21 (R-023; `../backend/HANDOFF.md` 3.25, the plan and every decision in
`../backend/docs/FIRST-VISIT-PLAN.md`, the approved prototype in `../backend/docs/first-visit-prototype/`).** `pub/start.js`,
with three named parts at the top ("Your issues · How it works · Stay connected": a signpost, never a bar or a counter):
topics (six tiles, most important first) -> "Your issues" (the top four per category by importance, then "Show N more";
importance uses `public_issues.top_priority` and the staff switch `issues.first_visit`, migration 066) -> the "Mahalo!"
moment -> "Where do you stand?" (at most three cards, one at a time) -> three lessons on the person's own bill
(`pub/lessons.js`: reading a bill, the session, a hearing; stepped with the primary button, every word visible, DESIGN
C-12) -> the "Now you know how it works" moment -> who speaks for you (street address only) -> "Coming up on your
issues", THEN the one email ask with the first name -> "You're all set" (the peak) -> Home, which says "Aloha" and shows
the week's first hearing with "See how to help". A newcomer who opens a shared bill gets a "New here?" card on the bill
page (`newcomer()` in `pub/bill.js`: the easiest action, "Follow this issue", "Not now"); `wiz().via` then runs the
shorter flow on that bill. Motion and celebration are `pub/fx.js` (`burst`, `celebrate`, `travel`, `swap`; DESIGN A-10
and C-7 rewritten 9/21). The visit is counted privately by `pub/visitlog.js` (`log_first_visit`, migrations 067-068;
staff see it in Outreach > Issues > First visit). Testimony is "due", never "closes", in the first visit (late testimony
is still taken, marked late).

**Until `classic.html` is deleted, data-layer changes still go into both staff apps** (`app.js` and `staff/data.js`,
checked with `node staff/tools/parity.mjs`).

## The three apps (all in this repo, all static, no build step)

| App | Entry | Code | Who |
|---|---|---|---|
| Public tracker | `track.html` | `pub/` | residents new to advocacy |
| Staff v2, the staff app | `index.html` = `staff.html` | `staff/` | the team, from 9/21 |
| Old staff app | `classic.html` | `app.js`, `styles.css`, `simple.css`, `stops.js` | a way back, until about 9/28 |

**The old address is Staff v2 (Nate, 9/21: "make the old webpage be the new site").** Keep `index.html` and
`staff.html` identical (same stylesheets, same script). Until `classic.html` and its code are deleted, every
data-layer change still goes into BOTH (see "Two staff apps" below). `APP_URL` in `staff/data.js` is the folder
itself, so links made by either app open the root.

`public.html` + `public.js` is an older public page that is still live and out of scope (Nate has been asked
whether it should redirect to `track.html`). `mockup-hybrid.html` is a reference mock.

## The sandbox: `?demo=1`

Every app has it. The real 2026 session frozen at **Mon 16 Mar 2026, 9:00 HST**, loaded from
`demo/snapshot.json`; nothing is saved and nothing reaches Supabase. Use it for ALL UI work while the live
session is dark (until January 2027).
- Public: `&season=off` (imagined end of session), `&seed=1` (sample past actions).
- Staff v2: `&as=LR` (Lauren), `&as=KV` (Kevin, regular teammate), `&as=JS` (Jess, reviewer), `&as=KR` (Kris,
  supports every coalition), `&as=SY` (Saya, supports CTFH); default is Nate (admin). The avatar menu has "Practise
  as someone else". `&season=off` shows the between-sessions app. The sandbox follows live rules: drafts only on
  bills with a position, messages only to the people they are for, email shown paused.
- The snapshot is fetched with `cache: 'force-cache'` plus `?v=20260921n`. **Whenever `demo/snapshot.json`
  changes, bump that `v` in `app.js`, `staff/data.js` and `pub/core.js` in the same commit**, or browsers keep
  the old copy and Nate reports the change as not working.
- Rebuild: `node ../backend/tools/build_snapshot.js` (reads production; read-only).

## Shared rules for all three

**Read `docs/DESIGN.md` before any design decision.** It is the written standard - Part A how a screen looks,
Part B how a person moves through it, Part C the first visit and the email ask - and every rule has an id
(`A-1`, `B-4`, `C-2`) and a reason. Cite the ids in commit messages. `docs/DESIGN-AUDIT.md` records where the
apps stand against it today, the verified contrast table, the gap backlog (G-1...G-10) and the accepted
exceptions - check it before "fixing" something that was decided on purpose. A rule that is wrong gets changed
in the same commit as the code, never quietly skipped. The `design-review` skill (in `../backend/.claude/skills/`,
found because sessions start in the backend repo) walks the whole checklist.


- Vanilla ES modules, template literals, one state object `S`, `render()` redraws. No bundler, npm, Tailwind or
  framework. Supabase client comes from jsdelivr at runtime. Real project ref and publishable key are in
  `app.js`, `staff/data.js`, `pub/core.js`, `public.js`; never replace them with placeholders.
- **No emoji in the public page or Staff v2.** Icons are Lucide via `icons.js`; add with
  `node tools/icons.mjs name1,name2`.
- **Bill names:** lead with `bills.nickname` (about 40 characters, e.g. "Disposable vape ban"; all 248
  position bills have one, monitor-only bills have none), then the plain summary, and ALWAYS show the bill
  number. Staff edit a nickname in a bill's Public section in either staff app. As of 9/19 **every bill on the
  public page has a plain summary** — all 248 position bills and all 486 monitor bills (backend 3.1y). Monitor
  bills have no nickname and should not: a nickname is for a bill the team is campaigning on.
- Mobile and desktop are both first-class. Nate rejected "a wide mobile version" twice. Judge every screen at
  390×844, 320×640, 1440×900, 1280×800 and 1024×768: two columns with a side panel that stays in view, tables
  for collections, a readable column for forms and focused tasks, label-sized buttons beside each other, actions
  next to their content, hover and focus states, menus that open against their button.
- Accessibility: one exposed h1 per page, labels, `aria-pressed/expanded/sort`, 44px targets on touch widths,
  nothing by colour alone, reduced motion respected, no sideways page scroll.
- Never build anything that sends email while testing. **Email to the public is paused until Nate says so.**
- Street addresses are private to the person; staff see districts only.

## Public tracker (`track.html` + `pub/`)

Reads only `public_*` views and RPCs; no account needed; magic-link sign-in.
- `pub/app.js` frame + hash router (`#/`, `#/start/1-4`, `#/bills` (My issues), `#/find`, `#/find/category/<key>`,
  `#/issue/<slug>`, `#/find/issue/<slug>` (the old coalition-group page), `#/list/<slug>`, `#/bill/HB1563`, `#/legislators`, `#/legislator/<id>`, `#/more`, `#/help`, `#/signin`,
  `#/settings`, `#/privacy`; legacy `#bill=` links redirect). `pub/core.js` data + plain-language layer.
  `pub/ui.js`, `pub/actions.js` shared parts. One module + CSS per screen: `start`, `home`, `mybills`, `find`,
  `bill`, `people`, `more`, `helper`. `pub/art.js` drawings (`islands('oahu' | 'mauicounty' | …)`).
- Design system `pub/base.css`: HIPHI blue ramp `--p50..--p900` (`--p700 #00698E`), orange for celebration
  only, red for danger only, Roboto 700 / Lato, type sizes 13/14/16/18/22/28 (36 only `h1.hero` on desktop).
  `pub/wide.css` (loaded last): 900 and 1100px breakpoints, 1120px frame, `.cols` + sticky `.side`, `.grid2/3`.
  Each screen keeps its own desktop rules in its own CSS.
- Screen contract: `{ tab, tabs?, noTabs?, title?, render(route), wire(route), bar?(route) }`. Screens reach
  the frame through `app.render / app.go / app.openHelper` on the `app` object exported by `core.js`.
- **The header search suggests as you type (R-032, 9/21).** From 900px the header box lists what the words so far
  match, seven rows at most, then "See all results" (Find). A word search lists policies: issues (a matching topic
  first), with a bill on an issue shown as that issue, so a House bill and its Senate twin are one row; then HIPHI's
  bills on no issue and, beside them, the session's other bills (Nate, 9/26: search every bill). A bill number lists
  every bill with it. The database search takes the 80 most recently active other bills, not the first 80 by number. The
  behaviour is `pub/suggest.js`, a combobox written for both apps' header boxes: arrow keys, Enter, Esc, ARIA, only the
  rows the window has room for, the list kept in place (dimmed) while the database answers, and what was typed kept
  through a redraw, since both frames rebuild the header on every render. What matches is `headerSuggest()` in
  `find.js`, on Find's own `parse`/`rank`/`serverSearch`. No list on Find itself or on a phone, where Find's results
  appear as you type. The `.sg` styles live in `base.css`, which Staff v2 loads too; a host's icon rule must not reach
  them (the magnifier's is `.hdr .hsearch > .ic`).
- Nate's product rules (9/19):
  1. A first visit is follow a few issues + maybe say where you stand (R-018, 9/21: people follow issues, and
     bills reach them through the issue). No action is pushed. Later visits prompt
     actions easiest first (`actionCard`: "Send a quick email · 2 min" until the first action, then testimony).
     Someone whose stance differs from HIPHI's (`agrees(b) === false`) is sent to the Capitol's own form.
  2. The email ask is a step in the flow (`sendEmailLink`); giving it is the consent for both hearing alerts
     AND HIPHI's own advocacy alerts, in one "keep me updated" opt-in (Nate, 9/20, HANDOFF 3.5 - this reverses
     the earlier rule that action alerts stayed a separate, off-by-default choice). One ask per visit, always
     skippable. An existing account only ever GAINS choices from an ask, never loses one. Email to the public
     stays paused regardless of what an ask would consent to.
  3. Progress is the person's own. Community numbers appear only inside one bill or hearing, from 10 people.
- Parked at Nate's request: exact YouTube hearing links (needs a YouTube Data API key in Settings).

## Staff v2 (`staff.html` + `staff/`)

Task-first. Tabs: Today, Bills, Legislators, Outreach. `staff/app.js` frame + router (`parseRoute`), `staff/ui.js`
shared parts, `staff/staff.css` + `staff/css/*.css`, one module per screen (`today`, `review`, `bill` with
`activity` `public` `pathway` `testimony` (R-027), `bills` with `filters` `bulk`, `triage`, `memo`, `search`, `legislators`,
`legislator`, `supporters`, `person`, `issues` (Outreach > Issues and `#/issue/:id`, R-018), `lists`, `list`,
`emails`, `composer`, `me`, `setup`, `help`, and from R-022 `hearing` (`#/hearing/:id`, one committee sitting) and
`coalition` (`#/coalition`, `#/coalition/:id`, Outreach > Coalitions)), plus
`look.js` (the quick look, opened from Today and Bills) and `conversation.js` (conversations with legislators), which are
components rather than screens.
- **Sort new bills lists the untracked bills people follow (R-059, 9/26; migration 074 `triage_followed()`).** A panel
  under the card, "Followed on the public tracker", most followed first; "Sort it" puts one on the card, decided like any
  new bill. A bill set aside comes back only when someone follows it after that decision. Only follows made from an
  account count (a browser-only follow never reaches the database). The sandbox shows sample counts (`DB.triageFollowed`).
- **The header search suggests as you type (R-032, 9/21),** from 900px, through the public header's `pub/suggest.js`:
  `headerHits()` in `search.js` lists tracked bills whose number or shown name match (a leading number first, moving
  bills before dead ones), bills not tracked yet (`DB.searchUntracked`, which matches every word in the title or
  official description, 9/26; a row opens Search at that bill, where its Track button is, since the bill page knows
  only tracked bills), issues, legislators (`matchLegs`) and supporters (loaded on first use), a row for each kind
  in turn up to seven, then "See all results" into Search, which also has untracked bills. Enter with nothing
  highlighted keeps `exactBill`: an exact number opens that bill. No list on the Search page itself. "sd 12" and
  "house 3" mean that district for supporters too (`districtQ`, exported from `legislators.js`).
- Bill page tabs: Overview, Activity, Pathway, Public, Testimony (keys 1-5). Testimony lists every testimony draft the
  tracker made that someone sent for review: this bill's filed ones and its companion's, then its issue's, a search,
  then its category folded. `onNextUp` (testimony.js) decides what the Next up card keeps, so a filed draft shows once.
  Hearings load for 60 days; `DB.loadDraftHearings()` fetches the older ones drafts point to. The tab strip fits five
  tabs by its own width (container `bwtabs` in bill.css), never wrapping one out of sight.
- Look: `pub/base.css` tokens, five type sizes 13/14/16/18/22.
- Desktop frame: from 1100px a left sidebar; 900–1099px header tabs; below that the phone frame. A screen's
  default export may set `wide` (whole window: tables) or `narrow` (760px: review, forms); default 1120px. The
  action bar is the last child of `<main>` and sits under its content on wide screens. Layout helpers
  `.sv-cols` + `.sv-aside`, `.sv-grid2/3`. The frame redraws when the window crosses 900 or 1100px.
- `menuSheet` / `pickerSheet` open against the clicked button on desktop (arrow keys, Home/End, Esc). Real forms
  use `openSheet`. Never `window.confirm`; use `confirmSheet`.
- **Bills on a phone (9/19, backend 3.1y).** Three control rows became two and 505px above the first bill became
  386. What holds it there: no quick filter chips (all three live in Filter, and `sheetOn` therefore includes the
  quick specs on a phone so a filter set in the sheet can be taken off without reopening it); the "where every
  bill stands" strip is a flat scrolling row with an inline `bl-stlab` label, hidden below 360px; the header's
  magnifier is hidden on any screen carrying its own `.bl-search`; and each row is a `.bl-prow` — the `<a>` row
  plus a `bl-plk` chevron beside it, because the button cannot nest inside the link. Desktop keeps the chips, its
  header search and the eye button, and none of these rules touch it.
- **Every keydown shortcut must check `keysOn()`** (My settings has the switch) and ignore typing in fields.
  No single-letter shortcut may do anything that cannot be undone. Approve is Shift+A.
- **Approve is guarded** (`staff/review.js`): one-second arming after an item appears, a confirm for supporter
  emails, Undo for 10 seconds via `DB.transition(billId, id, 'unapprove')` / `DB.alertStep(id, 'unapprove')`
  (backend migration 058). Give any new approval the same Undo.
- Unsaved work: a screen registers `(S.leaveGuards ??= []).push(proceed => boolean)`; the frame's `go()` asks.
  See `composer.js` for catching link clicks, Back and reload.

### Shared pieces added 9/19 (use these rather than writing your own)

- `stageRibbon(bill)` and `urgentMark(iso)` in `ui.js`. The ribbon is the Introduced → … → Law strip (handles
  stopped, vetoed and a team stage override); the mark is the block-shaped countdown that leads a Today card.
  Both carry an icon and words, never colour alone.
- `openLook(bill, { list, index })` in `look.js` — the quick look: a bill's facts and next step in a panel over
  the page. 900px and two columns on a desktop, the ordinary bottom sheet on a phone. `j`/`k` walk `list`,
  Enter opens the full page, Esc and Back close it. **Read-and-act only** — put no form in it, or it starts
  fighting the leave guards. The bill's own page stays the truth; this is the shortcut.
- `sessionClock(bills)` and `suggestions(bills, { cap, skip })` in `model.js`, with `setSugg(key, state)` for
  `done` / `later` / `never`. Rules live in `suggestions()`; add one there rather than in a screen.
- `DB.patchPrefs(patch)` merges one corner of `advocates.prefs` and saves it. Use it for anything that should
  follow a person between laptop and phone ("Seen", suggestion snoozes, saved views). `prefs` already has the
  column grant and the `staff_self_update` policy, so **no migration is needed** to add a key.
- CSS: `.sv-stick` on a card inside a `.sv-aside` holds it in view while the rest of the panel scrolls with the
  page; `.sv-scrolly` for a panel that genuinely must scroll (reserves a gutter and fades its last line). The
  aside itself is no longer a `max-height` + `overflow:auto` box: that box was hiding the bill page's "Key
  facts" card behind an inner scrollbar nobody could see.
- A toast raised while a sheet is open is appended INTO the sheet (`ui.js`). An open `<dialog>` is in the
  browser's top layer, so an Undo left in `#toast` underneath it can be read but never clicked.

### Shared pieces added 9/21 (R-022; backend HANDOFF 3.19)

- **Conversations with legislators are filed by issue** (`conversation.js`; migration 064): `logConversation({ bill,
  issueId, legislatorIds, text })` opens the dialog; `convSectionHTML` / `wireConvSection` draw a list for a bill (and
  its issues), a legislator or an issue. One meeting with three legislators is three `legislator_notes` rows sharing a
  `conversation_id`. `DB.conversations({ billId, issueIds })`, `DB.conversationRows(ids)`, `DB.addLegNote(legId,
  billId, body, { issueId, metOn, conversationId })`, `DB.updateLegNote(id, patch)` (refused after ten minutes, and the
  screen puts the note back), `DB.delLegNote`.
- **A hearing sitting** is every hearing row with the same committee and start time: `sittingOf(h)`, `agendaOf(h)`,
  `goersOf(rows)`, `goingWords` in `hearing.js`. "Going" is written on ONE row per sitting and read for the whole
  sitting, so a person is one Slack message, not one per bill. `DB.attend(hearingId, on, who = S.me.id)`; an admin may
  set anyone (064), and the database sends the Slack message; the screen only says so in its toast.
- **Handing work to one person**: change `bill_todos.assignee_id` or add `hearing_attendance` and the database sends
  the Slack message (064 `notify_assignment`); undone within two minutes, nobody is told (065). Never broadcast.
- `model.js`: `exactBill(q)` (an exact bill number opens the bill from any search box), `noticeByFor(stop)` (when the
  hearing notice must post, the 48-hour rule), `sessionClock(list).then` (the deadline after next, same shape),
  `plainAction(text)` and `OUT_PLAIN` (the Capitol's actions in plain words, once for every screen). Countdowns in
  `ui.js` round down, never up.
- `advocates.prefs` keys: `coalitions` (`'all'` or campaign ids: the coalitions a person supports; Kris all, Saya
  CTFH), `showMonitor` (Today shows hearings on monitor bills), `memo` (the memo's audience and coalition), plus
  `seen`, `sugg`, `views`.
- The header search is `pub/suggest.js` since R-032 (above); an exact bill number plus Enter still opens the bill
  (`exactBill`).

### Rules the suggestion feed must keep (Nate, 9/19)

Today's promise is a list you can clear. Suggestions are fenced off from it and must stay that way:
at most `SUGGEST_CAP` (5), **never counted in the Today badge**, never the word "due" or "overdue", never an
`urgentMark`. Every card prints its `why` line verbatim — that line is how someone spots that the app does not
know Kevin already rang the chair. Every card can be finished, put off for a fortnight, or refused for that bill
for good, each with Undo; since R-022 the three sit in the card's "…" menu beside one button (A-20). The heading says
"Nothing urgent" only on a day with nothing due at all; when a suggestion races this week's deadline it says "Worth
doing this week", and the P1 chair ask stays a dated task (Nate declined making it dated for every bill, 9/21). "Done" also writes the step onto the bill's timeline (`DB.addActivity`), deferred for
the life of the toast so Undo can cancel it; there is no call that removes an activity row.

## Two staff apps, one data layer

`staff/data.js` and `staff/model.js` are hand copies of `app.js`'s data layer and helpers.
- After ANY change to a Supabase call or shared helper, make the same change in both, then run
  `node staff/tools/parity.mjs` (must print `parity ok`).
- **Supabase hands back at most 1,000 rows per request** (the API's Max rows) and says nothing when it cuts:
  `.limit(2000)` still gets 1,000. A load that can grow goes through `allRows(o => S.supa.from('t').select('...', o)...)`
  (both files) and orders by something unique, ending with `id` or the primary key, or a row can repeat or fall
  between pages. Measured 9/21 (backend HANDOFF 3.20, R-034): in session the 60-day hearings load holds up to 4,000
  rows, and tracked bills pass 1,000 once 2027's are added to 2026's. The public page asks by id in slices
  (`inChunks`) or with a limit of 1,000 at most.
- Both write only these `bills` columns: `tracked`, `position`, `priority`, `stage_override`, `internal_notes`,
  `is_public`, `public_summary`, `public_action`, `public_action_until`, `nickname`. The database grants UPDATE
  column by column; a new column needs a migration first (see backend 057) or saves fail with
  "permission denied". That is the design working.
- Current app pitfall: `styles.css` has a global `input,select,textarea{width:100%}`; give new inputs in a
  flex or grid row an explicit width.

## Tests (`tests/`, Playwright for Python; output goes to `tests/out/`, git-ignored)

Serve first: `python3 -m http.server 8832` in this folder.
```bash
python3 tests/public_journey.py     # public: 408 checks, phone + desktop, the first visit (R-023) and a shared bill, ladder, off-season
python3 tests/staff_desktop.py      # Staff v2: 503 checks at 5 sizes, Approve guards, menus, loading state
python3 tests/staff_flows.py        # Staff v2: 181 flow checks + data-layer parity
python3 tests/staff_clock.py        # Staff v2 Today: the Next deadline button, 89 checks (yours, a teammate's list, a quiet day)
python3 tests/staff_week.py         # Staff v2 Today's Week view (R-025): three kinds in time order, each deadline on its day, counts that agree with the side panel
python3 tests/density.py            # arrival px, competing controls, sizes, colours - DESIGN.md A-1/A-2/A-4/A-5
python3 tests/suggest.py            # header search suggestions (R-032), both apps: 190 checks at 1024-1440 and short windows, keys, redraw, live bills
python3 tests/staff_followed.py     # Sort new bills: the untracked bills the public follows (R-059), 40 checks at four sizes
python3 tests/staff_firstvisit.py   # Staff v2's First visit pages and the "Show in the first visit" switch (R-023): 212 checks at four sizes
python3 tests/visitlog.py           # the private first-visit counting (pub/visitlog.js): 36 checks, every Supabase request intercepted
```
Hash-only navigation does not reload in Playwright: `goto` then `reload()`, then wait about 2.5s.
`public_journey.py` and `staff_desktop.py` print one `net::ERR_FAILED` / `Failed to fetch` in their `errors:`
line, from `demoLoad` in `pub/core.js`. It is the harness aborting the in-flight 5MB `snapshot.json` fetch when a
case reloads, not a regression — it appears with any snapshot, and a plain load of the same page has a clean
console. Checked 9/19 against both the old and new snapshot. Investigate only if the count changes.
A check that fails after an intended change is a test to update, not a reason to revert; say which and why.

## Before every push to main

1. `node --check` every JS file touched; `node staff/tools/parity.mjs` if a staff data layer changed.
2. Run the test file(s) for what changed and LOOK at phone and desktop screenshots. Several bad UIs shipped
   when this was skipped.
3. `git diff --stat`: only the files you meant.
4. Commit (end the message with the attribution line the session gives you), push, wait for Pages (about a
   minute), then load the published page and confirm no console errors. Nate has said: push live as you go.
5. Record the work in `../backend/HANDOFF.md` (a new 3.1x entry) and push the backend too.

## Working with parallel agents

**Say this in every brief: no git command that changes the working tree.** On 9/19 an agent ran `git stash` to
get a clean baseline and wiped 18 modified files belonging to four agents at once. Nothing was lost, but only
after an hour of recovery from the stash and a dangling commit. Forbidden in both repos: `git stash`, `git
reset`, `git checkout -- <path>`, `git restore`, `git clean`, `git revert`, `git rebase`. Read-only git is fine.
An agent that wants a clean baseline copies the file to its own scratch directory. Before a big parallel job,
take a copy of the tree outside the repo; you will be glad of it.

Big UI jobs here were done as: foundation by hand (shared files), then one agent per screen group owning
only its own files, with a written brief (design rules, what changed in shared files, exact fixes, how to
test, "look at your screenshots"), then integration and a full test pass. Agents ask for shared-file changes
in their report instead of editing them. If agents die on a spend limit, `node --check` their files and
resume them by id rather than respawning.

## Open items

Nate's, not code's — do not start any of these without him:
1. **Staff v2 is at the old address (9/21).** Left: from about 9/28, delete `classic.html` and the old app's code
   and make `staff/data.js` the only data layer, which retires `parity.mjs` and the 67-call hand copy with it
   (backend REQUESTS R-010). One real password reset confirms the Supabase redirect needs nothing (R-002).
2. Parked at Nate's request (9/19): rehearsing the January session flip. The 2027 calendar load itself is not
   parked — it has to happen before Wed 20 Jan 2027.
3. Should `public.html` (the old public page, still live) redirect to `track.html`?
4. Content: **closed 9/19.** Every public bill has a plain summary; HB 1779 is cleaned up.
5. Parked at his request: exact YouTube hearing links (needs a YouTube Data API key in Settings).

Known gaps, small and recorded rather than hidden:
- A suggestion marked Done writes to the bill's timeline after a 10-second delay so Undo can cancel it. Switch
  tabs and come back inside those ten seconds and Undo restores the card, but the timeline line is already
  written. Fixable only by adding a call that removes an `activity_log` row.
- The staff bill page carries 30 different controls on one desktop screenful against a limit of 25
  (`docs/DESIGN-AUDIT.md` gap G-4), and public "My bills" starts its first bill 427px down on a phone,
  490px on desktop, against a 400px limit (gap G-2). Both are recorded defects, neither is started.
