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

## 2. Measured, 2026-09-19

`arrival` = px to the thing the person came for (A-1: budget 320, limit 400).
`all` / `kinds` = controls on the first screenful, total and distinct (A-2: budget 15, limit 25).

| App | Width | Screen | They came for | Arrival | all | kinds | sizes | colours |
|---|---|---|---|---|---|---|---|---|
| public | 390 | start | the first question | 378 | 9 | 9 | 4 | 5 |
| public | 390 | home | what needs you | **209** | 12 | 12 | 6 | 7 |
| public | 390 | mybills | a bill you follow | **427** | 16 | 9 | 5 | 4 |
| public | 390 | find | a way in | 287 | 12 | 8 | 5 | 2 |
| public | 390 | bill | what the bill does | **236** | 10 | 10 | 6 | 6 |
| public | 390 | legislators | your island | 382 | 11 | 11 | 4 | 3 |
| public | 390 | more | the first choice | **165** | 17 | 7 | 4 | 2 |
| staff2 | 390 | today | the first thing due | 294 | 23 | 10 | 4 | 8 |
| staff2 | 390 | bills | the first bill | 386 | 26 | 17 | 4 | 5 |
| staff2 | 390 | bill | the bill status | **178** | 21 | 20 | 4 | 7 |
| staff2 | 390 | legislators | the first legislator | **244** | 19 | 12 | 3 | 4 |
| staff2 | 390 | outreach | the first person | 257 | 24 | 16 | 3 | 4 |
| public | 1440 | start | the first question | **144** | 12 | 12 | 5 | 5 |
| public | 1440 | home | what needs you | **202** | 14 | 14 | 6 | 8 |
| public | 1440 | mybills | a bill you follow | **490** | 16 | 9 | 5 | 4 |
| public | 1440 | find | a way in | 339 | 18 | 7 | 5 | 2 |
| public | 1440 | bill | what the bill does | **220** | 17 | 16 | 6 | 6 |
| public | 1440 | legislators | your island | 390 | 11 | 11 | 4 | 3 |
| public | 1440 | more | the first choice | **197** | 16 | 7 | 5 | 2 |
| staff2 | 1440 | today | the first thing due | **214** | 51 | 22 | 4 | 9 |
| staff2 | 1440 | bills | the first bill | 364 | 90 | 27 | 5 | 5 |
| staff2 | 1440 | bill | the bill status | **269** | 31 | 30 | 5 | 8 |
| staff2 | 1440 | legislators | the first legislator | **294** | 35 | 17 | 4 | 4 |
| staff2 | 1440 | outreach | the first person | 295 | 53 | 21 | 4 | 6 |

Bold = within budget. **Staff Bills at 390 measures 386**, exactly the figure HANDOFF 3.1y recorded by
hand, which is the check that this tool measures the right thing.

**The 90 on staff Bills at 1440 is not a problem.** 90 controls but only 27 kinds: it is a table, and
twenty-five rows of the same offer is one decision repeated. That distinction is why A-2 is written
against kinds.

---

## 3. Gaps — the backlog

Ordered by how much they cost a real person. None of these is started; none needs a decision from Nate
except where it says so.

### G-1 — Flow has no measurement (Part B)
Part B is entirely enforced by review. There is no equivalent of `density.py` for journeys, so the
step budgets in B-2 are aspirations. **This is the biggest hole in the standard**, because flow is half
of what Nate asked for. Fix: a `tests/journeys.py` that walks each journey in B-2 and counts steps.
`public_journey.py` already walks much of the public side and could be extended rather than duplicated.

### G-2 — Public "My bills" breaks the arrival limit (A-1) — defect
427px on a phone, **490px on desktop**, against a limit of 400. The worst arrival anywhere in either
app, on the public page, for the screen whose entire job is showing the bills you follow. Worse than
the staff Bills screen that 3.1y spent a session bringing down to 386. Cause not yet diagnosed; the
screenshots are in `tests/out/density/public_*_mybills.png`.

### G-3 — 23 breakpoints, and two of them collide at 360px (A-9)
The apps use 23 distinct media-query breakpoints: 280, 340, 359, 360, 379, 380, 399, 420, 599, 600,
640, 700, 720, 760, 899, 900, 999, 1000, 1099, 1100, 1359, 1400 and 1600. Three of those — 360, 900
and 1100 — are the documented system; the other twenty grew ad hoc.
**Both `max-width: 359px` (8 uses) and `max-width: 360px` (3 uses) exist**, so at
exactly 360 — the most common Android viewport in the world — `pub/bill.css`, `staff/css/lists.css`
and `staff/css/supporters.css` switch to their small layout while `bills.css`, `today.css`,
`home.css`, `start.css` and `staff/css/bill.css` do not. This is disharmony with an exact cause.

### G-4 — The staff bill page has too many competing controls (A-2) — defect
**30 distinct kinds at 1440**, 20 at 390, against a limit of 25 and a budget of 15. The highest
anywhere, and almost nothing repeats — these are 30 genuinely different things asking for attention on
one screenful. Note this is the *bill page*, not the Bills list: the list measures well.

### G-5 — The stage ribbon's end labels fail contrast (A-7)
`.sv-riblab` (`staff/staff.css:237`) draws 13px text in `--n400` — 3.47:1, under the 4.5:1 floor. It is
the "Introduced" and "Law" labels flanking the ribbon; the bold middle is `--p800` and fine. Hidden
below 420px, so this affects tablet and desktop only. One-token fix: `--n500` gives 4.85:1.

### G-6 — The old staff app is a third design system
`styles.css` (2,445 lines) does not load `pub/base.css` and defines its own palette: `--teal #0E7C86`,
`--gold`, `--navy`, `--violet`. **The app the team uses every day is teal; the public page and Staff v2
are HIPHI blue.** Nothing in the standard applies to it, and bringing it in would be a rewrite.
*This is a decision for Nate, and it is really the Staff v2 question wearing different clothes*: if the
team moves to v2, this gap closes by deletion. Until then, one of the two staff apps will always be
outside the standard.

### G-7 — Four screens carry more than seven text colours (A-5)
Staff Today (9 at 1440, 8 at 390), the staff bill page (8 at 1440, 7 at 390) and public home (8 at
1440, 7 at 390). Worth a look rather than an alarm: the metric counts every distinct computed colour,
four of which are the neutral ramp before any meaning colour is spent.

### G-8 — Six screens sit between the arrival budget and the limit (A-1)
On the backlog, not defects: public start 378, public legislators 382/390, public find 339 (desktop),
staff Bills 386/364. **Staff Bills is an accepted exception** — 3.1y took it from 505 to 386 with a
measured three-way comparison and Nate picked the result. Recorded here so nobody reopens it without
knowing that.

### G-9 — Nothing is enforced automatically
No hooks exist, so every rule depends on the session remembering to run the review. Nate was offered
blocking vs warning hooks on 2026-09-19 and chose to see the standard first. The three worth having,
when he wants them: parity must pass when a staff data layer changes; the three `?v=` bumps must
accompany any `snapshot.json` change; `node --check` on every edited JS file.

### G-10 — The instructions drift, and have already drifted
`frontend/CLAUDE.md:223` still lists "No quick-look button on a phone Bills row" as a known gap. It
shipped on 2026-09-19 (`bl-plk`, `staff/bills.js:266`), and the same file describes the chevron
correctly 100 lines earlier. A session reading line 223 would "fix" something that is not broken.
Fix: the ship checklist should update the instructions in the same commit as the code.

---

## 4. Accepted exceptions

| Screen | Rule | Value | Why, and when decided |
|---|---|---|---|
| Staff Bills, phone | A-1 arrival | 386px | 3.1y measured three options at 320×568 and Nate picked hiding the strip below 360px. Taking it below 320 would cost the "where every bill stands" counts, which he asked for. 2026-09-19. |
| Desktop Bills | A-3 / parity with phone | three quick filter chips kept | On desktop they share a line with the totals and cost no vertical space. Nate has a standing offer to make phone and desktop match. 2026-09-19. |
