// HIPHI Staff v2: Help (#/help, #/help/:topic; plan 3.12). A reference, not a tutorial: the Capitol's words first,
// then short guides, each on its own page so a link can point straight at one (#/help/testimony). One search box
// looks through all of it. Facts that change are read from the data, never typed in: whether email is paused (the
// email setting), who approves (the admin and reviewer flags), the deadlines (the session calendar) and the
// committees. Keyboard shortcuts are listed only where there is a mouse to hover with.
import { S, DEMO, APP_URL, STAGES, esc, fmtDate } from './data.js';
import { glossStage, legislativeDay, PUBLIC_APP, plain } from './model.js';
import { icon, btn, row } from './ui.js';

const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const names = pred => S.advocates.filter(a => pred(a) && a.is_active !== false).map(a => a.full_name);
const orList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
const emailOff = () => (S.emailCfg || {}).enabled === false;
const FR_KEY = DEMO ? 'hiphi2_firstrun_demo' : 'hiphi2_firstrun';
const frGet = () => { try { return JSON.parse(localStorage.getItem(FR_KEY) || '{}'); } catch { return {}; } };
const frSet = p => { try { localStorage.setItem(FR_KEY, JSON.stringify({ ...frGet(), ...p })); } catch { /* private mode */ } };

// ---- the Capitol's words, in plain language (the glossary) ----
const WORDS = [
  ['Legislative day', 'A day the chambers meet. Weekends, recess days and holidays do not count, so "day 42 of 60" is not a calendar count.'],
  ['Referral', 'The committees a bill must pass in each chamber, in order. Three or more in one chamber is a triple referral.'],
  ['Hearing', 'A committee meeting where the bill is heard and anyone can testify. Written testimony is due 24 hours before.'],
  ['48-hour notice', 'A committee must post a hearing at least 48 hours ahead. If its last regular meeting before a deadline is closer than that, only the chair can help.'],
  ['Decision making', 'A later meeting where a committee votes on bills it already heard. No new testimony is taken.'],
  ['Deferred', 'The committee held the bill. For the year, that almost always ends it.'],
  ['Triple filing', 'The last day a triple-referred bill can clear its first committee.'],
  ['Lateral', 'The last day a bill can clear every committee except the money committee in its chamber.'],
  ['Decking', 'The last day a bill can clear the money committee (FIN in the House, WAM in the Senate) so it can get its final vote.'],
  ['Crossover', 'The last day a bill can pass its first chamber and move to the other. The second chamber repeats the same deadlines.'],
  ['Cross back', 'A bill the second chamber changed goes back to where it started, to agree or disagree.'],
  ['Conference', 'House and Senate negotiators settle one version. Final decking is the last day they can agree.'],
  ['Sine die', 'The last day of the session.'],
  ['HD1, SD1, CD1', 'Versions. HD1 is the first House draft, SD1 the first Senate draft, CD1 the conference draft. Testimony written for an older version needs a second look.'],
  ['Companion', 'The same bill introduced in the other chamber, an HB and an SB with the same text. If one stalls, the other may still move.'],
  ['GM', 'A message from the Governor, such as a nomination or a report. Not a bill.'],
];
const STAGE_EXTRA = { vetoed: 'Vetoed by the Governor. The Legislature can override with two-thirds of each chamber.', dead: 'Missed a deadline, was deferred, or failed a vote. It can come back next session.' };

// ---- the guides. Each is { id, title, icon, sub?(), items() -> [[term, html]] or html() } ----
const TOPICS = [
  { id: 'words', title: 'Capitol words', icon: 'book-open', sub: () => `Lateral, decking, sine die and ${WORDS.length - 3} more`, items: () => WORDS.map(([t, d]) => [t, esc(d)]) },
  { id: 'stages', title: 'Stages and deadlines', icon: 'calendar-days', sub: () => { const ld = legislativeDay(); return ld ? ld.text : 'Where a bill can be, and the date it races'; },
    items: () => STAGES.map(([k, l]) => [l, esc(glossStage(k) || STAGE_EXTRA[k] || '')]).filter(([, d]) => d) },
  { id: 'committees', title: 'Committee codes', icon: 'landmark', sub: () => `${Object.keys(S.committees || {}).length} committees and their chairs`,
    items: () => Object.values(S.committees || {}).sort((a, b) => (a.chamber || '').localeCompare(b.chamber || '') || a.code.localeCompare(b.code))
      .map(c => [c.code, `${esc(c.name)}. ${c.chamber === 'S' ? 'Senate' : 'House'}.${c.chair ? ` Chair ${esc(c.chair)}` : ''}${c.vice_chair ? `, vice chair ${esc(c.vice_chair)}` : ''}${c.chair ? '.' : ''}`]) },
  { id: 'testimony', title: 'How testimony works', icon: 'file-text', sub: () => 'Write, review, second approval, file',
    items: () => { const adm = orList(names(a => a.is_admin)) || 'an admin', rev = orList(names(a => a.is_reviewer)) || 'a reviewer';
      return [['1. Write', 'A hearing notice arrives. About an hour later a draft Google Doc is made in Drive for the bill\'s owner (only for bills with a position other than Monitor). The owner writes it and presses <b>Submit for review</b>.'],
        ['2. Review', `An admin (${esc(adm)}) approves it or asks for changes with a note. A change request sends it back to the writer, with the note on their Today list.`],
        ['3. Second approval', `The first testimony on a bill also needs a reviewer (${esc(rev)}). Later testimony on the same bill skips this step.`],
        ['4. File', 'The owner files it on the Capitol site and presses <b>Mark filed</b>, with the confirmation link if there is one. Written testimony is due 24 hours before the hearing.'],
        ['Undo', 'Mark filed, I\'m going, Not for us and removing a bill from a list can be undone for 10 seconds.'],
        ['A new version', 'If the bill changes (HD1, SD1) after the draft was written, Today asks the owner to check the draft against the new version.']]; } },
  { id: 'tabs', title: 'What each tab is for', icon: 'list-todo', sub: () => 'Today, Bills, Legislators and Outreach',
    items: () => [['Today', 'Your list for the day: testimony steps, reviews, replies, emails to approve and follow-ups, grouped by when they are due. Clear it and you are done. <b>Mine</b> is yours; <b>Team</b> adds what others are waiting on. What changed on your bills since yesterday is one folded line.'],
      ['Bills', 'Every tracked bill, grouped by where it stands. Filter, select several to change at once, see muted bills, open the weekly memo or export a CSV. New bills to sort show as a banner.'],
      ['Legislators', 'Every senator and representative: district, committees, how to reach them and where they stand on our bills. <b>This week</b> shows who hears our bills in the next 7 days.'],
      ['Outreach', 'Supporters (everyone HIPHI knows, with segments and follow-ups), Lists (sets of public bills people follow in one tap) and Emails (action alerts, approved by a second person before they go).'],
      ['Your menu', 'Tap your initials, top right, for My settings, Session setup (admins), Help and the current app.']] },
  { id: 'new', title: 'New here?', icon: 'sparkles', sub: () => { const n = newSteps().filter(s => s.done).length; return `${n} of 5 done`; }, html: () => newHTML() },
  { id: 'own', title: 'Owning and following', icon: 'user-check', sub: () => 'Who is asked to do what',
    items: () => [['Owner', 'Responsible for the bill. Drafts are made for the owner, and the testimony steps on Today are the owner\'s (or the writer\'s, or an approver\'s). One owner per bill.'],
      ['Following', 'Puts a bill in your Mine view and on your Today list, and gets you its chat messages. It never gives you a task. Anyone can follow anything.'],
      ['Muting', 'Takes a bill off your lists until its next hearing is posted. A bill with a hearing ahead cannot be muted.'],
      ['Changing owners', 'Anyone can hand a bill to someone else from its page. Only admins change owners for many bills at once.']] },
  { id: 'auto', title: 'What happens on its own', icon: 'rotate-ccw', sub: () => emailOff() ? 'Email is paused right now' : 'Email is on',
    items: () => { const burst = (S.syncCfg || {}).burst_until, hourly = burst && burst >= new Date().toISOString().slice(0, 10);
      return [['Bills', `Synced from the Legislature ${hourly ? `every hour until ${esc(fmtDate(burst))}, then 4 times a day` : '4 times a day'}. Stage, committee, last action and versions are never typed by hand.`],
        ['Hearings', 'Read from the Capitol\'s notice emails every 30 minutes during session. The bill, the calendar event and the Slack alert follow within the hour.'],
        ['Drafts', 'Made from the notice about an hour later, for bills with a position other than Monitor, in Drive under Testimony, the year, the coalition and the bill.'],
        ['Video', 'Each hearing links to the chamber\'s YouTube channel, then to the exact video once it is posted. Staff can fix the link on the bill page.'],
        ['Deadlines', 'A bill still in committee when its deadline passes moves to Did not advance, with the deadline it missed.'],
        ['Email', emailOff() ? '<b>Paused.</b> Nobody gets email from the tracker right now: no action alerts, reminders, digests or public hearing emails. Slack DMs still work.' : '<b>On.</b> Action alerts, hearing emails to supporters, and nudges for people who chose email are sent.']]; } },
  { id: 'public', title: 'The public page and lists', icon: 'globe', sub: () => 'What visitors see, and how to share it',
    items: () => [['What shows', 'Only bills set to show on the public page, with the plain summary and the ask from the bill\'s Public tab. Visitors follow bills or a list and get a five-minute way to testify.'],
      ['Lists', 'A list is a set of public bills. Following a list follows every bill on it, including ones added later.'],
      ['Supporters', 'People who say yes at sign-up to hearing emails, and to HIPHI seeing what they follow, appear under Outreach, then Supporters. Everyone else\'s follows are counts only.'],
      ['Links', `A staff link to a bill looks like ${esc(APP_URL)}#bill=HB1563 and opens in either app. A public link to a list looks like ${esc(PUBLIC_APP())}#list=keiki-health.`],
      ['On hiphi.org', 'Session setup, then Website embed, has the code to put the tracker on any web page.']] },
  { id: 'where', title: 'Where things live', icon: 'map-pin', sub: () => 'Drafts, alerts, the calendar and video',
    items: () => [['Drafts', 'Google Drive, in Testimony, then the year, the coalition and the bill.'], ['Alerts', `Slack ${esc((S.slackCfg || {}).main_channel || '#hearing-alerts')} and each coalition's channel. Your own steps come as DMs or email (My settings).`],
      ['Calendar', 'The HIPHI Hearings Google Calendar.'], ['Video', 'The Senate and House YouTube channels.'], ['Questions', `Ask ${esc(orList(names(a => a.is_admin)) || 'an admin')}.`]] },
  { id: 'keys', title: 'Keyboard shortcuts', icon: 'keyboard', hover: true, sub: () => 'For a keyboard and mouse',
    items: () => [['/', 'Search'], ['g then t, b, l, o or r', 'Go to Today, Bills, Legislators, Outreach or Review'], ['j and k', 'Today: next and previous card'], ['Enter', 'Today: do the card\'s main step'], ['o', 'Today: open the bill'],
      ['a, r, o', 'Review: approve, request changes, open the Doc'], ['Right arrow', 'Review: skip to the next draft'], ['1 to 4', 'Bill: Overview, Activity, Pathway, Public'], ['[ and ]', 'Bill: previous and next bill'],
      ['t, n, l, u', 'Sort new bills: track, not for us, later, undo'], ['Esc', 'Close a sheet, or go back'], ['While typing', 'Shortcuts are off while you type in a field.']] },
];
const topic = id => TOPICS.find(t => t.id === id);
const visible = () => TOPICS.filter(t => !t.hover || HOVER());

// ---- New here?: five things a new teammate does once. Three tick themselves; the other two tick when you go do them.
function newSteps() {
  const o = frGet(), me = S.me;
  const mine = me ? S.bills.filter(b => (S.assignments[b.id] || []).includes(me.id) || S.follows?.has(b.id)).length : 0;
  return [
    { k: 'settings', done: !!o.settings, title: 'Choose how the tracker reaches you', sub: 'Slack DM, email, or only in the app', href: '#/me' },
    { k: 'follow', done: mine >= 3, title: `Follow three bills you care about${mine && mine < 3 ? `, ${mine} of 3` : ''}`, sub: 'Open a bill, then Follow in its menu. Bills you own count.', href: '#/bills' },
    { k: 'bill', done: !!o.bill, title: 'Open a bill and read its Next up card', sub: 'It says what the bill needs and by when', href: '#/bills' },
    { k: 'today', done: !!o.today, title: 'Clear your Today list', sub: 'Each card has one button that does the step', href: '#/' },
    { k: 'own', done: !!o.own, title: 'Read Owning and following', sub: 'Two minutes on who is asked to do what', href: '#/help/own' },
  ];
}
function newHTML() {
  const steps = newSteps(), n = steps.filter(s => s.done).length;
  return `<p class="st-sum"><span class="st-meter" aria-hidden="true"><i style="width:${n * 20}%"></i></span><span>${n} of 5 done</span></p>
    <div class="rows">${steps.map(s => `<a class="row st-newrow${s.done ? ' done' : ''}" href="${s.href}" data-fr="${s.k}"><span class="st-ric">${icon(s.done ? 'circle-check' : 'circle-dashed')}<span class="sr">${s.done ? 'Done:' : 'To do:'}</span></span><span class="body"><span class="title">${esc(s.title)}</span><span class="sub">${esc(s.sub)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`).join('')}</div>`;
}

// ---- search: every entry of every guide, plus the guide titles ----
function results(q) {
  const p = plain(q.trim()); if (!p) return '';
  const hits = [];
  for (const t of visible()) {
    if (!t.items) { if (plain(t.title).includes(p)) hits.push({ t, term: t.title, def: '' }); continue; }
    const titleHit = plain(t.title).includes(p);
    for (const [term, def] of t.items()) { const txt = def.replace(/<[^>]+>/g, ''); if (titleHit || plain(term).includes(p) || plain(txt).includes(p)) hits.push({ t, term, def: txt }); }
  }
  if (!hits.length) return `<p class="st-none" role="status">Nothing in Help mentions "${esc(q.trim())}". Try a shorter word.</p>`;
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
      <section class="st-sec" aria-labelledby="st-hw">
        <div class="st-sechead"><h2 id="st-hw">Capitol words</h2>${btn(`All ${WORDS.length}`, { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/help/words', attrs: { 'aria-label': `All ${WORDS.length} Capitol words` } })}</div>
        <div class="card st-wcard">${dl(first)}</div>
        <div class="btnrow st-acts">${btn('Stages and deadlines', { kind: 'text', sm: true, icon: 'calendar-days', href: '#/help/stages' })}${btn('Committee codes', { kind: 'text', sm: true, icon: 'landmark', href: '#/help/committees' })}</div>
      </section>
      <section class="st-sec" aria-labelledby="st-hg">
        <h2 id="st-hg">Guides</h2>
        <div class="rows">${visible().filter(t => !['words', 'stages', 'committees'].includes(t.id)).map(t => row({ lead: t.icon, title: esc(t.title), sub: esc(t.sub()), href: '#/help/' + t.id })).join('')}</div>
      </section>
    </div>
  </div>`;
}
function renderTopic(t) {
  if (t.id === 'own') frSet({ own: 1 });   // reading it is the step (New here?)
  const body = t.html ? t.html() : `<div class="card st-wcard">${dl(t.items())}</div>`;
  const kbd = t.id === 'keys' && !HOVER() ? `<p class="small muted st-note">${icon('info')} These need a keyboard. They are off on touch screens.</p>` : '';
  return `<div class="st-page st-help st-subpage">
    <a class="st-crumb" href="#/help" data-back>${icon('arrow-left')}<span>Help</span></a>
    <div class="st-head"><h1>${esc(t.title)}</h1></div>${kbd}${body}
  </div>`;
}

export default {
  tab: '',
  title: route => topic(route.topic)?.title || 'Help',
  back: route => topic(route.topic) ? { href: '#/help', label: 'Help' } : null,
  render(route) { const t = topic(route.topic); return t ? renderTopic(t) : renderIndex(); },
  wire(route, root) {
    root.querySelectorAll('[data-fr]').forEach(a => a.addEventListener('click', () => frSet({ [a.dataset.fr]: 1 })));
    const f = root.querySelector('[data-hsform]'); if (!f) return;
    const inp = f.querySelector('input'), res = root.querySelector('#st-hres'), def = root.querySelector('#st-hdefault');
    const wireRes = () => res.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { e.preventDefault(); S.go(a.getAttribute('href')); });
    // Typing updates the results in place, so the box keeps focus and the page does not jump.
    inp.oninput = () => { S.st2HelpQ = inp.value; res.innerHTML = results(inp.value); def.hidden = !!inp.value.trim(); wireRes(); };
    f.onsubmit = e => { e.preventDefault(); res.querySelector('a')?.focus(); };
    wireRes();
  },
};
