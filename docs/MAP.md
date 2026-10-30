# Map of the frontend (moved out of CLAUDE.md by R-230, word for word)

Read the part your task needs. CLAUDE.md keeps only the rules and pointers. The backend's map is `../backend/docs/MAP.md`.

## Where things stand (verified 2026-10-01)

- **Staff v2 is the staff app at the main address** (`index.html` and `staff.html`); the old app stays at `classic.html`
  until Nate's walk-through (R-010), and until then a data-layer change goes into both (`node staff/tools/parity.mjs`).
- **The public tracker** (`track.html`, `pub/`): people follow issues (R-018); the first visit is R-023's, with two endings
  under A/B test (R-098, R-121), and since R-232 (10/11) no address step; since R-249 (10/11) the first screen's lede says what HIPHI is (Nate: for the
  stranger from a link), the chapter strip ticks only a chapter that was done (a skipped one keeps its dot, reads
  "(skipped)" and gets no petals, C-7), a tile's name never breaks inside a word, the Mahalo page's button names the story as
  the strip does (C-15), and "Coming up" with nothing followed says why and offers "Pick your issues" back to the tiles
  (B-3; `tests/first_visit_fixes.py`); **since R-255 (Nate 10/12) the story has four stages**: the bill, its road, then a choice at
  each of its two moments ("needs a hearing, what should people do?" ask the chair or nothing; "its hearing is set, now what?" send
  testimony or nothing), each playing its scene and saying one sentence with the other path in one quiet line, third person,
  text light; the bar's Next sleeps until a choice is made (`wakeNext` in `pub/lessons.js`; the hosts in `start-rest.js` read
  `lessonLast` for the last stage); the story's bill leans to a followed bill still waiting for its hearing (`exampleBill`, so stage 3
  is in the present tense), then one with a hearing in 7 days, then one in its second chamber; `tests/story3.py`; **after the first visit each ask is one
  full page before Home** on a new day's first arrival (R-237, `pub/nextask.js`, DESIGN C-16: find my legislators, save
  your profile, new issues, the three moments, bring a friend, keep it on your phone), not a card on Home; every bill link carries its session year when it is not the current one (R-110); the page
  reports its own errors (R-111); one share everywhere and a link newcomer left to finish (R-113, R-114); the My issues
  link, the walkthrough link, "What's next" and the calendar feeds (R-123 to R-126); the first screen loads first and every
  other screen on first use (R-122; "How the page loads" below); Home's first card counts the day's deadlines and twin bills
  are one card (R-131); Staff v2's Week view has "This week's asks" to paste into the newsletter or a post (R-132).
- **Live A/B tests (R-135, 10/3, and `layout` since R-187, 10/6; `docs/FEATURES.md`, `../backend/docs/AB-TESTS-PLAN.md`), with `onb`, `join`, `save` (R-184) and `home` (since R-187) off:** every new browser gets
  a version of each by its own coin toss (`pub/variant.js`), Nate switches each **version** on or off and picks winners in
  Staff v2 > Session setup > Tests (R-192: two or more on, the test runs; one on, everyone gets it and nothing is counted),
  and every count is per version. **The practice copy follows the real switches (R-192)**, a random pick per practice
  visit; automated browsers keep today's; a link with `&abrest=today` (the tester sheet, See it, compare.html) keeps every
  test it does not name at today's. A change to one of those screens keeps both versions working
  until the winner is picked; `python3 tests/abtests.py` checks them. **Version A is the live test `layout` (R-187, 10/6):**
  `track.html` draws `pub/a/home.js` and `pub/a/bill.js` for a browser on it (tabs end with "You"); `track-a.html` only
  redirects there; Home's-top test is off while it runs. A change to Home or the bill page keeps version A working
  (`python3 tests/layout.py`). **Since 11 Oct (R-222, migration 169) `layout` has three versions, `calm`, `today`, `a`, off,
  fallback `calm`: the calm Home (`pub/calm/home.js`, DESIGN A-23, B-14) is everyone's Home** (R-250, 10/11: late testimony is its card when nothing is due on time, each bill followed on its own has a row, and the "Testimony deadline passed" line is amber everywhere, A-5); today's Home (`pub/home.js`)
  and version A stay testable, and following nothing still shows today's explore screen. `python3 tests/home_calm.py`
  keeps its page budget. The practice copy's band has "Next day" (the visit after the first, `&day=` and `&later`).
  **The tester sheet (R-185, 10/6):** Session setup >
  Tests > Tester sheet gives each group of a room of testers a link and QR code on the versions Nate picks, side by side,
  with a page to print (`#/setup/room`; `docs/FEATURES.md`; `python3 tests/room.py`). **Testers' paths (R-193, 10/6):** a
  group's link carries `&t=<sheet>-<group>`; `pub/testerlog.js` records each tester's screens, seconds and steps (backend
  150, `tester_paths`), shown under "What testers did" on the tester sheet (`python3 tests/testers.py`). **Ended tester
  links (R-204, 10/7):** `ENDED` in `track.html`'s first inline script; such a link goes to `test-ended.html` before the
  app starts (no way into the tracker, nothing recorded); `docs/FEATURES.md` has the rule.
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
  asks are full pages in `pub/nextask.js` (R-237). While a browser is on a plan, `end`, `fv` and `email` are never met. Force one
  with `?ab=onb.p1` (to `p5`); `python3 tests/plans.py` walks them all. `docs/FEATURES.md` has the details.
- **How each feature is built, file by file: `docs/FEATURES.md`.** Read the paragraph for a feature before changing it.
- **Email to the public is off** until Nate says so; the words describe it as working (R-101).
- The design standard is `docs/DESIGN.md`; the audit `docs/DESIGN-AUDIT.md`.


## The three apps (all in this repo, all static, no build step)

| App | Entry | Code | Who |
|---|---|---|---|
| Public tracker | `track.html` | `pub/` | residents new to advocacy |
| Staff v2, the staff app | `index.html` = `staff.html` | `staff/` | the team, from 9/21 |
| Old staff app | `classic.html` | `app.js`, `styles.css`, `simple.css`, `stops.js` | a look-only way back (F7-1, R-199), until Nate's walk-through (R-010) |

**The old address is Staff v2 (Nate, 9/21: "make the old webpage be the new site").** Keep `index.html` and
`staff.html` identical (same stylesheets, same script). Until `classic.html` and its code are deleted, every
data-layer change still goes into BOTH (see "Two staff apps" below). `APP_URL` in `staff/data.js` is the folder
itself, so links made by either app open the root.

`public.html` + `public.js` is an older public page that is still live and out of scope (Nate has been asked
whether it should redirect to `track.html`). `mockup-hybrid.html` is a reference mock.

## The sandbox: `?demo=1`

Every app has it. The real 2026 session frozen at **Mon 16 Mar 2026, 9:00 HST**, loaded from
`demo/snapshot.json`; nothing is saved and nothing reaches Supabase except one read of the A/B switches (R-192) and, on a
tester-sheet link, that tester's path (R-193, `pub/testerlog.js`; the band then says so). Use it for ALL UI work while the live
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
  walkthrough), `-email` and `-attend` (the committee email and the hearing itself, while one is ahead, R-205), `-ask` (the
  chairs' email), `-floor`, `-conference`, `-governor`, `-follow` (opens the issue), and
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
- **Ask a friend to speak up** (R-205, 10/7; `docs/FEATURES.md`): every share opens one sheet, `pub/askfriend.js` (the
  person picks the ask, sees the friend's card, a phone's own share menu or a laptop's Email it / Copy), each way out
  tagged `?sp=sheet|email|copy|alert` (the share pages and 404.html pass it on), marked done once and never asked again.
  The Mahalo puts "Bring one friend along" in the profile ask's place once that is answered; Share is on the bill page's
  first screen with its word. `python3 tests/askfriend.py`.
- **Share picture versions** (R-183, 10/6; backend `docs/SHARE-PICTURES.md`): the test `pic` in `pub/variant.js` has fourteen
  versions (today's, the issue up front, and Nate's twelve ideas), a switch for each in Staff v2 > Tests. What fits a bill and
  ask, and every word and date a picture shows, is `tools/share_pics.mjs` (pure; `tests/share_pics_test.mjs` checks every bill
  at every stage against the card's own readings: keep it green); `tools/og_templates.py` only draws what a spec says
  (`tests/share_pics_draw.py` draws all and fails on words that do not fit; run it after touching a template or the words).
  A version's page is `p/<version>/<same path>` (`tools/share_pic_pages.mjs`), its picture `pub/og/t/<version>/<hash>.jpg`
  (one file per distinct words; unused ones are deleted by the job), and `share-fit.json` lists which pages have which
  versions: `pub/sharepic.js` reads it so a share only offers a version that exists, and never counts one it did not
  show. No emoji on a picture (A-11), "neighbors" not "neighbours", no dashes, the issue's checked words only on the live
  site (`public_issue_share_words`; the practice copy draws drafts and marks them). `share-pics.html` is the gallery
  (`node tools/share_gallery.mjs`, then `python3 tools/og_images.py --versions`). A template change that should redraw
  every picture bumps `TEMPLATE_V` in `share_pics.mjs`.
- **Follow means the issue** (R-067): a bill with an issue is followed through its issue (`followToggle`); only a bill
  with no issue is followed alone. The followed state is a filled blue button with a check (`.btn.secondary.on
  [aria-pressed="true"]` in `base.css`, R-061); every Follow button sets `.on` and `aria-pressed`.
- **The second visit** (R-067): `app.js welcomeBack()` keeps the previous visit in `S.prevVisit` before noting this
  one, and asks for an email on the second day someone comes back (not the thirtieth). Home's `sinceStrip()` says what
  happened on their issues since then (results first; a hearing already drawn as a card is one summary line), and the
  first time someone sees a committee's decision on a hearing they acted on it gets the small `burst` once
  (`hiphi_results_seen`). Past hearing rows on a bill page keep "You emailed the chair" etc. Add to Home Screen on phones after a first action
  is a later visit's page since R-237 (`pub/nextask.js` 'phone'; Android's prompt is kept in `S.installPrompt`).
- **Between sessions** (R-067): `winsCard()` and the first screen lead with the bills HIPHI backed that became law
  (`winsIn(yr)` in core.js) plus `EARLIER_WINS` (2025, from Nate; add lines there). The bill's story's last page uses
  the count only, never a hand-listed win (`whyWords` in lessons.js; another bill's 2025 win read as out of place, R-143). Each issue's `outlook` (migration
  079; drafted by `backend/tools/apply_outlooks.js`, edited by staff in the issue form) shows on Home's issue rows, the
  issue page and "Your issues, this year and next". `meetCard()` shows the Meet HIPHI card staff post in Staff v2
  (Make a link page; `site_cards`, `public_site_cards`). Home between sessions offers "Write to my legislators".
- **Speed** (R-067): the Supabase library is pinned (`SUPABASE_JS` in core.js, preloaded in track.html; change both
  together), and boot starts `loadReference()` and `loadPool()` alongside the catalog instead of after it.
- **Testimony leads** (R-068, Nate 9/27): wherever there is a hearing the main action is "Help me write testimony" (R-296; "Write my testimony" before 10/17) (bill page
  and action cards), for everyone whatever they think of the bill; the quick email is under More ways to help. The
  walkthrough (`pub/helper.js`) is a sequence (`seqOf`): "Where do you stand?" only when they have not said Support or
  Oppose, About you (a reason is required when the letter is their own), Your letter (Next; Copy, Email it to myself,
  Download), the Capitol account once per browser (`hiphi_me.capitolAcct`), then one tap copies the letter and opens the
  Capitol page, and on return "Yes, I saw it" / "Something went wrong". The letter follows the person's stance
  (`sameAsHiphi`); HIPHI's wording and ask only when they agree. A saved draft shows as "Finish sending your
  testimony" (`testimonyDraft` in core.js), and as a "Finish your testimony" card on Home only when no full card there
  offers its hearing already (R-189, A-14; `tests/draft_once.py`); it counts as having been here. Sending follows the
  bill's issue with "Stop following <issue>"; a newcomer from a link ends at Home, which leads with what they did
  (`app.newcomerNext`, X10-2).
- **The first visit's short version** (R-067 #11): the A/B test `fv` since R-135 (coin toss; `?fv=short` and `?fv=full`
  still force one) replaces the lesson with one page, "Your voice counts here" (`stepVoice`, counted as step 'voice',
  backend 080). The lessons also open on their own at
  `#/learn/<bill|session|hearing>[/<bill id>]`, linked from bill pages, Help and the short page. On a laptop that page
  (screen 'learn') shares the first visit's two-column grid in `start.css` (R-173): without it, the sticky intro let the
  lesson scroll over its heading and the story's words over its drawing; `public_journey.py` section 3b checks it. "Coming up" offers
  testimony when it is due within 48 hours (one action, #12); its cards are plain notes that open nothing (R-247: a card that
  opened its bill or issue left the first visit with no way back). Links out of the first visit's middle steps lose the person.
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

## Public tracker (`track.html` + `pub/`)

Reads only `public_*` views and RPCs; no account needed; magic-link sign-in.
- **Words and languages (R-166 step 3, backend `docs/LANGUAGES-PLAN.md`).** `pub/i18n.js` (no imports but `pub/words/live.js`):
  `t('English words', { n })` says a screen's words by their English (identity in English and for any word without a passed
  translation, so the English page cannot change by converting a screen); `tn(n, 'issue')` is '{n} issue' / '{n} issues';
  `T('...')` marks a literal that is said later through `t(variable)`; `trText(kind, ref, english)` is HIPHI's own database
  text (nickname, summary, issue and category names) in the person's language from `public_translations`. Pass `t` values that are
  already escaped. A language's words are `pub/words/<code>.js` (default export `{ english: text }`), written by the panel
  (`node tools/translate.js --write-words ../frontend/pub/words`, backend), and **a language shows to the public only when its
  code is in `pub/words/live.js`** (after the fluent sample check and a first-visit walk); `?lang=<code>` previews one, never saved.
  `pub/langpick.js` is the picker (More, and the first screen), drawn only when a language is live. **To convert a screen:** wrap
  its literals in `t()` (a value in a sentence becomes `{name}`), run `node tools/words_extract.mjs` (rewrites `pub/words/en.json`,
  CI fails when it is stale), prove the English page is unchanged with `python3 tests/i18n_same.py <old tree's address> <this one's>`
  (serve `git archive origin/main` on another port), and load the list with `node tools/translate.js --load-words`. Converted so far:
  the first screen's topics step, the chapter row and bar, and More. Not translated, ever: the Legislature's titles and notices, names,
  the staff app, and the consent words (a lawyer confirms those first). Tests: `tests/i18n.py` (a made-up language), `tests/i18n_same.py`.
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
  the browser remembers and preloads what it will draw first, every module of its static import tree by name (a first visit
  still to do: `start.js` with `langpick.js` and `plans.js`; anyone else: the calm Home, `calm/home.js` with `home.js`, `goals.js`,
  `rec/kit.js`, `myletters.js` and the rest, with `core.js`, `stops.js`, `rank.js` and the database library's parts; a `#/bill/`
  address: the bill page with its twelve helpers and `bill.css`, `rec/rec.css`; `check_split.mjs` rule 5 fails when a module of
  these trees is not named), and fetches the catalog with plain `fetch` and the public key in the address (no preflight) before any module
  arrives, the issues slim (only what the topics show; the full rows come with the library). **Nothing in the head blocks the
  first paint** (R-357 5a): the rules the skeleton, the header and the welcome need are inline (`<style id="crit">`, same
  selectors as `base.css` and `start.css` and earlier in the page, so the real sheets win when they arrive), and Google Fonts
  and the four head stylesheets are `media="print"` links with a preload, switched to every screen as each loads (a listener,
  not `onload=`: `app.js` `cssOne` sets its own). `app.js` draws a newcomer's
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
     an equal "Not now", as Nate asked in R-150 and R-164: an exception in DESIGN-AUDIT section 4; and the test `act`, R-150,
     offers three ways to help on the page before the end, all equal, with Next: `waysFor`/`stepWays` in `pub/start-rest.js`,
     `tests/ways.py`). The first visit ends
     on **"See How I Can Help"** (`GO_HELP` in `pub/topics.js`, every version and the shared-link moment; Nate 10/6, R-190),
     and Home then opens on every thing to do this week, the soonest as its one main button; **nothing to do is ever folded
     on Home** (DESIGN B-14; after a first action from a shared link the same list is shown calm, no button singled out). Later visits prompt
     actions easiest first (`actionCard`: "Send a quick email · 2 min" until the first action, then testimony).
     Someone whose stance differs from HIPHI's (`agrees(b) === false`) is sent to the Capitol's own form.
     **"Just look around"** on the welcome (`leaveVisit('arrive')` in `pub/start.js`) goes to `#/find` and leaves the first visit
     undone, not skipped, since Home for someone who follows nothing is the first visit's own doorway (R-357 Light fixes g, 30 Oct);
     the other doors ("Leave, go to Home" on a step) still mark it left (`tests/first_visit_doors.py`).
  2. The alerts ask is a step in the flow (right after the issues since R-146, 10/4; one box in `pub/alerts.js`: a
     mobile number first, email as a link; a number goes to `text_signup`, backend 121, and is only kept until texts
     are set up; an email goes to `sendEmailLink`); giving either is the consent for both hearing alerts
     AND HIPHI's own advocacy alerts, in one "keep me updated" opt-in (Nate, 9/20, HANDOFF 3.5 - this reverses
     the earlier rule that action alerts stayed a separate, off-by-default choice). One ask per visit, always
     skippable. An existing account only ever GAINS choices from an ask, never loses one. Email to the public
     stays paused regardless of what an ask would consent to. **Since R-184 (Nate 10/6) the ask is "Save your profile"**
     (the first visit's own words since R-188: one line on what a profile keeps and why now, "No password needed" under
     the number, DESIGN.md C-3)
     (`profileAsk`, `profileLede`, `followAsk` in `pub/alerts.js`): the line over the box says what the profile keeps
     (the brainstorm's picks A1 and B1: https://claude.ai/artifact/6nDhS6Loh5k1MMnukptc3B, Nate picks other words by
     number there), the box and its consent words are unchanged. It is the first thing seen after a first follow or
     letter: an issue page's or a category's Follow, and a bill page's "Follow the issue", open it in the alerts sheet with
     "You're following ..." over it (the follow's toast comes after the sheet closes); after a letter it sits right under
     the "Mahalo", above "What happens next". No second ask on Home after a skip (Nate). **The visit's one ask is remembered in the tab's
     `sessionStorage`** (R-357 Light fixes h, DESIGN C-3): `hiphi_ask_asked` once the first visit's alerts screen or the follow
     sheet has been shown, `hiphi_ask_skipped` once either was skipped (`markAsked`, `askedThisVisit`, `skippedThisVisit` in
     `pub/alerts.js`; the kernel's `nudgeOk()` reads the first, so every ask path honours it, and "You're all set" leaves out
     "Alerts are off · Turn on alerts" after a skip; a reload keeps both, `tests/ask_once.py`). The old "Get alerts" ask is the
     test `save`'s second version, off (backend 148; `?ab=save.alerts` shows it); `tests/profile_ask.py` checks both.
     Once the first visit's ask is answered or skipped, that screen turns into the **"Mahalo!" page** (`stepThanks` in
     `pub/start-rest.js`; the plans' sign-up the same in `pub/onb.js`): same address, so Back finds it, the flower opens
     once, and it waits for **"Next: How a Bill Becomes Law"**. It is a page, not the 1.5 s moment (R-140, Nate 11 Oct:
     "too quick... a permanent page that a user hits next on"); the first action and a law keep the moment (fx.js celebrate).
  3. Progress is the person's own. Community numbers appear only inside one bill or hearing, from 10 people.
- Parked at Nate's request: exact YouTube hearing links (needs a YouTube Data API key in Settings).

### Version 2 (?v2=1, R-357)

Nate, 30 Oct 2026: "make the bold changes but keep the my issues tab".

- **The switch.** `V2()` in `pub/app.js` (opt-in for now; one later flip to `!== '0'` makes it everyone's) is read by a screen as
  `app.v2()`; the router keeps the query, so the flag lasts the visit, and the body carries `.v2`. A v2 screen is its own lazy module
  under `pub/v2/` picked in `app.js` (the bill page: `./v2/bill.js`), and `V2_CSS` brings `pub/v2/v2.css` after `rec/rec.css` (the idle
  prefetch leaves it out without the flag), so nothing of version 2 is fetched and v1 is unchanged without it.
- **The bill page, a slide (Part 1).** `pub/v2/bill.js` draws only the slide and its "More about this bill" row; everything else is
  `pub/bill.js`, whose `screen(draw)` takes the page's drawing (loading, bars and `wire()` are v1's) and which exports the parts the v2
  page reuses (`mainButton`, `recWhere`, `recCards`, `recTop`, ...). `pub/v2/slide.js` holds the slide's words (goal, sentences, times)
  for the pages that say them, to be shared with Home when its v2 part lands. Test: `tests/v2_bill.py`.
- **The letter in three screens (Part 2).** `pub/v2/letter.js` + `letter.css`. The walkthrough's frame and everything that writes, keeps
  and sends the letter stay `pub/helper.js`'s; version 2 adds screens to that one dialog through a small registry (`V2`, filled when
  `letter.js` loads) and borrows the letter's code through `HP` (both exported at the bottom and top of `helper.js`). `helperLoad` in
  `app.js` loads `letter.js` and `letter.css` with the walkthrough only when `app.v2()` is true; then `helper.js`'s `open()` and
  `openMail()` (a chair's email at a hearing) hand every new letter to `V2.open` first, so every "Help me write testimony" button,
  Home's "Finish sending your testimony" included, opens the new sheet without a change of its own; a draft started in the older
  walkthrough still finishes there. Screens: `v2l` (the letter: stance line, tappable points, own line, name), `v2a` (the Capitol
  account, first time only), `v2s` (send, then "Did it go through?"), `v2own` (the Capitol's own form, for the other side); an email is
  `v2l` then the older `mail` step. `app.openLetter2(bill, 'testimony' | 'email', { hearing, resume, friend })` opens it by name
  (`resume: true` only when a letter is waiting; it returns true when the sheet opened, a promise until the files are in). A draft is
  kept once the person has gone past the first screen, changed something, or chosen "I'll finish later" or "Not yet" (`x.touched`), with
  `v2: 1` in it. Test: `tests/v2_letter.py`.
- **Home's week (Part 3).** `pub/calm/home.js` (the calm Home, everyone's) draws, with `app.v2()` on, the white box under the slide as
  "This week" (`weekRows`, `weekBlock`; between sessions `issuesBlock` with a different last line): rows by day (a day label, the bill's
  name, what is due), a tap opening the bill, the slide's own bill lit and not a link, "Also due: HIPHI asks", no number (`alsoDue` finds
  the soonest: the same ranking as Find's "Needs voices this week": `suggestionList`/`recommendations` in `core.js`, without recording a
  showing) opening Find at that heading, and "Edit my issues" as the box's last line (it asks for `#/bills` and presses its Edit button
  once drawn: `S.rcEdit` is cleared on arrival, so Home cannot set it). Its rules are in `pub/home.css` under `.hm-v2` and `body.v2` (not
  `pub/v2/v2.css`: that file comes with the bill page, and with Home only after the idle load, so Home would draw unstyled); `V2_CSS` in
  `app.js` could take `home: ['v2/v2']` once the rules move. "See your 2026 session" left Home for You's row ("Your 2026 session", set in
  `pub/more.js` over `rec/you.js`'s). The slide's letter buttons call `app.openLetter2(bill, kind, opts)` (Part 2's) when it exists (`{ resume: true }`
  for a letter started) and otherwise open today's walkthrough. Home does not import `pub/v2/slide.js` (a static import would put it in
  Home's tree, which `check_split.mjs` rule 5 wants named in `track.html`); it already holds the same day words. Tests:
  `tests/v2_home.py`, and the version 2 set (three people, phone and laptop) in `tests/home_calm.py`.
- **The first visit, in eight taps (Part 4; "seven taps" up to the profile ask).** `v2()` in `pub/start.js` (reads `app.v2()`) swaps the
  flow: `FLOW_V2 = ['topics', 'issues', 'voice', 'alerts']` after the welcome, and `FLOW_LINK_V2 = ['followask', 'alerts']` for a shared
  bill's visit; past the last step is Home (`goStep`/`wire` call `finish()`). Welcome and topics are unchanged; Your issues starts two
  ticked per topic, at least one (`model2` in `start-rest.js`), under the line "The two most active under each topic are ticked; change
  them as you like."; then `stepWhy` (`start-rest.js`; the step the private counts know as `voice`, so no migration), "Why your note
  counts": the VOICES drawing from `art.js`, two sentences, two plain rows (testimony; an email to the committee chair, each with its
  time) and Next, seen once (`wiz().why`, so "Edit my issues" does not teach twice); then the profile ask as today (`alerts.js`,
  unchanged). Its Mahalo is the same cover (`coverAndFold`, which hands `end: true` to `coverEnd`): no band to fold into because Home
  comes next, so it plays, then holds still with the button "See How I Can Help" (`GO_HELP`, the eighth tap) until it is pressed (Enter
  or Space too; the page under it is inert, Reduce Motion shows it without animation), draws Home, and fades off it. `COVER_END_MS` (0)
  is the one-line switch to a cover that moves on by itself after that many milliseconds (2800 was tried), which Nate may choose at his
  check: then the visit is 7 taps again. The story, "This Year and Next" and "You're all set" are not in the v2 visit (v1 keeps them).
  The first visit's pages have no `body.v2` or v2.css (`app.js` leaves `FIRST_VISIT` routes out), so v2's first-visit rules are at the
  end of `pub/start.css`. Test: `tests/v2_first_visit.py`.
- **The story card (Part 4).** `storyCard()` in `pub/v2/story.js` -> `{ html, wire }`, no side effects on import: a card Home draws for a
  newcomer between the slide and the box. Home asks for it by a dynamic import that it does not await (a top-level await would deadlock on
  an import back into `pub/calm/home.js`); one redraw draws a card found late. "Read it" opens `#/learn/story`, whose Done returns to Home
  and calls `storyMark()`; "Not now" does too. The card's rules are inline in its markup. Tests: `tests/v2_first_visit.py`, and the card's
  place on Home in `tests/v2_home.py`.

## Staff v6 (`staff6.html` + `staff6/`), the calm rebuild (R-336, 23 Oct 2026)

Nate: "It still feels far too overwhelming with too many things to do in too many places." Staff v5 rebuilt around the
jobs (v5's data layer and sign-in kept): fewer things per screen and fewer steps per task than v5, by test, in a warm look.
The build spec is backend `docs/requests/R-336/V6-SPEC.md` (the assessment, `features.json` and the critic beside it); the
design rules are this repo's `docs/DESIGN.md`, section "Staff v6", and its accepted exceptions are in `docs/DESIGN-AUDIT.md`
§4.

**Address and practice copy.** The address is `staff6.html`; the practice copy is `staff6.html?demo=1&as=<initials>`.
People: NT KV KR JS SY LR PH JMM (and RK MR JM PT). Patti (PH) and Julie (JMM) are added by `staff6/data.js` in demo mode
only, never in `demo/snapshot.json` (other apps read it). Practice clocks: the default is Mon 16 Mar 2026 9:00 AM HST;
`&asof=2026-03-17T08:00:00-10:00` (Lauren's hearing day); `&asof=2026-03-20T08:00:00-10:00` (the HHS/CPN hearing, Kris);
`&asof=2026-03-18T08:00:00-10:00` (Kevin's deadline day); `&season=off&day=2026-11-05` (prep; `&season=off` alone is 18
Sep); `&season=opening` (sorting, 22 Jan); an `&asof=` in late April or late June for conference and the governor. The
`&season` and `&day` clocks are the app's own (`data.js` `DEMO_ASOF`); `&asof=` is honoured only by the walk tool
(backend `docs/walks/v6_walk.py`) and the staff6 tests, which rewrite `DEMO_ASOF` as the files are served, so a plain
browser ignores it.

**Status.** v6 lives beside v5 and replaces it only after Nate's yes, the cold test (Kris, Patti, Julie), the spec 8
targets and the old-links test (D7). **From 23 Oct every staff build goes into Staff v6; v5 gets bug fixes only** (Nate's
answer on R-336).

**Folders.** `staff6/` holds the modules and the frame's `staff.css`; `staff6/css/` the rest of the stylesheets.
`tokens.css` is loaded right after `pub/base.css` and before the others, scoped to `body.staff6`: Palette B "Morning Reef"
(A and C kept as comments), and it redefines `pub/base.css`'s token names so v5's copied CSS turns warm. Then one
stylesheet per place (`today.css`, `hearings.css`, `hearing.css`, `testimony.css`, `bills.css`, `triage.css`, `bill.css`,
`legislators.css`, `conversation.css`, `supporters.css`, `lists.css`, `partners.css`, `issues.css`, `coalition.css`,
`inbox.css`, `search.css`) and `steps.css` for the shared parts.

**Files by place** (spec section 9):
- **The frame:** `staff6.html`, `app.js` (routes, the old addresses, the sidebar and the phone bar), `ui.js` (shared
  controls, `sectionNav`, the page tabs), `staff.css`, `css/tokens.css`, `more.js` (the phone's More page, `#/more`),
  `tools.js` (More tools, `#/tools`), `devui.js`, `errlog.js`, `conflict.js`.
- **Today:** `today.js` (v6's Today), `today5.js` (v5's Today, kept whole for the exports other screens import through
  `today.js`), `team.js` (Team, leads), `partnerq.js` (Partner words to approve).
- **Hearings:** `hearings.js` (This week, Get hearings), `hearing.js` (a sitting), `push.js`, `chairask.js`, `moved.js`.
- **Testimony:** `testimonyplace.js` (the place and its tabs), `review.js` (Review mode), `filing.js` (the filing card).
- **Bills:** `bills.js`, `billshead.js` (the place head and tabs), `filters.js`, `bulk.js`, `look.js`, `triage.js` (Sort
  new bills), `suggest_issue.js`, `untracked.js`.
- **The bill:** `bill.js`, `activity.js` (Team talk), `public.js`, `pathway.js`, `standing.js` (where a group of bills
  stands, shared with Bills, issues and coalitions), `testimony.js`.
- **Legislators:** `legislators.js`, `legislator.js`, `conversation.js`, `profile.js`, `holding.js` (Holding our bills).
- **Outreach:** `asks.js` (This week's asks), `memo.js` (Partner update), `emails.js`, `composer.js`, `supporters.js`,
  `person.js`, `lists.js`, `list.js`, `qr.js`, `firstvisit.js`.
- **Lead tools:** `setup.js` (Session setup), `partnergroups.js` (Partners), `people.js` (People, hand over and turn off).
- **My issues:** `myissues.js`, `issues.js`, `issuestand.js`, `coalition.js`, `prep.js`.
- **Inbox, Help, Search, You:** `inbox.js`, `help.js`, `search.js`, `me.js`.

**The shared parts every screen uses.** `steps.js` with `css/steps.css`: the one word per fact and the one step card
(`status`, `testimonyState`, `whoseStep`, `actBy`, `askWords`, `goingWords`, `committeeName`, `deadlineWords`, `stepCard`,
`hearingCard`, `billRow` / `itemRow`, `listDetail` / `wireListDetail`, `placeHead`); buttons it draws carry `data-v6act`
and need no wiring (one document listener handles them). `billpane.js` `openItem` (the open item beside a list).
`terms.js` (Capitol words in plain words). `model.js` (derived logic, no DOM). `data.js` (the data calls as v5's, plus the
practice seeds). `icons.js` (the repo's shared Lucide set, imported as `../icons.js`; add icons with `node tools/icons.mjs
name1,name2`). Never delete or rename an export another `staff6/` module imports (grep `from './<file>.js'`).

## Staff v3 (`staff3.html` + `staff3/`), to compare (R-264, 12 Oct 2026)

Nate: "Make all these changes, but make them on a staff v3 so I can explore and compare." A laptop-first, calmer copy of
Staff v2 at its own address; **Staff v2 stays the team's app** until Nate picks one. `staff3/` began as a full copy of
`staff/` (same data layer, same sandbox, same sign-in) and differs where R-264's six batches changed it: the sidebar is the
five main places only (one count, Today's); sections with sub-pages show one tab row (`ui.js` `sectionNav`: My issues · All
issues · Coalitions, and Supporters · Emails); Today on a laptop is a list with the task you picked open beside it, and
Ahead and the Week view are one "This week"; Bills is one line per bill with the bill you click docked beside the list;
a bill has three tabs (Overview with Committees inside, Activity, Public); My settings fits one screen; "Second approver",
"supporter emails", "Second lateral" (C-15). Held to DESIGN A-24 by `tests/staff3_budget.py` (in CI). Your menu has
"Open this page in Staff v2"; v2's has "Open this page in Staff v3" for admins. **While both exist, a fix to a shared data
call or helper is made in both** (`staff/` and `staff3/`); v3's own browser keys are few (`hiphi3_rows`), so most
remembered choices are shared with v2. When Nate picks: v3 becomes `staff/` (and `staff.html`/`index.html` load it), or
`staff3/` and `staff3.html` are deleted. The plan and the reviews: backend `docs/requests/R-264.md`.

## Staff v5 (`staff5.html` + `staff5/`), the ease-of-use fixes (R-277, 13 Oct 2026)

Nate: "make a staffv5 and implement the 1-21 fixes and show mes there." A copy of Staff v4 made 13 Oct (frontend 7cb7a229)
to hold the fixes from the Staff v4 ease-of-use review (backend `docs/requests/R-277.md`: rows uncut, one word per thing,
one look per action, Back closes the side panel, Help that answers how-to, calm at session volume). The version links
in the menu show only to admins, and the sidebar says "v5". Held to A-24 by `tests/staff5_budget.py` and to the
per-person targets by `tests/staff5_people.py` (both in CI). **Staff v4 is left as it was**, to compare.
**From 15 Oct every staff build goes into Staff v5 and Staff v2 only; v3 and v4 are frozen** (Nate, R-291), R-267's later
pieces included, and the "made in both" rule above now means `staff/` and `staff5/`. Nate picks v2, v3, v4 or v5 on 26 Oct. D2-D5 of the review are held, not built.

**Partners (R-328, 22 Oct 2026; Staff v5 only, Nate 10/22).** `staff5/partnergroups.js` is the Partners screen (`#/partners`:
requests to join, groups that write, link-only partners; add a group and its people, Copy sign-in link through the
`team-admin` function's `partner_link` action, Approve hidden from whoever added the group, Pause, Partner approvers);
`staff5/partnerq.js` is "Partner words to approve" on Today, for partner approvers only (`advocates.approves_partners`), with
Approve (10 s Undo) and Ask for a change; `staff5/css/partners.css`; the calls are in `staff5/data.js` (`partner_*` RPCs,
migration 184). The public side: `pub/partner.js` (the partner corner, `#/partner`, `#/partner/bill/<id>`,
`#/partner/issue/<id>`), `pub/partners.js` (data, sample group, the You card), `pub/groups.js` (`#/groups`, the For
advocacy groups page and request form; `#/link/<token_hash>`, the sign-in link screen that spends the token only on
Continue). Practice copy: `track.html?demo=1&partner=1#/partner` (also `partner=member|new|waiting|paused`),
`staff5.html?demo=1#/partners`. Tests: `tests/partner_corner.py`, `tests/partner_join.py`.
**What the public sees (batch D, 22 Oct 2026):** `pub/partners.js` loads approved partner words once per page load
(`public_partner_bills`, `public_partner_issues`, `public_partners`; `pubNow()` redraws when they come) and draws every
piece: the row line (`rowLine`), the plain grey side chip (`sideChip`, never `posChip`), "HIPHI hasn't taken a position"
(`noSideLine`), the partner's block in "About the bill" (`aboutHtml`, passed to `billtext.js aboutBill`'s `partners`), the
walkthrough's points by side (`pointsFor`, `helper.js`), the `?via=` welcome (`viaWelcome`, grey, naming the partner) and
Find's groups (`fromGroups`). `pub/partnerpub.js` is the partner's page `#/from/<slug>` and its issues
`#/from/<slug>/<issue slug>`; a partner's `?via=` link opens its page first for someone past the first visit (app.js boot).
The practice copy shows the sample's public words only with `?partner` or `?via=keiki-smiles`. Test: `tests/partner_public.py`.
**Partner asks in the 4:30 pm email (batch G, migration 185, 22 Oct 2026; email still paused):** You > Your alerts has
"Asks from HIPHI's partners" (A few / As they come / None, `set_partner_asks`, `my_partner_asks`; stopped partners with
Start again) in `pub/rec/alerts.js`; the email's stop link is `unsubscribe.html?partner=<slug>&pt=<token>` (anon
`partner_asks_stop`, Undo); a partner issue page has Follow (`partner_issue_follows`, signed in); the corner shows "Your
asks" with totals from 10 (`partner_ask_results`). Staff v5: the approval card shows the ask with "Also by text" and a
"Line for the text" (`partner_review` also_text/text_line), and Partners has "Going out at 4:30 pm" with Take it back and
Send again (`partner_asks_list`, `partner_ask_step`). Practice copy: `?demo=1&partner=1#/alerts` (also `partner=stopped`),
`staff5.html?demo=1#/partners`. Tests: `tests/partner_asks.py`, `tests/staff5_partner_asks.py`.

## Staff v4 (`staff4.html` + `staff4/`), to compare (R-269, 12 Oct 2026)

Nate: "Make all these changes in a staffv4 page." A copy of Staff v3 made 12 Oct with R-269's thirteen changes, built so
each person's three most important things are on their first screen: Today's coalition rows say where testimony stands
and "Nothing of your own" no longer sits over a draft that is due; Today always opens on Mine (Team has an address,
`#/?scope=team`); This week follows your coalitions when you own nothing; on a hearing day the hearing you're going to is
the first card; a bill's row leads with its testimony when that is due within a day; late testimony that can still be
filed is amber ("Late testimony, still open", "to approve"); admins and second approvers get one "N slipping on the team"
line and a Slipping list at the top of Team (tomorrow's hearings with nobody going included); Getting started sits under
the person's work; new hearings with no draft are one row; Outreach opens on this week's asks (tabs: This week's asks,
Partner update, Emails, Supporters); the Tasks page retired. Held to A-24 by `tests/staff4_budget.py` and to Nate's
per-person targets by `tests/staff4_people.py` (both in CI; the people test adds Patti and Julie and moves the practice
clock as files are served). Each version's menu opens the others. **Staff v3 is left as it was**; R-267's Fix it batch
builds into v4 (Nate, 12 Oct). Nate picks v2, v3 or v4 on 26 Oct. The analysis, the brief and the walk tools: backend
`docs/requests/R-269.md` and `docs/requests/R-269/`.

## Staff v2 (`staff.html` + `staff/`)

Task-first. Tabs: Today, My issues, Bills, Legislators, Outreach. `staff/app.js` frame + router (`parseRoute`), `staff/ui.js`
shared parts, `staff/staff.css` + `staff/css/*.css`, one module per screen (`today`, `review`, `bill` with
`activity` `public` `pathway` `testimony` (R-027), `bills` with `filters` `bulk`, `triage`, `memo`, `search`, `legislators`,
`legislator`, `supporters`, `person`, `myissues` (`#/my-issues`, R-263: the issues a person owns or helps on, the 2027 prep list in prep.js),
`issues` (Outreach > Issues and `#/issue/:id`, R-018), `lists`, `list`,
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

**Since R-199 (F7-1) the old app is look-only:** every `DB` method that writes is replaced by a refusal that links to
the same screen in Staff v2, and its Supabase client refuses insert/update/upsert/delete and any database function not
on `RPC_READS` (`app.js`, "look-only"). So a new WRITE needs no copy in `app.js`; a change to a read or a shared helper
the old app still draws with does, until it retires. Its "since your last visit" keys are `classic_lastVisit` /
`classic_prevVisit`, so opening it no longer moves Staff v2's.

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
- **Staff v2 with eleven people at once (R-152 batch B, 10/6).** The app was built as if one person used it; these are the rules
  that came out of the review (a fake database tests them, below). (1) **Never build a bill link by hand:** `billRoute(b[, tab])`,
  `billRef(b)`, `billByNum(num, year)` and `billByRef(ref)` in `staff/model.js` carry the session year the way the public page
  does since R-110 (`#/bill/HB2121` is the current session's bill, `#/bill/2026/HB2121` an earlier one's; `route.year`; `billNum(b)`
  reads "HB5 (2026)" for an earlier session's bill; `?from=` takes a ref). (2) **A read that fails must say so:** `DB.loadAll` names
  each failed read in `S.loadFailed` (`S.failed('testimony drafts')`), the frame shows one amber notice with Reload (`loadNotice`,
  `.sv-failnote`), and a screen that would state something false from an empty list checks `S.failed(...)` first (Today's no-draft
  card, the bill page, the Draft chip). (3) **Fresh data:** `refreshData()` in `staff/app.js` reads again when someone comes back
  to the tab after 5 minutes away, and "Refresh" is in the avatar menu; it redraws only when nothing is being typed or open.
  (4) **Save only what changed, never over a teammate's newer text:** a form that saves team fields keeps the values it held when
  editing began (the base) and calls `DB.saveBillFields(id, patch, base)`, which writes only the keys that differ and reads
  them fresh first; a conflict comes back as `{ conflicts }` and `askConflict` (`staff/conflict.js`) shows theirs and yours (Keep
  theirs / Replace with mine). The Public tab and the team note use it. A single-field cell edit (`DB.updateBill`) is already
  "only what changed". (5) **Hearings are read for tracked bills only** (an inner join on `bills.tracked`, both apps); a bill
  tracked later brings its own (`DB.adoptHearings`). (6) **Staff errors are reported** like the public page's (`staff/errlog.js`
  to `log_public_error`, place "staff/<screen>", never from a test run). Do not undo any of these.
  **Batch C ("the jobs", same day):** a countdown is rounded DOWN everywhere (`span` in `staff/today.js`, `urgentMark` and
  `countdown` in `staff/ui.js`; a deadline is never later than it reads, R-022) and time still to run says "left" ("N days
  left", never "to go" or "away"); a bill with a hearing coming and no draft shows its testimony deadline (`wantsTestimony`);
  "Sent to ..." names everyone who can approve (`approvers` in `staff/today.js`) and a draft sent back says "changes were asked
  for" (the draft does not record who did); the Public tab on a phone leads with the public's response and the share kit
  (`renderPublic`, under 900px), and the ask's date is checked against the next hearing (`untilWarn`, a hint not a block);
  "This week's asks" is a folded `<details class="td-asks">`, on the Week and on a phone's Today (`weekAsksPhone`); on a hearing
  day a phone's Today shows the next hearing before the cards; the Week's bill names take two lines (the response line sits under).
  **Batch D ("ready for January"):** the practice copy tells the truth (the email to-do is worded and dated as the database makes it,
  the sample email names its hearing's real weekday, the checklist and the Team page agree on who has an account, Google Calendar shows
  connected, a March Today does not lead with the 2027 issue prep, and one hearing this week has no draft so its card can be practised:
  `sandboxExtras` in `staff/app.js`); Session setup > Ready checks that every approver has signed in and, once the session has ended,
  that the next session's committees and chairs are loaded (client rows in `readyRows`, `staff/setup.js`); a "%" in the address cannot
  freeze a page (`parseRoute`); a bulk edit goes in slices of 150 (`DB.bulkUpdate`); an owner change adds the new owner before taking the
  old one off (`DB.setOwner`); a filing confirmation link must be https (`DB.transition`); the staff apps pin supabase-js@2.117.2, the
  version the public page pins (`pub/kernel.js`): change all of them together, and run `staff_live.py` when you do.
- **A bill the team does not track (R-058, 10/6).** `#/bill/HB123` for a bill not in `S.bills` used to say "not on our list"; `staff/untracked.js`
  reads that one bill and its hearings (`DB.untrackedBill`, `DB.billHearings`; the sync records hearings for every bill, R-059, so the page shows
  them) and draws a read-only page: where it stands, last action, committees, who introduced it, hearings, the Capitol and public links, and one primary
  button "Track this bill" (`DB.track`; Undo is `DB.untrack`). Search's not-tracked rows link to it. An unknown number still says so. The sandbox's
  index has only number, title and description, so the practice copy's page is thin. Nothing on it can be edited.
- **Ahead (R-049, 10/6).** Today's switch is **Today | Ahead** (`#/?view=ahead`, every width); the Week grid (`?view=week`, laptop) is one link
  from Ahead ("Week as a grid") and the switch shows a third "Week" only while you are on it. `aheadView` in `staff/today.js`: "This week" (the
  next 7 days: hearings and the day written testimony closes, from `hearingsIn`), then "Deadlines" from `sessionGates` within 21 days: the first
  deadline that still has a bill with no hearing is open (P1 first, then by when the notice must post, a row's chair, last meeting and one
  "Email the chair" button; more than 7 fold), earlier ones whose bills all have a hearing and later ones are one folded line. Nothing on it says
  "due" (it is work coming, not Today's list you clear). Stage 1 of the review's plan: **Today is not yet trimmed**; Nate and Lauren try Ahead
  in the practice copy first (then move "Next deadlines", "Hearings today" and "This week" off Today). Kris and Saya (no bills) see their
  coalitions' bills. Between sessions it says so. A testimony row is amber only within 24 hours, as everywhere.
- Current app pitfall: `styles.css` has a global `input,select,textarea{width:100%}`; give new inputs in a
  flex or grid row an explicit width.

## Tests (`tests/`, Playwright for Python; output goes to `tests/out/`, git-ignored)

Serve first: `python3 -m http.server 8832` in this folder.
```bash
python3 tests/public_journey.py     # public: 482 checks, phone + desktop, the first visit (R-023) and a shared bill, ladder, off-season, the session lesson's label inside its drawing (R-179)
python3 tests/staff_desktop.py      # Staff v2: 503 checks at 5 sizes, Approve guards, menus, loading state
python3 tests/staff_flows.py        # Staff v2: 181 flow checks + data-layer parity
python3 tests/staff_r152c.py        # R-152 batch C in the sandbox: one countdown rounded down everywhere, the testimony deadline before a draft, who gets a draft, the phone's Public tab order, the ask's date against the hearing, "This week's asks" folded and on a phone, the next hearing first, bill names not cut; 33 checks. Runs in CI
python3 tests/staff_issue_note.py   # a quiet note on an issue's staff page when one of its bills goes against the issue's stance (R-095): who, what it says, quiet, the picker, Mixed, no note when all agree; 23 checks. Runs in CI
python3 tests/staff_x10.py   # R-180 wave 3: a new hearing is impossible to miss, the rallying path, saves that say what they did (X10-3/5/6); 39 checks. Runs in CI
python3 tests/r229_alerts_next.py   # right after a number is saved on #/alerts, one way on ("Pick your issues", the guided picker, or "Go to Home") leads and Change number / Stop texts are a quiet row; a later visit from More is unchanged (R-229, B-3); 14 checks
python3 tests/stop_number.py   # a stop asked for by number, from any browser (D1-3): the fold, refusals, the sandbox's answer, the device's own number; 7 checks. Runs in CI
python3 tests/plans_join.py   # the plans' sign-up: small print above the button at 375x667 and 390x844, Plan 1's calendar card (no reminder), Not now (D1-6, D1-1); 15 checks. Runs in CI
python3 tests/staff_privacy.py   # Session setup > Privacy and keeping: forget a person (refusals, asks first, counts), the keeping table and the switch (J2-1, J2-2); 31 checks. Runs in CI
python3 tests/privacy_page.py   # the privacy page whole and short (J2-3): summary first, short lists, periods, contact; 37 checks. Runs in CI
python3 tests/unsubscribe_page.py   # unsubscribe.html changes nothing until its button posts (X1-7); the function is faked; 15 checks. Runs in CI
python3 tests/same_idea_law.py   # a stopped bill whose same idea became law says so, by companion or by issue (X4-4); 21 checks. Runs in CI
python3 tests/staff_untracked.py    # a bill the team does not track opens a read-only page with Track and Undo (R-058): the Capitol's facts, its hearings, nothing editable, an unknown number, an earlier session, search's link, phone, the sandbox; 22 checks. Runs in CI
python3 tests/staff_ahead.py        # Today | Ahead (R-049): this week day by day, the next deadline's bills with no hearing (once each, P1 first, by when the notice must post, never "due"), later deadlines folded, the Week grid one link away, phone, Team, between sessions; 39 checks. Runs in CI
python3 tests/staff_r152d.py        # R-152 batch D in the sandbox: the practice copy's to-do, sample email, checklist, calendar and no-draft card as the live app has them, readiness checking the approvers and the next session's committees, a stray % in the address, the pinned library; 17 checks. Runs in CI
python3 tests/staff_live.py         # Staff v2's LIVE path on a fake Supabase (tests/livefake.py, the snapshot's rows, a stored login): the hearings read, a failed read named, refresh on return, save only what changed, a teammate's conflicting save, two sessions' bill numbers, staff error reports (R-152 B); 52 checks. Runs in CI on every push
python3 tests/staff_clock.py        # Staff v2 Today: the Next deadline button, 89 checks (yours, a teammate's list, a quiet day)
python3 tests/staff_week.py         # Staff v2 Today's Week view (R-025): three kinds in time order, each deadline on its day, counts that agree with the side panel
python3 tests/density.py            # arrival px, competing controls, sizes, colours - DESIGN.md A-1/A-2/A-4/A-5
python3 tests/density.py --check    # 66 screens against tests/density_baseline.json + no word split at a hyphen (X9-6, CI); --write-baseline after a change you meant
python3 tests/setup_expected.py     # Session setup's dated steps ("Expected from Jan 10") and Sort new bills' hearing-first order (Z1-6)
python3 tests/suggest.py            # header search suggestions (R-032), both apps: 190 checks at 1024-1440 and short windows, keys, redraw, live bills
python3 tests/staff_followed.py     # Sort new bills: the untracked bills the public follows (R-059), 40 checks at four sizes
python3 tests/staff_firstvisit.py   # Staff v2's First visit pages (with "Asks on later visits", R-251) and the "Show in the first visit" switch (R-023): 236 checks at four sizes; another server: pass its address
python3 tests/visitlog.py           # the private first-visit counting (pub/visitlog.js): 41 checks, every Supabase request intercepted
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
python3 tests/links_keep.py         # the walkthrough link, the My issues link restored in a fresh browser, "What's next", the calendar feed, and the finale on a phone with no issues link (it lives only under More since 10/10, R-123 (a)) (R-123 to R-126); 14 checks
python3 tests/perf.py               # the first screen's speed on the published site, throttled the same way every time (R-122): slow phone and 4G, three runs each, the middle one reported
python3 tests/boot_live.py          # the staged boot on the published site (R-122): a newcomer's first screen, the kept catalog (waited for, up to 30 s, and how long it took is printed), someone with an action lands on Home, and every way in ends with the full catalog (R-136); 13 checks
python3 tests/home_now.py           # Home's first card counts the day's deadlines; twin bills are one card naming the twin (R-131); 5 checks
python3 tests/abtests.py            # the live A/B tests (R-135): every version forced in the sandbox, the toss, the switches, every measure, nothing leaving under the privacy signal; the first visit's six versions (R-164); 69 checks
python3 tests/layout.py             # version A as the live test 'layout' (R-187): both versions on a phone and a laptop, the bill page, Next day, the toss and the switch, the version kept for the page load, Tests and the tester sheet; 100 checks
python3 tests/versions.py           # pick which versions of each A/B test are live; the practice copy follows the switches (R-192); 52 checks
python3 tests/testers.py            # testers' paths from tester-sheet links, what is not recorded, the tester sheet's "What testers did" (R-193); 31 checks
python3 tests/room.py               # Staff v2's tester sheet (R-185): groups, pickers, the plan rules, QR codes, the printed sheet, live links, Undo, kept; then each link opened as a tester; 108 checks
python3 tests/plans.py              # the five first-visit plans (R-164), each walked to Home on a phone, a laptop and between sessions, the sign-up and the next day's full-page ask; 86 checks
python3 tests/next_asks.py          # a later visit's one full-page ask (R-237): when it opens and when not, each page, Done and Not now, the rest (a week, three weeks, three months), the count's payload; 70 checks
python3 tests/fv_type.py            # the first visit is large and short (R-174, DESIGN C-14): every version walked on a phone, nothing under 14px, 14px only for labels, each lead sentence 30 words or fewer; 30 checks
python3 tests/first_visit_fixes.py   # the first visit's six fixes of 11 Oct (R-249): the whole word, the skipped chapter's dot and no petals, "one alert a day", the button's name, the bill's name once, the empty page's way out; 22 checks on a phone
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

**Staff v6 (R-336).** These hold Staff v6 to backend `docs/requests/R-336/V6-SPEC.md` and DESIGN.md's Staff v6 section.
`tests/staff6_lib.py` is their shared helper: it uses `http://localhost:8832` (or `HOST`) unless `V4_ROOT=<folder>` is
set, which serves that folder straight into the browser at `https://v6.test` (a worktree; nothing reaches the network).
Either way it rewrites `data.js`'s clock as the files are served, so `&asof=` moves the practice clock. `APP=staff5` runs
the same checks on v5 for the before numbers.
```bash
APP=staff6 python3 tests/staff6_links.py               # every old address opens the right place (V36, spec 3.4): the moved ones and every other v5 address, at 1440 and 390
APP=staff6 python3 tests/staff6_people.py              # each person's three most important things on their first screen (laptop, and Kris's and Lauren's hearing days on a phone)
APP=staff6 python3 tests/staff6_journeys.py            # steps per job against spec 8 and v5, by mouse and by keyboard; focus back on the row after Back; the Undo toast read aloud; 200% zoom at 1280 loses nothing
APP=staff6 python3 tests/staff6_words.py --workers 3   # no "vape", no programmer's notes, one wording per testimony state, one name per act, every place Help names exists
APP=staff6 python3 tests/staff6_budget.py [--quick] [--workers 6]   # spec 8's per-screen counts for every person and clock; APP=staff5 records tests/staff6_baseline_v5.json
node tests/staff6_steps_test.mjs                        # steps.js's word rules (status, testimonyState, actBy, committeeName...) on the practice data, no browser
node tests/staff6_issues_test.mjs                       # finding an issue by a bill number as printed ("HB 2121", lower case, no space, digits alone), no browser
```
Latest counts, re-run on the merged build of 23 Oct (frontend a9a48ceb): links 55/55, people 42/42, journeys 95/102, words
18/24, budget 8 spec 8 targets missed (542 misses on 500 of 2,586 screens, most of them the bold share, 406, and text
colours, 75), steps 144/144, issues 14/14. The full budget run takes about 18 minutes at `--workers 6`.
