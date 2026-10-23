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
// v3 (R-264): the index is the third tab of My issues · All issues · Coalitions (three ways to group bills), and the week's
// pieces (its hearings, its bills at risk, the ones racing the next deadline) are shared with an issue's page (issues.js),
// built from any set of bills. "I support this coalition" lives only here now (My settings no longer lists coalitions).
import { S, DB, DEMO, SESSION_OVER, hooks, esc, fmtDT, fmtDate, advocate } from './data.js';
import { billTag, billSay, diedish, riskOf, stopOf, noticeByFor, roomShort, PUBLIC_APP, hiToday, hstDayOf, billById, askWords } from './model.js';
import { icon, btn, chip, row, empty, toast, switchRow, avatar, pickerSheet, openSheet, sectionNav, clockDay, lateLine } from './ui.js';
import { showAllBtn } from './ui.js';   // R-277 fix 4 (U-4): one "Show all" on every screen
import { plural, isSide, thSort, sortBy, wireTable, DASH, pageHead, afterClose } from './lists.js';
import { iconName } from './lists.js';   // R-277 fix 15: not from setup.js, which loads only when opened
import { issuesOfBill } from './issues.js';
import { sittingOf, goersOf, goingWords, testimonyOf, dueOf, dueTone } from './hearing.js';
import { billSub, wireLinks } from './pathway.js';
import { wantsHearing } from './model.js';
import { PUSH_BOARD, chairBoardHTML, wirePush } from './push.js';   // R-316 W5 (practice copy)
import { rerender } from './bill.js';
import { billRoute } from './model.js';
import { teamFirst, ownerFirst, ownerName } from './model.js';   // R-316 W28
import { isPos, byPri, dayOf, dueWhen, waitingOfBills } from './standing.js';

const WEEK = 7 * 864e5, FOLD = 6, HST = { timeZone: 'Pacific/Honolulu' };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const coalById = id => (S.campaigns || []).find(c => String(c.id) === String(id)) || null;
// R-316 W28 (G3-8): an owner who is turned off says so, here and on the coalitions list (model.js teamFirst).
const first = a => teamFirst(a);
const andList = xs => xs.length < 2 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;

// ---- the numbers, the same on the index and on the page (A-14) ----
const billsOf = c => S.bills.filter(b => b.tracked !== false && (S.billCampaigns[b.id] || []).includes(c.id));
// Live bills with a position: the ones the coalition is working on now (Monitor is a decided position, not work; R-022 decision 5).
const liveOf = c => billsOf(c).filter(b => isPos(b) && !diedish(b));
const unownedOf = c => liveOf(c).filter(b => !(S.assignments[b.id] || []).length).sort(byPri);
const openTodosOf = c => billsOf(c).flatMap(b => (S.todos[b.id] || []).filter(t => !t.done && !t.assignee_id).map(t => ({ t, b })))
  .sort((x, y) => String(x.t.due_date || '9999').localeCompare(String(y.t.due_date || '9999')) || byPri(x.b, y.b));
// Its hearings in the next 7 days ("this week" means the same as the Bills flag), one per sitting, on bills with a
// position; hearings on bills it only monitors stay out, as they are folded away on Today (decision 4). From any set of
// bills: a coalition's here, an issue's on its page (v3).
export function weekOfBills(bills) {
  const now = Date.now(), ids = new Set(bills.filter(isPos).map(b => b.id)), by = new Map();
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || !ids.has(h.bill_id)) continue;
    const t = new Date(h.scheduled_at).getTime(); if (t <= now || t - now > WEEK) continue;
    const k = `${h.committee}|${h.scheduled_at}`; if (!by.has(k)) by.set(k, { t, rows: [] }); by.get(k).rows.push(h);
  }
  return [...by.values()].sort((x, y) => x.t - y.t);
}
export const weekOf = c => weekOfBills(billsOf(c));
// Your support: 'all' (Kris), a list of ids (Saya: CTFH), or nothing yet.
const pref = () => S.me?.prefs?.coalitions;
export const supports = c => { const v = pref(); return v === 'all' || (Array.isArray(v) && v.includes(c.id)); };
// R-316 W45: the link on the coalition's card says where it came from, so partners' visits are counted apart.
const publicLink = c => `${PUBLIC_APP()}?utm_source=coalition-card&utm_campaign=${String(c.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)}#/issue/${encodeURIComponent(c.slug)}`;
const embedUrl = (c, { preview = false } = {}) => { const u = new URL('embed.html', location.href); u.search = ''; u.hash = ''; if (preview && DEMO) u.searchParams.set('demo', '1'); u.searchParams.set('coalition', c.slug); return u.href; };
const embedCode = c => `<iframe id="hiphi-tracker" src="${embedUrl(c)}" title="${esc(`HIPHI: ${c.public_name || c.name} bills`)}" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`;
// The memo for this coalition's partners; from= gives the memo a back link to this page.
// v4 (R-269): the partner update lives on Outreach's Partner update tab (one way in, B-13), opened on this coalition.
const memoHref = c => `#/outreach/partners?coalition=${encodeURIComponent(c.id)}`;
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
const hearWords = n => n ? plural(n, 'hearing') + ' this week' : 'no hearings this week';
// "Lauren · 22 live bills · 3 hearings this week": a coalition in one line, on the index (phone) and on My issues for
// someone who owns no issue (v4, R-269 P7), in the same words.
// W28 (fresh-eyes): an owner who is turned off "needs a new owner" (model.js ownerFirst), as on the coalition's page.
export const coalFactsLine = c => { const f = facts(c); return [f.own ? ownerFirst(f.own) : 'No owner', f.live ? plural(f.live, 'live bill') : 'no live bills', hearWords(f.hear)].join(' · '); };
const colValue = (x, k) => k === 'name' ? x.c.name.toLowerCase() : k === 'owner' ? (x.f.own ? x.f.own.full_name.toLowerCase() : null) : k === 'bills' ? x.f.live : k === 'hear' ? x.f.hear : x.f.you ? 1 : 0;
const youChip = () => chip('You help on it', '', 'badge-check');   // R-277 fix 21 (W-8): "support" read as a position
function indexHTML() {
  const v = pref(), list = (S.campaigns || []).slice().sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name)).map(c => ({ c, f: facts(c) }));
  const mine = Array.isArray(v) ? list.filter(x => x.f.you).map(x => x.c.name) : [];
  // v3: no sentence about what coalitions are (P-4); only whom you support, which the table cannot say when it is all.
  const yours = v === 'all' ? 'You help on every one.' : mine.length ? `You help on ${andList(mine)}.` : '';
  const head = pageHead(sectionNav('issues', 'coalitions'), 'Coalitions', yours ? esc(yours) : '', '');
  if (!list.length) return `<div class="le-page co-index">${head}<div class="le-empty">${empty({ title: 'No coalitions yet', text: 'An admin adds them in Session setup.', action: S.me?.is_admin ? btn('Open Session setup', { href: '#/setup/coalitions' }) : '' })}</div></div>`;
  if (!DESK()) return `<div class="le-page co-index">${head}<div class="rows co-list">${list.map(({ c, f }) => row({ leadHtml: `<span class="lead">${icon(iconName(c.icon))}</span>`, title: esc(c.name),
    // On a phone "You support it" is a line of the row, not a chip beside it that squeezes the row to four lines.
    sub: `${c.public_name && c.public_name !== c.name ? `<span class="co-pub">${esc(c.public_name)}</span>` : ''}<span class="co-cnt">${esc(coalFactsLine(c))}</span>${showYou() && f.you ? `<span class="co-you">${icon('badge-check')}You support it</span>` : ''}`,
    href: `#/coalition/${encodeURIComponent(c.id)}`, cls: 'co-irow' })).join('')}</div></div>`;
  const cols = COLS(), rows = sortBy(list, IDX().sort, colValue);
  const tr = ({ c, f }) => { const href = `#/coalition/${encodeURIComponent(c.id)}`;
    return `<tr data-href="${esc(href)}">
      <td class="c-name"><span class="le-tdlead">${icon(iconName(c.icon))}</span><span class="le-tdbody"><a class="le-tdname" href="${esc(href)}">${esc(c.name)}</a>${c.public_name && c.public_name !== c.name ? `<span class="le-tdsub">${esc(c.public_name)}</span>` : ''}</span></td>
      <td class="c-owner">${f.own ? esc(ownerName(f.own)) : '<span class="co-none">No owner</span>'}</td>
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
  return rows.slice(0, FOLD).join('') + showAllBtn(rows.length, { 'data-comore': key });
}
// A bill's name the Outreach way (R-271): the nickname, then the number small (a bill with no nickname: number, then its plain summary).
const name = b => billTag(b, 90);
const ownerBit = b => { const a = advocate((S.assignments[b.id] || [])[0]); return `<span class="co-own"><span aria-hidden="true">${avatar(a, 20)}</span><span>${a ? esc(a.id === S.me?.id ? 'You' : ownerFirst(a)) : 'No owner'}</span></span>`; };   // W28

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
      <p class="co-meta">${own ? `<span class="co-own"><span aria-hidden="true">${avatar(own, 20)}</span><span>Owner: ${esc(own.id === S.me?.id ? 'you' : ownerName(own))}</span></span>`
        : `<span>No owner${S.me?.is_admin ? ` · <a href="#/setup/coalitions">choose one in Session setup</a>` : ''}</span>`}<span aria-hidden="true">·</span>${live ? `<span>${esc(plural(live, 'live bill'))} with a position</span>` : '<span>No live bills with a position</span>'}<span aria-hidden="true">·</span><a href="${esc(billsHref(c))}">See all its bills</a></p>
    </div>
  </header>
  ${desk ? '' : `<div class="co-acts">${act}</div>`}`;
}

// Your support ("support" is Nate's word, decision 7). The owner has the coalition's bills on Today already, so the
// owner has no switch.
function supportHTML(c) {
  if (!S.me || c.owner_id === S.me.id) return '';
  const v = pref(), on = supports(c);
  // R-277 fix 21 (W-8): "I support CTFH" read as a position on tobacco. The switch says what it is (you help on it) and
  // what it does (its work shows on your Today); "Monitor" stays a position only.
  const help = `Show its work on my Today: its hearings and deadlines, never in the count.${v === 'all' ? ' You help on every coalition.' : ''}`;
  return `<section class="card co-card co-sup" aria-label="Your help">${switchRow('co-sup', `I help on ${esc(c.name)}`, on, esc(help))}</section>`;
}

// Its hearings this week, a row per sitting: when, which committee and room, its bills there (the number first, always),
// the testimony not filed yet and when it is due, and who from the team is going, or that nobody is yet (that is the gap
// a supporter can fill). Each opens the hearing's page. `key` names the fold ("Show all") and `from` the hearing page's
// way back (a coalition's id; an issue's page passes none, and Back is the browser's).
export function hearingsSec(bills, { key, from = '' } = {}) {
  const week = weekOfBills(bills);
  if (!week.length) return sec('co-s1', 'Hearings this week', 0, none('No hearings on its bills in the next 7 days.'));
  // Said once (R-316 W56, FR-8): when nobody is going to any of them, one line above the rows says so instead of
  // "Nobody from the team yet" under each. Once anyone is going, each row says who, as before.
  const nobody = week.length > 1 && week.every(s => !goersOf(sittingOf(s.rows[0])).length);
  const rowOf = s => {
    const h = s.rows[0], goers = goersOf(sittingOf(h));
    const items = s.rows.map(r => ({ h: r, b: S.bills.find(b => b.id === r.bill_id) })).filter(x => x.b).sort((x, y) => byPri(x.b, y.b));
    const d = new Date(s.t), wd = d.toLocaleDateString('en-US', { ...HST, weekday: 'short' }), dn = d.toLocaleDateString('en-US', { ...HST, day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' }), long = d.toLocaleDateString('en-US', { ...HST, weekday: 'long', month: 'long', day: 'numeric' });
    const names = items.slice(0, 3).map(({ b }) => billTag(b, 50)).join(', ') + (items.length > 3 ? ` and ${items.length - 3} more` : '');
    // Testimony not filed yet, in the hearing page's words, with the deadline's tone: amber inside 24 hours, red once past.
    // v4 (R-269, A-5 as amended by R-250): a deadline passed before the sitting has started is late testimony, still
    // taken, amber with the day ("late testimony until tomorrow 9:30 AM"), never red "was due".
    const open = items.map(x => ({ ...x, t: testimonyOf(x.h, x.b) })).filter(x => !x.t.filed);
    let test = '';
    if (open.length) {
      const due = open.map(x => dueOf(x.h)).sort()[0], tone = dueTone(due, h.scheduled_at), n = new Map();
      const lateOpen = new Date(due) <= Date.now() && new Date(h.scheduled_at) > Date.now();
      for (const x of open) n.set(x.t.word, (n.get(x.t.word) || 0) + 1);
      const what = open.length === 1 ? `Testimony ${open[0].t.word}` : `Testimony: ${[...n].map(([w, k]) => `${k} ${w}`).join(', ')}`;
      const when = lateOpen ? lateLine(h.scheduled_at, { lower: true }) : `${tone === 'late' ? 'was due' : 'due'} ${dueWhen(due)}`;
      test = `<span class="co-test${tone ? ' ' + tone : ''}">${icon(tone === 'late' ? 'circle-alert' : tone === 'soon' ? 'clock' : 'file-text')}<span>${esc(`${what} · ${when}`)}</span></span>`;
    }
    return `<a class="row co-hrow" href="#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}">
      <span class="co-date" aria-hidden="true"><b>${esc(wd)}</b><span>${esc(dn)}</span></span>
      <span class="body"><span class="title"><span class="sr">${esc(long)}, </span>${esc(time)} · ${esc(h.committee)} · ${esc(roomShort(h.room))}</span><span class="sub co-hbills">${names}</span>${test}
        ${nobody ? '' : `<span class="co-going">${icon(goers.length ? 'users' : 'user-plus')}<span>${esc(goingWords(goers) || 'Nobody from the team yet')}</span></span>`}</span>
      ${icon('chevron-right', { cls: 'chev' })}</a>`;
  };
  return sec('co-s1', 'Hearings this week', week.length, `${nobody ? `<p class="co-going co-nobody">${icon('user-plus')}<span>Nobody from the team is going to any of the ${week.length} yet.</span></p>` : ''}<div class="rows co-rows">${folded(key + '|h', week.map(rowOf))}</div>`);
}

// At risk: no hearing yet and the deadline a week away or less. The notice line is the real deadline: a committee has
// to post a hearing 48 or 72 hours ahead (model.js noticeByFor).
function riskSec(key, list) {
  const rowOf = ({ b, st }) => {
    // R-316 W1: the count is to when the notice must post ("9d to ask"), as on Today and Bills.
    const nb = noticeByFor(st), dl = st.deadline, aw = askWords(st), left = aw ? aw.chip : dl.days <= 0 ? 'Last day today' : `${dl.days} day${dl.days === 1 ? '' : 's'} left`;
    return `<a class="row co-brow" href="${billRoute(b)}"><span class="body"><span class="title">${name(b)}</span>
      <span class="sub">Needs a hearing in ${esc(st.committee || 'committee')} by ${esc(dayOf(dl.date + 'T12:00:00-10:00'))}${nb ? `. The notice has to post by ${esc(fmtDT(nb))}` : ''}</span>
      <span class="co-facts">${ownerBit(b)}</span></span>
      <span class="end"><span class="sv-count${(aw ? aw.d <= 1 || aw.a.passed : dl.days <= 0) ? ' soon' : ''}">${icon('clock')}${esc(left)}</span>${icon('chevron-right', { cls: 'chev' })}</span></a>`;
  };
  return sec('co-s2', 'At risk before the deadline', list.length, `<div class="rows co-rows">${folded(key + '|r', list.map(rowOf))}</div>`);
}
// The bills racing the deadline after the at-risk week: on Mon 16 March, CTFH had nothing due Thursday and three P1
// bills with no hearing for Mon 3/30, which Saya's Today counted and this page used to call "nothing at risk".
function raceSec(key, w) {
  const rowOf = ({ b, st }) => `<a class="row co-brow" href="${billRoute(b)}"><span class="body"><span class="title">${name(b)}</span>
      <span class="sub">${st.committee ? `Waiting in ${esc(st.committee)}` : 'Waiting for a committee referral'}</span><span class="co-facts">${ownerBit(b)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`;
  return sec('co-s5', `Needs a hearing by ${esc(dayOf(w.next + 'T12:00:00-10:00'))}`, w.race.length, `<div class="rows co-rows">${folded(key + '|n', w.race.map(rowOf))}</div>`);
}
// v4 (R-269): what an all-clear line must never sit above: testimony on these hearings not filed and due within 24 hours
// or late, or a sitting today or tomorrow that nobody from the team is going to (HEAL's page said "Nothing at risk"
// over two hearings due that morning with nobody going).
function pressing(week) {
  const now = Date.now(), today = hstDayOf(now), tmw = hstDayOf(now + 864e5);
  return week.some(s => {
    const day = hstDayOf(s.t);
    if ((day === today || day === tmw) && !goersOf(sittingOf(s.rows[0])).length) return true;
    return s.rows.some(r => { const b = billById(r.bill_id); return !!b && !testimonyOf(r, b).filed && new Date(dueOf(r)).getTime() - now <= 864e5; });
  });
}
// Where a set of bills stands this week, the coalition page's way (v3, R-264: an issue's page leads with it too): the
// hearings, what is clear said once on one ticked line, then its bills at risk and the ones racing the next deadline.
// `clear` adds the caller's own all-clear words (the coalition's owners and to-dos).
// No hearings this week is one of those clear words too, not a heading over a line that says there are none (v3).
// v4 (R-269 P5): the all-clear ("Nothing at risk, …") is said only when all of it is true: nothing at risk, nothing
// pressing this week (above), and the caller's own test (`calm`, false when it has something open); otherwise it is left
// out, and "No hearings in the next 7 days" stays as the fact it is.
export function standWeekHTML(bills, { key, from = '', clear = [], after = '', calm = true } = {}) {
  const w = waitingOfBills(bills), week = weekOfBills(bills), hears = week.length > 0;
  const quiet = calm && !w.risk.length && !pressing(week);
  const ok = [hears ? '' : 'no hearings in the next 7 days', ...(quiet ? ['nothing at risk', ...clear] : [])].filter(Boolean);
  const line = ok.length ? `<p class="co-empty co-clear${hears ? '' : ' co-first'}">${icon('check')}<span>${esc(andList(ok).replace(/^./, x => x.toUpperCase()))}.</span></p>` : '';
  const asks = PUSH_BOARD() ? pushSecs(key, w) : '';
  return `${hears ? hearingsSec(bills, { key, from }) : ''}${line}${asks || `${w.risk.length ? riskSec(key, w.risk) : ''}${w.race.length ? raceSec(key, w) : ''}`}${after}`;
}
// R-316 W5 (practice copy): the same rows as This week's push board. The bills at risk and those racing the next
// deadline, under each deadline, grouped by the chair who must post the notice, one email per chair, and whether anyone
// has asked. Bills HIPHI opposes are left out (W2): a hearing is what we do not want for them.
function pushSecs(key, w) {
  const all = [...w.risk, ...w.race.filter(x => !w.risk.some(y => y.b.id === x.b.id))].filter(x => wantsHearing(x.b) && x.st.deadline?.date);
  if (!all.length) return '';
  const by = new Map(); for (const x of all) { const d = x.st.deadline.date; if (!by.has(d)) by.set(d, []); by.get(d).push(x); }
  return [...by].sort(([p], [q]) => p.localeCompare(q)).map(([d, rows], i) => sec(`co-s2${i ? '-' + i : ''}`, `Needs a hearing by ${esc(dayOf(d + 'T12:00:00-10:00'))}`, rows.length, chairBoardHTML(rows, { owners: true, key: `${key}|${d}` }))).join('');
}
// "Show all" in those sections, for a page that is not this one (the coalition page wires its own below).
export function wireWeek(root, redraw = () => hooks.render()) {
  root.querySelectorAll('[data-comore]').forEach(el => el.onclick = () => { (S.coMore ??= new Set()).add(el.dataset.comore); redraw(); });
  if (PUSH_BOARD()) wirePush(root, redraw);
}
// Live bills nobody owns, each with "Give to…" (one bill at a time here; many at once from Bills, open to everyone since
// R-106). The heading says what is wrong in words: a bold "No owner" under "Owner: Lauren" read as an alarm.
function unownedHTML(c, list) {
  const rowOf = b => `<div class="row co-arow"><a class="co-amain" href="${billRoute(b)}"><span class="title">${name(b)}</span><span class="sub">${esc(billSub(b))}</span></a>
    ${btn('Give to…', { kind: 'secondary', sm: true, attrs: { 'data-coown': b.id, 'aria-haspopup': 'dialog', 'aria-label': `Give ${billSay(b)} to someone` } })}</div>`;
  return sec('co-s3', 'Bills nobody owns', list.length, `<div class="rows co-rows">${folded(c.id + '|o', list.map(rowOf))}</div>`);
}
// To-dos on its bills with nobody on them ("Anyone" on the bill page). Taking one is yours to do, so nobody is messaged
// (064 only tells a person when someone ELSE gives them a to-do).
function todosHTML(c, list) {
  const today = hiToday();
  const rowOf = ({ t, b }) => {
    const late = t.due_date && t.due_date < today, now = t.due_date === today;
    const due = !t.due_date ? '' : late ? `<span class="co-late">${icon('circle-alert')}Overdue, was due ${esc(dayOf(t.due_date))}</span>` : now ? `<span class="co-soon">${icon('clock')}Due today</span>` : `Due ${esc(dayOf(t.due_date))}`;
    return `<div class="row co-arow"><a class="co-amain" href="${billRoute(b)}"><span class="title co-ttl">${esc(t.title)}</span><span class="sub">${name(b)}${due ? ` · ${due}` : ''}</span></a>
      ${btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-cotake': `${b.id}|${t.id}`, 'aria-label': `Take “${t.title}” on ${billSay(b)}` } })}</div>`;
  };
  return sec('co-s4', 'To-dos anyone can take', list.length, `<div class="rows co-rows">${folded(c.id + '|t', list.map(rowOf))}</div>`);
}
// The week after its hearings: what is clear said once, on one ticked line (three empty sections were three headings
// saying nothing), then only the sections with something in them.
// v4 (R-269 P5): "every live bill has an owner, and no open to-dos" only when both hold, and "no open to-dos" counts every
// open to-do on its bills, taken or not (it said so while Kevin's "Send the ask" on HB2121 was open).
function weekHTML(c) {
  const unowned = unownedOf(c), todos = openTodosOf(c), live = liveOf(c).length;
  const anyTodo = billsOf(c).some(b => (S.todos[b.id] || []).some(t => !t.done));
  const calm = !unowned.length && !anyTodo;
  const clear = calm ? [live ? 'every live bill has an owner' : '', 'no open to-dos'] : [];
  return standWeekHTML(billsOf(c), { key: c.id, from: c.id, clear, calm, after: `${unowned.length ? unownedHTML(c, unowned) : ''}${todos.length ? todosHTML(c, todos) : ''}` });
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
    <aside class="sv-aside co-side" aria-label="Sharing with partners, and your help">${shareHTML(c)}${supportHTML(c)}</aside>
  </div></div>`;
}

// ---- actions ----
// Exported for My issues (v4, R-269 P7), whose switches for the coalitions someone does not support yet act the same way;
// `focusSel` is the control that keeps focus after the redraw.
export async function setSupport(c, on, focusSel = '#co-sup') {
  const before = pref(), ids = (S.campaigns || []).map(x => x.id), list = Array.isArray(before) ? before : [];
  // From "every coalition", turning one off keeps the rest as a list; turning one on keeps "every" as it is.
  const next = on ? (before === 'all' ? 'all' : [...new Set([...list, c.id])]) : (before === 'all' ? ids.filter(id => id !== c.id) : list.filter(id => id !== c.id));
  try { await DB.patchPrefs({ coalitions: next }); } catch (e) { rerender(focusSel); toast(e, { err: true }); return; }
  rerender(focusSel);
  toast(on ? `You help on ${c.name}. Its work shows on your Today.` : before === 'all' ? `You no longer help on ${c.name}. You still help on the other ${ids.length - 1}.` : `You no longer help on ${c.name}.`,
    { ok: on, undo: async () => { await DB.patchPrefs({ coalitions: before }); rerender(focusSel); } });
}
function giveTo(b) {
  const owned = id => S.bills.filter(x => (S.assignments[x.id] || []).includes(id) && isPos(x) && !diedish(x)).length;
  pickerSheet({ title: `Who owns ${esc(billSay(b))}?`, value: '',
    options: S.advocates.filter(a => a.is_active !== false).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name))
      .map(a => [a.id, a.id === S.me?.id ? `${a.full_name} (you)` : a.full_name, 'user-round', plural(owned(a.id), 'live bill')]),
    onPick: async id => {
      const a = advocate(id); if (!a) return;
      try { await DB.setOwner(b.id, id); } catch (e) { toast(e, { err: true }); return; }
      rerender();
      toast(`${a.id === S.me?.id ? 'You own' : first(a) + ' owns'} ${billSay(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, null); rerender(); } });
    } });
}
async function takeTodo(key) {
  const [bid, tid] = key.split('|'), b = S.bills.find(x => String(x.id) === bid), t = (S.todos[bid] || []).find(x => String(x.id) === tid);
  if (!b || !t || !S.me) return;
  try { await DB.updateTodo(b.id, t.id, { assignee_id: S.me.id }); } catch (e) { toast(e, { err: true }); return; }
  rerender();
  toast(`It’s yours: “${t.title}” on ${billSay(b)}.`, { ok: true, undo: async () => { await DB.updateTodo(b.id, t.id, { assignee_id: null }); rerender(); } });
}

export default {
  tab: 'myissues',   // v3: the third tab of My issues
  // One coalition is two columns, which need more than the 720px column the frame gives a plain page between 900 and
  // 1099px. The index keeps the frame's own column (v3), so the tab row stands where it does on My issues and All issues.
  wide: route => !!route.id && DESK(),
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
    if (PUSH_BOARD()) wirePush(root, rerender);
    root.querySelector('.co-iss')?.addEventListener('toggle', e => { const s = (S.coIss ??= new Set()); if (e.currentTarget.open) s.add(c.id); else s.delete(c.id); });
  },
};
