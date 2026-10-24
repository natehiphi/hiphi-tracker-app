// Staff v6 (R-336, spec 3.3 and 6 "Help", V29, critic's gaps; F191, F192, F193, F212, F21): Help (#/help, #/help/<topic>,
// #/help/moved). A reference, not a tutorial: one search box, short guides each on its own page (a link can point straight
// at one), the Capitol's words, and What moved: each v5 place or button and where it is in v6. Every guide uses v6's place
// names (Today, Hearings, Testimony, Outreach, Bills, Legislators, My issues, Inbox, More tools, You, the lead tools), and
// tests/staff6_words.py checks that every place Help names is in the app's navigation. Facts that change are read from the
// data, never typed in: who approves (the admin and approver flags), the deadlines (the session calendar), the coalitions
// and the committees. Ask Nate in Slack (a DM to Nate, Nate 10/22) sits near the top of Help and at the foot of every guide,
// with Copy my question always beside it; #/help/ask is the same, for the palette.
// From 1100px Help is two columns: the search and the guides stay in view on the left and the guide reads on the right;
// narrower, Help is a list of guides and each opens as its own page with Back.
// Getting started (V29) lives here: newSteps() is the one list, and Today shows its first three still to do. The steps fit
// the season (between sessions: settings, your 2027 issues, your bills, practice a March day; in session: settings, the
// person's job by role, this week's hearings, a chair ask for owners, a bill) and each ticks from what the person has done
// (sent testimony, approved, asked a chair, saved a setting), not from what is on screen now, so Patti's step stays ticked
// after she resubmits (X25). Look-only steps tick from the frame's 'v6:route' event.
import { S, DB, DEMO, APP_URL, STAGES, SESSION_OVER, esc, isMine, DEADLINE_ROWS } from './data.js';
import { glossStage, legislativeDay, PUBLIC_APP, plain, sessionGates, deadlineCalendar, gateGloss, legNotesAll, billById } from './model.js';
import { icon, btn, switchRow, toast, keysOn, setKeys } from './ui.js';
import { WORDS, allWords, HOW_TO } from './terms.js';
import { admitsPartners } from './partnerq.js';
import { itemRow, whoseStep } from './steps.js';
import { prepTaskOf, issueHref } from './prep.js';
import { isRallier } from './asks.js';
export { HOW_TO };

const DESK = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } };
const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const names = pred => S.advocates.filter(a => pred(a) && a.is_active !== false).map(a => a.full_name);
const orList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
const first = id => String(S.advocates.find(a => a.id === id)?.full_name || '').split(' ')[0];
const FR_KEY = DEMO ? 'hiphi2_firstrun_demo' : 'hiphi2_firstrun';
// The ticks follow the person (advocates.prefs.firstrun), so a step done on the laptop is done on the phone (R-316 W7);
// what this browser kept before still counts.
const frLocal = () => { try { return JSON.parse(localStorage.getItem(FR_KEY) || '{}'); } catch { return {}; } };
const frGet = () => ({ ...frLocal(), ...(S.me?.prefs?.firstrun || {}) });
const frSet = p => {
  try { localStorage.setItem(FR_KEY, JSON.stringify({ ...frLocal(), ...p })); } catch { /* private mode */ }
  const was = S.me?.prefs?.firstrun || {};
  if (S.me && Object.keys(p).some(k => !was[k])) DB.patchPrefs({ firstrun: { ...was, ...p } }).catch(() => { /* this browser still has it */ });
};
// The practice copy as this person (R-316 W7): last March, nothing saved. Their initials pick who they are there.
export const practiceHref = () => `staff6.html?demo=1${S.me?.initials ? `&as=${encodeURIComponent(S.me.initials)}` : ''}#/`;
export const practiceLink = () => DEMO ? '' : `<a class="st-practice" href="${esc(practiceHref())}" target="_blank" rel="noopener">${icon('history')}<span>Practice on last March (nothing reaches the team)</span>${icon('external-link', { cls: 'ext' })}</a>`;

// R-316 W37 (M-13): Hawaiʻi's two-year Legislature, said in Getting ready for a new session and at the end of each moment.
const CARRY = ['Bills from 2027 carry over to 2028', 'A Legislature sits for two years. A 2027 bill that did not advance carries over to 2028 with the same number, in the committee where it stopped, so it can still be heard: ask that chair early. A 2028 bill ends with that Legislature; in 2029 numbers start again at HB 1, and a bill has to be introduced again. (2026 is the second year of the 2025-26 Legislature, so its bills end this year.)'];
const STAGE_EXTRA = { vetoed: 'Vetoed by the Governor. The Legislature can override with two-thirds of each chamber.', dead: 'Missed a deadline, was deferred, or failed a vote. It can come back next session.' };

// ---- the guides. Each is { id, title, also? (more words search finds it by), icon, sub(), items() -> [[term, html]] or html() } ----
const TOPICS = [
  { id: 'new', title: 'Getting started', also: 'new here start first day', icon: 'compass', sub: () => { const st = newSteps(), n = st.filter(s => s.done).length; return `${n} of ${st.length} done`; }, html: () => newHTML() },
  { id: 'moved', title: 'What moved', also: 'v5 moved where is old app changed new places', icon: 'route', sub: () => 'The changes everyone meets first, then each v5 place', html: route => movedHTML(route) },
  { id: 'words', title: 'Capitol words', icon: 'book-open', sub: () => `Lateral, decking, sine die and ${allWords().length - 3} more`, items: () => allWords().map(([t, d]) => [t, esc(d)]) },
  { id: 'coalitions', title: 'Coalitions', also: 'coalition short names groups', icon: 'users', sub: () => `What ${(S.campaigns || []).slice(0, 2).map(c => c.name).join(', ') || 'each short name'} and the rest stand for`, items: () => coalitionItems() },
  { id: 'stages', title: 'Stages and deadlines', icon: 'calendar-days', sub: () => { const ld = legislativeDay(); return ld ? ld.text : 'Where a bill can be, and the date it races'; },
    items: () => STAGES.map(([k, l]) => [l, esc(glossStage(k) || STAGE_EXTRA[k] || '')]).filter(([, d]) => d) },
  { id: 'committees', title: 'Committee codes', icon: 'landmark', sub: () => `${Object.keys(S.committees || {}).length} committees and their chairs`,
    items: () => Object.values(S.committees || {}).sort((a, b) => (a.chamber || '').localeCompare(b.chamber || '') || a.code.localeCompare(b.code))
      .map(c => [c.code, `${esc(c.name)}. ${c.chamber === 'S' ? 'Senate' : 'House'}.${c.chair ? ` Chair ${esc(c.chair)}` : ''}${c.vice_chair ? `, vice chair ${esc(c.vice_chair)}` : ''}${c.chair ? '.' : ''}`]) },
  { id: 'testimony', title: 'How testimony works', icon: 'file-text', sub: () => 'Writing, approving, a second look, filing',
    items: () => { const adm = orList(names(a => a.is_admin || a.can_approve)) || 'an admin', rev = orList(names(a => a.is_reviewer)) || 'a second approver';
      return [['1. Writing', 'A hearing notice arrives. Within minutes a draft Google Doc is made in Drive for the bill (only for bills with a position other than Monitor). It shows in Testimony under <b>To write</b> for the bill’s owner and whoever writes for its coalition. Write it, then press <b>Send for approval</b>, 12 hours before testimony is due.'],
        ['2. With an approver', `An admin or an approver (${esc(adm)}) opens it from <b>To approve</b> and presses <b>Approve</b>, or <b>Send back</b> with a note. An approver never approves testimony they sent; an admin may. Sent back, it waits under <b>Sent back</b> for its writer, who fixes it and presses <b>Resubmit</b>. If nobody has approved it 6 hours before the deadline, a second approver (${esc(rev)}) can stand in, and Slack tells them so.`],
        ['3. Second look', `The first testimony on a bill also needs a second approver (${esc(rev)}), someone other than whoever gave the first approval. Later testimony on the same bill skips this step.`],
        ['4. Ready to file', 'Whoever sent it for approval files it (the owner, if nobody did). <b>Ready to file</b> opens the filing card: the PDF, the Capitol page for the hearing and the form’s answers to copy. File it 2 hours before the deadline, then press <b>Mark filed</b> (<a href="#/help/file">How to file at the Capitol</a>).'],
        ['5. Filed', 'Filed testimony stays under <b>Filed</b>, the library of earlier testimony to borrow from.'],
        ['Late, or not filed', 'After the written deadline the Capitol still takes testimony until the hearing starts: the step says “Late, still accepted until” that time. Once the hearing starts, a draft not filed asks whether it went in late or not at all, and then it is kept as Missed.'],
        ['Undo', 'Approve, Send back, Mark filed, I’m going and removing a bill from a list can be undone for 10 seconds, from the message that follows. Later, <b>Undo filed</b> is on the testimony under Filed while its hearing is still ahead.'],
        ['A new version', 'If the bill changes (House draft 1 to House draft 2) after the draft was written, the writer’s Today says “The bill changed: check your testimony”.']]; } },
  { id: 'tabs', title: 'What each place is for', also: 'places sidebar map where', icon: 'list-todo', sub: () => 'Today, Hearings, Testimony, Outreach, Bills and the rest',
    items: () => [['Today', 'Your next step first, then what to do today, what is coming up, and one line for what waits on others. Each step is its own row; the one you pick opens beside the list on a laptop, with its button. A question a teammate asked you is a row too, until you answer it. On a phone on a hearing day, your hearing comes first, with its time and room.'],
      ['Hearings', '<b>This week</b>: every sitting with our bills, day by day, who is going (<b>I’m going</b> is on each card) and where each bill’s testimony stands. <b>Get hearings</b>: the bills still waiting for a hearing, grouped by chair, soonest notice first, with Email the chair.'],
      ['Testimony', 'Every draft by where it stands: <b>To write</b>, <b>To approve</b>, <b>Sent back</b>, <b>Ready to file</b> and <b>Filed</b>. Approvers open Review from To approve, one draft at a time.'],
      ['Outreach', 'Rallying the public and partners: <b>This week’s asks</b> (each bill’s ask, its deadline and the words to copy), <b>Partner update</b>, <b>Emails</b> to supporters, <b>Supporters</b> and <b>Lists</b>.'],
      ['Bills', 'Every tracked bill, grouped by where it stands, or as a table; filter it, or select several to change at once. <b>Sort new bills</b> (in the opening weeks) and <b>Muted</b> are its other tabs. A bill’s page has three tabs: <b>Next step</b> (What’s next for you), <b>Team talk</b> (messages, notes and talks with legislators) and <b>Public</b>.'],
      ['Legislators', '<b>Who to ask</b> (the chairs who hold our bills), <b>Everyone</b> (find anyone by name, town, district or committee) and <b>Holding our bills</b>. A legislator’s page starts with Email, Call and Log a talk.'],
      ['My issues', 'The issues you own or help on, by deadline; between sessions, your issues for 2027. <b>Coalitions</b> lists each coalition, with its I help on switch; <b>All issues</b> is every issue, by category.'],
      ['Inbox', '<b>Messages</b>: what teammates wrote to you or about your bills, and the tracker’s notes to you. <b>Updates</b>: what changed on your bills since yesterday, since your last visit or in the last 7 days. The number beside Inbox counts the unread messages.'],
      ['More tools', 'Every tool used now and then, grouped by job: Holding our bills, the session calendar, earlier testimony, lists, a link or QR code, first visit numbers, sorting and muting bills, saved views, bulk change, export, and the guides for learning.'],
      ['You', 'At the foot of the sidebar (on a phone, the last rows of <b>More</b>): <b>My settings</b> and Sign out.'],
      ['Lead tools', 'For admins and second approvers, in the sidebar: <b>Team</b> (what is slipping, today’s and tomorrow’s hearings, who is on what), <b>People</b> (admins), <b>Partners</b> (admins and partner approvers) and <b>Session setup</b> (admins). Anyone can read a teammate’s list from More tools.'],
      ['Search', 'The box at the top (on a phone, the search button) finds bills by number or words, legislators, teammates, supporters, conversations, places and things to do. Cmd or Ctrl and K puts the cursor in it from any page.'],
      ['On a phone', 'The bar at the bottom: Today, Hearings, Testimony, Bills and <b>More</b>, which lists every other place with a line on what it is for. Search and the Inbox are at the top.']] },
  // R-316 W29 (L-3): the everyday tasks staff asked Help about, one line each, pointing at the button.
  { id: 'howto', title: 'How do I…', also: 'how to tasks everyday', icon: 'circle-help', sub: () => 'Everyday tasks, one line each',
    items: () => [['Step by step', 'For the bigger jobs: <a href="#/help/hearing">Getting a bill a hearing</a> · <a href="#/help/talk">Logging a talk with a legislator</a> · <a href="#/help/file">How to file at the Capitol</a> · <a href="#/help/changes">When the Capitol changes the plan</a> · <a href="#/help/versions">House and Senate versions</a> · <a href="#/help/moments">What to do at each moment</a> · <a href="#/help/calendar">Session calendar</a>.'],
      ['Approve or send back testimony', 'Testimony, then <b>To approve</b>: open it, read it in its Doc, then press <b>Approve</b>, or <b>Send back</b> with a note. Review shows one draft at a time and goes on to the next.'],
      ['File testimony', 'Testimony, then <a href="#/testimony?view=file">Ready to file</a>: the filing card has the PDF, the Capitol page for the hearing and the form’s answers to copy, then <b>Mark filed</b>. Steps: <a href="#/help/file">How to file at the Capitol</a>.'],
      ['Revise testimony that was sent back', 'Testimony, then <b>Sent back</b>: the note, the Doc, and <b>Resubmit</b> once it is fixed.'],
      ['Log a call or meeting with a legislator', 'Open the legislator’s page (Legislators, or a name on a bill’s Committees) and press <b>Log a talk</b>. A bill’s Team talk can log one too. Steps: <a href="#/help/talk">Logging a talk with a legislator</a>.'],
      ['Say I’m going to a hearing', 'Press <b>I’m going</b> on the hearing’s card: on Hearings, the hearing’s page or the bill’s page. It can be undone for 10 seconds.'],
      ['Ask the chair for a hearing', 'Hearings, then <b>Get hearings</b>: each chair with the bills waiting for them, and <b>Email the chair</b>. The email is written for you and opens in your own mail; send it, then answer <b>Did you send it?</b> so the team sees who asked. Steps: <a href="#/help/hearing">Getting a bill a hearing</a>.'],
      ['Hand a bill or a to-do to someone', 'Give to… beside a bill’s owner (on its page) or on a to-do hands it to a teammate, who gets a Slack message. A chair ask: Give this ask to… on Get hearings. Someone leaving or away: an admin hands over all they hold, from People.'],
      ['Send this week’s ask', 'Outreach, <b>This week’s asks</b>: each bill’s ask and its deadline, with Copy link, Copy message, Copy post and Email followers.'],
      ['See what I owe today', 'Today: your next step first, then what to do today. The number beside Today in the sidebar counts it.'],
      ['Cover for a teammate', 'More tools, then See a teammate’s list: their Today, to read. Leads also have Team.'],
      ['Find anything', 'Type in the search box at the top, or press Cmd or Ctrl and K. It finds bills, people, places and things to do.']] },
  // R-316 W37: short guides in the app's own words, each linked from the screen where its job happens.
  { id: 'hearing', gate: HOW_TO, title: 'Getting a bill a hearing', also: 'ask the chair hearing request schedule notice push', icon: 'megaphone', sub: () => 'When to ask, whom, how, and how to record it',
    items: () => [['1. When', 'As soon as the bill is referred, and before its notice-by date. A committee must post a hearing 48 hours ahead (72 for a bill’s first Senate committee), so the chair has to say yes before then. <b>Get hearings</b> lists each bill still waiting with the day its notice must post by, soonest first; the bill’s page says it too.'],
      ['2. Whom', 'The chair of the committee the bill is in now: Get hearings groups the bills by that chair. A joint referral (two committees named together) has two chairs; ask both. The bill’s introducers can ask too: its Committees mark the members who introduced it or its companion. The money committees (Finance in the House, Ways and Means in the Senate) hear bills late, so ask their chairs early.'],
      ['3. How', 'On Hearings, then <b>Get hearings</b>, press <b>Email the chair</b>: one email asks about all of that chair’s bills. It is written for you and opens in your own mail: read it, then send it. To hand the ask to a teammate, press <b>Give this ask to…</b>; it becomes a row on their Today.'],
      ['4. Record it', 'Back in the tracker, answer <b>Did you send it?</b> The bill then says “Asked by Kevin Mon 3/16 · no reply yet” for the whole team, so nobody asks twice. Asked by phone or in person? Press <b>Log a talk</b> under that chair on Get hearings, or log the talk on the chair’s page with “This was an ask for a hearing” ticked (<a href="#/help/talk">Logging a talk with a legislator</a>).'],
      ['5. The reply', 'When the chair answers, press <b>They replied</b> on Get hearings or on the bill: Will schedule, Said no (which offers next steps) or Left a message. With no reply after 3 working days, your Today offers a follow-up. When the hearing posts, the bill says Scheduled: a good moment to say mahalo.'],
      ['Too late?', 'Once the notice time for the last regular slot has passed, the bill says so. Call the chair’s office: only the chair can still help.'],
      ['Bills HIPHI opposes', 'They get no hearing ask anywhere in the tracker: HIPHI never asks a chair to hear a bill it opposes.']] },
  { id: 'talk', gate: HOW_TO, title: 'Logging a talk with a legislator', also: 'log call meeting conversation visit talked', icon: 'message-square-plus', sub: () => 'A call, a meeting or a visit, kept where the team finds it',
    items: () => [['1. Open their page', 'Legislators, then <b>Everyone</b> (type a name, a town or a district), or a name on a bill’s Committees.'],
      ['2. Log a talk', 'Press <b>Log a talk</b> at the top of their page. A bill’s Team talk box logs one too, already filed under that bill.'],
      ['3. Fill it in', '<b>Filed under</b>: the issue, and the bill if it was about one. <b>When</b>: the day. <b>What was said</b>: what they said, what they asked for, what we promised. Met several legislators at once? Add each one: it is one record on each of their pages.'],
      ['4. Where they stand', 'If they said how they will vote, set their stance beside their name on the bill’s Committees, or with Mark where they stand beside the bill on their page.'],
      ['Who sees it', 'The whole team: on the legislator’s page, on the issue’s page and on every bill of that issue. You can correct or delete your own entry for ten minutes.']] },
  { id: 'calendar', gate: HOW_TO, title: 'Session calendar', also: 'deadlines dates calendar days left lateral decking crossover legislative day', icon: 'calendar-clock', sub: () => { const g = sessionGates(S.bills).find(x => x.next); return g ? `Next: ${g.name}, ${mdDay(g.date)}` : 'Every deadline of the session'; },
    items: () => calendarItems() },
  { id: 'moments', gate: HOW_TO, title: 'What to do at each moment', also: 'session moments step by step when governor veto conference opening', icon: 'route', sub: () => 'From opening day to the Governor, one line each', items: () => momentItems() },
  { id: 'changes', gate: HOW_TO, title: 'When the Capitol changes the plan', also: 'moved cancelled rescheduled amended rewritten gut replace new version', icon: 'refresh-cw', sub: () => 'Moved, cancelled, already filed, amended, rewritten',
    items: () => [['The hearing moved', 'The draft follows the bill to the committee’s new sitting, and the hearing’s card says it moved. If you said I’m going, Today asks whether you are still going. Check the new testimony deadline on the card.'],
      ['Cancelled, no new date', 'The hearing’s card says “cancelled, no new date yet” and its time to act stops. Keep the draft: when the committee posts a new sitting, the draft moves to it.'],
      ['Already filed', 'Filed testimony belongs to the hearing it was filed for. If that hearing moved, read the new notice: unless it says earlier testimony still counts, file it again for the new date.'],
      ['The bill was amended', 'A new version (House draft 1 to House draft 2) means new words. The writer’s Today says “The bill changed: check your testimony” before it is filed.'],
      ['The bill was rewritten', 'A committee can replace a bill’s whole text with something new (gut and replace): the number stays, the subject changes. Read the new version. If HIPHI’s position no longer fits, talk to the owner, who changes it on the bill’s page.']] },
  { id: 'versions', gate: HOW_TO, title: 'House and Senate versions', also: 'companion version hd1 sd1 cd1 twin house senate draft', icon: 'scale', sub: () => 'Companions, House and Senate drafts, and which one to push',
    items: () => [['Companions', 'Many bills have a companion: the same bill introduced in the other chamber, an HB and an SB. Each moves on its own, so if one stalls the other may still move. The bill’s About this bill names its companion.'],
      ['Drafts: HD1, SD1, CD1', 'Each time a committee changes a bill, its version goes up: House draft 1 (HD1), House draft 2 in the House, Senate draft 1 (SD1) in the Senate, conference draft 1 (CD1) in conference. The bill’s About this bill shows its version.'],
      ['Testimony', 'Write for the version the hearing is on; the notice says which. The writer’s Today says when a draft was written for an older version.'],
      ['Which one to push', 'Ask for hearings on both while both can move. After crossover, only a bill that passed its first chamber can still pass.']] },
  { id: 'own', title: 'Owning and following', also: 'owner follow mute position priority give', icon: 'user-check', sub: () => 'Who is asked to do what',
    items: () => [['Owner', 'Responsible for the bill. Drafts are made for its owner, and the steps on Today are the owner’s, the writer’s or an approver’s. One owner per bill.'],
      ['Following', 'Puts a bill on your bills and its messages in your Inbox. It never gives you a step. Anyone can follow anything: the Follow button on the bill’s page.'],
      ['Muting', 'Takes a bill off your lists until its next hearing is posted; for a bill waiting for a hearing it reads Not pushing this bill. Bills, then <b>Muted</b>, brings it back.'],
      ['Changing owners and positions', 'Anyone can change a bill’s owner or position: on its page (Give to… beside the owner), in a cell of the Bills table, or for many at once (Select on Bills, then Change…). Every change can be undone from the message that follows it. The priority follows the position: Strong support makes a bill the team’s top tier.'],
      ['Coalitions I help on', 'For helping with a coalition’s bills without owning them. Switch on I help on, on the coalition’s page (My issues, then <b>Coalitions</b>). Its bills then show under My coalitions on Bills, its testimony to write under Testimony, and its chair asks on Hearings. What each coalition’s short name means: <a href="#/help/coalitions">Coalitions</a>.']] },
  { id: 'auto', title: 'What happens on its own', also: 'sync automatic email drafts video', icon: 'rotate-ccw', sub: () => 'Syncing, drafts, video and email',
    items: () => { const burst = (S.syncCfg || {}).burst_until, hourly = burst && burst >= new Date().toISOString().slice(0, 10);
      return [['Bills', `Synced from the Legislature ${hourly ? `4 more times a day until ${esc(mdDay(burst))} (8 in all), then 4 times a day` : '4 times a day'}. Stage, committee, last action and versions are never typed by hand.`],
        ['Hearings', 'Read from the Capitol’s hearings page every 15 minutes and from its notice emails the moment they arrive. The draft, the calendar event and the Slack alert follow within minutes.'],
        ['Drafts', 'Made within a few minutes of the notice, for bills with a position other than Monitor, in Drive under Testimony, the year, the coalition and the bill.'],
        ['Video', 'Each hearing links to the chamber’s YouTube channel, then to the exact video once it is posted. Staff can fix the link on the hearing’s page.'],
        ['Deadlines', 'A bill still in committee when its deadline passes moves to Did not advance, with the deadline it missed.'],
        ['Email', 'Supporter emails, hearing emails to supporters, and alerts for staff who chose email are sent by the tracker. Slack DMs go to everyone else.']]; } },
  // Session setup and the January season card point here (#/help/session).
  { id: 'session', title: 'Getting ready for a new session', icon: 'calendar-check', sub: () => 'What changes on opening day, and what admins check',
    items: () => [['When the calendar is in', 'Claude loads the new session’s calendar each December. From then every deadline and count follows the new session, and Today is your list again instead of how the last session ended.'],
      ['New bills', 'They arrive as they are introduced. <b>Sort new bills</b> (a tab of Bills in the opening weeks) asks for one decision on each: track it, with its coalition, owner, position and issue, or pass.'],
      ['Session setup (admins)', '<a href="#/setup">The season checklist</a> lists what the tracker still needs, each with a way to fix it: opening day, sine die and recess days; 4 more syncs a day for the opening weeks; the session’s bills; and an owner, a Slack channel and keywords for every coalition.'], ...(HOW_TO() ? [CARRY] : [])] },
  // R-316 W16: the 2027 prep (due 6 Nov, prep.js); the issue's prep steps link here.
  { id: 'prep', title: 'Getting your issues ready for 2027', also: 'prep prepare 2027 goal talking points mark ready', icon: 'clipboard-list', sub: () => 'The six steps, with an example',
    items: () => [['Where', 'Between sessions <b>My issues</b> is your list of issues to get ready, with how far each one is. Next opens the first unfinished one; its steps are at the top of the issue’s page, each with Do it, and Change once it is done.'],
      ['1. Name and description', 'Check that the name is a policy people recognize, in everyday words, and that the one sentence says what would change. The public sees both. Looks right, if nothing needs changing.'],
      ['2. Between sessions', 'What the public reads under the issue until January. Claude drafted the first ones from the bills’ records; add HIPHI’s plans if you like.'],
      ['3. HIPHI’s goal for 2027', 'One or two sentences on what we want to win this session. Staff only. For example (the shape, not a real HIPHI goal): <i>“Get a bill that funds sidewalks and crosswalks near schools heard in both money committees, and passed out of the House.”</i>'],
      ['4. Talking points', 'Three to five plain sentences people tap into a letter sent in their own name, so each must be true and stand on its own: no numbers you cannot point to. For example (the shape, not real points): <i>“Keiki should be able to walk to school safely.”</i> · <i>“Sidewalks and crosswalks near schools make walking and biking safer.”</i> · <i>“This bill pays for them where schools need them most.”</i>'],
      ['5. Top issue for 2027?', 'Yes puts it forward. Once an admin confirms it, people visiting the tracker for the first time find it already ticked when they pick its category. Nothing on the public page says it was picked.'],
      ['6. Keep, merge or retire', 'Keep it as it is; Merge its bills and followers into another issue; or Retire it, so the public stops seeing it and its followers stop getting its bills. Nothing changes until an admin approves.'],
      ['Mark ready', 'With all six done, Mark ready sends it to an admin (Mark ready and open the next takes you straight to your next one). The admin approves it or sends it back with a note, which you see on Today and on the issue; fix that step and mark it ready again. Helpers can fill in any step; only the owner marks it ready.']] },
  { id: 'public', title: 'The public page and lists', also: 'public tracker lists share links embed', icon: 'globe', sub: () => 'What visitors see, and how to share it',
    items: () => [['What shows', 'Only bills set to show on the public page, with the plain summary and the ask from the bill’s Public tab. Visitors follow issues (or a bill, or a list) and get a five-minute way to testify.'],
      ['Lists', 'A list is a set of public bills (Outreach, then <b>Lists</b>). Following a list follows every bill on it, including ones added later.'],
      ['Supporters', 'People who say yes at sign-up to hearing emails, and to HIPHI seeing what they follow, appear under Outreach, then <b>Supporters</b>. Everyone else’s follows are counts only, and only from 10 people.'],
      ['Links', `A staff link to a bill looks like ${esc(APP_URL)}#bill=HB1563 and opens in either app. A public link to a list looks like ${esc(PUBLIC_APP())}#list=keiki-health.`],
      ['On hiphi.org', 'Session setup (admins), its Public page tab: <b>Website embed</b> has the code to put the tracker on any web page.']] },
  { id: 'where', title: 'Drive, Slack and the calendar', also: 'drive slack calendar youtube questions ask nate', icon: 'map-pin', sub: () => 'Where drafts, alerts, hearings and video are kept, outside the app',
    items: () => [['Drafts', 'Google Drive, in Testimony, then the year, the coalition and the bill.'], ['Alerts', `Slack ${esc((S.slackCfg || {}).main_channel || '#hearing-alerts')} and each coalition’s channel. Your own steps come as DMs or email (<a href="#/me">My settings</a>).`],
      ['Calendar', 'The HIPHI Hearings Google Calendar.'], ['Video', 'The Senate and House YouTube channels.'],
      ['Questions', 'Search Help first, or open <a href="#/help/howto">How do I…</a> (everyday tasks, one line each). Still stuck? <a href="#/help/ask">Ask Nate in Slack</a>: it is at the top of Help and at the foot of every guide, and Copy my question copies what you typed in the search.']] },
  // Ask Nate in Slack (Nate 10/22: "just a dm to me"): the palette's "Ask Nate in Slack" opens this page, and every Help page
  // ends with the same line. Not listed among the guides.
  { id: 'ask', title: 'Ask Nate in Slack', also: 'ask nate question stuck slack dm', icon: 'message-circle', hidden: true, sub: () => 'A direct message to Nate, for anything Help does not answer',
    html: () => `<p class="hp-p">Most answers are in a guide: search Help first (the box ${DESK() ? 'on the left' : 'above'}), or open <a href="#/help/howto">How do I…</a> (everyday tasks, one line each).</p>${askSlack('', { big: true })}` },
  // R-277 fix 9: the steps nobody could find. The Capitol's own words, for HIPHI filing as an organization; the filing card
  // (Testimony, Ready to file) puts each one in order with its answers to copy (V25).
  { id: 'file', title: 'How to file at the Capitol', also: 'file filing submit testimony capitol website form', icon: 'landmark', sub: () => 'The filing card, the Capitol form, then Mark filed',
    cta: ['Open Ready to file', '#/testimony?view=file'],
    items: () => [['1. Open the filing card', 'Testimony, then <a href="#/testimony?view=file">Ready to file</a> (or the row on your Today): the filing card there holds everything below, in order.'],
      ['2. Save it as a PDF', 'The card opens the approved Google Doc: File, Download, PDF.'],
      ['3. Open the hearing at the Capitol', 'The card’s File at the Capitol opens the hearing on the Capitol website. Log in (an account is free; they email a link to confirm; it logs you out after 60 minutes), choose Submit Testimony and pick the hearing.'],
      ['4. Fill in the form', 'The card shows each answer with a Copy button: your position (Support, Oppose or Comments), Organization, and the name it is signed with: HIPHI, or the coalition when the letter speaks for it (74 of 233 filings in 2026 went in a coalition’s name). In person if someone is going, otherwise Remote or Written testimony only. Upload the PDF and submit.'],
      ['5. Look for the green box', 'It means it worked, and a confirmation email follows. Back in the tracker, press <b>Mark filed</b> and paste the confirmation link if you have it. Pressed it by mistake? Undo, in the message that follows, or Undo filed on it under Filed.'],
      ['Late', 'Past the written deadline the Capitol still takes testimony until the hearing starts, marked late. The step says “Late, still accepted until” that time.'],
      ['Stuck?', 'The Public Access Room helps for free: (808) 587-0478.']] },
  // What reaches staff today, said truthfully (R-277 fix 9, E-2; V26): My settings says the same, person by person.
  { id: 'pings', title: 'Which alerts you get', also: 'pings notifications reminders nudges mute quiet slack email', icon: 'bell', sub: () => 'Slack, email and the calendar, and how to quiet them',
    items: () => { const ch = esc((S.slackCfg || {}).main_channel || '#hearing-alerts'), d = (S.slackCfg || {}).daily || {};
      return [['In the app', 'Today lists every step that is yours, whatever you choose in My settings. The Inbox keeps what was sent to you: messages and the tracker’s notes.'],
        ['Slack DMs', 'Testimony steps for you (a new draft on your bill, testimony waiting for your approval, yours approved, sent back or filed) and messages on bills you own, follow or joined. If you own bills, also deadline alerts: the morning testimony is due, shortly before, and after the deadline if it is not filed. If you own no bills, those deadline alerts go to each bill’s owner, not to you.'],
        ['Email instead', 'In <a href="#/me">My settings</a> you can pick Email: testimony steps come by email, and deadline alerts stop, since they come only by Slack.'],
        ['Channels', `New hearings post to ${ch} and to each coalition’s channel${d.enabled !== false ? `, and a daily list of hearings posts there at ${esc(String(d.time || '07:00').replace(/^0/, ''))}` : ''}. Channel posts are not DMs; Slack’s own settings mute a channel.`],
        ['Calendar', 'Each hearing becomes an event on the HIPHI Hearings Google Calendar.'],
        ['Quieter', 'In My settings, Fine-tune what you are told, and when switches each kind off; or pick Only in the app for no alerts except approval stand-ins and steps passed to you. There is no daily summary or quiet hours yet.']]; } },
  // v5's keys, kept (critic: experienced users relearn a rebuilt app), plus v6's: g h, g w and Cmd/Ctrl-K (V32).
  { id: 'keys', title: 'Keyboard shortcuts', also: 'keys keyboard shortcuts hotkeys', icon: 'keyboard', hover: true, sub: () => 'For a keyboard and mouse',
    items: () => [['Cmd or Ctrl and K', 'Search from any page: places, things to do, bills and people, each with its shortcut'], ['/', 'Search (on Bills, its own filter box first)'],
      ['g then t, h or w', 'Go to Today, Hearings or Testimony'], ['g then o, b, l or m', 'Go to Outreach, Bills, Legislators or My issues'], ['g then r or i', 'Go to Review (testimony to approve) or the Inbox'],
      ['j and k', 'Today, Bills, Legislators and the Inbox: next and previous row (the arrow keys too, once in the list)'], ['Enter', 'Today: do the open row’s step. Bills and the Inbox: open the row'],
      ['o', 'Today: open the item beside the list. Bills: open the bill'], ['x', 'Bills: tick the row'], ['Space', 'Bills: open the marked row beside the list'],
      ['Shift+A', 'Review: approve (it takes Shift so a stray letter never approves)'], ['r, o', 'Review: send back, open the Doc'], ['Right arrow', 'Review: skip to the next draft'],
      ['e', 'Inbox: mark the row read or unread'], ['Shift+M', 'Inbox: mark the messages read'],
      ['1 to 3', 'A bill: Next step, Team talk, Public'], ['[ and ]', 'A bill: previous and next bill'],
      ['t, n, l, u', 'Sort new bills: track, not for us, later, undo (u again undoes the one before)'], ['Arrow keys', 'In a menu, a picker or search’s results: move; Enter chooses'],
      ['?', 'Open this list'], ['Esc', 'Close a sheet or the open item, or go back'], ['While typing', 'Shortcuts are off while you type in a field.'], ['Switch them off', 'The switch at the top of this list turns every shortcut off on this device.']] },
];

// ---- Coalitions (V29, X25: "Help can't say what HEAL is"): each short name, what it stands for, who owns it ----
function coalitionItems() {
  const cs = (S.campaigns || []).slice().sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name));
  return [['What a coalition is', 'A group of organizations HIPHI works with on one cause. Each tracked bill belongs to one or more coalitions; each coalition has an owner on the team, a Slack channel and its own page (My issues, then <b>Coalitions</b>), where you can switch on I help on.'],
    // The full name, unless the description already starts with it ("Community health workers: ...").
    ...cs.map(c => [c.name, [c.public_name && c.public_name !== c.name && !plain(c.description || '').startsWith(plain(c.public_name)) ? esc(c.public_name) + '.' : '', c.description ? esc(String(c.description).replace(/\s+/g, ' ')) : '', c.owner_id && first(c.owner_id) ? `Owner: ${esc(first(c.owner_id))}.` : '',
      c.slack_channel ? `Slack: ${esc(String(c.slack_channel).replace(/^#?/, '#'))}.` : '', `<a href="#/coalition/${encodeURIComponent(c.id)}">Its page</a>`].filter(Boolean).join(' ')])];
}

// ---- the session calendar, every deadline, read from the loaded calendar (model.js sessionGates; R-316 W37, H-14) ----
const mdDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');
const inDays = n => n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
const nBills = n => `${n} ${n === 1 ? 'bill' : 'bills'}`;
function calendarItems() {
  const mine = S.me ? S.bills.filter(isMine) : [], kOf = g => `${g.label}|${g.date}`;
  const my = new Map(sessionGates(mine).map(g => [kOf(g), g])), team = sessionGates(S.bills);
  if (!team.length) return [['No calendar yet', 'The session’s deadlines are loaded each December.']];
  const ld = legislativeDay();
  const head = ['How to read it', `Each deadline with its day, what a bill must do by then, and how many bills race it: yours (bills you own or follow) and the team’s. A bill races the next deadline it has to meet. ${ld?.text ? `Today is ${esc(ld.text)}.` : ''} The bills that still need a hearing for the next deadline are on Hearings, under <b>Get hearings</b> (<a href="#/help/hearing">Getting a bill a hearing</a>).`];
  return [head, ...team.map(g => {
    const m = my.get(kOf(g)), w = gateGloss(g.label), gld = legislativeDay(new Date(g.date + 'T12:00:00-10:00').getTime());
    const what = w ? `${w[0].toUpperCase()}${w.slice(1)}.` : '';
    const when = g.past ? 'Over.' : `<b>${g.next ? `Next: ${inDays(g.days).toLowerCase()}` : inDays(g.days)}</b>${gld && gld.today ? ` · legislative day ${gld.day} of ${gld.of}` : ''}.`;   // "Over", not "Passed", which reads as a bill passing
    const race = g.past ? (g.stopped ? ` ${g.stopped} of the team’s ${g.stopped === 1 ? 'bill' : 'bills'} did not advance at it.` : '')
      : ` ${m && m.racing.length ? `${nBills(m.racing.length)} of yours race it${m.noHearing.length ? `, ${m.noHearing.length} with no hearing yet` : ''}` : 'None of your bills race it'}; ${g.racing.length} on the team${g.noHearing.length ? ` (${g.noHearing.length} with no hearing yet)` : ''}.`;
    // The House and the Senate can each have their own day for one deadline (Triple filing 2/11 and 2/12): say whose.
    const ch = team.filter(x => x.name === g.name).length > 1 ? (DEADLINE_ROWS || []).find(r => r.label === g.label && String(r.deadline_date).slice(0, 10) === g.date)?.chamber : '';
    return [`${g.name}${ch ? ` (${ch === 'S' ? 'Senate' : 'House'})` : ''} · ${mdDay(g.date)}`, `${what} ${when}${race}${g.bills ? ` Only for ${esc(g.bills.join(' and '))}.` : ''}`.trim()];
  })];
}
// ---- what to do at each moment, one line per moment and per role, with this session's dates (R-316 W37, M-15) ----
function momentItems() {
  const cal = deadlineCalendar(), at = (phase, rx) => { const g = cal.find(x => x.phase === phase && (!rx || rx.test(x.label))); return g ? mdDay(g.date) : ''; };
  const by = (w, d) => d ? `${w} ${d}` : w;
  return [
    ['Before opening day', 'Owners: get your issues ready (<a href="#/help/prep">Getting your issues ready</a>). Admins: the season checklist in Session setup. Everyone: choose how the tracker reaches you (<a href="#/me">My settings</a>).'],
    [by('Opening weeks, to Intro cutoff', at('introduced')), 'New bills arrive every day. <b>Sort new bills</b> asks for one decision on each: track it, with its coalition, owner, position and issue, or pass. Owners: check each of your issues has a bill.'],
    [by('To the first lateral', at('first_lateral')), 'The big push for hearings. Owners: ask each chair before the notice time, from Hearings, then <b>Get hearings</b> (<a href="#/help/hearing">Getting a bill a hearing</a>). Writers: a draft appears within minutes of each notice; Send for approval 12 hours before testimony is due, and file it 2 hours before.'],
    [by('To first decking', at('first_decking')), 'Bills must clear their last committee, often the money committee (Finance in the House, Ways and Means in the Senate). Owners: ask the money committee’s chair early.'],
    [by('Crossover', at('first_crossover')), 'Floor votes in the first chamber; there is no testimony on a floor vote. A bill that passes moves to the other chamber, with new committees and new chairs: owners, read its What’s next for you and ask the new chair early.'],
    [by('To second lateral and decking', [at('second_lateral'), at('second_decking')].filter(Boolean).join(' and ')), 'The same push in the second chamber, with less time. Writers: a bill that changed (House draft 1 to Senate draft 1) needs its testimony checked against the new version (<a href="#/help/versions">House and Senate versions</a>).'],
    [by('Cross back', at('second_crossover')), 'The first chamber agrees to the other chamber’s changes, or disagrees, which sends the bill to conference.'],
    [by('Conference, to Final decking', [at('conference', /final/i), at('conference', /fiscal/i) && `Fiscal ${at('conference', /fiscal/i)}`].filter(Boolean).join(' and ')), 'House and Senate negotiators settle one version (conference draft 1). There is no hearing to testify at: the conference chairs decide. Owners: know who they are for each of your bills.'],
    [by('Sine die', at('governor', /sine/i)), 'The session’s last day. A bill not settled by then did not advance this year.'],
    ['After sine die: the Governor', 'The Governor has 45 days after sine die to sign or veto, and must name by the 35th day the bills that may be vetoed (the intent-to-veto list). A bill neither signed nor vetoed becomes law. Owners: thank the members who helped.'],
    ['Between sessions', 'Today shows how the session ended. Get your issues ready for next year on My issues, and read <a href="#/help/session">Getting ready for a new session</a>.'],
    CARRY,
  ];
}

// ---- What moved (critic: change aversion; spec 3, 11): each v5 place or button, and where it is in v6 ----
// One line each, grouped by where it was in v5, with a link to where it is now. The words name the v5 thing plainly and
// the v6 place by its label in the sidebar, the page tabs or More tools.
const go = (label, href) => `<a href="${esc(href)}">${esc(label)}</a>`;
// A row's third element, when there is one, says who has that place (admins, leads, approvers, partner approvers): a row
// about a place the viewer's role does not have is left out (spec 0: less on every screen).
const MOVED_ALL = () => [
  ['Today', [
    ['Today’s This week switch', `${go('Hearings', '#/hearings')}, under This week: every sitting, day by day, with I’m going on each card.`],
    ['The deadline box (bills that still need a hearing)', `${go('Get hearings', '#/hearings/ask')}, on Hearings: one board, grouped by chair, soonest notice first.`],
    ['Mark asked', `${go('Get hearings', '#/hearings/ask')}: after you press <b>Email the chair</b>, it asks <b>Did you send it?</b> Asked by phone or in person? Press <b>Log a talk</b> beside that chair, on the same board.`],
    ['The asked chip, to record what the chair said', `${go('Get hearings', '#/hearings/ask')}: <b>They replied</b>, on the ask that waits for a reply. Legislators’ Who to ask shows the same board.`],
    ['Give to… and I’ll ask, on a chair ask', `${go('Get hearings', '#/hearings/ask')}: <b>Give this ask to…</b> and <b>I’ll ask</b> beside each chair. Whoever takes it gets a row on Today.`],
    ['Also worth doing (suggestions)', `${go('Hearings', '#/hearings')}, at the foot of This week. Never counted, as before.`],
    ['The Mine and Team switch, and the person picker', `${isLeadish() ? `${go('Team', '#/team')} in the sidebar (leads), and ` : ''}${go('More tools', '#/tools')}, then See a teammate’s list, to read anyone’s list.`],
    ['Slipping', `${go('Team', '#/team')}, first on the page. Today keeps one line, “7 slipping · Open Team”.`, isLeadish],
    ['Your coalition’s week (for helpers): I’ll ask, Message Lauren', `One line on Today, “Lauren has 5 hearing asks this week · Offer to help”. It opens ${go('Get hearings', '#/hearings/ask?scope=coal')} for your coalitions.`],
    ['A coalition’s late or due cards (for helpers)', `Your own rows on Today, and ${go('Testimony', '#/testimony?view=write')} under To write.`],
    ['Messages from teammates, and the tracker’s notes', `${go('Inbox', '#/inbox')}, under Messages. A question to you that is not answered yet stays a row on Today.`],
    ['Write the public ask', `${go('Outreach', '#/outreach')}, under This week’s asks: the bill’s card has the box. It is still a row on Today two days before it is due.`],
    ['A bill with no owner on your issue: Take it', `${go('My issues', '#/my-issues')}: one line, “2 bills on your issue have no owner · Take one”. The bill’s header says “Nobody owns this bill yet · Take it”.`],
    ['What changed since yesterday', `${go('Inbox', '#/inbox?view=updates')}, under Updates: since yesterday, your last visit or the last 7 days.`],
    ['A row’s menu (the three dots)', 'Each action is in its home: <b>I’m going</b> and <b>Watch</b> on the hearing’s card, <b>Undo filed</b> on the testimony under Filed, <b>Reply in Team talk</b> in the Inbox, <b>Give to…</b> on the bill, the bill’s owner in its header.'],
    ['Give a to-do to someone else', 'The bill’s Next step tab, under To-dos on this bill: <b>Give to…</b> and <b>Take it yourself</b>. Waiting on others, on Today, has them too.'],
    ['The quick look at a bill (o)', 'The open item beside the list, on Today and on Bills (o or Space opens it, Esc closes it).'],
    ['The legislative day, on Today’s date line', `${go('Session calendar', '#/help/calendar')}, in Help and in More tools.`],
    ['Getting started (New here?)', `The top of Today for someone new, and ${go('More tools', '#/tools')}, then Getting started.`]]],
  ['Testimony', [
    ['Review, from Today’s approval card', `${go('Testimony', '#/testimony?view=approve')}, under To approve, opens Review: one draft at a time, as before. A note in the Inbox opens it too.`, approves],
    ['Drafts sent back, and Resubmit', `${go('Testimony', '#/testimony?view=sent')}, under Sent back, with the note, the Doc and <b>Resubmit</b>. The writer’s Today has the row too.`],
    ['The Mark filed sheet', `${go('Testimony', '#/testimony?view=file')}, under Ready to file: the filing card, with the PDF, the Capitol page and the form’s answers to copy.`],
    ['Withdraw from review, in the bill’s hearing menu', `${go('Testimony', '#/testimony?view=approve')}, under To approve: open your draft that is with an approver, then <b>Withdraw from review</b>. The Undo right after Send for approval does it too.`],
    ['Earlier testimony', `${go('Testimony', '#/testimony?view=filed')}, under Filed, and in More tools. A bill’s Next step tab offers Borrow from earlier testimony.`],
    ['Supporter emails to approve or send, on Today', `${go('Outreach', '#/outreach/emails')}, under Emails, and each email’s own page. Your own step on one stays a row on Today.`],
    ['Deadline reminders in the Inbox', 'They stay on the step itself (its time to act, on Today and in Testimony); the Inbox keeps only what happened.']]],
  ['Bills and a bill', [
    ['Bills’ menu: Sort new bills, Muted bills', `Tabs of ${go('Bills', '#/bills')} (Sort new bills in the opening weeks), and rows of ${go('More tools', '#/tools')}.`],
    ['Bills’ menu: Lists', `${go('Outreach', '#/outreach/lists')}, under Lists, and More tools.`],
    ['Bills’ quick filter chips', 'Presets at the top of Bills’ Filter sheet: At risk, Hearing this week, Monitoring.'],
    ['Bills’ menu: Save this view, Saved views', 'Bills’ Filter sheet: <b>Save this view</b>, and your saved views as presets. More tools lists them too.'],
    ['Bills’ menu: Columns and rows, Edit in the table, Export', 'Bills’ Table view, which anyone can pick: <b>Columns</b>, <b>Edit</b> and <b>Export</b> in its toolbar. More tools has Export too.'],
    ['Bills’ menu: Select bills', 'A <b>Select</b> button in Bills’ toolbar (or press and hold a row on a phone), then Change… or Add to…. More tools has Bulk change.'],
    ['A bill’s Overview tab and its Next up card', 'The bill’s Next step tab: What’s next for you, with your step’s button or whose step it is.'],
    ['To-dos, on a bill’s Overview', 'The bill’s Next step tab, under To-dos on this bill.'],
    ['A bill’s Activity tab', 'The bill’s Team talk tab: messages, the team note, and talks with legislators in one box.'],
    ['Committees, sponsors, coalitions and codes on Overview', 'About this bill and Committees, two labelled doors on the bill’s page.'],
    ['Our 2026 goal, under a bill’s heading', 'About this bill, on the bill’s page.'],
    ['Follow, in the bill’s menu', 'A <b>Follow</b> button in the bill’s header.'],
    ['Correct the stage, in the bill’s menu (admins)', 'About this bill, on the bill’s page: <b>Correct the stage</b>.', isAdmin],
    ['Mute, for a bill waiting for a hearing', 'Still in the bill’s menu (the three dots), where it reads <b>Not pushing this bill</b>. Unmute is on Bills’ Muted tab.'],
    ['The bill’s hearing menu: Watch, I’m going, Send a teammate, Fix the video link', '<b>Watch</b> and <b>I’m going</b> are on the hearing’s card; <b>Send a teammate…</b> and <b>Fix the video link</b> are on the hearing’s own page.'],
    ['The share kit, on a bill’s Public tab and on a hearing’s page', `${go('Outreach', '#/outreach')}, under This week’s asks: one card per bill with Copy link, Copy message, Copy post and Email followers. The bill and the hearing link to it.`],
    ['The weekly memo, in Bills’ menu', `${go('Outreach', '#/outreach/partners')}, under Partner update.`]]],
  ['Legislators', [
    ['Legislators’ This week', `${go('Legislators', '#/legislators?view=everyone')}, under Everyone: <b>Hearing our bills this week</b>.`],
    ['The phone’s House, Senate and All chips', `${go('Legislators', '#/legislators?view=everyone')}, under Everyone: Filter, then House or Senate.`],
    ['Holding our bills (it had no address)', `${go('Legislators', '#/legislators?view=holding')}, under Holding our bills, and in More tools.`],
    ['Log a conversation', 'A legislator’s page: <b>Log a talk</b>. A bill’s Team talk box logs one too. Tick “This was an ask for a hearing” when it was one.'],
    ['Mark where they stand, on a legislator’s page', 'The same page, beside each of our bills in their committees: <b>Mark where they stand</b> (once set, the stance itself, such as Leaning yes). The bill’s Committees door has it too.']]],
  ['Outreach and My issues', [
    ['Outreach’s issues, first visit numbers and QR code', `${go('My issues', '#/my-issues/all')}, under All issues; ${go('More tools', '#/tools')} has First visit numbers and Make a link or QR code.`],
    ['Your issues for 2027 (the prep list)', `${go('My issues', '#/my-issues')} itself, between sessions.`],
    ['The Prep board, in All issues’ menu (admins)', `${go('All issues', '#/my-issues/all?view=prep')}, its own switch beside the list (between sessions, or while something waits for you).`, isAdmin],
    ['Coalitions (its own page)', `${go('My issues', '#/my-issues/coalitions')}, under Coalitions.`],
    ['Supporters’ menu: Save as segment, Email this segment', `${go('Outreach', '#/outreach/supporters')}, under Supporters: filter, then <b>Save as a group</b> or <b>Email these people</b> in the results bar. Segments are called groups now.`],
    ['Supporters’ menu: Select people, Import CSV, Export', '<b>Select</b> beside Add a person; <b>Import CSV</b> and <b>Export</b> at the foot of Supporters (admins).']]],
  ['Lead tools', [
    ['Session setup’s people (Team)', `${go('People', '#/people')}, a lead tool: each person’s roles, sign-in, and hand over and turn off.`, isAdmin],
    ['Partners’ menu: Invite a group, Make a link only', 'Buttons at the top of Partners.', admitsPartners],
    ['Partners’ menu: Partner approvers', `${go('People', '#/people')}: each person’s record, under Roles.`, isAdmin],
    ['Session setup: Email, Hearing alerts, Message wording', 'Session setup, its Email and Slack tab: every Slack and email setting on one page, with the switch for email to the public.', isAdmin],
    ['Session setup: Coalitions, Session days and sync, Import, Committee map', 'Session setup, its Before each session tab.', isAdmin],
    ['Session setup: Connections, Keys', 'Session setup, its Connections tab (the keys under Technical details).', isAdmin],
    ['Session setup: Website embed, Tests, Tester sheet', 'Session setup, its Public page tab.', isAdmin],
    ['Session setup: People’s lists, Privacy and keeping', 'Session setup, its Privacy tab, with Forget a person.', isAdmin],
    ['Session setup’s Advanced', 'Gone: each of its parts is in one of the tabs above. Search finds each part by name.', isAdmin]]],
  ['Around the app', [
    ['Your initials menu, top right', 'You, at the foot of the sidebar: My settings, Refresh and Sign out. On a phone, the last rows of More.'],
    ['Practice as someone else, Start the practice over', 'You, at the foot of the sidebar, on the practice copy.'],
    ['The Inbox, in that menu', `${go('Inbox', '#/inbox')}, in the sidebar with its count; on a phone, the bell at the top.`],
    ['Help, My settings and Session setup at the sidebar’s foot', `Help in the sidebar; My settings under You${S.me?.is_admin ? '; Session setup under Lead tools' : ''}.`],
    ['The phone’s bar: Today, My issues, Bills, Legislators, Outreach', 'Today, Hearings, Testimony, Bills and More, where every other place is listed.'],
    ['Open the current app, and version links', 'More tools, under Compare versions (admins).', isAdmin],
    ['The search box', 'The same box, which now also finds places, setup parts and things to do. Cmd or Ctrl and K puts the cursor in it.'],
    ['Keyboard shortcuts', `All of v5’s, plus g h for Hearings, g w for Testimony and Cmd or Ctrl and K for search: ${go('Keyboard shortcuts', '#/help/keys')}.`]]],
];
const isLeadish = () => !!S.me && (S.me.is_admin || S.me.is_reviewer);
const isAdmin = () => !!S.me?.is_admin;
const approves = () => !!S.me && (S.me.is_admin || S.me.can_approve || S.me.is_reviewer);
const MOVED = () => MOVED_ALL().map(([h, rows]) => [h, rows.filter(r => !r[2] || r[2]())]).filter(([, rows]) => rows.length);
// What moved opens with the changes everyone meets (Julie read 70 rows over 11 phone screens); the rest wait in one fold per
// v5 place. A search hit on a folded row opens with its fold open and the row marked (?w=, as Capitol words do).
const TOP_MOVED = ['Today’s This week switch', 'The deadline box (bills that still need a hearing)', 'The Mine and Team switch, and the person picker',
  'What changed since yesterday', 'Messages from teammates, and the tracker’s notes', 'Getting started (New here?)', 'A row’s menu (the three dots)'];
const movedHTML = (route = {}) => { const groups = MOVED(), all = groups.flatMap(([, rows]) => rows), mark = markOf(route), lc = s => String(s || '').toLowerCase();
  const top = TOP_MOVED.map(l => all.find(r => r[0] === l)).filter(Boolean), rows = rs => dl(rs.map(([a, b]) => [esc(a), b]), mark, 'hp-moved');
  return `<p class="hp-p">v6 keeps everything v5 did, with fewer things on each screen.</p>
  <section class="hp-msec" aria-labelledby="hp-mvtop"><h3 class="hp-h3" id="hp-mvtop">What everyone meets</h3>${rows(top)}</section>
  <section class="hp-msec" aria-labelledby="hp-mvrest"><h3 class="hp-h3" id="hp-mvrest">Everything else, by where it was in v5</h3>
  ${groups.map(([h, rs]) => { const rest = rs.filter(r => !TOP_MOVED.includes(r[0])); if (!rest.length) return '';
    const open = mark && rest.some(r => lc(r[0]) === lc(mark)) ? ' open' : '';
    return `<details class="hp-mfold"${open}><summary>${icon('chevron-right', { cls: 'hp-chev' })}<span>${esc(h)}</span><span class="hp-mn">${rest.length}</span></summary>${rows(rest)}</details>`; }).join('')}</section>`; };

const topic = id => TOPICS.find(t => t.id === id && (!t.gate || t.gate()));
// Someone who has not done Getting started's steps meets it first; everyone else lands on How do I….
const isNew = () => newSteps().some(x => !x.done);
const homeTopic = () => topic(isNew() ? 'new' : HOW_TO() ? 'howto' : 'words');
const visible = () => TOPICS.filter(t => !t.hidden && (!t.hover || HOVER()) && (!t.gate || t.gate()));

// ---- Getting started (V29): the one list (Today draws its first three still to do from it), by season and by role ----
const coalIds = me => { const c = me?.prefs?.coalitions; return c === 'all' ? null : new Set(Array.isArray(c) ? c : []); };
const coalWord = me => { const c = me?.prefs?.coalitions;
  if (c === 'all') return 'your coalitions’';
  const ns = Array.isArray(c) ? c.map(id => (S.campaigns || []).find(x => x.id === id)?.name).filter(Boolean) : [];
  return ns.length === 1 ? `${ns[0]}’s` : ns.length ? 'your coalitions’' : ''; };
const firstBillHref = me => { const ids = coalIds(me), b = S.bills.find(x => (S.assignments[x.id] || []).includes(me.id)) || S.bills.find(x => x.position && x.position !== 'monitor' && (!ids || (S.billCampaigns?.[x.id] || []).some(c => ids.has(c))));
  return b ? `#/bill/${encodeURIComponent(b.bill_number)}` : '#/bills'; };
// The person's testimony job, by role (spec 7.6: one wording per act, the same on Today and here). Each ticks from the
// drafts' record (approved_by, second_approved_by, submitted_by), which keeps what each person did after the draft moves
// on, so Patti's step stays ticked after she resubmits (X25):
//   approvers (and admins, and a second approver who owns no bill): Approve a testimony draft;
//   ralliers who own no bill (Saya): Write a public ask, then Copy this week's newsletter (asks.js ticks both);
//   writers (an owner, or a coalition's helper with a draft to write or one sent before): Send a testimony draft for approval;
//   helpers with nothing to write (Julie): Offer to help with a chair ask (never "Send a draft" leading to "Nothing for you
//   to write right now").
const ASK_TODO = /^Ask .+ for a hearing/;
const askedChair = me => legNotesAll().some(n => n.advocate_id === me.id && (n.answer || /^Asked for a hearing/.test(n.body || '')));
function jobSteps(me, ownsNone, o) {
  const drafts = Object.values(S.drafts || {}).flat();
  if (me.can_approve || me.is_admin || (me.is_reviewer && ownsNone))
    return [{ k: 'job', done: drafts.some(d => d.approved_by === me.id || d.second_approved_by === me.id), title: 'Approve a testimony draft', sub: 'Testimony, then To approve: Approve, or Send back with a note', href: '#/testimony?view=approve' }];
  if (ownsNone && isRallier(me))
    return [{ k: 'publicask', done: !!o.publicask, title: 'Write a public ask', sub: 'Outreach, This week’s asks: what people should do, and by when', href: '#/outreach' },
      { k: 'newsletter', done: !!o.newsletter, title: 'Copy this week’s newsletter', sub: 'Outreach: Copy all for the newsletter, then paste it', href: '#/outreach' }];
  const writes = !ownsNone || drafts.some(d => d.submitted_by === me.id) || drafts.some(d => { const b = billById(d.bill_id); if (!b) return false;
    try { const w = whoseStep(d, b, { viewer: me }); return w.role === 'write' && w.you; } catch { return false; } });
  if (writes) return [{ k: 'job', done: drafts.some(d => d.submitted_by === me.id), title: 'Send a testimony draft for approval', sub: 'Testimony, then To write: the Doc, then Send for approval (or Resubmit)', href: '#/testimony?view=write' }];
  const took = Object.values(S.todos || {}).flat().some(t => t && t.assignee_id === me.id && ASK_TODO.test(t.title || ''));
  return [{ k: 'offer', done: took || askedChair(me), title: 'Offer to help with a chair ask', sub: 'Hearings, then Get hearings: I’ll ask beside a chair', href: '#/hearings/ask?scope=coal' }];
}
function newSteps() {
  const o = frGet(), me = S.me; if (!me) return [];
  const ownsNone = !S.bills.some(b => (S.assignments[b.id] || []).includes(me.id)), co = ownsNone ? coalWord(me) : '';
  // Ticks when a setting is saved (me.js), never from opening the page.
  const steps = [{ k: 'settings', done: !!o.settings, title: 'Choose how the tracker reaches you', sub: 'My settings: Slack, email, or only in the app, then save', href: '#/me' }];
  // Someone who owns no bill, follows none and helps on no coalition starts by picking their coalition (R-316 W7, FR-3).
  // An approver reviews every coalition's testimony, so the coalition pick is not their first step.
  if (ownsNone && !co && !(me.can_approve || me.is_reviewer || me.is_admin) && !S.bills.some(b => S.follows?.has(b.id))) steps.push({ k: 'coal', done: false, title: 'Pick the coalition you help on', sub: 'My issues, then Coalitions: switch on I help on', href: '#/my-issues/coalitions' });
  if (SESSION_OVER) {
    // November: your 2027 issues first (the season's job), your bills, and (live only) a practice day in last March's copy.
    const t = prepTaskOf(me.id), hasIssue = (S.issues || []).some(i => i.owner_id === me.id) || !!t;
    if (hasIssue) steps.push({ k: 'prep', done: !t || t.ready > 0, title: t && !t.own ? 'Help get your coalition’s issues ready for 2027' : 'Get your issues ready for 2027',
      sub: 'My issues: the six steps, then Mark ready', href: t ? issueHref(t.back[0] || t.next, 'prep') : '#/my-issues' });
    steps.push({ k: 'bills', done: !!o.bills, title: co ? `Look over ${co} bills` : 'Look over your bills', sub: 'Bills: each one grouped by where it stands', href: '#/bills' });
    if (!DEMO) steps.push({ k: 'practice', done: !!o.practice, title: 'Practice a March day', sub: 'Last March’s practice copy: nothing reaches the team', href: practiceHref(), ext: true });
  } else {
    // January to May: the person's job, this week's hearings, a chair ask (owners), a bill (V29).
    steps.push(...jobSteps(me, ownsNone, o));
    // v5 kept this tick as "week"; I'm going on any sitting counts too.
    steps.push({ k: 'hearings', done: !!(o.hearings || o.week) || Object.values(S.attend || {}).some(ids => (ids || []).includes(me.id)), title: 'See this week’s hearings', sub: 'Hearings, This week: who is going, and where each testimony stands', href: '#/hearings/week' });
    if (!ownsNone) steps.push({ k: 'ask', done: askedChair(me), title: 'Ask a chair for a hearing', sub: 'Hearings, then Get hearings: Email the chair, then Did you send it?', href: '#/hearings/ask' });
    steps.push({ k: 'bill', done: !!o.bill, title: 'Open a bill and read What’s next for you', sub: 'It says what the bill needs, by when, and whose step it is', href: firstBillHref(me) });
  }
  return steps;
}
// The look-only steps tick when the person opens the place, however they got there (a link, the sidebar, a key, Back):
// the frame announces each route it draws as window 'v6:route' with detail.hash (the v6 router moves by pushState, so
// hashchange never fires). One key per step.
// Hearings opened from the sidebar or the phone bar (#/hearings) shows This week or Get hearings by what the person has
// (hearings.js viewOf): it counts as seeing this week's hearings only when This week is the tab drawn.
const LOOKS = [[/^#\/hearings\/week(?:[?/]|$)/, 'hearings'], [/^#\/bills(?:\?|$)/, 'bills'], [/^#\/bill\/[^/?]+/, 'bill']];
const weekDrawn = () => /^\s*This week\b/.test(document.querySelector('main .sv-secnav [aria-current="page"]')?.textContent || '');
const lookAt = hash => { const h = String(hash || ''), x = h.startsWith('#') ? h : '#' + h.replace(/^\/?/, '/');
  const hit = LOOKS.find(([r]) => r.test(x)) || (/^#\/hearings(?:\?|$)/.test(x) && weekDrawn() ? [null, 'hearings'] : null);
  if (hit && S.me && !frGet()[hit[1]]) frSet({ [hit[1]]: 1 }); };
if (typeof window !== 'undefined') {
  addEventListener('v6:route', e => lookAt(e?.detail?.hash ?? location.hash));
  // The practice step opens another tab, so no route is drawn here: its link ticks it, wherever it is (Help or Today).
  document.addEventListener('click', e => { const a = e.target?.closest?.('a[href]'); if (a && !DEMO && S.me && a.getAttribute('href') === practiceHref() && !frGet().practice) frSet({ practice: 1 }); }, true);
}
// No progress bar (C-7: no homework bars): the ticks, and how many are done.
function newHTML() {
  const steps = newSteps(), n = steps.filter(s => s.done).length;
  return `<p class="hp-p">${n} of ${steps.length} done. Each ticks itself once you have done it.</p>
    <div class="v6-list hp-steps" role="list" aria-label="Getting started">${steps.map(s => itemRow({ key: 'fr:' + s.k, name: s.title, line: `<span class="sr">${s.done ? 'Done: ' : 'To do: '}</span>${esc(s.sub)}`, icon: s.done ? 'circle-check' : 'circle-dashed', tone: s.done ? 'done' : '', href: s.href, cls: `hp-step${s.done ? ' done' : ''}${s.ext ? ' ext' : ''}` })).join('')}</div>
    ${practiceLink()}`;
}

// ---- search: every entry of every guide, plus the guide titles (R-277 fix 9; R-316 W29) ----
// Word by word: each word that carries meaning has to appear (or one of its other words, SYN) in the entry or its guide's
// title; small words ("how", "do", "I") are dropped. A word in the entry's name beats one in its text.
const STOP = new Set(['a', 'an', 'and', 'are', 'at', 'can', 'do', 'does', 'for', 'get', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your', 'turn', 'off', 'im', 'am', 'say', 'this', 'someone', 'one']);
// Other words people use for the same thing. Each row is one meaning; a word in a row finds every word in it.
export const SYN = [
  ['going', 'go', 'attend', 'attending', 'goer'],
  ['chair', 'chairs', 'hearing request', 'ask the chair', 'schedule', 'notice'],
  ['log', 'call', 'conversation', 'conversations', 'meeting', 'talked', 'talk'],
  ['stance', 'stances', 'where they stand'],
  ['owe', 'today', 'needs you', 'due today'],
  ['hand', 'give', 'give to', 'take over', 'pass on', 'hand over', 'handover', 'cover'],
  ['password', 'sign', 'login', 'log in', 'sign-in link', 'sign in'],
  ['ask', 'asks', 'public ask', 'share kit', 'kit'],
  ['monitor', 'monitoring', 'watch', 'watching'],
  ['revise', 'resubmit', 'fix'],
  ['sponsor', 'sponsors', 'introducer', 'introduced'],
  ['file', 'filing', 'filed', 'submit', 'send in', 'capitol website'],
  ['qr', 'qr code', 'poster', 'print'],
  ['ping', 'pings', 'alert', 'alerts', 'notification', 'notifications', 'reminder', 'reminders', 'nudge', 'dm', 'slack', 'mute', 'quiet'],
  ['approve', 'approval', 'approver', 'review', 'sign off', 'send back', 'sent back'],
  ['testimony', 'draft', 'doc', 'letter'],
  ['to-do', 'todo', 'task', 'follow-up', 'follow up'],
  ['partner', 'partners', 'memo', 'update', 'newsletter'],
  ['settings', 'preferences', 'my settings'],
  ['inbox', 'messages', 'message'],
  ['deadline', 'due', 'late', 'overdue'],
  ['owner', 'own', 'owning', 'assign'],
  ['coalition', 'coalitions', 'help on', 'support'],
  ['drive', 'google drive', 'folder'],
  ['calendar', 'event'],
  ['undo', 'unmark', 'mistake'],
  ['new', 'start', 'first day', 'getting started'],
  ['moved', 'v5', 'old', 'where is', 'changed'],
  ['keys', 'keyboard', 'shortcut', 'shortcuts', 'hotkeys'],
];
// A word finds its own row only ("sign" no longer reads as "sign off").
export const synOf = w => { const row = SYN.find(r => r.includes(w)); return row ? [w, ...row] : [w]; };
// A short word ("dm", "qr", "due") must stand alone; a longer one must start a word ("ready" is not in "already").
const rx = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const whole = (hay, x) => new RegExp(`(^|[^a-z0-9])${rx(x)}($|[^a-z0-9])`).test(hay);
const has = (hay, x) => x.length <= 3 ? whole(hay, x) : new RegExp(`(^|[^a-z0-9])${rx(x)}`).test(hay);
// Entries hold HTML (escaped once already); results show plain text, escaped once (L-14).
const unent = s => String(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const wordsOf = q => { const all = plain(q).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean), ws = all.filter(w => !STOP.has(w));
  return ws.length ? ws : all.length ? [all.join(' ')] : []; };
const entriesOf = t => t.items ? t.items() : t.id === 'moved' ? MOVED().flatMap(([, rows]) => rows) : [[t.title, '']];
// The meaning's first sentence, whole (A-1: never cut with a typed "…"), then the guide it is in.
const firstSent = t => { t = String(t || ''); const m = /^.*?[.!?](?=\s|$)/.exec(t); return m && m[0].split(/\s+/).length >= 3 ? m[0] : t; };
const hitRow = h => itemRow({ key: h.t.id + ':' + h.term, name: h.term, line: esc(h.guide ? h.t.sub() : `${h.def ? firstSent(h.def) + ' · ' : ''}${h.t.title}`), icon: h.guide ? h.t.icon : undefined,
  href: `#/help/${h.t.id}${!h.guide && ['words', 'moved'].includes(h.t.id) ? `?w=${encodeURIComponent(h.term)}` : ''}`, cls: 'hp-row' });
function results(q) {
  const ws = wordsOf(q); if (!ws.length) return q.trim() ? '<p class="hp-none" role="status">Type a word, such as “file” or “alerts”.</p>' : '';
  const exactQ = plain(q.trim());
  const alts = ws.map(synOf), hits = [], near = [], keyW = ws.reduce((k, w, i) => w.length > ws[k].length ? i : k, 0);
  for (const t of visible()) {
    // A guide whose own title (or other words) has every word comes first, above its own entries.
    const th = plain(`${t.title} ${t.also || ''}`);
    if (alts.every(a => a.some(x => has(th, x)))) hits.push({ t, term: t.title, def: '', guide: true, score: 100 + alts.reduce((n, a) => n + (whole(th, a[0]) ? 2 : 1), 0) });
    for (const [term0, def] of entriesOf(t)) {
      if (term0 === 'Step by step') continue;   // How do I…'s list of links to the guides; the guides are found themselves
      const term = unent(term0), txt = unent(def), hay = plain(`${t.title} ${t.also || ''} ${term} ${txt}`), head = plain(`${t.title} ${t.also || ''} ${term}`);
      const got = alts.filter(a => a.some(x => has(hay, x))).length;
      // A near answer must hold the query's longest word, so "log in" is not offered for "log a call".
      if (got < alts.length) { if (got && got >= alts.length / 2 && alts[keyW].some(x => has(hay, x))) near.push({ t, term, def: txt, score: got * 10 + (alts.some(a => has(plain(`${t.title} ${term}`), a[0])) ? 1 : 0) }); continue; }
      // An entry named exactly what was typed comes first, a Capitol word above all ("decking" is the word, before the
      // calendar's two deckings, as the top search ranks it); then the guides; the calendar's dated rows last.
      const exact = plain(term) === exactQ ? (t.id === 'words' ? 1000 : 300) : 0;
      const tt = plain(`${t.title} ${t.also || ''}`), score = exact - (t.id === 'calendar' ? 30 : 0) + alts.reduce((n, a) => n + (whole(head, a[0]) ? 4 : a.some(x => whole(head, x)) ? 3 : a.some(x => has(head, x)) ? 2 : 1) + (whole(tt, a[0]) ? 1 : 0), 0);
      if (term !== t.title || !hits.some(h => h.t === t && h.term === t.title)) hits.push({ t, term, def: txt, score });
    }
  }
  // When nothing has every word, the entries with most of them, under a plain label.
  if (!hits.length && near.length) { near.sort((x, y) => y.score - x.score);
    return `<p class="hp-none" role="status">Nothing in Help has every word of “${esc(q.trim())}”. The closest answers:</p><div class="v6-list" role="list">${near.slice(0, 6).map(hitRow).join('')}</div>`; }
  if (!hits.length) return missHTML(q);
  hits.sort((x, y) => y.score - x.score);
  const shown = hits.slice(0, 40);
  return `<p class="sr" role="status">${hits.length} found</p><div class="v6-list" role="list" aria-label="What Help says">${shown.map(hitRow).join('')}</div>${hits.length > 40 ? `<p class="hp-note">Showing 40 of ${hits.length}. Add a word to narrow it down.</p>` : ''}`;
}
// A search that finds nothing offers the guides, then Ask Nate in Slack (Nate 10/22: "just a dm to me") with the words
// filled in and "(from Help)" after them, so Nate can count what Help missed. A Slack link cannot carry a message, so the
// button copies the words and opens the DM; nothing is sent until the person sends it.
const GUIDES = ['howto', 'hearing', 'talk', 'changes', 'calendar', 'moved'];
const START_IDS = ['new', 'moved'];
// Nate's Slack account is linked the first time the tracker messages him (advocates.slack_user_id). Linked, the button opens
// a direct message to him (Slack's app_redirect opens a DM from a user id) after copying the words; until then it copies
// the words and says to send them to Nate in a direct message. Never a channel: a beginner's question does not belong in
// the team's busy alerts channel.
const nateSlack = () => (S.advocates || []).find(a => a.initials === 'NT' && a.slack_user_id) || null;
const isNate = () => S.me?.initials === 'NT';
// Where the button goes: a direct message to Nate once his Slack id is on his staff record (that waits on Nate, spec 13);
// until then Slack itself, and the words say to message Nate there. Never a channel: a beginner's question does not belong
// in the team's busy alerts channel.
const slackHref = () => { const n = nateSlack(); return n ? `https://slack.com/app_redirect?channel=${encodeURIComponent(n.slack_user_id)}` : 'https://app.slack.com/client'; };
// What Copy my question copies: the words typed in Help's search, else the page's title to start from, with "(from Help)"
// so Nate can count what Help missed.
const askWordsOf = (q, title) => { const w = String(q || '').trim(); return w ? `${w} (from Help)` : title ? `About “${title}” (from Help): ` : 'A question (from Help): '; };
// The tonal Ask Nate in Slack with Copy my question beside it, always (Julie, on a phone: the only way to a person was grey
// text with no link, and Copy appeared only after a search, as the page's last line). Near the top of Help (`top`: its words
// follow the search box as you type) and at the foot of every guide.
function askBar(q = '', title = '', { top = false, nav = false } = {}) {
  if (isNate()) return '';
  const words = askWordsOf(q, title), dm = !!nateSlack(), at = { 'data-asktitle': title };
  return `<div class="hp-askbar${top ? ' top' : ''}${nav ? ' nav' : ''}" role="group" aria-label="Ask Nate in Slack">
    <div class="hp-askbtns">${btn('Ask Nate in Slack', { kind: 'secondary', icon: 'message-circle', href: slackHref(), target: '_blank', attrs: { ...at, 'data-askslack': words, 'data-askto': dm ? 'dm' : 'slack' } })}${btn('Copy my question', { kind: 'text', icon: 'copy', attrs: { ...at, 'data-askslack': words, 'data-askto': 'copy' } })}</div>
    <p class="hp-askhint">${dm ? 'Opens a direct message to Nate.' : 'Opens Slack: send Nate a direct message there.'}</p></div>`;
}
// big: under a search that found nothing, and on the Ask page: the words shown, the same two buttons.
function askSlack(q = '', { big = false } = {}) {
  if (isNate() || !big) return '';
  const words = askWordsOf(q, ''), dm = !!nateSlack();
  const say = dm ? 'The button copies your words and opens a direct message to Nate: paste them and send.' : 'The button copies your words and opens Slack: send them to Nate in a direct message.';
  return `<div class="hp-ask"><p class="hp-p">Still stuck? Ask Nate. ${esc(say)}</p>
    <div class="hp-askbtns">${btn('Ask Nate in Slack', { kind: 'secondary', icon: 'message-circle', iconEnd: 'external-link', href: slackHref(), target: '_blank', attrs: { 'data-askslack': words, 'data-askto': dm ? 'dm' : 'slack' } })}${btn('Copy my question', { kind: 'text', icon: 'copy', attrs: { 'data-askslack': words, 'data-askto': 'copy' } })}</div>
    ${q.trim() ? `<p class="hp-askw">“${esc(words)}”</p>` : ''}</div>`;
}
const guideRow = t => itemRow({ key: t.id, name: t.title, line: esc(t.sub()), icon: t.icon, href: '#/help/' + t.id, cls: 'hp-row' });
// Ask Nate in Slack is already at the top of Help with these words in it, so a miss points there instead of drawing a second one.
const missHTML = q => `<p class="hp-none" role="status">Nothing in Help mentions “${esc(q.trim())}”. Try another word or one of these guides${isNate() ? '' : `, or press Ask Nate in Slack ${DESK() ? 'on the left' : 'above'}: it copies your words`}.</p>
  <div class="v6-list" role="list" aria-label="Guides">${GUIDES.map(topic).filter(Boolean).map(guideRow).join('')}</div>`;
const dl = (items, mark = '', cls = '') => `<dl class="hp-dl${cls ? ' ' + cls : ''}">${items.map(([t, d]) => { const on = mark && unent(t).toLowerCase() === mark.toLowerCase();
  return `<div class="hp-dli"${on ? ' id="hp-wmark" tabindex="-1"' : ''}><dt>${on ? `<mark>${t}</mark>` : t}</dt><dd>${d}</dd></div>`; }).join('')}</dl>`;
// A Capitol word opened from the top search (#/help/words?w=Sine die) is marked and scrolled to once per visit (a flag on
// that history entry), so a redraw while reading does not jump back to it (R-316 W29).
const markOf = route => ['words', 'moved'].includes(route?.topic) && route.q?.w ? String(route.q.w) : '';
const freshMark = route => !!markOf(route) && !history.state?.wmark;

// Keyboard shortcuts carries its own on-off switch, kept on this device (ui.js setKeys; F21).
const keysNote = t => t.id !== 'keys' ? '' : `${HOVER() ? '' : `<p class="hp-note">${icon('info')}<span>These need a keyboard. They are off on touch screens.</span></p>`}
  <div class="hp-card hp-keyson">${switchRow('hp-keyson', 'Use keyboard shortcuts', keysOn(), 'Off means a stray letter never does anything. Approving always takes Shift+A. Kept on this device.', { 'data-keys': '1' })}</div>`;
const bodyOf = (t, route) => (t.html ? t.html(route) : `<div class="hp-card">${dl(t.items().map(([a, b]) => [esc(unent(a)), b]), markOf(route))}</div>`)
  // A guide about a job ends with the way to it (the filing guide: Open Ready to file).
  + (t.cta ? `<p class="hp-cta">${btn(esc(t.cta[0]), { kind: 'secondary', iconEnd: 'arrow-right', href: t.cta[1] })}</p>` : '');
const searchBox = (q, ph) => `<form class="hp-search" role="search" data-hsform><label class="sr" for="hp-q">Search Help</label>${icon('search')}<input id="hp-q" type="search" placeholder="${esc(ph)}" autocomplete="off" enterkeyhint="search" value="${esc(q)}"></form>`;

// Help's guide list: Start here (Getting started, What moved), the guides people open most, and the rest folded under All
// guides (the left list was 24 topics, a wall for the least confident people). Guides are reference, so a fold may hold
// them (rule 7.3); the fold opens by itself when the guide on screen is in it.
const MOST_IDS = ['howto', 'testimony', 'hearing', 'file', 'talk', 'words'];
function guideGroups(list = visible()) {
  const pick = ids => ids.map(id => list.find(x => x.id === id)).filter(Boolean);
  const start = pick(START_IDS), most = pick(MOST_IDS), rest = list.filter(x => !start.includes(x) && !most.includes(x));
  return { start, most, rest };
}
// Below 1100px: Help's own list of guides, and each guide as its own page with Back. Start here sits right under the search
// box, as on a laptop (Julie: What moved was three phone screens down): Getting started's steps while some are left (the
// laptop opens on them too), else its row, and What moved; then Ask Nate in Slack, then the guides.
function renderIndex() {
  const q = S.hpQ || '', on = !!q.trim(), { start, most, rest } = guideGroups();
  return `<div class="hp-page">
    <h1 class="v6-ptitle sv-h1">Help</h1>
    ${searchBox(q, 'Search Help')}
    <section class="hp-sec hp-startsec" id="hp-start" aria-labelledby="hp-hs" ${on ? 'hidden' : ''}><h2 class="hp-h2" id="hp-hs">Start here</h2>
      ${isNew() ? `<h3 class="hp-h3"><a class="hp-h3a" href="#/help/new">Getting started</a></h3>${newHTML()}` : ''}
      <div class="v6-list hp-startl" role="list" aria-label="Start here">${start.filter(x => !(isNew() && x.id === 'new')).map(guideRow).join('')}</div></section>
    ${askBar(q, 'Help', { top: true })}
    <div id="hp-res" aria-live="polite">${results(q)}</div>
    <div id="hp-default" ${on ? 'hidden' : ''}>
      <section class="hp-sec" aria-labelledby="hp-hm"><h2 class="hp-h2" id="hp-hm">Most used</h2><div class="v6-list" role="list" aria-label="Most used guides">${most.map(guideRow).join('')}</div></section>
      ${rest.length ? `<details class="hp-sec hp-all"><summary class="hp-allsum">${icon('chevron-right', { cls: 'hp-chev' })}<span>All guides</span><span class="hp-mn">${rest.length}</span></summary>
        <div class="v6-list" role="list" aria-label="All guides">${rest.map(guideRow).join('')}</div></details>` : ''}
    </div>
  </div>`;
}
function renderTopic(t, route) {
  return `<div class="hp-page hp-sub">
    <a class="hp-crumb" href="#/help" data-back>${icon('arrow-left')}<span>Help</span></a>
    <h1 class="v6-ptitle hp-h1">${esc(t.title)}</h1>${t.sub && t.id !== 'new' ? `<p class="hp-lede">${esc(t.sub())}</p>` : ''}${keysNote(t)}${bodyOf(t, route)}
    ${t.id === 'ask' ? '' : askBar('', t.title)}
  </div>`;
}
// From 1100px: the search and the guides on the left (they stay in view), the guide on the right. One h1, "Help"; the guide's
// title is the h2 under it (R-277 fix 10: every page's title sits at the same place).
const navItem = (x, t, q) => `<a class="hp-navi" href="#/help/${x.id}"${x.id === t.id && !q.trim() ? ' aria-current="page"' : ''}>${icon(x.icon)}<span>${esc(x.title)}</span></a>`;
function navList(list, t, q) {
  const { start, most, rest } = guideGroups(list);
  const grp = (h, xs) => xs.length ? `<p class="hp-navh">${esc(h)}</p>${xs.map(x => navItem(x, t, q)).join('')}` : '';
  return `${grp('Start here', start)}${grp('Most used', most)}${rest.length ? `<details class="hp-navall"${rest.includes(t) ? ' open' : ''}><summary class="hp-navi hp-navsum">${icon('chevron-right', { cls: 'hp-chev' })}<span>All guides</span><span class="hp-mn">${rest.length}</span></summary>${rest.map(x => navItem(x, t, q)).join('')}</details>` : ''}`;
}
function renderDesk(route) {
  // A link from elsewhere to a guide opens that guide, not an old search's results (R-316 W29, L-14).
  if (route.topic && S.hpTopic !== route.topic || freshMark(route)) { S.hpQ = ''; S.hpTopic = route.topic; }
  const q = S.hpQ || '', t = topic(route.topic) || homeTopic();
  const list = visible(); if (!list.includes(t)) list.push(t);   // a link to a guide this device does not list still shows where you are
  return `<div class="hp-page hp-duo"><h1 class="v6-ptitle sv-h1 hp-dh1">Help</h1><div class="hp-cols">
    <nav class="hp-nav" aria-label="Help guides">${searchBox(q, 'Search Help')}${t.id === 'ask' ? '' : askBar(q, t.title, { top: true, nav: true })}${navList(list, t, q)}</nav>
    <div class="hp-pane">
      <h2 id="hp-ph" class="hp-ptitle" data-title="${esc(t.title)}">${q.trim() ? 'Search results' : esc(t.title)}</h2><p class="hp-lede" id="hp-psub" ${q.trim() ? 'hidden' : ''}>${esc(t.sub && t.id !== 'new' ? t.sub() : '')}</p>
      <div id="hp-res" aria-live="polite">${results(q)}</div>
      <div id="hp-default" ${q.trim() ? 'hidden' : ''}>${keysNote(t)}${bodyOf(t, route)}${t.id === 'ask' ? '' : askBar('', t.title)}</div>
    </div>
  </div></div>`;
}

// Copy the question before Slack opens (the link itself opens the DM in a new tab); unlinked, the toast says where to send it.
// One listener on the page covers the results, which are redrawn as you type.
function wireAsk(root) {
  const page = root.querySelector('.hp-page'); if (!page || page.__ask) return; page.__ask = true;
  page.addEventListener('click', e => { const a = e.target.closest('[data-askslack]'); if (!a) return;
    const to = a.dataset.askto, words = a.dataset.askslack;
    const said = to === 'dm' ? 'Copied your question. Paste it in the message to Nate and send.' : to === 'slack' ? 'Copied your question. In Slack, send it to Nate in a direct message.'
      : `Copied: “${words.trim()}” Paste it in a direct message to Nate in Slack.`;
    const miss = () => toast(to === 'copy' ? 'Could not copy here. Write your question to Nate in a direct message in Slack.' : 'Slack is opening. Send Nate a direct message with your question.');
    try { navigator.clipboard.writeText(words).then(() => toast(said, { ok: true }), miss); } catch { miss(); } });
}
// Today shows these same steps as its Getting started list (R-106, V29).
export { newSteps, frSet as markNewStep };
// The top search finds Help's guides as places (search.js placeHits): their titles and other words.
export const helpTopics = () => visible().map(t => ({ id: t.id, title: t.title, also: t.also || '', icon: t.icon }));
export default {
  tab: 'help',
  // Two columns need more than the frame's 720px reading column.
  wide: () => DESK(),
  title: route => topic(route.topic)?.title || 'Help',
  back: route => topic(route.topic) ? { href: '#/help', label: 'Help' } : null,
  render(route) { if (DESK()) return renderDesk(route); const t = topic(route.topic); return t ? renderTopic(t, route) : renderIndex(); },
  wire(route, root) {
    const wm = root.querySelector('#hp-wmark');   // a Capitol word opened from the top search
    if (wm && freshMark(route)) { try { history.replaceState({ ...(history.state || {}), wmark: 1 }, ''); } catch { /* it lands again on a redraw */ }
      requestAnimationFrame(() => { if (!wm.isConnected) return; wm.scrollIntoView({ block: 'center' }); wm.focus({ preventScroll: true }); }); }
    root.querySelectorAll('.hp-step.ext .v6-row-main').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    const ks = root.querySelector('[data-keys]');
    if (ks) ks.onchange = () => { setKeys(ks.checked); toast(ks.checked ? 'Keyboard shortcuts are on.' : 'Keyboard shortcuts are off.', { ok: true }); };
    wireAsk(root);
    const f = root.querySelector('[data-hsform]'); if (!f) return;
    const inp = f.querySelector('input'), res = root.querySelector('#hp-res'), def = root.querySelector('#hp-default'), desk = !!root.querySelector('.hp-duo');
    const wireRes = () => res.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); if (desk) S.hpQ = ''; S.go(a.getAttribute('href')); });
    // Typing updates the results in place, so the box keeps its focus and the page does not jump.
    inp.oninput = () => { S.hpQ = inp.value; res.innerHTML = results(inp.value); const on = !!inp.value.trim(); def.hidden = on; wireRes();
      const st = root.querySelector('#hp-start'); if (st) st.hidden = on;
      root.querySelectorAll('.hp-askbar.top [data-askslack]').forEach(b => { b.dataset.askslack = askWordsOf(inp.value, b.dataset.asktitle); });
      if (desk) { const h = root.querySelector('#hp-ph'), sub = root.querySelector('#hp-psub'); h.textContent = on ? 'Search results' : h.dataset.title; sub.hidden = on;
        root.querySelectorAll('.hp-nav .hp-navi').forEach(a => { if (on) a.removeAttribute('aria-current'); else if (a.getAttribute('href') === '#/help/' + (topic(route.topic) || homeTopic()).id) a.setAttribute('aria-current', 'page'); }); } };
    f.onsubmit = e => { e.preventDefault(); res.querySelector('a')?.focus(); };
    inp.onkeydown = e => { if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; inp.oninput(); } };
    // Choosing a guide on the left ends the search, so the guide shows.
    if (desk) root.querySelector('.hp-nav').addEventListener('click', e => { if (e.target.closest('a.hp-navi')) S.hpQ = ''; }, true);
    wireRes();
  },
};
