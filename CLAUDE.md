# hiphi-tracker-app (frontend) — Claude Code instructions

Public repo, deployed by GitHub Pages from `main`. Static staff app and
public page for the HIPHI Bill Tracker. The backend (schema, sync,
runbooks, `HANDOFF.md`) is in `../backend`. **Read `../backend/HANDOFF.md`
first** in any session that touches this repo.

## Files

- `index.html` + `app.js` (~110KB, ~1670 lines) + `styles.css` — staff app.
  Views: Portfolio · Pipeline · Table · Desk · Cards · Add. Desk is being
  grown into the single consolidated page (see `../backend/docs/`).
- `track.html` + `track.js` + `track.css` — public watch app (any bill,
  magic-link accounts, email alerts). Reads only `public_*` views.
- `public.html` + `public.js` — login-free public page. Reads only the
  `public_bills` / `public_hearings` views. **Out of scope until the staff
  consolidation lands.**
- `mockup-hybrid.html` — static design mock, reference only.
- `?demo=1` — training sandbox on both `index.html` and `track.html`: the
  real 2026 session frozen at Monday March 16, 2026, 9:00 HST, loaded from
  `demo/snapshot.json` (built by `Bill-Tracker/tools/build_snapshot.js`).
  Real bills, owners, coalitions and schedules; stage, hearings and deadline
  deaths as they stood that day; drafts, to-dos, follows and attendance are
  seeded in `demoInit()`. Use it for all UI work while the live session is
  dark (until January 2027).

Lines 6–7 of `app.js` and the top of `public.js` hold the real Supabase
project ref and publishable key. The scrubbed export that circulated has
placeholders there — never copy that export's files over these.

## No build, no framework

Vanilla JS, template literals, one global state object `S`, `render()`
re-draws everything. `app.js` is loaded as an ES module. Supabase client
is imported from jsdelivr at runtime. Tailwind, bundlers, and npm are not
in play; don't introduce them.

## Before every push to main

1. `node --check app.js` (and `public.js` if touched).
2. Serve the folder and screenshot at **desktop and mobile** widths:
   ```bash
   python3 ../backend/tools/screenshot_desk.py .
   ```
   (adapt the script to the view you changed). Several bad UIs shipped
   because this step was skipped. The Desk title bug lived for weeks
   until a screenshot exposed a 900px-wide checkbox.
3. `git diff --stat` — confirm only the files you meant to change.
4. Push. Pages rebuilds in ~1 min; tell Nate to hard-refresh
   (Cmd/Ctrl+Shift+R) because `app.js` is cached.

Known pitfall: `styles.css` line 13 is a global
`input,select,textarea{…width:100%}`. Any new `<input>` inside a flex or
grid row needs an explicit width or it will eat the row.

## Staff app writes

`app.js` writes these `bills` columns and no others: `tracked`, `position`,
`priority`, `stage_override`, `internal_notes`, `is_public`,
`public_summary`, `public_action`, `public_action_until`. Migration 002
locks the grant to exactly this list. If you add a write to a new column,
the grant has to change first or the save will fail with a permissions
error — that's the design working, not a bug.

## January flip

Until migration 002 + Phase B7 land, three constants must be edited by
hand each December: `SESSION_YEAR` (top of file), `SESSION_OVER` and
`DEADLINES` (Cards-view block), and the same two in `public.js`. See
`../backend/JANUARY.md`. After 002/B7, these come from the `sessions` and
`session_deadlines` tables and the code edit goes away.

## Nate

Mobile first — he lives on the phone in the field. If it works at 390px it
works. Ask for screenshots when he reports a UI problem.
