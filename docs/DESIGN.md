# The HIPHI design standard

How every screen in the public tracker and the staff apps should look, how a person should move
through them, and what a first visit must feel like. Written 2026-09-19.

This document exists because until now there wasn't one. Design decisions were made from judgement
and from Nate's reaction to a screenshot, which worked, but left nothing a new session could check
itself against and no reason attached to any rule. A rule without its reason cannot be applied to a
screen it did not anticipate.

**What it is for.** Nate's goal, in his words: *incredibly clean, user friendly, best practice; no
disharmony, no lost elegance; nobody overwhelmed; smooth, streamlined; a joyous, positive and easy
first visit.* Everything below is an attempt to make that checkable by somebody other than Nate.

---

## How to use this

1. **Cite a rule when you make a design decision.** Every rule has an id (`A-1`, `B-4`, `C-2`).
   Commit messages and HANDOFF entries say which rules a change serves or breaks. That is the whole
   mechanism by which "best practice is referenced in every design choice" becomes true rather than
   claimed.
2. **A rule you disagree with is a rule to change, not to skip.** Open the document, change the rule,
   say why in the commit. A standard that gets quietly ignored is worse than none, because it lies.
3. **Every rule carries its reason.** The reason is the part that generalises to a screen this
   document never imagined. If you cannot see how a reason applies, that is the thing to raise.
4. **Budgets are two-tier.** A *budget* is the target; being over it puts the screen on the backlog in
   `DESIGN-AUDIT.md`. A *limit* is never to be exceeded; being over it is a defect to fix now.
5. `/design-review` runs this document against a screen. `python3 tests/density.py` produces the
   numbers. `DESIGN-AUDIT.md` records where the apps stand against it today.

## The sources

These are the references every rule below is answerable to. Where they disagree, the order here is
the order of precedence.

| Source | What it governs here | Why this one |
|---|---|---|
| **WCAG 2.2 level AA** (W3C) | Contrast, target size, focus, motion, error identification | The accessibility floor. Not negotiable, and the right floor for a public-health body's public page. |
| **GOV.UK Service Manual & Design System** | One thing per page, plain language, service-shaped flows, consent | The closest thing in the world to this product: a public service used by ordinary people, often under stress, often on an old phone. Their evidence base is public and enormous. |
| **Nielsen Norman Group — 10 usability heuristics** | Visibility of system status, undo, error recovery, recognition over recall | The standard vocabulary for flow problems. Rules in Part B mostly name one. |
| **Apple Human Interface Guidelines** | iOS conventions: navigation, sheets, back, touch | Nate and the team review on iPhones. |
| **Material Design 3** | Android conventions, filter chips, bottom navigation | 360px is the most common Android viewport in the world; the public page must be right there. |
| **Hick's law; Fitts's law** | The choice budget (A-2) and target sizes (A-6) | The two places where "overwhelming" and "fiddly" have actual arithmetic behind them. |

---

## Part 0 — the three promises

Everything else is these three made specific. When two rules collide, the promise decides.

- **P-1 — Say the thing they came for, first.** Every screen exists to deliver one thing. That thing
  appears before anything that helps you find, filter, sort or act on it. Chrome earns its place; content
  does not have to.
- **P-2 — One decision at a time.** A person should never have to hold more than one question in their
  head. Competing choices, competing colours and competing urgencies are all the same failure.
- **P-3 — Nothing is a trap.** Every step can be undone, skipped, or left. Nobody is ever stuck, and
  nobody is ever punished for trying something.

---

## Part A — Look

### A-1 Arrival: the thing they came for starts within 320px

**Budget 320px. Limit 400px.** At any width, measured from the top of the viewport to the top of the
first real item. Every screen must be able to name what the person came for; `tests/density.py` holds
that name per screen, and a screen nobody can write one for is a screen that does not know its job.

*Reason.* On a 390×844 phone, 320px is around 38% of the screen: past that, the first thing you came
for is below the halfway line and the screen reads as a wall. This is the number behind Nate's
"everything above the bill takes up far too much space". GOV.UK's "one thing per page" is the same
idea stated as structure rather than pixels.

*How to check.* `python3 tests/density.py`.

### A-2 Choice: at most 15 different kinds of control on the first screenful

**Budget 15 kinds. Limit 25 kinds.** Count distinct kinds, not instances — twenty-five rows of a bill
table are one decision repeated, not twenty-five decisions. `density.py` reports both.

*Reason.* Hick's law: the time to choose grows with the number of competing alternatives. Repetition
does not compete with itself; a list is easy to scan precisely because every row is the same offer.
The number that hurts is how many *different* things are asking for attention at once.

### A-3 One primary action per screen

At most one filled/primary button in view. Everything else is secondary, tertiary or a plain link. If
two things both feel primary, the screen is doing two jobs and should be split.

*Reason.* NN/g and GOV.UK both: a primary action that has to compete is no longer a primary action.

### A-4 Five type sizes on a staff screen, six on a public one

Staff: 13/14/16/18/22. Public: those plus 28 (and 36 only for `h1.hero` on desktop). Sizes come from
the tokens in `pub/base.css`; no screen invents one.

*Reason.* A type scale is what makes a hierarchy legible without thinking. Every extra size makes the
hierarchy flatter, not richer, because it makes the differences smaller. Five steps is enough for
title / section / body / label / caption, which is every job a screen here has.

### A-5 Colour carries meaning, and never carries it alone

Blue `--p700` is action, links and selection. Red `--bad-text` is danger and overdue. Amber is due
within 24 hours. Orange is celebration and achievement only — and *only* those. Every state that a
colour indicates also has words or a shape (WCAG 1.4.1). **Distinct text colours in view: aim for 7 or
fewer**, remembering four of those are the neutral ramp before any meaning colour is spent.

*Reason.* Colour is the fastest signal a screen has and the easiest to spend into worthlessness. It
also fails completely for a colourblind reader, in bright sun on a Capitol lawn, and in a screenshot
pasted into Slack.

### A-6 Touch targets 44px; pointer targets may be 32px

44×44 CSS px minimum on any touch width (Apple HIG; WCAG 2.5.8 asks 24px, we hold the higher line).
Inline links inside running text are exempt. On pointer-only widths, 32px is allowed for controls
inside a dense table.

*Reason.* Fitts's law, and a thumb is about 44px wide. The exemption for dense tables is real: a
desktop table with 44px cells everywhere holds fewer rows and makes scanning worse, which costs more
than it saves.

### A-7 Contrast: 4.5:1 for text, 3:1 for anything that identifies a control

Verified ratios for this palette are in `DESIGN-AUDIT.md`. In short: every neutral from `--n500`
darker is safe as body text; `--n400` is **not** — it is 3.47:1, which is fine for an icon or a field
border but fails as small text. Field and chip borders correctly use `--n400`; card and row borders use
`--n200`, which is decorative and exempt.

*Reason.* WCAG 1.4.3 and 1.4.11. The `--n400` line is the one that gets broken by accident, because
it looks fine on a good laptop screen.

### A-8 Spacing comes from the scale, and space is how sections are made

4/8/12/16/24/32/48. Related things sit closer together than unrelated things; that proximity is what
makes a group, not a border and not a card. Prefer removing a card to adding one.

*Reason.* Gestalt proximity. Nate's word for the failure is "disharmony", and its usual cause is
arbitrary spacing — two gaps that differ by 3px read as a mistake even when nobody can say why.

### A-9 One set of breakpoints

**360, 900, 1100.** Below 360 is the small-phone floor; 900 is where header navigation replaces the
tab bar; 1100 is where two-column layouts begin. A screen needing another breakpoint says so in its
own CSS with a comment giving the reason.

*Reason.* The apps currently hold **23 distinct media-query breakpoints**, including both `359px` and
`360px`, so at exactly 360 — the most common Android width there is — some screens switch layout and
others do not. That is disharmony with a measurable cause. See `DESIGN-AUDIT.md` gap G-3.

### A-10 Motion is short, purposeful and optional

150–250ms, `--ease`, and only to show where something came from or went. Everything respects
`prefers-reduced-motion`.

*Reason.* WCAG 2.3.3. Motion that decorates becomes motion that delays, every single time.

### A-11 No emoji on the public page or Staff v2

Icons are Lucide via `icons.js`. Every icon that carries meaning also has a text label or an
`aria-label`.

*Reason.* Emoji render differently on every platform, are read aloud in full by screen readers, and
set a register wrong for a health institute talking about law.

---

## Part B — Flow

The test for this part is not how a screen looks in a screenshot; it is whether somebody can finish
what they opened the app to do, without stopping to think.

### B-1 Every screen names its job, and the job is one sentence

Before building or changing a screen, write the sentence: *"A person comes here to ___."* It goes in
the screen module's header comment and in `density.py`'s `want`. If the sentence needs an "and", the
screen is two screens.

*Reason.* GOV.UK "one thing per page". It is also the only way A-1 can be measured at all.

### B-2 The core journeys have step budgets

A step is anything a person must tap, type or read-and-decide. These are the journeys that matter;
anything that lengthens one needs a reason in the commit message.

| Journey | Budget |
|---|---|
| Public: arrive → follow a first bill | 4 steps |
| Public: arrive → understand what one bill does | 3 steps |
| Public: decide to act → action sent | 4 steps |
| Public: give an email address (from the moment it is offered) | 2 steps |
| Staff: open app → first thing due is on screen | 1 step |
| Staff: bill number in hand → that bill's page | 2 steps |
| Staff: bill page → position changed and saved | 3 steps |
| Staff: hearing notice → testimony draft submitted | 5 steps |

*Reason.* Every extra step loses people, and the loss compounds. Budgets also stop the most tempting
bad fix for a crowded screen: moving things one level deeper, which trades a look problem for a flow
problem and usually makes the app worse overall. **Not yet automated — see gap G-1.**

### B-3 No dead ends

Every screen offers the obvious next thing, including empty states, error states and the end of a
flow. An empty state says what it is for, why it is empty, and the one action that fills it.

*Reason.* NN/g heuristic 3 (user control) and the single most common complaint about
public-sector services: you complete something and the service just stops.

### B-4 Back always works, and never loses work

Browser Back, the header back button and the phone's system gesture all do the same predictable
thing. A screen with unsaved work registers a leave guard (`S.leaveGuards`). Closing a sheet is Back.

*Reason.* NN/g heuristic 3. On the public page most people are on a phone using the system back
gesture, which we do not control and must not surprise.

### B-5 Anything irreversible is undoable, not just confirmable

Prefer a 10-second Undo to an "Are you sure?". Where a confirm is genuinely needed, use
`confirmSheet` — never `window.confirm`. Any new approval gets the same Undo as Approve.

*Reason.* NN/g heuristic 3, and confirmation dialogs stop being read after the third time. This is
already the practice for Approve (backend migration 058); it is written down so it stays the practice.

### B-6 The app remembers; the person does not

Filters, saved views, sort order, "Seen", scroll position and half-finished text survive navigation,
and anything that should follow a person between their laptop and their phone goes in
`advocates.prefs` via `DB.patchPrefs`. Never ask for something the system already knows.

*Reason.* NN/g heuristic 6, recognition rather than recall. Nate's team works in interruptions; a
screen that forgets punishes them for being interrupted.

### B-7 System status is always visible

Loading, saving, saved, failed, and how far through something is. Anything over about 400ms says it is
working. Nothing ever looks finished before it is.

*Reason.* NN/g heuristic 1. A silent save is indistinguishable from a broken one.

### B-8 Errors say what happened, in plain words, next to the thing, with the way out

Never a code, never blame, never a dead end. If a save fails because of a column grant, the message
says what could not be saved and what to do — not "permission denied".

*Reason.* NN/g heuristic 9, WCAG 3.3.1/3.3.3.

### B-9 Nothing important lives behind hover

Hover may reveal a shortcut, never the only route to something. Every hover affordance has a tap
equivalent on touch widths.

*Reason.* Touch has no hover. This is the most common way a desktop-designed feature becomes invisible
on a phone.

### B-10 Destination before decoration

A person who knows where they are going gets there directly: search that finds a bill by number, deep
links (`#/bill/HB1563`) that work from Slack and email, and a URL for every screen worth returning to.

*Reason.* Expert and novice use the same app. The novice needs the path; the expert needs the shortcut;
neither should cost the other anything.

---

## Part C — First visit and the email ask

The public tracker's first visit is the only part of this system most people will ever see. It must
feel like being welcomed by somebody who is glad you came.

### C-1 Show the value before asking for anything

Somebody can see bills, read what they do, and follow one without an account, without an email
address, and without a decision about alerts.

*Reason.* GOV.UK and 18F both: asking before giving is the single biggest drop-off in a public
service. It also happens to be the honest order — we are asking them to trust us with an address, and
trust is earned by being useful first.

### C-2 The first screen asks one question, and any answer is a good answer

One question, visible without scrolling, with a skip that costs nothing and is not styled as failure.

*Reason.* P-2, and a first screen that presents a form is a first screen that presents work.

### C-3 The email ask comes after a success, once per visit, always skippable

Never on arrival. It follows something that just worked — a bill followed, an action sent — and it says
plainly what will arrive and how often. Skipping is a plain, equal-weight choice, never a greyed-out
afterthought and never a dark pattern ("No thanks, I don't care about my community").

*Reason.* Nate's product rule, and it matches every piece of consent guidance worth citing. The ask
lands best at the moment somebody has just felt the thing work.

### C-4 Consent is specific, and an account only ever gains choices

Giving an address for hearing alerts is consent for hearing alerts. HIPHI's own action alerts are a
separate, opt-in choice, off by default. An existing account never silently loses a preference or
gains a subscription.

*Reason.* Specific consent is both the legal standard and the reason people open the next email.
Anything else spends the trust C-1 earned.

### C-5 Ask for the least, at the latest possible moment

No field that is not needed right now. No account before there is something to save. Address stays
private to the person; staff see districts only.

*Reason.* Progressive disclosure. Every field is a place to stop.

### C-6 Say what happens next, before it happens

Before a magic link: which address, that it may take a minute, what to do if it does not arrive, and
how to get back here. After: the same information on screen, not only in the email.

*Reason.* Magic-link sign-in moves a person to another app and back; that gap is where they are lost.

### C-7 Celebrate the first success — once, and proportionately

The first followed bill and the first action sent get a genuine moment: orange, the celebration
colour, used here and almost nowhere else. One moment, not a streak counter, not a badge, not a
progress bar that implies homework.

*Reason.* Nate's word is "joyous", and the way to get it is scarcity — celebration works precisely
because the rest of the app is calm. Progress belongs to the person (Nate's rule); community numbers
appear only inside a bill or hearing, and only from 10 people.

### C-8 A returning person is never made to start again

Onboarding runs once. Anyone with a follow, an account or a completed wizard goes straight to the
thing they came back for.

### C-9 Nothing typed is ever lost to an error

A failed sign-in, a network drop or a validation error keeps every value and puts focus on the field
that needs attention.

*Reason.* WCAG 3.3.1, and this is the moment a first-time user decides whether to come back.

### C-10 Plain language, checked

Public text targets **Flesch–Kincaid grade 8 or below**; `tests/checks.py` already computes it and
`public_journey.py` asserts it. Bills lead with the nickname, then the plain summary, and always show
the bill number. No jargon without its plain equivalent first — not "referral", "crossover",
"deferred", or "measure", unless the plain words come first.

*Reason.* Grade 8 is the GOV.UK/NHS standard for public information, and Hawaiʻi's legislative
vocabulary is a second language even for people who vote in every election.

---

## The review checklist

`/design-review` walks this. By hand, in this order:

1. **Job.** Can you say in one sentence what this screen is for? (B-1)
2. **Arrival.** Where does that thing start, at 390 and at 1440? (A-1)
3. **Choices.** How many different controls compete on the first screenful? (A-2) One primary? (A-3)
4. **Journey.** Walk the whole task, on a phone, as somebody who has never seen it. Count the steps
   against B-2. Where did you have to stop and think?
5. **Dead ends.** Empty state, error state, end of the flow: is there a next step? (B-3)
6. **Back and undo.** Back from every state; Undo on anything irreversible. (B-4, B-5)
7. **Memory.** Navigate away and come back: what did it forget? (B-6)
8. **Touch.** Every target 44px; nothing important behind hover. (A-6, B-9)
9. **Colour and type.** Sizes and colours in budget; nothing by colour alone. (A-4, A-5, A-7)
10. **Read it aloud.** Grade 8 or below on anything public. (C-10)
11. **Look at the screenshots.** Phone and desktop, both. Several bad screens shipped when this
    step was skipped.

## Budgets, in one place

| | Budget | Limit | Measured by |
|---|---|---|---|
| Arrival (A-1) | 320px | 400px | `tests/density.py` |
| Choice kinds on first screenful (A-2) | 15 | 25 | `tests/density.py` |
| Primary actions in view (A-3) | 1 | 1 | review |
| Type sizes per screen (A-4) | 5 staff / 6 public | as budget | `tests/density.py` |
| Distinct text colours in view (A-5) | 7 | — | `tests/density.py` |
| Touch target (A-6) | 44px | 44px | `tests/checks.py` |
| Text contrast (A-7) | 4.5:1 | 4.5:1 | `DESIGN-AUDIT.md` |
| Breakpoints (A-9) | 360/900/1100 | — | grep |
| Journey steps (B-2) | per table | — | by hand (gap G-1) |
| Public reading grade (C-10) | 8 | 8 | `tests/checks.py` |

## Changing this document

A rule changes when Nate decides something that contradicts it, or when a rule turns out to be wrong
in practice. Change the rule in the same commit as the code, say why, and note it in the HANDOFF
entry. A screen that knowingly sits outside a budget is recorded as an exception in
`DESIGN-AUDIT.md` with its reason and date — not left as a silent failure.
