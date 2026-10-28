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
within 24 hours, and a testimony deadline that has passed while late testimony is still open before the hearing (Nate
10/11, R-250). Orange is celebration and achievement only — and *only* those. Every state that a
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
makes a group, not a border and not a card. Prefer removing a card to adding one. **Lists of tappable rows get a box**
(Nate 18 Oct 2026, R-303): in the redesign (?rec=1) a list of rows to tap sits in one white box with a hairline between rows
(rec.css .rc-box, kit.js BOX), so it shows where it starts and ends: every such list in the redesign (the topic page,
Find, search, My issues, Committees, Home, and since his "Box all seven" You, Help, Your lawmakers, a lawmaker's On your
issues, a committee's bills and the issue page's two lists). Lists inside a card or a closed card keep that card. In the
narrower box a day, a date and its time stay on one line (kit.js keep, in every row).

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
150-250 ms. **A celebration never blocks (R-140, Nate 10/5: "celebratory but also encourage continuing... shouldn't
be roadblocks"):** the next button stays visible and works during every celebration, and no celebration disables input
or makes the person wait. A small burst (a step done, a pick) is under 0.7 s, flies up and out just above the thing it
came from, and never covers the next button. A full-screen moment (C-7 only: the first action sent, a bill becoming
law) leaves on its own within 1.5 s, and a tap, key or scroll leaves it at once; a tap on the button under
it does that button's job. The screen moves on first and the moment plays over the next screen once its slide has ended
(R-140 fix, 10/10), so the button under it is that screen's own Next and the old screen's bar is never live under the veil.
Its words stay for 4 s as a toast. **The first visit's "Mahalo!" is a page, not a moment (R-140, Nate 11 Oct: "too
quick. Maybe it should be a permanent page that a user hits next on"):** once the alerts screen is answered or skipped, that
screen turns into the "Mahalo!" page (the same address, so Back finds it), the moment's flower opens once as it arrives,
and it stays until the person taps Next, which names the next part. The plans' sign-up ends the same way. Since R-298
(Nate 17 Oct: it had become "a cold page with way too much text", where the moment had been "a very warm animation") the
first visit's page is the moment again at full size: the flower large in the middle on a soft glow, opening over about
1.2 s, six petals drifting off it and gone by 3.4 s, then the words, two lines and one small "Texts go to ... · Change",
centred, with Next under them on a laptop. Under Reduce
Motion nothing moves: the words are there and
the thing that would have burst takes a brief colour change (`fx.js` tint()). Teaching scenes move only when the person taps, and each step's movement is over within about 4
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
larger size. **The quiet row is one step down** (R-300's "the list, quieter"; R-303): a name in Home's row (`.cm-row`) and
the redesign's (`.rc-row`, `pub/rec/kit.js`) is Poppins at the `--t16` token with its status line at `--t14`, so it reads
18/16 on Home, whose tokens are a step larger (A-4), and 16/14 on every other page, as the bill page's rows and closed cards
do. Same face, same token, each page's own step: at 18/16 My issues for someone following sixteen issues would be 1,766px
on a phone and Find 1,546px, against R-303's budgets of 1,500 and 1,400 (the wrap-up review, 10/18).

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

### A-23 Home has a budget

Home is the screen people come back to, so it has a budget measured on the whole page, not only the first screen:
**at most four blocks, of at most two shapes** (the slide, rows); **one filled button**; **each bill named once**; on a
phone **under two screens for someone following 3 issues and three screens for 16**; one row per issue followed. A new
thing for Home replaces something already there, or goes elsewhere (the issue's page, My issues, More, the Mahalo after
an action). Checked on every push by `tests/home_calm.py` on the calm Home (R-222), in eight moments for three people,
at phone and laptop size.

*Reason.* A-1 measures the first screen, and Home passed it while the page under it grew a block for nearly every
request about coming back: 3,126px, 10 blocks of 9 shapes and 3 filled buttons for a follower of three issues, 5,206px
for sixteen (the review of 10 Oct 2026, R-222). People came back to a page that was different every time and said the
same bill up to four ways. A budget on the whole page is what stops it growing back (A-8: prefer removing a card to
adding one; A-13: one focal point).

**The slide holds still (R-300, Nate's picks of 17 Oct 2026).** The slide is: the drawing, the goal heading, one sentence,
one detail line ("By tomorrow 1:00 PM · about 2 min · HB 1780", amber only inside 24 hours), the full-width button, "More
ways to help" (on every slide that has something to do, hearing asks too, opening inline under it), then the pager: back and
next arrows (44px) around **at most five dots**, a window that slides with the current one, so nobody can tell how many are
left; a swipe on a touch screen does the same. **Every slide of a deck is as tall as its tallest words**, so the button, More
ways and the pager sit at the same place on every slide. The greeting is **one line with no count** (Nate: "Remove the XYZ
things you can do this week. If it's a lot it can be overwhelming", which reverses R-295's "10 things you can do this
week"); a result on a bill with a slide opens that slide's sentence, any other is a dot on its row. Your issues has no
headings with counts, a dot for what is new, one link under it; in the redesign (?rec=1) its rows sit in the white box
(Nate 18 Oct 2026, R-303: "I'll go with the box for the home page", which reverses R-300's "no box"; A-8), the slide's own
row lit pale blue inside it and each day kept whole with its time. **On a phone the first screen is under 60 words and
6 text styles** (the amber of A-5 aside), measured with a style as one face, size, weight and colour. Checked by
`tests/home_calm.py` on every slide of each moment, phone and laptop.

*Reason.* "Show the next one" sat right on testimony slides and left on hearing asks, which had no More ways (199px apart on
a phone, up to 87px up or down as the words changed length): a control that moves has to be found again on every slide
(Fitts; NN/g on consistency). Nate tried each way to the next one on a playground and picked the pager with the swipe; a
count on the slide, or many dots, reads like homework (C-7). Kai's first phone screen held 80 words and 10 text styles. The
dots, the swipe and the words are guesses until the five testers in November ("How would you get to a different one?") and
January's counts of actions started from Home.


### A-24 On a laptop, one thing open at a time (Staff v3)

Measured on the first screen at 1280×800, 1440×900 and 1920×1080. **A list and the item picked from it:** a screen that
lists things to act on (Today's tasks, Bills) shows each as one line (Staff v5, R-277 W-1: Today's and Team's rows take two, the bill and
then its step in full, since a cut line hid the time, action or person), and the one someone picks opens in full beside the
list; times, rooms, summaries and counts live in the open item, not on every row. **One side panel at most, at any width:**
extra width on a big monitor becomes margin, never a further column. **On the first screen: at most 5 separate things**
(a list, a table or the week's grid counts as one, however many rows show), **at most 7 text colours** (A-5's aim, held
here as a limit), **one filled button outside a list** (A-3), and numbers only where they ask for action. Checked by
`tests/staff3_budget.py`. It holds for Staff v3 (`staff3.html`, R-264), the laptop-first copy Nate is comparing with Staff
v2; Staff v2 is not measured against it until he picks one.

*Reason.* Nate, 12 Oct 2026 (R-264): "We should maximize improvement for the laptop version of the app. Phone use will
exist but significantly less used. One concern I have is that it is too dense of information on the page, there is too
much going on at one time." Every staff screen passed A-1 and A-2 while Today's first laptop screen held 8 boxes, 434
words and 10 text colours (12 boxes and two side columns on a big monitor), because those rules count controls, not the
things competing for the eye. Trimming extras alone did not help: the freed space filled with more cards of about ten
pieces each. Mail and chat apps meet the same problem with a list and a reading pane (NN/g: progressive disclosure,
recognition rather than recall). Evidence **moderate** for progressive disclosure; for this team a guess until two or three
teammates do five tasks in each version on the practice copy (wrong turns counted) and the team uses it in January.

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
| Public: ask a friend to speak up, right after acting (from the Mahalo, once the profile ask is answered) | 3 steps on a phone (R-205, 10/7: Ask a friend to speak up, then Send to a friend when a hearing offers more than one ask, then the phone's own menu, where the person and Send are the phone's). 2 on a laptop: Ask a friend to speak up, then an Email it button or Copy message |
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
A page's own Back names the screen it returns to ("← Find", "← Home", the issue's name), as iOS and
GOV.UK do, and never leads forward into a form: someone whose first page was a friend's link gets
Find, the browse page, behind it, not the sign-up (R-238).

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

A public screen, or one part of it, that cannot load uses `loadFail` in `pub/ui.js` (R-212 #49, 25 Oct 2026): "We couldn’t
load {the thing}", the one sentence from `failWords` (offline says it is the connection; otherwise "It’s not you"), and a
Try again that asks again in place. A failed load is never drawn as "not found", "nothing here" or a count of 0.
`tests/load_fail.py` checks every screen with the data blocked, failing or hanging.

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

### B-14 Things to do are never folded away, and the button that leads to them says so

On Home, every thing a person can do this week is on the page: the soonest as the slide (R-295: drawing, goal heading, one full-width button, like a first-visit screen), the rest one line each, none
behind "Show more", "Ready now?" or a closed fold. On the calm Home (R-222, A-23) "one line each" is the issue's row: it
names its soonest deadline and how many more are due that week ("Testimony due tomorrow 1:00 PM, and 1 more this
week"), and the slide's pager (its arrows, or a swipe; R-300) brings each up on the slide, as does a tap on a row that has something due, which moves the pager to it (R-295, Nate 10/17, "5a"); the slide's own issue says "On the slide above" in its row; a row is never silent about something due. Late testimony counts
as something due (R-250, Nate 10/11): when nothing is due on time it is the slide, and its row says "Late testimony until
today 1:10 PM". A bill followed on its own has a row too, named for the bill with its number on the status line ("HB 1563 ·
Needs a hearing by Mon, Mar 30"); the slide's own bill has none. **One exception, at
Nate's word (10/11):** a follower of more than 8 issues sees them in the order of where they stand (what is due first) and
the first 8, then "Show all your issues" in place, which says "· more due this week" when something due is behind it (no
number and no headings over the groups since R-300: Nate, 17 Oct, "remove the "due this week xyz" under the "your issues"");
so something due is folded only when more than 8 issues have something due.
Folds stay for what is done ("Done this week"), for results, and for detail inside one card or one bill. A button that leads to Home says what the person will do there, not the place: the
first visit ends on **"See How I Can Help"**, and Home opens on exactly that (C-6: the next screen keeps the button's
promise).

*Reason.* Nate, 10/6 (R-190): "on the homepage we need to not hide more actions beneath a collapsed field", after
"Having it hidden at the bottom and collapsed at the home page is not the right move" (10/4, R-150). NN/g: content
behind an accordion gets less attention and may be missed altogether, so a fold is for what most people can skip;
57% of attention goes to the first screenful. A label that names a place ("Go to my home page") makes the person guess
what they will find; one that names the outcome lets them decide (NN/g's information scent: a link must smell like
its destination, and a broken promise costs trust). One line per thing keeps the page short (the 9/19 assessment found
fourteen full cards made Home a 7,000px wall). Evidence **moderate** for the fold (NN/g studies), **mixed** for the exact
words (first-person "my" won by 90% on one page and lost 25% on another, both run by the same copywriter); whether
more people act from Home is a guess until January's counts. The exception: Nate, 10/11 (R-222), for Leilani's sixteen and more: "Option number 2, but still grouped by status";
a list of dozens on one screen hides the urgent among the quiet more than a fold after the first 8 does.

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

Never on arrival (one exception since 10/11, C-16: a later visit's one full-page ask). It follows something that just
worked — an issue followed, an action sent — and it says
plainly what will arrive and how often. Skipping is a plain, equal-weight choice, never a greyed-out
afterthought and never a dark pattern ("No thanks, I don't care about my community").

**Where and how, since 10/4 (R-146, Nate: "move the sign up for alerts option to right after selecting issues,
also include a phone number option which should be more prominent").** In the first visit the ask is its own
screen right after the issues are followed and before the "Mahalo!", which then celebrates both (the follow is
the success; the "Mahalo!" page comes once the person has answered, A-10). It is one box everywhere (`pub/alerts.js`: the
first visit, Home, after a first action, More): a mobile number first, email as a link under it, the same two
kinds of alert named for either (C-4), how often ("a few a month" since t5/e3, R-299; the one-a-day ceiling is said on the
Text terms page and the Alerts page, R-303), and for texts the carrier words
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

**Then the share ask, since 10/7 (R-205, Nate: "the profile ask stays first", "Do not ask them to keep sharing after
they've done it").** On a letter's or an email's Mahalo the profile ask's two answers sit in the bar, "Not now" and the box's
button, so "Done" never closes the screen before what comes next; once it is answered (or there is none) "Bring one friend
along" takes its place under the thank-you, "Ask a friend to speak up" the bar's main button. One ask in view at a time,
still; after a share, one quiet line, and nothing asks again for that hearing. *Reason:* the thank-you is where sharing
happens (about a third of visitors to a thank-you page share, ShareProgress 2017; the urge fades within hours), and a
second ask on the same screen outperforms one behind a click (NextAfter); evidence **moderate**, practitioner data.

**The first visit's words, since 10/6 (R-188, Nate: "needs to significantly improve").** One sentence under the
heading, and it says only what the box can't: what a profile is in plain words and why it matters now ("Your profile
keeps your 4 issues and a way to reach you in time: bills can get a hearing with about two days' notice"; between
sessions "from January," comes before "bills"). It does not say "speak up" or what arrives, which the consent words under
it already say (A-14), and it stays at three lines on a phone so the box starts within 320px (A-1). The line under the
number answers what "Save your profile" makes a newcomer wonder, is this an account to set up: "No password needed."
The code step says what the code does ("Type the code to save your profile."), and once the code proves the number the
"Mahalo!" page thanks them by name (since R-298 it has no card: "Texts go to <number> · Change"). A number not yet confirmed, and an email, keep "Almost set" and "to turn
on alerts" (D1-4).

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
found, an email sent, a part of the first visit finished. The first followed issue, the first action sent
and a bill becoming law get a moment that fills the screen for at most 1.5 s and never blocks (A-10: any tap, key or
scroll ends it, its button is there from the first frame, and it leaves on its own). In the first visit the follow's
"Mahalo!" is a page of its own instead, once the alerts screen right after it is answered or skipped (R-146), and it
waits for Next (R-140, Nate 11 Oct: the 1.5 s moment was "too quick"). Anything else that would fill the
screen is a burst instead (R-140: the session's end on Home is one, with a toast that offers "See your session").
The end of the first visit is
the peak: the recap of everything the person did, with the petals and the flowers. Orange is the
celebration colour and is used for these and almost nowhere else. Never a streak counter, a badge, a
score, or a progress bar that implies homework. (Rewritten 9/21 for R-023, Nate's decision 4: "add
more celebration animations at different stages".) **The daily game is the one exception (R-231, Nate 10/11: "Yes
exception to streak"):** inside the game only, a streak, a score out of three, the result marks and team ranks are allowed,
because they are the game. Any finished kuleana card keeps the streak, streak freezes cover a missed day, and none of it
appears anywhere else in the tracker. The text a player copies to share may use emoji (Nate 10/11); the page itself still
follows A-11.

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
tick at the top, and the button that leaves it names what comes next (C-6). **Good news cards (added 10/10, R-046 rework, Nate's
answer of 10/5):** each result that went the person's way is its own card at the top of Home, with its small burst once when it
first appears and "Got it" to remove that one card. At most three: on a laptop at the top of the right column, so the first thing
to do stays high in the main column (with three stacked above it, that started near 550px, A-1 budget 400); on a phone one card, with
"N more good news" beneath, because three stacked cards put today's actions near 635px at 390 wide. Orange is the wash, edge and icon only.

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
are skimmed or skipped. **Home follows it too** (R-295, Nate 10/17: "carry onboarding's warm, welcoming mood onto Home"): the slide and the greeting use the first visit's type step (`body[data-screen="home"] .cm` in base.css), so the page people come back to reads like the screens that welcomed them. Mobile reading guidance puts body text at about 16-18px (Apple's body style is
17pt), and shorter lines are read more completely (NN/g on web reading). Whether it changes how many
finish is a guess until `first_visit_funnel` and the five testers show it; checked by
`tests/fv_type.py`, which walks every version.

---

### C-15 One name for each thing: the word list (X4-6, R-180 wave 3)

The same thing has one name everywhere it is said: both apps, the emails and the texts. `tests/words_test.mjs` finds the
retired words in the code's quoted text on every push, so the list does not drift.

| Say | Never | Notes |
|---|---|---|
| **alerts** | reminders, notifications, "hearing alerts" for the other kind | the text or email that a bill on someone's issues has a hearing. HIPHI's own emails (asks to speak up) are "HIPHI's updates" until Nate picks a name. R-277: also staff's Slack DMs and emails from the tracker ("Alerts come by", "Morning alert"), never nudges or reminders. |
| **profile** | account (for the person's page), settings | "My settings" is the staff app's own page. |
| **sign in** | log in, login | for HIPHI's own sign-in. The Capitol website's login is called what it calls it. |
| **put on hold** | deferred (public), tabled | a committee's decision to hold a bill. |
| **did not advance** | stopped, stops for the year, dead, died, killed | a bill that is out for the year (Nate 10/7, R-144). Reasons end "so it can't pass this year"; a resolution is "Not adopted"; the step bar says "Got as far as ...". "This year", never "this session". `tests/words_test.mjs` 5b. Staff keep "Stopped"/"Died". |
| **Hearing scheduled**, **Waiting for a hearing**, **Waiting for a vote**, **Passed the Legislature**, **Became law**, **Did not advance** | Waiting in committee, Needs a hearing (as a group name), moving (as a group name) | where a bill stands, in hearing order (R-212 #44). The words and one line on what each means are written once, in `pub/stands.js`; core.js `standOf(b)` is the one rule for which a bill is in, so All bills, Find, My issues and Help agree. A row may say more ("Waiting for a hearing · 5 days left", "Vetoed"), never something else. "Moving" is hear + wait + vote + passed. Help's answer `#/help/where-a-bill-stands` is drawn from the same list. `tests/stands_test.mjs`. |
| **Ready to file** | approved, not filed yet | staff's name for testimony that is approved and waits for the Capitol site. |
| **the Senate Health and Human Services committee** | HHS, HHS/CPN; "two Senate committees: Health and Human Services, and Commerce and Consumer Protection" | a committee's short name in words. Joint, in a sentence: each name ends with "Committee", the chamber said once: "the Senate Health and Human Services Committee and the Commerce and Consumer Protection Committee, together". Joint, standing alone (a step, a title): stacked, "Two Senate committees, together:" and then each committee's name on a line of its own. Never names joined by commas alone: "Health, and Human Services & Homelessness" read as the Senate's Health and Human Services (R-212 #45). Codes are for staff screens and the Capitol's own page, never a public screen or email. |
| **Step 6 of 10** over **In two Senate committees, together:** with **Water, Land, Culture and the Arts** and **Public Safety and Military Affairs** each on a line of its own; **In the Senate Judiciary Committee**; **Got as far as the House Health Committee** (R-212 #45) | "Step 6 of 10 · In the Senate" over "Senate Water, Land, Culture and the Arts with Public Safety and Military Affairs"; "Senate Judiciary" (no "Committee"); "1st of 2 Senate committees" for a step of two; "Passed a vote of the full House" for second reading | the bill page's step line: the step, the chamber only when the line under it does not say it, then where the bill is. A committee step is named one way wherever it stands on its own (the step line, See all steps with its tag on the first line, a hearing's title), stacked as in the row above (core.js `cmteStack`, `cmteWords`, written once in `pub/capitol.js`); in a line of plain text and inside a sentence each name ends with "Committee": "The Senate Health and Human Services Committee and the Commerce and Consumer Protection Committee put it on hold." The sentence under the step line says "the committee" or "the two committees hear it together", not the name again (A-14). Committees are counted, not steps: "the first 2 of 3 Senate committees". **The Capitol's action lines** (More details) are said through `pub/capitol.js` `capitolWords`: "Sent to ...", "put it on hold", "filed its report: pass it with changes (House draft 1)", "The full House agreed to move it on (House draft 1). Next: the House Finance Committee." for second reading and "Passed the House." only for the vote that passes it (third reading), "The Senate formally took it up (its first reading)."; never "Referred to HHS/EIG", "deferred", "measure" or a roll call (C-10). A day's actions, which the Capitol dates without a time, go in the order they happen (`actionRank`). "Last official action" has a row only when the list of every action is not drawn; the Capitol's own wording is one quiet link away, on its bill page. `tests/capitol_words_test.mjs` (every real line in the practice data), `tests/step_line.py`. |
| **SB 1548**, **HB 2121** | SB1548 | a bill number has a space in prose and emails; addresses and ids do not. |
| **About 4 minutes** | five minutes, a few minutes (for the first visit) | the first visit says its time once. A letter is "a few minutes". |
| **neighbor**, **favor**, **recognize**, **organize** | neighbour, favour, recognise, organise | American spelling; straight apostrophes only in code, curly in words. |
| **Waiting for approval** (R-277) | In review, To review, Testimony in review, Second approval (as a state), submitted for your approval | testimony sent and not yet approved; the second step is "Waiting for second approval". The approver's own action is **to approve** ("2 testimony drafts to approve", "Yours to approve"); the writer's button is **Send for approval**, after a send-back **Resubmit**; the approver's buttons are **Approve** and **Send back** (never Request changes); the state after is **Sent back**. Review stays the name of the screen. |
| **to-do** (R-277) | task, To do, Follow-up, Also to do | one personal step, on a bill or about a person: "Add a to-do", "To-dos", "Other to-dos". "Follow up" stays as a verb on a button. |
| **in 4 hours**, **4 hours overdue**, chip **4h** (R-277) | under an hour, <1h, in 59m, 7h left, Due in 7 hours, 3 days away | time left, rounded down, from one place (`staff5/model.js` timeLeft, spanOf): "28 min", "4 hours", "3 days". Past a deadline it is "overdue"; "late" is kept for late testimony the Capitol still takes. |
| **today 9:30 AM**, **Tue 3/17, 9:30 AM** (R-277) | Tuesday, March 17 at 9:30 AM, TUE 17, 03-20-26 | a moment, from `whenAt`: "today", "tomorrow" or "yesterday" with the time, else the weekday and date. A deadline line is "due today 9:30 AM · 28 min"; a hearing "Tue 3/17, 9:30 AM · Room 430" (never "Rm 430"). Emails and the partner update keep the date, since they are read later. |
| **Legislative day 27 of 58** (R-277) | Day 27 of 58 | always labelled. Never in the partner update. |
| **Practice as** (R-277) | Practise as | American spelling, as above. |
| **To answer** (R-277) | Needs you (the Inbox's tab) | what the Inbox asks of you. Today's group stays "Needs you today". |
| **I help on CTFH** (R-277) | I support CTFH, You support it | helping with a coalition's bills. Its switch says **Show its work on my Today**. "Support" and **Monitor** are positions only. |
| **Lateral**, **Decking** (R-277) | two definitions | Lateral: the last day a bill can reach its last committee in the chamber it is in. Decking: the last day it can clear that committee and be filed for its floor vote. Help's glossary and the bill page's stage note say the same. In the partner update the names give way to what they ask ("the deadline to reach its last committee"). |
| **Drive, Slack and the calendar** (R-277) | Where things live | Help's topic about places outside the app; the app's own map is "What each place is for". |
| **Mine · My coalitions · Team** (R-277) | Every coalition, The team's, Everyone (as a whose switch) | whose work a list shows, in that order, on every list that has the switch (ui.js `whoseSeg`); **Team** always means everybody's work. My coalitions shows only to someone who helps on one. The partner update's audience is **For: Partners / Staff**, never "Team". |
| **I'm going** / pressed **You're going** (R-277) | Take me off, I'm not going after all | the one going toggle, the same button on Today, the bill page and the hearing page (ui.js `goingBtn`). A menu item may still say "I'm not going after all". |
| **Open Doc** (R-277) | Open the Google Doc, Open (for the Doc) | the one Doc button, with the document and new-tab icons, on every screen (ui.js `docBtn`). Likewise **Mark filed** (`filedBtn`) and **Show all 12** / **Show fewer** (`showAllBtn`). |
| **Undo filed** (R-277) | Unmark filed, Unfiled, Unmarked | taking back a Mark filed pressed by mistake: beside **Filed** on the bill page, under the row on the hearing page, and in Today's row "…" (fix 12). Its message is "Filing undone. It is approved and ready to file again." |
| **You're offline** (R-277) | No connection, Network error | the line at the foot of the page while the browser has no connection (fix 8); an error message stays until its X is pressed. |
| **Filter** (R-277) | Filter or sort, a row of filter chips beside the list | the one button that narrows a list, at the end of its heading row before the "…", with how many filters are on (ui.js `filterBtn`): Bills, Legislators, Supporters, the Inbox, the prep board. A pill switch (Today · This week, Mine · Team) only shows the same list another way; a section's own pages are tabs. |
| **File testimony**, **Approve testimony**, **Draft testimony** (R-279) | (a row that names only its bill and a time) | the step's name starts every row's second line on Today, in plain bold with the rest quieter (today.js `STEP`; a card's own sentence already says it): Draft testimony, Send for approval, Revise testimony, Approve testimony, Second approval, File testimony, Update testimony, Write the public ask, Ask the chair for a hearing, Note to letter-writers, Approve email, Fix email, Send email, To-do, Follow up, Reply, and for news Bill update, Hearing update, Deadline alert. No chip or icon: chips made each row too dense (Nate 10/13); colour stays urgency (A-5); the words after it never repeat it. |
| **Places** (R-277) | (nothing: search found no pages) | the first group in the top search box and on the search page: the app's own places and Help's guides, at most 3. |
| **+4 more** / **Show all 18** (R-277) | (lists with no end) | a day of This week shows 6 rows then "+4 more"; Today's groups, This week's asks and long lists show their first 8 to 25 then "Show all N". |
| **About this bill** (R-277) | Details (in the open bill) | the facts under an open bill's step (stage, committee, chair, deadline, sponsors), folded on Today and open beside Bills. A bill with no hearing yet says **Hearing needed by Mon 3/30 · in 14 days**. |
| **Late, still accepted until 2:00 PM today** (R-277) | late testimony until 2:00 PM, Testimony was due yesterday 2:00 PM (beside it) | testimony past its written deadline that the Capitol still takes until the hearing starts, said once (model.js `lateLine`), never beside the deadline it missed. A coalition helper reads a Capitol deadline as what it asks: **Bills must reach their last committee by Mon 3/30**; the names (Second lateral) stay for owners, admins and Help. |

**Hawaiian:** ʻokina is the character ʻ (U+02BB) in Hawaiʻi and in place names (Oʻahu, Kauaʻi, Molokaʻi, Hawaiʻi Island); kahakō where
the name has one. **kūpuna** is the plural (elders) and **kupuna** one elder (the "I'm a…" title). The Legislature's own titles and
descriptions stay as written (they say "Hawaii"). Spelling per the Pukui and Elbert dictionary (Wehewehe).

*Reason.* Consistency and standards (NN/g): a person who has learned "alerts" in one place should not meet "reminders" in another. Each
synonym is a small tax on every reader; for people reading in a second language it can be a wrong turn.

### C-16 After the first visit, an ask is a full page, one a visit (R-237, Nate 10/11)

Nate: "Instead of cards on the home page, it should be a full page similar to what someone would have experienced during
onboarding. That should hold for any of the post onboarding asks we have of people." Home's asks to give or join (find
my legislators, save your profile, new issues in a followed topic, the three moments, bring a friend, keep the tracker on
your phone) are pages in the first visit's frame (`pub/nextask.js`), not Home cards. Exactly one may open on the first
arrival of a new day, before Home, in that order, and only when the person opened the tracker itself: never on arrival
from an alert, an email or a shared link (they came for that page), and never when testimony on something they follow is
due within a day (Home, with that bill on top, comes first; the ask waits for the next day). "Not now" is an equal choice
in the bar (outlined, beside the filled button) and lands on Home; it quiets that ask for 14 days, then 60, then for good
(the profile ask keeps its own quiet, `nudgeOk`), and after any "Not now" no page comes for a while that grows: a week,
then three weeks, then three months (Nate 10/11; the review had found that someone who checks in every morning would
otherwise meet one six mornings running); an ask done starts that count again. "Welcome back · one quick thing, then Home"
over the drawing says why the page is there and where both answers lead. What stays where it is: finish your testimony,
Meet HIPHI, the asks right after an action (C-3's Mahalo order), and between sessions Home's "Get ready for January".

*Reason.* Nate's decision; a card at the end of Home went unseen (R-232: about 5,700px down on a phone). Whether a page on
arrival helps more than it annoys is a guess until real use: what settles it from January is how many later visits answer
the page (done versus Not now, counted since 10/11: backend 170, Staff v2's First visit > "Asks on later visits") and whether visitors who
met one come back less (`log_day` counts returns). A page on arrival costs a tap
before Home, which is why it is one a visit, never in front of a deadline or a link, and always skippable.

---

## Staff v6 (body.staff6, R-336, 23 Oct 2026)

These rules apply only inside `body.staff6` (`staff6.html` and `staff6/`). The public tracker and Staff v2 to v5 keep the
rules above. Where a v6 rule and an older one differ, the v6 one wins inside staff6; where v6 says nothing, the rule above
holds. Each entry names the rule it amends and carries its reason, so it can be applied to a screen it did not foresee (How
to use this, point 3). The source is backend `docs/requests/R-336/V6-SPEC.md` (the build spec: sections 4, 7, 8, 12 and 13)
and its assessment (`assessment.md` in the same folder). Nate's ask, which every rule here serves: "It still feels far too
overwhelming with too many things to do in too many places" (R-336, 22 Oct), and the spec's one-line test for every choice:
**details wait until asked for; the way to every job is always in sight, labelled.**

### A-2 on v6: count controls in view, not kinds

**Limit: 12 controls in the work column on the first laptop screen, for every person** (NT KV KR JS SY LR PH JMM in the
practice copy, on their busiest day). Each control in view counts; a button repeated down a list counts every time it
appears. Persistent navigation is still counted apart and judged by B-13.

*Reason.* Nate named "many buttons, chips" as the cause of the overwhelm. Counting kinds misses exactly that: Patti's v5
Today repeated "I'll ask" and "Message Lauren" on each chair-ask row and "I'm going" on each hearing (40 controls in view,
`ph-today-1440.png` in the assessment), and A-2 as written called that one kind each.

### A-3 on v6 (with D16): one filled button; a row carries at most one tonal button

**One filled button per screen or region** (a region: the open item beside a list, a sheet, the phone's action bar), for the
step this person takes now. **A row carries at most one tonal button**, and only when the step is the viewer's own and is
due today, late, or a chair ask inside its notice window. Every other row opens on click, and the open item holds the
actions. Never two buttons on a row. This narrows Nate's 9/20 amendment (one primary repeated per item in a list of equal
items) inside staff6: the repeated button is tonal, and only on the rows that need it now.

*Reason.* Less per screen without hiding anything: the action stays one click away in the open item. D16 settles the
critic's contradiction between quiet rows (V04) and the two-click chair ask (V13): the viewer's own urgent step keeps its
button on the row, so asking a chair stays 2 clicks from Today, and other people's steps stop crowding the list.

### A-4 on v6: one step larger

| Size | Face | For |
|---|---|---|
| 14/20 | Lato | labels, counts, times and bill numbers only |
| 16/24 | Lato 400 | every sentence, row line, button and field |
| 18/24 | Poppins 500 | item names: bill nicknames, issue names, people, in rows and cards (spec 12.1) |
| 22/28 | Poppins 600 | section headings |
| 28/34 | Poppins 700 | page titles |

13px is never used (`--t13` reads as 14px inside body.staff6); the sizes are the same on a phone and a laptop. **Bold (600
and heavier) only for headings, the page title and the filled button: at most 25% of the visible text.**

*Reason.* Nate asked for larger type (R-336). In v5, 542 of 702 font-size uses were 13 or 14px; the same step up already
made the first visit (R-174) and Home (R-295) feel warmer. Item names moved to 500 (12.1) because at 600 every row's name
counted as bold: weight is for marking headings and the one button, and when every name is bold nothing stands out.

### A-5 on v6: Palette B "Morning Reef", and status by exception

The tokens live in `staff6/css/tokens.css`, loaded right after `pub/base.css` and before every v6 stylesheet, scoped to
`body.staff6` (they also redefine `pub/base.css`'s names, so the CSS copied from v5 turns warm at once). Palettes A "Sand & Lagoon" and C "Golden Hour" are kept there as
comments, so a swap is one edit (D6). Contrast is WCAG, on page / card / wash:

| Token | Hex | Use | Contrast |
|---|---|---|---|
| page | #F7F3EA | the page ground (body, sidebar) | |
| card | #FFFEFA | cards, list boxes, panels, sheets | |
| wash | #EEE7DA | wells, tiles, selected tab ground, inputs' fill | |
| hair | #E3DACB | inset hairlines only (decorative) | |
| ink | #25221E | headings, names | 14.3 / 15.7 / 12.9 |
| body | #433B33 | sentences | 9.9 / 10.9 / 8.9 |
| muted | #685D52 | meta, times, bill numbers | 5.8 / 6.4 / 5.2 |
| field | #8C7F70 | input borders, checkbox edges (UI) | 3.5 / 3.9 |
| action | #0B6E73 | the filled button, links, focus ring, selection | 5.4 / 6.0 / 4.9; white on it 6.0 |
| action-press | #095A5E | filled button hover and press | white on it 8.0 |
| action-wash | #E2EFEE | tonal buttons, selected row, current place | action on it 5.1 |
| leaf | #3A7533, leaf-wash #E5F0E1 | done, filed, approved (with a check icon) | 5.0 / 4.7 on its wash |
| late | #955A00, late-wash #FBEFD9 | ONLY a deadline due today and "Late, still accepted until …" (clock icon) | 5.1 / 4.9 on its wash |
| bad | #AF3328, bad-wash #FBE9E5 | ONLY a step still to do whose deadline passed (alert icon and the word) | 5.7 / 5.4 on its wash |
| coral | #EE7B4F | celebration fills only, ink text on it | 5.7 |
| band | #3B332B | the practice-copy band | sand text on it 11.2 |

- **The colour of time (amended 27 Oct 2026, Nate's decision via R-344, Decision 2 of the at-a-glance review):
  amber for due today, red only once the deadline has passed.** **Amber** for a deadline that falls today (the same
  calendar day in Hawaiʻi, not yet passed: "in 1 hour", "3:00 PM today", a clock icon) and for "Late, still accepted
  until …" (R-250; the late-testimony amber, "late testimony until 1:10 PM", stays amber). **Red** only for a step still to
  do whose deadline has passed (an alert icon and "overdue"). Anything further out is neutral, with how long is left in
  words beside the date ("Fri 3/27 · in 3 days"; the words come from `model.js` `spanOf`/`timeLeft`, one way everywhere).
  One function decides it (`ui.js` `timeTone`, used by `countdown()` and `urgentMark()`). **Missed** is said in neutral
  with a circle-x icon, never red (spec 11.4, amending D3). **Green** only for done. **Coral** only for celebration.
  This replaces "due today (or within 2 hours) is neutral: first in the list, the time in bold, a clock icon".
- **A soft colour for each person (27 Oct 2026, Nate's decision 3 via R-344):** every staff member's initials circle has a
  tint of their own, so "whose" reads before a word does. Six tints, none of them the amber, red or green of status, the
  action teal, or any action tile's hue (indigo, violet, steel, blue, rose, slate: a face never reads as a job; R-344
  fresh-eyes review, 27 Oct), spread far apart, the same in every palette (fixed values; each palette's card is white or
  near it), initials at WCAG AA (A-7): apricot #FAD9C2 / #7E3A0F (6.3), aqua #C4ECE6 / #0B514B (7.2), khaki #EAE3B4 /
  #4F450C (7.4), blush #EFD6E0 / #6A2F47 (7.3), taupe #E6D8C9 / #4F3E31 (7.3), stone #DFE1E3 / #383F44 (8.2). Dark-mode
  pairs are worked out when A-21 is built. At most two letters in a circle (the first and the last: "JM"); the full name
  is its title. A person's tint is their place among everyone's ids, sorted
  (`ui.js` `tintOf`), so it is the same on every screen and device; the viewer keeps their own tint with an action-coloured
  ring. Faces are added beside names, never instead of them (`ui.js` `faceLead`; hidden from reading, since the words name
  the person), and where a face is added a repeated name goes (A-25). Legislators show their photo over their initial.
- Every status has its icon AND its word, from one function (`steps.js` `status()`); never colour alone (WCAG 1.4.1).
- **At most 5 text colours in view**: ink, body, muted, action and white on the filled button. Status colours are counted
  apart, when a status is shown (spec 13).
- Amber and red are measured by their real colours (the late and bad values), not by token name: the frame turned v5's
  `--warn-*` tokens neutral on purpose (12.8).

*Reason.* Nate chose warm island colours, "ocean teal and leaf green", with amber and red "only when truly late" (R-336).
In v5 every row due within a day carried an amber chip ("4h to file", "59m"), so amber was spent on half the list and
meant nothing. Red says "act now"; a missed hearing can no longer be acted on, so it is said plainly rather than alarmed.
Whether "due within 2 hours" should earn amber is a guess for the cold test with Kris, Patti and Julie to settle.
*Reason for the 27 Oct amendment (R-344).* On the practice day three things were due today with no colour at all, so a
skimmer could not find what came first (the at-a-glance review's blur test). Nate asked for "red only for due today or
missed"; his decision keeps red rarer than that: amber for today, red once passed, so red still means "act now, it is
late". The five-second test (no one reads amber as an emergency) settles whether this holds.

### A-6 on v6: 40px on a laptop too

**Every control is at least 40px on a laptop, tables included, and 44px on a phone.** Only inline links in running text
are exempt; A-6's 32px allowance for dense tables does not apply inside staff6.

*Reason.* "Roomy and soft", and the three teammates least comfortable with new tools. Low priority: if Bills' Table loses
too many rows to it, the table exemption may come back.

### A-8 on v6: space and soft surfaces, not lines

Sections are made by space and soft raised surfaces. **Three radii only: 12** (tiles, inputs, small panels), **20** (cards,
list boxes, panels, sheets) **and pill** (buttons, tabs, chips). **Warm shadows** `--v6-sh1` (a resting card), `--v6-sh2`
(hover, a sticky bar) and `--v6-sh3` (a sheet, a popover), **never a border on the same box**. **A list is one card**, its
rows separated by space or an inset hair line (16px in from both sides). No border lines on cards, the sidebar edge, the
header or under tabs. **At most 8 bordered elements on a first screen.**

*Reason.* Nate asked for fewer lines and borders and gentle depth; v5's CSS held 243 one-pixel neutral borders. He chose
the box itself for lists (R-303), so the box stays and only the lines inside it go. A guess until he and the cold test
look at it.

### A-12 addition on v6: page tabs never look like a switch

Page tabs show the open tab bold with a teal bar under it, never a pill, so they never look like the Mine | Team switch
(spec 13). Tab rows on phones are one row that slides sideways, the open tab scrolled into view and the edge with more tabs faded (Nate 25 Oct, walk 1: Testimony's five tabs wrapped onto two lines; this replaces the earlier "tab rows wrap" rule, 12.3).

*Reason.* A switch shows the same list another way; a tab goes to another page (C-15's Filter row). When the two look alike
a person cannot tell which one they are pressing, which is what A-12 forbids. A tab row that scrolls sideways hides the
tabs past the edge, and things hidden or hard to find are Nate's worst case.

### A-18 on v6: one picture, one meaning (R-344, 27 Oct 2026)

Each icon stands for one thing in staff6, and a soft round tile behind an action or kind icon is the one icon style (Nate's
decision 1, 26 Oct: "soft filled", like More's rows). **The Capitol building (`landmark`) is Legislators only**: a committee
line is a gavel, a bill's or a member's page at the Capitol is a web page (`globe`), a hearing notice the newspaper.
**The megaphone is Outreach only. Date chips use the clock; the calendar is Hearings. The check mark is done and approve
only** (Inbox marks read with the open envelope, unread with the closed one). **The Inbox is the tray**, on a phone's top
bar as in the sidebar, with the same number. **Where a legislator stands is the thumbs-up** (as the stances themselves).
**Session setup's Blocking is the warning triangle**; the circle with an x is Missed. More tools' rows each carry their
place's picture: people icons are Team (`users`) and People (`user-round`) only.

*Reason.* The at-a-glance review (R-336, 26 Oct) found one picture meaning up to five things (the check mark: done,
approve, support, Review and Mark read), so a picture could not be trusted without reading its words. The review's research (NN/g,
IBM Carbon) puts a working set at about 6 to 10 status and action icons, each with one meaning.

### A-20 on v6: "…" holds only what also lives somewhere else

"…" holds only rare actions that also exist in the open item or on the bill page. **No step of a job (hand off, Undo filed,
give an ask, change owner) is reachable only through "…".**

*Reason.* R-277 found occasional jobs hiding behind "…" menus (Undo filed only under "More for this hearing", handing off
a draft only in a Today row's "…"). Nate: being unable to find things "would be the worst".

### A-24 on v6: every person, every place, the whole page

On every person's busiest practice day, at 1280 and 1440 and on a 390 phone: **at most 3 things in the work column, no side
panel until an item is picked, at most 5 text colours, 12 controls in view** (A-2 and A-5 above). Spec 8's targets, held by
`tests/staff6_budget.py`:

| Where | Target |
|---|---|
| Today, laptop | ≤30 controls, ≤250 words, ≤1.2 screens, ≤4 groups, 1 filled button |
| Today, phone | ≤2 screens, ≤30 controls |
| Patti's Today | ≤4 labelled buttons in view |
| Bills, first laptop screen | ≤25 controls, 0 codes in rows |
| Legislators | ≤25 controls, ≤180 words |
| Supporters, first screen | ≤25 controls, ≤15 filter choices shown |
| Session setup | 5 groups, no part over 1.5 screens |
| Every row | ≤4 facts |
| Every screen | ≤30% of text at 14px or under · ≤25% bold · ≤8 bordered elements on the first screen · 3 radii · ≤5 text colours · 0 amber or red marks on a day when nothing is late or due today · 0 weekly-used pages behind a menu (a More-page destination counts as 2 taps) |
| The sidebar | ≤11 rows for staff, ≤15 for leads; rows are the links only, not the Lead tools heading or Collapse (12.4) |

**One exception (spec 13):** a person's own Today rows may run past the length target (screens and words), because R-274
wins: each of a person's own items is its own row, never bundled. Recorded in `DESIGN-AUDIT.md` §4.

*Reason.* R-264 and R-269 both found every first screen "inside budget" while the whole pages overwhelmed: v5 passed while
Nate's Today was 1,978px, 658 words and 68 buttons or links and Patti's had 40 controls in view, because the test measured
Nate's first screen only, so a helper's crowding was never counted. Nate asked for a per-screen count with lower limits
than v5 (R-336), for everyone.

### B-2 on v6: the staff journeys' budgets

Clicks or taps from where the job starts (usually Today) until the job is done, by mouse and by keyboard, each at or below
v5's measured count; v6 adds no steps to Approve, Mark filed and Undo (spec 2). Measured by `tests/staff6_journeys.py`.

| Journey (Staff v6) | Budget |
|---|---|
| Approve a draft / send it back / resubmit | 2 / 3 / 1 |
| Ask a chair for a hearing and record it | 2 clicks from Today |
| Record the chair's reply | 2 |
| File testimony | 0 clicks to find it, ≤3 steps in the app |
| Hearing day on a phone | room and time 0 taps, I'm going 1, my approval 2 |
| Turn someone off and hand over their work | 4 |
| Prepare one 2027 issue | ≤8 |
| Sort one new bill | ≤5 |
| Save a supporter group | 5 |
| A partner's QR link | 2 |
| Inbox and Help | 1 visible tap |
| Give a to-do with a due date | 4 (by hand until the test walks it) |
| Set Away with a cover | 3 (by hand until the test walks it; until W30's migration, a hand-over without a date) |

*Reason.* Nate asked for fewer steps per task than v5, proved by test (R-336). Only four staff journeys had budgets, and
none covered chair asks, filing or covering for someone.

### B-13 on v6: every job a role does has a visible, labelled door

- **Laptop and tablet (768px and wider): the sidebar**, always shown, always labelled (spec 3.1): Today, Hearings,
  Testimony, Outreach, Bills, Legislators, My issues, then Inbox and Help, then Lead tools by role, More tools and You.
  **Exactly two counts**, Today's and Inbox's.
- **Phone: the bar Today · Hearings · Testimony · Bills · More** on every route (D2). More is a labelled page, not a menu,
  naming every other place; Search and the Inbox sit in the top bar.
- **Rare tools together in More tools** (`#/tools`), the same at every width, never only inside an account menu.
- **Places a role never uses are left out**, with D8's one quiet line saying they exist ("Admins also have: Session setup,
  People. Ask Nate.").
- Sub-pages are one row of page tabs at the top of the page, never in the sidebar as well (D12).

*Reason.* Under v5's rule the Inbox sat only in the initials menu, Review had no door but Today's card, Sort new bills was
behind Bills' "…", and four places moved into the initials menu below 1100px. Nate: "ease of navigation [is] extremely
important. If people are unable to find things because they are hidden or hard to find, that would be the worst"; and
features are kept for everyone and shown by role.

### B-14 on v6: things to do are never folded away

On Staff v6 too, **anything a person must do is never behind a closed fold, "Show more", hover or "…"**. Folds are only
for detail inside one item, for what is done, and for reference. **One exception (spec 13, Nate's "straight through"
picks, 23 Oct):** Today's Coming up shows the next 7 days in full, then one line "N more later · the first by …". Nothing
due within 7 days is folded, and the line says when the first folded item is due. Recorded in `DESIGN-AUDIT.md` §4.

*Reason.* Nate's "quiet until needed" covers details, not jobs. v5 folded Coming up, where the prep task had to be opened
by hand (R-316), and folded Getting started. The 7-day line keeps a long season off the first screen while saying when
the next folded thing falls due, so nothing is hidden on the day it matters.

### C-14 on v6: a name and one short line

**Each row is a name plus one short line** (the step, the time, and whose only when it is someone else's) at 16px or
larger; everything else lives in the open item. **A first screen leads with one short sentence about what is next**, not a
paragraph.

*Reason.* Applying C-14 to Home made it feel warm and welcoming (R-295). Kris, Patti and Julie, the teammates least
comfortable with new tools, read every word; Kris's v5 phone card held 7 lines per item.

**One exception (Nate's picks, 25 Oct, R-336 walks 3 and 4): an issue card on My issues' Deadlines view** may hold its
name, its next step and two chamber cells (From the House | From the Senate, one short line a bill), under a heading that
says the deadline once ("Must clear Second lateral · Mon 3/30"). These are cards, not list rows; every other view of My issues keeps a name and
one or two short lines. *Reason.* Nate's goal for an issue is one bill through, ideally one per chamber, understood "along
with what to do next in a quick glance"; a split (one chamber past the deadline, the other not) cannot be seen on one line,
and he chose this card from twelve mockups drawn with real practice data. The cells say each bill's state only; the
deadline is put in words once, in the health line.

### C-15 on v6: words, not codes; one wording per state

Rows and headings say things in words:
- **Committees by their short names** ("House Transportation", `steps.js` `committeeName`).
- **Deadlines as what they ask** ("must reach its last committee by Mon 3/30", `deadlineWords`).
- **No version codes (HD1, SD2) and no P1** (P1 is the same fact as Strong support, R-175). The bill number stays, small and
  plain, after the name ("HB 1562", D15; nickname first, R-271).
- **Codes, versions and deadline names live in About this bill, the session calendar and Help** (deadline names also for
  owners and admins). The legislative day moves from Today's header to the session calendar.
- **One name per act** (spec 8), checked by `tests/staff6_words.py`.
- **One wording per testimony state** (`steps.js` `testimonyState`): **Writing · With an approver · Second look · Ready to
  file · Filed**, plus **Missed**. A draft not yet started is "Writing · not started"; **"sent back" is a lower-case flag**
  on Writing that names nobody (11.5, 12.6).

C-15's word list holds where it does not conflict; where it does (Waiting for approval, Sent back as a state, the
legislative day, codes on staff screens), this wins inside staff6.

*Reason.* Nate named codes like HD1, SD2 and P1 as part of the overwhelm (R-336). On the practice day v5 showed 19 code
tokens on Patti's Today, 22 on Nate's, 18 on Kevin's This week ("Budget decking", "Second triple filing", "HHS/CPN") and 70
on Legislators. One word per state means a person learns the pipeline once, wherever they meet it. "Sent back" names
nobody because nothing records who sent it; naming them needs a migration.

### A-25 (new, Staff v6): replace, don't add

**A new thing on a daily staff screen (Today, This week, a bill, My issues) replaces something already there or goes
elsewhere.** A build that adds one names what it removes, and the whole-page budget test (`tests/staff6_budget.py`) fails
otherwise.

*Reason.* Each review added and almost nothing left: staff5 grew from 19,719 to 23,935 lines of code between 13 and 22 Oct
and from 46 to 55 modules, and its 18 switches were all additions. R-264's cause 2, "Added, never taken away", still held.
A-23 already says the same for Home.

### Rules every v6 builder keeps (spec 7)

1. One filled button per screen or region; every other action tonal or text.
2. Rows are a name plus one short line (D15, D16); everything else lives in the open item.
3. Nothing a person must do is behind a closed fold, "Show more", hover or "…"; "…" holds only rare actions that also
   exist in the open item or on the bill page.
4. No hover-only controls (touch has no hover).
5. Every action has one home (V07) plus at most its Today row; other screens show its status and link to the home.
6. One word per fact (`steps.js`); C-15's word list stays where it does not conflict.
7. Status by exception (D3, A-5 on v6).
8. Replace, don't add (A-25): anything new on a daily screen names what it replaces.
9. Keep every feature: each F-id in `features.json` (214) has a v6 home; one that cannot be housed is a blocker to report,
   not a quiet loss.
10. Accessibility: one h1, labels, visible focus, focus back on the row after Back, toasts in an aria-live region, 44px
    targets on phones and 40px+ on laptops (inline text links excepted), nothing by colour alone, Reduce Motion, no
    sideways scroll at 320, 390, 768, 1024, 1280 and 1440, nothing lost at 200% zoom at 1280.
11. Vanilla ES modules, `S` and `render()`, Lucide icons through `icons.js` (add with `node tools/icons.mjs`), no emoji, no
    frameworks; comments say why.
12. Words plain, no codes in rows, "e-cigarettes", Nate's button words keep his casing.

And three of the integrator's decisions (spec 12):
- **Hearing cards may carry the viewer's own step button** (tonal) on Hearings › This week and on the sitting page,
  besides the step's home, Today and the bill (12.2, amending 11.1): the card is where hearing-day work happens.
- **Danger buttons only inside a confirm** (12.5).
- **A step counts as found when its row is in view on Today** (12.7): the row opens the item that holds the button.

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
17. **Nothing to do is folded.** On Home, is any thing a person can do behind a closed toggle? Does the button that
    led here say what the page opens on? (B-14)

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
| Home, the whole page (A-23) | 4 blocks of 2 shapes, 1 filled button, each bill once | 2 phone screens for 3 issues, 3 for 16 | `tests/home_calm.py` |
| Laptop, in view at once (A-24, Staff v3) | 1 side panel, 5 things, 7 text colours, 1 filled button outside a list | as budget | `tests/staff3_budget.py` |
| Text contrast (A-7) | 4.5:1 | 4.5:1 | `DESIGN-AUDIT.md` |
| Breakpoints (A-9) | 360/900/1100 | — | grep |
| Journey steps (B-2) | per table | — | by hand (gap G-1) |
| Public reading grade (C-10) | 8 | 8 (content: no rise over the baseline) | `tests/words_test.mjs` |
| Actions shown on a row or card (A-20) | 2 | 2 | review |
| Instructions needed for a core journey (B-11) | 0 | 0 | cold-start test |
| Staff v6, every person and place (Staff v6 section: A-24, B-2 on v6) | spec 8's targets | as budget | `tests/staff6_budget.py`, `tests/staff6_journeys.py` |

## Changing this document

A rule changes when Nate decides something that contradicts it, or when a rule turns out to be wrong
in practice. Change the rule in the same commit as the code, say why, and note it in the HANDOFF
entry. A screen that knowingly sits outside a budget is recorded as an exception in
`DESIGN-AUDIT.md` with its reason and date — not left as a silent failure.
