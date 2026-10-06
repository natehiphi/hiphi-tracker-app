# hiphi-tracker-app (frontend) — Claude Code instructions

Public repo `natehiphi/hiphi-tracker-app`, deployed by GitHub Pages from `main` at
https://natehiphi.github.io/hiphi-tracker-app/. The backend (schema, migrations, sync, runbooks, `HANDOFF.md`) is
the private repo in `../backend`. **Read `../backend/HANDOFF.md` first** in any session: section 3 holds the
newest entries (3.70, 3.69, …) with every decision Nate has made and what is still open.

**The plan of record until the 2027 session: `../backend/docs/ASSESSMENT-2026-09.md`** (R-096: the whole-project
assessment of 29 Sep 2026 and Nate's 15 decisions of 30 Sep). Read it with `../backend/REQUESTS.md` before any UI work:
its section 9 lists every recommendation for the public page and the staff app and where it stands, section 10 is the
latest handoff. Put a new screen or feature on that board before building it; the freeze dates (no new "try both"
versions from 15 Oct 2026, no new features from 1 Dec 2026) and the 10-item check pause are in the backend CLAUDE.md
(rules 13 and 14).

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

## Where things stand (verified 2026-10-01)

- **Staff v2 is the staff app at the main address** (`index.html` and `staff.html`); the old app stays at `classic.html`
  until Nate's walk-through (R-010), and until then a data-layer change goes into both (`node staff/tools/parity.mjs`).
- **The public tracker** (`track.html`, `pub/`): people follow issues (R-018); the first visit is R-023's, with two endings
  under A/B test (R-098, R-121); every bill link carries its session year when it is not the current one (R-110); the page
  reports its own errors (R-111); one share everywhere and a link newcomer left to finish (R-113, R-114); the My issues
  link, the walkthrough link, "What's next" and the calendar feeds (R-123 to R-126); the first screen loads first and every
  other screen on first use (R-122; "How the page loads" below); Home's first card counts the day's deadlines and twin bills
  are one card (R-131); Staff v2's Week view has "This week's asks" to paste into the newsletter or a post (R-132).
- **Six live A/B tests (R-135, 10/3; `docs/FEATURES.md`, `../backend/docs/AB-TESTS-PLAN.md`), with `onb`, `join` and `save` (R-184) built and off:** every new browser gets
  a version of each by its own coin toss (`pub/variant.js`), Nate switches each on or off and picks winners in Staff v2 >
  Session setup > Tests, and every count is per version. A change to one of those screens keeps both versions working
  until the winner is picked; `python3 tests/abtests.py` checks them.
- **Four builds of 10/4 (R-099, R-094 step 5, R-061, R-088 part 2) and R-060** (`docs/FEATURES.md`, last section): the Home
  ending's "how" words, the suggested bills counted, the Follow button's hint, Sort new bills' suggested issue, and each
  bill draft's plain-language note (public "How it has changed", staff Public tab).
- **Your profile (R-147, 10/4):** More's first row is the person (initials on the More tab and a laptop's header); only with a
  number or an email; it replaced Settings (`#/settings` opens it). "I'm a..." titles (`pub/titles.js`, also used by Staff
  v2) open each letter with the two that fit the bill; where they live goes only to their own lawmakers. `docs/FEATURES.md`.
- **The first visit, six ways (R-164, 10/5):** five plans from the doc "Onboarding: five plans" are working first visits
  tested against today's: test `onb` in `pub/variant.js` (six versions, a switch per version in Staff v2 > Tests, backend
  136), shapes in `pub/plans.js`, screens in `pub/onb.js` (shared: picks, one, hello, join, wrap) and `pub/onb-p2.js`,
  `onb-p3.js`, `onb-p4.js`; the sign-up's words and its own test `join` (backend 138) in `pub/onb-join.js`; later visits'
  one card on Home in `pub/onb-later.js`. While a browser is on a plan, `end`, `fv` and `email` are never met. Force one
  with `?ab=onb.p1` (to `p5`); `python3 tests/plans.py` walks them all. `docs/FEATURES.md` has the details.
- **How each feature is built, file by file: `docs/FEATURES.md`.** Read the paragraph for a feature before changing it.
- **Email to the public is off** until Nate says so; the words describe it as working (R-101).
- The design standard is `docs/DESIGN.md`; the audit `docs/DESIGN-AUDIT.md`.


## The three apps (all in this repo, all static, no build step)

| App | Entry | Code | Who |
|---|---|---|---|
| Public tracker | `track.html` | `pub/` | residents new to advocacy |
| Staff v2, the staff app | `index.html` = `staff.html` | `staff/` | the team, from 9/21 |
| Old staff app | `classic.html` | `app.js`, `styles.css`, `simple.css`, `stops.js` | a way back, until about 9/28 |

**The old address is Staff v2 (Nate, 9/21: "make the old webpage be the new site").** Keep `index.html` and
`staff.html` identical (same stylesheets, same script). Until `classic.html` and its code are deleted, every
data-layer change still goes into BOTH (see "Two staff apps" below). `APP_URL` in `staff/data.js` is the folder
itself, so links made by either app open the root.

`public.html` + `public.js` is an older public page that is still live and out of scope (Nate has been asked
whether it should redirect to `track.html`). `mockup-hybrid.html` is a reference mock.

## The sandbox: `?demo=1`

Every app has it. The real 2026 session frozen at **Mon 16 Mar 2026, 9:00 HST**, loaded from
`demo/snapshot.json`; nothing is saved and nothing reaches Supabase. Use it for ALL UI work while the live
session is dark (until January 2027).
- Public: `&season=off` (imagined end of session), `&seed=1` (sample past actions). In the public sandbox every
  `hiphi_` storage name is read and written as `<name>_demo` (a shim at the top of `pub/core.js`, R-067), so a
  practice run never changes the real page in the same browser. A test that presets storage with
  `page.evaluate` on a sandbox page still works (the shim applies there too); one that writes storage on a
  non-sandbox page and then opens the sandbox will not see it.
- **The testimony walkthrough starts with the bill (R-068, 9/28):** `pub/helper.js` goes stance (if not said) → "Get to
  know the bill" (`knowScreen`: plain summary, HIPHI's stance, and `hiphi_points`, the bill's talking points from
  `bills.talking_points`, migration 084, each a toggle into the letter; offered only to someone on HIPHI's side) → About
  you (name, optional email, why, an optional sign-off with five short tap-in ideas, the same for letters and emails: Mahalo, Thank you, Sincerely, Respectfully, Aloha, R-157; no town) → the letter (no bill
  description, no automatic closing) → Capitol account once → send. Staff edit the points in Staff v2; the first 248
  were drafted by Claude (`../backend/docs/talking_points_2026.json`, `tools/apply_talking_points.js`).
- **The between-sessions sandbox shows the real end of 2026** (`&season=off`): the snapshot keeps each bill's final
  stage and last action as `b.final` (`backend/tools/build_snapshot.js`), which `demoLoad` uses; a snapshot without it
  falls back to the old imagined ending.
- **The sandbox hides some live bugs** (R-067 found three): `loadFeatured`, the between-sessions wins on the first
  screen and invented outcomes (`core.js` forces most bills dead). Check a change to a live query against the live
  path too (`track.html` on localhost reads production; add the `globalPrivacyControl` init script so the
  first-visit counting skips you).
- **Share pages** (`b/<HB2121>.html`, `i/<slug>.html`, R-067; one per ask since R-169): a shared link's card leads with
  the ask and the link opens it (Nate 10/5). `b/HB2121-testify` ("Speak up by Wed, Mar 18: ..."; opens the testimony
  walkthrough), `-ask` (the chairs' email), `-floor`, `-conference`, `-governor`, `-follow` (opens the issue), and
  `b/HB2121` for the bill's ask of the moment; the words and the choice are `tools/share_cards.mjs` (pure; tested by
  `tests/share_cards_test.mjs` on every push). Every share passes its ask: `shareFor(b, h, { ask })`, `billShareUrl(b,
  ask)`, `shareAsk(b, x)` in bill.js; the routes `#/bill/<n>/testify|email|ask|floor|conference|governor` open the ask
  (`openAsk`). The pages carry no `<meta http-equiv="refresh">` and no `og:url` (Facebook's robot followed the first to
  the general card and links to the second without `?via=`); keep it that way. Built by `node tools/share_pages.mjs`
  (public views, public key; `--check` to preview, `--out DIR`), hourly January to June and daily otherwise by
  `.github/workflows/share-pages.yml`, which commits only when a page changed. `404.html` sends a `b/` or `i/` link
  whose page is not built yet to the tracker, `b/HB2121-testify` to `#/bill/HB2121/testify`. Each card has its ask's
  picture, and a bill with an issue that ask's picture for its issue (topic icon, colour, name): `pub/og/<ask>.jpg` and
  `pub/og/<ask>/<issue>.jpg`, drawn by `python3 tools/og_images.py` (`--redraw` after a change to the look; look at them
  before committing), only the ones `tools/og_wanted.json` lists as in use; the job draws new ones itself. In a text the
  picture is most of the card. Testimony "takes a few minutes" everywhere (Nate 10/5); the walkthrough records how long
  it took (`logTime`, backend 143). The practice copy has its own pages, `b/demo/` and `i/demo/`, built from
  `demo/snapshot.json` at its March day, which its shares and Staff v2's practice copy use; they rebuild with the job,
  so a snapshot rebuild needs nothing more.
- **Follow means the issue** (R-067): a bill with an issue is followed through its issue (`followToggle`); only a bill
  with no issue is followed alone. The followed state is a filled blue button with a check (`.btn.secondary.on
  [aria-pressed="true"]` in `base.css`, R-061); every Follow button sets `.on` and `aria-pressed`.
- **The second visit** (R-067): `app.js welcomeBack()` keeps the previous visit in `S.prevVisit` before noting this
  one, and asks for an email on the second day someone comes back (not the thirtieth). Home's `sinceStrip()` says what
  happened on their issues since then (results first; a hearing already drawn as a card is one summary line), and the
  first time someone sees a committee's decision on a hearing they acted on it gets the small `burst` once
  (`hiphi_results_seen`). Past hearing rows on a bill page keep "You emailed the chair" etc. `homeScreenCard()` offers
  Add to Home Screen on phones after a first action (Android's prompt is kept in `S.installPrompt`).
- **Between sessions** (R-067): `winsCard()` and the first screen lead with the bills HIPHI backed that became law
  (`winsIn(yr)` in core.js) plus `EARLIER_WINS` (2025, from Nate; add lines there). The bill's story's last page uses
  the count only, never a hand-listed win (`whyWords` in lessons.js; another bill's 2025 win read as out of place, R-143). Each issue's `outlook` (migration
  079; drafted by `backend/tools/apply_outlooks.js`, edited by staff in the issue form) shows on Home's issue rows, the
  issue page and "Your issues, this year and next". `meetCard()` shows the Meet HIPHI card staff post in Staff v2
  (Make a link page; `site_cards`, `public_site_cards`). Home between sessions offers "Write to my legislators".
- **Speed** (R-067): the Supabase library is pinned (`SUPABASE_JS` in core.js, preloaded in track.html; change both
  together), and boot starts `loadReference()` and `loadPool()` alongside the catalog instead of after it.
- **Testimony leads** (R-068, Nate 9/27): wherever there is a hearing the main action is "Write my testimony" (bill page
  and action cards), for everyone whatever they think of the bill; the quick email is under More ways to help. The
  walkthrough (`pub/helper.js`) is a sequence (`seqOf`): "Where do you stand?" only when they have not said Support or
  Oppose, About you (a reason is required when the letter is their own), Your letter (Next; Copy, Email it to myself,
  Download), the Capitol account once per browser (`hiphi_me.capitolAcct`), then one tap copies the letter and opens the
  Capitol page, and on return "Yes, I saw it" / "Something went wrong". The letter follows the person's stance
  (`sameAsHiphi`); HIPHI's wording and ask only when they agree. A saved draft shows as "Finish sending your
  testimony" (`testimonyDraft` in core.js) and a card on Home; it counts as having been here. Sending follows the
  bill's issue with "Stop following <issue>"; a newcomer from a link ends at Home, which leads with what they did
  (`app.newcomerNext`, X10-2).
- **The first visit's short version** (R-067 #11): the A/B test `fv` since R-135 (coin toss; `?fv=short` and `?fv=full`
  still force one) replaces the lesson with one page, "Your voice counts here" (`stepVoice`, counted as step 'voice',
  backend 080). The lessons also open on their own at
  `#/learn/<bill|session|hearing>[/<bill id>]`, linked from bill pages, Help and the short page. On a laptop that page
  (screen 'learn') shares the first visit's two-column grid in `start.css` (R-173): without it, the sticky intro let the
  lesson scroll over its heading and the story's words over its drawing; `public_journey.py` section 3b checks it. "Coming up" offers
  testimony when it is due within 48 hours (one action, #12).
- **Small-screen breakpoints are in em** (`22.4375em` = 359px, `16.1875em` = 259px, `20em` = 320px at the normal
  text size), so they also respond when someone sets their phone's text to 150% or 200% (WCAG 1.4.4, R-067). Write
  new ones the same way; `Page.setFontSizes` over CDP emulates a larger text setting in Playwright.
- Staff v2: `&as=LR` (Lauren), `&as=KV` (Kevin, regular teammate), `&as=JS` (Jess, reviewer), `&as=KR` (Kris,
  supports every coalition), `&as=SY` (Saya, supports CTFH); default is Nate (admin). The avatar menu has "Practise
  as someone else". `&season=off` shows the between-sessions app. The sandbox follows live rules: drafts only on
  bills with a position, messages only to the people they are for, email shown paused.
- The snapshot is fetched with `cache: 'force-cache'` plus `?v=20260921n`. **Whenever `demo/snapshot.json`
  changes, bump that `v` in `app.js`, `staff/data.js` and `pub/core.js` in the same commit**, or browsers keep
  the old copy and Nate reports the change as not working.
- Rebuild: `node ../backend/tools/build_snapshot.js` (reads production; read-only).

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

## Public tracker (`track.html` + `pub/`)

Reads only `public_*` views and RPCs; no account needed; magic-link sign-in.
- `pub/app.js` frame + hash router (`#/`, `#/start/1-4`, `#/bills` (My issues), `#/find`, `#/find/category/<key>`,
  `#/issue/<slug>`, `#/find/issue/<slug>` (the old coalition-group page), `#/list/<slug>`, `#/bill/HB1563`, `#/legislators`, `#/legislator/<id>`, `#/more`, `#/allbills` (every bill HIPHI tracks, by hearing status, from a row on More, with a search and three filters: topic, HIPHI's position, where it stands; R-091), `#/help`, `#/signin`,
  `#/settings`, `#/privacy`; legacy `#bill=` links redirect). `pub/core.js` data + plain-language layer.
  `pub/ui.js`, `pub/actions.js` shared parts; `pub/billtext.js` "Read more about the bill" (the Legislature's summary,
  HIPHI's reasons, the latest draft's whole text on the Capitol website), on the bill page and the letter's first step (R-178). One module + CSS per screen: `start`, `home`, `mybills`, `find`,
  `bill`, `people`, `more`, `helper`, `committees`, `allbills` (its rows are My issues' `billRow` with `pos` and `watch`,
  so it is a table from 1100px; it loads one session's tracked bills from `public_all_bills` and their hearings). `pub/art.js` drawings (`islands('oahu' | 'mauicounty' | …)`).
- Design system `pub/base.css`: HIPHI blue ramp `--p50..--p900` (`--p700 #00698E`), orange for celebration
  only, red for danger only, Roboto 700 / Lato, type sizes 13/14/16/18/22/28 (36 only `h1.hero` on desktop); the
  first visit reads one step up (14/16/18/22/28, the tokens redefined on its `<main>` in base.css, R-174, DESIGN C-14).
  `pub/wide.css` (loaded last): 900 and 1100px breakpoints, 1120px frame, `.cols` + sticky `.side`, `.grid2/3`.
  Each screen keeps its own desktop rules in its own CSS.
- Screen contract: `{ tab, tabs?, noTabs?, title?, render(route), wire(route), bar?(route) }`. Screens reach
  the frame through `app.render / app.go / app.openHelper` on the `app` object exported by `core.js`.
- **How the page loads (R-122, 10/2; `tests/perf.py` measures it, `tests/boot_live.py` checks it, `node
  tools/check_split.mjs` guards it in CI).** The first screen must not wait for everything. **The kernel:** `pub/kernel.js`
  is the state, the client, the catalog, the follows, the first visit's state and the page's small helpers; `pub/core.js`
  is the bill-level code (bills, hearings, actions, the stage words) and re-exports the kernel, so every screen keeps
  importing from `core.js`; only the modules on the first wave (`app.js`, `ui.js`, `fx.js`, `keep.js`, `visitlog.js`,
  `variant.js`, `errlog.js`, `topics.js`, `start.js`) import from `kernel.js`, and the kernel never imports `core.js`,
  `stops.js` or `demo.js` (the sandbox's data, loaded only with `?demo=1`). `app.js` loads `core.js` in `boot()`, after the
  early first screen. **The first visit** is two halves: `start.js` (the frame and the topics screen, kernel-only, plus
  `rank.js` for the tiles' scores) and `start-rest.js` (every later step, the lessons' pages, the address and email
  steps), which `start.js` loads 400 ms after the topics' paint together with `core.js` and then the lessons; until they
  are in, a later step draws a skeleton and comes back. Shared helpers are exported from `start.js` and imported by the
  rest (read-only: the lessons through `lessons()`, the example bill back through `REST.exampleBill()`). `track.html`
  carries the base styles and the first wave's `modulepreload` lines; an inline script at the top of the head reads what
  the browser remembers and preloads what it will draw first (a first visit still to do: `start.js`; anyone else:
  `home.js`, `core.js`, `stops.js`, `rank.js` and the database library's parts; a `#/bill/` address: the bill page and the
  lists), and fetches the catalog with plain `fetch` and the public key in the address (no preflight) before any module
  arrives, the issues slim (only what the topics show; the full rows come with the library). `app.js` draws a newcomer's
  topics from that (or the copy kept from last time) before the library, the lists or the bills are asked for
  (`earlyFirst`), then `boot()` loads the rest. Every other screen is a `lazy()` stand-in in `SCREENS` that loads its module
  and stylesheet on first use (`SCREEN_CSS`, in `CSS_ORDER` so `wide.css` stays last); the walkthrough, the tour, the
  header search's combobox (on focus) and Find's search code come the same way; the remaining stylesheets are fetched a
  moment after the first screen. Rules that follow: a module on the first wave must not import a lazy one or `core.js`
  (`keep.js` exists so Home does not pull the first visit in; `LESSON_TITLES` live in `topics.js`); a helper the first
  screen needs goes in the kernel, a bill-level one in `core.js`; a new first-visit step goes in `start-rest.js` and its
  name in `STEPS`; a new screen gets a `lazy()` entry, a `SCREEN_CSS` entry and its place in `CSS_ORDER`; a new module
  every screen needs gets a `modulepreload` line; nothing on the early path may touch `S.supa` directly (use `supa()`).
  The split was made by two scripts kept in the handoff's record (HANDOFF 3.77); by hand, keep `kernel.js` free of
  bill-level code and the first wave free of `core.js`, and the check will say when either slips.
- **The header search suggests as you type (R-032, 9/21).** From 900px the header box lists what the words so far
  match, seven rows at most, then "See all results" (Find). A word search lists policies: issues (a matching topic
  first), with a bill on an issue shown as that issue, so a House bill and its Senate twin are one row; then HIPHI's
  bills on no issue and, beside them, the session's other bills (Nate, 9/26: search every bill). A bill number lists
  every bill with it. The database search takes the 80 most recently active other bills, not the first 80 by number. The
  behaviour is `pub/suggest.js`, a combobox written for both apps' header boxes: arrow keys, Enter, Esc, ARIA, only the
  rows the window has room for, the list kept in place (dimmed) while the database answers, and what was typed kept
  through a redraw, since both frames rebuild the header on every render. What matches is `headerSuggest()` in
  `find.js`, on Find's own `parse`/`rank`/`serverSearch`. No list on Find itself or on a phone, where Find's results
  appear as you type. The `.sg` styles live in `base.css`, which Staff v2 loads too; a host's icon rule must not reach
  them (the magnifier's is `.hdr .hsearch > .ic`).
- Nate's product rules (9/19):
  1. A first visit is follow a few issues + maybe say where you stand (R-018, 9/21: people follow issues, and
     bills reach them through the issue). No action is pushed (today's version; the test plans 1 and 3 offer one, with
     an equal "Not now", as Nate asked in R-150 and R-164: an exception in DESIGN-AUDIT section 4). Later visits prompt
     actions easiest first (`actionCard`: "Send a quick email · 2 min" until the first action, then testimony).
     Someone whose stance differs from HIPHI's (`agrees(b) === false`) is sent to the Capitol's own form.
  2. The alerts ask is a step in the flow (right after the issues since R-146, 10/4; one box in `pub/alerts.js`: a
     mobile number first, email as a link; a number goes to `text_signup`, backend 121, and is only kept until texts
     are set up; an email goes to `sendEmailLink`); giving either is the consent for both hearing alerts
     AND HIPHI's own advocacy alerts, in one "keep me updated" opt-in (Nate, 9/20, HANDOFF 3.5 - this reverses
     the earlier rule that action alerts stayed a separate, off-by-default choice). One ask per visit, always
     skippable. An existing account only ever GAINS choices from an ask, never loses one. Email to the public
     stays paused regardless of what an ask would consent to. **Since R-184 (Nate 10/6) the ask is "Save your profile"**
     (`profileAsk`, `profileLede`, `followAsk` in `pub/alerts.js`): the line over the box says what the profile keeps
     (the brainstorm's picks A1 and B1: https://claude.ai/artifact/6nDhS6Loh5k1MMnukptc3B, Nate picks other words by
     number there), the box and its consent words are unchanged. It is the first thing seen after a first follow or
     letter: an issue page's or a category's Follow, and a bill page's "Follow the issue", open it in the alerts sheet with
     "You're following ..." over it (the follow's toast comes after the sheet closes); after a letter it sits right under
     the "Mahalo", above "What happens next". No second ask on Home after a skip (Nate). The old "Get alerts" ask is the
     test `save`'s second version, off (backend 148; `?ab=save.alerts` shows it); `tests/profile_ask.py` checks both.
  3. Progress is the person's own. Community numbers appear only inside one bill or hearing, from 10 people.
- Parked at Nate's request: exact YouTube hearing links (needs a YouTube Data API key in Settings).

## Staff v2 (`staff.html` + `staff/`)

Task-first. Tabs: Today, Bills, Legislators, Outreach. `staff/app.js` frame + router (`parseRoute`), `staff/ui.js`
shared parts, `staff/staff.css` + `staff/css/*.css`, one module per screen (`today`, `review`, `bill` with
`activity` `public` `pathway` `testimony` (R-027), `bills` with `filters` `bulk`, `triage`, `memo`, `search`, `legislators`,
`legislator`, `supporters`, `person`, `issues` (Outreach > Issues and `#/issue/:id`, R-018), `lists`, `list`,
`emails`, `composer`, `me`, `setup`, `help`, and from R-022 `hearing` (`#/hearing/:id`, one committee sitting) and
`coalition` (`#/coalition`, `#/coalition/:id`, Outreach > Coalitions)), plus
`look.js` (the quick look, opened from Today and Bills) and `conversation.js` (conversations with legislators), which are
components rather than screens.
- **Sort new bills lists the untracked bills people follow (R-059, 9/26; migration 074 `triage_followed()`).** A panel
  under the card, "Followed on the public tracker", most followed first; "Sort it" puts one on the card, decided like any
  new bill. A bill set aside comes back only when someone follows it after that decision. Only follows made from an
  account count (a browser-only follow never reaches the database). The sandbox shows sample counts (`DB.triageFollowed`).
- **The header search suggests as you type (R-032, 9/21),** from 900px, through the public header's `pub/suggest.js`:
  `headerHits()` in `search.js` lists tracked bills whose number or shown name match (a leading number first, moving
  bills before dead ones), bills not tracked yet (`DB.searchUntracked`, which matches every word in the title or
  official description, 9/26; a row opens Search at that bill, where its Track button is, since the bill page knows
  only tracked bills), issues, legislators (`matchLegs`) and supporters (loaded on first use), a row for each kind
  in turn up to seven, then "See all results" into Search, which also has untracked bills. Enter with nothing
  highlighted keeps `exactBill`: an exact number opens that bill. No list on the Search page itself. "sd 12" and
  "house 3" mean that district for supporters too (`districtQ`, exported from `legislators.js`).
- Bill page tabs: Overview, Activity, Pathway, Public, Testimony (keys 1-5). Testimony lists every testimony draft the
  tracker made that someone sent for review: this bill's filed ones and its companion's, then its issue's, a search,
  then its category folded. `onNextUp` (testimony.js) decides what the Next up card keeps, so a filed draft shows once.
  Hearings load for 60 days; `DB.loadDraftHearings()` fetches the older ones drafts point to. The tab strip fits five
  tabs by its own width (container `bwtabs` in bill.css), never wrapping one out of sight.
- Look: `pub/base.css` tokens, five type sizes 13/14/16/18/22.
- Desktop frame: from 1100px a left sidebar; 900–1099px header tabs; below that the phone frame. A screen's
  default export may set `wide` (whole window: tables) or `narrow` (760px: review, forms); default 1120px. The
  action bar is the last child of `<main>` and sits under its content on wide screens. Layout helpers
  `.sv-cols` + `.sv-aside`, `.sv-grid2/3`. The frame redraws when the window crosses 900 or 1100px.
- `menuSheet` / `pickerSheet` open against the clicked button on desktop (arrow keys, Home/End, Esc). Real forms
  use `openSheet`. Never `window.confirm`; use `confirmSheet`.
- **Bills on a phone (9/19, backend 3.1y).** Three control rows became two and 505px above the first bill became
  386. What holds it there: no quick filter chips (all three live in Filter, and `sheetOn` therefore includes the
  quick specs on a phone so a filter set in the sheet can be taken off without reopening it); the "where every
  bill stands" strip is a flat scrolling row with an inline `bl-stlab` label, hidden below 360px; the header's
  magnifier is hidden on any screen carrying its own `.bl-search`; and each row is a `.bl-prow` — the `<a>` row
  plus a `bl-plk` chevron beside it, because the button cannot nest inside the link. Desktop keeps the chips, its
  header search and the eye button, and none of these rules touch it.
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

### Shared pieces added 9/21 (R-022; backend HANDOFF 3.19)

- **Conversations with legislators are filed by issue** (`conversation.js`; migration 064): `logConversation({ bill,
  issueId, legislatorIds, text })` opens the dialog; `convSectionHTML` / `wireConvSection` draw a list for a bill (and
  its issues), a legislator or an issue. One meeting with three legislators is three `legislator_notes` rows sharing a
  `conversation_id`. `DB.conversations({ billId, issueIds })`, `DB.conversationRows(ids)`, `DB.addLegNote(legId,
  billId, body, { issueId, metOn, conversationId })`, `DB.updateLegNote(id, patch)` (refused after ten minutes, and the
  screen puts the note back), `DB.delLegNote`.
- **A hearing sitting** is every hearing row with the same committee and start time: `sittingOf(h)`, `agendaOf(h)`,
  `goersOf(rows)`, `goingWords` in `hearing.js`. "Going" is written on ONE row per sitting and read for the whole
  sitting, so a person is one Slack message, not one per bill. `DB.attend(hearingId, on, who = S.me.id)`; an admin may
  set anyone (064), and the database sends the Slack message; the screen only says so in its toast.
- **Handing work to one person**: change `bill_todos.assignee_id` or add `hearing_attendance` and the database sends
  the Slack message (064 `notify_assignment`); undone within two minutes, nobody is told (065). Never broadcast.
- `model.js`: `exactBill(q)` (an exact bill number opens the bill from any search box), `noticeByFor(stop)` (when the
  hearing notice must post, the 48-hour rule), `sessionClock(list).then` (the deadline after next, same shape),
  `plainAction(text)` and `OUT_PLAIN` (the Capitol's actions in plain words, once for every screen). Countdowns in
  `ui.js` round down, never up.
- `advocates.prefs` keys: `coalitions` (`'all'` or campaign ids: the coalitions a person supports; Kris all, Saya
  CTFH), `showMonitor` (Today shows hearings on monitor bills), `memo` (the memo's audience and coalition), plus
  `seen`, `sugg`, `views`.
- The header search is `pub/suggest.js` since R-032 (above); an exact bill number plus Enter still opens the bill
  (`exactBill`).

### Rules the suggestion feed must keep (Nate, 9/19)

Today's promise is a list you can clear. Suggestions are fenced off from it and must stay that way:
at most `SUGGEST_CAP` (5), **never counted in the Today badge**, never the word "due" or "overdue", never an
`urgentMark`. Every card prints its `why` line verbatim — that line is how someone spots that the app does not
know Kevin already rang the chair. Every card can be finished, put off for a fortnight, or refused for that bill
for good, each with Undo; since R-022 the three sit in the card's "…" menu beside one button (A-20). The heading says
"Nothing urgent" only on a day with nothing due at all; when a suggestion races this week's deadline it says "Worth
doing this week", and the P1 chair ask stays a dated task (Nate declined making it dated for every bill, 9/21). "Done" also writes the step onto the bill's timeline (`DB.addActivity`), deferred for
the life of the toast so Undo can cancel it; there is no call that removes an activity row.

## Two staff apps, one data layer

`staff/data.js` and `staff/model.js` are hand copies of `app.js`'s data layer and helpers.
- After ANY change to a Supabase call or shared helper, make the same change in both, then run
  `node staff/tools/parity.mjs` (must print `parity ok`).
- **Supabase hands back at most 1,000 rows per request** (the API's Max rows) and says nothing when it cuts:
  `.limit(2000)` still gets 1,000. A load that can grow goes through `allRows(o => S.supa.from('t').select('...', o)...)`
  (both files) and orders by something unique, ending with `id` or the primary key, or a row can repeat or fall
  between pages. Measured 9/21 (backend HANDOFF 3.20, R-034): in session the 60-day hearings load holds up to 4,000
  rows, and tracked bills pass 1,000 once 2027's are added to 2026's. The public page asks by id in slices
  (`inChunks`) or with a limit of 1,000 at most.
- Both write only these `bills` columns: `tracked`, `position`, `priority`, `stage_override`, `internal_notes`,
  `is_public`, `public_summary`, `public_action`, `public_action_until`, `nickname`. The database grants UPDATE
  column by column; a new column needs a migration first (see backend 057) or saves fail with
  "permission denied". That is the design working.
- **Priority is not a staff choice (R-175, Nate 10/5).** It follows the position: strongly support is P1, every other
  position P2, no position none. The database sets it (backend migration 144, a trigger on `bills`); `DB.updateBill` and
  `DB.bulkUpdate` add it to any patch with a position (`priorityOf` in `staff/data.js` and `app.js`) so the screen is
  right at once. Never add a priority picker back; the position pickers say "Makes it P1" (`POS_SUB` in `staff/ui.js`).
- Current app pitfall: `styles.css` has a global `input,select,textarea{width:100%}`; give new inputs in a
  flex or grid row an explicit width.

## Tests (`tests/`, Playwright for Python; output goes to `tests/out/`, git-ignored)

Serve first: `python3 -m http.server 8832` in this folder.
```bash
python3 tests/public_journey.py     # public: 482 checks, phone + desktop, the first visit (R-023) and a shared bill, ladder, off-season, the session lesson's label inside its drawing (R-179)
python3 tests/staff_desktop.py      # Staff v2: 503 checks at 5 sizes, Approve guards, menus, loading state
python3 tests/staff_flows.py        # Staff v2: 181 flow checks + data-layer parity
python3 tests/staff_clock.py        # Staff v2 Today: the Next deadline button, 89 checks (yours, a teammate's list, a quiet day)
python3 tests/staff_week.py         # Staff v2 Today's Week view (R-025): three kinds in time order, each deadline on its day, counts that agree with the side panel
python3 tests/density.py            # arrival px, competing controls, sizes, colours - DESIGN.md A-1/A-2/A-4/A-5
python3 tests/suggest.py            # header search suggestions (R-032), both apps: 190 checks at 1024-1440 and short windows, keys, redraw, live bills
python3 tests/staff_followed.py     # Sort new bills: the untracked bills the public follows (R-059), 40 checks at four sizes
python3 tests/staff_firstvisit.py   # Staff v2's First visit pages and the "Show in the first visit" switch (R-023): 212 checks at four sizes
python3 tests/visitlog.py           # the private first-visit counting (pub/visitlog.js): 36 checks, every Supabase request intercepted
node tests/rank_test.mjs            # the suggested bill's rules (pub/rank.js, R-094; plan and Nate's decisions: ../backend/docs/RECOMMENDATION-PLAN.md): 50 exact checks, no server needed
python3 tests/recommend.py          # the suggested bill on Home and Find in the sandbox (R-094): 23 checks, related issues included
python3 tests/staff_related.py      # Staff v2: an issue's Related issues (095, R-094): unlink, Undo, link another, Link again; 22 checks at two sizes
python3 tests/screens_smoke.py      # every public screen as three kinds of person, sandbox and live; fails on any page error (R-100): 90 checks
python3 tests/lists.py              # people's own bill lists in the sandbox (R-013): make, share, Undo, someone else's list, phone and laptop; 55 checks
python3 tests/lists_live.py         # lists on live data, signed out (R-013): the sign-in detour keeps the place; 7 checks
python3 tests/staff_lists.py        # Staff v2 Session setup > Advanced > People's lists: turn a list off and on (R-013); 14 checks
python3 tests/moments.py            # good news for results, honest countdowns, the session page (R-046), sandbox with ?seed=1; 44 checks
python3 tests/moments_live.py       # the session page and Home on live data, signed out (R-046); 6 checks
python3 tests/staff_daily_email.py  # Staff v2: a supporter email goes in the 4:30 pm email, Undo, Take it back, Session setup > Email (R-101); 13 checks
python3 tests/consent.py            # the sign-in page's "Keep me updated" starts empty; a hearing-alert ask turns on only hearing alerts (R-101); 5 checks
python3 tests/year_links.py         # year-proof bill links in the sandbox, with a 2025 copy of one bill served into the snapshot (R-110); 14 checks
python3 tests/year_links_live.py    # the same on the published site, with the share pages going where they say (R-110, R-169); 11 checks
python3 tests/errlog.py             # the public page's error reports: what is sent, what never is, the early catcher (R-111); 17 checks
python3 tests/uptime.py             # the published page draws four screens with no error, as the hourly GitHub job checks it (R-111)
python3 tests/share_links.py        # one share everywhere, the link newcomer, the share pages passing ?via= on, Staff v2's hearing back link and Help words (R-112, R-113, R-114); 24 checks
python3 tests/share_asks.py         # a shared link opens the ask it names, as a newcomer on a phone; every built share page leads with its ask, no instant redirect, no og:url, the ask's picture; the practice copy's own pages (R-169); 19 checks
python3 tests/links_keep.py         # the walkthrough link, the My issues link restored in a fresh browser, "What's next", the calendar feed and the finale's keep line on a phone (R-123 to R-126); 13 checks
python3 tests/perf.py               # the first screen's speed on the published site, throttled the same way every time (R-122): slow phone and 4G, three runs each, the middle one reported
python3 tests/boot_live.py          # the staged boot on the published site (R-122): a newcomer's first screen, the kept catalog (waited for, up to 30 s, and how long it took is printed), someone with an action lands on Home, and every way in ends with the full catalog (R-136); 13 checks
python3 tests/home_now.py           # Home's first card counts the day's deadlines; twin bills are one card naming the twin (R-131); 5 checks
python3 tests/abtests.py            # the live A/B tests (R-135): every version forced in the sandbox, the toss, the switches, every measure, nothing leaving under the privacy signal; the first visit's six versions (R-164); 69 checks
python3 tests/plans.py              # the five first-visit plans (R-164), each walked to Home on a phone, a laptop and between sessions, the sign-up and the later-visit card; 86 checks
python3 tests/fv_type.py            # the first visit is large and short (R-174, DESIGN C-14): every version walked on a phone, nothing under 14px, 14px only for labels, each lead sentence 30 words or fewer; 30 checks
python3 tests/drafts.py             # what each draft changed (R-060): the public bill page and Staff v2's Public tab, edit and Undo; 20 checks
node tests/issue_suggest_test.mjs   # Sort new bills' suggested issue (R-088 part 2): exact checks and a replay on the practice copy's 2026 bills; 11 checks
python3 tests/profile.py            # your profile (R-147): More's first row, the invitation, the picker, the story, initials, the letters' titles and where-you-live lines; 31 checks
node tests/titles_test.mjs          # the "I'm a..." list and the two-titles rules (R-147, pub/titles.js); 23 checks, no server needed
python3 tests/going.py              # going to a hearing in person (R-142): "I plan to go", How to get there, Home's plan, the calendar file, the walkthrough's last page, a cancelled hearing, Help; 100 checks
python3 tests/x10_close_loop.py      # after a first action from a shared link, Done goes Home, which leads with what they did and says "today" on the day; the bill tour waits to be asked for; "Stop following <issue>"; More's alerts row (X10-2, X10-4); 68 checks
```
Each takes the page to test as its first argument, so the published site works too (for example
`python3 tests/moments.py https://natehiphi.github.io/hiphi-tracker-app/`).
Hash-only navigation does not reload in Playwright: `goto` then `reload()`, then wait about 2.5s.
`public_journey.py` and `staff_desktop.py` print one `net::ERR_FAILED` / `Failed to fetch` in their `errors:`
line, from `demoLoad` in `pub/core.js`. It is the harness aborting the in-flight 5MB `snapshot.json` fetch when a
case reloads, not a regression — it appears with any snapshot, and a plain load of the same page has a clean
console. Checked 9/19 against both the old and new snapshot. Investigate only if the count changes.
A check that fails after an intended change is a test to update, not a reason to revert; say which and why.

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
