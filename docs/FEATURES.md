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
suggested bill on Home and Find since R-094: change them there, once) -> "Get alerts on your N issues" (R-146, 10/4: the
alerts ask moved here from "Coming up"; a mobile number first, email as a link under it, `pub/alerts.js`, the same box as
Home's card, the one after a first action and More > Get alerts at `#/alerts`; a number is kept privately with its consent
version in `text_signups`, backend 121, nothing is sent until texts are set up; passed over when there is nothing to ask,
`askAlerts()` in `pub/start.js`) -> the "Mahalo!" moment (naming the number or the email when one was given) -> ONE
lesson, "A bill's story" (R-062, 9/29, rebuilt twice that day: one page in three stages walked with the primary button,
the drawing changing in place: the bill, its road to where it really is, then "Why speaking up can help" with a choice of
four (email the chair, send testimony, tell my legislators, stay quiet) that each animate what CAN happen; Back steps
back through the stages; counted as step 'bill'; `pub/lessons.js` section 4, `lessonStep()`, also at
`#/learn/story`; the older three lessons stay at `#/learn/bill|session|hearing` for links from bill pages and Help)
-> (its last button, "Next: your legislators"; no full-screen moment there since R-140) -> who speaks for you (street address only) -> "Coming up on your
issues" (with the optional first name once a way to reach them was given) -> "You're all set" (the peak) -> Home, which says "Aloha" and shows
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
them, and a list of more than five keeps its link to Bills (`billsTarget`; it went missing until R-154 put it back on
10/5); `gateApplies` drops a bill-specific deadline (Budget decking) from lists that hold none of its bills, in Today, the
Week view and the memo. The consistency set (P8, R-120): `hearingsOf` reads the week's pool and the featured bills'
hearings too (legislator and committee pages); a hearing deferred to a later sitting says "Deferred to Apr 7"
(`deferredTo` in bill.js); the walkthrough saves the stance (`setStance`), heads the letter "in SUPPORT of" / "in
OPPOSITION to" / "Comments on" (`headingFor`), offers email sign-offs in email mode (since R-157, 10/5, one short list for both: Mahalo, Thank you, Sincerely, Respectfully, Aloha), writes to the one chair whose Email
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


## Testifying again on a bill (R-148; 4 Oct 2026, HANDOFF 3.86)

Nate: "When someone wants to submit a testimony on a specific issue that they've already testified on, their previous
testimony should be ready to submit easily. A potential alert should occur if the bill draft has significantly changed".
His answers: the public and HIPHI's own drafts; the letter kept with the profile; a big change is a staff tick.

- **Kept:** every letter sent (the green box or "I already sent it") is kept, the newest one per bill: in the browser
  (`hiphi_me.letters`) and, signed in, with the account (`my_letters`, backend migration 124; only the person can read it,
  never staff; it joins the account at sign-in, newer wins, `letters.js` `syncLetters` from `kernel.js` `loadUser`). Deleting
  the account deletes them (`more.js`); the privacy page and Your data say so.
- **Offered:** the same bill's next hearing (or its twin's, by the companion link or the same nickname in the other
  chamber) gets "Send my letter again" as its testimony button (`letters.js` `testifyLabel`, on the action card, the bill
  page and Layout A's Now card) and one line on the card (`againLine`). The walkthrough (`helper.js`) opens on "Your letter
  is ready" ('again'), then the letter, then the Capitol: 3 parts, no account step. The letter is written again from their
  answers with the new committee, chairs, date and HIPHI's wording; a letter they rewrote by hand keeps every word, gets a
  new top and greeting, and any sentence naming the old hearing's day or committee is pointed out.
- **Checked:** `letters.js` `letterCheck` compares the draft the letter was written for with the bill's current one and
  shows each draft's note since (`public_bill_drafts`, R-060). Amber "Read this before you send", with "Update my letter"
  as the main button, when staff ticked a draft since ("changes what people should say", with HIPHI's advice), HIPHI's
  position moved and the letter used its words, a talking point used was changed or removed, or the person's own stance
  changed; blue "The bill has changed since you wrote this" otherwise; green when the draft is the same. "Start a new
  letter" and "Delete my saved letter" (with Undo) are always there.
- **Staff v2:** a bill's Public tab, "What each draft changed": the tick in the Edit sheet ("This draft changes what people
  should say", and "What to tell them"), Claude's suggestion shown with "Tick it" (Undo). Today: "Say what House draft 2
  (HD2) changed" for a public bill with a hearing this week and a new draft without a note, and "Check Claude's note" for a
  suggestion not yet decided (`today.js`, kind `dnote`; `?focus=drafts` lands on the notes). A testimony draft the job
  started from HIPHI's earlier testimony says so on its card and on Review, with what changed since (`data.js`
  `startedFromLine`, `changedSince`).
- **Counted** (kind only, `visitlog.js`): again_open, again_sent, again_warned, again_fixed, again_new.
- Sandbox: `?letter` plants a letter on HB 2121 from its 18 Feb House Health hearing (House draft 1); its 20 Mar hearing
  is on House draft 2, ticked in `demo/drafts.json`. `tests/again.py` (70 checks).

## Emails offered again, and one reminder to the same chair (R-153; 4 Oct 2026, HANDOFF 3.88)

Nate: "Can we replicate this for emails to chairs to hear a bill if they've already done that before?" His answers: "all of
the above" (every email the walkthrough writes) and the same-chair reminder "Yes for now, but needs to be reconsidered".

- **Kept:** the newest email per bill sits beside the testimony letter (`hiphi_me.letters["email:<bill id>"]`; on the account,
  `my_letters` with kind 'email', backend migration 126). Each kept email records its step (`key`: who it went to and the
  hearing, committee or legislator moment) and the three pieces the walkthrough wrote (`parts`: greeting, who they are, the
  ask), so a hand-written email can be re-addressed.
- **Offered:** any email step on the bill (asking a chair for a hearing or to hold it, "please pass it" at a hearing, the
  person's own legislators) whose step differs from the kept email's opens on "Your email is ready" (`helper.js` 'again'
  for email modes, `letters.js` `readyMail`), saying why it is back ("HB 1563 passed the House. We've addressed your Feb 25
  email to the two Senate chairs who decide on its hearing.") and then only the deadline. The bill page's ask button reads
  "Send my email to the Senate chairs" (`bill.js` `sendTo`), the card's quick email "Send my email again" (`mailLabel`). The
  email is written again from their answers for this step, or, if they rewrote it, keeps their words with the greeting, who
  they are and the ask swapped. R-148's check runs first ("Your email needs a check").
- **Either from the other:** an email step with no kept email starts from their testimony letter's answers ("We've written
  your email to … from your Feb 25 testimony"), and a testimony step with no kept letter from their email's answers.
- **The follow-up:** a bill that waits in a committee whose chairs they already emailed, with no hearing, its deadline at
  most 7 days off and their email at least 5 days old (never when we don't know when they wrote, P-5), offers "Follow up
  with the chair(s) · 1 min" once (`bill.js` situation kind 'remind', mark `<bill>|remind:<code>|ask`). It opens on a short
  email ("Your follow-up": "HB 1563 still has no hearing, and Fri, Mar 20 is the last day for one"; `reminderLetter`: when
  they wrote, the deadline, their reason, one ask; subject "HB 1563: please hear it by Mar 20"), 2 parts. The kept email
  stays the one it followed up. **To be reconsidered after the first weeks of session (Nate 10/4).**
- A change with no note yet now says where HIPHI stands on the bill as it is ("We haven't summed up what House draft 2
  changed yet. HIPHI strongly supports the bill as it is now."), for letters too, instead of asking people to read a draft.
- **Counted** (kind only): mail_again_open, mail_again_sent, mail_reminder_sent.
- Sandbox: `?email` plants a 25 Feb email on HB 1563 to House Finance's chair (it now waits in Senate HHS/EIG); `&remind`
  instead plants a 9 Mar email to HHS/EIG's chairs and moves HB 1563's deadline to Fri 20 Mar. `tests/again_mail.py` (52).

## Your profile and "I'm a..." (R-147; 4 Oct 2026, HANDOFF 3.89)
Nate 10/4: a profile people know they have, where profiles usually sit, only with a mobile number or an email; "I'm a..."
titles from a researched list or their own words, the two that fit each bill opening the letter; a saved story; no
"speaking for a group"; where they live only in letters to their own lawmakers. Plan, research and mockups:
https://claude.ai/artifact/FSzXqzhDcJggJtbhkoNX1d (REQUESTS R-147).
- **Where it sits:** More's first row (`more.js meRow`): initials, name, two titles and districts, "Your profile"; without a
  number or email, "Make your profile". The More tab's icon becomes the initials and a laptop's header shows initials and
  first name at the top right (`app.js whoAmI`, kernel-only like the rest of the first wave). `#/settings` opens it.
- **The page** (`pub/profile.js`, `profile.css`, `#/profile`): About you (name on your letters, titles, where you live),
  Your story (and "HIPHI may quote me", the old 'quote' interest), How you'll help, Alerts (the text number masked, the
  two email choices), Your issues, Your data (sign out, delete). One section changes at a time (B-12); "Saved." under it.
  Without a profile the page is the invitation: the R-146 box (`alerts.js alertFields`, source 'more'). It replaced
  Settings: the email choices, name, address, interests, Your data and deleting moved here. It no longer asks for a phone
  for staff (people.phone, staff-visible); the only number is the text-alert one, which staff never see.
- **Storage** (`pub/myprofile.js`): hiphi_me keeps name, titles, story, quote, interests on the device; signed in, the
  account too (backend 125: people.titles, people.story, save_my_profile_v2 changing only the keys sent, my_profile_v2
  read at sign-in in `kernel.js loadUser`, where the device's titles and story join an account that has none).
- **The titles** (`pub/titles.js`, pure, also imported by Staff v2): the agreed list, eight first and five groups; each
  has `say` (the letter's words), `topics` and `words` (how well it fits a bill), `self` ("writing for myself" for faith
  leader, neighborhood board member, nonprofit worker, public health worker). `pickTwo` picks the two that fit a bill
  (words 3, category 2, their order breaks ties); `withTitles` writes "As a parent and teacher, I support HB 1523.".
  Own titles are 'own:' + their words (40 characters). `tests/titles_test.mjs` (23 checks).
- **The picker** (`pub/titlepick.js`): tap buttons, the student choice, "More titles", and a box that suggests as you type
  and adds their own words (only the list redraws while typing, so a phone keyboard stays up). Since R-156 the walkthrough
  shows only their titles and "Add a title", which opens the picker in its add-only form.
- **The letters** (`helper.js`): About you has the picker, a preview of the first line, "Use different titles for this
  letter" (two for this letter only, kept with the draft as `use`), their story as the reason when there is none for this
  bill (marked "Your story, from your profile. Change it to fit this bill.") and "Save this to my profile as my story".
  Testimony adds "I live in Hilo, in Senator X's district." only when their own senator or representative sits on the
  committee (`liveLine`, `legsOf`); an email says "and I live in your district" only to their own lawmakers, including a
  chair who is theirs. The bill page's quick email (`bill.js mailFor`) no longer says the town to a chair who isn't theirs.
- **Staff v2:** the person page shows "They are" (titles, their own words in quotes) and "Their story" (whether they said
  HIPHI may quote it); Supporters' filter has "They are" (titles at least one supporter has), with the same filter in
  people_match (backend 127) so a saved segment counts the same at the send. Both staff data layers carry the filter.
- `tests/profile.py` (31 checks, phone and laptop); `tests/alerts_ask.py` updated for More's first row.

## The profile after Nate's first look (R-165; 5 Oct 2026)
Nate 10/5 on R-156: "+Add" read wrong and didn't look like a button; the page looked editable before pressing it; opening
and closing one box at a time was a hurdle; "Name on your letters" should be "Name"; the story words were unclear and
the questions too specific; How you'll help cold, with only three choices; the student choice clunky; the address must
clearly never be saved; stories by issue, not by category, followed issues first; in letters, one title by default and
more a tap away. His answers: edit in place; all four groups of ways to help with "Something else? Tell us"; keep a
general story. Backend migration 135.
- **Edit in place** (`pub/profile.js`): the page is the form, with no Add, Change, Save or Cancel. The name saves on Enter or
  when the box is left (the header follows); each title tap saves; picking an address saves its districts ("Saved your
  districts. Your address was not kept"); a story saves after a pause in typing and when the box is left; ticks and the
  quote choice save as they change; the email choices too. `flash()` puts "Saved" (or the error) beside what changed and
  says it aloud; taking a title off or emptying a story says so with Undo. Nothing redraws while typing.
- **Stories by issue** (people.stories keyed by the issue's id, backend 135; R-156's category keys still read): the general
  story, then one box per issue story, then "Add a story about one issue", a select with the issues they follow first and
  "Another issue…", which opens every other issue by topic. One warm question for all (`storyAsk`, `STORY_HINT`). Letters
  use the story for one of the bill's issues (followed first), else the general one (`helper.js catsOf`, `topicOf`).
- **How you'll help** (`myprofile.js HELP_GROUPS`): warm words, four groups (Speak up, Spread the word, Show up, Bring my
  skills), fourteen choices, and "Something else? Tell us" (people.help_note, 200 characters). Staff see the choices in
  both staff apps' INTERESTS and the note on the person page.
- **Titles:** "high school student" and "college student" are shown first as plain titles; letters use one title by
  default (`titles.js pickTitle`), and a tap adds more, as many as they like ("As a parent, teacher and coach").
- **The address:** "We don't keep your address. We use it once to find your senator and representative, and save only
  their district numbers." The "testimony is public" line moved to the stories.
- Tests: `tests/profile.py` (80 checks), `tests/titles_test.mjs` (29), backend `test_135.js` (15).

## The profile after its review (R-156; 5 Oct 2026; the review: https://claude.ai/artifact/7C9NPtvH8DTVCTsQEgRkcV)
Nate 10/5, "Do it": all twelve recommendations of the review of R-147, as recommended (C1 as "choose the next ask"; D1 is
R-155's sign-in by text code). Backend migration 130.
- **The device and the account** (`kernel.js profileJoin`, `profileOnDevice`, both pure and tested): once a device has been
  signed in to an account (`hiphi_me.acct`) it follows the account, so a story or titles cleared elsewhere stay cleared; a
  profile made signed out fills only what the account lacks (name, titles, stories, help, quote choice, districts); another
  account's leftovers are cleared; the account's districts win (the old town is dropped). Sign-out and deleting the account
  take the profile off the device (`myprofile.js forgetProfileOnDevice`, the shared `PROFILE_KEYS`). One name everywhere
  (`myName`: the account's, else the device's even when cleared, else the first visit's; a save updates the first visit's too).
- **Titles:** a second title only when the bill's own words name it (`titles.js pickTwo`; the replay on 248 bills found the
  off-topic second title on up to 142); own words that are a list title become it (`listKeyFor`). The picker (`titlepick.js`):
  Enter picks the list title typed; a title typed but not added is kept on Save and on Next (`pendingTitle`); focus stays on
  a chip and each change is said aloud; the listbox is always in the page; `addOnly` (the letter's "Add a title") only adds,
  with "Done adding". The letter's chips change only that letter.
- **Stories by topic** (people.stories, `myStories`, `storyFor`, `otherStory`, `STORY_ASK`): one for any issue and one per
  category ("topic" on the page, since "Your issues" means the issues followed); a letter fills in the bill's topic's story,
  else the any-topic one; another topic's is offered ("Use your story about …"), never filled in. The profile lists them,
  each with Change; a Topic select and the topic's own question as the box's label; Remove with Undo. After a letter is sent, someone with a profile and no story for the topic is asked for one sentence (their
  reason in the box), once per topic.
- **What the letter says** (`helper.js saysBox`): under the letter, "About you, in this letter": titles, where they live and
  their story, each a tap to leave out ("· left out" with a plus to put it back; `x.use = []`, `x.noLive`, `x.noWhy`, kept
  with the draft); the line above the letter asks them to make the first line their own.
- **Quote me** in three choices, asked once for all the stories in its own row under Your stories (interests 'quote' plus
  'quote-name' or 'quote-media'; R-147's tick reads as first name and island); staff see which, and staff edits keep it.
- **How you'll help** says what each answer does; "I'd testify in person" puts "When and where to go" under the main
  button of a hearing's card (`actions.js wantsInPerson`), the walkthrough's form step says to pick In person, and its
  Mahalo gives the room, time and "arrive 15 minutes early"; "I have a story to share" left (Your story covers it).
- **The profile named:** the first visit's last page (`start-rest.js`, with an account or a text number) and once after a
  letter (`helper.js profileLine`).
- **iPhone:** "Add the tracker to your Home Screen" with the steps, once, for someone signed in (`profile.js
  homeScreenNote`); not for a profile kept only on the phone, since the Home Screen app has its own storage.
- **Email code** (`phone.js EMAIL_CODES`, `verifyEmailCode`): "Or type the 6-digit code from the email" under the sign-in
  page's "Check your inbox"; off until Supabase's Magic Link email carries `{{ .Token }}` (Nate's dashboard step); `&ecode`
  in the practice copy.
- **Small fixes:** initials skip the ʻokina; the bill page's quick email signs off with the town only to their own lawmakers
  and says "your district" to a joint hearing's chairs only when both are theirs; Undo when titles are taken off; "Saved."
  said aloud; Escape closes a section; a story over 600 characters is said to be cut.
- **Counts** (kind only, backend 130): profile_titles, profile_story, letter_titled, letter_story, ask_shown, ask_acted,
  home_how; the privacy page says so. **Staff:** Supporters' folded "Profiles" card (how many give titles, a story, may be
  quoted; the list titles by use; the titles people wrote themselves), `DB.profileRollup` (backend `profile_rollup`).
- A fresh-eyes review (ui-critic) found twelve things, all fixed before publishing.
- Tests: `tests/profile.py` (78 checks), `tests/titles_test.mjs` (28), backend `test_130.js` (25).

## Sign in with a mobile number and a 6-digit code (R-155; 5 Oct 2026, switched off until texts are set up)
Nate 10/5: someone who signed up with a number could not get in on a laptop (only an email signed anyone in). His "Yes" to
sign-in by text code, and "Code at sign-up". The switch is Supabase's own phone sign-in; the runbook is the backend's
`docs/TEXT-SIGN-IN.md`. The practice copy turns it on with `&codes`.
- **The switch** (`pub/phone.js loadCodes`): the page reads Supabase's `/auth/v1/settings` (`external.phone`); off on any
  doubt. `codesOn()` decides every box, page and sentence below; off, everything is as R-146 and R-147 left it.
- **The alerts box** (`alerts.js`, every host): "Text me a code" sends a code (`sendCode`: signed out `signInWithOtp`, signed in
  `updateUser({ phone })`), and the box becomes the code field under "Check your texts" (`codeFields`, `codeStep`; `one-time-code`, six digits send it, Android
  fills it in by itself through WebOTP). The bar or card button says Confirm (`alertButton(pfx)`). The right code signs in
  without restarting the page (`verifyCode`, `S.quietAuth`, then `loadUser`), the number is kept under consent words t2
  (`TEXT_FINE_CODE`), and the row is confirmed (`kernel.js linkText`, backend `text_link`). "Send a new code" says "Wait a
  minute" inside a minute; "Use a different number" goes back with it typed, and "Use email instead" is there too.
- **Sign in** (`more.js phoneInView`, `#/signin?by=number`, from the header, More and the profile): number, code, then the
  profile. Signing in never turns texts on. A number-only account's "Add your email" adds it to the same account
  (`updateUser({ email })`).
- **Until it is on:** More on a laptop (900px and wider) says "Signed up with your number? Add your email on your phone,
  then sign in here with it."
- **Profile and privacy:** "Signed in with (808) ••• 0123"; no email choices without an email; Your data's number-only
  wording; the privacy page's three codes-on sections (`PRIVACY_CODES`).
- **Staff:** a number-only supporter has no email: `personName` falls back, the person page says so, and the duplicate
  finder never matches two empty emails.
- **Fixed on the way:** the letter helper's alerts box was never wired (its ids were renamed after drawing); `nudgeCard`
  and `wireNudge` now take the helper's own prefix.
- Tests: `tests/phone_signin.py` (the practice copy with codes off and on, and the live page with Supabase answered by
  the test); backend `tools/migration_tests/test_128.js`.
