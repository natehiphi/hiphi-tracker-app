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
import { S, DEMO, APP_URL, STAGES, esc, fmtDate } from './data.js';
import { glossStage, legislativeDay, PUBLIC_APP, plain } from './model.js';
import { icon, btn, row, switchRow, toast, keysOn, setKeys } from './ui.js';

const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const names = pred => S.advocates.filter(a => pred(a) && a.is_active !== false).map(a => a.full_name);
const orList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
const emailOff = () => (S.emailCfg || {}).enabled === false;
const FR_KEY = DEMO ? 'hiphi2_firstrun_demo' : 'hiphi2_firstrun';
const frGet = () => { try { return JSON.parse(localStorage.getItem(FR_KEY) || '{}'); } catch { return {}; } };
const frSet = p => { try { localStorage.setItem(FR_KEY, JSON.stringify({ ...frGet(), ...p })); } catch { /* private mode */ } };

// ---- the Capitol's words, in plain language (the glossary) ----
const WORDS = [
  ['Legislative day', 'A day the chambers meet. Weekends, recess days and holidays do not count, so "Legislative day 42 of 60" is not a calendar count.'],
  ['Referral', 'The committees a bill must pass in each chamber, in order. Three or more in one chamber is a triple referral.'],
  ['Hearing', 'A committee meeting where the bill is heard and anyone can testify. Written testimony is usually due 24 hours before; a few committees ask for 48 (CPN). The tracker shows each hearing’s own deadline.'],
  ['48-hour notice', 'A committee must post a hearing at least 48 hours ahead. A bill’s first Senate committee must post 72 hours ahead. If its last regular meeting before a deadline is closer than that, only the chair can help.'],
  ['Decision making', 'A later meeting where a committee votes on bills it already heard. Testimony is still taken, and the tracker treats it like a hearing, with its own deadline: HIPHI filed at eight of them in 2026.'],
  ['Deferred', 'The committee held the bill. For the year, that almost always ends it.'],
  ['Triple filing', 'The last day a triple-referred bill can clear its first committee.'],
  // R-277 W-2: one definition each, the same words as the bill page's stage note (model.js STAGE_GLOSS, GATE_WORDS).
  ['Lateral', 'The last day a bill can reach its last committee in the chamber it is in. Its last committee is usually the money committee (FIN in the House, WAM in the Senate).'],
  ['Decking', 'The last day a bill can clear its last committee and be filed for its floor vote in that chamber.'],
  ['Crossover', 'The last day a bill can pass its first chamber and move to the other. The second chamber repeats the same deadlines.'],
  ['Cross back', 'A bill the second chamber changed goes back to where it started, to agree or disagree.'],
  ['Conference', 'House and Senate negotiators settle one version. Final decking is the last day they can agree.'],
  ['Sine die', 'The last day of the session.'],
  ['HD1, SD1, CD1', 'Versions. HD1 is the first House draft, SD1 the first Senate draft, CD1 the conference draft. Testimony written for an older version needs a second look.'],
  ['Companion', 'The same bill introduced in the other chamber, an HB and an SB with the same text. If one stalls, the other may still move.'],
  ['GM', 'A message from the Governor, such as a nomination or a report. Not a bill.'],
];
const STAGE_EXTRA = { vetoed: 'Vetoed by the Governor. The Legislature can override with two-thirds of each chamber.', dead: 'Missed a deadline, was deferred, or failed a vote. It can come back next session.' };

// ---- the guides. Each is { id, title, also? (more words search finds it by, R-277), icon, sub?(), items() -> [[term, html]] or html() } ----
const TOPICS = [
  { id: 'new', title: 'New here?', icon: 'sparkles', sub: () => { const st = newSteps(), n = st.filter(s => s.done).length; return `${n} of ${st.length} done`; }, html: () => newHTML() },
  { id: 'words', title: 'Capitol words', icon: 'book-open', sub: () => `Lateral, decking, sine die and ${WORDS.length - 3} more`, items: () => WORDS.map(([t, d]) => [t, esc(d)]) },
  { id: 'stages', title: 'Stages and deadlines', icon: 'calendar-days', sub: () => { const ld = legislativeDay(); return ld ? ld.text : 'Where a bill can be, and the date it races'; },
    items: () => STAGES.map(([k, l]) => [l, esc(glossStage(k) || STAGE_EXTRA[k] || '')]).filter(([, d]) => d) },
  { id: 'committees', title: 'Committee codes', icon: 'landmark', sub: () => `${Object.keys(S.committees || {}).length} committees and their chairs`,
    items: () => Object.values(S.committees || {}).sort((a, b) => (a.chamber || '').localeCompare(b.chamber || '') || a.code.localeCompare(b.code))
      .map(c => [c.code, `${esc(c.name)}. ${c.chamber === 'S' ? 'Senate' : 'House'}.${c.chair ? ` Chair ${esc(c.chair)}` : ''}${c.vice_chair ? `, vice chair ${esc(c.vice_chair)}` : ''}${c.chair ? '.' : ''}`]) },
  { id: 'testimony', title: 'How testimony works', icon: 'file-text', sub: () => 'Write, approve, second approval, file',
    items: () => { const adm = orList(names(a => a.is_admin || a.can_approve)) || 'an admin', rev = orList(names(a => a.is_reviewer)) || 'a second approver';
      return [['1. Write', 'A hearing notice arrives. About an hour later a draft Google Doc is made in Drive for the bill\'s owner (only for bills with a position other than Monitor). The owner writes it and presses <b>Send for approval</b>.'],
        ['2. Approve', `An admin or an approver (${esc(adm)}) presses <b>Approve</b>, or <b>Send back</b> with a note. An approver never approves testimony they sent; an admin may. Sent back, it goes to the writer with the note on their Today list, and they press <b>Resubmit</b>. If nobody has approved it 6 hours before the testimony deadline, a second approver (${esc(rev)}) can stand in, and Slack tells them so.`],
        ['3. Second approval', `The first testimony on a bill also needs a second approver (${esc(rev)}), someone other than whoever gave the first approval. Later testimony on the same bill skips this step.`],
        ['4. File', 'Whoever sent it for approval files it on the Capitol site (the owner, if nobody sent it; the steps are in <a href="#/help/file">How to file at the Capitol</a>) and presses <b>Mark filed</b>, with the confirmation link if there is one. Written testimony is usually due 24 hours before the hearing, 48 for a few committees; the hearing’s own deadline is on its card.'],
        ['Undo', 'Mark filed (later: <b>Unmark filed</b>, in the <b>⋯</b> menu beside the hearing on the bill’s page), I\'m going, Not for us and removing a bill from a list can be undone for 10 seconds.'],
        ['A new version', 'If the bill changes (HD1, SD1) after the draft was written, Today asks the owner to check the draft against the new version.']]; } },
  { id: 'tabs', title: 'What each place is for', icon: 'list-todo', sub: () => 'Today, My issues, Bills, Legislators and Outreach',
    // Staff v3 (R-264): five places and nothing else in the sidebar; Review opens from Today's card, the Inbox is in your
    // menu, a bill has three tabs, This week is one view, and Outreach has two tabs.
    items: () => [['Today', 'Everything that needs you, grouped by when it is due: testimony steps, testimony to approve, replies, emails to approve and to-dos, one line each. On a laptop the one you pick opens in full beside the list, with all its buttons. Clear it and you are done. Testimony waiting for your approval opens in Review from its card. <b>Mine</b> is yours, and Today always opens on it; <b>Team</b> has its own link (#/?scope=team) and is everyone else’s work due this week, by person (for admins and second approvers it starts with <b>Slipping</b>: every step on the team that is late or due within a day, and hearings today or tomorrow nobody is going to), and its picker narrows it to one teammate or to <b>No owner</b>. <b>This week</b> shows the week’s hearings and deadlines. Hearings on bills we only monitor are folded away: <b>+N on bills you monitor</b> shows them again. If you help on a coalition, Today also shows its week, never in the count. Between sessions, Today shows how the session ended and <b>Getting ready for January</b> (see <a href="#/help/session">Getting ready for a new session</a>).'],
      ['Suggestions', 'Under <b>This week</b>, <b>Also worth doing</b> suggests work drawn from where each bill stands, and says why each one came up. Each has one button that does the step, and a <b>…</b> menu with <b>Done</b>, <b>Not now</b> (it comes back in two weeks) and <b>Not this bill</b>, each with Undo. Suggestions are never counted in the Today number.'],
      ['Giving a to-do', '<b>Give to…</b> on a to-do hands it to one teammate, who gets a Slack message. Its first choice is <b>You · Take it over</b>. Change your mind within two minutes, with Undo or by giving it back, and nobody is told.'],
      ['My issues', 'The issues you own or help on, each with its bills, soonest work first. Its tabs are three ways to group bills: <b>My issues</b>, <b>All issues</b> (every issue by category: rename, merge, put bills on issues; the first visit’s numbers are in its ⋯ menu) and <b>Coalitions</b> (each coalition’s week, and the switch <b>I help on</b> it).'],
      ['Bills', 'Every tracked bill, grouped by where it stands: <b>Mine</b> (bills you own or follow), <b>My coalitions</b> (when you help on one) or <b>Team</b>. Filter, select several to follow or change at once, or export a CSV; <b>Save this view</b> keeps a filter on the row of view chips. Sort new bills, Lists and Muted bills open from its ⋯ menu. A bill’s page has three tabs: <b>Overview</b> (where it stands, with its committees and where their members stand), <b>Activity</b> and <b>Public</b>.'],
      ['Legislators', 'Every senator and representative: district, the towns it covers, committees, how to reach them and where they stand on our bills. The filter box searches names, towns and districts, so “Kaūmana” or a street address finds the member. <b>This week</b> shows who hears our bills in the next 7 days.'],
      ['Outreach', 'Four tabs. <b>This week’s asks</b>: each bill’s public ask and deadline, to paste into the newsletter or a post (<b>My coalitions</b> first; <b>Team</b> shows everyone’s). <b>Partner update</b>: the memo for a coalition’s partners. <b>Emails</b>: supporter emails, each approved by someone other than its writer before it goes. <b>Supporters</b>: everyone HIPHI knows, with segments and to-dos (admins import or export a CSV from the ⋯ menu).'],
      ['QR code', 'A printable QR code for a partner’s link to the first visit: My issues, then All issues, its <b>⋯</b> menu, <b>First visit: numbers and links</b>, then Make a link. There is no QR code for a single hearing yet; share a hearing with its link.'],
      ['A quick look', 'On Bills, clicking a row opens the bill beside the list; <b>J</b> and <b>K</b> (or the arrow keys) walk the list and the bill beside it follows, <b>Enter</b> or <b>Open the bill</b> opens the bill’s own page, <b>Esc</b> closes it. On Today, <b>o</b> opens the same quick look'],
      ['Your menu', 'Tap your initials, top right, for the Inbox (messages and updates sent to you), and on a phone My settings, Session setup (admins) and Help. On a wide screen the sidebar holds the five places, with Help, Session setup and My settings at its foot; <b>Collapse</b> narrows it to icons.']] },
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
        ['Drafts', 'Made from the notice about an hour later, for bills with a position other than Monitor, in Drive under Testimony, the year, the coalition and the bill.'],
        ['Video', 'Each hearing links to the chamber\'s YouTube channel, then to the exact video once it is posted. Staff can fix the link on the bill page.'],
        ['Deadlines', 'A bill still in committee when its deadline passes moves to Did not advance, with the deadline it missed.'],
        ['Email', emailOff() ? '<b>Paused.</b> Nobody gets email from the tracker right now: no supporter emails, staff alerts, digests or public hearing emails. Slack DMs still work.' : '<b>On.</b> Supporter emails, hearing emails to supporters, and alerts for staff who chose email are sent.']]; } },
  // The January panel on Today, and Session setup, point here (#/help/session). What changes, and what an admin checks.
  { id: 'session', title: 'Getting ready for a new session', icon: 'calendar-check', sub: () => 'What changes on opening day, and what admins check',
    items: () => [['When the calendar is in', 'Claude loads the new session’s calendar each December. From then every deadline and count follows the new session, and Today is your list again instead of how the last session ended.'],
      ['New bills', 'They arrive as they are introduced. <b>Sort new bills</b> asks for one decision on each: track it, with its coalition, owner, position and issue, or pass.'],
      ['Session setup (admins)', '<a href="#/setup">Ready for session?</a> lists what the tracker still needs, each with a way to fix it: opening day, sine die and recess days; 4 more syncs a day for the opening weeks; the session’s bills, under Import; and an owner, a Slack channel and keywords for every coalition.']] },
  { id: 'public', title: 'The public page and lists', icon: 'globe', sub: () => 'What visitors see, and how to share it',
    items: () => [['What shows', 'Only bills set to show on the public page, with the plain summary and the ask from the bill\'s Public tab. Visitors follow issues (or a bill, or a list) and get a five-minute way to testify.'],
      ['Lists', 'A list is a set of public bills. Following a list follows every bill on it, including ones added later.'],
      ['Supporters', 'People who say yes at sign-up to hearing emails, and to HIPHI seeing what they follow, appear under Outreach, then Supporters. Everyone else\'s follows are counts only.'],
      ['Links', `A staff link to a bill looks like ${esc(APP_URL)}#bill=HB1563 and opens in either app. A public link to a list looks like ${esc(PUBLIC_APP())}#list=keiki-health.`],
      ['On hiphi.org', 'Session setup, then Website embed, has the code to put the tracker on any web page.']] },
  { id: 'where', title: 'Drive, Slack and the calendar', icon: 'map-pin', sub: () => 'Where drafts, alerts, hearings and video are kept, outside the app',
    items: () => [['Drafts', 'Google Drive, in Testimony, then the year, the coalition and the bill.'], ['Alerts', `Slack ${esc((S.slackCfg || {}).main_channel || '#hearing-alerts')} and each coalition's channel. Your own steps come as DMs or email (My settings).`],
      ['Calendar', 'The HIPHI Hearings Google Calendar.'], ['Video', 'The Senate and House YouTube channels.'], ['Questions', `Ask ${esc(orList(names(a => a.is_admin)) || 'an admin')}.`]] },
  // R-277 fix 9: the steps nobody could find (Patti, the review's task walk). The Capitol's own words, as the public
  // helper uses them (pub/helper.js, PAR "How to Submit Testimony"), for HIPHI filing as an organization.
  { id: 'file', title: 'How to file at the Capitol', also: 'file filing submit testimony', icon: 'landmark', sub: () => 'Six steps on the Capitol website, then Mark filed',
    items: () => [['1. Save it as a PDF', 'In the approved Google Doc: File, Download, PDF.'],
      ['2. Open the bill', 'On the bill’s page or in the Mark filed sheet, press <b>File at the Capitol</b>. It opens the bill on the Capitol website.'],
      ['3. Log in', 'Log in to the Capitol website. No account yet? Making one is free; they email a link to confirm. It logs you out after 60 minutes.'],
      ['4. Pick the hearing', 'Choose <b>Submit Testimony</b> and pick the hearing it is for.'],
      ['5. Fill in the form', 'Your position (Support, Oppose or Comments), <b>Organization</b> and HIPHI’s name, and <b>Written testimony only</b> unless someone is going to speak. Upload the PDF and submit.'],
      ['6. Look for the green box', 'It means it worked, and a confirmation email follows. Back in the tracker, press <b>Mark filed</b> and paste the confirmation link if you have it. Pressed it by mistake? <b>Unmark filed</b> is in the <b>⋯</b> menu beside the hearing on the bill’s page.'],
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
        ['Quieter', 'My settings: <b>Fine-tune what you are told, and when</b> switches each kind off, or pick <b>Only in the app</b> for no alerts at all. There is no daily summary or quiet hours yet.']]; } },
  { id: 'keys', title: 'Keyboard shortcuts', icon: 'keyboard', hover: true, sub: () => 'For a keyboard and mouse',
    items: () => [['/', 'Search'], ['g then t, m, b, l, o, r or i', 'Go to Today, My issues, Bills, Legislators, Outreach, Review or the Inbox'], ['j and k', 'Today: next and previous item (the arrow keys too, once in the list). Bills, Legislators and the Inbox: next and previous row'], ['Enter', 'Today: do the open row\'s step. Bills: open the bill'], ['o', 'Today: a quick look at the bill. Bills: open the bill'], ['x', 'Bills: tick the row'], ['Space', 'Bills: a quick look at the marked row'],
      ['Shift+A', 'Review: approve (it takes Shift so a stray letter never approves)'], ['Shift+M', 'Inbox: mark the list read'], ['e', 'Inbox: mark the row read or unread'], ['r, o', 'Review: send back, open the Doc'], ['Right arrow', 'Review: skip to the next draft'], ['1 to 3', 'Bill: Overview, Activity, Public'], ['[ and ]', 'Bill: previous and next bill'],
      ['t, n, l, u', 'Sort new bills: track, not for us, later, undo (u again undoes the one before)'], ['Arrow keys', 'In a menu or a picker: move; Enter chooses'], ['?', 'Open this list'], ['Esc', 'Close a sheet, or go back'], ['While typing', 'Shortcuts are off while you type in a field.'], ['Switch them off', 'The switch at the top of this list turns every shortcut off on this device.']] },
];
const topic = id => TOPICS.find(t => t.id === id);
// R-277 fix 9: someone who has not done New here?'s four steps meets it first; everyone else lands on Capitol words.
const isNew = () => { const st = newSteps(); return st.some(x => !x.done); };
const homeTopic = () => topic(isNew() ? 'new' : 'words');
const visible = () => TOPICS.filter(t => !t.hover || HOVER());

// ---- New here?: four things a new teammate does once. One ticks itself; the others tick when you go do them.
// v4 (R-269, T9): "Read Owning and following" went (P-4: reading is not a step). Someone who owns no bills and supports a
// coalition (Patti, Saya, Julie) is not asked to follow three bills, which for Patti only added a folded "Waiting on
// others" line: their step is their coalition's testimony this week, on This week.
const coalWord = me => { const c = me?.prefs?.coalitions;
  if (c === 'all') return 'your coalitions’';
  const ns = Array.isArray(c) ? c.map(id => (S.campaigns || []).find(x => x.id === id)?.name).filter(Boolean) : [];
  return ns.length === 1 ? `${ns[0]}’s` : ns.length ? 'your coalitions’' : ''; };
function newSteps() {
  const o = frGet(), me = S.me;
  const mine = me ? S.bills.filter(b => (S.assignments[b.id] || []).includes(me.id) || S.follows?.has(b.id)).length : 0;
  const ownsNone = !!me && !S.bills.some(b => (S.assignments[b.id] || []).includes(me.id)), co = ownsNone ? coalWord(me) : '';
  return [
    { k: 'settings', done: !!o.settings, title: 'Choose how the tracker reaches you', sub: 'Slack DM, email, or only in the app', href: '#/me' },
    co ? { k: 'week', done: !!o.week, title: `See ${co} testimony this week`, sub: 'This week shows each hearing, where its testimony stands and when it is due', href: '#/?view=week' }
      : { k: 'follow', done: mine >= 3, title: `Follow three bills you care about${mine && mine < 3 ? `, ${mine} of 3` : ''}`, sub: 'Open a bill, then Follow in its menu. Bills you own count.', href: '#/bills' },
    { k: 'bill', done: !!o.bill, title: 'Open a bill and read its Next up card', sub: 'It says what the bill needs and by when', href: '#/bills' },
    { k: 'today', done: !!o.today, title: 'Clear your Today list', sub: 'Each card has one button that does the step', href: '#/' },
  ];
}
function newHTML() {
  const steps = newSteps(), n = steps.filter(s => s.done).length;
  return `<p class="st-sum"><span class="st-meter" aria-hidden="true"><i style="width:${Math.round(n / steps.length * 100)}%"></i></span><span>${n} of ${steps.length} done</span></p>
    <div class="rows">${steps.map(s => `<a class="row st-newrow${s.done ? ' done' : ''}" href="${s.href}" data-fr="${s.k}"><span class="st-ric">${icon(s.done ? 'circle-check' : 'circle-dashed')}<span class="sr">${s.done ? 'Done:' : 'To-do:'}</span></span><span class="body"><span class="title">${esc(s.title)}</span><span class="sub">${esc(s.sub)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`).join('')}</div>`;
}

// ---- search: every entry of every guide, plus the guide titles ----
// R-277 fix 9 (F-9): word by word. It matched the whole phrase, so "file testimony" and "how do I file" found nothing.
// Each word that carries meaning has to appear (or one of its other words, SYN) somewhere in the entry or its guide's
// title; small words ("how", "do", "I") are dropped. The best entries come first: a word in the term beats one in the text.
const STOP = new Set(['a', 'an', 'and', 'are', 'at', 'can', 'do', 'does', 'for', 'get', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your']);
// Other words people use for the same thing. Each row is one meaning; a word in a row finds every word in it.
const SYN = [
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
const synOf = w => { const row = SYN.find(r => r.includes(w) || r.some(x => w.length > 3 && x.startsWith(w))); return row ? [w, ...row] : [w]; };
// A short word ("dm", "qr", "due") must stand alone ("dm" is not in "admins"); a longer one may start a word ("file" finds "filing").
const whole = (hay, x) => new RegExp(`(^|[^a-z0-9])${x}($|[^a-z0-9])`).test(hay);
const has = (hay, x) => x.length <= 3 ? whole(hay, x) : hay.includes(x);
const wordsOf = q => plain(q).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
function results(q) {
  const ws = wordsOf(q); if (!ws.length) return q.trim() ? `<p class="st-none" role="status">Type a word, such as “file” or “alerts”.</p>` : '';
  const alts = ws.map(synOf), hits = [];
  for (const t of visible()) {
    const entries = t.items ? t.items() : [[t.title, '']];
    for (const [term, def] of entries) {
      const txt = String(def).replace(/<[^>]+>/g, ''), hay = plain(`${t.title} ${t.also || ''} ${term} ${txt}`), head = plain(`${t.title} ${t.also || ''} ${term}`);
      if (!alts.every(a => a.some(x => has(hay, x)))) continue;
      // the typed word itself in the guide's title or the entry's name ranks first, one of its other words there next,
      // part of a word there after that, then the text; a guide whose own title has the word gets one more
      const tt = plain(`${t.title} ${t.also || ''}`), score = alts.reduce((n, a) => n + (whole(head, a[0]) ? 4 : a.some(x => whole(head, x)) ? 3 : a.some(x => has(head, x)) ? 2 : 1) + (whole(tt, a[0]) ? 1 : 0), 0);
      hits.push({ t, term, def: t.items ? txt : '', score });
    }
  }
  if (!hits.length) return `<p class="st-none" role="status">Nothing in Help mentions "${esc(q.trim())}". Try another word.</p>`;
  hits.sort((x, y) => y.score - x.score);
  const shown = hits.slice(0, 40);
  return `<p class="sr" role="status">${hits.length} found</p><div class="rows">${shown.map(h => row({ title: esc(h.term), sub: `${esc(h.def.length > 140 ? h.def.slice(0, 139).replace(/\s\S*$/, '') + '…' : h.def)}${h.def ? ' · ' : ''}${esc(h.t.title)}`, href: `#/help/${h.t.id}` })).join('')}</div>${hits.length > 40 ? `<p class="small muted st-note">Showing 40 of ${hits.length}. Add a word to narrow it down.</p>` : ''}`;
}
const dl = items => `<dl class="st-dl">${items.map(([t, d]) => `<div class="st-dli"><dt>${esc(t)}</dt><dd>${d}</dd></div>`).join('')}</dl>`;

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
      <section class="st-sec" aria-labelledby="st-hw">
        <div class="st-sechead"><h2 id="st-hw">Capitol words</h2>${btn(`All ${WORDS.length}`, { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/help/words', attrs: { 'aria-label': `All ${WORDS.length} Capitol words` } })}</div>
        <div class="card st-wcard">${dl(first)}</div>
        <div class="btnrow st-acts">${btn('Stages and deadlines', { kind: 'text', sm: true, icon: 'calendar-days', href: '#/help/stages' })}${btn('Committee codes', { kind: 'text', sm: true, icon: 'landmark', href: '#/help/committees' })}</div>
      </section>
      <section class="st-sec" aria-labelledby="st-hg">
        <h2 id="st-hg">Guides</h2>
        <div class="rows">${visible().filter(t => !['words', 'stages', 'committees', ...(isNew() ? ['new'] : [])].includes(t.id)).map(t => row({ lead: t.icon, title: esc(t.title), sub: esc(t.sub()), href: '#/help/' + t.id })).join('')}</div>
      </section>
    </div>
  </div>`;
}
// Keyboard shortcuts carries its own on-off switch (v3; it was in My settings), kept on this device (ui.js setKeys).
const keysNote = t => t.id !== 'keys' ? '' : `${HOVER() ? '' : `<p class="small muted st-note">${icon('info')} These need a keyboard. They are off on touch screens.</p>`}
  <div class="card st-list st-keyson">${switchRow('st-keyson', 'Use keyboard shortcuts', keysOn(), 'Off means a stray letter never does anything. Approving always takes Shift+A. Kept on this device.', { 'data-keys': '1' })}</div>`;
function renderTopic(t) {
  const body = t.html ? t.html() : `<div class="card st-wcard">${dl(t.items())}</div>`;
  const kbd = keysNote(t);
  return `<div class="st-page st-help st-subpage">
    <a class="st-crumb" href="#/help" data-back>${icon('arrow-left')}<span>Help</span></a>
    <div class="st-head"><h1>${esc(t.title)}</h1></div>${kbd}${body}
  </div>`;
}

// Desktop: search and topics on the left (they stay in view), the topic on the right. One h1: the topic's title,
// or "Search results" while the box has words in it.
function renderDesk(route) {
  const q = S.st2HelpQ || '', t = topic(route.topic) || homeTopic();
  const body = t.html ? t.html() : `<div class="card st-wcard">${dl(t.items())}</div>`;
  const kbd = keysNote(t);
  const list = visible(); if (!list.includes(t)) list.push(t);   // a direct link to a topic this device does not list still shows where you are
  // R-277 fix 10 (U-5, U-12): "Help" is the page's heading row, over both columns, where every page has it; the topic is
  // the h2 under it (the topic was the h1, 300px to the right of every other page's).
  return `<div class="st-page st-help st-duo"><div class="sv-phead"><h1 class="sv-h1">Help</h1></div><div class="st-cols2">
    <nav class="st-nav2" aria-label="Help topics">
      <form class="st-search searchbox" role="search" data-hsform><label class="sr" for="st-hq">Search Help</label>${icon('search')}<input id="st-hq" class="input" type="search" placeholder="Search Help" autocomplete="off" value="${esc(q)}"></form>
      ${list.map(x => `<a class="st-navi" href="#/help/${x.id}"${x.id === t.id && !q.trim() ? ' aria-current="page"' : ''}>${icon(x.icon)}<span class="st-navl">${esc(x.title)}</span></a>`).join('')}
    </nav>
    <div class="st-pane st-read">
      <div class="st-head"><h2 id="st-hh1" class="st-ptitle" data-title="${esc(t.title)}">${q.trim() ? 'Search results' : esc(t.title)}</h2><p class="st-lede" id="st-hsub" ${q.trim() ? 'hidden' : ''}>${esc(t.sub ? t.sub() : '')}</p></div>
      <div id="st-hres" aria-live="polite">${results(q)}</div>
      <div id="st-hdefault" ${q.trim() ? 'hidden' : ''}>${kbd}${body}</div>
    </div>
  </div></div>`;
}

// Today shows these same steps as its Getting started card (R-106).
export { newSteps, frSet as markNewStep };
export default {
  tab: '',
  // The two columns need more than the 720px the frame gives a plain page between 900 and 1099px.
  wide: () => DESK(),
  title: route => topic(route.topic)?.title || 'Help',
  back: route => topic(route.topic) ? { href: '#/help', label: 'Help' } : null,
  render(route) { if (DESK()) return renderDesk(route); const t = topic(route.topic); return t ? renderTopic(t) : renderIndex(); },
  wire(route, root) {
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
  },
};
