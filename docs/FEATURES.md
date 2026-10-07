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
with three named parts at the top ("Your issues · A bill’s story · Stay connected" since R-174; a signpost, never a bar or a counter):
topics (six tiles, most important first) -> "Your issues" (R-039, 9/26, changed by R-139, 10/6: about ten issues in all however many
topics were picked (`ISSUE_TOTAL` in `pub/start-rest.js`, shared out one rank at a time so every topic shows its best), each topic's issues
together under it with no separate "top issues" block; a card is the issue's name and one short line, with no bill count, position, hearing
chip or "What it does"; one line says following is free, at most one email a day; only the four most important shown can start ticked; importance uses
`public_issues.top_priority` and the staff switch `issues.first_visit`, migration 066; its numbers are `WEIGHT` in `pub/rank.js`, shared with the
suggested bill on Home and Find since R-094: change them there, once) -> "Get alerts on your N issues" (R-146, 10/4: the
alerts ask moved here from "Coming up"; a mobile number first, email as a link under it, `pub/alerts.js`, the same box as
Home's card, the one after a first action and More > Get alerts at `#/alerts`; a number is kept privately with its consent
version in `text_signups`, backend 121, nothing is sent until texts are set up; passed over when there is nothing to ask,
`askAlerts()` in `pub/start.js`) -> the "Mahalo!" moment (naming the number or the email when one was given) -> ONE
lesson, "A bill's story" (R-062, 9/29, rebuilt twice that day: one page in three stages walked with the primary button,
the drawing changing in place: the bill, its road to where it really is, then "Three moments to speak up" (R-089, 10/6, Nate: direction C
with heavy hand-holding): three buttons in the order a bill meets them (before a hearing: email the chair; at the hearing: send testimony; before the full
vote: tell my legislators), each a drawn neighbor doing it and what CAN happen, tapped through (`CHOICES`, `momentOf`, `momentPanel`, `storyChoose` in
`pub/lessons.js`); it opens on the bill's own moment, marked "is here", with its real date ("testimony is due Wednesday at 9:30 AM"), says how many of
the three have been seen, and "Stay quiet" is gone as a choice (its point is the closing line: most bills stop at one of these moments, often without
anyone asking about them); a law, a stopped bill, one on the Governor's desk and any bill between sessions are at none and the page says so; Back steps
back through the stages; counted as step 'bill'; `pub/lessons.js` section 4, `lessonStep()`, also at
`#/learn/story`; the older three lessons stay at `#/learn/bill|session|hearing` for links from bill pages and Help; on a
laptop that page has the first visit's two columns, the drawing and heading on the left and the words on the right, R-173)
-> (its last button, "Next: Your Legislators"; no full-screen moment there since R-140) -> who speaks for you (street address only) -> "Coming up on your
issues" (with the optional first name once a way to reach them was given) -> "You're all set" (the peak) -> Home, which says "Aloha" and shows
the week's first hearing with "See how to help". A newcomer who opens a shared bill gets a "New here?" card on the bill
page (`newcomer()` in `pub/bill.js`: the easiest action, "Follow this issue", "Not now"); `wiz().via` then runs the
shorter flow on that bill. Motion and celebration are `pub/fx.js` (`burst`, `celebrate`, `travel`, `swap`; DESIGN A-10
and C-7 rewritten 9/21). The visit is counted privately by `pub/visitlog.js` (`log_first_visit`, migrations 067-068;
staff see it in Outreach > Issues > First visit). Testimony is "due", never "closes", in the first visit (late testimony
is still taken, marked late). **Its words are a step larger and short (R-174, 10/5, DESIGN A-4 and C-14):** `pub/base.css`
redefines the type tokens on the first visit's `<main>` (`body[data-screen=start|learn]`) and its moments, so every plan,
lesson and step reads one size up without a size of its own; the must-read grey lines are `--n700`; each sentence under a
heading is 30 words or fewer and says nothing the screen says elsewhere. On phones the first screen's three promises are
three lines under the sentence, and Plan 4's four ways are one per row; cards' summaries get three lines; the story's
first stage has no lead sentence of its own ("This is your bill" says it); the ending's share and keep lines put each button
on its own line (`.kp-dot` hidden). `tests/fv_type.py` walks every version.
**Emails are walkthroughs too (R-079, R-080, 9/29):** `pub/helper.js` has modes `testimony` | `email` | `legislators` | `intro`
(open with `app.openHelper` for testimony, `app.openMail(o)` for the rest). Every letter or email about a bill opens on
"Where do you stand?" (R-167, 10/5), a letter sent again and the reminder too, the earlier answer chosen and said ("You
marked Support on the bill page.", "Your letter of Feb 18 said you support it."), Next keeping it; another answer before
a letter sent again is checked against it (amber) and the letter is written for it (`restance`). Late testimony stays
testimony: no "Email the chair instead" (`tests/stand_back.py`, `again.py`, `again_mail.py`, `email_walk.py`).
Email: stance → know the bill → about you →
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
sent to ... Tap it when you finish here", "See How I Can Help" (R-190; it said "See my home page"). Counted privately as step 'home' (view, done/skip).
**`?demo=1&restart`** (an inline script in `track.html`) clears only the sandbox's own storage, so the testers' two links
start from the beginning: `track.html?demo=1&end=today&restart` and `track.html?demo=1&end=home&restart`. Fixed in both
versions the same day: Home's "Your issues" rows open their issue; the sandbox remembers an email was given (it asked
again on Home); the welcome-back email ask is not shown after a link was sent; the story's last stage names a real
hearing instead of "Nothing to do now"; a tour is no longer blocked by fx.js's hidden celebration element (the bill tour
never started after the first visit's celebrations). `tests/home_end.py`.
**Two more teaching places (9/29):** the first bill page anyone opens gets a three-tip tour, once (since X10-4, only someone
nobody has shown around; others get a "Take the tour" line, wave 1 below) (`pub/tour.js`, mounted
from `pub/app.js` `render()`; remembered in `hiphi_tour_bill`; held back by the "New here?" card, dialogs and
celebrations; tests set the flag in their setup, `tests/bill_tour.py` tests the tour). Help (`#/help`, `#/help/<slug>`) is
50 ready-made conversations (R-075: tap a question, a short answer with a small drawing, the next question; no typing
box): the words are in `pub/talk-data.js` (edit words there, not in `pub/talk.js`); `tests/help_talk.py`. On a phone (under
600px) the seven groups are folded `<details>` bars with a count and a chevron, so every group's name is on the first screen
(R-075, Nate 10/4; A-2); the group of the conversation just left is open when Back returns, and a search opens every group with
a match. From 600px up nothing folds and a heading is only a heading (`fold()` in `pub/talk.js`).
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
Coming-up screen stays quiet once the walkthrough asked, `S.nudgedThisVisit`), and after acting Done goes to Home (X10-2,
wave 1 below; it went on to the "voice" step's "Go to my home page", since R-190 "See How I Can Help", or "Show me how it works (2 min)"). Tests: `tests/share_links.py` (24 checks, with Staff v2's
hearing back link and the Help words from R-112).

**A shared link leads with its ask and opens it (R-169, 10/5).** Nate: "Card wording should lead with the action that is
being asked of them. The link needs to link them to taking action, not just the bill page." A bill HIPHI has a stance on
has one share page per ask (`tools/share_pages.mjs`, the words and the choice in `tools/share_cards.mjs`): `b/HB1573-testify`
("Speak up by Wed, Mar 18: <name> (HB 1573)", the committee, the hearing day, about 10 minutes, HIPHI's stance; opens the
testimony walkthrough), `-ask` ("Ask for a hearing: <name>", or "Ask the chair to hold" where HIPHI opposes, with the
committee and its deadline; opens the email walkthrough to the chairs), `-floor` ("Ask your senator to vote yes"), `-conference`
("Ask lawmakers to pass it"), `-governor` ("Ask the Governor to sign" or "veto"), and `-follow` ("Follow the issue: <issue>",
with the bill's news: became law, stopped, "ideas like this often come back"; opens the issue page). `b/HB1573` carries the
bill's ask of the moment. Every share passes its ask: `shareFor(b, h, { ask, chamber })` with `shareAsk(b, x)` from the bill
page (bill.js: a hearing ahead is testimony; a bill waiting for one, the chair; then the floor, the final version, the
Governor; anything over, following), `billShareUrl(b, ask)` in core.js, the walkthrough's "Tell a friend" (the ask just
taken), and Staff v2's share kit and "This week's asks" (`sharePageUrl(b, 'testify')`). The routes `#/bill/<n>/ask`,
`/floor`, `/conference` and `/governor` join `/testify` and `/email` (app.js); `openAsk` in bill.js opens them once the
legislators have loaded: the walkthroughs for testimony, the hearing's email, the chair's email and the floor vote ("Find
your legislators" first when theirs are unknown); the final version's email and the Governor's form open in another app,
which needs a tap, so their main button is put in front. An ask that has closed says so in a toast ("Testimony on this bill
has closed. Here's what you can do now.") over the bill's ask of the moment. The "New here?" card has words for every ask.
The message's words follow the ask too, except where the share test runs (a deadline or a hearing ahead, R-135), which keeps
its two messages. The pages carry no `<meta http-equiv="refresh">` (Facebook's robot followed it to the tracker's general
card) and no `og:url` (Facebook and LinkedIn link to it, dropping `?via=`); their script sends people on. `404.html` turns
`b/HB2121-testify` into `#/bill/HB2121/testify`. The job runs hourly from January to June (daily otherwise), pushing with a
retry. Found and fixed with it: the calendar feeds (R-125) never held an event (the job did not read the issue's id);
speakup.js read no year in the address, so on `#/bill/2026/HB1518` "Ask the chairs" opened a bare email instead of the
walkthrough; a page opened from a shared link (`?via=`, not a reload) no longer reopens a walkthrough left open in the tab
(R-113, helper.js `freshLink`). Tests: `tests/share_cards_test.mjs` (23 checks, every push), `tests/share_asks.py` (19),
`tests/share_links.py`, `tests/year_links_live.py` (the published pages).
Then Nate (10/5): "The link works but the share card is not specific about the action. It should be." In a text the
picture is most of the card, and every card had the same one; and the practice copy shared the tracker's own address, whose
card is the general one. So: **a picture per ask** (`pub/og/testify.png`, `ask`, `hold`, `floor-yes`/`-no`,
`conference-yes`/`-no`, `governor-sign`/`-veto`, `follow`, `law`; drawn from one template by `tools/og_images.py`, the
brand's mark, Capitol and fonts), the ask in large words ("Testimony needed / Tell lawmakers what you think"), picked per
card by `imageFor` in share_cards.mjs; `pub/og.png` redrawn the same way ("issues", `?v=` on track.html). And **the
practice copy's own share pages**, `b/demo/` and `i/demo/`, built from `demo/snapshot.json` at its day (Mon 16 Mar 2026)
by the same job, `noindex`, opening `track.html?demo=1`: the practice copy (in session; not `?season=off`) and Staff v2's
practice copy share them (`billShareUrl`, `issueShareUrl`, `sharePageUrl`), so a share made there shows the in-session
card now; `404.html` sends a `b/demo/` link to the practice copy.
Then Nate's picks (10/5) from a debate of the words and three picture directions: **testimony takes "a few minutes"** on
every screen (the bill page's newcomer card, More ways to help, the cards, onboarding plan 4 and the new onboarding's sample
alerts; emails stay "about 2 minutes"), and **the time is recorded**: `logTime` in visitlog.js sends the seconds from
opening the walkthrough to sending (testimony, not one sent again; a chair's email), first testimony on the device or not,
device and version, to `log_act_time` (backend migration 143, `act_times`; staff read `act_times_weekly`), the start kept
with the draft for three hours so a reload on the Capitol site keeps it. **Pictures per ask and per issue**: each ask its
own wash, label icon and drawing (testimony orange with neighbours speaking up, "Testimony due soon / Speak up before the
vote"; a hearing blue with a calendar, "Needs a hearing / Help this bill get a hearing"; the floor vote violet, the final
version teal, the Governor green with the Capitol, following grey with a bell, a law gold with flowers), and for a bill
with an issue the same ask with the topic's icon and colour and the issue's name in place of the drawing
(`pub/og/<ask>/<issue>.jpg`, drawn only when a page needs one: `tools/og_wanted.json` lists them, the job draws the missing
ones and builds again). JPEG at quality 86 (about 60 KB; the PNGs were 185 KB). Tobacco's topic icon is the crossed-out
cigarette. "Testimony" stays once, with plain words around it; the title under the picture keeps the ask first; "HIPHI"
stays.

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
The lessons and the tour read those words, so change them there. The session lesson's drawing is too small for a full
name, so its label under the bill says the same place by chamber only (`pic` beside `rest`, read through `railBrief()`: "In
the 1st of 2 Senate committees", "Stopped in House committees"; R-179); new words go into both. "See all steps" links each committee's page; More
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
- **Edit on the page, then Save** (`pub/profile.js`): the page is the form, with nothing to open or close. First built 10/5
  as save-as-you-go; the same day Nate: "I think the lack of save button or undo button might hurt. People should be able
  to cancel their changes." His choice: a save bar. A change goes into a draft (`P.draft`, compared with `P.base`); a bar
  at the bottom (`.actionbar`, drawn by `paintBar` without redrawing the page, and by the screen's `bar()` on a redraw)
  says "You have unsaved changes" with Cancel (everything back as saved) and Save (`saveAll`: one `saveProfile` with only
  what changed, and the email choices). A draft survives a redraw and a trip to another page; closing the browser tab
  with one asks first. A picked address shows "Found your districts. Save to keep them." The toast sits above the bar.
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
- Tests: `tests/profile.py` (78 checks), `tests/titles_test.mjs` (29), backend `test_135.js` (15).

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
`docs/TEXT-SIGN-IN.md`. The practice copy shows it on by default since R-176; `&codes=0` shows the page as it is until
texts are set up.
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
  then sign in here with it." The box keeps the number under consent words t3 (R-176, below), which ask for no YES.
- **Profile and privacy:** "Signed in with (808) ••• 0123"; no email choices without an email; Your data's number-only
  wording; the privacy page's three codes-on sections (`PRIVACY_CODES`).
- **Staff:** a number-only supporter has no email: `personName` falls back, the person page says so, and the duplicate
  finder never matches two empty emails.
- **Fixed on the way:** the letter helper's alerts box was never wired (its ids were renamed after drawing); `nudgeCard`
  and `wireNudge` now take the helper's own prefix.
- Tests: `tests/phone_signin.py` (the practice copy with codes off and on, and the live page with Supabase answered by
  the test); backend `tools/migration_tests/test_128.js`.

## No "reply YES" anywhere: the code everywhere (R-176; 5 Oct 2026)
Nate 10/5, walking a first visit: "during onboarding we are asking for a code to be relayed back to us after they sign up
with their phone number. The page says to 'reply yes'". The YES words were the page before codes are on (R-146's t1). His
choice, "Code everywhere":
- **The practice copy shows codes on by default** (`phone.js loadCodes`: `codes=0` turns them off), so every check link
  shows the code step R-155 decided. The live page still asks Supabase.
- **Before codes are on** the box keeps the number under consent words **t3** (backend 141): "We’ll text you to confirm
  it’s your number." (`TEXT_FINE`), in place of "Our first text asks you to reply YES". The "almost set" lines say the same
  (`alertDoneHTML`, the "Mahalo!", More > Get alerts and its toast, the profile's "Your profile is made", the plans' join
  step in `onb-join.js`), and so does the privacy page (dated 5 October).
- **The step budget** for signing up for alerts is 3 with the code (DESIGN B-2): type the number, Text me a code, the code.
- Tests: `tests/phone_signin.py` (the default practice copy has codes; `&codes=0` has no YES), `tests/alerts_ask.py` and
  `tests/helper_alerts.py` (the box before codes, its new words), `tests/journeys.py` (the code journey),
  `tests/plans.py` (the plans' join step takes the code), `tests/profile.py` (`&codes=0`); backend `test_141.js`.

## Directions for someone going to a hearing in person (R-142; 5 Oct 2026, HANDOFF 3.97)

Nate 10/4: "People should be provided directions to in-person hearings if they sign up for them." The sign-up is the
hearing card's "I plan to go" (`didKind(b, h, 'attend')`, as before); everything else is in `pub/actions.js`, "going in
person".
- **Before the sign-up** `goPanel`: the address, the room with its floor (`roomFloor`: Room 229, 2nd floor; the 0s are
  the chamber level), the time, "Anyone can sit in and listen", and what saying "I plan to go" brings (C-6).
- **After it** `planBlock`: "Go to the hearing" leaves More ways to help (the done line has the plan and its Undo), and a
  "How to get there" button sits under the card's buttons (so "Write my testimony" stays near the top, A-13), open right
  after the tap with focus on it, with "I can't go" beside it when the done line's Undo would take back a later step.
  The plan lasts until the end of the hearing's day in Hawaiʻi (`goingOn` in core.js: hearings run late), then "You
  went". **Going no longer settles a hearing while testimony is open** (`settledOn`: the 9/26 Share rule, R-005, now for
  going too), so the card stays on Home with its deadline's warning and Home never says "all caught up" with testimony
  due; once testimony is sent or closed, the card folds and Home's plan card carries the plan. `goDirections` is the
  one list everywhere: arrive by (20 minutes before), getting there (bus on Beretania, parking under the building from
  Miller Street and the state lots), getting in (photo ID, bag check), finding the room (`findRoom`, from the room
  number's first digit), how to speak (or "If you chose In person..." once testimony is sent, or "Listening" once it is
  closed), the Public Access Room, then Directions (Google Maps directions, counted as `directions`, backend 134) and
  Add to my calendar ("Saved. Open the file to add it to your calendar." after). The facts and their sources are in one
  object, `GO`, at the top of that block; the help number never breaks across lines.
- **Changes:** `hiphi_going` keeps each planned hearing's room and time in this browser (`noteGoing`); a later change of
  room or time is said on the card and on Home (`goChange`).
- **Home** (`goingPlans`, `goingCard`, from `returnView` and `exploreView` in `pub/home.js`): hearings planned within a week and not already
  drawn as a card. Today's and tomorrow's lead the main column; later ones sit in the side column. A cancelled one says
  so, with "I'll go to the new one" when the same committee set it again (`data-goswitch`).
- **The calendar file** (`icsFor`): for someone going, the hearing's place has its floor, its notes carry the directions,
  and it reminds them an hour and a half before.
- **The walkthrough's last page** (`goingLine` in `pub/helper.js`): "Going to the hearing in person?" with "I plan to go",
  or, for someone whose profile says they'd testify in person, the room, floor and time first; after the tap the same
  list, with its own "How to get there" title (no button above it there).
- **Help:** "How do I get to a hearing at the Capitol?" (`getting-to-the-capitol`), linked from "Can I watch a hearing?"
  and "Should I go in person or use Zoom?".
- Not covered: a hearing on a bill the person does not follow is only on Home when it is loaded that visit (as the
  "Finish your testimony" card); the evening-before email with the directions comes with the rest of the public email
  (R-101).
- Reviewed by the ui-critic agent before publishing; its fixes are in (the deadline kept, the plan through the hearing day,
  "I can't go", no toast over the done line, the words, the number on one line). Kept on purpose: the walkthrough's last
  page shows the list open after its own "I plan to go" (the tap asked for it), and Home's session panel keeps "You
  planned to go" in the person's record.
- Tests: `tests/going.py` (100 checks, phone and laptop: the sign-up, the list, focus, the calendar file, a reload, Home
  with testimony open and sent, "I can't go", a changed room, a cancelled hearing moved, the hearing's own day, the walkthrough's last page for both kinds of person, Help); backend `tools/migration_tests/test_134.js`.

## The first visit, six ways: five plans under test (R-164; 5 Oct 2026, HANDOFF 3.98)

Nate's ask (10/5): five onboarding plans from a blank page (the doc "Onboarding: five plans",
https://claude.ai/artifact/9Fa9anaztdBJBS1uSXVbMP), then "I like plan 1 ... build mockups for the other plans too ... These
will be offered as different options that we can test", with a switch per version and the alerts sign-up kept in every
first visit. All five are working versions in the same frame as today's first visit.

- **The test** is `onb` in `pub/variant.js`: six versions (today's, p1 to p5), each with its own switch (`ab_tests.arms_on`,
  backend 136) in Staff v2 > Session setup > Tests. A new browser keeps a number from the toss (`hiphi_ab.u.onb`) and gets
  one of the versions switched on when its first visit starts, evenly; the lock keeps it. While a browser is on a plan,
  the tests inside today's first visit (`end`, `fv`, `email`) are never met or counted, and every first-visit count
  carries the plan's word as its version (`variantInfo`). A newcomer from a shared bill keeps today's link path
  (`planOn()` is '' with `wiz().via`). Force one with `?ab=onb.p3` (a tester's link, counted apart).
- **The plans' shapes** are `pub/plans.js` (first wave, kernel-only): each plan's steps in session and between
  sessions, its three named parts, titles, time promise and the topics screen's words. `start.js` uses them in `flowOf`,
  the chapters, the titles and `stepTopics`; `finish()` keeps `wiz().plan`.
- **The plans' screens** are `pub/onb.js` (loaded when a plan's first visit is drawn, with `onb.css`): `picks` (three
  issues ticked for you, each with an untick: Plans 3-5), Plan 1's gradual build-up (Nate 10/5: "too aggressive ...
  find a bill they want first, then learn, then decide"): `find` (up to four bills on the picked topics, one per issue,
  soonest chance first; nothing is asked until one is picked), `learn` (what it does, Plan 2's small road and the bill's
  own plain status, when people can help) and `decide` (three equal cards: write it now, a reminder before the
  deadline, or just keep watch; the walkthrough's Done hands back through `app.onbActed`, set here and called from
  `helper.js`; a reminder makes the sign-up say "We'll remind you before Monday"),
  `hello` (the one-time introduction to your two legislators, `openMail({ mode: 'intro' })`), `join` (the sign-up) and
  `wrap` (the ending). Plan-specific screens: `onb-p2.js` (the story and the road), `onb-p3.js` (the island),
  `onb-p4.js` (the ways to help and the first step), each with its own stylesheet. Plan 3's address step is today's
  (`you`); its island lights up there (`start.js myIsland` falls back to `wiz().island`).
- **The sign-up** (`join`, words in `pub/onb-join.js`) follows the research of 10/5 (kept with R-164): asked right after
  the person has done something, a concrete reason (hearings are set about two days ahead), an example of the text
  they would get (labelled "Example", never a real bill or day), how often in honest numbers (2026: someone following three
  typical issues had hearings in 7 of 16 weeks, at most 2 days a week), "Not now" as large as the main button, and a
  warm "You're set" after a yes. Two versions under their own test, `join` (backend 138): `shown` (the example) and
  `watch` (three steps: a hearing is set, we tell you, you send a note). The box, its consent words and the small print
  are `pub/alerts.js`'s, unchanged (C-4).
- **Later visits** (`pub/onb-later.js`, drawn at the top of Home by `home.js`): one card per visit with the plan's next
  small thing (find your legislators, the three moments to help, bring a friend), in each plan's order, each put away
  for good by "Not now" or by doing it (`hiphi_later`).
- **Checked by** `python3 tests/plans.py` (every plan walked to Home on a phone, a laptop and between sessions, the
  sign-up's equal buttons and words, "You're set", the later-visit card) and `python3 tests/abtests.py` (the spread over
  switched-on versions, the plans never counted in today's tests, tester links, the test off). Design exceptions for
  Plan 1 (an action in the first visit) and Plan 3 (the address before the bills): `docs/DESIGN-AUDIT.md` section 4.
- **The hello letter** (R-172, Nate 10/5: "too stiff. It serves no serious benefit"): `helper.js` mode `intro` and the
  legislators page's draft (`people.js`) are a short note from a constituent: the one issue they care about most (the
  issue of a bill they took a stand on, else the first they follow), their reason, at most one bill, one question that
  invites a reply ("Where do you stand on it?"), and one line for their other issues. No lists of bill numbers. Subject:
  "A question from your constituent in ...". Plans 2 and 3 are on hold as built (Nate 10/5), with his notes in R-164.

## What the first ten assessments found, wave 1 (R-180; 5 Oct 2026, backend HANDOFF 3.119)

- **Approving on the bill page** (staff, `staff/bill.js`): Approve and Request changes by the same rule as Review
  (`canFirstApprove` / `canSecondApprove` in `staff/model.js`), with the stand-in note, so the approver can act where they
  read the draft.
- **Email can only be on on purpose** (`emailCfgOf` in `staff/data.js` and `app.js`): a failed read of the email settings
  counts as paused, like a missing row (the database's `email_enabled()` agrees since migration 145); the sender form
  never writes `enabled`, and Save re-reads and merges. Approved supporter emails say "Approved · held while email is
  paused" until email is on.
- **An ask that has run out** (`liveAsk`, by the Hawaiʻi date): leaves This week's asks and the share kit, and Today asks
  for the next one.
- **The staff sign-in** spans the page, centred, named "HIPHI Bill Tracker · for the HIPHI team", with a link to the public
  tracker.
- **Words kept whole and true** (public): "e-cigarettes" never breaks after "e-" on screen (`keepWordsWhole` in
  `pub/ui.js`; copying and search see the plain words); the bill page's stance note says who sees the answer (signed in:
  you and HIPHI staff; otherwise this device). `tests/words_test.mjs` grades every summary, talking point, issue line and
  outlook (Flesch-Kincaid, against a baseline; more over grade 8 fails) and fails on "Hawaii" without the ʻokina or
  "dead/died" in public words (DESIGN C-10).
- **Only light** (`<meta name="color-scheme" content="only light">` on every page) until the tracker has a dark mode, so a
  phone's forced dark mode does not repaint it.
- **The finale** (all three endings): the words arrive first and every motion ends within 2 seconds; one `petals()` in
  `pub/fx.js`. **`motion.html`** (private, not linked, noindex) plays nine named moments side by side in frames of the
  practice copy, with Replay, Slow 1/4 and Reduce Motion: the place to judge motion (DESIGN A-10).
- **Text alerts terms** (`text-terms.html`): what you get, how often, cost, how to stop, help, your number and delivery, the
  page carriers ask for before texts can be registered; linked beside Privacy in the alerts box when it asks for a number.
  Drafts for the lawyer (backend `docs/TEXT-MESSAGES.md`).
- **Stop texts to any number** (R-180 wave 2, D1-3; backend 156): under More > Get alerts a quiet "Stop texts to a number" fold takes a
  number and stops it from every browser, with no code (`stopNumber` in `pub/alerts.js`); the answer is the same whether or not the number
  was on file. Staff see the totals of sign-ups, confirmations and stops, never a number (First visit > Text sign-ups, D1-7).
- **The plans' sign-up** (D1-6, D1-1): on a phone the example goes under the box (and on a short one the lede too), so the promise and
  the small print are above the pinned button; "Not now" ends the visit's alerts ask for Home. Plan 1's choice offers "Add the hearing to
  my calendar", never a reminder nothing sends. "Use email instead" on More > Get alerts and the profile's invitation swaps the box in
  place under the same promise (D1-5; the consent is logged by the database with its own time, backend 157-158).
- **The privacy page** (J2-3): opens with "What we have on you, in short", then short lists, the keeping periods and "Delete it, or ask
  us to" (contact@hiphi.org, 10 business days). Every sentence is ticked against the code in backend HANDOFF 3.142.
- **Session setup > Privacy and keeping** (J2-1, J2-2): admins forget a person (an email, a number or both; counts back, never contents)
  and see the keeping periods, what is past or near its date, and the switch of the nightly clean-up (off until Nate's yes).
- **`unsubscribe.html`** (X1-7): the page every email's Unsubscribe link opens; only its button posts the unsubscribe, so a mail scanner
  that follows links cannot unsubscribe anyone. It talks to the Edge Function `unsubscribe` v2 (deploys with Nate's yes).
- **A stopped bill whose same idea became law** (X4-4): "The same idea became law as SB 2175, Act 189." under why it stopped (a named
  companion), or "On “the issue”, SB 2175 became law (Act 189)." when only an issue ties them (the other chamber's bill, same session).
- **`look-options.html`** (X9-3, options only): four looks for the first screen, as pictures; nothing in the tracker uses them yet.
- **After a first action, the visit ends on the success (X10-2).** A newcomer from a shared link who sends testimony (or the
  quick email) and taps Done goes to Home (`homeAfterAct` in `pub/bill.js`, from `app.newcomerNext` and
  `app.newcomerActed`), not into the story, the address and the finale: the first visit counts as finished (`wiz().done`,
  `viaHome`; counted as 'act' done and 'done' done), and Home keeps its calm first-visit shape for the visit. **Home leads
  with what they did** until the committee decides (`loopCard` in `pub/home.js`, for everyone, in every in-session Home):
  "You sent testimony on <bill>" (or "You emailed the chair about"), the number, "The committee hears it Fri at 9:30 AM"
  ("today" on the day), and the video (`streamOf`); after the hearing, "We'll show what they decide here", for three days.
  It reads only this browser's marks (`myActions`); a hearing with its own card on the page (a plan to go, a card done in
  place) is left to it, and "Since you were here", "What's new" and "What happened after you acted" leave its bill out
  (`S.hmLoopB`). Someone who came straight from a link is offered the story in one quiet line under it ("New to this? See
  how a bill becomes law", `#/learn/story/<id>`; gone once opened, `viaLearned`), and the story's last page tells someone
  who already spoke at that hearing "You already sent your note" instead of "We'll show you how" (`lessons.js`). The
  issue rows after the first visit say "Today" on a hearing's day, not the weekday (`yourIssues`). `tests/x10_close_loop.py`.
- **Clear the way for someone who came to act (X10-4).** The bill tour starts by itself only for someone nobody has shown
  around (`billTourHeld` in `pub/core.js`: not after a finished first visit, not for anyone whose first visit began on a
  link, not on a bill opened from Home to act, `data-hm-act` setting `S.toAct`); they get "New to this? Take the tour" under
  the bill's name (`tourOffer` in bill.js, `app.billTour`, `startBill` in `pub/tour.js`), gone once the tips are seen. The
  walkthrough's "Don't follow it" is "Stop following <the issue>", right under the sentence that says it is followed, and
  the link newcomer's moment says the same with "See How I Can Help" (R-190; it said "Go to my home page"). More's first row without a profile is "Get alerts
  and make your profile". The finale's "Turn on alerts" button is the next entry; Home's main button is R-150's question.
- **One status rule for alerts** (D1-4; `pub/alerts.js alertStatus()`): "on" only for a number confirmed by its code, or a
  signed-in account with an email and an email choice ticked. A number kept but not yet confirmed (codes off), a code texted
  and not typed, or an email link not yet opened is **"Alerts almost set"** (a sentence: "Almost set. ..."), in the alerts
  step's own words ("We'll text (808) 555-0123 to confirm it's your number.", "Tap the link we sent to ... to turn on
  alerts."; a code waiting: "We texted a code to ..."); anything else is "Alerts are off". Signed in with an email and both
  choices off, More > Get alerts and the sheet say "Your email alerts are off" with the way to turn them on (`emailLede`).
  Every screen that reports alerts uses it: the first
  visit's "Mahalo!" and its ending, the version that ends on Home (its ticks), the plans' sign-up ("Almost set", never
  "You're set" before the number is confirmed) and ending, More > Get alerts and its toast, the profile's Alerts, and the
  "we tell you" lines of the endings and Plan 4. Texts are still described as working (R-146).
- **"Turn on alerts" on the endings** (X10-4; `alertRowHTML`, `wireAlertRow`, `openAlertsSheet` in `pub/alerts.js`): the
  ending's alerts row (today's and the plans') carries its own button when alerts are off ("Enter the code" when a code
  waits); it opens the same alerts box in a sheet (from the bottom on a phone, 520px in the middle on a laptop; the consent
  words, the code step, email in place), and the ending is drawn again standing still (`S.stCalm`) with the new status.
  `tests/d1_status.py` checks both (72 checks at 390x844 and 1366x900; on the code before it fails 35).

## The tester sheet: a room of testers, each group on the versions Nate picks (R-185; 6 Oct 2026)

Nate 10/6, for a room of 15 testers: "Is it possible for me to easily pick which path they will experience rather than
have them go through a random A/B testing path?", then "make the tester sheet with QR codes. This should be made into the
app so I can do this on my own later and easily compare the different options."
- **Where:** Staff v2 > Session setup > Tests > Tester sheet (`#/setup/room`, admins), reached by the "Tester sheet"
  button beside "Check again" on Tests. It is a page of Tests (`PAGES.room.parent`): the list of parts keeps Tests marked
  and the way back says Tests. Code: `staff/setup.js` (search "Tester sheet (R-185)"), styles `.rm-*` at the end of
  `staff/staff.css`, the QR code in `staff/qr.js` (shared with Make a link since this build).
- **What it does:** "Where they test" (the practice copy, the default, or the live site); a card per group, side by side
  (`ul.rm-groups`, three across on a laptop), each with its first visit (today's or Plans 1-5, each plan with one line,
  `ROOM_PLAN_SUB`), then every screen any group changed, in the same order on every card (`roomShown`; at today's version
  it reads "(today's)" in plain weight, and "Replaced by the plan" where a plan never meets it), so the cards compare line
  by line; "Change another screen" (a screen, then its version; picking today's version everywhere takes the row off),
  its QR code, Open, Copy link and a "…" menu (Download the QR code, Copy this group, Remove this group with Undo); "Add a
  group" as the grid's last tile, up to six; Start over with Undo. "Print the sheet" (the save bar, sticky on a laptop)
  prints Nate's page (the groups screen by screen, each group's link, a blank "What we saw" row to fill in, and what every
  group is asked to do), then one page per group with the code at 110 mm and no link, which never says which version it
  is. **What every group does** (`ROOM_TASK`, the fresh-eyes review): a screen outside the first visit is only met by
  doing something (press Share on a bill, send testimony, Home with two issues), so when any group changes one, every
  group's page says the same "Then: ..." line (the practice copy names Free school bus passes, HB 1780). A first visit
  that is a plan drops the choices it never meets (`end`, `fv`, `email`), and today's first visit drops the plans' sign-up
  test (`join`), as `pub/variant.js` does (`INSIDE_TODAY`); a toast names what was taken off, with Undo.
- **The links:** the practice copy's is `track.html?demo=1&restart&ab=onb.<v>[,<test>.<v>...]`, naming the first visit
  and the screens changed: a test the link does not name shows today's version in the sandbox, and `&restart` starts each
  scan fresh. The live site's names every test (`?ab=` with all of them), so no coin toss is left; `variant.js` marks
  them forced, counted apart from the public (Tests' "Not counted: ... from testers' links").
- **Kept:** `advocates.prefs.room` through `DB.patchPrefs` (no migration), cleaned against the tests as they are when
  read, so a version removed after its test is decided drops out. The default sheet is one group per first-visit version
  switched on (today's and Plan 1).
- Tests: `tests/room.py` (108 checks at five sizes: the default groups, the codes drawn, arrival, side by side, add,
  pickers and the plan rules with the toast and Undo, the rows on every card, Copy link, the printed sheet's comparison,
  links, "What we saw", tasks and its pages without a link or a version, the live links, remove and start over with Undo,
  kept after leaving; then each link opened as a tester forces what its card says). `tests/density.py`
  has the page as `room`.

## "Save your profile": the ask right after a follow or a letter (R-184; 6 Oct 2026)

Nate (10/6): "if people get a link to take action or to follow a bill ... Are they then immediately prompted to sign-up?
It's crucially important that we encourage them to build a profile for future engagement opportunities." Walked as a
newcomer on the published site: following from a bill page's "New here?" card led to the first visit's alerts screen;
after testimony or a chair email the ask sat 793px down on an 812px phone, under "What happens next", and "Done" went
to Home with no ask; an issue page's Follow (where every live share card leads until January) asked nothing at all. Every
ask said "Get alerts", never "profile". Nate's answers: "Save your profile" (and a brainstorm of other words, numbered
for his picks: https://claude.ai/artifact/6nDhS6Loh5k1MMnukptc3B), no line on Home after a skip, and replace the old
ask but keep it as a backup to test later.
- **The words** (`pub/alerts.js`): `PROFILE_H` "Save your profile"; `profileLede(kind)` the line over the box, by what
  just happened: 'follow' (A1, "Nice start. Your profile keeps this issue with you on any phone or computer, so you're
  ready when it needs you."; "these issues" after a category), 'action' (B1, "Bills often get more than one hearing.
  Your profile keeps what you wrote, so you can send it again next time."), 'intro' (the hello letter, no bill), 'back'
  and 'first' (the first visit's screen, which still says in a few words what a hearing is). The box, the consent words
  and the small print are unchanged (C-4). After a number, `alertDoneHTML` starts "Your profile is saved."; an email's
  link "finishes your profile".
- **Where**: the first visit's alerts screen (`start-rest.js stepAlerts`), the card everywhere else (`actions.js
  nudgeCard`: Home, a bill page after an action, the letter's Mahalo), and after a follow outside the first visit
  `followAsk(name, after)`, which opens the alerts sheet (`openAlertsSheet` with `profile`, `lede`, `receipt`, `onNo`):
  "You're following ..." over the heading, the follow's own toast (with Undo) once it closes, "Not now" recorded as
  every "Not now" is (quiet 14 days, then 60), once a visit, never for someone signed in or with a number or email given.
  Called by `find.js` (an issue's and a category's Follow) and `bill.js` ("Follow the issue", a stopped bill's main
  button). After a letter the card sits right under the Mahalo (`helper.js` doneScreen, mailDoneScreen).
- **The backup**: the test `save` (`variant.js`, backend 148), off, its FIRST version the new ask; `?ab=save.alerts`
  shows the old one (no sheet after an issue's Follow, "Get alerts", the letter's card under "What happens next").
  Staff v2 > Session setup > Tests lists it with a practice link.
- **Found on the way**: an issue, category or list page drew its bill rows before `mybills.css` arrived, about two
  seconds at 409px wide on a 375px phone, so the phone zoomed the page out and a Follow tapped then opened the sheet cut
  off at both edges. `pub/app.js` SCREEN_CSS now loads `mybills` with them.
- **The fresh-eyes review's fixes (10/6)**: on the letter's Mahalo, while the ask waits, the bar's main button is the box's
  own ("Text me a code", `form="hp-ng-form"`, `helper.js askOpen`) and Done is a text button (a filled Done beside a typed
  number let people leave believing they had saved); Tell a friend comes back once it is answered, and the card's "Not now"
  now redraws the dialog (`wireNudge` calls its host's redraw). After a yes the follow's toast says only what the profile
  did, with no Undo (it undid the follow and left the texts on). Until codes are on, `profileLede` leaves out "on any phone
  or computer" (a number keeps the profile on that phone only). On a touch screen the profile sheet opens on its heading,
  so no keyboard covers "Not now"; a laptop starts in the box. The category receipt reads "You're following all of ...".
- `tests/profile_ask.py` (36 checks, an iPhone SE, a phone and a laptop) walks each path and the backup; the six older
  files that looked for "Get alerts on your" or the card's own button now look for the new heading and the bar's.

## Version A as a live A/B test, and the practice copy's "Next day" (R-187; 6 Oct 2026)

Nate 10/6: "I thought we were A/B testing the two different homepage versions. Today and another version with a calendar
app like card format. I'm not seeing it in the A/B testing options." Version A (R-070's Layout A, R-071) had stayed a
tester-only page (`track-a.html`, a 9/28 copy of the frame) under the 10/3 plan's "testers first". His answer: "Put version
A on the tester sheet and put it on the A/B testing now."
- **The test:** `layout` in `pub/variant.js` (`today` | `a`), backend 149 (on from 6 Oct, counting from then; decided by
  came back within 14 days, then acted within 14 days). It is `page: true`: the version is kept for the whole page load
  from the first time it is read with switches the page can trust (the ones kept from the last visit, or the database's
  answer), so a switch flipped meanwhile takes effect at the next load and Home never changes under a finger.
- **How it is drawn:** in `track.html` itself, not a page of its own, so version A has everything built since 9/28 (the
  error reports, the counts, the profile, the share routes, the lazy loading). `pub/app.js`: `layoutA()`; the `home` and
  `bill` stand-ins load `pub/a/home.js` and `pub/a/bill.js` on version A (each draws today's screen wherever it has
  nothing of its own); `TABS_A` ("You" in More's place); `tabOf` keeps My issues lit on an issue the person follows;
  `cssFor` adds `pub/a/a.css` (after `wide.css`, never fetched for today's) and `body.va` on every screen but the first
  visit, which both versions share and other tests compare. `pub/a/app.js` is gone; `track-a.html` sends its links to
  `track.html?demo=1&ab=layout.a` with the rest of the address; `compare.html`'s buttons open `track.html` with
  `ab=layout.today` or `layout.a` (Tests' "See it" opens it with one of them: then only that version's button shows).
- **Version A's Home** (`pub/a/home.js`) as designed, plus today's Home's other cards (`home.js` `extras` and `wireExtras`):
  the account cards and "Finish your testimony" at the top, a plan to go today or tomorrow above the Now card, and at the
  end a plan to go later, a new issue, keeping it on a phone, Meet HIPHI and a plan's next small thing (`.a-extras`); their
  styles in `home.css` read `:is(.hm, .ah)`. Your session (`#/recap`) stays today's page, as do the first visit and the
  rest of that visit, between sessions and following nothing.
- **Met** (`app.js` render): the first time the two differ on screen, a bill page or Home in session with something followed
  after the first visit (version A's `.ah`, or today's `.hm-follow:not(.hm-welcome)`). While a browser is on version A,
  Home's-top test (`home`) is never met or counted (`variant.js counted`); backend 149 also switched it off, its numbers
  kept, its card on Tests saying why.
- **"Next day" in the practice copy's band** (`app.js nextDay`, Monday to Tuesday to Wednesday, `pub/testbed.js` days;
  never during the first visit): right after the first visit Home keeps its welcome shape for the rest of that visit
  (`hiphi_welcome`), so neither version's everyday Home could be seen by a room of testers; `&later` (`track.html`'s early
  script) ends the welcome, and the day moves on with that day's real committee decisions. The tester sheet's tasks for
  Home's top and version A say to press it (`ROOM_TASK`); it is an inline link in the band's line of text (A-6), 26px tall.
- **The tester sheet** offers version A under "Change another screen" ("Home and the bill page: the week view",
  `ROOM_WHERE`); on it, Home's top reads "Replaced by the week view" (`ROOM_A_REPLACES`, `offWhy`), and picking it takes
  Home's top off with a word and Undo. On the staff screens the design is "the week view (version A)", never "Version A"
  alone: Tests letters every test's versions A and B, and this one is B (the fresh-eyes review). A paused test with numbers
  says it is paused instead of "Keep it running" (`abVerdict`).
- **The fresh-eyes review's other fix:** on version A's Home, "Finish your testimony" leaves out a letter whose hearing the
  Now card already offers ("Finish sending your testimony"), so one job has one button (`draftsCard(skip)`; A-14, A-3).
  **Since R-189 (10/6) today's Home does the same,** and on version A the skip is the Now card's own hearing only:
  `returnView` passes the hearings of its two full cards (either way Home's top is drawn) and of the suggestion once it is
  followed (before that it leads with Follow); version A passes the Now card's one hearing (it passed every hearing due this
  week, so a letter for the second one, a row under "Also due", was mentioned nowhere). A letter whose hearing has no full
  card, one line further down, folded, or not on Home, keeps its "Finish your testimony" card. `tests/draft_once.py`
  (46 checks: both cases on today's Home, by topic and version A, phone and laptop).
- Tests: `tests/layout.py` (100 checks: both versions on a phone and a laptop, the bill page and its tour, the saved letter once, Your session, Home's top not
  met, the old address and the compare page, Next day, the toss, the switch, the version kept for the page load, Tests and
  the tester sheet); `abtests.py` and `room.py` count ten tests; `tests/density.py` measures version A's Home and bill page
  as `publicA`.

## The first visit ends on "See How I Can Help", and Home folds nothing to do (R-190; 6 Oct 2026)

Nate 10/6: the last button, "Go to my home page", was "boring and doesn't encourage more advocacy"; and "on the homepage we
need to not hide more actions beneath a collapsed field". After research put to him in chat, he picked **"See How I Can
Help"** (`GO_HELP` in `pub/topics.js`, title case his own): today's finale (`start-rest.js` 'done'), the plans' ending
(`onb.js` 'wrap'), the ends-on-Home version's last step ('soon'), the shared-link newcomer's "voice" choice and the Mahalo
moment after a first action from a link (`bill.js`), with an arrow. Home keeps the promise (DESIGN **B-14**, new):
- **Right after the first visit** (`home.js` welcomeView): "N things you can do this week" under the hello, open, the
  soonest a full card with the one filled button, a second card, the rest one line each, then "Bills that need a hearing"
  as a sub-part (an h3, 18px). It replaced the "This week" card and the "Ready now?" fold at the bottom. After a first
  action from a shared link (no finale) the same list is calm, no filled button.
- **Later visits** (returnView): nothing behind "Show N more" or "Show N more topics"; `moreRows` draws its rows open.
  "Done this week" stays folded, as do the results' "See all" and folds inside a card or bill. A row past its written
  deadline says "Late testimony still accepted · hearing ..." (not a red "deadline passed"); the hearing asks' rows carry
  their topic's icon, and when they share one cut-off it is said once over them ("All 13 stop Mon, Mar 30 without a
  hearing."), not "14 days left" on each (the fresh-eyes review).
- **The ends-on-Home version** (rightNow): "More you can do this week" open, one line each.
- **Version A** (`pub/a/home.js`): every day of the week open (today with its written deadlines gone says so once under
  its heading), and the bills that need a hearing an open list.
- **Between sessions**, arriving from the finale: the "Get ready for January" / "Say aloha" card leads, above Your issues,
  and a phone leaves out the second Capitol drawing (`.hm-lead`).
Tests updated: `home_end.py`, `public_journey.py`, `d1_status.py` (the words), `x10_close_loop.py` (the open, calm list).
Backend HANDOFF 3.126.

## Pick which versions of each A/B test are live; the practice copy follows (R-192; 6 Oct 2026)

Nate 10/6: "allow me to pick which options are live. I should be able to pick that only option A is running, or only option
B, or option C, or all of the above, or a combination ... These changes should impact how the experience is for public
users in the sandbox." His answers to the plan: the practice copy follows the real switches; several on, a random pick per
practice visit.
- **Tests** (`staff/setup.js`, `liveOf`, `livePatch`, `liveLine`): every card has a switch per version (the first-visit test
  had them since R-164), in place of "Test it on new visitors". Above them one line says what runs: "Running: A against B.
  Each new visitor gets one of them at random." or "Not testing: everyone sees B, "...". Switch on another version to test
  it." Each flip saves at once with Undo; the last one on refuses to go off and says so ("The only one on, so everyone sees
  it."); switching on a version of a test with a note (the email ask, Home's top, the plans) asks first; the email ask's B
  and any plan show the lawyer line when on. "Pick the winner" leaves only the winner on. The page's line counts the tests
  running. In the practice copy a notice says its switches are samples and links the real page.
- **Stored as before** (no migration): two or more on is `is_on` with `arms_on` (null when all are on); one on is `is_on =
  false` with that version as `fallback` (and `arms_on` [it] for the six-way test), so `log_ab` counts only a real
  comparison and a page holding last visit's switches reads it the same way.
- **The practice copy** (`pub/variant.js`): reads `public_ab_tests` too (the early fetch in track.html is skipped there, so
  `abReady` asks), tosses like the live page, kept for the practice visit (`&restart` and Start over toss again), counts
  nothing; `app.js` boot waits for the switches in the practice copy before the first screen. Automated browsers keep
  today's version unless a test asks (`window.__hiphiTossTests`), so the other suites stay steady. `&abrest=today` on a link
  sets every test it does not name to today's (forced, as a tester's): the tester sheet's practice links, Tests' See it and
  compare.html carry it, so a group or a comparison sees exactly what it names, whatever the switches.
- **The fresh-eyes review's fixes (10/6, published with R-193):** the cards keep the order they had when the page opened
  (`s.abOrder`; Check again sorts afresh), so a card no longer jumps 2,000px down a phone after a flip, and focus stays on
  the switch (B-6); the first-visit test names its versions ("Running: today's, Plan 2 and Plan 4", `vName`), since its
  letters were one off from the plan numbers (P-4); what runs sits right under the question, before the numbers' verdict
  (A-13); one word for the state ("Not testing", never "paused"), no hint under the lone switch (its refusal says why), and
  no "(today's)" after a name that already says it (A-14); Pick's toast names the test.
- Tests: `tests/versions.py` (52 checks: the cards on a phone and a laptop, every flip, Undo, the last one, the note's
  question, the lawyer line, the six-way mixes, Pick the winner, See it and the tester sheet's links; the practice copy with
  B only, A only, both (a pick kept for the visit, both seen over fresh visits), C and E of the first visit, the week view
  only, `&abrest=today`, a link winning, an automated browser at today's, nothing sent); `room.py` expects the new links.

## What testers do: each tester's path (R-193; 6 Oct 2026)

Nate 10/6: "We also should start tracking testers actions beginning now." His answers: who counts, tester-sheet links only
(the practice copy or the live site, older printed links included; staff looking around are not); how much, each tester's
path (the screens in order, the seconds on each, what they did), testers told.
- **Recording** (`pub/testerlog.js`, on the first wave, kernel-only): a tester session starts on `&t=<sheet>-<group>` (every
  tester-sheet link since R-193) or on a link that sets versions without `&abrest` (the sheet's links before it); Tests'
  See it and compare.html carry `&abrest` and no `&t`, so they are not counted. It lasts the tab (`hiphi_tester`, `_demo` in
  the practice copy): Next day carries on the same path (and counts `nextday`), `&restart` (a new scan) starts a new one.
  Every second it notes the screen: the address (`home`, `bill/hb1780`, `issue/<slug>`), the first visit by its step
  (`start:topics`, from visitlog's view events), and a sheet over it (`:testimony:know`, the walkthrough's mode and step;
  other dialogs by id); paused while the tab is hidden. What they did, as totals: `followed` (what they follow going up),
  each `logAct` kind (testimony, email, share, attend ...), `finished` and `contact` once (variant.js `abEvent`), and
  `skipped_<step>` in the first visit. Sent every 10 seconds and as the tab closes (keepalive) to `log_tester_path`
  (backend 150). Nothing under the privacy signal or from an automated test run (`window.__hiphiCountTests` lets the suite).
  The practice copy's band says "the screens you visit are noted for this test" while it records; the privacy page says it.
- **Ended links (R-204, Nate 10/7: "It should show something about the testing has ended"):** a printed link keeps working
  wherever it went, so `track.html`'s first inline script lists the ended ones (`ENDED`, each the versions a link set,
  sorted). A practice-copy address with exactly those versions and no `&t` or `&abrest` loses its `ab=` and gains `&ended`
  before any module runs: the ordinary practice copy (the real switches, as for anyone), nothing recorded, the band led by
  "This test has ended" (Next day keeps it) and a toast once as it opens. Matched exactly, so the tester sheet's links and
  the check links (`?ab=onb.today` alone, `?ab=onb.p1` ...) still work. Ended so far: `?demo=1&restart&ab=onb.today,end.home`
  (the tester sheet's link of 6 Oct). No button on the tester sheet yet (offered in R-204).
- **The tester sheet** (`staff/setup.js`): each sheet and group has a short random id (`room().id`, `g.gid`, kept in prefs;
  a sheet kept before R-193 gets them at once), so a group's results stay its own when groups move; Start over keeps the
  sheet. "What testers did" under the groups: per group, testers, finished the first visit, followed, acted, gave a number
  or email, pressed Next day, and "See their paths" (each tester: device, time, minutes, what they did, what they skipped,
  then every screen in plain words with its seconds, `stepLabel`); "Earlier tester links" apart, by the versions they set.
  A group's row names its versions ("Group 2 · Plan 1"), and a group whose versions changed between two sessions gets a row
  per set, so nothing is mixed (the fresh-eyes review); "pressed Next day" shows only when someone did; newest first.
  The practice copy shows samples (`DEMO_TESTER_PATHS`) on its own groups. The printed sheet tells testers on their page.
- Tests: `tests/testers.py` (31 checks: a practice tester's path with its sheet, group, versions, steps by name and seconds,
  a bill, the walkthrough by step, follows, an action, finishing once, a number once, Next day on the same path; not
  recorded for the practice copy alone, See it, compare.html, the privacy signal or an automated browser; an older link
  recorded with no group; the sheet's links, results, paths and printed notice on a phone and a laptop).

## Three ways to help before the end of the first visit, as a test (R-150; 6 Oct 2026)

Nate 10/4: "We want people to act right away after signing up"; 10/5: "The last page asking for action should provide three
bills that they followed each with a different type of action. One is write testimony, one is send an email, another is send
to a friend"; 10/6: on "Coming up on your issues" (the page just before "You're all set!"), no reminder for now, "test it".
The test `act` (`pub/variant.js`, backend 151): `today` keeps "Coming up on your issues"; `three` draws **"Three ways to help
this week"** there (`waysFor`, `stepWays`, `wireWays` in `pub/start-rest.js`), three equal cards (Plan 1's `.ob-way`, moved
from `onb.css` to `start.css`), no main button among them, Next unchanged:
- In session: **Write testimony** on the soonest bill with testimony open (the walkthrough, `app.openHelper`), **Email the
  committee chair** on a second bill with a hearing in the next 7 days, its written deadline passed or not (`app.openMail`),
  **Send it to a friend** on a third (`shareFor`/`doShare`, the bill's share; a bill waiting for a hearing when there is no
  third with one). With no second hearing, the email is **Ask the chair for a hearing** on a bill waiting for one
  (`waitingBills`, `app.openMail` with the committee's code).
- Between sessions, or nothing on their issues this week: **Say aloha to your legislators** (the hello letter, mode
  `intro`; without an address, **Find your legislators** goes back to "Who speaks for you"), **Send it to a friend** (their
  first issue's page, `shareIssue`), **Why this matters to you** (one sentence in the card, kept as the profile's story for
  that issue, `saveProfile({ stories })`).
- A card done keeps its place with a tick ("Done. Mahalo!", "Kept for January"). Following nothing: today's page.
- Met on that page (`abSeen('act')`); measures: acted on the day of the first visit, came back within 7 days. Inside today's
  first visit only (`INSIDE_TODAY`): a plan never meets it. Staff v2 > Tests and the tester sheet list it (`SEE`,
  `ROOM_WHERE`). DESIGN-AUDIT records it as an exception to "a first visit never pushes an action".
Tests: `tests/ways.py` (new: every card on a phone and a laptop, in session and between sessions, with and without an
address, today's version, the test met, type sizes); `fv_type.py` walks it; `abtests.py` and `room.py` count eleven tests.

**Version A's bills that need a hearing, under the week (R-194, 10/6).** `asksBlock` in `pub/a/home.js`, its own section
after "This week on your issues" (they were the last thing in "Where your issues stand").

**"e-cigarette" kept whole without losing its spaces (R-195, 10/6).** `ui.js` `wrapWords` wraps the pieces in one plain span
inside a flex or grid box, where the spaces at their edges vanished ("Disposablee-cigaretteban" in version A's week).
Backend HANDOFF 3.129.
