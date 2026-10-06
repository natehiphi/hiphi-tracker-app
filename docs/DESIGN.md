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
| **Design Principles Reference** (Nate, 2026-09-23) | Defaults (B-12), honest progress (C-7), motion never alone (A-10), how strong the evidence is | Brought in by Nate (R-052). Most of it was already here (C-1, C-3 to C-5, C-7, P-5, A-10); the subscription, App Store, habit and community parts do not fit a free public tracker and were left out. |

**How strong is the evidence?** A rule that rests on behavioural research says so, in one word:
**strong** (well replicated), **mixed** (real, but depends on the situation) or **contested** (researchers
actively disagree). Popular figures are not quoted as fact: "losses hurt twice as much" is contested, and the
jam study (6 flavours against 24) is weak support for choice overload, which a 2010 review of 50 experiments
found close to zero on average. A principle graded mixed or contested is a guess to test against our own
numbers (`first_visit_funnel`, follows, actions sent), not a rule to apply on its say-so. (Added 9/23, R-052.)
*Reason.* A rule borrowed from a popular summary carries the summary's confidence, not the research's. Grading
it keeps us from building on a claim that does not hold, and tells the next reader how hard to defend it.

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

**The first visit is one step larger (R-174, 10/5):** inside it (its lessons opened on their own and its
moments too) the tokens are redefined, so 13 reads as 14, 14 as 16, 16 as 18 and 18 as 22; 22 and 28 stay.
Its sentences are 18px, card text 16px, and 14px is left for labels, counts and the fine print. It is
done once, in `pub/base.css`, so a screen there still sets only token sizes. What that buys is C-14.

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
`pub/fx.js` holds the shared pieces.) **Motion is never the only way something is said:** whatever a
movement shows (a tick, a count going up, a bill moving to its next stage) is also there in words or in
the finished still picture, so a person who blinks, uses a screen reader or has Reduce Motion on misses
nothing. (Added 9/23, R-052; Apple HIG, Motion.)

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
text keeps normal spacing and 1.4–1.5 line height. **A name that titles an issue, a bill or a category
is a heading wherever it stands** (a card, a list row, a tile): Poppins 18 (22 in the first visit, C-14), on a phone as on a laptop,
so the same issue never reads in two faces on two screens (X9-1, R-180). The page's own `h1` keeps its
larger size.

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

Not built, and out of scope as of 2026-09-19. Until it is, every page declares
`<meta name="color-scheme" content="only light">`, so a phone that darkens websites (Samsung Internet,
Chrome's "darken websites") shows the page as designed instead of inventing its own dark version (X9-1,
R-180); drop the `only` when dark mode is built. When it is: soften borders rather than lightening them;
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
| Public: decide to act → testimony sent, first time | 9 steps (R-068, 9/27: testimony became the main action; the Capitol account and its form are steps nobody can remove, so the walkthrough makes each one a single question. 9/28: "Get to know the bill" with its talking points took the town field's place, so still 9) |
| Public: testimony sent again on the same bill (its letter kept from an earlier hearing) | 6 steps (R-148, 10/4: Send my letter again, Next on "Where do you stand?" with their answer chosen (R-167, 10/5), Use my letter, read it and Next, copy it and open the Capitol page, I saw the green box. The account step never shows again. "Update my letter" puts the bill step and About you back, as the main button only when staff marked the new draft as changing what people should say or HIPHI's position moved) |
| Public: an email sent again (its email kept from the bill's last step) | 4 steps (R-153, 10/4: Send my email again, Use my email, read it and Next, open it in the mail app; "Did you send it?" closes it as for any email) |
| Public: the one follow-up to the same chair, a week before the deadline | 3 steps (R-153: Follow up with the chair, read it and Next, open it in the mail app; offered only once their email is 5 days old; Nate: "Yes for now, but needs to be reconsidered") |
| Public: quick email (under More ways to help) → sent | 9 steps (R-079, 9/29: Nate chose the testimony walkthrough for emails to a chair - where you stand, the bill and its talking points, About you, the email to read over, then sending by mail app, Gmail or Outlook.com and "Did you send it?". It was 4 steps as a one-box composer) |
| Public: sign up for alerts (from the moment it is offered) | 3 steps with the code (R-155 and R-176, 10/5: Nate chose "Code at sign-up", then "Code everywhere": type the number, Text me a code, type the code, which sends itself at six digits and which phones offer above the keyboard; the code is the proof the number is theirs and cannot be removed). 2 until codes are on (R-146, 10/4: a mobile number is the box shown first, type it and Text me; email is one tap more, behind "Prefer email?". It was "give an email address", also 2) |
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

**Defaults, added 9/23 (R-052).** A choice may start filled in only when we are highly confident it is what
the person would pick for themselves: our own numbers show most people choose it, or it is plainly in the
person's interest, it is visible and one tap undoes it. When we are not that sure, leave it empty or ask. Never
pre-select consent, an email, anything that shares data, or a stance: for those, the person chooses. A stance the
person gave themselves is not a default: where they are asked again, it comes back chosen and says where it came from,
and one tap changes it (B-6; R-167, Nate 10/5: a new letter always asks "Where do you stand?", with "You marked Support
on the bill page." and their answer chosen).
**HIPHI's own recommendations are the one other thing that may start selected** (Nate, 9/23): the issues and
bills the team recommends are what we are asking people to back, and a tick is how we say so. Three
conditions: every selected item is on screen when the person decides (nothing is chosen unseen), one tap
removes it, and skipping the step selects nothing. The first visit's screen 2 is the example: HIPHI's
strongly supported and staff-recommended issues among the four shown start ticked, and Skip follows nothing. *Reason.* Most people keep a default and read
it as advice, so a default is a recommendation made in their name; evidence **mixed** (defaults are strongly
sticky; "fewer choices is better" is not reliable). A pre-ticked box is not valid consent under EU law
(Planet49); a lawyer should confirm what US email and state privacy law require of the sign-up.

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

### C-3 The alerts ask comes after a success, once per visit, always skippable

Never on arrival. It follows something that just worked — an issue followed, an action sent — and it says
plainly what will arrive and how often. Skipping is a plain, equal-weight choice, never a greyed-out
afterthought and never a dark pattern ("No thanks, I don't care about my community").

**Where and how, since 10/4 (R-146, Nate: "move the sign up for alerts option to right after selecting issues,
also include a phone number option which should be more prominent").** In the first visit the ask is its own
screen right after the issues are followed and before the "Mahalo!", which then celebrates both (the follow is
the success; the moment comes once the person has answered). It is one box everywhere (`pub/alerts.js`: the
first visit, Home, after a first action, More): a mobile number first, email as a link under it, the same two
kinds of alert named for either (C-4), how often ("at most one a day"), and for texts the carrier words
(message and data rates, STOP, HELP). Until 10/4 the ask sat on "Coming up on your issues", after the story and
the address (Nate 9/21: after the value), where most people never reached it.

**What it is called, and where it comes outside the first visit, since 10/6 (R-184, Nate: "It's crucially important
that we encourage them to build a profile").** The ask says "Save your profile": a number or an email is what makes a
profile, and the line over the box says what the profile keeps of what was just done (a reason, not the alerts, which
the box's consent words already name). It is the first thing seen after a first follow or letter, wherever that
happens: after an issue page's or a category's Follow it rises in the alerts sheet with the follow said over it, and
after a letter it sits right under the thank-you, above "What happens next" (it had been under the first phone screen,
so "Done" came first). Still once per visit, and no second ask on Home after a skip (Nate). The old "Get alerts" ask
is kept as a switched-off version to test later (the test `save`).

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
action sent get a moment that fills the screen and waits for Continue (in the first visit the follow's
moment plays once the alerts screen right after it is answered or skipped, R-146). The end of the first visit is
the peak: the recap of everything the person did, with the petals and the flowers. Orange is the
celebration colour and is used for these and almost nowhere else. Never a streak counter, a badge, a
score, or a progress bar that implies homework. (Rewritten 9/21 for R-023, Nate's decision 4: "add
more celebration animations at different stages".)

*Reason.* Nate's words are "joyous" and "more celebration at different stages"; celebration works
because the rest of the app is calm, so each one is sized to what was done, and the biggest comes
last (peak-end). **Progress starts only from real steps (added 9/23, R-052):** anything that shows
how far someone has come may start above zero only for something they really did (picked an issue, found
their legislators), never a made-up head start; evidence **strong** that a real head start helps people
finish (Nunes and Drèze 2006), and a faked one costs trust once noticed. Whether it helps here is a guess
until `first_visit_funnel` shows it. Progress belongs to the person (Nate's rule); community numbers appear only inside a
bill or hearing, and only from 10 people. **No full-screen moment part-way through the first visit after the first
follow (added 10/4, R-140):** one after the lessons, three green ticks over the Capitol, made the visit feel finished with
Stay connected still to come (Nate: "makes it feel like everything is done"). A finished part gets its small burst on its
tick at the top, and the button that leaves it names what comes next (C-6).

### C-8 A returning person is never made to start again

Onboarding runs once. Anyone with a follow, an account or a completed wizard goes straight to the
thing they came back for.

### C-9 Nothing typed is ever lost to an error

A failed sign-in, a network drop or a validation error keeps every value and puts focus on the field
that needs attention.

*Reason.* WCAG 3.3.1, and this is the moment a first-time user decides whether to come back.

### C-10 Plain language, checked

Public text targets **Flesch–Kincaid grade 8 or below**. `tests/words_test.mjs` checks it on every push
(X4-3, R-180): it grades every bill summary, talking point, issue description and outlook in the practice
data by the formula in `tests/checks.py` (`fk_grade`), prints how many read above grade 8, and fails when
a count rises above its recorded baseline, so new words over grade 8 are caught while the old summaries
wait for their rewrite (X4-2). The same test fails on "Hawaii" without its ʻokina (U+02BB) and on "dead"
or "died" in the public page's own words. No test grades a whole screen yet: `public_journey.py` computes
each screen's grade and does not compare it. Bills lead with the nickname, then the plain summary, and always show
the bill number. No jargon without its plain equivalent first — not "referral", "crossover",
"deferred", or "measure", unless the plain words come first.

**HIPHI's own terms (Nate 10/5, R-158): "e-cigarettes", never "vape", "vapes" or "vaping"**, in
issue and bill names, summaries, talking points, hints, examples and demo data, on the public page and
in both staff apps. The Legislature's own titles stay as written, and search still treats "vape" as a
match (`pub/find.js` SYN), because people type it.

**Never say that few people act (added 10/5, R-171):** not "Most people never do it", "Few people
write in" or "far fewer people than you'd think". Say what the act does ("That's how bills move:
committees hear from the people who write"), or that others take part ("People all over Hawaiʻi write
to lawmakers every session. Your note joins theirs."). `public_journey.py` checks the screens that used
to say it (`LOW_TURNOUT`).

*Reason.* Grade 8 is the GOV.UK/NHS standard for public information, and Hawaiʻi's legislative
vocabulary is a second language even for people who vote in every election. The e-cigarette rule is
HIPHI's: one name for the product in everything it publishes. Saying few people act tells people
that not acting is normal: at Petrified Forest a sign saying many visitors took wood raised theft to
7.92%, against 2.9% with no sign (Cialdini 2003), and get-out-the-vote messages saying turnout will be
high beat ones saying it will be low (Gerber and Rogers 2009); found in R-164's sign-up research.
Strong evidence elsewhere; whether the new words move people here is a guess until the first-visit
counts and the testers show it.

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

### C-13 Every question changes what the person sees next

A question in the first visit (and anywhere a person is asked about themselves) earns its place only if
the answer visibly changes what they see soon after: which issues appear, which bill the lessons use,
whose names come up, what their reminders are about. If nothing downstream uses the answer, make it
matter or drop the question. A quiz that checks a lesson is not covered. (Added 9/23, R-052.)

**Nate may waive it case by case.** A question that stays without a visible effect needs his yes, recorded
as an exception in `DESIGN-AUDIT.md` with the reason and date. Without that, it is a defect.

*Reason.* Every question is a place to stop (C-5), and people answer more willingly when they can see the
answer being used; evidence **strong** that relevant, personalized experiences keep people engaged, and a
short questionnaire whose answers go nowhere reads as data collection. Checked by `first_visit_funnel`: how
many skip a question, and how many finish after it.

### C-14 In the first visit, what people read is large and short

Anything a person reads to choose or to move on is 16px or larger (18px for the sentence under a
heading, A-4), in `--n700` or darker; 14px is only for a label, a count, a chip, a time or the fine
print. The sentence under a heading is one or two short sentences, 30 words at most, and nothing on a
screen says again what its heading, another line or the screen before already said (A-14). A long line
is cut, not made smaller. (Added 10/5, R-174.)

*Reason.* Nate, 10/5: "The text during onboarding is far too small. Anything that users need to
read should be prominent and not long." A newcomer reads every word of the first visit, on a phone,
before they trust the page; 13-14px grey under a 28px heading reads as small print, and long lines
are skimmed or skipped. Mobile reading guidance puts body text at about 16-18px (Apple's body style is
17pt), and shorter lines are read more completely (NN/g on web reading). Whether it changes how many
finish is a guess until `first_visit_funnel` and the five testers show it; checked by
`tests/fv_type.py`, which walks every version.

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
16. **Questions pay off.** For each question the person is asked, what does the answer change on a
    later screen? Nothing, and no recorded waiver from Nate, is a defect. (C-13)

## Budgets, in one place

| | Budget | Limit | Measured by |
|---|---|---|---|
| Arrival (A-1) | 320px | 400px | `tests/density.py` |
| Choice kinds in the content region (A-2) | 15 | 25 | `tests/density.py` |
| Journeys working and inside budget (B-2) | all | all | `tests/journeys.py` |
| Primary actions in view (A-3) | 1, or 1 per row in a list of equivalent items | as budget | review |
| Type sizes per screen (A-4) | 5 staff / 6 public | as budget | `tests/density.py` |
| First visit: reading text / lead sentence (C-14) | 16px+ (14px labels only) / 30 words | as budget | `tests/fv_type.py` |
| Distinct text colours in view (A-5) | 7 | — | `tests/density.py` |
| Touch target (A-6) | 44px | 44px | `tests/checks.py` |
| Text contrast (A-7) | 4.5:1 | 4.5:1 | `DESIGN-AUDIT.md` |
| Breakpoints (A-9) | 360/900/1100 | — | grep |
| Journey steps (B-2) | per table | — | by hand (gap G-1) |
| Public reading grade (C-10) | 8 | 8 (content: no rise over the baseline) | `tests/words_test.mjs` |
| Actions shown on a row or card (A-20) | 2 | 2 | review |
| Instructions needed for a core journey (B-11) | 0 | 0 | cold-start test |

## Changing this document

A rule changes when Nate decides something that contradicts it, or when a rule turns out to be wrong
in practice. Change the rule in the same commit as the code, say why, and note it in the HANDOFF
entry. A screen that knowingly sits outside a budget is recorded as an exception in
`DESIGN-AUDIT.md` with its reason and date — not left as a silent failure.
