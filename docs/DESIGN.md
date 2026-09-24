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
   claimed. **Cite the rules that decided it, usually one to three**, not the whole checklist: a list of
   every rule touched buries the one that mattered. The full pass is for `/design-review` before shipping.
   (Added 9/23, R-051.)
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
| **UI/UX Design Fundamentals** (Nate, 2026-09-19) | Signifiers, hierarchy, component states, shadows, micro-interactions | Brought in by Nate. Rules A-12 to A-22 come from it. |
| **Turning a Vibe-Coded App Into Professional Software** (Nate, 2026-09-19) | Repetition, secondary-action cleanup, form and navigation discipline, first-impression quality | Brought in by Nate. Its central warning - that generated software repeats itself and never decides what matters - is the one most worth guarding against here, because these apps were built fast. |

---

## Part 0 — the promises

Everything else is these made specific. When two rules collide, the promise decides.

- **P-1 — Say the thing they came for, first.** Every screen exists to deliver one thing. That thing
  appears before anything that helps you find, filter, sort or act on it. Chrome earns its place; content
  does not have to.
- **P-2 — One decision at a time.** A person should never have to hold more than one question in their
  head. Competing choices, competing colours and competing urgencies are all the same failure.
- **P-3 — Nothing is a trap.** Every step can be undone, skipped, or left. Nobody is ever stuck, and
  nobody is ever punished for trying something.
- **P-4 — Nobody should need the manual.** There is a Help screen and there is onboarding, and a person
  who never opens either should still be able to do everything. Every control says what it does by how
  it looks and what it is called; every screen teaches itself by being used. If a screen needs a
  sentence of instruction to be usable, the screen is wrong, not the reader. **A tooltip, a help link
  or an explanatory paragraph is evidence of a design problem, not a solution to one** — write it if it
  helps today, but record what it was covering for.
- **P-5 — Every nudge helps the person who follows it.** Before adding a prompt, a default, a reminder, a
  count or an alert, ask: does this help the person who acts on it, or does it only work through pressure,
  guilt, false urgency, confusion or friction? If the second, leave it out and find the honest version. This
  covers the whole public side and staff alerts, not only the email ask (C-3 is this promise applied there).
  *Reason:* people trust a public-health body with their address and their name on testimony; one tactic that
  feels like a trick costs more trust than it wins in sign-ups, and some are against consumer and email law.
  (Added 9/23, R-051.)

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

**Budget 15 kinds. Limit 25 kinds**, counted **inside the content region only**. Count distinct kinds,
not instances — twenty-five rows of a bill table are one decision repeated, not twenty-five decisions.
Persistent navigation (sidebar, header, tab bar) is counted separately and is **not** part of this
budget. `density.py` reports all three numbers.

*Reason.* Hick's law: the time to choose grows with the number of competing alternatives. Two things
do not compete the way they first appear to. Repetition does not compete with itself — a list is easy
to scan precisely because every row is the same offer. And persistent navigation is identical on every
screen, learned once and then ignored; counting it made every desktop screen look thirteen controls
worse than it was, and would have sent somebody to simplify a screen whose content was already fine.
Navigation is judged by B-13 — whether a destination earns its place — not by this budget.

### A-3 One primary action per screen — or one repeated per item in a list

At most one filled/primary button in view, with one exception: **a list of equivalent items may carry
the same primary action on each row**, because that is one offer repeated, not several offers
competing. The exception holds only while the rows really are equivalent; the moment one row deserves
a different or more urgent action than its neighbours, the screen is back to one primary and the rest
become secondary. Outside a list, if two things both feel primary the screen is doing two jobs and
should be split.

*Reason.* NN/g and GOV.UK both: a primary action that has to compete is no longer a primary action.
But "compete" is the operative word, and it is the same distinction A-2 draws between instances and
kinds — twenty rows offering the identical next step do not make the reader choose between twenty
things. **Amended 2026-09-20 on Nate's decision**, after a review flagged staff Today for carrying
several filled "Mark filed" buttons down a list of identical rows. The original rule would have made
that screen worse by demoting every row but the first, for no gain to anybody using it.

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

Screen changes take 200-300 ms and slide the way the person is going. Feedback on a tap takes
150-250 ms. A celebration may play for up to about 2 seconds and waits for the person to continue.
Teaching scenes move only when the person taps, and each step's movement is over within about 4
seconds, in beats that follow its caption. Nothing moves by itself for more than 5 seconds. Under
Reduce Motion everything still works, with no movement. (Rewritten 9/21 for R-023, Nate's decision 5;
`pub/fx.js` holds the shared pieces.)

*Reason.* WCAG 2.2.2 and 2.3.3; NN/g on animation duration; lessons the learner steps through
teach, lessons that play at them don't.

**Implementation note, added 9/22.** `pub/fx.js` stays the one place motion lives; no animation
library is added (no build step). For a *new* animation, reach for the browser's own primitives
before hand-rolling `requestAnimationFrame` math: CSS Motion Path (`offset-path`/`offset-distance`)
for anything that follows a drawn route (compositor-smooth, `offset-rotate: auto` faces the path for
free), the Web Animations API (`element.animate()`) for tweens, fades and bursts (native
pause/reverse/`.finished`, easy to gate on Reduce Motion). Don't rewrite `travel()`, `burst()` or
`swap()` for cleanliness alone — they are shipped, tested and already meet this rule; only reach for
the native primitives on the next new animation, still routed through `fx.js`.

### A-11 No emoji on the public page or Staff v2

Icons are Lucide via `icons.js`. Every icon that carries meaning also has a text label or an
`aria-label`.

*Reason.* Emoji render differently on every platform, are read aloud in full by screen readers, and
set a register wrong for a health institute talking about law.

### A-12 Every control looks like what it does

A thing that can be pressed looks pressable; a thing that cannot, does not. Buttons look like
buttons and links look like links — never a link styled as a button to borrow its weight. Selected,
active and current states are visible without comparison (`aria-current`, `aria-pressed`, a filled
chip, a coloured tab). Disabled controls look disabled and say why when it is not obvious.

*Reason.* Signifiers are how an interface explains itself. This is the load-bearing rule for P-4: an
app nobody needs a tutorial for is an app where every control is self-evident.

### A-13 One focal point per screen

Size, weight, position and colour together decide what the eye lands on first, and every screen has
exactly one answer. The most important thing is largest, boldest and highest; supporting detail is
smaller and below it. Two things fighting to be first is the same failure as no hierarchy at all.

*Reason.* Contrast is what creates hierarchy — not decoration, not borders. It is also the cheapest
way to make a dense screen feel calm without removing anything from it.

### A-14 Say it once

The same fact appears once on a screen. A count, a status, a date or a name repeated in two places is
not reinforcement — it is two things to read, two things to maintain, and eventually two things that
disagree.

*Reason.* Generated software repeats itself, because each part is written without looking at the
others, and these apps were built fast. This has already happened here: the Bills screen carried "At
risk" as a quick chip and again in the stand counts (HANDOFF 3.1y). Before adding a number to a
screen, search the screen for it.

### A-15 Every component has all of its states

Buttons: default, hover, active/pressed, focus-visible, disabled, and loading where an action takes
time. Inputs: default, focus, error (a red border **and** a message), and disabled. Rows and cards
that can be pressed: hover and focus. No state is left to the browser's default.

*Reason.* A control with no pressed state leaves a person unsure whether the tap registered, and on a
slow phone on Capitol wifi that is where double-submissions come from. Focus-visible is also WCAG
2.4.7 and the only way the keyboard works.

### A-16 An action that did something says so

Every action gets a response within 100ms — a state change, a toast, a row moving, a count ticking.
Where the response is not otherwise visible, confirm it explicitly (the existing `toast` and the
10-second Undo are the house pattern). Keep it small and quick; this is confirmation, not celebration,
which is C-7's job and happens almost nowhere.

*Reason.* NN/g heuristic 1. Silence after a tap is indistinguishable from a bug.

### A-17 Shadows: if you notice the shadow first, it is too strong

Three levels, already in the tokens: `--sh1` for a card resting on the page, `--sh2` for something
lifted (action bar, sticky header), `--sh3` for something over the page (sheet, popover, dialog).
Strength scales with how far off the page a thing is meant to be. Never invent a fourth.

*Reason.* Depth is a hint about layering, not an effect. An over-strong shadow reads as a mistake even
to people who could not say why — which is exactly Nate's "disharmony".

### A-18 Icons are sized to the text beside them

An icon that sits with text matches that text's line height — 20px beside 14–16px text, 24px beside
18px, 16px for a dense table. An icon-only control is 44px of target around a 20–24px glyph, and
always carries an `aria-label` naming the action. Buttons are about twice as wide as they are tall
before their label stretches them.

*Reason.* Mismatched icon and text sizes are the most common reason a row looks subtly wrong. The
label requirement is P-4 again: an icon alone is a guess unless it is universally understood.

### A-19 Headings are Poppins, set tight

`--font-h` is **Poppins** (600 and 700); body and everything else is Lato. Headings at 22px and above
take `letter-spacing: -.02em` and `line-height: 1.15`; 16–18px headings take `-.01em` and 1.2. Body
text keeps normal spacing and 1.4–1.5 line height.

*Reason.* Large type set at default spacing looks loose and unfinished; tightening it is most of the
difference between a heading that looks designed and one that looks typed. Poppins is HIPHI's heading
face — `index.html` and `public.html` have always used it, and the newer `track.html` and `staff.html`
had drifted to Roboto (corrected 2026-09-19 on Nate's instruction).

### A-20 Secondary actions collapse into one menu

A row or card shows at most two actions: the one almost everybody wants, and at most one more.
Everything else goes behind a single `…` menu (`menuSheet`, which opens against its button). The same
applies to a screen's toolbar.

*Reason.* This is the direct fix for a screen carrying thirty different controls (gap G-4). Actions
laid out flat all look equally likely, so none of them reads as the obvious next step — which breaks
A-13 as well as A-2.

### A-21 Dark mode — the rules, for when it is built

Not built, and out of scope as of 2026-09-19. When it is: soften borders rather than lightening them;
there are no shadows in dark mode, so show elevation by making the raised surface **lighter** than the
page; reduce saturation on washes and chips, which glow at full strength on a dark background; and
re-verify every pair in the contrast table, because inverting is not symmetrical. Every token needs a
dark value — do not special-case screens.

### A-22 Images and overlays

Text over an image sits on a linear gradient that fades into a readable background, never a flat scrim
across the whole image. Prefer a real illustration to a generic icon where the point is warmth — the
island drawings in `pub/art.js` are the house example and should be reached for before another icon.

*Reason.* A flat overlay ruins the image and still under-serves the text. Real graphics are also the
single biggest lever on whether a first-time visitor trusts what they are looking at (C-11).

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
| Public: arrive → follow a first issue | 3 steps |
| Public: arrive → understand what one bill does | 3 steps |
| Public: decide to act → action sent | 4 steps |
| Public: give an email address (from the moment it is offered) | 2 steps |
| Staff: open app → first thing due is on screen | 1 step |
| Staff: bill number in hand → that bill's page | 2 steps |
| Staff: bill page → position changed and saved | 3 steps |
| Staff: hearing notice → testimony draft submitted | 5 steps |

*Reason.* Every extra step loses people, and the loss compounds. Budgets also stop the most tempting
bad fix for a crowded screen: moving things one level deeper, which trades a look problem for a flow
problem and usually makes the app worse overall.

**Raised from 4 to 5 for the first journey on 2026-09-20**, on Nate's decision to build a deliberately
longer first visit that narrowed by sub-topic before offering bills. **Back to 3 on 2026-09-20, same
day, HANDOFF 3.5**: Nate's review folded that narrowing screen into the topics-and-bills screen itself
(collapsible sections per topic, opened on demand), so the extra tap it bought is gone, while the thing
it was really buying - one row per policy instead of eleven near-identical bills - stayed. A budget
that moves whenever the product moves is worthless, so this is the standing test: a step earns its
place here for a reason, recorded, not quietly absorbed. Measured by `tests/journeys.py`, which fails
if any journey exceeds its budget.

**Renamed "follow a first issue" on 2026-09-21, budget unchanged (R-018)**: people follow issues, not
bills (Nate: "the user is not interested in bills, but instead about policies"). The same three steps -
pick a category, see its issues, follow the ticked ones - now end on issues, and a bill reaches the person
because it is on an issue they follow.

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

### B-11 A core journey needs no instruction

Somebody who has never seen the app, and who never opens Help or reads onboarding, can still complete
every journey in B-2. Test it that way: clear storage, open the screen cold, and do the task without
reading anything that is not part of the task.

*Reason.* P-4. Help and onboarding should be there for reassurance, not required for function — and
the moment they become load-bearing, nobody reads them anyway and the app is simply broken for
everyone who skipped.

### B-12 Forms ask for the least, and hide the rest

Only fields needed right now. Optional and advanced settings are collapsed by default behind one
clearly-named control. A form of two or three fields belongs in a modal or an inline block, not a
full-height flyout with a screen of empty space under it. Every field that is genuinely needed says
why, if the reason is not obvious.

*Reason.* Every field is a place to stop. A sparse flyout also reads as "something is missing here",
which makes people hesitate before a form they were going to complete.

### B-13 Navigation earns its place

A destination in the tab bar or sidebar is something people go to often. Anything reached rarely, or
reached from inside the thing it belongs to, lives there instead — not in the permanent furniture.
Reviewed whenever a destination is added.

*Reason.* Permanent navigation is the most expensive space in the app: it costs attention on every
screen, not just its own. Rarely-used entries dilute the ones that matter and push real content down,
which is A-1 again.

---

## Part C — First visit and the email ask

The public tracker's first visit is the only part of this system most people will ever see. It must
feel like being welcomed by somebody who is glad you came.

### C-1 Show the value before asking for anything

Somebody can see the issues and their bills, read what they do, and follow an issue (or one bill)
without an account, without an email address, and without a decision about alerts.

*Reason.* GOV.UK and 18F both: asking before giving is the single biggest drop-off in a public
service. It also happens to be the honest order — we are asking them to trust us with an address, and
trust is earned by being useful first.

### C-2 The first screen asks one question, and any answer is a good answer

One question, visible without scrolling, with a skip that costs nothing and is not styled as failure.

*Reason.* P-2, and a first screen that presents a form is a first screen that presents work.

### C-3 The email ask comes after a success, once per visit, always skippable

Never on arrival. It follows something that just worked — an issue followed, an action sent — and it says
plainly what will arrive and how often. Skipping is a plain, equal-weight choice, never a greyed-out
afterthought and never a dark pattern ("No thanks, I don't care about my community").

*Reason.* Nate's product rule, and it matches every piece of consent guidance worth citing. The ask
lands best at the moment somebody has just felt the thing work.

### C-4 Consent is specific, and an account only ever gains choices

Giving an email for "keep me updated" is consent for both hearing alerts and HIPHI's own advocacy
alerts, named plainly as one choice at the point of asking - not two separate switches, and not a
hearing-alerts ask that quietly turns on advocacy email too (Nate, 9/20, HANDOFF 3.5, reversing this
rule's earlier "action alerts stay separate, off by default"). An existing account never silently
loses a preference or gains a subscription beyond what a specific ask named.

*Reason.* Specific consent is both the legal standard and the reason people open the next email.
Bundling two named things into one plainly-described ask is still specific; a vague ask, or one that
grants something it never mentioned, is what spends the trust C-1 earned.

### C-5 Ask for the least, at the latest possible moment

No field that is not needed right now. No account before there is something to save. Address stays
private to the person; staff see districts only.

*Reason.* Progressive disclosure. Every field is a place to stop.

### C-6 Say what happens next, before it happens

Before a magic link: which address, that it may take a minute, what to do if it does not arrive, and
how to get back here. After: the same information on screen, not only in the email.

*Reason.* Magic-link sign-in moves a person to another app and back; that gap is where they are lost.

### C-7 Celebrate each real step, in proportion

A small win gets a small burst on the thing just done: a stance taken, a right answer, an address
found, an email sent, a part of the first visit finished. The first followed issue and the first
action sent get a moment that fills the screen and waits for Continue. The end of the first visit is
the peak: the recap of everything the person did, with the petals and the flowers. Orange is the
celebration colour and is used for these and almost nowhere else. Never a streak counter, a badge, a
score, or a progress bar that implies homework. (Rewritten 9/21 for R-023, Nate's decision 4: "add
more celebration animations at different stages".)

*Reason.* Nate's words are "joyous" and "more celebration at different stages"; celebration works
because the rest of the app is calm, so each one is sized to what was done, and the biggest comes
last (peak-end). Progress belongs to the person (Nate's rule); community numbers appear only inside a
bill or hearing, and only from 10 people.

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

### C-11 The first screen is the whole argument

A stranger decides whether this is trustworthy before reading a word of it. Presentation carries that,
not feature count: real drawings rather than generic icons, the same spacing and colour discipline as
everywhere else, no decorative element that does nothing, and nothing that looks like a placeholder.

*Reason.* The public tracker's entry screens are its landing page, and a public-health body asking for
an email address is asking for trust it has about four seconds to earn. Better presentation moves this
far more than more features do.

### C-12 Teaching is shown, not hidden

What the first visit teaches (reading a bill, the session, a hearing) is one idea per step, on the
person's own bill, with every word visible when its step is showing: never behind a tap-to-open box
or a tab. The primary button walks the steps and then moves on; Skip moves on at once; a question
comes only after the lesson that answers it. (Added 9/21 for R-023.)

*Reason.* Nate, 9/21: the old lessons were "important information ... done in a very boring and
tedious manner". The review measured 60% of "Reading a bill" and 54% of "What a hearing is" hidden
behind taps, so anyone who pressed Next learned almost nothing.

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
11. **The cold-start test.** Clear storage and do the whole task without reading Help, onboarding or
    any explanatory text. Anything you had to be told is a design defect. (P-4, B-11)
12. **Say it once.** Search the screen for every number and status on it. Is any of it twice? (A-14)
13. **States.** Press, hover, focus, disable and load every control you added. (A-15, A-16)
14. **Look at the screenshots.** Phone and desktop, both. Several bad screens shipped when this
    step was skipped.
15. **Honest nudges.** Every prompt, default, reminder and alert added: would it still work if the
    person saw exactly why it is there? (P-5)

## Budgets, in one place

| | Budget | Limit | Measured by |
|---|---|---|---|
| Arrival (A-1) | 320px | 400px | `tests/density.py` |
| Choice kinds in the content region (A-2) | 15 | 25 | `tests/density.py` |
| Journeys working and inside budget (B-2) | all | all | `tests/journeys.py` |
| Primary actions in view (A-3) | 1, or 1 per row in a list of equivalent items | as budget | review |
| Type sizes per screen (A-4) | 5 staff / 6 public | as budget | `tests/density.py` |
| Distinct text colours in view (A-5) | 7 | — | `tests/density.py` |
| Touch target (A-6) | 44px | 44px | `tests/checks.py` |
| Text contrast (A-7) | 4.5:1 | 4.5:1 | `DESIGN-AUDIT.md` |
| Breakpoints (A-9) | 360/900/1100 | — | grep |
| Journey steps (B-2) | per table | — | by hand (gap G-1) |
| Public reading grade (C-10) | 8 | 8 | `tests/checks.py` |
| Actions shown on a row or card (A-20) | 2 | 2 | review |
| Instructions needed for a core journey (B-11) | 0 | 0 | cold-start test |

## Changing this document

A rule changes when Nate decides something that contradicts it, or when a rule turns out to be wrong
in practice. Change the rule in the same commit as the code, say why, and note it in the HANDOFF
entry. A screen that knowingly sits outside a budget is recorded as an exception in
`DESIGN-AUDIT.md` with its reason and date — not left as a silent failure.
