// Staff v6 (R-336, spec 3.1, 3.3 and 6 "Search", V32; F4, F5, F6): one search box and its palette. The header's box (a
// laptop; Cmd/Ctrl-K or "/" puts the cursor in it, app.js) suggests as you type, and the phone's Search button opens this
// page (#/search?q=), whose own box does the same. Both find, by a word you remember:
//   - places (Hearings, To approve, Partner update, the coalitions, Help's guides) and things to do ("approve", "QR code",
//     "sort new bills", "hand over"), each with its keyboard shortcut when there is a keyboard (v5's g-keys, kept);
//   - bills by number ("HB1562", "hb 1562", "1562"), nickname or words, and by a committee's code ("TRN": the bills in it);
//     bills not tracked yet, each with Track;
//   - issues, legislators (by name, town, district or committee), teammates, conversations with legislators (by what was
//     said), what the team wrote in legislators' profiles (practice copy), supporters, and what a Capitol word means.
// It is always a second way to a place, never the only one (V32: every place is labelled in the sidebar or More). With
// nothing typed, this page is the palette: every place and the everyday things to do, each with its shortcut.
// Rows are a name and one line (V04, D15: no codes in rows). Up and Down move through the results from the box, Enter
// opens one, Esc returns to the box (they are the list's own keys, not shortcuts).
import { S, DB, DEMO, esc, hooks, fmtDate, owners, effStage, STAGE_LABEL, POSITIONS, SESSION_YEAR, advocate } from './data.js';
import { plain, diedish, personName, titleCaseSmart, exactBill, legNotesAll, legById, billById, hstDayOf, ASK_ANSWERS, askReply, billRoute, blurb } from './model.js';
import { icon, btn, toast, showAllBtn, keysUsed, keysOn, ASK_TAB } from './ui.js';
import { shortName } from './pathway.js';
import { matchLegs, weekIndex, districtQ } from './legislators.js';
import { helpTopics, synOf, practiceHref } from './help.js';   // Help's guides are places too; one list of everyday words
import { allWords, plainCodes } from './terms.js';   // Help's Capitol words, the one list Help and the tappable words use
import { PROFILES, profileHits, quoteOf, sentenceWith } from './profile.js';   // R-335 (practice copy)
import { itemRow, billRow, nameWords, numWords, whereWords, committeeName, nw } from './steps.js';
import { isLead } from './more.js';
import { admitsPartners } from './partnerq.js';
import { issueIcon } from './issuegrid.js';
import { glanceRow, twinsAmong } from './bills.js';   // as Bills' rows: the twin (no job tile: R-352, A-18, each result group is one kind under its own heading)
import { slimBarHTML } from './tracker.js';   // R-352 FIX-3 (Nate 28 Oct, "keep the bill progress bar there"): each bill result's slim bar, Now and Law
// The slim bar under a bill result's line, inside its link (as live's glanceRow drew it): where the bill is, at a glance.
const withBar = (html, b) => { const sb = slimBarHTML(b); return sb ? html.replace(/(<\/(?:a|button)>)((?:<span class="v6-row-act">[\s\S]*?<\/span>)?<\/div>)\s*$/, `${sb}$1$2`) : html; };

// This page's look (css/search.css). staff6.html links the screens' style sheets; until it links this one (shared_changes),
// the module adds it once, before the first page is drawn.
if (typeof document !== 'undefined' && !document.querySelector('link[href$="staff6/css/search.css"]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'staff6/css/search.css'; document.head.appendChild(l);
}

const SHOW = { bills: 8, un: 5, legs: 5, convs: 5, people: 5, profs: 5, team: 5, issues: 5 };
const st = () => (S.lgSearch ??= { q: '', more: new Set(), un: null });
const qOf = route => String(route?.q?.q ?? '').trim();
const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
// Repaints only the results of the page on screen (set by wire), so data that arrives while someone types never
// re-renders the page and takes the typing focus away.
let repaint = null;
const refresh = () => { if (repaint && document.getElementById('sr-res')) repaint(); else hooks.render(); };

// ---- the keyboard shortcuts each place and step has (app.js's g-keys, v5's kept: Help › Keyboard shortcuts lists them) ----
// Shown only where there is a keyboard and a mouse, and while shortcuts are on (they mean nothing on a phone).
// Not below 768px either (the phone frame, spec 3.2): a narrow window with a mouse is still a phone's layout (R-344 A11).
const fine = () => { try { return matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)').matches; } catch { return false; } };
const KEY = { today: 'g t', hearings: 'g h', testimony: 'g w', review: 'g r', bills: 'g b', legislators: 'g l', outreach: 'g o', myissues: 'g m', inbox: 'g i', help: '?', keys: '?' };
const withKey = (sub, k) => k && fine() && keysOn() ? `${sub} · Shortcut ${k}` : sub;

// ---- places (R-277 fix 19, V32): every place by its v6 name, under the place it sits in ----
// `also` is what people call it ("pings" are My settings' alerts, "qr" the QR code); a word typed must start a word of the
// name or of `also` (or one of Help's other words for it, synOf). Lead tools only for those who have them (D8).
const me = () => S.me || {};
// Who does which job, for the tasks offered with nothing typed (a task that is not yours is still found by its words).
const ownsBills = () => !!S.me && S.bills.some(b => (S.assignments?.[b.id] || []).includes(S.me.id));
const approver = () => !!(me().is_admin || me().can_approve || me().is_reviewer);
const sentAny = () => !!S.me && Object.values(S.drafts || {}).flat().some(d => d.submitted_by === S.me.id);
const writes = () => ownsBills() || !(me().can_approve || me().is_reviewer) || sentAny();
const SETUP_PARTS = [
  ['Coalitions and their owners', '#/setup/coalitions', 'Before each session', 'coalitions owners keywords slack channel'],
  ['Session days and bill sync', '#/setup/sync', 'Before each session', 'opening day sine die recess sync'],
  ['Load the session’s bills', '#/setup/import', 'Before each session', 'open states import tracked list spreadsheet load bills'],
  ['Committee map', '#/setup/committees', 'Before each session', 'committees house senate pairs chairs'],
  ['Email on or paused, and its sender', '#/setup/email', 'Email and Slack', 'email sender postal address pause paused unpause turn on email on email off send email public'],
  ['Where hearing alerts post', '#/setup/alerts?part=r-where', 'Email and Slack', 'slack channel positions daily list hearing alerts'],
  ['Message wording', '#/setup/templates', 'Email and Slack', 'templates slack messages wording'],
  ['Connections and keys', '#/setup/keys', 'Connections', 'slack token google calendar youtube api key keys'],
  ['Website embed', '#/setup/embed', 'Public page', 'embed website widget'],
  ['A/B tests', '#/setup/tests', 'Public page', 'tests experiments'],
  ['Tester sheet', '#/setup/room', 'Public page', 'qr testers room'],
  ['Forget a person', '#/setup/privacy?part=forget', 'Privacy', 'forget delete erase privacy request'],
  ['People’s lists', '#/setup/lists', 'Privacy', 'turn off a list harm lists'],
];
const PLACES = () => [
  { title: 'Today', href: '#/', icon: 'list-todo', sub: 'Your next step and what is due', key: KEY.today, also: 'home start my list to-do todo tasks due mine' },
  { title: 'Hearings', href: '#/hearings', icon: 'calendar-days', sub: 'This week’s hearings', key: KEY.hearings, also: 'this week week sittings calendar going attend' },
  { title: ASK_TAB, href: '#/hearings/ask', icon: 'megaphone', sub: 'Hearings › ask the chairs, by deadline', also: 'get hearings chair asks push board deadline box hearing request ask the chair' },
  { title: 'Testimony', href: '#/testimony', icon: 'file-text', sub: 'Write, approve and file', key: KEY.testimony, also: 'drafts draft letters write' },
  { title: 'To approve', href: '#/testimony?view=approve', icon: 'user-check', sub: 'Testimony › To approve, then Review', key: KEY.review, also: 'review approval approvals second look sign off queue' },
  { title: 'Ready to file', href: '#/testimony?view=file', icon: 'clipboard-check', sub: 'Testimony › the filing card', also: 'file filing capitol submit mark filed' },
  { title: 'Sent back', href: '#/testimony?view=sent', icon: 'file-text', sub: 'Testimony › drafts to revise', also: 'revise resubmit changes' },
  { title: 'Earlier testimony', href: '#/testimony?view=filed', icon: 'book-open', sub: 'Testimony › Filed: every filed testimony', also: 'library borrow past filed old' },
  { title: 'Outreach', href: '#/outreach', icon: 'megaphone', sub: 'This week’s asks', key: KEY.outreach, also: 'rally asks share kit public ask newsletter post' },
  { title: 'Partner update', href: '#/outreach/partners', icon: 'newspaper', sub: 'Outreach › the week’s bills and asks, ready to send a coalition’s partners', also: 'partners memo weekly memo coalition update' },
  { title: 'Emails', href: '#/outreach/emails', icon: 'mail', sub: 'Outreach › emails to supporters', also: 'email action alert supporter email blast' },
  { title: 'Supporters', href: '#/outreach/supporters', icon: 'users', sub: 'Outreach › everyone HIPHI knows', also: 'people contacts segments groups' },
  { title: 'Lists', href: '#/outreach/lists', icon: 'list', sub: 'Outreach › shared lists of bills', also: 'list collections public lists' },
  { title: 'Bills', href: '#/bills', icon: 'scroll-text', sub: 'Every bill we track', key: KEY.bills, also: 'table all bills tracked' },
  { title: 'Sort new bills', href: '#/bills/new', icon: 'sparkles', sub: 'Bills › track or pass each new bill', also: 'triage new bills track pass introduced' },
  { title: 'Muted bills', href: '#/bills/muted', icon: 'bell-off', sub: 'Bills › Muted', also: 'muted unmute set aside' },
  { title: 'Legislators', href: '#/legislators', icon: 'landmark', sub: 'Who to ask, and everyone', key: KEY.legislators, also: 'members chairs senators representatives directory' },
  { title: 'Holding our bills', href: '#/legislators?view=holding', icon: 'landmark', sub: 'Legislators › the chairs who hold our bills', also: 'holding chairs who to ask' },
  { title: 'My issues', href: '#/my-issues', icon: 'tag', sub: 'The issues you own or help on', key: KEY.myissues, also: 'issues prep 2027 ready' },
  { title: 'Coalitions', href: '#/my-issues/coalitions', icon: 'users', sub: 'My issues › Coalitions', also: 'coalition help on' },
  { title: 'All issues', href: '#/my-issues/all', icon: 'tag', sub: 'My issues › All issues', also: 'issues catalogue categories' },
  { title: 'First visit numbers', href: '#/my-issues/all?view=first-visit', icon: 'chart-column', sub: 'How newcomers find and use the public page', also: 'responding response arrivals arrived newcomers how it is landing public numbers visits' },
  { title: 'Make a link or QR code', href: '#/my-issues/all?view=links', icon: 'qr-code', sub: 'A link for a partner or an event', also: 'qr code poster print link partner link first visit' },
  { title: 'Inbox', href: '#/inbox', icon: 'inbox', sub: 'Messages and updates', key: KEY.inbox, also: 'messages mentions replies unread notes' },
  { title: 'What changed', href: '#/inbox?view=updates', icon: 'inbox', sub: 'Inbox › Updates', also: 'updates digest news capitol actions since yesterday' },
  { title: 'Help', href: '#/help', icon: 'circle-help', sub: 'Guides and Capitol words', key: KEY.help, also: 'guides how to questions' },
  { title: 'More tools', href: '#/tools', icon: 'list', sub: 'Every other tool, by job', also: 'tools rare export saved views bulk' },
  { title: 'My settings', href: '#/me', icon: 'settings', sub: 'How the tracker reaches you', also: 'settings preferences account alerts pings notifications slack dm email quiet mute' },
  { title: 'What moved', href: '#/help/moved', icon: 'route', sub: 'Help › where each v5 place is now', also: 'v5 moved old where is changed new app' },
  { title: 'Keyboard shortcuts', href: '#/help/keys', icon: 'keyboard', sub: 'Help › every key', key: KEY.keys, also: 'keys keyboard shortcuts hotkeys' },
  ...(isLead() ? [{ title: 'Team', href: '#/team', icon: 'users', sub: 'What is slipping, and who is on what', also: 'slipping team load everyone' }] : []),
  ...(me().is_admin ? [{ title: 'People', href: '#/people', icon: 'user-round', sub: 'Everyone’s records; hand over and turn off', also: 'team staff roles sign-in link links turn off hand over leaving away admin approver second approver partner approver add a person' },
    { title: 'Session setup', href: '#/setup', icon: 'sliders-horizontal', sub: 'The season checklist, alerts and connections', also: 'setup admin calendar deadlines slack email keys embed' },
    // v5 named all 14 parts on every setup page; v6 puts them one tab deep, so search names each one (V32, the LEAD critic).
    // Each address scrolls to its part and focuses it (setup.js PART and ?part=).
    ...SETUP_PARTS.map(([title, href, grp, also]) => ({ title, href, icon: 'sliders-horizontal', sub: `Session setup › ${grp}`, also }))] : []),
  ...(admitsPartners() ? [{ title: 'Partners', href: '#/partners', icon: 'handshake', sub: 'Groups that write on the public tracker', also: 'partner groups partner words approve join requests invite' }] : []),
  // the coalitions, by their short name and their full one
  ...(S.campaigns || []).map(c => ({ title: c.name, href: `#/coalition/${encodeURIComponent(c.id)}`, icon: 'users', sub: `Coalition${c.public_name && c.public_name !== c.name ? ': ' + c.public_name : ''}`, also: `coalition ${c.public_name || ''}`, code: plain(c.name) })),
  ...helpTopics().map(t => ({ title: t.title, href: `#/help/${t.id}`, icon: t.icon || 'circle-help', sub: 'A guide in Help', also: `help ${t.also}`, help: true })),
];
// ---- things to do (V32): the step's place, said as the step ----
const ACTIONS = () => [
  { title: 'Approve testimony', href: '#/testimony?view=approve', icon: 'user-check', sub: 'Testimony › To approve, then Review', key: KEY.review, also: 'approve approval sign off review second look send back', who: () => me().is_admin || me().can_approve || me().is_reviewer },
  { title: 'File testimony at the Capitol', href: '#/testimony?view=file', icon: 'clipboard-check', sub: 'Testimony › Ready to file', also: 'file filing mark filed submit capitol website', job: () => ownsBills() || me().is_admin },
  { title: 'Write testimony', href: '#/testimony?view=write', icon: 'square-pen', sub: 'Testimony › To write', key: KEY.testimony, also: 'write draft make the draft send for approval resubmit revise', job: writes },
  { title: 'Ask a chair for a hearing', href: '#/hearings/ask', icon: 'mail', sub: 'Hearings › ' + ASK_TAB, also: 'ask chair email the chair hearing request push schedule', job: () => !(me().can_approve && !ownsBills()) },
  // A bill heard and not voted on: the act's one name (C-15), found by the Capitol's own term too ("decision making").
  { title: 'Ask a chair to schedule a vote', href: '#/hearings/ask', icon: 'gavel', sub: 'Hearings › ' + ASK_TAB + ', for a bill heard but not voted on', also: 'vote voted decision making decision-making heard chair schedule', job: () => !(me().can_approve && !ownsBills()) },
  { title: 'Record a chair’s reply', href: '#/hearings/ask', icon: 'message-square', sub: 'Hearings › ' + ASK_TAB + ' › They replied', also: 'reply replied answer will schedule said no chair answer' },
  { title: 'Say I’m going to a hearing', href: '#/hearings/week', icon: 'calendar-check', sub: 'Hearings › This week, on the hearing', key: KEY.hearings, also: 'going attend attending im going i am going' },
  // "who is going", "hearings tomorrow": leads read Team's schedule for today and tomorrow (D5); everyone else This week.
  { title: 'Tomorrow’s hearings: who is going', href: isLead() ? '#/team' : '#/hearings/week', icon: 'calendar-days', sub: isLead() ? 'Team › Today and tomorrow' : 'Hearings › This week', also: 'tomorrow tomorrows today hearings who is going going attending schedule sittings' },
  { title: 'Log a talk with a legislator', href: '#/legislators?view=everyone', icon: 'message-square-plus', sub: 'Their page › Log a talk', also: 'log call meeting conversation talk visit talked' },
  { title: 'Write the public ask', href: '#/outreach', icon: 'megaphone', sub: 'Outreach › This week’s asks', key: KEY.outreach, also: 'public ask share kit copy post newsletter rally', job: () => ownsBills() || me().is_admin },
  { title: 'Email followers', href: '#/outreach', icon: 'mail', sub: 'Outreach › This week’s asks › Email followers, on the bill’s card', also: 'email followers email the followers bill followers followers' },
  { title: 'Late testimony, still accepted', href: '#/testimony?view=file', icon: 'clock', sub: 'Testimony › Ready to file: the Capitol takes it until the hearing starts', also: 'late testimony overdue missed deadline after the deadline still accepted file late' },
  { title: 'Email supporters', href: '#/outreach/emails', icon: 'mail-plus', sub: 'Outreach › Emails › New email', also: 'email supporters email blast new email action alert' },
  { title: 'Save a group of supporters', href: '#/outreach/supporters', icon: 'users-round', sub: 'Outreach › Supporters › Filter, then Save as a group', also: 'segment group save filter supporters' },
  { title: 'Make a QR code', href: '#/my-issues/all?view=links', icon: 'qr-code', sub: 'More tools › Make a link or QR code', also: 'qr code poster print link partner link', job: () => ownsBills() || me().is_admin },
  { title: 'Sort new bills', href: '#/bills/new', icon: 'sparkles', sub: 'Bills › Sort new bills', also: 'sort triage new bills track pass' },
  { title: 'Change many bills at once', href: '#/bills?select=1', icon: 'list-checks', sub: 'Bills › Select', also: 'bulk change select many set owner set position follow' },
  { title: 'Export bills as a spreadsheet', href: '#/bills?export=1', icon: 'download', sub: 'Bills › Export CSV', also: 'export csv spreadsheet download excel' },
  { title: 'Prepare an issue for 2027', href: '#/my-issues', icon: 'clipboard-list', sub: 'My issues › your issues for 2027', also: 'prep prepare 2027 mark ready goal talking points' },
  // Changing one bill's owner is the everyday act ("reassign", "owner", "give bill"); turning a person off and handing over all
  // they hold is a far bigger one, found only by its own words.
  { title: 'Give a bill to someone (change owner)', href: '#/bills', icon: 'user-round', sub: 'Open the bill, then Give to… beside its owner', also: 'give bill give a bill change owner owner owners reassign reassign bill assign set owner new owner hand a bill' },
  { title: 'Give a to-do to a teammate', href: '#/help/howto', icon: 'list-checks', sub: 'The bill’s Next step › To-dos on this bill › Give to…', also: 'to-do todo give to pass on take over' },
  ...(me().is_admin ? [{ title: 'Hand over someone’s work', href: '#/people', icon: 'user-round', sub: 'People › Leaving or away? › Hand over and turn off', also: 'hand over handover leaving away turn off cover offboard' }] : []),
  ...(admitsPartners() ? [{ title: 'Partner words to approve', href: '#/partners?view=approve', icon: 'handshake', sub: 'Partners › Words to approve', also: 'partner words approve partner asks partner approval' }] : []),
  { title: 'See a teammate’s list', href: '#/tools', icon: 'users-round', sub: 'More tools › See a teammate’s list', also: 'teammate cover covering their list someone else away' },
  { title: 'Change how alerts reach me', href: '#/me', icon: 'bell', sub: 'My settings', also: 'alerts pings notifications slack dm email quiet mute' },
  ...(me().initials === 'NT' ? [] : [{ title: 'Ask Nate in Slack', href: '#/help/ask', icon: 'message-circle', sub: 'A direct message to Nate', also: 'question stuck ask help slack nate dm' }]),
  ...(DEMO ? [] : [{ title: 'Practice on last March', href: practiceHref(), icon: 'history', sub: 'The practice copy: nothing reaches the team', also: 'practice practise sandbox demo try' }]),
].filter(a => !a.who || a.who());

const PL_STOP = new Set(['a', 'an', 'the', 'my', 'to', 'of', 'for', 'how', 'do', 'i', 'is', 'where', 'what', 'page', 'open', 'go']);
const qWords = q => plain(q).replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !PL_STOP.has(w));
const starts = (hay, w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}`).test(hay);
function rank(list, q, n) {
  const ws = qWords(q), co = coalOf(q); if (!ws.length) return [];
  const out = [];
  for (const p of list) {
    const t = plain(p.title.replace(/[’']/g, '')), a = plain(p.also || '');
    if (co ? !wholeRx(ws.join(' ')).test(`${t} ${a}`) : !ws.every(w => synOf(w).some(x => starts(t, x) || starts(a, x)))) continue;
    // the name itself first, then a name that starts with the words, then a match on its other words; a place before a
    // Help guide; a coalition's own short name typed exactly ("HEAL") before everything.
    const score = (p.code && p.code === ws.join(' ') ? 20 : 0) + (t === ws.join(' ') ? 8 : 0) + ws.filter(w => starts(t, w)).length * 2 + (t.startsWith(ws[0]) ? 1 : 0) - (p.help ? 1 : 0);
    out.push([score, p]);
  }
  return out.sort((x, y) => y[0] - x[0]).slice(0, n).map(([, p]) => p);
}
export const placeHits = (q, n = 3) => rank(PLACES().filter(p => !p.help), q, n);
// Help's guides, under their own heading "Help" (they were listed as places: "Logging a talk with a legislator · Help").
export const helpHits = (q, n = 2) => rank(PLACES().filter(p => p.help), q, n);
export const actionHits = (q, n = 3) => rank(ACTIONS(), q, n);
const asItem = p => ({ href: p.href, title: p.title, sub: withKey(p.sub, p.key), icon: p.icon });
// With nothing typed: the palette's start, every main place and the everyday steps, each with its shortcut.
const START_PLACES = ['Today', 'Hearings', 'Testimony', 'Outreach', 'Bills', 'Legislators', 'My issues', 'Inbox', 'Help', 'More tools'];
const START_ACTIONS = ['Approve testimony', 'Write testimony', 'File testimony at the Capitol', 'Ask a chair for a hearing', 'Say I’m going to a hearing', 'Write the public ask', 'Make a QR code'];
const startPlaces = () => START_PLACES.map(t => PLACES().find(p => p.title === t)).filter(Boolean);
// Only the tasks that are this person's job (an approver is not offered Write the public ask; Patti is not offered filing).
const startActions = () => START_ACTIONS.map(t => ACTIONS().find(p => p.title === t)).filter(a => a && (!a.job || a.job()));

// ---- matching bills, people and conversations ----
// A committee's code typed alone ("TRN", "hhs/cpn") is the bills in that committee now (V32: "by number, nickname or code").
const cmteOf = q => { const k = String(q || '').trim().toUpperCase().replace(/\s+/g, ''); return k && k.split('/').every(c => S.committees?.[c]) ? k : ''; };
// Each word typed must start a word; a coalition's short name must be the whole word (below).
const wordRxs = q => coalOf(q) ? [wholeRx(plain(q).trim())] : plain(q).split(/\s+/).filter(Boolean).map(termRx);
// Everyday words for what the bills and issues say otherwise (R-344 D11: "disposable vape" found nothing). HIPHI writes
// "e-cigarettes" (R-158) and the Legislature "electronic smoking devices", so a word people type is also matched by those.
// Only words with one meaning here ("weed" is also the invasive kind, so it is not one). The word itself still matches.
const SYN = [[/^vap(e|es|ing|er|ers|or)$/, ['e-cig', 'electronic smoking', 'electronic cigarette', 'electronic vapor']],
  [/^e-?cig(arette|arettes|s)?$/, ['e-cig', 'electronic smoking', 'electronic cigarette']],
  [/^marijuana$/, ['cannabis']], [/^cannabis$/, ['marijuana']]];
const altsOf = t => [t, ...SYN.filter(([re]) => re.test(t)).flatMap(([, xs]) => xs)];
const esc_rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A typed word must start a word of the text, or one of its everyday words must.
const termRx = t => new RegExp(`(?:^|[^a-z0-9])(?:${altsOf(t).map(esc_rx).join('|')})`);
// Legislators (legislators.js matchLegs) and supporters, for a coalition's short name: only a whole-word match ("HEAL" is
// not every member of a Health committee).
const coalKeep = (q, list, text) => { const co = coalOf(q); if (!co) return list; const w = wholeRx(plain(co.name)); return list.filter(x => w.test(plain(text(x)))); };
// A coalition's short name typed alone ("heal", "CTFH") means that coalition: its bills first, and the word is matched whole,
// so "heal" is not every bill with "health" in it (400 of them).
const coalOf = q => { const k = plain(q).trim(); return k ? (S.campaigns || []).find(c => plain(c.name) === k) || null : null; };
const wholeRx = w => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
function billHits(q) {
  const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''), terms = ql.split(/\s+/).filter(Boolean), cm = cmteOf(q), co = coalOf(q);
  if (cm) return S.bills.filter(b => String(b.committee || '').replace(/\s+/g, '').toUpperCase().split(/[\/,]/).some(c => cm.split('/').includes(c)))
    .sort((a, b) => (diedish(a) - diedish(b)) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
  if (co) { const w = wholeRx(plain(co.name)), inCo = b => (S.billCampaigns?.[b.id] || []).includes(co.id);
    return S.bills.filter(b => inCo(b) || w.test(plain(`${b.nickname || ''} ${b.title || ''} ${b.public_summary || ''} ${b.description || ''}`)))
      .sort((a, b) => (inCo(b) - inCo(a)) || (diedish(a) - diedish(b)) || (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true })); }
  const hay = b => [b.bill_number, b.nickname, b.title, b.public_summary, b.description, b.committee, (b.referrals || []).join(' '),
    owners(b).map(a => a.full_name + ' ' + a.initials).join(' '), (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)?.name).join(' '),
    (b.sponsors || []).map(x => typeof x === 'string' ? x : x.n || x.name || '').join(' '), POSITIONS.find(p => p[0] === b.position)?.[1], STAGE_LABEL[effStage(b)]].join(' | ').toLowerCase();
  const has = (h, t) => altsOf(t).some(a => h.includes(a));
  const hit = S.bills.filter(b => b.bill_number.toLowerCase().includes(qn) || terms.every(t => has(hay(b), t)))
    .sort((a, b) => (diedish(a) - diedish(b)) || (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
  // Found only through where it stands (its stage's name): with a Capitol word of that name the word's meaning answers
  // the search, so those bills leave; otherwise each row says the stage it was found by (stageHit).
  const noStage = b => { const h = hay(b), st = String(STAGE_LABEL[effStage(b)] || '').toLowerCase(); return st ? h.replace(st, ' ') : h; };
  const viaStage = b => !b.bill_number.toLowerCase().includes(qn) && !terms.every(t => has(noStage(b), t));
  const wordFirst = wordHits(q).some(w => w.whole);
  STAGE_HIT.clear();
  return hit.filter(b => { if (!viaStage(b)) return true; if (wordFirst) return false; STAGE_HIT.add(b.id); return true; });
}
const STAGE_HIT = new Set();   // the bills of the last billHits found only by their stage's name
const stageWords = b => STAGE_HIT.has(b.id) ? STAGE_LABEL[effStage(b)] || '' : '';
function peopleHits(q) {
  // "sd 12" or "house 34" is that district, as the Legislators page reads it, not every 12 in a phone number (R-032).
  const dm = districtQ(plain(q).trim());
  if (dm && dm[1]) { const n = +dm[2], sen = dm[1][0] === 's'; return (S.people || []).filter(p => +(sen ? p.senate_district : p.house_district) === n)
    .sort((a, b) => String(b.last_active || '').localeCompare(String(a.last_active || ''))); }
  if (coalOf(q)) { const w = wholeRx(plain(q).trim()); return (S.people || []).filter(p => w.test(plain([p.name, p.island, (p.tags || []).join(' ')].join(' ')))); }
  const terms = plain(q).split(/\s+/).filter(Boolean);
  return (S.people || []).filter(p => { const h = plain([p.name, p.email, p.phone, p.island, (p.tags || []).join(' '), p.senate_district ? `sd ${p.senate_district}` : '', p.house_district ? `hd ${p.house_district}` : ''].join(' ')); return terms.every(t => h.includes(t)); })
    .sort((a, b) => String(b.last_active || '').localeCompare(String(a.last_active || '')));
}
// A supporter's place in words, never "SD 12" (D15): "Oʻahu, Senate 12, House 20".
const supWhere = p => [p.island, p.senate_district ? `Senate ${p.senate_district}` : '', p.house_district ? `House ${p.house_district}` : ''].filter(Boolean).join(', ');
// Teammates (V32 "people"): their list opens read-only (More tools' See a teammate's list; team.js reads ?who=).
const ROLE = a => a.is_admin ? 'Admin' : a.can_approve ? 'Approver' : a.is_reviewer ? 'Second approver' : 'Teammate';
function teamHits(q) {
  const ws = plain(q).split(/\s+/).filter(Boolean); if (!ws.length) return [];
  return (S.advocates || []).filter(a => a.is_active !== false && a.id !== S.me?.id && ws.every(w => plain(`${a.full_name} ${a.initials}`).split(/\s+/).some(x => x.startsWith(w))));
}
const teamHref = a => `#/team?who=${encodeURIComponent(a.id)}`;
const issueHits = q => { const co = coalOf(q), res = co ? [wholeRx(plain(co.name))] : plain(q).split(/\s+/).filter(Boolean).map(termRx);
  return res.length ? (S.issues || []).filter(i => !i.archived_at && res.every(re => re.test(plain(`${i.name} ${i.description || ''}`)))) : []; };

// ---- conversations with legislators (R-316 H-15) ----
// A logged conversation, and every ask to a chair, is found by what was said, who it was with, who logged it and the bill
// it was about. One meeting with several legislators is one result; a chair ask and its replies are one result too.
const ANSWER = Object.fromEntries(ASK_ANSWERS.map(([k, label]) => [k, label]));
let allNotesP = null;
function loadAllNotes() {
  if (S.legNotesLoaded || allNotesP || typeof DB.allLegNotes !== 'function') return;
  allNotesP = DB.allLegNotes().then(() => { S.legNotesLoaded = true; refresh(); }).catch(() => { S.legNotesLoaded = true; }).finally(() => { allNotesP = null; });
}
function convGroups() {
  const by = new Map();
  for (const r of [...legNotesAll(), ...(S.legAll || [])]) {
    const k = r.conversation_id ? 'c:' + r.conversation_id : r.answer && r.bill_id ? `a:${r.bill_id}:${r.legislator_id}:${r.committee || ''}` : 'n:' + r.id;
    const g = by.get(k) || by.set(k, { key: k, rows: [] }).get(k);
    if (!g.rows.some(x => String(x.id) === String(r.id))) g.rows.push(r);
  }
  return [...by.values()].map(g => {
    const rows = g.rows.sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))), first = rows[0], last = rows.at(-1);
    return { ...g, first, last, ask: rows.some(r => r.answer), day: first.met_on || hstDayOf(first.created_at || Date.now()), legs: [...new Set(rows.map(r => r.legislator_id))].map(legById).filter(Boolean),
      bill: first.bill_id ? billById(first.bill_id) : null, issue: first.issue_id ? (S.issues || []).find(i => i.id === first.issue_id) : null };
  });
}
export function convHits(q) {
  const res = wordRxs(q);
  if (!res.length) return [];
  const hay = g => plain([...g.rows.map(r => r.body), ...g.legs.map(l => `${l.name || ''} ${shortName(l)}`), ...g.rows.map(r => advocate(r.advocate_id)?.full_name),
    g.bill ? `${g.bill.bill_number} ${g.bill.nickname || ''}` : '', g.issue?.name, ...g.rows.map(r => ANSWER[r.answer]), ...g.rows.map(r => r.committee)].filter(Boolean).join(' | '));
  return convGroups().filter(g => res.every(re => re.test(hay(g)))).sort((x, y) => String(y.last.met_on || y.last.created_at).localeCompare(String(x.last.met_on || x.last.created_at)));
}
// Where a result opens: the bill's Team talk (its conversations), else the issue, else the legislator, with ?cv= naming it.
const convHref = g => { const k = g.last.conversation_id ? 'c:' + g.last.conversation_id : 'n:' + g.last.id;
  return `${g.bill ? billRoute(g.bill, 'talk') : g.issue ? `#/issue/${encodeURIComponent(g.issue.id)}` : g.legs[0] ? `#/legislator/${g.legs[0].id}` : '#/legislators'}?cv=${encodeURIComponent(k)}`; };
const andList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const convWho = g => (andList(g.legs.map(shortName)) || 'A legislator') + (g.ask ? ' (chair)' : '');
const convDay = g => fmtDate(g.day, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');
// Who logged it, or the ask and its answer, in the words Get hearings uses (askWords): "Asked by Kris · will schedule".
const convSub = g => { const a = advocate(g.first.advocate_id), mine = S.me && g.first.advocate_id === S.me.id, who = mine ? 'you' : String(a?.full_name || '').split(' ')[0] || 'someone';
  if (g.first.kind === 'note') return `Note · ${mine ? 'You' : who}`;
  return g.ask ? [`Asked by ${who}`, askReply(g.last)].filter(Boolean).join(' · ') : `${mine ? 'You' : who} logged it`; };
// What was said: the whole sentence with the first word searched for (profile.js sentenceWith), so the reason the result is
// here shows and nothing is cut (A-1).
const convQuote = (g, q) => sentenceWith(g.last.body || g.first.body || '', q);

// ---- Capitol words (R-316 W29, L-15): what a word means, from Help's glossary, first ----
// Each word typed must be a word of the term, or start one from its fourth letter ("lateral" finds Lateral, "deck"
// Decking, "ate" nothing); "first lateral" is that deadline's word, and any version ("HD2") the versions.
const termWords = s => plain(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
export function wordHits(q) {
  let ws = termWords(q);
  if (ws.length > 1 && /^(first|second)$/.test(ws[0])) ws = ws.slice(1);
  if (!ws.length) return [];
  const ver = ws.length === 1 && /^[hsc]d\d{1,2}$/.test(ws[0]), whole = ws.join(' ');
  return allWords().map(([term, text]) => {
    const tw = termWords(term);
    if (!(ver ? tw.some(t => /^[hsc]d\d+$/.test(t)) : ws.every(w => tw.some(t => t === w || w.length >= 4 && t.startsWith(w))))) return null;
    return { term, text, whole: ver || ws.every(w => tw.includes(w)), score: (tw.join(' ') === whole ? 10 : 0) + ws.filter(w => tw.includes(w)).length, href: `#/help/words?w=${encodeURIComponent(term)}` };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}
// The header's row says the meaning to the end of its first sentence, whole (a sentence of two words takes the next).
const firstSentence = s => { const t = String(s); let end = 0;
  for (const m of t.matchAll(/[.!?](?=\s|$)/g)) { end = m.index + 1; if (t.slice(0, end).split(/\s+/).length >= 3) break; }
  return end ? t.slice(0, end) : t; };

// ---- the header's suggestions: the palette (R-032; pub/suggest.js draws them) ----
// At most seven rows under the box, shared out so every kind that matches shows. Things to do and places come first and
// take their rows first; then tracked bills (an exact or leading number first), bills not tracked yet (they open this page
// at that bill, where Track is), issues, legislators, teammates, profiles, conversations and supporters.
const ROWS = 7;
const numOf = b => b.bill_number.toLowerCase().replace(/\s/g, '');
function share(lists, rows = ROWS) {
  const n = lists.map(() => 0); let left = rows, more = true;
  while (left > 0 && more) { more = false; lists.forEach((l, k) => { if (left > 0 && n[k] < l.length) { n[k]++; left--; more = true; } }); }
  return lists.map((l, k) => l.slice(0, n[k]));
}
// Bills not tracked yet that are worth a row: their number typed, or their words; never the Governor's messages (GM, his
// nominations) unless their number was typed, and a coalition's short name only as a whole word.
function unShown(rows, q) {
  const qn = plain(q).replace(/\s/g, ''), co = coalOf(q), w = co && wholeRx(plain(co.name));
  return (rows || []).filter(r => numOf(r).includes(qn) || !/^gm/i.test(r.bill_number) && (!w || w.test(plain(`${r.title || ''} ${r.description || ''}`))));
}
let peopleP = null;
const unCache = new Map();   // query -> bills not tracked, the last 20 asked
export function headerHits(q) {
  q = String(q || '');
  // Nothing typed (the palette opened with Cmd/Ctrl-K): the places and the everyday steps, each with its shortcut.
  if (!q.trim()) return { groups: [{ label: 'Common tasks', items: startActions().slice(0, 3).map(asItem) }, { label: 'Places', items: startPlaces().slice(0, 6).map(asItem) }] };
  const res = wordRxs(q);
  const qn = plain(q).replace(/\s/g, ''), lead = b => numOf(b) === qn ? 0 : numOf(b).startsWith(qn) ? 1 : 2, cm = cmteOf(q), co = coalOf(q);
  // A bill row is there for its number or the name it shows (a committee's code shows the bills in it).
  const name = b => nameWords(b, 1e4);   // whole (A-1): a bill named by its summary is never cut
  const shows = b => cm || co || numOf(b).includes(qn) || res.every(re => re.test(plain(`${name(b)} ${STAGE_LABEL[effStage(b)] || ''}`)));
  const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
  const bills = billHits(q).filter(shows).map((b, k) => [b, k])
    .sort((x, y) => lead(x[0]) - lead(y[0]) || (lead(x[0]) === 1 ? diedish(x[0]) - diedish(y[0]) || byNum(x[0], y[0]) : x[1] - y[1])).map(([b]) => ({
      href: billRoute(b), title: name(b), icon: 'scroll-text', inline: true, sub: [numWords(b), stageWords(b)].filter(Boolean).join(' · ') }));
  const cat = k => (S.categories || []).find(c => c.key === k);
  const issues = issueHits(q).map(i => ({ href: `#/issue/${encodeURIComponent(i.id)}`, title: i.name, sub: cat(i.category)?.name || 'Issue', icon: issueIcon(i) }));
  const legs = coalKeep(q, matchLegs(q), l => l.name).map(l => ({ href: `#/legislator/${l.id}`, title: l.name, sub: `${l.chamber === 'S' ? 'Senate' : 'House'} district ${l.district || ''}`.trim(), icon: 'landmark' }));
  const team = teamHits(q).map(a => ({ href: teamHref(a), title: a.full_name, sub: `${ROLE(a)} · their list`, icon: 'user-round' }));
  loadAllNotes();
  const convs = convHits(q).map(g => ({ href: convHref(g), title: `${convWho(g)}: ${saidText(convQuote(g, q, 60))}`, sub: `${convDay(g)} · ${convSub(g)}`, icon: 'message-square' }));
  const profs = PROFILES() ? profileHits(q).map(h => ({ href: h.href, title: `${shortName(h.l)}: ${quoteOf(h.said, q, 60)}`, sub: `Profile · ${h.sec}`, icon: h.x.sec === 'tip' ? 'lightbulb' : 'notebook-pen' })) : [];
  const people = () => peopleHits(q).map(p => ({ href: `#/person/${encodeURIComponent(p.id)}`, title: personName(p), sub: supWhere(p) || 'Supporter', icon: 'user-round' }));
  // Bills not tracked: the same rule, their number or their words (a district, "sd 12", is not a bill search).
  const dist = districtQ(plain(q).trim()), ids = new Set(S.bills.map(b => b.id));
  const unRows = rows => unShown(rows, q).filter(r => !ids.has(r.id) && (numOf(r).includes(qn) || res.every(re => re.test(plain(`${r.title || ''} ${r.description || ''}`)))))
    .map(r => ({ href: `#/search?q=${encodeURIComponent(r.bill_number)}`, title: r.description || titleCaseSmart(r.title || ''), icon: 'scroll-text', inline: true, sub: numWords(r) }));
  // A step first (at most two), then the places (at most three), then what a Capitol word means (at most two); but a place
  // whose name is typed ("coalitions", "partner update") comes first of all, and a place matched on its name comes before
  // steps matched only on their other words (V32, B-10: the critic's "coalitions" gave Email supporters first).
  const norm = x => qWords(x).map(w => w.replace(/s$/, '')).join(' '), nq = norm(q);
  const onTitle = p => { const t = plain(p.title.replace(/[’']/g, '')); return qWords(q).every(w => synOf(w).some(x => starts(t, x))); };
  const rawActs = actionHits(q, 2), rawPlaces = placeHits(q, 3), exact = rawPlaces.filter(p => norm(p.title) === nq);
  const placesFirst = !!exact.length || (!!rawPlaces.length && onTitle(rawPlaces[0]) && !rawActs.some(onTitle));
  const acts = (exact.length ? rawActs.filter(a => !exact.some(p => p.href === a.href)) : rawActs).map(asItem);
  const places = rawPlaces.slice(0, placesFirst || !acts.length ? 3 : 2).filter(p => !acts.some(a => a.href === p.href && a.title === p.title)).map(asItem);
  const wh = wordHits(q), words = wh.slice(0, 2).map(w => ({ href: w.href, title: w.term, sub: firstSentence(w.text), icon: 'book-open' }));
  // A Capitol word leads when it is the word typed ("decking"); a word that only starts one ("late", Lateral) waits behind
  // the things to do (Late testimony, still accepted).
  const wordsLead = wh.some(w => w.whole) || !acts.length;
  const helps = helpHits(q, 1).map(p => ({ href: p.href, title: p.title, sub: p.sub, icon: p.icon }));
  const head = placesFirst ? [{ label: 'Places', items: places }, { label: 'Capitol words', items: words }, { label: 'Things to do', items: acts }]
    : wordsLead ? [{ label: 'Capitol words', items: words }, { label: 'Things to do', items: acts }, { label: 'Places', items: places }]
    : [{ label: 'Things to do', items: acts }, { label: 'Places', items: places }, { label: 'Capitol words', items: words }];
  head.push({ label: 'Help', items: helps });
  // A task or a place named by what was typed ("approve") is the answer: bills not tracked yet whose official titles merely hold the
  // word wait for the full results page, unless a number was typed.
  const quietUn = (rawActs.some(onTitle) || rawPlaces.some(onTitle)) && !/\d/.test(q);
  // Tracked bills before bills not tracked yet: the untracked take rows only after every other kind (Nate's team works on
  // the tracked ones).
  const groups = (ppl, un0) => { const un = quietUn ? [] : un0, [b, i, l, t, f, c, p, u] = share([bills, issues, legs, team, profs, convs, ppl, un], ROWS - acts.length - places.length - words.length - helps.length);
    return [...head, { label: 'Bills', items: b }, { label: 'Not tracked yet', items: u },
      { label: 'Issues', items: i }, { label: 'Legislators', items: l }, { label: 'Teammates', items: t }, { label: 'Profiles', items: f }, { label: 'Conversations', items: c }, { label: 'Supporters', items: p }]; };
  const peopleReady = S.peopleLoaded || (S.people || []).length, lookUn = q.trim().length >= 3 && !(dist && dist[1]) && !cm, key = plain(q).trim();
  if (peopleReady && (!lookUn || unCache.has(key))) return { groups: groups(people(), unRows(unCache.get(key))) };
  if (!peopleReady) peopleP ??= DB.loadPeople().catch(() => {}).finally(() => { peopleP = null; });
  const un = !lookUn ? Promise.resolve([]) : unCache.has(key) ? Promise.resolve(unCache.get(key))
    : DB.searchUntracked(q).then(r => { unCache.set(key, r || []); if (unCache.size > 20) unCache.delete(unCache.keys().next().value); return r || []; });
  return { groups: groups(peopleReady ? people() : [], []), more: Promise.all([peopleP, un]).then(([, r]) => groups(people(), unRows(r))) };
}

// ---- the page's rows (steps.js itemRow and billRow: a name and one line) ----
const list = (rows, label) => `<div class="v6-list sr-list" role="list" aria-label="${esc(label)}">${rows}</div>`;
const placeRowH = p => itemRow({ key: p.href + p.title, name: p.title, line: esc(withKey(p.sub, p.key)), icon: p.icon, href: p.href, cls: 'sr-row' });
// A bill: where it stands, then what it does, since five bills can share one nickname ("Let counties regulate tobacco
// sales") and the summary is what tells them apart (R-271).
const billLine = b => { const sum = blurb(b, 1e4), nm = String(b.nickname || '').trim(), sw = stageWords(b);
  return esc([sw ? `Stage: ${sw}` : '', whereWords(b, { deadline: false }).replace(/ · /g, ', '), sum && sum !== nm ? sum : ''].filter(Boolean).join(' · ')); };
const legLine = (l, week) => { const w = week.get(l.id), parts = [`${l.chamber === 'S' ? 'Senate' : 'House'} district ${l.district || ''}`.trim()];
  if (w) parts.push(`Hears ${plural(w.bills.size, 'of our bills', 'of our bills')} this week`);
  return parts.join(' · '); };
const legRowH = (l, week) => itemRow({ key: l.id, name: l.name, line: esc(legLine(l, week)), href: `#/legislator/${l.id}`, cls: 'sr-row' });
// Under its heading "Not tracked yet": the bill's last action, or nothing (never the heading's words again).
const untrackedRow = r => itemRow({ key: r.id, name: r.description || titleCaseSmart(r.title || ''), num: numWords(r), line: r.last_action ? esc(`${r.last_action}${r.last_action_date ? ' · ' + fmtDate(r.last_action_date) : ''}`) : '',
  href: billRoute(r), button: btn('Track', { kind: 'secondary', sm: true, icon: 'plus', attrs: { 'data-srtrack': r.id, 'aria-label': `Track ${r.bill_number}` } }), cls: 'sr-row' });
const personRowH = p => itemRow({ key: p.id, name: personName(p), line: esc([supWhere(p), p.last_active ? `active ${fmtDate(p.last_active)}` : ''].filter(Boolean).join(' · ') || 'Supporter'), href: `#/person/${encodeURIComponent(p.id)}`, cls: 'sr-row' });
// What was said, with committee names for the codes a chair ask carries ("Asked for a hearing on HB756 (CPN/HHS)": D15).
const saidPlain = t => plainCodes(esc(t));
const saidText = t => saidPlain(t).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const convRowH = (g, q) => itemRow({ key: g.key, name: convWho(g), num: convDay(g), line: `${esc(convSub(g).replace(/ · /g, ', '))}: “${saidPlain(convQuote(g, q, 90))}”`, href: convHref(g), cls: 'sr-row' });
const profRowH = (h, q) => itemRow({ key: h.href, name: shortName(h.l), num: `Profile · ${h.sec}`, line: `“${esc(quoteOf(h.said, q, 100))}”`, href: h.href, cls: 'sr-row' });
const teamRowH = a => itemRow({ key: a.id, name: a.full_name, line: esc(`${ROLE(a)} · see their list`), href: teamHref(a), cls: 'sr-row' });
const issueRowH = i => { const c = (S.categories || []).find(x => x.key === i.category); return itemRow({ key: i.id, name: i.name, line: esc([c?.name || 'Issue', i.description ? String(i.description).replace(/\s+/g, ' ').slice(0, 120) : ''].filter(Boolean).join(' · ')), href: `#/issue/${encodeURIComponent(i.id)}`, cls: 'sr-row' }); };
const wordRowH = w => itemRow({ key: w.term, name: w.term, line: esc(firstSentence(w.text)), href: w.href, cls: 'sr-row sr-word' });
const more = (key, n, shown, label) => n > shown ? `<div class="sr-more">${showAllBtn(n, { 'data-srmore': key }, { what: label })}</div>` : '';
const group = (id, title, n, inner) => `<section class="sr-grp" aria-labelledby="${id}"><h2 class="sr-h" id="${id}"><span>${esc(title)}</span>${n !== '' ? `<span class="sr-n">${n}</span>` : ''}</h2>${inner}</section>`;

function startHTML() {
  // The palette's start: the common tasks that are this person's job, each with its shortcut (V32), and one line for the box.
  // Places only on a phone, which has no sidebar; on a laptop the sidebar beside this page already lists them (css/search.css).
  return `<p class="sr-lede">Type a bill number, a name or a task.${fine() && keysOn() ? ' Cmd or Ctrl and K searches from any page.' : ''}</p>
    <div class="sr-cols">
      ${group('sr-ga', 'Common tasks', '', list(startActions().map(placeRowH).join(''), 'Common tasks'))}
      <div class="sr-startplaces">${group('sr-gp', 'Places', '', list(startPlaces().map(placeRowH).join(''), 'Places'))}</div>
    </div>`;
}
function resultsHTML(q) {
  const s = st();
  if (!q) return startHTML();
  const tracked = billHits(q), ids = new Set(S.bills.map(b => b.id)), nums = new Set(S.bills.map(b => b.bill_number));
  const un = s.un && s.un.q === q ? unShown(s.un.rows, q).filter(r => !ids.has(r.id) && !nums.has(r.bill_number)) : null;
  const legs = coalKeep(q, matchLegs(q), l => l.name), week = weekIndex(), convs = convHits(q), profs = PROFILES() ? profileHits(q) : [], team = teamHits(q), issues = issueHits(q);
  const peopleReady = S.peopleLoaded || (S.people || []).length, people = peopleReady ? peopleHits(q) : [];
  const N = (k, all) => s.more.has(k) ? all.length : SHOW[{ b: 'bills', u: 'un', l: 'legs', c: 'convs', p: 'people', f: 'profs', t: 'team', i: 'issues' }[k]];
  const lookUn = q.length >= 3 && !cmteOf(q);
  const unBlock = !lookUn ? '' : un === null ? `<p class="sr-wait" role="status">${icon('loader-circle', { cls: 'sr-spin' })}<span>Looking through every bill of the session</span></p>`
    : un.length ? `<h3 class="sr-subh">Not tracked yet <span class="sr-n">${un.length}</span></h3>${list(un.slice(0, N('u', un)).map(untrackedRow).join(''), 'Bills not tracked yet')}${more('u', un.length, N('u', un), 'bills not tracked yet')}` : '';
  // What a Capitol word means, the steps and the places that match, above the groups.
  const wd = wordHits(q).slice(0, 4), acts = actionHits(q, 4), pl = placeHits(q, 4).filter(p => !acts.some(a => a.href === p.href && a.title === p.title)), hp = helpHits(q, 4);
  const wG = wd.length ? group('sr-gw', 'Capitol words', wd.length, list(wd.map(wordRowH).join(''), 'Capitol words')) : '';
  const aG = acts.length ? group('sr-ga', 'Things to do', acts.length, list(acts.map(placeRowH).join(''), 'Things to do')) : '';
  const top = [...(wd.some(w => w.whole) || !acts.length ? [wG, aG] : [aG, wG]),
    pl.length ? group('sr-gp', 'Places', pl.length, list(pl.map(placeRowH).join(''), 'Places')) : '',
    hp.length ? group('sr-gh', 'Help', hp.length, list(hp.map(placeRowH).join(''), 'Help guides')) : ''].filter(Boolean);
  const nBills = tracked.length + (un ? un.length : 0), main = [], side = [];
  if (tracked.length || (un && un.length) || un === null && lookUn)
    main.push(group('sr-gb', cmteOf(q) ? `Bills in ${committeeName(cmteOf(q))}` : coalOf(q) ? `${coalOf(q).name}’s bills` : 'Bills', nBills, (tracked.length ? list((sh => { const tw = twinsAmong(sh); return sh.map(b => withBar(glanceRow(billRow(b, { line: billLine(b), button: false, cls: 'sr-row' }), b, { twins: tw }), b)); })(tracked.slice(0, N('b', tracked))).join(''), 'Bills') : '') + more('b', tracked.length, N('b', tracked), 'tracked bills') + unBlock));
  if (issues.length) side.push(group('sr-gi', 'Issues', issues.length, list(issues.slice(0, N('i', issues)).map(issueRowH).join(''), 'Issues') + more('i', issues.length, N('i', issues), 'issues')));
  if (legs.length) side.push(group('sr-gl', 'Legislators', legs.length, list(legs.slice(0, N('l', legs)).map(l => legRowH(l, week)).join(''), 'Legislators') + more('l', legs.length, N('l', legs), 'legislators')));
  if (team.length) side.push(group('sr-gt', 'Teammates', team.length, list(team.slice(0, N('t', team)).map(teamRowH).join(''), 'Teammates') + more('t', team.length, N('t', team), 'teammates')));
  if (profs.length) side.push(group('sr-gf', 'Profiles', profs.length, list(profs.slice(0, N('f', profs)).map(h => profRowH(h, q)).join(''), 'Profiles') + more('f', profs.length, N('f', profs), 'profile lines')));
  if (convs.length) side.push(group('sr-gc', 'Conversations', convs.length, list(convs.slice(0, N('c', convs)).map(g => convRowH(g, q)).join(''), 'Conversations') + more('c', convs.length, N('c', convs), 'conversations')));
  if (!peopleReady) side.push(group('sr-gs', 'Supporters', '', `<p class="sr-wait" role="status">${icon('loader-circle', { cls: 'sr-spin' })}<span>Loading supporters</span></p>`));
  else if (people.length) side.push(group('sr-gs', 'Supporters', people.length, list(people.slice(0, N('p', people)).map(personRowH).join(''), 'Supporters') + more('p', people.length, N('p', people), 'supporters')));
  if (!main.length && !side.length) return top.length ? `<div class="sr-top">${top.join('')}</div>` : `<div class="sr-empty"><p class="sr-empty-h">Nothing matches “${esc(q)}”</p><p>Try a bill number such as HB 1562, a word from its title, a last name or a town. Or look in <a href="#/help">Help</a>.</p></div>`;
  // Each group's heading says its own count, so no sentence repeats them; only the keys, for someone who uses them.
  const sum = keysUsed() && fine() ? `<p class="sr-sum">Up and Down move through the results, Enter opens one.</p>` : '';
  const two = main.length && side.length;
  return `${top.length ? `<div class="sr-top">${top.join('')}</div>` : ''}${sum}<div class="sr-grid${two ? ' two' : ''}">${main.length ? `<div class="sr-col" data-scol="0">${main.join('')}</div>` : ''}${side.length ? `<div class="sr-col" data-scol="${main.length ? 1 : 0}">${side.join('')}</div>` : ''}</div>`;
}

// ---- Up and Down through the results (the list's own keys, like a menu's: only inside the box and the results) ----
const ITEMS = '#sr-res .v6-row-main, #sr-res [data-srtrack], #sr-res .sr-more .btn, #sr-res .sr-empty a';
const items = () => [...document.querySelectorAll(ITEMS)].filter(el => el.offsetParent);
function moveResult(e, box) {
  const all = items(), cur = document.activeElement, i = all.indexOf(cur);
  const go = el => { if (!el) return; e.preventDefault(); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); };
  if (i < 0) { if (e.key === 'ArrowDown' && all.length) go(all[0]); return; }      // from the search box
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); box()?.focus(); return; }
  if (e.key === 'ArrowDown') return go(all[Math.min(all.length - 1, i + 1)]);
  if (e.key === 'ArrowUp') { if (i === 0) { e.preventDefault(); box()?.focus(); } else go(all[i - 1]); return; }
  if (e.key === 'Home') return go(all[0]);
  if (e.key === 'End') return go(all[all.length - 1]);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // the other column, at about the same height
    const col = cur.closest('[data-scol]'), to = document.querySelector(`#sr-res [data-scol="${e.key === 'ArrowRight' ? 1 : 0}"]`);
    if (!col || !to || to === col || getComputedStyle(to.parentElement).display !== 'grid') return;
    const y = cur.getBoundingClientRect().top, cand = all.filter(el => to.contains(el));
    go(cand.sort((a, b) => Math.abs(a.getBoundingClientRect().top - y) - Math.abs(b.getBoundingClientRect().top - y))[0]);
  }
}

export default {
  tab: '', title: () => 'Search',
  wide: () => true,   // two groups side by side need more than the 720px reading column; the CSS caps the page at 1120px
  render(route) {
    const q = qOf(route), s = st();
    if (s.q !== q) { s.q = q; s.more = new Set(); }
    loadAllNotes();   // every conversation, once, when the data layer offers the list
    if (!S.peopleLoaded && !S.peopleLoading && !S.lgPeopleTried) { S.lgPeopleTried = true; DB.loadPeople().then(refresh).catch(() => { S.peopleLoaded = true; S.people ??= []; refresh(); }); }
    return `<div class="sr-page">
      <h1 class="v6-ptitle sv-h1 sr-h1">Search</h1>
      <form class="sr-box" role="search" data-srform novalidate>
        <label class="sr" for="sr-q">Search bills, legislators, teammates, supporters and places</label>
        ${icon('search')}
        <input id="sr-q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Bills, people, places" value="${esc(q)}">
      </form>
      <p class="sr" role="status" id="sr-status"></p>
      <div id="sr-res">${resultsHTML(q)}</div>
    </div>`;
  },
  wire(route, app) {
    const root = app.querySelector('.sr-page'); if (!root) return;
    const s = st(), res = root.querySelector('#sr-res'), own = root.querySelector('#sr-q'), hdr = app.querySelector('#hq');
    const boxes = [own, hdr].filter(Boolean);
    // Rows painted after the frame wired the page still push history (so Back comes back here).
    if (!root.__srlinks) { root.__srlinks = true; root.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.target.closest('[data-srtrack]')) return; e.preventDefault(); S.go(a.getAttribute('href')); }); }
    const paint = () => {
      res.innerHTML = resultsHTML(s.q);
      const n = res.querySelectorAll('.v6-row').length;
      root.querySelector('#sr-status').textContent = s.q ? `${n} result${n === 1 ? '' : 's'} shown` : '';
    };
    repaint = paint;
    // The bills not tracked yet come from the database, a moment after typing stops, and repaint when they land.
    const untracked = () => {
      clearTimeout(s.t); const q = s.q;
      if (q.length < 3 || cmteOf(q) || (s.un && s.un.q === q && s.un.rows)) return;
      s.un = { q, rows: null };
      s.t = setTimeout(async () => {
        try { const rows = await DB.searchUntracked(q); if (s.q === q) { s.un = { q, rows }; paint(); } }
        catch (e) { if (s.q === q) { s.un = { q, rows: [] }; paint(); } toast(e, { err: true }); }
      }, 350);
    };
    // Typing updates the results and the address (replaceState: one Back leaves the search, not one per letter).
    let t;
    const onType = el => { clearTimeout(t); t = setTimeout(() => {
      const q = el.value.trim(); boxes.forEach(b => { if (b !== el) b.value = el.value; });
      if (q === s.q) return; s.q = q; s.more = new Set();
      try { history.replaceState(history.state, '', '#/search' + (q ? '?q=' + encodeURIComponent(q) : '')); } catch { /* ignore */ }
      paint(); untracked();
    }, 120); };
    boxes.forEach(b => { b.value = s.q; b.addEventListener('input', () => onType(b)); });
    const boxNow = () => boxes.find(b => b.offsetParent);
    const keys = e => { if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) moveResult(e, boxNow); };
    res.addEventListener('keydown', keys);
    boxes.forEach(b => b.addEventListener('keydown', e => { if (e.key === 'ArrowDown') keys(e); }));
    // Enter: a bill number that names exactly one tracked bill opens that bill (a number in hand is two steps from its page).
    const openExact = q => { const b = exactBill(q); if (!b) return false; S.go(billRoute(b)); return true; };
    root.querySelector('[data-srform]').onsubmit = e => { e.preventDefault(); if (!openExact(own.value)) own.blur(); };
    const hf = hdr?.closest('form');
    if (hf) hf.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); if (!openExact(hdr.value)) onType(hdr); }, { capture: true });
    // The box on screen takes the focus: with a keyboard even with words in it; on a phone only when empty (its keyboard
    // would cover the results).
    const desk = (() => { try { return matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches; } catch { return false; } })();
    requestAnimationFrame(() => { const f = boxes.find(b => b.offsetParent), at = document.activeElement;
      if (f && at !== f && (!s.q || desk && (!at || at === document.body || at.id === 'main'))) { f.focus({ preventScroll: true }); try { f.setSelectionRange(f.value.length, f.value.length); } catch { /* not a text box */ } } });
    root.addEventListener('click', async e => {
      const m = e.target.closest('[data-srmore]'); if (m) { s.more.add(m.dataset.srmore); paint(); return; }
      const tr = e.target.closest('[data-srtrack]'); if (!tr) return;
      e.preventDefault(); e.stopPropagation();
      const r = (s.un?.rows || []).find(x => String(x.id) === tr.dataset.srtrack); if (!r) return;
      tr.setAttribute('aria-busy', 'true'); tr.disabled = true;
      // DB.track adds the row as it is: give it the empty fields a tracked bill always has, until the next load fills them.
      const bill = Object.assign(r, { referrals: r.referrals || [], sponsors: r.sponsors || [], companions: r.companions || [], session_year: r.session_year || SESSION_YEAR, position: r.position ?? null, priority: r.priority ?? null });
      try {
        await DB.track(bill);
        s.un.rows = s.un.rows.filter(x => x.id !== r.id); paint();
        toast(`${r.bill_number} is now tracked. Set its position and owner.`, { ok: true, action: { label: 'Open', run: () => S.go(`${billRoute(r)}`) } });
      } catch (x) { tr.removeAttribute('aria-busy'); tr.disabled = false; toast(x, { err: true }); }
    });
    untracked();
  },
};
