// HIPHI Staff v2: Help (#/help, #/help/:topic; plan 3.12). A reference, not a tutorial: the Capitol's words first,
// then short guides, each on its own page so a link can point straight at one (#/help/testimony). One search box
// looks through all of it. Facts that change are read from the data, never typed in: whether email is paused (the
// email setting), who approves (the admin and reviewer flags), the deadlines (the session calendar) and the
// committees. Keyboard shortcuts are listed only where there is a mouse to hover with.
// On a desktop (900px and wider, build 3) it is a two-column reference: the search and the list of topics stay in
// view on the left, and the chosen topic reads in a column of about 70 characters on the right. #/help opens on
// Capitol words there; #/help/keys (the frame's "?" shortcut) opens the shortcuts directly at any width.
// v3 (R-264): the guides describe Staff v3's shape (five places, a bill's three tabs, Outreach's two), and the switch for
// keyboard shortcuts lives on Keyboard shortcuts itself instead of in My settings.
// v4 (R-269): Staff v4's shape: Today always opens on Mine, Team starts with Slipping for admins and second approvers,
// Outreach has four tabs, Tasks retired; New here? is four steps, and for someone who owns no bills it starts with their
// coalition's testimony.
// v5 (R-277 fix 9, F-9): Help opens on New here? until its four steps are done, searches word by word with a short list of
// other words people use (SYN), and has How to file at the Capitol (linked from the Mark filed sheet) and Which alerts you
// get. "Where things live" is "Drive, Slack and the calendar", since it is about those, not the app (the app map is What
// each place is for). Its words match the menus (fix 2: Send for approval, Send back, to-do, alerts, I help on).
import { S, DB, DEMO, APP_URL, STAGES, esc, fmtDate, isMine, DEADLINE_ROWS } from './data.js';
import { glossStage, legislativeDay, PUBLIC_APP, plain, sessionGates, deadlineCalendar, gateGloss, gateName } from './model.js';
import { icon, btn, row, switchRow, toast, keysOn, setKeys } from './ui.js';
import { WORDS, allWords, HOW_TO, TERMS_TAP } from './terms.js';   // R-316 W40, W37 (practice copy)
export { HOW_TO };

const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const names = pred => S.advocates.filter(a => pred(a) && a.is_active !== false).map(a => a.full_name);
const orList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
const emailOff = () => (S.emailCfg || {}).enabled === false;
const FR_KEY = DEMO ? 'hiphi2_firstrun_demo' : 'hiphi2_firstrun';
// R-316 W7 (L-1): the ticks follow the person (advocates.prefs.firstrun), so a step done on the laptop is done on the phone;
// what this browser kept before still counts.
const frLocal = () => { try { return JSON.parse(localStorage.getItem(FR_KEY) || '{}'); } catch { return {}; } };
const frGet = () => ({ ...frLocal(), ...(S.me?.prefs?.firstrun || {}) });
const frSet = p => {
  try { localStorage.setItem(FR_KEY, JSON.stringify({ ...frLocal(), ...p })); } catch { /* private mode */ }
  const was = S.me?.prefs?.firstrun || {};
  if (S.me && Object.keys(p).some(k => !was[k])) DB.patchPrefs({ firstrun: { ...was, ...p } }).catch(() => { /* this browser still has it */ });
};
// The practice copy as this person (R-316 W7, L-13): last March, nothing saved. Their initials pick who they are there.
export const practiceHref = () => `staff6.html?demo=1${S.me?.initials ? `&as=${encodeURIComponent(S.me.initials)}` : ''}#/`;
export const practiceLink = () => DEMO ? '' : `<a class="st-practice" href="${esc(practiceHref())}" target="_blank" rel="noopener">${icon('history')}<span>Practice on last March (nothing reaches the team)</span>${icon('external-link', { cls: 'ext' })}</a>`;

// ---- the Capitol's words, in plain language (the glossary): terms.js holds them since R-316 W40, so a word on any screen
// opens the same meaning Help gives. With W40's gate on, Joint referral and Fiscal join them (allWords). ----
// R-316 W37 (M-13): Hawaiʻi's two-year Legislature. Said in Getting ready for a new session and at the end of each moment.
const CARRY = ['Bills from 2027 carry over to 2028', 'A Legislature sits for two years. A 2027 bill that did not advance carries over to 2028 with the same number, in the committee where it stopped, so it can still be heard: ask that chair early. A 2028 bill ends with that Legislature; in 2029 numbers start again at HB 1, and a bill has to be introduced again. (2026 is the second year of the 2025-26 Legislature, so its bills end this year.)'];
const STAGE_EXTRA = { vetoed: 'Vetoed by the Governor. The Legislature can override with two-thirds of each chamber.', dead: 'Missed a deadline, was deferred, or failed a vote. It can come back next session.' };

// ---- the guides. Each is { id, title, also? (more words search finds it by, R-277), icon, sub?(), items() -> [[term, html]] or html() } ----
const TOPICS = [
  { id: 'new', title: 'New here?', icon: 'sparkles', sub: () => { const st = newSteps(), n = st.filter(s => s.done).length; return `${n} of ${st.length} done`; }, html: () => newHTML() },
  { id: 'words', title: 'Capitol words', icon: 'book-open', sub: () => `Lateral, decking, sine die and ${allWords().length - 3} more`, items: () => allWords().map(([t, d]) => [t, esc(d)]) },
  { id: 'stages', title: 'Stages and deadlines', icon: 'calendar-days', sub: () => { const ld = legislativeDay(); return ld ? ld.text : 'Where a bill can be, and the date it races'; },
    items: () => STAGES.map(([k, l]) => [l, esc(glossStage(k) || STAGE_EXTRA[k] || '')]).filter(([, d]) => d) },
  { id: 'committees', title: 'Committee codes', icon: 'landmark', sub: () => `${Object.keys(S.committees || {}).length} committees and their chairs`,
    items: () => Object.values(S.committees || {}).sort((a, b) => (a.chamber || '').localeCompare(b.chamber || '') || a.code.localeCompare(b.code))
      .map(c => [c.code, `${esc(c.name)}. ${c.chamber === 'S' ? 'Senate' : 'House'}.${c.chair ? ` Chair ${esc(c.chair)}` : ''}${c.vice_chair ? `, vice chair ${esc(c.vice_chair)}` : ''}${c.chair ? '.' : ''}`]) },
  { id: 'testimony', title: 'How testimony works', icon: 'file-text', sub: () => 'Write, approve, second approval, file',
    items: () => { const adm = orList(names(a => a.is_admin || a.can_approve)) || 'an admin', rev = orList(names(a => a.is_reviewer)) || 'a second approver';
      return [['1. Write', 'A hearing notice arrives. Within a few minutes of the notice a draft Google Doc is made in Drive for the bill\'s owner (only for bills with a position other than Monitor). The owner, or a teammate who helps on its coalition, writes it and presses <b>Send for approval</b> (after a send-back, <b>Resubmit</b>, which a helper can press from Today too).'],
        ['2. Approve', `An admin or an approver (${esc(adm)}) presses <b>Approve</b>, or <b>Send back</b> with a note. An approver never approves testimony they sent; an admin may. Sent back, it goes to the writer with the note on their Today list, and they press <b>Resubmit</b>. If nobody has approved it 6 hours before the testimony deadline, a second approver (${esc(rev)}) can stand in, and Slack tells them so.`],
        ['3. Second approval', `The first testimony on a bill also needs a second approver (${esc(rev)}), someone other than whoever gave the first approval. Later testimony on the same bill skips this step.`],
        ['4. File', 'Whoever sent it for approval files it on the Capitol site (the owner, if nobody sent it; the steps are in <a href="#/help/file">How to file at the Capitol</a>) and presses <b>Mark filed</b>, with the confirmation link if there is one. Written testimony is usually due 24 hours before the hearing, 48 for a few committees; the hearing’s own deadline is on its card.'],
        ['Undo', 'Mark filed (later: <b>Undo filed</b>, beside Filed on the bill’s page and the hearing’s, and in the row’s <b>⋯</b> on Today), I\'m going, Not for us and removing a bill from a list can be undone for 10 seconds.'],
        ['A new version', 'If the bill changes (HD1, SD1) after the draft was written, Today asks the owner to check the draft against the new version.']]; } },
  { id: 'tabs', title: 'What each place is for', icon: 'list-todo', sub: () => 'Today, My issues, Bills, Legislators and Outreach',
    // Staff v3 (R-264): five places and nothing else in the sidebar; Review opens from Today's card, the Inbox is in your
    // menu, a bill has three tabs, This week is one view, and Outreach has two tabs.
    items: () => [['Today', 'Everything that needs you, grouped by when it is due: testimony steps, testimony to approve, replies, emails to approve and to-dos, one line each. On a laptop the one you pick opens in full beside the list, with all its buttons. Clear it and you are done. Testimony waiting for your approval opens in Review from its card. <b>Mine</b> is yours, and Today always opens on it; <b>Team</b> is everyone else’s work due this week, by person (for admins and second approvers it starts with <b>Slipping</b>: every step on the team that is late or due within a day), and its picker narrows it to one teammate or to <b>No owner</b>. <b>This week</b> shows the week’s hearings and deadlines. Hearings on bills we only monitor are folded away: <b>+N on bills you monitor</b> shows them again. If you help on a coalition, Today also shows its week, never in the count. Between sessions, Today shows how the session ended and <b>Getting ready for January</b> (see <a href="#/help/session">Getting ready for a new session</a>).'],
      ['Suggestions', 'Under <b>This week</b>, <b>Also worth doing</b> suggests work drawn from where each bill stands, and says why each one came up. Each has one button that does the step, and a <b>…</b> menu with <b>Done</b>, <b>Not now</b> (it comes back in two weeks) and <b>Not this bill</b>, each with Undo. Suggestions are never counted in the Today number.'],
      ['Giving a to-do', '<b>Give to…</b> on a to-do hands it to one teammate, who gets a Slack message. Its first choice is <b>You · Take it over</b>. Change your mind within two minutes, with Undo or by giving it back, and nobody is told.'],
      ['My issues', 'The issues you own or help on, each with its bills, soonest work first. Its tabs are three ways to group bills: <b>My issues</b>, <b>All issues</b> (every issue by category: rename, merge, put bills on issues; the first visit’s numbers are in its ⋯ menu) and <b>Coalitions</b> (each coalition’s week, and the switch <b>I help on</b> it).'],
      ['Bills', 'Every tracked bill, grouped by where it stands: <b>Mine</b> (bills you own or follow), <b>My coalitions</b> (when you help on one) or <b>Team</b>. Filter, select several to follow or change at once, or export a CSV; <b>Save this view</b> keeps a filter on the row of view chips. Sort new bills, Lists and Muted bills open from its ⋯ menu. A bill’s page has three tabs: <b>Overview</b> (where it stands, with its committees and where their members stand), <b>Activity</b> and <b>Public</b>.'],
      ['Legislators', 'Every senator and representative: district, the towns it covers, committees, how to reach them and where they stand on our bills. The filter box searches names, towns and districts, so “Kaūmana” or a street address finds the member. <b>This week</b> shows who hears our bills in the next 7 days.'],
      ['Outreach', 'Four tabs. <b>This week’s asks</b>: each bill’s public ask and deadline, to paste into the newsletter or a post (<b>My coalitions</b> first; <b>Team</b> shows everyone’s). <b>Partner update</b>: the memo for a coalition’s partners. <b>Emails</b>: supporter emails, each approved by someone other than its writer before it goes. <b>Supporters</b>: everyone HIPHI knows, with segments and to-dos (admins import or export a CSV from the ⋯ menu).'],
      ['QR code', 'A printable QR code for a partner’s link to the first visit: My issues, then All issues, its <b>⋯</b> menu, <b>First visit: numbers and links</b>, then Make a link (<a href="#/outreach/issues?view=links">open Make a link</a>). There is no QR code for a single hearing yet; share a hearing with its link.'],
      ['A quick look', 'On Bills, clicking a row opens the bill beside the list; <b>J</b> and <b>K</b> (or the arrow keys) walk the list and the bill beside it follows, <b>Enter</b> or <b>Open the bill</b> opens the bill’s own page, <b>Esc</b> closes it. On Today, <b>o</b> opens the same quick look'],
      ['Your menu', 'Tap your initials, top right, for the Inbox (messages and updates sent to you), and on a phone My settings, Session setup (admins) and Help. On a wide screen the sidebar holds the five places, with Help, Session setup and My settings at its foot; <b>Collapse</b> narrows it to icons.']] },
  // R-316 W29 (L-3): the everyday tasks staff asked Help about and found nothing, one line each, pointing at the button.
  { id: 'howto', title: 'How do I…', icon: 'circle-help', sub: () => 'Everyday tasks, one line each',
    items: () => [...(HOW_TO() ? [['Step by step', 'For the bigger jobs: <a href="#/help/hearing">Getting a bill a hearing</a> · <a href="#/help/talk">Logging a talk with a legislator</a> · <a href="#/help/file">How to file at the Capitol</a> · <a href="#/help/changes">When the Capitol changes the plan</a> · <a href="#/help/versions">House and Senate versions</a> · <a href="#/help/moments">What to do at each moment</a> · <a href="#/help/calendar">Session calendar</a>.']] : []),['Log a call or meeting with a legislator', `Open the legislator’s page (Legislators, or a name on a bill’s Committees) and press <b>Log a conversation</b>. A bill’s Activity tab has it too.${HOW_TO() ? ' Steps: <a href="#/help/talk">Logging a talk with a legislator</a>.' : ''}`],
      ['Say I’m going to a hearing', 'Press <b>I’m going</b> on the hearing: on Today, This week, the bill’s Next up or the hearing’s page. It can be undone for 10 seconds.'],
      ['Ask the chair for a hearing', `A bill with no hearing yet shows <b>Email the chair</b> on Today, This week and its page, with the day the hearing notice must post by. The email is written for you and opens in your own mail.${HOW_TO() ? ' Steps: <a href="#/help/hearing">Getting a bill a hearing</a>.' : ''}`],
      ['Hand a draft or a to-do to someone', '<b>Give to…</b> on a to-do hands it to a teammate, who gets a Slack message. Testimony stays with whoever sent it for approval: use <b>Message</b> on the row to ask a teammate to take a step.'],
      ['Send this week’s ask', 'Outreach, <b>This week’s asks</b>: each bill’s public ask and deadline, with <b>Copy for the newsletter</b> and <b>Copy for a post</b>.'],
      ['See what I owe today', 'Today, <b>Mine</b>: everything due today is under <b>Needs you today</b>, and the number beside Today in the menu counts it.']] },
  // R-316 W37 (practice copy, HOW_TO): short guides in the app's own words, each linked from the screen where its job
  // happens (H-14, S-5, L-4, G1-15, M-13, M-15). They say what the practice copy does today. The rallying and "working
  // against a bill" guides wait for the words Nate approves in W10 and W47.
  { id: 'hearing', gate: HOW_TO, title: 'Getting a bill a hearing', also: 'ask the chair hearing request schedule notice push', icon: 'megaphone', sub: () => 'When to ask, whom, how, and how to log it',
    items: () => [['1. When', 'As soon as the bill is referred, and before its notice-by date. A committee must post a hearing 48 hours ahead (72 for a bill’s first Senate committee), so the chair has to say yes before then. The bill’s <b>Next up</b> gives the last regular slot and the day the notice must post by; Bills and This week count it down (“Notice by Wed 3/25 · 8 days to ask”).'],
      ['2. Whom', 'The chair of the committee the bill is in now: Next up names the committee, and the bill’s Committees lists its chair first. A joint referral such as HHS/CPN has two chairs; ask both. The bill’s introducers can ask too: Committees marks the members who introduced it or its companion. Money committees (FIN, WAM) hear bills late, so ask their chairs early.'],
      ['3. How', 'Press <b>Email the chair</b> on the bill’s Next up, or use the deadline box on This week. It groups the bills with no hearing by chair, so one email asks about all of one chair’s bills. The email is written for you and opens in your own mail: read it, then send it. To hand the ask to a teammate, press <b>Give to…</b>; it becomes a to-do on their Today.'],
      ['4. Log it', 'After you send it, press <b>Mark asked</b> in the deadline box. It saves a conversation with the chair on each of those bills, so the team sees who asked and nobody asks twice. Asked by phone or in person? Open the chair’s page and press <b>Log a conversation</b> (<a href="#/help/talk">Logging a talk with a legislator</a>).'],
      ['5. Too late?', 'Once the notice time for the last regular slot has passed, Next up says so. Call the chair’s office: only the chair can still help.'],
      ['Bills HIPHI opposes', 'They get no hearing ask anywhere in the tracker: HIPHI never asks a chair to hear a bill it opposes.']] },
  { id: 'talk', gate: HOW_TO, title: 'Logging a talk with a legislator', also: 'log call meeting conversation visit talked', icon: 'message-square-plus', sub: () => 'A call, a meeting or a visit, kept where the team finds it',
    items: () => [['1. Open their page', 'Legislators, then their row (type a name, a town or a district), or a name on a bill’s Committees.'],
      ['2. Log a conversation', 'Press <b>Log a conversation</b>. A bill’s Activity tab has it too, already filed under that bill.'],
      ['3. Fill it in', '<b>Filed under</b>: the issue, and the bill if it was about one. <b>When</b>: the day. <b>What was said</b>: what they said, what they asked for, what we promised. Met several legislators at once? Add each one: it is one record on each of their pages.'],
      ['4. Where they stand', 'If they said how they will vote, set their stance beside their name on the bill’s Committees.'],
      ['Who sees it', 'The whole team: on the legislator’s page (and their Last contact on Legislators), on the issue’s page and on every bill of that issue. You can correct or delete your own entry for ten minutes.']] },
  { id: 'calendar', gate: HOW_TO, title: 'Session calendar', also: 'deadlines dates calendar days left lateral decking crossover', icon: 'calendar-clock', sub: () => { const g = sessionGates(S.bills).find(x => x.next); return g ? `Next: ${g.name}, ${mdDay(g.date)}` : 'Every deadline of the session'; },
    items: () => calendarItems() },
  { id: 'moments', gate: HOW_TO, title: 'What to do at each moment', also: 'session moments step by step when governor veto conference opening', icon: 'route', sub: () => 'From opening day to the Governor, one line each', items: () => momentItems() },
  { id: 'changes', gate: HOW_TO, title: 'When the Capitol changes the plan', also: 'moved cancelled rescheduled amended rewritten gut replace new version', icon: 'refresh-cw', sub: () => 'Moved, cancelled, already filed, amended, rewritten',
    items: () => [['The hearing moved', 'The draft follows the bill to the committee’s new sitting, and the hearing says <b>Moved from</b> the old day for three days. Check the new testimony deadline on its card, and that you are still marked <b>I’m going</b> if you are going.'],
      ['Cancelled, no new date', 'The hearing says “cancelled, no new date yet” and its countdown stops. Keep the draft: when the committee posts a new sitting, the draft moves to it.'],
      ['Already filed', 'Filed testimony belongs to the hearing it was filed for. If that hearing moved, read the new notice: unless it says earlier testimony still counts, file it again for the new date.'],
      ['The bill was amended', 'A new version (HD1 to HD2) means new words. Today asks the owner to check the draft against the new version before it is filed.'],
      ['The bill was rewritten', 'A committee can replace a bill’s whole text with something new (gut and replace): the number stays, the subject changes. Read the new version. If HIPHI’s position no longer fits, talk to the owner, who changes it on the bill’s page.']] },
  { id: 'versions', gate: HOW_TO, title: 'House and Senate versions', also: 'companion version hd1 sd1 cd1 twin house senate', icon: 'scale', sub: () => 'Companions, HD1 and SD1, and which one to push',
    items: () => [['Companions', 'Many bills have a companion: the same bill introduced in the other chamber, an HB and an SB. Each moves on its own, so if one stalls the other may still move. The bill’s page names its companion.'],
      ['HD1, SD1, CD1', 'Each time a committee changes a bill, its version goes up: HD1, HD2 in the House, SD1 in the Senate, CD1 in conference. Bills and the bill’s page show the version beside the number.'],
      ['Testimony', 'Write for the version the hearing is on; the notice says which. Today asks the owner to check a draft written for an older version.'],
      ['Which one to push', 'Ask for hearings on both while both can move. After crossover, only a bill that passed its first chamber can still pass.']] },
  { id: 'own', title: 'Owning and following', icon: 'user-check', sub: () => 'Who is asked to do what',
    items: () => [['Owner', 'Responsible for the bill. Drafts are made for the owner, and the testimony steps on Today are the owner\'s (or the writer\'s, or an approver\'s). One owner per bill.'],
      ['Following', 'Puts a bill in your Mine view and on your Today list, and gets you its chat messages. It never gives you a to-do. Anyone can follow anything.'],
      ['Muting', 'Takes a bill off your lists until its next hearing is posted. A bill with a hearing ahead cannot be muted.'],
      // Says what the select-many bar does (R-022, decision 9): the two used to disagree.
      ['Changing owners and positions', 'Anyone can change a bill’s owner or position: on its page, in a cell of the Bills table, or down the whole table with its Edit switch (a laptop). For many at once, tick them in Bills, then Set position or Set owner. Every change can be undone from the message that follows it. Follow and Unfollow work on many at once the same way. The priority follows the position: Strong support makes a bill P1, the team’s top tier, and every other position P2.'],
      ['Coalitions I help on', 'For helping with a coalition’s bills without owning them. Switch on <b>I help on</b> it on its page (My issues, then Coalitions); it says nothing about a position. <b>Show its work on my Today</b> then shows each one’s week (never in the count), Bills shows their bills under <b>My coalitions</b>, and Outreach’s Partner update starts on it.']] },
  { id: 'auto', title: 'What happens on its own', icon: 'rotate-ccw', sub: () => emailOff() ? 'Email is paused right now' : 'Email is on',
    items: () => { const burst = (S.syncCfg || {}).burst_until, hourly = burst && burst >= new Date().toISOString().slice(0, 10);
      return [['Bills', `Synced from the Legislature ${hourly ? `4 more times a day until ${esc(fmtDate(burst))} (8 in all), then 4 times a day` : '4 times a day'}. Stage, committee, last action and versions are never typed by hand.`],
        ['Hearings', 'Read from the Capitol\'s hearings page every 15 minutes and from its notice emails the moment they arrive. The draft, the calendar event and the Slack alert follow within minutes.'],
        ['Drafts', 'Made within a few minutes of the notice, for bills with a position other than Monitor, in Drive under Testimony, the year, the coalition and the bill.'],
        ['Video', 'Each hearing links to the chamber\'s YouTube channel, then to the exact video once it is posted. Staff can fix the link on the bill page.'],
        ['Deadlines', 'A bill still in committee when its deadline passes moves to Did not advance, with the deadline it missed.'],
        ['Email', emailOff() ? '<b>Paused.</b> Nobody gets email from the tracker right now: no supporter emails, staff alerts, digests or public hearing emails. Slack DMs still work.' : '<b>On.</b> Supporter emails, hearing emails to supporters, and alerts for staff who chose email are sent.']]; } },
  // The January panel on Today, and Session setup, point here (#/help/session). What changes, and what an admin checks.
  { id: 'session', title: 'Getting ready for a new session', icon: 'calendar-check', sub: () => 'What changes on opening day, and what admins check',
    items: () => [['When the calendar is in', 'Claude loads the new session’s calendar each December. From then every deadline and count follows the new session, and Today is your list again instead of how the last session ended.'],
      ['New bills', 'They arrive as they are introduced. <b>Sort new bills</b> asks for one decision on each: track it, with its coalition, owner, position and issue, or pass.'],
      ['Session setup (admins)', '<a href="#/setup">Ready for session?</a> lists what the tracker still needs, each with a way to fix it: opening day, sine die and recess days; 4 more syncs a day for the opening weeks; the session’s bills, under Import; and an owner, a Slack channel and keywords for every coalition.'], ...(HOW_TO() ? [CARRY] : [])] },
  // R-316 W16: the 2027 prep (due 6 Nov, prep.js) had no how-to, and no example of a good goal or good points, so the
  // teammates newest to the tracker would have asked in Slack. The issue's prep card links here.
  { id: 'prep', title: 'Getting your issues ready for 2027', icon: 'clipboard-list', sub: () => 'The six steps, with an example',
    items: () => [['Where', 'Between sessions <b>My issues</b> is your list of issues to get ready, with how far each one is. <b>Next</b> opens the first unfinished one; its card <b>Getting ready for 2027</b> is at the top of the issue’s page. Each step opens with <b>Do it</b>, and <b>Change</b> once it is done.'],
      ['1. Name and description', 'Check that the name is a policy people recognize, in everyday words, and that the one sentence says what would change. The public sees both. <b>Looks right</b> if nothing needs changing.'],
      ['2. Between sessions', 'What the public reads under the issue until January. Claude drafted the first ones from the bills’ records; add HIPHI’s plans if you like.'],
      ['3. HIPHI’s goal for 2027', 'One or two sentences on what we want to win this session. Staff only. For example (the shape, not a real HIPHI goal): <i>“Get a bill that funds sidewalks and crosswalks near schools heard in both money committees, and passed out of the House.”</i>'],
      ['4. Talking points', 'Three to five plain sentences people tap into a letter sent in their own name, so each must be true and stand on its own: no numbers you cannot point to. For example (the shape, not real points): <i>“Keiki should be able to walk to school safely.”</i> · <i>“Sidewalks and crosswalks near schools make walking and biking safer.”</i> · <i>“This bill pays for them where schools need them most.”</i>'],
      ['5. Top issue for 2027?', 'Yes puts it forward. Once an admin confirms it, people visiting the tracker for the first time find it already ticked when they pick its category. Nothing on the public page says it was picked.'],
      ['6. Keep, merge or retire', '<b>Keep</b> it as it is; <b>Merge</b> its bills and followers into another issue; or <b>Retire</b> it, so the public stops seeing it and its followers stop getting its bills. Nothing changes until an admin approves.'],
      ['Mark ready', 'With all six done, <b>Mark ready</b> sends it to an admin (<b>Mark ready and open the next</b> takes you straight to your next one). The admin approves it or sends it back with a note, which you see on Today and on the issue; fix that step and mark it ready again. Helpers can fill in any step; only the owner marks it ready.']] },
  { id: 'public', title: 'The public page and lists', icon: 'globe', sub: () => 'What visitors see, and how to share it',
    items: () => [['What shows', 'Only bills set to show on the public page, with the plain summary and the ask from the bill\'s Public tab. Visitors follow issues (or a bill, or a list) and get a five-minute way to testify.'],
      ['Lists', 'A list is a set of public bills. Following a list follows every bill on it, including ones added later.'],
      ['Supporters', 'People who say yes at sign-up to hearing emails, and to HIPHI seeing what they follow, appear under Outreach, then Supporters. Everyone else\'s follows are counts only.'],
      ['Links', `A staff link to a bill looks like ${esc(APP_URL)}#bill=HB1563 and opens in either app. A public link to a list looks like ${esc(PUBLIC_APP())}#list=keiki-health.`],
      ['On hiphi.org', 'Session setup, then Website embed, has the code to put the tracker on any web page.']] },
  { id: 'where', title: 'Drive, Slack and the calendar', icon: 'map-pin', sub: () => 'Where drafts, alerts, hearings and video are kept, outside the app',
    items: () => [['Drafts', 'Google Drive, in Testimony, then the year, the coalition and the bill.'], ['Alerts', `Slack ${esc((S.slackCfg || {}).main_channel || '#hearing-alerts')} and each coalition's channel. Your own steps come as DMs or email (My settings).`],
      ['Calendar', 'The HIPHI Hearings Google Calendar.'], ['Video', 'The Senate and House YouTube channels.'], ['Questions', HOW_TO() ? `Search Help first, or open <a href="#/help/howto">How do I…</a>. Nothing there? A search that finds nothing offers <b>Ask in Slack</b> with your words; or ask ${esc(orList(names(a => a.is_admin)) || 'an admin')}.` : `Ask ${esc(orList(names(a => a.is_admin)) || 'an admin')}.`]] },
  // R-277 fix 9: the steps nobody could find (Patti, the review's task walk). The Capitol's own words, as the public
  // helper uses them (pub/helper.js, PAR "How to Submit Testimony"), for HIPHI filing as an organization.
  { id: 'file', title: 'How to file at the Capitol', also: 'file filing submit testimony', icon: 'landmark', sub: () => 'Six steps on the Capitol website, then Mark filed',
    items: () => [['1. Save it as a PDF', 'In the approved Google Doc: File, Download, PDF.'],
      ['2. Open the bill', 'On the bill’s page or in the Mark filed sheet, press <b>File at the Capitol</b>. It opens the bill on the Capitol website.'],
      ['3. Log in', 'Log in to the Capitol website. No account yet? Making one is free; they email a link to confirm. It logs you out after 60 minutes.'],
      ['4. Pick the hearing', 'Choose <b>Submit Testimony</b> and pick the hearing it is for.'],
      ['5. Fill in the form', HOW_TO() ? 'Your position (Support, Oppose or Comments), <b>Organization</b>, and the name the testimony is signed with: HIPHI, or the coalition when the letter speaks for the coalition (74 of 233 filings in 2026 went in a coalition’s name). Not sure which? Ask the bill’s owner. Then <b>Written testimony only</b> unless someone is going to speak. Upload the PDF and submit.'
        : 'Your position (Support, Oppose or Comments), <b>Organization</b> and HIPHI’s name, and <b>Written testimony only</b> unless someone is going to speak. Upload the PDF and submit.'],
      ['6. Look for the green box', 'It means it worked, and a confirmation email follows. Back in the tracker, press <b>Mark filed</b> and paste the confirmation link if you have it. Pressed it by mistake? <b>Undo filed</b> is beside Filed on the bill’s page.'],
      ['Late', 'Past the written deadline the Capitol still takes testimony until the hearing starts, marked late. The tracker says “late testimony until” that time.'],
      ['Stuck?', 'The Public Access Room helps for free: (808) 587-0478.']] },
  // R-277 fix 9 (E-2): what reaches staff today, said honestly; the alerts themselves are unchanged (D3 is held).
  { id: 'pings', title: 'Which alerts you get', also: 'pings notifications reminders nudges mute quiet', icon: 'bell', sub: () => 'Slack, email and the calendar, and how to quiet them',
    items: () => { const ch = esc((S.slackCfg || {}).main_channel || '#hearing-alerts'), d = (S.slackCfg || {}).daily || {};
      return [['In the app', 'Today lists everything that needs you, whatever you choose in My settings. The Inbox (your initials menu) keeps what was sent to you.'],
        ['Slack DMs', 'Testimony steps for you (a new draft on your bill, testimony waiting for your approval, yours approved, sent back or filed) and messages on bills you own, follow or joined. If you own bills, also deadline alerts: the morning testimony is due, shortly before, and after the deadline if it is not filed. If you own no bills, those deadline alerts go to each bill’s owner, not to you.'],
        ['Email instead', 'In My settings you can pick Email: testimony steps come by email, and deadline alerts stop, since they come only by Slack.' + (emailOff() ? ' Email is paused by an admin right now, so these are held.' : '')],
        ['Channels', `New hearings post to ${ch} and to each coalition’s channel${d.enabled !== false ? `, and a daily list of hearings posts there at ${esc(String(d.time || '07:00').replace(/^0/, ''))}` : ''}. Channel posts are not DMs; Slack’s own settings mute a channel.`],
        ['Calendar', 'Each hearing becomes an event on the HIPHI Hearings Google Calendar.'],
        ['Quieter', 'My settings: <b>Fine-tune what you are told, and when</b> switches each kind off, or pick <b>Only in the app</b> for no alerts except approval stand-ins and steps passed to you. There is no daily summary or quiet hours yet.']]; } },
  { id: 'keys', title: 'Keyboard shortcuts', icon: 'keyboard', hover: true, sub: () => 'For a keyboard and mouse',
    items: () => [['/', 'Search'], ['g then t, m, b, l, o, r or i', 'Go to Today, My issues, Bills, Legislators, Outreach, Review or the Inbox'], ['j and k', 'Today: next and previous item (the arrow keys too, once in the list). Bills, Legislators and the Inbox: next and previous row'], ['Enter', 'Today: do the open row\'s step. Bills: open the bill'], ['o', 'Today: a quick look at the bill. Bills: open the bill'], ['x', 'Bills: tick the row'], ['Space', 'Bills: a quick look at the marked row'],
      ['Shift+A', 'Review: approve (it takes Shift so a stray letter never approves)'], ['Shift+M', 'Inbox: mark the list read'], ['e', 'Inbox: mark the row read or unread'], ['r, o', 'Review: send back, open the Doc'], ['Right arrow', 'Review: skip to the next draft'], ['1 to 3', 'Bill: Overview, Activity, Public'], ['[ and ]', 'Bill: previous and next bill'],
      ['t, n, l, u', 'Sort new bills: track, not for us, later, undo (u again undoes the one before)'], ['Arrow keys', 'In a menu or a picker: move; Enter chooses'], ['?', 'Open this list'], ['Esc', 'Close a sheet, or go back'], ['While typing', 'Shortcuts are off while you type in a field.'], ['Switch them off', 'The switch at the top of this list turns every shortcut off on this device.']] },
];
// ---- W37 (H-14): the session calendar, every deadline, read from the loaded calendar (model.js sessionGates) ----
// "Mon 3/30", the way a deadline's day is said (C-15).
const mdDay = d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');
const inDays = n => n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
const nBills = n => `${n} ${n === 1 ? 'bill' : 'bills'}`;
function calendarItems() {
  const mine = S.me ? S.bills.filter(isMine) : [], kOf = g => `${g.label}|${g.date}`;
  const my = new Map(sessionGates(mine).map(g => [kOf(g), g])), team = sessionGates(S.bills);
  if (!team.length) return [['No calendar yet', 'The session’s deadlines are loaded each December.']];
  const head = ['How to read it', `Each deadline with its day, what a bill must do by then, and how many bills race it: yours (bills you own or follow) and the team’s. A bill races the next deadline it has to meet. ${legislativeDay()?.text ? `Today is ${esc(legislativeDay().text)}.` : ''} The deadlines coming up also lead This week, with the bills that still need a hearing (<a href="#/help/hearing">Getting a bill a hearing</a>).`];
  return [head, ...team.map(g => {
    const m = my.get(kOf(g)), w = gateGloss(g.label), ld = legislativeDay(new Date(g.date + 'T12:00:00-10:00').getTime());
    const what = w ? `${w[0].toUpperCase()}${w.slice(1)}.` : '';
    const when = g.past ? 'Over.' : `<b>${g.next ? `Next: ${inDays(g.days).toLowerCase()}` : inDays(g.days)}</b>${ld && ld.today ? ` · legislative day ${ld.day} of ${ld.of}` : ''}.`;   // "Over", not "Passed", which reads as a bill passing (ui-critic)
    const race = g.past ? (g.stopped ? ` ${g.stopped} of the team’s ${g.stopped === 1 ? 'bill' : 'bills'} did not advance at it.` : '')
      : ` ${m && m.racing.length ? `${nBills(m.racing.length)} of yours race it${m.noHearing.length ? `, ${m.noHearing.length} with no hearing yet` : ''}` : 'None of your bills race it'}; ${g.racing.length} on the team${g.noHearing.length ? ` (${g.noHearing.length} with no hearing yet)` : ''}.`;
    // The House and the Senate can each have their own day for one deadline (Triple filing 2/11 and 2/12): say whose.
    const ch = team.filter(x => x.name === g.name).length > 1 ? (DEADLINE_ROWS || []).find(r => r.label === g.label && String(r.deadline_date).slice(0, 10) === g.date)?.chamber : '';
    return [`${g.name}${ch ? ` (${ch === 'S' ? 'Senate' : 'House'})` : ''} · ${mdDay(g.date)}`, `${what} ${when}${race}${g.bills ? ` Only for ${esc(g.bills.join(' and '))}.` : ''}`.trim()];
  })];
}
// ---- W37 (M-15): what to do at each moment, one line per moment and per role, with this session's dates ----
function momentItems() {
  const cal = deadlineCalendar(), at = (phase, rx) => { const g = cal.find(x => x.phase === phase && (!rx || rx.test(x.label))); return g ? mdDay(g.date) : ''; };
  const by = (w, d) => d ? `${w} ${d}` : w;
  return [
    ['Before opening day', 'Owners: get your issues ready (<a href="#/help/prep">Getting your issues ready</a>). Admins: Session setup’s <b>Ready for session?</b>. Everyone: choose how the tracker reaches you (My settings).'],
    [by('Opening weeks, to Intro cutoff', at('introduced')), 'New bills arrive every day. <b>Sort new bills</b> asks for one decision on each: track it, with its coalition, owner, position and issue, or pass. Owners: check each of your issues has a bill.'],
    [by('To the first lateral', at('first_lateral')), 'The big push for hearings. Owners: ask each chair before the notice time (<a href="#/help/hearing">Getting a bill a hearing</a>). Writers: a draft appears within minutes of each notice; <b>Send for approval</b> 12 hours before testimony is due, and file by 2 hours before.'],
    [by('To first decking', at('first_decking')), 'Bills must clear their last committee, often the money committee (FIN in the House, WAM in the Senate). Owners: ask the money committee’s chair early.'],
    [by('Crossover', at('first_crossover')), 'Floor votes in the first chamber; there is no testimony on a floor vote. A bill that passes moves to the other chamber, with new committees and new chairs: owners, read its Next up and ask the new chair early.'],
    [by('To second lateral and decking', [at('second_lateral'), at('second_decking')].filter(Boolean).join(' and ')), 'The same push in the second chamber, with less time. Writers: a bill that changed (HD1 to SD1) needs its testimony checked against the new version (<a href="#/help/versions">House and Senate versions</a>).'],
    [by('Cross back', at('second_crossover')), 'The first chamber agrees to the other chamber’s changes, or disagrees, which sends the bill to conference.'],
    [by('Conference, to Final decking', [at('conference', /final/i), at('conference', /fiscal/i) && `Fiscal ${at('conference', /fiscal/i)}`].filter(Boolean).join(' and ')), 'House and Senate negotiators settle one version (CD1). There is no hearing to testify at: the conference chairs decide. Owners: know who they are for each of your bills.'],
    [by('Sine die', at('governor', /sine/i)), 'The session’s last day. A bill not settled by then did not advance this year.'],
    ['After sine die: the Governor', 'The Governor has 45 days after sine die to sign or veto, and must name by the 35th day the bills that may be vetoed (the intent-to-veto list). A bill neither signed nor vetoed becomes law. Owners: thank the members who helped.'],
    ['Between sessions', 'Today shows how the session ended. Get your issues ready for next year, and read <a href="#/help/session">Getting ready for a new session</a>.'],
    CARRY,
  ];
}
const topic = id => TOPICS.find(t => t.id === id && (!t.gate || t.gate()));
// R-277 fix 9: someone who has not done New here?'s four steps meets it first; everyone else lands on Capitol words.
const isNew = () => { const st = newSteps(); return st.some(x => !x.done); };
// W37 (L-4): once New here? is done, Help opens on How do I…, the jobs, with the guides on.
const homeTopic = () => topic(isNew() ? 'new' : HOW_TO() ? 'howto' : 'words');
const visible = () => TOPICS.filter(t => (!t.hover || HOVER()) && (!t.gate || t.gate()));

// ---- New here?: four things a new teammate does once. One ticks itself; the others tick when you go do them.
// v4 (R-269, T9): "Read Owning and following" went (P-4: reading is not a step). Someone who owns no bills and supports a
// coalition (Patti, Saya, Julie) is not asked to follow three bills, which for Patti only added a folded "Waiting on
// others" line: their step is their coalition's testimony this week, on This week.
const coalWord = me => { const c = me?.prefs?.coalitions;
  if (c === 'all') return 'your coalitions’';
  const ns = Array.isArray(c) ? c.map(id => (S.campaigns || []).find(x => x.id === id)?.name).filter(Boolean) : [];
  return ns.length === 1 ? `${ns[0]}’s` : ns.length ? 'your coalitions’' : ''; };
// R-316 W39 (Show me, practice copy): one step teaches the person's real job, and it ticks when the job is done, not when
// its link is clicked: approving for an approver (Kris), revising and pressing Resubmit for a coalition helper whose
// coalition has a draft sent back (Patti), asking a chair for a helper (Julie). "Read Next up" opens a bill, not Bills.
const TEACH_JOB = () => true;   // Nate's go 10/22 (R-331)
const coalIds = me => { const c = me?.prefs?.coalitions; return c === 'all' ? null : new Set(Array.isArray(c) ? c : []); };
function jobStep(me, ownsNone) {
  const drafts = Object.values(S.drafts || {}).flat(), inCo = b => { const ids = coalIds(me); return !ids || (S.billCampaigns?.[b] || []).some(x => ids.has(x)); };
  if (me.can_approve || (me.is_admin && ownsNone)) return { k: 'job', done: drafts.some(d => d.approved_by === me.id || d.second_approved_by === me.id), title: 'Approve a testimony draft', sub: 'Review opens each draft waiting for you: Approve, or Send back with a note', href: '#/review' };
  if (!ownsNone) return null;
  if (drafts.some(d => d.review_note && d.status === 'draft' && inCo(d.bill_id))) return { k: 'job', done: drafts.some(d => d.submitted_by === me.id), title: 'Revise a draft that was sent back, then press Resubmit', sub: 'Today shows your coalition’s drafts sent back, with the note and the Doc', href: '#/' };
  const asked = [...(S.demoNotes || []), ...Object.values(S.legNotes || {}).flat()].some(n => n.advocate_id === me.id && /^Asked for a hearing/.test(n.body || ''));
  return { k: 'job', done: asked, title: 'Ask a chair for a hearing', sub: 'Your coalition’s week lists its chair asks: I’ll ask, then the email', href: '#/' };
}
const firstBillHref = me => { const ids = coalIds(me), b = S.bills.find(x => (S.assignments[x.id] || []).includes(me.id)) || S.bills.find(x => x.position && x.position !== 'monitor' && (!ids || (S.billCampaigns?.[x.id] || []).some(c => ids.has(c))));
  return b ? `#/bill/${encodeURIComponent(b.bill_number)}` : '#/bills'; };
function newSteps() {
  const o = frGet(), me = S.me;
  const mine = me ? S.bills.filter(b => (S.assignments[b.id] || []).includes(me.id) || S.follows?.has(b.id)).length : 0;
  const ownsNone = !!me && !S.bills.some(b => (S.assignments[b.id] || []).includes(me.id)), co = ownsNone ? coalWord(me) : '';
  // R-316 W7 (FR-3): someone who owns no bill, follows none and helps on no coalition starts by picking their coalition.
  const lost = ownsNone && !co && !mine;
  return [
    { k: 'settings', done: !!o.settings, title: 'Choose how the tracker reaches you', sub: 'Slack DM, email, or only in the app', href: '#/me' },
    lost ? { k: 'coal', done: false, title: 'Pick the coalition you help on', sub: 'My issues lists each coalition with its I help on switch', href: '#/my-issues' }
    : co ? { k: 'week', done: !!o.week, title: `See ${co} testimony this week`, sub: 'This week shows each hearing, where its testimony stands and when it is due', href: '#/?view=week' }
      : { k: 'follow', done: mine >= 3, title: `Follow three bills you care about${mine && mine < 3 ? `, ${mine} of 3` : ''}`, sub: 'Open a bill, then Follow in its menu. Bills you own count.', href: '#/bills' },
    ...(TEACH_JOB() && me ? [jobStep(me, ownsNone)].filter(Boolean) : []),
    { k: 'bill', done: !!o.bill, title: 'Open a bill and read its Next up card', sub: 'It says what the bill needs and by when', href: TEACH_JOB() && me ? firstBillHref(me) : '#/bills' },
    { k: 'today', done: !!o.today, title: 'Clear your Today list', sub: 'Each card has one button that does the step', href: '#/' },
  ];
}
function newHTML() {
  const steps = newSteps(), n = steps.filter(s => s.done).length;
  return `<p class="st-sum"><span class="st-meter" aria-hidden="true"><i style="width:${Math.round(n / steps.length * 100)}%"></i></span><span>${n} of ${steps.length} done</span></p>
    <div class="rows">${steps.map(s => `<a class="row st-newrow${s.done ? ' done' : ''}" href="${s.href}" data-fr="${s.k}"><span class="st-ric">${icon(s.done ? 'circle-check' : 'circle-dashed')}<span class="sr">${s.done ? 'Done:' : 'To-do:'}</span></span><span class="body"><span class="title">${esc(s.title)}</span><span class="sub">${esc(s.sub)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`).join('')}</div>
    ${practiceLink()}`;
}

// ---- search: every entry of every guide, plus the guide titles ----
// R-277 fix 9 (F-9): word by word. It matched the whole phrase, so "file testimony" and "how do I file" found nothing.
// Each word that carries meaning has to appear (or one of its other words, SYN) somewhere in the entry or its guide's
// title; small words ("how", "do", "I") are dropped. The best entries come first: a word in the term beats one in the text.
const STOP = new Set(['a', 'an', 'and', 'are', 'at', 'can', 'do', 'does', 'for', 'get', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your', 'turn', 'off', 'im', 'am', 'say', 'this', 'someone', 'one']);
// Other words people use for the same thing. Each row is one meaning; a word in a row finds every word in it.
// R-316 W29 (L-3, L-15): the everyday words of the twelve questions staff ask, shared with the top search box (search.js).
export const SYN = [
  ['going', 'go', 'attend', 'attending', 'goer'],
  ['chair', 'chairs', 'hearing request', 'ask the chair', 'schedule', 'notice'],
  ['log', 'call', 'conversation', 'conversations', 'meeting', 'talked'],
  ['stance', 'stances', 'where they stand'],
  ['owe', 'today', 'needs you', 'due today'],
  ['hand', 'give', 'give to', 'take over', 'pass on', 'hand over'],
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
];
// A word finds its own row only ("sign" no longer reads as "sign off").
export const synOf = w => { const row = SYN.find(r => r.includes(w)); return row ? [w, ...row] : [w]; };
// A short word ("dm", "qr", "due") must stand alone ("dm" is not in "admins"); a longer one must start a word (R-316
// W29: "ready" no longer matches "already"; "file" still finds "filing" through SYN).
const rx = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const whole = (hay, x) => new RegExp(`(^|[^a-z0-9])${rx(x)}($|[^a-z0-9])`).test(hay);
const has = (hay, x) => x.length <= 3 ? whole(hay, x) : new RegExp(`(^|[^a-z0-9])${rx(x)}`).test(hay);
// Entries hold HTML (escaped once already); results show plain text, escaped once (L-14: "&amp;" on 34 rows).
const unent = s => String(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const wordsOf = q => plain(q).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
function results(q) {
  const ws = wordsOf(q); if (!ws.length) return q.trim() ? `<p class="st-none" role="status">Type a word, such as “file” or “alerts”.</p>` : '';
  const alts = ws.map(synOf), hits = [], near = [], keyW = ws.reduce((k, w, i) => w.length > ws[k].length ? i : k, 0);
  for (const t of visible()) {
    // R-277 ui-critic: a guide whose own title (or other words) has every word comes first, above its own entries:
    // "how do I file" opens on How to file at the Capitol, not on step 3 of it.
    const th = plain(`${t.title} ${t.also || ''}`);
    if (t.items && alts.every(a => a.some(x => has(th, x)))) hits.push({ t, term: t.title, def: '', score: 100 + alts.reduce((n, a) => n + (whole(th, a[0]) ? 2 : 1), 0) });
    const entries = t.items ? t.items() : [[t.title, '']];
    for (const [term0, def] of entries) {
      if (term0 === 'Step by step') continue;   // W37: How do I…'s list of links to the guides; the guides are found themselves
      const term = unent(term0), txt = unent(def), hay = plain(`${t.title} ${t.also || ''} ${term} ${txt}`), head = plain(`${t.title} ${t.also || ''} ${term}`);
      const got = alts.filter(a => a.some(x => has(hay, x))).length;
      // A near answer must hold the query's longest word ("legislator" in "log a call with a legislator"), so "Log in" is not offered.
      if (got < alts.length) { if (got && got >= alts.length / 2 && alts[keyW].some(x => has(hay, x))) near.push({ t, term, def: t.items ? txt : '', score: got * 10 + (alts.some(a => has(plain(`${t.title} ${term}`), a[0])) ? 1 : 0) }); continue; }
      // the typed word itself in the guide's title or the entry's name ranks first, one of its other words there next,
      // part of a word there after that, then the text; a guide whose own title has the word gets one more
      const tt = plain(`${t.title} ${t.also || ''}`), score = alts.reduce((n, a) => n + (whole(head, a[0]) ? 4 : a.some(x => whole(head, x)) ? 3 : a.some(x => has(head, x)) ? 2 : 1) + (whole(tt, a[0]) ? 1 : 0), 0);
      hits.push({ t, term, def: t.items ? txt : '', score });
    }
  }
  // R-316 W29 (L-3): when nothing has every word, the entries with most of them, under a plain label.
  if (!hits.length && near.length) { near.sort((x, y) => y.score - x.score);
    return `<p class="st-none" role="status">Nothing in Help has every word of “${esc(q.trim())}”. Closest answers:</p><div class="rows">${near.slice(0, 6).map(h => row({ title: esc(h.term), sub: `${esc(h.def.length > 140 ? h.def.slice(0, 139).replace(/\s\S*$/, '') + '…' : h.def)}${h.def ? ' · ' : ''}${esc(h.t.title)}`, href: `#/help/${h.t.id}` })).join('')}</div>${HOW_TO() ? askSlack(q) : ''}`; }
  if (!hits.length) return HOW_TO() ? missHTML(q) : `<p class="st-none" role="status">Nothing in Help mentions "${esc(q.trim())}". Try another word.</p>`;
  hits.sort((x, y) => y.score - x.score);
  const shown = hits.slice(0, 40);
  return `<p class="sr" role="status">${hits.length} found</p><div class="rows">${shown.map(h => row({ title: esc(h.term), sub: `${esc(h.def.length > 140 ? h.def.slice(0, 139).replace(/\s\S*$/, '') + '…' : h.def)}${h.def ? ' · ' : ''}${esc(h.t.title)}`, href: `#/help/${h.t.id}` })).join('')}</div>${hits.length > 40 ? `<p class="small muted st-note">Showing 40 of ${hits.length}. Add a word to narrow it down.</p>` : ''}`;
}
// R-316 W37 (L-16, S-5): a search that finds nothing offers the guides, then Ask in Slack with the words filled in and
// "(from Help)" after them, so the question reaches the team and Nate can count what Help missed. A Slack link cannot
// carry a message, so the button copies the words and opens the channel; nothing is sent until the person sends it.
const GUIDES = ['howto', 'hearing', 'talk', 'changes', 'calendar', 'moments'];
// Help's first page lists these first (W37), the jobs before the reference.
const HOWTO_IDS = ['howto', 'hearing', 'talk', 'file', 'changes', 'versions', 'moments', 'calendar'];
const slackChannel = () => String((S.slackCfg || {}).help_channel || (S.slackCfg || {}).main_channel || '#hearing-alerts').replace(/^#/, '');
// Nate 10/22: the question goes to him, "just a dm to me". His Slack account is linked the first time the tracker messages
// him (advocates.slack_user_id); until then it falls back to the channel. Slack's app_redirect opens a DM from a user id.
const nateSlack = () => (S.advocates || []).find(a => a.initials === 'NT' && a.slack_user_id) || null;
const askSlack = q => { const words = `${q.trim()} (from Help)`, n = nateSlack(), ch = n ? n.slack_user_id : slackChannel(), to = n ? (n.id === S.me?.id ? 'your own Slack messages' : 'a Slack message to Nate') : `Slack’s #${ch}`;
  return `<div class="st-ask"><p class="small muted">Still stuck? Ask ${n && n.id !== S.me?.id ? 'Nate' : 'the team'}. This copies your words and opens ${esc(to)}; paste them there and send.</p>
    ${btn('Ask in Slack', { kind: 'secondary', sm: true, icon: 'message-circle', iconEnd: 'external-link', href: `https://slack.com/app_redirect?channel=${encodeURIComponent(ch)}`, target: '_blank', attrs: { 'data-askslack': words } })}
    <p class="small muted st-askw">“${esc(words)}”</p></div>`; };
const missHTML = q => `<p class="st-none" role="status">Nothing in Help mentions “${esc(q.trim())}”. Try another word, or one of these guides:</p>
  <div class="rows">${GUIDES.map(topic).filter(Boolean).map(t => row({ lead: t.icon, title: esc(t.title), sub: esc(t.sub()), href: '#/help/' + t.id })).join('')}</div>${askSlack(q)}`;
const dl = (items, mark = '') => `<dl class="st-dl">${items.map(([t, d]) => { const on = mark && t.toLowerCase() === mark.toLowerCase();
  return `<div class="st-dli"${on ? ' id="st-wmark" tabindex="-1"' : ''}><dt>${on ? `<mark>${esc(t)}</mark>` : esc(t)}</dt><dd>${d}</dd></div>`; }).join('')}</dl>`;
// R-316 W29 (L-15): the top search opens a Capitol word here (#/help/words?w=Sine die). The word is marked and scrolled
// to once per visit (a flag on that history entry), so a redraw while reading does not jump back to it.
const markOf = route => route.topic === 'words' && route.q?.w ? String(route.q.w) : '';
const freshMark = route => !!markOf(route) && !history.state?.wmark;

function renderIndex() {
  const q = S.st2HelpQ || '';
  // The four words staff ask about most (the deadlines that kill bills); the rest are one tap away.
  const first = ['Legislative day', 'Lateral', 'Decking', 'Crossover'].map(k => WORDS.find(w => w[0] === k)).map(([t, d]) => [t, esc(d)]);
  return `<div class="st-page st-help">
    <div class="st-head"><h1 class="st-dup">Help</h1></div>
    <form class="st-search searchbox" role="search" data-hsform><label class="sr" for="st-hq">Search Help</label>${icon('search')}<input id="st-hq" class="input" type="search" placeholder="Search Help: a word, a tab, a stage" autocomplete="off" value="${esc(q)}"></form>
    <div id="st-hres" aria-live="polite">${results(q)}</div>
    <div id="st-hdefault" ${q.trim() ? 'hidden' : ''}>
      ${isNew() ? `<section class="st-sec" aria-labelledby="st-hn"><div class="st-sechead"><h2 id="st-hn">New here?</h2></div>${newHTML()}</section>` : ''}
      ${HOW_TO() ? `<section class="st-sec" aria-labelledby="st-hh">
        <h2 id="st-hh">How-to guides</h2>
        <div class="rows">${HOWTO_IDS.map(topic).filter(Boolean).map(t => row({ lead: t.icon, title: esc(t.title), sub: esc(t.sub()), href: '#/help/' + t.id })).join('')}</div>
      </section>` : ''}
      <section class="st-sec" aria-labelledby="st-hw">
        <div class="st-sechead"><h2 id="st-hw">Capitol words</h2>${btn(`All ${allWords().length}`, { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/help/words', attrs: { 'aria-label': `All ${allWords().length} Capitol words` } })}</div>
        <div class="card st-wcard">${dl(first)}</div>
        <div class="btnrow st-acts">${btn('Stages and deadlines', { kind: 'text', sm: true, icon: 'calendar-days', href: '#/help/stages' })}${btn('Committee codes', { kind: 'text', sm: true, icon: 'landmark', href: '#/help/committees' })}</div>
      </section>
      <section class="st-sec" aria-labelledby="st-hg">
        <h2 id="st-hg">${HOW_TO() ? 'More guides' : 'Guides'}</h2>
        <div class="rows">${visible().filter(t => !['words', 'stages', 'committees', ...(isNew() ? ['new'] : []), ...(HOW_TO() ? HOWTO_IDS : [])].includes(t.id)).map(t => row({ lead: t.icon, title: esc(t.title), sub: esc(t.sub()), href: '#/help/' + t.id })).join('')}</div>
      </section>
    </div>
  </div>`;
}
// Keyboard shortcuts carries its own on-off switch (v3; it was in My settings), kept on this device (ui.js setKeys).
const keysNote = t => t.id !== 'keys' ? '' : `${HOVER() ? '' : `<p class="small muted st-note">${icon('info')} These need a keyboard. They are off on touch screens.</p>`}
  <div class="card st-list st-keyson">${switchRow('st-keyson', 'Use keyboard shortcuts', keysOn(), 'Off means a stray letter never does anything. Approving always takes Shift+A. Kept on this device.', { 'data-keys': '1' })}</div>`;
function renderTopic(t, route) {
  const body = t.html ? t.html() : `<div class="card st-wcard">${dl(t.items(), markOf(route))}</div>`;
  const kbd = keysNote(t);
  return `<div class="st-page st-help st-subpage">
    <a class="st-crumb" href="#/help" data-back>${icon('arrow-left')}<span>Help</span></a>
    <div class="st-head"><h1>${esc(t.title)}</h1></div>${kbd}${body}
  </div>`;
}

// W37: with the guides on, the left column is in two labelled groups, the jobs first, then the reference.
const navItem = (x, t, q) => `<a class="st-navi" href="#/help/${x.id}"${x.id === t.id && !q.trim() ? ' aria-current="page"' : ''}>${icon(x.icon)}<span class="st-navl">${esc(x.title)}</span></a>`;
function navList(list, t, q) {
  if (!HOW_TO()) return list.map(x => navItem(x, t, q)).join('');
  const how = HOWTO_IDS.map(id => list.find(x => x.id === id)).filter(Boolean), lead = list.filter(x => x.id === 'new'), rest = list.filter(x => !how.includes(x) && !lead.includes(x));
  return `${lead.map(x => navItem(x, t, q)).join('')}<p class="st-navh" aria-hidden="true">How to</p>${how.map(x => navItem(x, t, q)).join('')}<p class="st-navh" aria-hidden="true">Reference</p>${rest.map(x => navItem(x, t, q)).join('')}`;
}
// Desktop: search and topics on the left (they stay in view), the topic on the right. One h1: the topic's title,
// or "Search results" while the box has words in it.
function renderDesk(route) {
  // R-316 W29 (L-14): a link from elsewhere to a Help topic opens that topic, not an old search's results.
  if (route.topic && S.st2HelpTopic !== route.topic || freshMark(route)) { S.st2HelpQ = ''; S.st2HelpTopic = route.topic; }
  const q = S.st2HelpQ || '', t = topic(route.topic) || homeTopic();
  const body = t.html ? t.html() : `<div class="card st-wcard">${dl(t.items(), markOf(route))}</div>`;
  const kbd = keysNote(t);
  const list = visible(); if (!list.includes(t)) list.push(t);   // a direct link to a topic this device does not list still shows where you are
  // R-277 fix 10 (U-5, U-12): "Help" is the page's heading row, over both columns, where every page has it; the topic is
  // the h2 under it (the topic was the h1, 300px to the right of every other page's).
  return `<div class="st-page st-help st-duo"><div class="sv-phead"><h1 class="sv-h1">Help</h1></div><div class="st-cols2">
    <nav class="st-nav2" aria-label="Help topics">
      <form class="st-search searchbox" role="search" data-hsform><label class="sr" for="st-hq">Search Help</label>${icon('search')}<input id="st-hq" class="input" type="search" placeholder="Search Help" autocomplete="off" value="${esc(q)}"></form>
      ${navList(list, t, q)}
    </nav>
    <div class="st-pane st-read">
      <div class="st-head"><h2 id="st-hh1" class="st-ptitle" data-title="${esc(t.title)}">${q.trim() ? 'Search results' : esc(t.title)}</h2><p class="st-lede" id="st-hsub" ${q.trim() ? 'hidden' : ''}>${esc(t.sub && t.id !== 'new' ? t.sub() : '')}</p></div>
      <div id="st-hres" aria-live="polite">${results(q)}</div>
      <div id="st-hdefault" ${q.trim() ? 'hidden' : ''}>${kbd}${body}</div>
    </div>
  </div></div>`;
}

// Today shows these same steps as its Getting started card (R-106).
export { newSteps, frSet as markNewStep };
// R-277 fix 19 (F-1): the top search box finds Help's guides as places (search.js placeHits): their titles and other words.
export const helpTopics = () => visible().map(t => ({ id: t.id, title: t.title, also: t.also || '', icon: t.icon }));
export default {
  tab: '',
  // The two columns need more than the 720px the frame gives a plain page between 900 and 1099px.
  wide: () => DESK(),
  title: route => topic(route.topic)?.title || 'Help',
  back: route => topic(route.topic) ? { href: '#/help', label: 'Help' } : null,
  render(route) { if (DESK()) return renderDesk(route); const t = topic(route.topic); return t ? renderTopic(t, route) : renderIndex(); },
  wire(route, root) {
    const wm = root.querySelector('#st-wmark');   // W29: a Capitol word opened from the top search
    if (wm && freshMark(route)) { try { history.replaceState({ ...(history.state || {}), wmark: 1 }, ''); } catch { /* it lands again on a redraw */ }
      requestAnimationFrame(() => { if (!wm.isConnected) return; wm.scrollIntoView({ block: 'center' }); wm.focus({ preventScroll: true }); }); }
    root.querySelectorAll('[data-fr]').forEach(a => a.addEventListener('click', () => frSet({ [a.dataset.fr]: 1 })));
    const ks = root.querySelector('[data-keys]');
    if (ks) ks.onchange = () => { setKeys(ks.checked); toast(ks.checked ? 'Keyboard shortcuts are on.' : 'Keyboard shortcuts are off.', { ok: true }); };
    const f = root.querySelector('[data-hsform]'); if (!f) return;
    const inp = f.querySelector('input'), res = root.querySelector('#st-hres'), def = root.querySelector('#st-hdefault'), desk = !!root.querySelector('.st-help.st-duo');
    const wireRes = () => res.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { e.preventDefault(); if (desk) S.st2HelpQ = ''; S.go(a.getAttribute('href')); });
    // Typing updates the results in place, so the box keeps focus and the page does not jump.
    inp.oninput = () => { S.st2HelpQ = inp.value; res.innerHTML = results(inp.value); const on = !!inp.value.trim(); def.hidden = on; wireRes();
      if (desk) { const h = root.querySelector('#st-hh1'), sub = root.querySelector('#st-hsub'); h.textContent = on ? 'Search results' : h.dataset.title; sub.hidden = on;
        root.querySelectorAll('.st-nav2 .st-navi').forEach(a => { if (on) a.removeAttribute('aria-current'); else if (a.getAttribute('href') === '#/help/' + (topic(route.topic) || homeTopic()).id) a.setAttribute('aria-current', 'page'); }); } };
    f.onsubmit = e => { e.preventDefault(); res.querySelector('a')?.focus(); };
    inp.onkeydown = e => { if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; inp.oninput(); } };
    // Desktop: choosing a topic on the left ends the search, so the topic shows (first in line, before the frame turns the page).
    if (desk) root.querySelector('.st-nav2').addEventListener('click', e => { if (e.target.closest('a.st-navi')) S.st2HelpQ = ''; }, true);
    wireRes();
    // W37: copy the question before Slack opens (the link itself opens the channel in a new tab).
    res.addEventListener('click', e => { const a = e.target.closest('[data-askslack]'); if (!a) return;
      try { navigator.clipboard?.writeText(a.dataset.askslack).then(() => toast('Copied. Paste it in Slack and send.', { ok: true }), () => {}); } catch { /* the words are shown under the button */ } });
  },
};
