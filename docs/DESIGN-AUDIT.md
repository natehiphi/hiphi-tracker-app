# Where the apps stand against the standard

Measured 2026-09-19 against `DESIGN.md`. This is the companion document: `DESIGN.md` is what the apps
should be, this is what they are, and the gap list at the foot is the backlog between them.

Re-measure with `python3 tests/density.py` (serve first: `python3 -m http.server 8832`).

---

## 1. The system as built

### Tokens — `pub/base.css`

Shared by the **public tracker** and **Staff v2**. The old staff app does not use them (gap G-6).

- **Blue ramp** `--p50 #EDF9FF` … `--p900 #093546`, with `--p700 #00698E` as the action colour.
- **Orange** `--o50/200/400/600/700` — celebration and achievement only.
- **Neutrals** `--n0 #FFFFFF`, `--n50`, `--n100`, `--n200`, `--n300`, `--n400 #7D8C93`, `--n500`,
  `--n700`, `--n900 #142B35`.
- **Meaning** ok / warn / bad, each a wash plus a text colour.
- **Type** Roboto 700 headings, Lato body. Sizes 13/14/16/18/22/28.
- **Space** 4/8/12/16/24/32/48, `--gutter` 16px (24 on desktop).
- **Shape** radius 8/12/16 and a pill; three shadow levels.
- **Frame** header 56px, tab bar 64px, iOS safe-area insets.

### Contrast, verified

Computed from the tokens with the WCAG 2.2 relative-luminance formula. **The palette is in good
shape**: everything used as body text passes AA, and most passes AAA.

| Pair | Ratio | As body text | As 18px+/icon/border |
|---|---|---|---|
| `--n900` on white | 14.72 | AAA | AAA |
| `--n700` on white | 9.57 | AAA | AAA |
| `--n500` on white | 5.22 | AA | AAA |
| `--n500` on `--n50` | 4.85 | AA | AAA |
| **`--n400` on white** | **3.47** | **fails** | AA |
| `--p700` on white (links, actions) | 6.16 | AA | AAA |
| `--p700` on `--p50` (selected tab) | 5.74 | AA | AAA |
| white on `--p700` (primary button) | 6.16 | AA | AAA |
| white on `--p500` | 3.13 | fails | AA |
| ok text on ok wash | 6.48 | AA | AAA |
| warn text on warn wash | 5.00 | AA | AAA |
| bad text on bad wash | 5.00 | AA | AAA |
| `--o700` on `--o50` | 5.81 | AA | AAA |
| `--n400` as a field/chip border | 3.47 | — | **AA (passes 1.4.11)** |
| `--n200` as a card/row border | 1.30 | — | decorative, exempt |

**Two things that look like bugs and are not**, recorded so nobody "fixes" them:
- Form fields and chips border with `--n400`, not `--n200`. That is deliberate and correct: a control
  boundary needs 3:1 under WCAG 1.4.11, and `--n400` is the lightest neutral that clears it.
- Card and row borders use `--n200` at 1.30:1. Those are decorative containers, not control
  boundaries, so no contrast minimum applies.

### Type scale in practice

No screen invents a size. Public screens use up to 6 (13→28); Staff v2 holds to 5 (13→22), as its own
header comment promises. Measured: every screen is within A-4.

---

## 2. Measured, 2026-09-20 (after the redesign pass)

`arrival` = px to the thing the person came for (A-1: budget 320, limit 400).
`kinds` = distinct competing controls **in the content region** (A-2: budget 15, limit 25).
`nav` = persistent furniture (sidebar, header, tab bar), counted separately and judged by B-13.

| App | Width | Screen | Arrival | all | kinds | nav | sizes | colours |
|---|---|---|---|---|---|---|---|---|
| public | 390 | start | 342 | 8 | 7 | 1 | 4 | 5 |
| public | 390 | home | **225** | 9 | **3** | 6 | 6 | 6 |
| public | 390 | my issues (9/21) | **205** | 16 | **2** | 6 | 6 | 5 |
| public | 390 | category (9/21) | 379 | 14 | **3** | 6 | 5 | 6 |
| public | 390 | issue (9/21) | **204** | 12 | **3** | 6 | 5 | 6 |
| public | 390 | find | **258** | 13 | **2** | 6 | 5 | 2 |
| public | 390 | bill | **236** | 10 | **8** | 2 | 6 | 6 |
| public | 390 | legislators | 382 | 11 | **5** | 6 | 4 | 3 |
| public | 390 | more | **165** | 17 | **1** | 6 | 4 | 2 |
| staff2 | 390 | today (9/21, R-022) | **260** | 20 | **4** | 6 | 5 | 9 |
| staff2 | 390 | bills | 386 | 26 | **12** | 5 | 4 | 5 |
| staff2 | 390 | bill | **178** | 19 | **11** | 7 | 4 | 7 |
| staff2 | 390 | testimony tab (9/21) | **154** | 21 | **10** | 8 | 4 | 6 |
| staff2 | 390 | legislators | **244** | 19 | **6** | 6 | 3 | 4 |
| staff2 | 390 | outreach | **257** | 26 | **12** | 6 | 3 | 4 |
| staff2 | 390 | coalitions (9/21) | **211** | 18 | **6** | 6 | 2 | 4 |
| staff2 | 390 | one coalition (9/21) | 349 | 12 | **3** | 7 | 4 | 5 |
| staff2 | 390 | hearing (9/21) | **308** | 15 | **6** | 7 | 4 | 5 |
| public | 1440 | start | **144** | 12 | **11** | 1 | 5 | 5 |
| public | 1440 | home | **218** | 11 | **5** | 6 | 6 | 7 |
| public | 1440 | my issues (9/21) | **246** | 16 | **2** | 6 | 6 | 5 |
| public | 1440 | category (9/21) | 397 | 18 | **3** | 6 | 5 | 6 |
| public | 1440 | issue (9/21) | **260** | 12 | **3** | 6 | 5 | 6 |
| public | 1440 | find | **310** | 15 | **2** | 6 | 5 | 2 |
| public | 1440 | bill | **220** | 17 | **10** | 6 | 6 | 6 |
| public | 1440 | legislators | 390 | 11 | **5** | 6 | 4 | 3 |
| public | 1440 | more | **197** | 16 | **1** | 6 | 5 | 2 |
| staff2 | 1440 | today (9/21, R-022) | **290** | 44 | **11** | 12 | 5 | 9 |
| staff2 | 1440 | week (9/21, R-022) | 348 | 39 | **15** | 12 | 5 | 8 |
| staff2 | 1440 | bills | 364 | 90 | **15** | 13 | 5 | 5 |
| staff2 | 1440 | bill (9/21, R-022) | **269** | 37 | 24 | 13 | 5 | 7 |
| staff2 | 1440 | testimony tab (9/21) | 466 | 33 | 17 | 13 | 5 | 6 |
| staff2 | 1440 | legislators | **294** | 35 | **7** | 11 | 4 | 4 |
| staff2 | 1440 | outreach | **295** | 55 | **8** | 16 | 4 | 6 |
| staff2 | 1440 | coalitions (9/21) | **210** | 30 | **1** | 16 | 3 | 4 |
| staff2 | 1440 | one coalition (9/21) | 335 | 39 | **10** | 16 | 5 | 5 |
| staff2 | 1440 | hearing (9/21) | **313** | 26 | **7** | 11 | 5 | 5 |

Bold = inside budget. **Every screen in both apps is now inside the A-2 content-control budget**, and
seven readings sit between the arrival budget and the limit (G-8). Nothing in either app exceeds a limit.

**Public rows re-measured 2026-09-21 after R-018** (people follow issues): My bills became My issues, one
row per issue (the reading is its first issue); the category and issue pages are new. The category page's
first issue was at 485px on a phone before its icon moved beside the title and a count said twice went
(A-14); it now sits between the budget and the limit, below a full-width "Follow all" that is the page's
other job.

**Staff bill page re-measured 2026-09-21 with its fifth tab, Testimony (R-027).** On a phone the tab opens with its strip
under the header, so the first testimony is at 154px. On a laptop it is at 466px, over the A-1 limit, and that is the
bill page rather than the tab: the bill's heading, ribbon and status sit above all five tabs (the strip ends at 410px),
so every tab's content starts under it, Overview's first heading at 434, Activity 458, Pathway 497, Public 514,
Testimony's heading at 434. Not an accepted exception; a question for Nate if it bothers anyone: a tab reached by a
link could bring its strip to the top on a laptop too, as it does on a phone. The bill's own kinds went from 18 to
20 at 1440 since 9/20 (the issue line and the fifth tab), now between the A-2 budget and the limit.

**Staff v2 re-measured 2026-09-21 after R-022** (the staff review's waves 1-3, backend HANDOFF 3.19; new rows for the
coalition pages and the hearing page). Every reading is inside its limit. Today's first item on a phone now starts
higher, at 260px (it was 294: your own tasks come first); on a laptop lower, at 290 (it was 214), still inside the
budget, under the email-paused note and the new Mine | Team row. Three readings sit between the A-1 budget and the limit: the Week view at 1440 (348, the "This week" heading
and the Then row above the grid), one coalition on a phone (349, its heading, owner line and "Write a partner update"
come first) and the Testimony tab at 1440 (unchanged, above). The bill page at 1440 has 24 kinds of control against a
limit of 25 (it was 20): "Send a teammate…", the hearing page link and the Following line were added on Next up, the
Stage row went. The next control added to the bill page's first screen has to replace one.

Journeys (`tests/journeys.py`): **7 of 7 working and inside budget** ("arrive → follow a first issue", 3 of 3).

## 2a. Two measurements that were wrong, and what they cost

Recorded because a tool that cries wolf is worse than no tool, and both of these would have sent a
session to "fix" something that was not broken.

**The first My bills reading (427px phone / 490px desktop) was taken with four followed bills that
were all `dead`** in the frozen demo session, picked by id order without checking. The screen was
correctly drawing its end-of-session state. With live bills the same screen measured **157px** — the
best in the public app. *But the defect was real anyway*, for a different reason: in that all-stopped
state the screen rendered an empty-state box, filled call to action and all, on top of a list that was
not empty. That is a state most followers are in for much of the year. Fixed; 427 → 232.

**The bill page's "30 competing controls" (G-4) was 18 content controls plus 13 sidebar entries.**
A-2 was counting persistent navigation — identical on every screen, learned once, then ignored — as
competing decisions, which made every desktop screen look thirteen controls worse than it was. The
rule and the tool now count the content region and report navigation separately. The bill page at 18
is over the budget of 15 and well inside the limit of 25: a backlog item, not a defect.

## 3. Gaps — the backlog

### Closed on 2026-09-20
- **G-2** — My bills printed an empty state over a populated list. Fixed: 427 → 232px.
- **G-4** — substantially a measurement artefact (see 2a). What was real — a duplicate
  "File at the Capitol" link, and a status sentence repeating the hearing card — is fixed. 18 kinds.
- **G-5** — the stage ribbon's end labels were `--n400` at 13px (3.47:1). Now `--n500` (4.85:1), and
  they no longer vanish below 420px, where they had left a phone reader twelve unlabelled dashes.
- **G-1** — flow had no measurement. `tests/journeys.py` now walks seven journeys and counts steps.

### Still open
**G-3 — 23 breakpoints, two colliding at 360px.** The apps use 280, 340, 359, 360, 379, 380, 399,
420, 599, 600, 640, 700, 720, 760, 899, 900, 999, 1000, 1099, 1100, 1359, 1400 and 1600. Three of
those — 360, 900, 1100 — are the documented system. **Both `max-width: 359px` (8 uses) and
`max-width: 360px` (3 uses) exist**, so at exactly 360, the most common Android viewport there is,
three files switch to their small layout and five do not. Not started; it is a careful sweep, not a
patch.

**G-6 — the old staff app is a third design system.** `styles.css` (2,445 lines) never loads
`pub/base.css`; it defines `--teal`, `--gold`, `--navy`, `--violet`. The app the team uses every day
is teal while the public page and Staff v2 are HIPHI blue. Out of scope by Nate's instruction
(2026-09-19: change Staff v2 and the public tracker only). This is the Staff v2 decision wearing
different clothes — if the team moves, it closes by deletion.

**G-7 — four screens carry more than seven text colours.** Staff Today (9 at 1440, 8 at 390), the
staff bill page (7), public home (8 at 1440, 7 at 390). Worth a look rather than an alarm: four of
those are the neutral ramp before any meaning colour is spent. The staff Week view, rebuilt 9/21 (R-025), is at 8: three neutrals,
the two blues of the selected "Week" and the Today marker, and red (overdue), amber (due within 24 hours) and green
("already filed"), each with its words.

**G-8 — five screens between the arrival budget and the limit.** public start 378/144, public
legislators 382/390, public find 339 (desktop), public home 314/316, staff Bills 386/364. Staff Bills
is an accepted exception. One fresh observation: public start's 378 includes ~28px of the `?demo=1`
sandbox banner, so real production arrival is nearer 350.
*9/21, after R-018:* start 378 → 342, home 314/316 → 225/218 and find 339 → 310 are inside budget or
closer; the new category page adds two readings, 379 (phone) and 397 (desktop), its first issue sitting
under a full-width "Follow all".

**G-9 — hooks warn, they do not block.** Nate's choice (2026-09-19). Three are live: JS that does not
parse, staff data-layer parity, and the `?v=` bumps on a snapshot change.

**G-11 (new) — the public Legislators screen does two jobs.** Its own sentence needs an "and": find
*your* two legislators, and browse all 51. That is why it arrives at 382/390 and why its desktop half
is empty. B-1 says that is two screens. Not started — it is a product call.

**G-12 (new) — the public bill page's primary action is a bare `mailto:`.** The identically worded,
identically styled offer on home opens an in-app composer. Same app, same sentence, two different
things happen, and one of them throws a first-time visitor into a mail app they may not have set up.
Not started.

**G-13 (new) — Capitol jargon sits in the staff app's own chrome with no gloss.** "2nd triple filing",
"2nd Lateral", "stop 1 of 2", "2nd Decking". Help's first topic is a fourteen-term glossary, which
under P-4 is the tell: the glossary exists because the screens do not teach. The bill page already
proves it can be done in six words ("reach the last committee by this date"); Today and Bills do not.

## 4. Accepted exceptions

| Screen | Rule | Value | Why, and when decided |
|---|---|---|---|
| Staff Bills, phone | A-1 arrival | 386px | 3.1y measured three options at 320×568 and Nate picked hiding the strip below 360px. Going lower costs the "where every bill stands" counts, which he asked for. 2026-09-19. |
| Desktop Bills | phone/desktop parity | three quick filter chips kept | On desktop they share a line with the totals and cost no vertical space. Nate has a standing offer to make them match. 2026-09-19. |
| ~~Today, filled buttons per screenful~~ | A-3 | — | **Resolved 2026-09-20: Nate amended the rule.** A-3 now permits one primary repeated per item in a list of equivalent items. Today is compliant as built; no exception needed. |
