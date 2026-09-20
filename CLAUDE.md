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
- The snapshot is fetched with `cache: 'force-cache'` plus `?v=20260919`. **Whenever `demo/snapshot.json`
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
`legislator`, `supporters`, `person`, `lists`, `list`, `emails`, `composer`, `me`, `setup`, `help`).
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

Big UI jobs here were done as: foundation by hand (shared files), then one agent per screen group owning
only its own files, with a written brief (design rules, what changed in shared files, exact fixes, how to
test, "look at your screenshots"), then integration and a full test pass. Agents ask for shared-file changes
in their report instead of editing them. If agents die on a spend limit, `node --check` their files and
resume them by id rather than respawning.
