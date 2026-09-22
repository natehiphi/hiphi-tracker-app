// Staff v2 · Coalitions (#/coalition and #/coalition/:id, R-022 wave 3 #19). A person comes here to see where one
// coalition stands this week (B-1); the index (#/coalition) is the way in: every coalition with its owner, its live bills
// with a position, its hearings this week, and whether you support it.
// One coalition, for its owner and for the support staff who help it and keep its partners informed (Kris and Saya,
// review 9/21): its hearings in the next 7 days (testimony not filed yet, and who from the team is going), its bills at
// risk before their deadline, the bills racing the deadline after that, the live bills nobody owns, and the to-dos on
// its bills that anyone can take. "I support this coalition" is saved to your own settings (advocates.prefs.coalitions,
// 'all' or a list of ids; decision 7); its owner has the coalition's bills on Today already, so the owner has no switch.
// A Share card, for everyone, holds the public page's link and the website-box code, each with a Copy button, and its
// issues' public pages; "Write a partner update" opens the memo for this coalition's partners.
// The public page: since R-018 the public tracker is organised by issue, and Find lists categories, not coalitions, but
// a coalition's own address (track.html#/issue/<coalition slug>) still opens its page of bills (pub/find.js keeps it for
// the links partners already have). The website box is embed.html?coalition=<slug>.
// Phone: one column. Desktop (900px and wider): the week on the left; support and sharing in a side panel.
import { S, DB, DEMO, SESSION_OVER, esc, fmtDT, fmtDate, advocate } from './data.js';
import { billNum, blurb, diedish, riskOf, stopOf, noticeByFor, roomShort, PUBLIC_APP, hiToday } from './model.js';
import { icon, btn, chip, row, empty, toast, switchRow, avatar, pickerSheet, openSheet } from './ui.js';
import { plural, isSide, thSort, sortBy, wireTable, DASH, pageHead, afterClose } from './lists.js';
import { iconName } from './setup.js';
import { issuesOfBill } from './issues.js';
import { sittingOf, goersOf, goingWords, testimonyOf, dueOf, dueTone } from './hearing.js';
import { billSub, wireLinks } from './pathway.js';
import { rerender } from './bill.js';

const WEEK = 7 * 864e5, FOLD = 6, HST = { timeZone: 'Pacific/Honolulu' };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const coalById = id => (S.campaigns || []).find(c => String(c.id) === String(id)) || null;
const isPos = b => !!b.position && b.position !== 'monitor';
const first = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
const byPri = (a, b) => (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const dayOf = d => fmtDate(d, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');   // "Thu 3/19"
const andList = xs => xs.length < 2 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
const hstDay = t => new Date(t).toLocaleDateString('en-CA', HST);
// "9:30 AM today", "9:30 AM tomorrow", "Mon 9:30 AM": when testimony is due, from a row that already shows the hearing's day.
function dueWhen(iso) {
  const t = new Date(iso).getTime(), time = new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
  const d = hstDay(t), now = Date.now();
  return d === hstDay(now) ? `${time} today` : d === hstDay(now + 864e5) ? `${time} tomorrow` : `${new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short' })} ${time}`;
}

// ---- the numbers, the same on the index and on the page (A-14) ----
const billsOf = c => S.bills.filter(b => b.tracked !== false && (S.billCampaigns[b.id] || []).includes(c.id));
// Live bills with a position: the ones the coalition is working on now (Monitor is a decided position, not work; R-022 decision 5).
const liveOf = c => billsOf(c).filter(b => isPos(b) && !diedish(b));
// Its bills still waiting for a hearing, split the way the weekly memo splits them (model.js memoData): at risk (the app's
// one meaning, a deadline a week away or less; A-14), then the bills racing the next deadline after that week. The pool
// is Today's for a coalition (today.js coalSection runs sessionClock over the same bills: Monitor out, dead bills out),
// so every bill Today counts as "still needs a hearing" is in one of the two lists.
function waitingOf(c) {
  if (SESSION_OVER) return { risk: [], next: null, race: [] };
  const w = billsOf(c).filter(b => b.position !== 'monitor' && !diedish(b)).map(b => ({ b, st: stopOf(b) }))
    .filter(x => x.st.column === 'a' && x.st.deadline && !x.st.deadline.missed);
  const risk = w.filter(x => riskOf(x.b)).map(x => ({ b: x.b, st: riskOf(x.b) })).sort((x, y) => x.st.deadline.days - y.st.deadline.days || byPri(x.b, y.b));
  const later = w.filter(x => !riskOf(x.b)), next = later.map(x => x.st.deadline.date).sort()[0] || null;
  return { risk, next, race: later.filter(x => x.st.deadline.date === next).sort((x, y) => byPri(x.b, y.b)) };
}
const unownedOf = c => liveOf(c).filter(b => !(S.assignments[b.id] || []).length).sort(byPri);
const openTodosOf = c => billsOf(c).flatMap(b => (S.todos[b.id] || []).filter(t => !t.done && !t.assignee_id).map(t => ({ t, b })))
  .sort((x, y) => String(x.t.due_date || '9999').localeCompare(String(y.t.due_date || '9999')) || byPri(x.b, y.b));
// Its hearings in the next 7 days ("this week" means the same as the Bills flag), one per sitting, on bills with a
// position; hearings on bills it only monitors stay out, as they are folded away on Today (decision 4).
export function weekOf(c) {
  const now = Date.now(), ids = new Set(billsOf(c).filter(isPos).map(b => b.id)), by = new Map();
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || !ids.has(h.bill_id)) continue;
    const t = new Date(h.scheduled_at).getTime(); if (t <= now || t - now > WEEK) continue;
    const k = `${h.committee}|${h.scheduled_at}`; if (!by.has(k)) by.set(k, { t, rows: [] }); by.get(k).rows.push(h);
  }
  return [...by.values()].sort((x, y) => x.t - y.t);
}
// Your support: 'all' (Kris), a list of ids (Saya: CTFH), or nothing yet.
const pref = () => S.me?.prefs?.coalitions;
export const supports = c => { const v = pref(); return v === 'all' || (Array.isArray(v) && v.includes(c.id)); };
const publicLink = c => `${PUBLIC_APP()}#/issue/${encodeURIComponent(c.slug)}`;
const embedUrl = (c, { preview = false } = {}) => { const u = new URL('embed.html', location.href); u.search = ''; u.hash = ''; if (preview && DEMO) u.searchParams.set('demo', '1'); u.searchParams.set('coalition', c.slug); return u.href; };
const embedCode = c => `<iframe id="hiphi-tracker" src="${embedUrl(c)}" title="${esc(`HIPHI: ${c.public_name || c.name} bills`)}" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`;
// The memo for this coalition's partners; from= gives the memo a back link to this page.
const memoHref = c => `#/bills/memo?coalition=${encodeURIComponent(c.id)}&audience=partners&from=${encodeURIComponent(c.id)}`;
// Bills, opened on every bill of this coalition (filters.js openCoalition).
const billsHref = c => `#/bills?coalition=${encodeURIComponent(c.id)}`;
// Its issues, from its bills: each has its own public page, which is what R-018 made the public tracker's unit.
function issuesOf(c) {
  const seen = new Map();
  for (const b of billsOf(c)) for (const i of issuesOfBill(b.id)) seen.set(i.id, i);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Copy on the tap (that is what lets the browser write the clipboard); if it refuses, show the text to copy by hand
// (list.js does the same; never window.prompt).
function copyText(text, okMsg, what) {
  const fallback = async () => {
    await afterClose();
    openSheet({ title: `Copy the ${what}`, size: 'auto', body: `<div class="le-sheet"><p class="small">Select it all and copy it.</p><textarea class="le-copybox" readonly rows="${what === 'link' ? 2 : 6}" aria-label="The ${what}">${esc(text)}</textarea></div>`,
      wire: d => { const ta = d.querySelector('textarea'); ta.focus(); ta.select(); } });
  };
  try { navigator.clipboard.writeText(text).then(() => toast(okMsg, { ok: true }), fallback); } catch { fallback(); }
}

// ============================================================================================ the index
const IDX = () => S.coIdx ??= { sort: null };
const showYou = () => Array.isArray(pref()) && pref().length > 0;   // with 'all' or none, a column of the same answer says nothing
const COLS = () => [
  { k: 'name', label: 'Coalition', sort: 1 }, { k: 'owner', label: 'Owner', sort: 1 },
  { k: 'bills', label: 'Live bills', sort: -1, num: true, tip: 'Bills with a position that are still moving' },
  { k: 'hear', label: 'Hearings this week', sort: -1, num: true, tip: 'Hearings in the next 7 days on its bills with a position' },
  ...(showYou() ? [{ k: 'you', label: 'You', sort: -1 }] : []),
];
const facts = c => ({ own: advocate(c.owner_id), live: liveOf(c).length, hear: weekOf(c).length, you: supports(c) });
const colValue = (x, k) => k === 'name' ? x.c.name.toLowerCase() : k === 'owner' ? (x.f.own ? x.f.own.full_name.toLowerCase() : null) : k === 'bills' ? x.f.live : k === 'hear' ? x.f.hear : x.f.you ? 1 : 0;
const youChip = () => chip('You support it', '', 'badge-check');
function indexHTML() {
  const v = pref(), list = (S.campaigns || []).slice().sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name)).map(c => ({ c, f: facts(c) }));
  const mine = Array.isArray(v) ? list.filter(x => x.f.you).map(x => x.c.name) : [];
  const yours = v === 'all' ? 'You support every one.' : mine.length ? `You support ${andList(mine)}.` : '';
  const lede = `The coalitions the team works in: their bills, their week, and who owns each.${yours ? ` <span class="le-sum">${esc(yours)}</span>` : ''}`;
  const head = pageHead('coalitions', 'Coalitions', lede, '');
  if (!list.length) return `<div class="le-page co-index">${head}<div class="le-empty">${empty({ title: 'No coalitions yet', text: 'An admin adds them in Session setup.', action: S.me?.is_admin ? btn('Open Session setup', { href: '#/setup/coalitions' }) : '' })}</div></div>`;
  const hear = n => n ? plural(n, 'hearing') + ' this week' : 'no hearings this week';
  if (!DESK()) return `<div class="le-page co-index">${head}<div class="rows co-list">${list.map(({ c, f }) => row({ leadHtml: `<span class="lead">${icon(iconName(c.icon))}</span>`, title: esc(c.name),
    // On a phone "You support it" is a line of the row, not a chip beside it that squeezes the row to four lines.
    sub: `${c.public_name && c.public_name !== c.name ? `<span class="co-pub">${esc(c.public_name)}</span>` : ''}<span class="co-cnt">${esc([f.own ? first(f.own) : 'No owner', f.live ? plural(f.live, 'live bill') : 'no live bills', hear(f.hear)].join(' · '))}</span>${showYou() && f.you ? `<span class="co-you">${icon('badge-check')}You support it</span>` : ''}`,
    href: `#/coalition/${encodeURIComponent(c.id)}`, cls: 'co-irow' })).join('')}</div></div>`;
  const cols = COLS(), rows = sortBy(list, IDX().sort, colValue);
  const tr = ({ c, f }) => { const href = `#/coalition/${encodeURIComponent(c.id)}`;
    return `<tr data-href="${esc(href)}">
      <td class="c-name"><span class="le-tdlead">${icon(iconName(c.icon))}</span><span class="le-tdbody"><a class="le-tdname" href="${esc(href)}">${esc(c.name)}</a>${c.public_name && c.public_name !== c.name ? `<span class="le-tdsub">${esc(c.public_name)}</span>` : ''}</span></td>
      <td class="c-owner">${f.own ? esc(f.own.full_name) : '<span class="co-none">No owner</span>'}</td>
      <td class="c-bills num">${f.live || DASH}</td><td class="c-hear num">${f.hear || DASH}</td>
      ${showYou() ? `<td class="c-you">${f.you ? youChip() : DASH}</td>` : ''}</tr>`; };
  return `<div class="le-page co-index le-desk${isSide() ? ' le-side' : ''}">${head}
    <div class="le-twrap"><table class="le-table co-table"><caption class="sr">Coalitions, ${plural(list.length, 'coalition')}. Column headers sort. Select a name to open that coalition.</caption>
      <thead><tr>${cols.map(x => thSort(x, IDX().sort)).join('')}</tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div></div>`;
}

// ============================================================================================ one coalition
const sec = (id, title, n, inner) => `<section class="co-sec" aria-labelledby="${id}"><div class="co-sech"><h2 id="${id}">${title}${n ? ` <span class="co-n">${n}</span>` : ''}</h2></div>${inner}</section>`;
const none = text => `<p class="co-empty">${icon('check')}<span>${text}</span></p>`;
// Long lists show their first rows; "Show all" opens the rest in place (remembered for this visit).
function folded(key, rows) {
  if (rows.length <= FOLD + 2 || S.coMore?.has(key)) return rows.join('');
  return rows.slice(0, FOLD).join('') + `<button type="button" class="row co-more" data-comore="${esc(key)}">${icon('chevron-down')}<span>Show all ${rows.length}</span></button>`;
}
// A bill's name the Outreach way: the number, then the nickname (or the plain summary when it has none).
const name = b => `<b>${esc(billNum(b))}</b> ${b.nickname ? `<b>${esc(b.nickname)}</b>` : `<span class="co-t">${esc(blurb(b, 90))}</span>`}`;
const ownerBit = b => { const a = advocate((S.assignments[b.id] || [])[0]); return `<span class="co-own"><span aria-hidden="true">${avatar(a, 20)}</span><span>${a ? esc(a.id === S.me?.id ? 'You' : first(a)) : 'No owner'}</span></span>`; };

function headHTML(c) {
  const own = advocate(c.owner_id), live = liveOf(c).length, desk = DESK();
  // The page's one action. On a desktop it sits at the end of the title row (coalition names are short), which keeps the
  // week within the arrival budget (A-1); on a phone it has its own row under the heading.
  const act = btn('Write a partner update', { kind: 'secondary', icon: 'mail', href: memoHref(c) });
  return `<header class="co-head">
    <span class="co-icon" aria-hidden="true">${icon(iconName(c.icon))}</span>
    <div class="co-hbody">
      <div class="co-trow"><h1>${esc(c.name)}</h1>${desk ? act : ''}</div>
      ${c.public_name && c.public_name !== c.name ? `<p class="co-pubname">On the public tracker: ${esc(c.public_name)}</p>` : ''}
      ${c.description ? `<p class="co-desc">${esc(c.description)}</p>` : ''}
      <p class="co-meta">${own ? `<span class="co-own"><span aria-hidden="true">${avatar(own, 20)}</span><span>Owner: ${esc(own.id === S.me?.id ? 'you' : own.full_name)}</span></span>`
        : `<span>No owner yet${S.me?.is_admin ? ` · <a href="#/setup/coalitions">choose one in Session setup</a>` : ''}</span>`}<span aria-hidden="true">·</span>${live ? `<span>${esc(plural(live, 'live bill'))} with a position</span>` : '<span>No live bills with a position</span>'}<span aria-hidden="true">·</span><a href="${esc(billsHref(c))}">See all its bills</a></p>
    </div>
  </header>
  ${desk ? '' : `<div class="co-acts">${act}</div>`}`;
}

// Your support ("support" is Nate's word, decision 7). The owner has the coalition's bills on Today already, so the
// owner has no switch.
function supportHTML(c) {
  if (!S.me || c.owner_id === S.me.id) return '';
  const v = pref(), on = supports(c);
  const help = v === 'all' ? 'You support every coalition. Its hearings and deadlines show on your Today.' : 'Its hearings and deadlines show on your Today.';
  return `<section class="card co-card co-sup" aria-label="Your support">${switchRow('co-sup', 'I support this coalition', on, esc(help))}</section>`;
}

// Its hearings this week, a row per sitting: when, which committee and room, its bills there (the number first, always),
// the testimony not filed yet and when it is due, and who from the team is going, or that nobody is yet (that is the gap
// a supporter can fill). Each opens the hearing's page.
function hearingsHTML(c) {
  const week = weekOf(c);
  if (!week.length) return sec('co-s1', 'Hearings this week', 0, none('No hearings on its bills in the next 7 days.'));
  const rowOf = s => {
    const h = s.rows[0], goers = goersOf(sittingOf(h));
    const items = s.rows.map(r => ({ h: r, b: S.bills.find(b => b.id === r.bill_id) })).filter(x => x.b).sort((x, y) => byPri(x.b, y.b));
    const d = new Date(s.t), wd = d.toLocaleDateString('en-US', { ...HST, weekday: 'short' }), dn = d.toLocaleDateString('en-US', { ...HST, day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' }), long = d.toLocaleDateString('en-US', { ...HST, weekday: 'long', month: 'long', day: 'numeric' });
    const names = items.slice(0, 3).map(({ b }) => `<b>${esc(billNum(b))}</b> ${esc(b.nickname || blurb(b, 50))}`).join(', ') + (items.length > 3 ? ` and ${items.length - 3} more` : '');
    // Testimony not filed yet, in the hearing page's words, with the deadline's tone: amber inside 24 hours, red once past.
    const open = items.map(x => ({ ...x, t: testimonyOf(x.h, x.b) })).filter(x => !x.t.filed);
    let test = '';
    if (open.length) {
      const due = open.map(x => dueOf(x.h)).sort()[0], tone = dueTone(due), n = new Map();
      for (const x of open) n.set(x.t.word, (n.get(x.t.word) || 0) + 1);
      const what = open.length === 1 ? `Testimony ${open[0].t.word}` : `Testimony: ${[...n].map(([w, k]) => `${k} ${w}`).join(', ')}`;
      test = `<span class="co-test${tone ? ' ' + tone : ''}">${icon(tone === 'late' ? 'circle-alert' : tone === 'soon' ? 'clock' : 'file-text')}<span>${esc(`${what} · ${tone === 'late' ? 'was due' : 'due'} ${dueWhen(due)}`)}</span></span>`;
    }
    return `<a class="row co-hrow" href="#/hearing/${encodeURIComponent(h.id)}?from=${encodeURIComponent(c.id)}">
      <span class="co-date" aria-hidden="true"><b>${esc(wd)}</b><span>${esc(dn)}</span></span>
      <span class="body"><span class="title"><span class="sr">${esc(long)}, </span>${esc(time)} · ${esc(h.committee)} · ${esc(roomShort(h.room))}</span><span class="sub co-hbills">${names}</span>${test}
        <span class="co-going">${icon(goers.length ? 'users' : 'user-plus')}<span>${esc(goingWords(goers) || 'Nobody from the team yet')}</span></span></span>
      ${icon('chevron-right', { cls: 'chev' })}</a>`;
  };
  return sec('co-s1', 'Hearings this week', week.length, `<div class="rows co-rows">${folded(c.id + '|h', week.map(rowOf))}</div>`);
}

// At risk: no hearing yet and the deadline a week away or less. The notice line is the real deadline: a committee has
// to post a hearing 48 hours ahead (model.js noticeByFor).
function riskHTML(c, list) {
  const rowOf = ({ b, st }) => {
    const nb = noticeByFor(st), dl = st.deadline, left = dl.days <= 0 ? 'Last day today' : `${dl.days} day${dl.days === 1 ? '' : 's'} left`;
    return `<a class="row co-brow" href="#/bill/${encodeURIComponent(b.bill_number)}"><span class="body"><span class="title">${name(b)}</span>
      <span class="sub">Needs a hearing in ${esc(st.committee || 'committee')} by ${esc(dayOf(dl.date + 'T12:00:00-10:00'))}${nb ? `. The notice has to post by ${esc(fmtDT(nb))}` : ''}</span>
      <span class="co-facts">${ownerBit(b)}</span></span>
      <span class="end"><span class="sv-count${dl.days <= 0 ? ' soon' : ''}">${icon('clock')}${esc(left)}</span>${icon('chevron-right', { cls: 'chev' })}</span></a>`;
  };
  return sec('co-s2', 'At risk before the deadline', list.length, `<div class="rows co-rows">${folded(c.id + '|r', list.map(rowOf))}</div>`);
}
// The bills racing the deadline after the at-risk week: on Mon 16 March, CTFH had nothing due Thursday and three P1
// bills with no hearing for Mon 3/30, which Saya's Today counted and this page used to call "nothing at risk".
function raceHTML(c, w) {
  const rowOf = ({ b, st }) => `<a class="row co-brow" href="#/bill/${encodeURIComponent(b.bill_number)}"><span class="body"><span class="title">${name(b)}</span>
      <span class="sub">${st.committee ? `Waiting in ${esc(st.committee)}` : 'Waiting for a committee referral'}</span><span class="co-facts">${ownerBit(b)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`;
  return sec('co-s5', `Needs a hearing by ${esc(dayOf(w.next + 'T12:00:00-10:00'))}`, w.race.length, `<div class="rows co-rows">${folded(c.id + '|n', w.race.map(rowOf))}</div>`);
}
// Live bills nobody owns, each with "Give to…" (one bill at a time is open to everyone; many at once is for admins,
// decision 9). The heading says what is wrong in words: a bold "No owner" under "Owner: Lauren" read as an alarm.
function unownedHTML(c, list) {
  const rowOf = b => `<div class="row co-arow"><a class="co-amain" href="#/bill/${encodeURIComponent(b.bill_number)}"><span class="title">${name(b)}</span><span class="sub">${esc(billSub(b))}</span></a>
    ${btn('Give to…', { kind: 'secondary', sm: true, attrs: { 'data-coown': b.id, 'aria-haspopup': 'dialog', 'aria-label': `Give ${b.bill_number} to someone` } })}</div>`;
  return sec('co-s3', 'Bills nobody owns', list.length, `<div class="rows co-rows">${folded(c.id + '|o', list.map(rowOf))}</div>`);
}
// To-dos on its bills with nobody on them ("Anyone" on the bill page). Taking one is yours to do, so nobody is messaged
// (064 only tells a person when someone ELSE gives them a to-do).
function todosHTML(c, list) {
  const today = hiToday();
  const rowOf = ({ t, b }) => {
    const late = t.due_date && t.due_date < today, now = t.due_date === today;
    const due = !t.due_date ? '' : late ? `<span class="co-late">${icon('circle-alert')}Overdue, was due ${esc(dayOf(t.due_date))}</span>` : now ? `<span class="co-soon">${icon('clock')}Due today</span>` : `Due ${esc(dayOf(t.due_date))}`;
    return `<div class="row co-arow"><a class="co-amain" href="#/bill/${encodeURIComponent(b.bill_number)}"><span class="title co-ttl">${esc(t.title)}</span><span class="sub">${name(b)}${due ? ` · ${due}` : ''}</span></a>
      ${btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-cotake': `${b.id}|${t.id}`, 'aria-label': `Take “${t.title}” on ${b.bill_number}` } })}</div>`;
  };
  return sec('co-s4', 'To-dos anyone can take', list.length, `<div class="rows co-rows">${folded(c.id + '|t', list.map(rowOf))}</div>`);
}
// The week after its hearings: what is clear said once, on one ticked line (three empty sections were three headings
// saying nothing), then only the sections with something in them.
function weekHTML(c) {
  const w = waitingOf(c), unowned = unownedOf(c), todos = openTodosOf(c), live = liveOf(c).length;
  const clear = [!w.risk.length ? 'nothing at risk' : '', live && !unowned.length ? 'every live bill has an owner' : '', !todos.length ? 'no open to-dos' : ''].filter(Boolean);
  const line = clear.length ? `<p class="co-empty co-clear">${icon('check')}<span>${esc(andList(clear).replace(/^./, x => x.toUpperCase()))}.</span></p>` : '';
  return `${hearingsHTML(c)}${line}${w.risk.length ? riskHTML(c, w.risk) : ''}${w.race.length ? raceHTML(c, w) : ''}${unowned.length ? unownedHTML(c, unowned) : ''}${todos.length ? todosHTML(c, todos) : ''}`;
}

// Share with partners: the two things to copy (A-20: two actions on the card), with the link itself and a preview as
// plain links, and each issue's public page behind one fold.
function shareHTML(c) {
  const newTab = '<span class="sr"> (opens in a new tab)</span>';
  if (!c.is_public || !c.slug) return `<section class="card co-card co-share" aria-labelledby="co-h-share"><h2 id="co-h-share">Share with partners</h2>
    <p class="co-shnote">${icon('eye-off')}<span>${esc(c.name)} is not on the public tracker, so it has no public page or website box.</span></p></section>`;
  const link = publicLink(c), iss = issuesOf(c), open = !!S.coIss?.has(c.id);
  return `<section class="card co-card co-share" aria-labelledby="co-h-share"><h2 id="co-h-share">Share with partners</h2>
    <div class="co-sh">
      <p class="co-shl">${icon('globe')}<span>Public page</span></p>
      <a class="co-url" href="${esc(link)}" target="_blank" rel="noopener">${esc(link.replace(/^https?:\/\//, ''))}${newTab}</a>
      ${btn('Copy link', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-cocopy': 'link', 'aria-label': 'Copy the public page link' } })}
    </div>
    <div class="co-sh">
      <p class="co-shl">${icon('code')}<span>Website box</span></p>
      <p class="co-shd">Its bills and HIPHI’s positions, on a partner’s own website. <a href="${esc(embedUrl(c, { preview: true }))}" target="_blank" rel="noopener">See it${newTab}</a></p>
      ${btn('Copy code', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-cocopy': 'embed', 'aria-label': 'Copy the website box code' } })}
    </div>
    ${iss.length ? `<details class="co-iss"${open ? ' open' : ''}><summary>${icon('tag')}<span>Its issues on the public tracker (${iss.length})</span>${icon('chevron-down', { cls: 'chev' })}</summary>
      <ul>${iss.map(i => `<li><a href="${esc(`${PUBLIC_APP()}#/issue/${encodeURIComponent(i.slug)}`)}" target="_blank" rel="noopener">${esc(i.name)}${newTab}</a></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

function pageHTML(c) {
  const back = `<a class="co-deskback" href="#/coalition" data-back>${icon('chevron-left')}<span>Coalitions</span></a>`;
  const week = weekHTML(c);
  // A phone leads with the week (P-1, A-1): your support is set once, so it follows the week, before sharing. On a
  // desktop sharing, which is used every week, comes first in the side panel.
  if (!DESK()) return `<div class="co-page">${back}${headHTML(c)}${week}${supportHTML(c)}${shareHTML(c)}</div>`;
  return `<div class="co-page co-desk"><div class="sv-cols co-cols">
    <div class="co-main">${back}${headHTML(c)}${week}</div>
    <aside class="sv-aside co-side" aria-label="Sharing with partners, and your support">${shareHTML(c)}${supportHTML(c)}</aside>
  </div></div>`;
}

// ---- actions ----
async function setSupport(c, on) {
  const before = pref(), ids = (S.campaigns || []).map(x => x.id), list = Array.isArray(before) ? before : [];
  // From "every coalition", turning one off keeps the rest as a list; turning one on keeps "every" as it is.
  const next = on ? (before === 'all' ? 'all' : [...new Set([...list, c.id])]) : (before === 'all' ? ids.filter(id => id !== c.id) : list.filter(id => id !== c.id));
  try { await DB.patchPrefs({ coalitions: next }); } catch (e) { rerender('#co-sup'); toast(e, { err: true }); return; }
  rerender('#co-sup');
  toast(on ? `You support ${c.name}. Its hearings and deadlines show on your Today.` : before === 'all' ? `You no longer support ${c.name}. You still support the other ${ids.length - 1}.` : `You no longer support ${c.name}.`,
    { ok: on, undo: async () => { await DB.patchPrefs({ coalitions: before }); rerender('#co-sup'); } });
}
function giveTo(b) {
  const owned = id => S.bills.filter(x => (S.assignments[x.id] || []).includes(id) && isPos(x) && !diedish(x)).length;
  pickerSheet({ title: `Who owns ${esc(b.bill_number)}?`, value: '',
    options: S.advocates.filter(a => a.is_active !== false).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name))
      .map(a => [a.id, a.id === S.me?.id ? `${a.full_name} (you)` : a.full_name, 'user-round', plural(owned(a.id), 'live bill')]),
    onPick: async id => {
      const a = advocate(id); if (!a) return;
      try { await DB.setOwner(b.id, id); } catch (e) { toast(e, { err: true }); return; }
      rerender();
      toast(`${a.id === S.me?.id ? 'You own' : first(a) + ' owns'} ${b.bill_number} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, null); rerender(); } });
    } });
}
async function takeTodo(key) {
  const [bid, tid] = key.split('|'), b = S.bills.find(x => String(x.id) === bid), t = (S.todos[bid] || []).find(x => String(x.id) === tid);
  if (!b || !t || !S.me) return;
  try { await DB.updateTodo(b.id, t.id, { assignee_id: S.me.id }); } catch (e) { toast(e, { err: true }); return; }
  rerender();
  toast(`It’s yours: “${t.title}” on ${b.bill_number}.`, { ok: true, undo: async () => { await DB.updateTodo(b.id, t.id, { assignee_id: null }); rerender(); } });
}

export default {
  tab: 'outreach',
  // The index is a table that uses the width; one coalition is two columns, which need more than the 720px column
  // the frame gives a plain page between 900 and 1099px.
  wide: route => !route.id || DESK(),
  title: route => route.id ? coalById(route.id)?.name || 'Coalition' : 'Coalitions',
  back: route => route.id ? { href: '#/coalition', label: 'Coalitions' } : null,
  render(route) {
    if (!route.id) return indexHTML();
    const c = coalById(route.id);
    // Never a dead end (B-3): a coalition an admin removed, or a link from another setup.
    if (!c) return `<div class="co-page">${empty({ h: 'h1', title: 'We could not find that coalition', text: 'It may have been removed or renamed in Session setup.', action: btn('See all coalitions', { href: '#/coalition' }) })}</div>`;
    return pageHTML(c);
  },
  wire(route, app) {
    if (!route.id) { const root = app.querySelector('.co-index'); if (root && DESK()) wireTable(root, COLS(), IDX()); return; }
    const c = coalById(route.id), root = app.querySelector('.co-page'); if (!c || !root) return;
    wireLinks(root);
    const sw = root.querySelector('#co-sup'); if (sw) sw.onchange = () => setSupport(c, sw.checked);
    root.querySelectorAll('[data-cocopy]').forEach(el => el.onclick = () => el.dataset.cocopy === 'link'
      ? copyText(publicLink(c), 'Link copied.', 'link') : copyText(embedCode(c), 'Website box code copied.', 'website box code'));
    root.querySelectorAll('[data-coown]').forEach(el => el.onclick = () => { const b = S.bills.find(x => String(x.id) === el.dataset.coown); if (b) giveTo(b); });
    root.querySelectorAll('[data-cotake]').forEach(el => el.onclick = () => takeTodo(el.dataset.cotake));
    root.querySelectorAll('[data-comore]').forEach(el => el.onclick = () => { (S.coMore ??= new Set()).add(el.dataset.comore); rerender(); });
    root.querySelector('.co-iss')?.addEventListener('toggle', e => { const s = (S.coIss ??= new Set()); if (e.currentTarget.open) s.add(c.id); else s.delete(c.id); });
  },
};
