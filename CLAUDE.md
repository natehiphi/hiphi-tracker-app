# hiphi-tracker-app (frontend) — Claude Code instructions

Public repo `natehiphi/hiphi-tracker-app`, deployed by GitHub Pages from `main` at
https://natehiphi.github.io/hiphi-tracker-app/. The backend (schema, migrations, sync, runbooks, `HANDOFF.md`) is
the private repo in `../backend`. **Read `../backend/HANDOFF.md` first** in any session: section 3 holds the
newest entries (3.1w, 3.1v, …) with every decision Nate has made and what is still open.

## Who this is for

Nate Hix runs a real advocacy team (11 staff) on a real legislative calendar. He is a non-developer, does not
use the terminal, and reviews on his phone AND a laptop. He wants direct answers, working software, and
screenshots for anything visual. When he says something is bad, fix it rather than defend it. He approves
direction; Claude builds, tests, pushes and verifies the published site.

## Where things stand (2026-09-19, after 3.1x)

Both staff apps were assessed side by side and **Staff v2 was recommended**; Nate then had the whole
improvement list built except "show the draft inside Review" (not wanted) and the Bills list-detail split
(dropped once the quick look covered the same need). All of it is shipped and live. **Nate is now trying it and
has not yet said whether the team switches.** Nothing is waiting on code; see "Open items" at the foot of this
file and `../backend/HANDOFF.md` 3.1x.

## The three apps (all in this repo, all static, no build step)

| App | Entry | Code | Who |
|---|---|---|---|
| Public tracker | `track.html` | `pub/` | residents new to advocacy |
| Staff app (current) | `index.html` | `app.js`, `styles.css`, `simple.css`, `stops.js` | the team today |
| Staff v2 | `staff.html` | `staff/` | the team, to compare |

**Both staff apps stay for now (Nate, 9/19); the team switches at some point.** Until then every data-layer
change goes into BOTH (see "Two staff apps" below). Links in Slack and email open the current app. If v2 is
chosen: add `staff.html` to the Supabase Auth redirect URLs, then delete the other app's screens.

`public.html` + `public.js` is an older public page that is still live and out of scope (Nate has been asked
whether it should redirect to `track.html`). `mockup-hybrid.html` is a reference mock.

## The sandbox: `?demo=1`

Every app has it. The real 2026 session frozen at **Mon 16 Mar 2026, 9:00 HST**, loaded from
`demo/snapshot.json`; nothing is saved and nothing reaches Supabase. Use it for ALL UI work while the live
session is dark (until January 2027).
- Public: `&season=off` (imagined end of session), `&seed=1` (sample past actions).
- Staff v2: `&as=KV` (Kevin, regular teammate), `&as=JS` (Jess, reviewer); default is Nate (admin).
- The snapshot is fetched with `cache: 'force-cache'` plus `?v=20260920`. **Whenever `demo/snapshot.json`
  changes, bump that `v` in `app.js`, `staff/data.js` and `pub/core.js` in the same commit**, or browsers keep
  the old copy and Nate reports the change as not working.
- Rebuild: `node ../backend/tools/build_snapshot.js` (reads production; read-only).

## Shared rules for all three

- Vanilla ES modules, template literals, one state object `S`, `render()` redraws. No bundler, npm, Tailwind or
  framework. Supabase client comes from jsdelivr at runtime. Real project ref and publishable key are in
  `app.js`, `staff/data.js`, `pub/core.js`, `public.js`; never replace them with placeholders.
- **No emoji in the public page or Staff v2.** Icons are Lucide via `icons.js`; add with
  `node tools/icons.mjs name1,name2`.
- **Bill names:** lead with `bills.nickname` (about 40 characters, e.g. "Disposable vape ban"; all 248
  position bills have one, monitor-only bills have none), then the plain summary, and ALWAYS show the bill
  number. Staff edit a nickname in a bill's Public section in either staff app.
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
- `pub/app.js` frame + hash router (`#/`, `#/start/1-4`, `#/bills`, `#/find`, `#/find/issue/<slug>`,
  `#/list/<slug>`, `#/bill/HB1563`, `#/legislators`, `#/legislator/<id>`, `#/more`, `#/help`, `#/signin`,
  `#/settings`, `#/privacy`; legacy `#bill=` links redirect). `pub/core.js` data + plain-language layer.
  `pub/ui.js`, `pub/actions.js` shared parts. One module + CSS per screen: `start`, `home`, `mybills`, `find`,
  `bill`, `people`, `more`, `helper`. `pub/art.js` drawings (`islands('oahu' | 'mauicounty' | …)`).
- Design system `pub/base.css`: HIPHI blue ramp `--p50..--p900` (`--p700 #00698E`), orange for celebration
  only, red for danger only, Roboto 700 / Lato, type sizes 13/14/16/18/22/28 (36 only `h1.hero` on desktop).
  `pub/wide.css` (loaded last): 900 and 1100px breakpoints, 1120px frame, `.cols` + sticky `.side`, `.grid2/3`.
  Each screen keeps its own desktop rules in its own CSS.
- Screen contract: `{ tab, tabs?, noTabs?, title?, render(route), wire(route), bar?(route) }`. Screens reach
  the frame through `app.render / app.go / app.openHelper` on the `app` object exported by `core.js`.
- Nate's product rules (9/19):
  1. A first visit is follow a few bills + maybe say where you stand. No action is pushed. Later visits prompt
     actions easiest first (`actionCard`: "Send a quick email · 2 min" until the first action, then testimony).
     Someone whose stance differs from HIPHI's (`agrees(b) === false`) is sent to the Capitol's own form.
  2. The email ask is a step in the flow (`sendEmailLink`); giving it is the consent for hearing alerts. One
     ask per visit, always skippable. HIPHI's own action alerts stay a separate choice, off by default. An
     existing account only ever GAINS choices from an ask.
  3. Progress is the person's own. Community numbers appear only inside one bill or hearing, from 10 people.
- Parked at Nate's request: exact YouTube hearing links (needs a YouTube Data API key in Settings).

## Staff v2 (`staff.html` + `staff/`)

Task-first. Tabs: Today, Bills, Legislators, Outreach. `staff/app.js` frame + router (`parseRoute`), `staff/ui.js`
shared parts, `staff/staff.css` + `staff/css/*.css`, one module per screen (`today`, `review`, `bill` with
`activity` `public` `pathway`, `bills` with `filters` `bulk`, `triage`, `memo`, `search`, `legislators`,
`legislator`, `supporters`, `person`, `lists`, `list`, `emails`, `composer`, `me`, `setup`, `help`), plus
`look.js` (the quick look, opened from Today and Bills) which is a component rather than a screen.
- Look: `pub/base.css` tokens, five type sizes 13/14/16/18/22.
- Desktop frame: from 1100px a left sidebar; 900–1099px header tabs; below that the phone frame. A screen's
  default export may set `wide` (whole window: tables) or `narrow` (760px: review, forms); default 1120px. The
  action bar is the last child of `<main>` and sits under its content on wide screens. Layout helpers
  `.sv-cols` + `.sv-aside`, `.sv-grid2/3`. The frame redraws when the window crosses 900 or 1100px.
- `menuSheet` / `pickerSheet` open against the clicked button on desktop (arrow keys, Home/End, Esc). Real forms
  use `openSheet`. Never `window.confirm`; use `confirmSheet`.
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

### Rules the suggestion feed must keep (Nate, 9/19)

Today's promise is a list you can clear. Suggestions are fenced off from it and must stay that way:
at most `SUGGEST_CAP` (5), **never counted in the Today badge**, never the word "due" or "overdue", never an
`urgentMark`. Every card prints its `why` line verbatim — that line is how someone spots that the app does not
know Kevin already rang the chair. Every card can be finished, put off for a fortnight, or refused for that bill
for good, each with Undo. "Done" also writes the step onto the bill's timeline (`DB.addActivity`), deferred for
the life of the toast so Undo can cancel it; there is no call that removes an activity row.

## Two staff apps, one data layer

`staff/data.js` and `staff/model.js` are hand copies of `app.js`'s data layer and helpers.
- After ANY change to a Supabase call or shared helper, make the same change in both, then run
  `node staff/tools/parity.mjs` (must print `parity ok`).
- Both write only these `bills` columns: `tracked`, `position`, `priority`, `stage_override`, `internal_notes`,
  `is_public`, `public_summary`, `public_action`, `public_action_until`, `nickname`. The database grants UPDATE
  column by column; a new column needs a migration first (see backend 057) or saves fail with
  "permission denied". That is the design working.
- Current app pitfall: `styles.css` has a global `input,select,textarea{width:100%}`; give new inputs in a
  flex or grid row an explicit width.

## Tests (`tests/`, Playwright for Python; output goes to `tests/out/`, git-ignored)

Serve first: `python3 -m http.server 8832` in this folder.
```bash
python3 tests/public_journey.py     # public: 254 checks, phone + desktop, first visit, ladder, off-season
python3 tests/staff_desktop.py      # Staff v2: 503 checks at 5 sizes, Approve guards, menus, loading state
python3 tests/staff_flows.py        # Staff v2: 181 flow checks + data-layer parity
```
Hash-only navigation does not reload in Playwright: `goto` then `reload()`, then wait about 2.5s.
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
1. **Does the team move to Staff v2?** If yes, in this order: add `staff.html` to the Supabase Auth redirect
   URLs (until then a password-reset link lands on the current app), point the Slack and email links at it,
   then delete the current app's screens and make `staff/data.js` the only data layer — which retires
   `parity.mjs` and the 67-call hand copy with it.
2. At 320px the Bills "where every bill stands" strip pushes the first group header just below the fold.
   Legible, 44px targets, no sideways scroll, but one short scroll to the first bill. Hide it below ~360px?
3. Should `public.html` (the old public page, still live) redirect to `track.html`?
4. Content: 69 of 248 position bills have no plain summary — the Today suggestion feed now raises these one at
   a time — and HB 1779's public summary still ends "Edited for testing."
5. Parked at his request: exact YouTube hearing links (needs a YouTube Data API key in Settings).

Known gaps, small and recorded rather than hidden:
- A suggestion marked Done writes to the bill's timeline after a 10-second delay so Undo can cancel it. Switch
  tabs and come back inside those ten seconds and Undo restores the card, but the timeline line is already
  written. Fixable only by adding a call that removes an `activity_log` row.
- No quick-look button on a phone Bills row: the row's end already carries position, P1 and the owner avatar,
  and a fourth 44px target crowds it. Tapping the row opens the bill, as before.
