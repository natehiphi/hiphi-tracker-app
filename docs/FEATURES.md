# How each feature is built, by request (the frontend)

Moved out of `CLAUDE.md` on 1 Oct 2026 (R-129, the assessment's U4) so a new conversation reads rules and pointers first and
comes here for the detail of a feature it is about to touch. Each paragraph names the request (R-NNN), the handoff entry
(`../backend/HANDOFF.md` or `HANDOFF-ARCHIVE.md`), the files and the tests. Search for the request number.

## The features, as recorded when built


**Staff v2 is the staff app, at the old address (R-022, 9/21; `../backend/HANDOFF.md` 3.19).** `index.html` and
`staff.html` are the same page (both load `staff/app.js`), so every bookmark, Slack link and email link opens Staff v2
without a redirect. The old staff app is at `classic.html` for a week as a way back (until about 9/28; its avatar
menu in Staff v2 is "Open the old app"), then its code is deleted. Old links are mapped by the router (`#emails` ->
`#/review`, `#calendar=msg` -> `#/me`, `#bill=` as before). The same build added conversations with legislators
filed by issue, a hearing page, coalition pages, and the Today and Week rework from the staff review (3.13).

**People follow ISSUES, not bills (R-018, built 9/21; `../backend/HANDOFF.md` 3.14).** Six categories group
91 issues (migration 063: `categories`, `issues`, `issue_categories`, `bill_issues`, `issue_follows`,
`category_follows`, `bill_skips`, and the internal `follow_set` view that alerts and counts read). A person
follows an issue, or a whole category ("Follow all" also brings issues HIPHI takes up there later), and every
bill HIPHI takes a position on that is on a followed issue reaches them; following one bill still works, and
"Not for me" drops one bill without leaving its issue. In `pub/core.js`: `S.watch` = bills followed on their
own (`S.direct`) + the bills of followed issues and categories for `followYear()` - `S.skips`
(`recomputeWatch`); `issueFollowed`, `issueBills`, `viaIssue`, `setFollows`, `unfollowIssue`. Signed out, follows
live in localStorage (`hiphi_issue_follows`, `hiphi_cat_follows`, `hiphi_skips`, `_demo` in the sandbox). The
first visit's first two screens are categories -> "Your issues"; the tab is **My issues** (one row per issue,
`issueItem` in `pub/mybills.js`, shared with Find); Find has category and issue pages (`#/find/category/<key>`,
`#/issue/<slug>`); a bill page says "Part of <issue>". Staff keep the list in Staff v2, Outreach > Issues
(`staff/issues.js`). The first list came from the team's nicknames: `../backend/docs/issues_2026.json`, loaded with
`node ../backend/tools/apply_issues.js` (it never overwrites wording staff have edited). **HIPHI's stance on an
issue** (backend 094, R-093): `issues.stance` support / oppose / mixed or null, set on the issue's page, in Edit issue and
on a bill's Public tab (`stanceChip`, `pickStance` in `staff/issues.js`); the public chip is `issuePos(bills, i)` in
`pub/core.js`: the stance picks the side, the bills how strongly, and null falls back to working it out from the bills.
Test: `tests/staff_stance.py`.

**The first visit was rebuilt 9/21 (R-023; `../backend/HANDOFF.md` 3.25, the plan and every decision in
`../backend/docs/FIRST-VISIT-PLAN.md`, the approved prototype in `../backend/docs/first-visit-prototype/`).** `pub/start.js`,
with three named parts at the top ("Your issues · How it works · Stay connected": a signpost, never a bar or a counter):
topics (six tiles, most important first) -> "Your issues" (R-039, 9/26: the four most important issues across the chosen
topics, then three more per topic and nothing else; only the top four can start ticked; importance uses
`public_issues.top_priority` and the staff switch `issues.first_visit`, migration 066; its numbers are `WEIGHT` in `pub/rank.js`, shared with the
suggested bill on Home and Find since R-094: change them there, once) -> the "Mahalo!" moment -> ONE
lesson, "A bill's story" (R-062, 9/29, rebuilt twice that day: one page in three stages walked with the primary button,
the drawing changing in place: the bill, its road to where it really is, then "Why speaking up can help" with a choice of
four (email the chair, send testimony, tell my legislators, stay quiet) that each animate what CAN happen; Back steps
back through the stages; counted as step 'bill'; `pub/lessons.js` section 4, `lessonStep()`, also at
`#/learn/story`; the older three lessons stay at `#/learn/bill|session|hearing` for links from bill pages and Help)
-> the "Now you know how it works" moment -> who speaks for you (street address only) -> "Coming up on your
issues", THEN the one email ask with the first name -> "You're all set" (the peak) -> Home, which says "Aloha" and shows
the week's first hearing with "See how to help". A newcomer who opens a shared bill gets a "New here?" card on the bill
page (`newcomer()` in `pub/bill.js`: the easiest action, "Follow this issue", "Not now"); `wiz().via` then runs the
shorter flow on that bill. Motion and celebration are `pub/fx.js` (`burst`, `celebrate`, `travel`, `swap`; DESIGN A-10
and C-7 rewritten 9/21). The visit is counted privately by `pub/visitlog.js` (`log_first_visit`, migrations 067-068;
staff see it in Outreach > Issues > First visit). Testimony is "due", never "closes", in the first visit (late testimony
is still taken, marked late).
**Emails are walkthroughs too (R-079, R-080, 9/29):** `pub/helper.js` has modes `testimony` | `email` | `legislators` | `intro`
(open with `app.openHelper` for testimony, `app.openMail(o)` for the rest). Email: stance → know the bill → about you →
the email (To, subject, message) → send → "Did you send it?" → Mahalo. The send step never asks: the message is copied,
and "Open in my mail app" (mailto), "Open in Gmail" and "Open in Outlook.com" each open a filled-in email (phone: mail app
first; laptop: Gmail first), with "Copy address/subject/message" below. `pub/speakup.js` finds the moments to write to your
own legislators (floor vote in their chamber; their committee's hearing; waiting in a committee they sit on or chair),
places the Home cards (and the one-time "Introduce yourself" card, `hiphi_intro`), and takes over the bill page's email
buttons by their `data-bl-*` hooks (a cleaner later step: `bill.js` calls `app.openMail` itself). Kinds (migration 089,
R-087): a chair email is 'email', one to your own legislators 'legislators' (public totals add both to "emails"), the
introduction 'intro' (private counts only). Districts are kept on the device (`hiphi_districts`) and on an account; a
street address is never stored anywhere (migration 090 dropped `people.address`; Settings uses it once, R-086).
`tests/email_walk.py`.
**A second ending of the first visit, to test beside today's (R-098, 9/29; Nate: "Provide a separate example that I can
test before committing to it", "Two links").** Testers took the email ask as the end and found Home doing nothing.
`?end=home` (remembered in `hiphi_wiz` by `pub/variant.js`, `endHome()`; `?end=today` switches back; today's version stays
the default until Nate picks) ends the first visit ON Home: no "You're all set" screen (`flowOf` drops 'done'; `goStep`
past the last step calls `finish()`); Home's `homeFirst()` (and `offView` between sessions) says "Mahalo, <name>! This is
your home page", shows the ticks, plays the petals once (`finFx`, outside #app), and opens **"What you can do right now"**
with the one thing due first (`rightNow()`); then two tips over Home after 4.5 seconds (`HOME` in `pub/tour.js`,
`hiphi_tour_home`): the card, lit and usable (using its button ends the tips), and coming back (the Home tab; add to the
home screen or bookmark when no email was given). A fresh-eyes review 9/29 cut a third tip and a repeated deadline. The
words: "we'll show you", "Home shows when it's your moment", the last part "Your home page", "Want an email too?", "Link
sent to ... Tap it when you finish here", "See my home page". Counted privately as step 'home' (view, done/skip).
**`?demo=1&restart`** (an inline script in `track.html`) clears only the sandbox's own storage, so the testers' two links
start from the beginning: `track.html?demo=1&end=today&restart` and `track.html?demo=1&end=home&restart`. Fixed in both
versions the same day: Home's "Your issues" rows open their issue; the sandbox remembers an email was given (it asked
again on Home); the welcome-back email ask is not shown after a link was sent; the story's last stage names a real
hearing instead of "Nothing to do now"; a tour is no longer blocked by fx.js's hidden celebration element (the bill tour
never started after the first visit's celebrations). `tests/home_end.py`.
**Two more teaching places (9/29):** the first bill page anyone opens gets a three-tip tour, once (`pub/tour.js`, mounted
from `pub/app.js` `render()`; remembered in `hiphi_tour_bill`; held back by the "New here?" card, dialogs and
celebrations; tests set the flag in their setup, `tests/bill_tour.py` tests the tour). Help (`#/help`, `#/help/<slug>`) is
50 ready-made conversations (R-075: tap a question, a short answer with a small drawing, the next question; no typing
box): the words are in `pub/talk-data.js` (edit words there, not in `pub/talk.js`); `tests/help_talk.py`.
**Bill links carry the session year when it isn't the current one (R-110, 10/1; the assessment's P6).** Numbers start
again at HB 1 every January, so `#/bill/HB2121` means the current session's bill (`sessionInfo().yr`, the calendar's
year) and a bill from an earlier session is `#/bill/2026/HB2121`. In `pub/core.js`: `yearPrefix(b)` ('' or '2026/'),
`billRef(b)`, `billPath(b)` (use it for every bill link; never build `#/bill/` + number by hand), `pickBill(cands, year)`
(the named year, else the current session's, else the newest) and `ensureBill(num, year)`, which asks the database for a
newer bill when a number is on hand only from an earlier session. The bill page (`pub/bill.js`) keys its loading sets by
"2026/HB2121" or "HB2121"; `?from=` on the legislators pages is `billRef`; the share pages are `b/HB2121` (the latest
session's bill of that number) and `b/2026/HB2121` (that session's), every one forwarding to the exact bill, and
`404.html` keeps the year; Staff v2's "Public page" link and Make a link add the year for an earlier session's bill.
Tests: `tests/year_links.py` (the sandbox, with a 2025 copy of one bill served into the snapshot) and
`tests/year_links_live.py` (the published site).

**A/B testing has a process and a measurement spine (R-121, 10/1; `../backend/docs/AB-TESTING.md`).** `pub/variant.js`
tosses a coin once per new browser between the first visit's two endings (`EXPERIMENT`: key `end`, arms `today` and
`home`), remembers it (`hiphi_wiz.arm`, `forced`), and a link's `?end=` forces one and marks it forced (the testers'
links; automated browsers never toss). `variantInfo()` goes on every private count (`visitlog.js`: `variant`, `forced`
on first-visit events; `variant` on the day and action counts; migration 113). Staff read the comparison on Outreach >
Issues > First visit > **Versions** (`first_visit_variants`, `variantsHTML` in `staff/firstvisit.js`: a two-proportion
test on "finished" at 95%, trusted only from 100 visits per version; forced visits shown apart). One test at a time, and
no new "try both" versions from 15 Oct (rule 13). **Superseded 3 Oct by R-135, below: six tests at once, and the
Versions section points to Session setup > Tests.**

**The six recommendations of 1 Oct (R-115 to R-120).** The tester day-picker tells the truth (P9): `stops.js` gives a
bill whose current committee already reported a `hearingState` of `decided` (with `decided`: the outcome), so it is never
"waiting for a hearing" on Home, the bill page or the legislators' pages; `plainStatus` says the decision. The rally
prompts (S4, R-116): `askDue` in `staff/today.js` is the last 4:00 PM at least twelve hours before testimony closes (two
days before the hearing at most); the email-blast to-do (migration 112) is due the notice day or the day before the
deadline, and reads "Send the ask to HIPHI's list and partners" while email is paused. The public's response and the
share kit (S5, R-117): `S.pubCounts` (`public_action_counts` and `watch_counts`), `publicWords(b)`, `shareKit(b, h)` and
`sharePageUrl(b)` in `staff/model.js`; shown on the hearing page's agenda rows and its Share kit section, the Week view's
bill rows and the Public tab ("The public's response", Copy share link, Copy a ready message); the partner memo links the
share pages. Session work first (S6, R-118): in the opening weeks and in session "new bills to sort" takes Today's notice
slot, the prep notice ends with its due date for non-admins, and the prep card folds to one line once approved or in
session. One count for "needs a hearing" (S8, R-119): the deadline's "N bills with no hearing yet" lists every one of
them; `gateApplies` drops a bill-specific deadline (Budget decking) from lists that hold none of its bills, in Today, the
Week view and the memo. The consistency set (P8, R-120): `hearingsOf` reads the week's pool and the featured bills'
hearings too (legislator and committee pages); a hearing deferred to a later sitting says "Deferred to Apr 7"
(`deferredTo` in bill.js); the walkthrough saves the stance (`setStance`), heads the letter "in SUPPORT of" / "in
OPPOSITION to" / "Comments on" (`headingFor`), offers email sign-offs in email mode, writes to the one chair whose Email
was pressed (`o.chair`), and "Your N issues" counts categories followed; an emailed chair is not asked again as "your
legislator who chairs it" (speakup.js). Tests updated: `bill_tour.py`, `email_walk.py` (the floor case clears the pool
too), `staff_week.py` (the ask on Tuesday), `staff_prep.py` (the folded card), `visitlog.py` (the two new keys).

**One share everywhere, and a link newcomer is left to finish (R-113 P3 and R-114 P4, 10/1).** Every share of a bill
goes through `shareFor(b, h, { acted, law, differs })` and `doShare()` in `pub/actions.js`: the words, the testimony
deadline while it is open ("Testimony is due Wed, Mar 18 at 9:30 AM"), the bill's own share page as the address
(`billShareUrl` in core.js: `b/HB2121`, or `b/2026/HB2121`; the tracker's address in the sandbox), and the link passed
once (the share sheet gets it as the url, the clipboard copy has it at the end). `shareIssue(i)` shares an issue's page
(`i/<slug>`, `issueShareUrl`) and counts it: the issue page's "Share this issue" (find.js) and the finale's "Know someone
who cares about <issue>? Send it" (`shareLine`/`wireShareLine` in start.js, also on the ending that lands on Home). The
share pages and `404.html` pass a partner's `?via=` and the `utm_` words on in place of `via=share` (W1). A newcomer on
a shared link: no automatic bill tour (`BILL.wants` in tour.js; the "New here?" card's quiet line offers it), the deadline
on the card and as a "Testimony due" chip in the head, no partner welcome for `via=share`, one email ask per visit (the
Coming-up screen stays quiet once the walkthrough asked, `S.nudgedThisVisit`), and after acting the "voice" step offers
"Go to my home page" beside "Show me how it works (2 min)". Tests: `tests/share_links.py` (22 checks, with Staff v2's
hearing back link and the Help words from R-112).

**The public page reports its own errors, and every push is tested (R-111, 10/1; the assessment's U1).** `pub/errlog.js`
(imported first by `pub/app.js`) sends one small row per distinct error (a thrown error, an unhandled rejection, a screen
that failed to draw, a start that failed) to `log_public_error` (backend migration 110): the kind, the screen's address
part (`placeOf`: bill/HB2121, home; never a query string, a shared list's link or an account id), the first 200
characters of the message, the file and line (the site's own path), phone/tablet/laptop and whether it is the sandbox.
Nothing with the privacy signal or from a test run (`quiet()` in `visitlog.js`); at most five a page load; a dropped
connection is not reported. `track.html` has a small plain-script catcher for errors before the modules run and for a
page whose code never starts (it reports `boot` after 20 seconds unless `app.js` set `__hiphiErrs.booted`); its address
and key must equal `pub/core.js`'s. Staff see the week's list in Staff v2 > Session setup ("The public page's errors",
`DB.publicErrors()` reading `public_errors_recent`); the hourly health check tells admins by Slack at ten or more in an
hour. The privacy page says so ("If the page breaks"). **GitHub runs the tests on every push** (`.github/workflows/tests.yml`,
free in this public repo): the module-aware syntax check of every JS file, `parity.mjs`, `rank_test.mjs`, then
`screens_smoke.py`, `year_links.py` and `errlog.py` against the commit served locally; a red run emails whoever pushed.
`uptime.yml` loads the published page hourly from November to June (`tests/uptime.py`) and fails if it does not draw.

**A bill's pathway names each committee (R-081, 9/29):** `railInfo` in `pub/bill.js` expands the House and Senate
committee steps into one step per committee (two heard together are one step), so a path has 4 to 11 dots; a chamber that
has not picked its committees yet stays one "Senate committees" step. Committees have their **full names** (Nate 9/29:
not "Senate Water"; `cmteBrief`): "Now: Senate Water, Land, Culture and the Arts, 1st of 2 Senate committees" or "Stopped
in House Health and Human Services" (the committee from `stoppedAt` in `stops.js`); two or more heard together are joined
with "with" when a name has its own "and" (more than two such: "with 3 other committees"); a retired code stays as its code.
The lessons and the tour read those words, so change them there. "See all steps" links each committee's page; More
details no longer repeats the list. From nine dots they shrink; on wide screens (from seven dots) the names alternate
above and below the line, in a subgrid whose top row grows to the longest name. `tests/pathway.py` checks the dots, the
names, the links and that no two names overlap.

**Admins keep the team list in Staff v2 (R-092, 9/29):** Session setup > Team (`#/setup/team`, `PAGES.team` in
`staff/setup.js`). Add a person, edit them, turn them off (with Undo; nobody is deleted), and "Sign-in link" makes the
person's login if they have none and a one-time set-up link the admin sends by Slack or email (nothing is emailed from
the app). Data: `DB.teamLogins` / `teamSave` (backend migration 093: `team_logins()`, `team_save()`, admins only) and
`DB.teamLink` (the `team-admin` Edge Function, which also handles its own CORS). The link is a password-recovery link,
so it lands on the app's existing "Choose a password" screen. Staff v2 only (`parity.mjs` V2_ONLY).

**Until `classic.html` is deleted, data-layer changes still go into both staff apps** (`app.js` and `staff/data.js`,
checked with `node staff/tools/parity.mjs`).

## Home's Now card and twin bills (R-131, the assessment's P7; 3 Oct 2026, HANDOFF 3.78)

`pub/home.js` `followView` pairs twin bills among the open cards (`companionsOf`, or the same nickname in the other
chamber) into `S.hmTwins`, folds the later twin and passes it to `actionCard` (`twin`), which draws one line under the
hearing naming the twin with its own hearing and deadline. `todoBlock` gives the first card `ofN` ("1 of 3 due today"),
counted over the open cards whose deadline falls on the same Hawaiʻi day. Layout A's page (`track-a.html`) is untouched.
Test: `tests/home_now.py`.

## This week's asks (R-132, the assessment's W5; 3 Oct 2026, HANDOFF 3.78)

`staff/today.js`: `weekAsks(all)` takes the Week view's deadline groups and keeps the position bills on the public page
with a deadline still ahead, soonest first; `weekAsksText(items, kind)` writes the newsletter text (per bill: the everyday
name, HIPHI's stance, the ask staff wrote in the Public section or "Please speak up", the deadline, the share page marked
`?via=newsletter`) or the post text (one line per bill under 280 characters, `?via=social`); `weekAsksHTML` is the card
above the grid with the two copy buttons (`[data-wkasks]`). Styles `.td-asks` in `staff/staff.css`. Checks in
`tests/staff_week.py`.

## Live A/B tests, each with its switch and its results (R-135; 3 Oct 2026, HANDOFF 3.79)

Nate 10/3: every "try both" version tested at random on the public, each turned on or off by him in Staff v2, each
tracked by effectiveness. The plan: `../backend/docs/AB-TESTS-PLAN.md`; the database: backend migrations 116-117.
- **`pub/variant.js`** (first wave, kernel only) holds `TESTS`: `end` (today | home), `fv` (full | short), `rank` (today |
  ranked), `email` (finale | after), `share` (summary | deadline), `home` (by-day | by-issue, which groups by topic). The
  first version of each is today's. A new browser gets every test's version by its own coin toss and keeps it
  (`hiphi_ab`); `armOf(key)` gives the version to draw: a tester's link first (`?ab=home.by-issue`, several with commas;
  the older `?end=`, `?fv=`, `?rank` still work; counted apart), then the first visit's lock (`lockFirstVisit()`, called
  by `start.js` as the first visit starts: `end` and `fv` keep it for good, `email` until the first visit is over), then
  the switch (`public_ab_tests`, fetched by `track.html` with the catalog as `window.__hiphiAB`, kept in `hiphi_ab_cfg`; a
  test that is off shows its fallback; a test the database lists with other versions is off). The sandbox and automated
  browsers get today's version unless a link says otherwise (`window.__hiphiTossTests` lets `tests/abtests.py` watch the
  toss). `app.js earlyFirst` waits for the switches at most 300 ms (`abSettled`), and not at all once they are kept.
- **Counting:** `abSeen(key)` (met the test, once per browser; the share test, each bill shared), `abEvent(name)` for the
  measures (`finished` from `start.js track`, `back` from `visitlog.js logDay`, `acted` from `logAct`, `email` from
  `core.js sendEmailLink`, `step2` from `markDone` through `abStep`), each sent once within its window of days.
  `visitlog.js` sends them to `log_ab` in batches of up to 12, by plain `fetch` (never the database library), under the
  same rules as every count: nothing with the privacy signal, from a test run or from the sandbox. No identifier leaves
  the browser. The share test's link carries `?via=share-<version>` (`shareTag()`; `visitlog.js` counts it as `share`
  everywhere else); a friend's arrival and later action are credited to that message. The privacy page's "What we count"
  says so (`pub/more.js`).
- **Where each version lives:** `end` and `fv` as before (`endHome()`, `SHORT()` in `start.js`); `email`: `start-rest.js`
  `noAsk()` shows the quiet line instead of the form on "Coming up", and Home's welcome leaves out its ask; `rank`:
  `actions.js` `actionCard` (met where testimony is sent and another step is open; `nextStep` keeps testimony first for
  everyone, R-068); `share`: `actions.js` `shareFor` (the deadline-first words, only where there is a deadline or a
  hearing; `doShare` counts it); `home`: `home.js` `issueBlock` (topic sections in deadline order; the two soonest things
  are full cards, as in today's version, and the rest one line each, so only the grouping differs; three topics then a
  fold; the cards there leave out their own topic line, `actionCard`'s `noTopic`). On "Coming up", the quiet line
  (`quietAsk`, styled in `start.css`) sits under the list, and the bottom button is Next whenever there is no email box
  (it used to submit a form that was not on the page after an ask earlier in the visit, R-114).
- **Staff:** `staff/setup.js` `tests` page (Session setup > Tests, admins). The status line names the tests ready to
  decide; the cards are sorted ready, running, picked, off (`abState`, `abRank`). Per test: the verdict under the question
  (`abVerdict`: a two-proportion test, a rate test for share, from 100 per version, at 99% while more than one test is on;
  a trusted one on a green notice with a filled "Pick B"), the switch (saves at once, Undo; asks first when the test has a
  note), the numbers (`DB.abTests`, `DB.abResults`; the deciding column marked; on a phone one line per version from the
  cells' `data-l`), Pick the winner (off, fallback and winner set; Undo; a test with a note asks first) and See it (the
  practice copy forced to each version, `SEE`). A test never switched on shows only its question, note, switch and See it. `compare.html`
  passes `?ab=` on, for Home's "See it". Sandbox sample numbers: `DEMO_AB` in `staff/data.js`.
- Tests: `tests/abtests.py` (59 checks: each version forced in the sandbox at two sizes; the toss over 200 browsers; the
  switches; every measure; a friend by a shared link; the privacy signal; every database request intercepted).

## Five builds of 4 Oct (Nate 10/3: "Do all the builds except for R-033"; HANDOFF 3.80)

- **R-099, "how" as well as "when":** the version of the first visit that ends on Home (the ending test's B, R-135) now says
  the person speaks up and the app helps them do it: the first screen's lede and promise (`start.js`), the short page's
  third point and "Coming up" (`start-rest.js`), the lesson's last line (`lessons.js`), Home's welcome (`home.js`). Today's
  version keeps its words, so the ending test compares the two first visits whole. The email box's consent words are
  unchanged (C-4).
- **R-094 step 5, the suggested bills counted:** `core.js` `noteShown(list, surface)` counts each suggested bill's first
  showing of the day, remembering where (home, find) and its place in the short list (`pick` HIPHI's top pick, `yours`
  the person's interests, `other`); `suggestEvent(billId, kind)` counts followed (`actions.js` `followToggle`), dismissed
  ("Not for me") and acted (`markDone`), once per bill and hearing, within 14 days of a showing. Sent by `visitlog.js`
  `logSuggest` to `log_suggest` (migration 118) with no bill or person. Staff: Outreach > Issues > First visit >
  **Suggested bills** (`suggHTML`, `suggest_summary`). The privacy page says so.
- **R-061, the Follow button:** the followed state was already a filled blue "Following" with a tick everywhere (R-067);
  every followed-state button now says "Following. Press to stop following." on hover, and the legislator page's
  followed bills carry the tick, not a star.
- **R-088 part 2, the suggested issue:** `staff/suggest_issue.js` (pure; `tests/issue_suggest_test.mjs`): the earlier
  session's look-alike's issue (`triage_queue` now gives its id, migration 119), else an issue sharing at least three
  words with the bill and a fifth ahead of the next. Sort new bills shows "Suggested issue: …" on the card and an
  **Issue** row in the panel, preselected; Track puts the bill on it (`DB.setBillIssue(..., { via })`, kept in
  `bill_issues.added_via`: suggested, changed or staff); Undo takes it off again.
- **R-060, what each draft changed:** `bill_drafts` and `public_bill_drafts` (migration 120). Public bill page: "How it has
  changed" (`bill.js` `draftsSection`, `loadDrafts`; the sandbox reads `demo/drafts.json`), the current draft's note first
  in plain words ("Senate draft 2"), earlier ones folded, never a draft after the bill's current one. Staff v2, a bill's
  Public tab: "What each draft changed" (`staff/public.js`), Edit in a sheet with Undo, Claude's notes marked "please
  check it". Notes come from the committee reports through `../backend/tools/apply_draft_notes.js`; ten 2026 notes are
  loaded (SB 2175, HB 2121, SB 2463). `tests/drafts.py`.

