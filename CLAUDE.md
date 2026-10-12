# hiphi-tracker-app (frontend): Claude Code instructions

Public repo `natehiphi/hiphi-tracker-app`, deployed by GitHub Pages from `main` at
https://natehiphi.github.io/hiphi-tracker-app/. The backend (schema, migrations, sync, runbooks, `HANDOFF.md`, the items in
`work/`) is the private repo in `../backend`; its CLAUDE.md says how work flows (the items, the build brief, the lock, the
three lanes) and holds the rules that bind both repos. This file is the frontend's rules and where to look; it is short on
purpose (R-230). **The map of the code is `docs/MAP.md`**, moved out of here word for word: where things stand, the three
apps, the sandbox (`?demo=1`), the public tracker, Staff v2, the two staff apps on one data layer, and the tests with their
commands. Read the part your task needs.

**The plan of record until the 2027 session: `../backend/docs/ASSESSMENT-2026-09.md`** (R-096: the whole-project
assessment of 29 Sep 2026 and Nate's 15 decisions of 30 Sep): its section 9 lists every recommendation for the public
page and the staff app and where it stands. Put a new screen or feature on that board before building it; the freeze
dates (no new "try both" versions from 15 Oct 2026, no new features from 1 Dec 2026) and the caps on what waits for Nate
are in the backend CLAUDE.md (rule 13 and the caps bullet). The newest decisions are the items in `../backend/work/`
(`node tools/work.js show R-0NN`) and `../backend/HANDOFF.md` section 3.

## Who this is for

Nate Hix runs a real advocacy team (11 staff) on a real legislative calendar. He is a non-developer, does not
use the terminal, and reviews on his phone AND a laptop. He wants direct answers, working software, and
screenshots for anything visual. When he says something is bad, fix it rather than defend it. He approves
direction; Claude builds, tests, pushes and verifies the published site.

**Every check comes with a link (R-161, Nate 10/5):** "anytime there is a need for me to check something, ensure a
link is provided for me to access where it would be checked." Whenever you ask him to check or decide something,
give the clickable address of the exact screen in the same message (the published page or the practice copy, for
example `https://natehiphi.github.io/hiphi-tracker-app/track.html?demo=1#/bill/HB1523`), opened by you first; never
"open the staff app" without the address. The REQUESTS.md item gets the same link on its `**Where to check:**` line.

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
- **Bill names:** lead with `bills.nickname` (about 40 characters, e.g. "Disposable e-cigarette ban"; all 248
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

## Before every push to main

1. `node --experimental-default-type=module --check` every JS file touched (plain `node --check` reads these files as
   CommonJS and let a duplicate `const` through on 9/27, which broke the public page in the tests); `node
   staff/tools/parity.mjs` if a staff data layer changed.
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
