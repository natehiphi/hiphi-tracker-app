// Staff v2 · Search (#/search?q=, plan 3.12). A person comes here to find anything the tracker holds by a word they
// remember (B-1): one box, results grouped Bills · Legislators · Conversations (R-316 H-15) · Supporters. Bills come first: the tracked ones (matched the way the current app's search does: number, title,
// summary, description, committee, referrals, owner, coalition, sponsor, position, stage), then every other bill of
// the session from DB.searchUntracked, each with a Track button (DB.track) that acts at once. On a phone the page has
// its own box; on a desktop the header's box drives this page as you type ("/" focuses it, handled by the frame).
import { S, DB, esc, hooks, fmtDate, owners, effStage, STAGE_LABEL, POSITIONS, capitolUrl, SESSION_YEAR, advocate } from './data.js';
import { plain, diedish, personName, whereOf, titleCaseSmart, exactBill, legNotesAll, legById, billById, hstDayOf, ASK_ANSWERS } from './model.js';
// Build 3, desktop: the groups sit side by side (bills on the left, legislators and supporters on the right), each
// with its count; the arrow keys move through the results from the search box (Down enters the list, Up and Down
// move, Left and Right change column, Home and End jump, Enter opens, Esc returns to the box). Bills are named the
// way the Bills list names them (R-271): nickname in bold, its number small, then the plain summary (five bills share the nickname
// "Let counties regulate tobacco sales", and the summary and status are what tell them apart).
import { icon, btn, empty, toast } from './ui.js';
import { showAllBtn, keysUsed } from './ui.js';   // R-277 fix 4 (U-4): one "Show all" on every screen
import { billSub, wireLinks, shortName, legHref } from './pathway.js';
import { matchLegs, legRow, weekIndex, districtQ } from './legislators.js';
import { blRow } from './bills.js';
import { billRoute } from './model.js';
import { helpTopics, synOf } from './help.js';   // R-277 fix 19: Help's guides are places too; R-316 W29: one list of everyday words

const SHOW = { bills: 8, legs: 5, convs: 5, people: 5 };
const st = () => (S.lgSearch ??= { q: '', more: new Set(), un: null });
const qOf = route => String(route?.q?.q ?? '').trim();
// Repaints only the results of the page on screen (set by wire), so data that arrives while someone types never
// re-renders the page and takes the typing focus away.
let repaint = null;
const refresh = () => { if (repaint && document.getElementById('lg-sres')) repaint(); else hooks.render(); };

// ---- matching ----
function billHits(q) {
  const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''), terms = ql.split(/\s+/).filter(Boolean);
  const hay = b => [b.bill_number, b.nickname, b.title, b.public_summary, b.description, b.committee, (b.referrals || []).join(' '),
    owners(b).map(a => a.full_name + ' ' + a.initials).join(' '), (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)?.name).join(' '),
    (b.sponsors || []).map(x => typeof x === 'string' ? x : x.n || x.name || '').join(' '), POSITIONS.find(p => p[0] === b.position)?.[1], STAGE_LABEL[effStage(b)]].join(' | ').toLowerCase();
  return S.bills.filter(b => b.bill_number.toLowerCase().includes(qn) || terms.every(t => hay(b).includes(t)))
    .sort((a, b) => (diedish(a) - diedish(b)) || (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
}
function peopleHits(q) {
  // "sd 12" or "house 34" is that district, as the Legislators page reads it, not every 12 in a phone number (R-032).
  const dm = districtQ(plain(q).trim());
  if (dm && dm[1]) { const n = +dm[2], sen = dm[1][0] === 's'; return (S.people || []).filter(p => +(sen ? p.senate_district : p.house_district) === n)
    .sort((a, b) => String(b.last_active || '').localeCompare(String(a.last_active || ''))); }
  const terms = plain(q).split(/\s+/).filter(Boolean);
  return (S.people || []).filter(p => { const h = plain([p.name, p.email, p.phone, p.island, (p.tags || []).join(' '), p.senate_district ? `sd ${p.senate_district}` : '', p.house_district ? `hd ${p.house_district}` : ''].join(' ')); return terms.every(t => h.includes(t)); })
    .sort((a, b) => String(b.last_active || '').localeCompare(String(a.last_active || '')));
}

// ---- conversations with legislators (R-316 H-15) ----
// A logged conversation, and every ask to a chair W3 records, is found by what was said, who it was with, who logged it
// and the bill it was about: "kila crosswalk" finds Kris's talk with Rep. Kila about the crosswalk bill, "will schedule"
// the chairs who said so. One meeting with several legislators is one result (its rows share conversation_id); a chair
// ask and its replies are one result too (the same bill and chair), worded by the newest reply. The app holds every
// chair ask from sign-in and each legislator page's conversations once opened (legNotesAll); the rest come from the data
// layer when it offers the whole list (DB.allLegNotes), loaded on the first search, so a search never waits on it.
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
    return { ...g, first, last, day: first.met_on || hstDayOf(first.created_at || Date.now()), legs: [...new Set(rows.map(r => r.legislator_id))].map(legById).filter(Boolean),
      bill: first.bill_id ? billById(first.bill_id) : null, issue: first.issue_id ? (S.issues || []).find(i => i.id === first.issue_id) : null };
  });
}
export function convHits(q) {
  const res = plain(q).split(/\s+/).filter(Boolean).map(t => new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  if (!res.length) return [];
  const hay = g => plain([...g.rows.map(r => r.body), ...g.legs.map(l => `${l.name || ''} ${shortName(l)}`), ...g.rows.map(r => advocate(r.advocate_id)?.full_name),
    g.bill ? `${g.bill.bill_number} ${g.bill.nickname || ''}` : '', g.issue?.name, ...g.rows.map(r => ANSWER[r.answer]), ...g.rows.map(r => r.committee)].filter(Boolean).join(' | '));
  return convGroups().filter(g => res.every(re => re.test(hay(g)))).sort((x, y) => String(y.last.met_on || y.last.created_at).localeCompare(String(x.last.met_on || x.last.created_at)));
}
// Where a result opens: the bill's Activity tab (its Conversations), else the issue's page, else the legislator's.
const convHref = g => g.bill ? billRoute(g.bill, 'activity') : g.issue ? `#/issue/${encodeURIComponent(g.issue.id)}` : g.legs[0] ? legHref(g.legs[0]) : '#/legislators';
const andList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const convWho = g => andList(g.legs.map(shortName)) || 'A legislator';
// "Kris · Mon 3/16 · SB2470 · Will schedule": who logged it, the day, the bill, and a chair's newest answer.
const convSub = g => { const a = advocate(g.first.advocate_id), me = S.me && g.first.advocate_id === S.me.id;
  return [me ? 'You' : String(a?.full_name || '').split(' ')[0], fmtDate(g.day, { weekday: 'short' }).replace(/^(\w{3}),/, '$1'), g.bill?.bill_number,
    g.rows.length > 1 && g.last.answer ? ANSWER[g.last.answer] : ''].filter(Boolean).join(' · '); };
// What was said, from the first word searched for when it is far in, so the reason the result is here shows.
function convQuote(g, q, n = 110) {
  const text = String(g.last.body || g.first.body || '').replace(/\s+/g, ' ').trim(), low = plain(text);
  const at = plain(q).split(/\s+/).filter(Boolean).map(t => low.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const from = at > n - 30 ? text.lastIndexOf(' ', at - 20) + 1 : 0, cut = text.slice(from, from + n);
  return (from ? '…' : '') + cut + (from + n < text.length ? '…' : '');
}

// ---- places (R-277 fix 19, F-1) ----
// Neither search box found a place or a feature: "partner update", "inbox", "sort new bills" and "QR code" said "Nothing
// matches", and "settings" gave 9 bills. Typing now finds the app's places as well, first, at most 3: a word of the
// query must start a word of the place's name or of its other words (the short list of what people call it: "pings" and
// "notifications" are My settings' alerts, "qr" the QR code, "file" How to file at the Capitol). Session setup and Sort new
// bills are for admins only, as their doors are. The QR code stays where it is (D5, held): its place opens it there.
const PLACES = () => [
  { title: 'Inbox', href: '#/inbox', icon: 'inbox', sub: 'Messages, mentions and updates', also: 'messages mentions replies unread' },
  // R-328 B: the groups that write on the tracker, for the people who look after them (as its sidebar link).
  ...(S.me?.is_active !== false && (S.me?.is_admin || S.me?.approves_partners) ? [{ title: 'Partners', href: '#/partners', icon: 'handshake', sub: 'Groups that write on the tracker', also: 'partner groups advocacy groups partner words approve join requests sign-in links invite' }] : []),
  { title: 'Partner update', href: '#/outreach/partners', icon: 'newspaper', sub: 'Outreach', also: 'partners memo weekly memo coalition update' },
  ...(S.me?.is_admin ? [{ title: 'Sort new bills', href: '#/bills/new', icon: 'sparkles', sub: 'Bills', also: 'triage new bills track pass' }] : []),
  { title: 'My settings', href: '#/me', icon: 'settings', sub: 'How the tracker reaches you', also: 'settings preferences account profile' },
  { title: 'My settings: alerts', href: '#/me', icon: 'bell', sub: 'Slack, email or only in the app', also: 'alerts pings notifications reminders nudges slack dm mute quiet' },
  ...(S.me?.is_admin ? [{ title: 'Session setup', href: '#/setup', icon: 'sliders-horizontal', sub: 'Admins', also: 'setup admin calendar deadlines staff' }] : []),
  { title: 'QR code', href: '#/outreach/issues?view=links', icon: 'qr-code', sub: 'Make a link for a partner, with its QR code', also: 'qr poster print first visit link partner link' },
  { title: 'This week’s asks', href: '#/outreach', icon: 'megaphone', sub: 'Outreach', also: 'asks ask newsletter post share kit public ask' },
  { title: 'Emails', href: '#/outreach/emails', icon: 'mail', sub: 'Outreach: supporter emails', also: 'email emails action alert supporter email' },
  { title: 'Supporters', href: '#/outreach/supporters', icon: 'users', sub: 'Outreach', also: 'supporters people contacts segments' },
  // R-316 W29 (S-9): Review, Lists and each coalition (by its short name and its full one) are places too.
  { title: 'Review', href: '#/review', icon: 'user-check', sub: 'Testimony and emails waiting for approval', also: 'approve approval approvals second approval sign off send back review queue' },
  { title: 'Lists', href: '#/outreach/lists', icon: 'list', sub: 'Outreach: shared lists of bills', also: 'list lists collections' },
  ...(S.campaigns || []).map(c => ({ title: c.name, href: `#/coalition/${encodeURIComponent(c.id)}`, icon: 'users', sub: `Coalition${c.public_name && c.public_name !== c.name ? ': ' + c.public_name : ''}`, also: `coalition ${c.public_name || ''}`, code: plain(c.name) })),
  ...helpTopics().map(t => ({ title: t.title, href: `#/help/${t.id}`, icon: t.icon || 'circle-help', sub: 'Help', also: `help ${t.also}`, help: true })),
];
const PL_STOP = new Set(['a', 'an', 'the', 'my', 'to', 'of', 'for', 'how', 'do', 'i', 'is', 'where', 'what', 'page', 'open']);
export function placeHits(q) {
  const ws = plain(q).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !PL_STOP.has(w)); if (!ws.length) return [];
  const starts = (hay, w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}`).test(hay);
  const out = [];
  for (const p of PLACES()) {
    const t = plain(p.title.replace(/’/g, "'")), a = plain(p.also);
    if (!ws.every(w => synOf(w).some(x => starts(t, x) || starts(a, x)))) continue;   // W29: "chair", "log a call" find their guides
    // the name itself first, then a name that starts with the words, then a match on its other words; a place before a Help guide.
    // A coalition's own short name typed exactly ("HEAL") comes first, before the 400 "health" bills.
    const score = (p.code && p.code === ws.join(' ') ? 20 : 0) + (t === ws.join(' ') ? 8 : 0) + ws.filter(w => starts(t, w)).length * 2 + (starts(t, ws[0]) && t.startsWith(ws[0]) ? 1 : 0) - (p.help ? 1 : 0);
    out.push([score, p]);
  }
  return out.sort((x, y) => y[0] - x[0]).slice(0, 3).map(([, p]) => p);
}
const placeItems = q => placeHits(q).map(p => ({ href: p.href, title: p.title, sub: p.sub, icon: p.icon }));

// ---- the header's suggestions as you type (R-032; pub/suggest.js draws them, the public header's too) ----
// Seven rows at most under the header box on a desktop, shared out so every kind that matches shows: tracked bills
// (this page's matches in this page's order, an exact or leading number first), bills not tracked yet (Nate, 9/26:
// "This should search every bill, not just those that the app is actively tracking"), issues, legislators (by name,
// district, town or committee, as the Legislators page finds them) and supporters. A bill not tracked yet opens this
// page at that bill, where its Track button is: the bill page only knows tracked bills. Supporters load on first use
// on the live tracker, as here; bills not tracked come from the database, from the third character, as here.
const ROWS = 7;
const numOf = b => b.bill_number.toLowerCase().replace(/\s/g, '');
const spacedNum = n => String(n).replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
function share(lists, rows = ROWS) {   // a row for each kind in turn, until seven
  const n = lists.map(() => 0); let left = rows, more = true;
  while (left && more) { more = false; lists.forEach((l, k) => { if (left && n[k] < l.length) { n[k]++; left--; more = true; } }); }
  return lists.map((l, k) => l.slice(0, n[k]));
}
let peopleP = null;
const unCache = new Map();   // query -> bills not tracked, the last 20 asked
export function headerHits(q) {
  // Words match where a word starts, as on the public page ("bus" finds buses, not the "bus" inside "abuse").
  const res = plain(q).split(/\s+/).filter(Boolean).map(t => new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  const qn = plain(q).replace(/\s/g, ''), lead = b => numOf(b) === qn ? 0 : numOf(b).startsWith(qn) ? 1 : 2;
  // A bill row's own words are why it is there: its number, or the name it shows. This page also finds bills by
  // sponsor, owner or committee, but six bills a legislator sponsored listed above that legislator hid them.
  const name = b => b.nickname || b.public_summary || titleCaseSmart(b.title || '');
  const shows = b => numOf(b).includes(qn) || res.every(re => re.test(plain(`${name(b)} ${STAGE_LABEL[effStage(b)] || ''}`)));
  const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
  const bills = billHits(q).filter(shows).map((b, k) => [b, k])
    .sort((x, y) => lead(x[0]) - lead(y[0]) || (lead(x[0]) === 1 ? diedish(x[0]) - diedish(y[0]) || byNum(x[0], y[0]) : x[1] - y[1])).map(([b]) => ({   // a number's matches: moving ones first, in number order
    href: billRoute(b), title: name(b), icon: 'scroll-text', inline: true,
    sub: [spacedNum(b.bill_number), STAGE_LABEL[effStage(b)]].filter(Boolean).join(' · ') }));
  const cat = k => (S.categories || []).find(c => c.key === k);
  const issues = (S.issues || []).filter(i => !i.archived_at && res.every(re => re.test(plain(`${i.name} ${i.description || ''}`))))
    .map(i => ({ href: `#/issue/${encodeURIComponent(i.id)}`, title: i.name, sub: cat(i.category)?.name || '', icon: cat(i.category)?.icon || 'tag' }));
  const legs = matchLegs(q).map(l => ({ href: `#/legislator/${l.id}`, title: l.name, sub: `${l.chamber === 'S' ? 'Senate' : 'House'} district ${l.district || ''}`.trim(), icon: 'landmark' }));
  loadAllNotes();   // R-316 H-15
  const convs = convHits(q).map(g => ({ href: convHref(g), title: `${convWho(g)}: ${convQuote(g, q, 60)}`, sub: convSub(g), icon: 'message-square' }));
  const people = () => peopleHits(q).map(p => ({ href: `#/person/${encodeURIComponent(p.id)}`, title: personName(p), sub: whereOf(p) || p.email || '', icon: 'user-round' }));
  // Bills not tracked: the same rule, their number or the words they show (the database also matches inside words).
  // Governor's messages (appointments) only by their number; a district ("sd 12") is not a bill search.
  const dist = districtQ(plain(q).trim()), ids = new Set(S.bills.map(b => b.id));
  const unRows = rows => (rows || []).filter(r => !ids.has(r.id) && (numOf(r).includes(qn) || !/^gm/i.test(r.bill_number) && res.every(re => re.test(plain(`${r.title || ''} ${r.description || ''}`)))))
    .map(r => ({ href: `#/search?q=${encodeURIComponent(r.bill_number)}`, title: r.description || titleCaseSmart(r.title || ''), icon: 'scroll-text', inline: true,
      sub: [spacedNum(r.bill_number), STAGE_LABEL[r.stage]].filter(Boolean).join(' · ') }));
  const places = placeItems(q);   // R-277 fix 19: first, and they take their rows before the rest share the seven
  const groups = (ppl, un) => { const [b, u, i, l, c, p] = share([bills, un, issues, legs, convs, ppl], ROWS - places.length);
    return [{ label: 'Places', items: places }, { label: 'Bills', items: b }, { label: 'Not tracked yet', items: u }, { label: 'Issues', items: i }, { label: 'Legislators', items: l }, { label: 'Conversations', items: c }, { label: 'Supporters', items: p }]; };
  const peopleReady = S.peopleLoaded || (S.people || []).length, lookUn = q.trim().length >= 3 && !(dist && dist[1]), key = plain(q).trim();
  if (peopleReady && (!lookUn || unCache.has(key))) return { groups: groups(people(), unRows(unCache.get(key))) };
  if (!peopleReady) peopleP ??= DB.loadPeople().catch(() => {}).finally(() => { peopleP = null; });
  const un = !lookUn ? Promise.resolve([]) : unCache.has(key) ? Promise.resolve(unCache.get(key))
    : DB.searchUntracked(q).then(r => { unCache.set(key, r || []); if (unCache.size > 20) unCache.delete(unCache.keys().next().value); return r || []; });
  return { groups: groups(peopleReady ? people() : [], []), more: Promise.all([peopleP, un]).then(([, r]) => groups(people(), unRows(r))) };
}

// ---- rows ----
const untrackedRow = r => `<div class="row lg-urow" data-lgurow="${esc(r.id)}">
  <span class="body"><span class="title"><a class="lg-ulink" href="${billRoute(r)}"><b>${esc(r.bill_number)}</b> <span class="lg-bt">${esc(r.description || titleCaseSmart(r.title || ''))}</span></a></span>${r.last_action ? `<span class="sub">${esc(`${r.last_action}${r.last_action_date ? ' · ' + fmtDate(r.last_action_date) : ''}`)}</span>` : ''}</span>
  <span class="lg-uacts">${btn('Track', { kind: 'secondary', sm: true, icon: 'plus', attrs: { 'data-lgtrack': r.id, 'aria-label': `Track ${r.bill_number}` } })}<a class="iconbtn" href="${esc(capitolUrl(r))}" target="_blank" rel="noopener" aria-label="${esc(r.bill_number)} on the Capitol site" title="Capitol page">${icon('external-link')}</a></span>
</div>`;
const personRow = p => {
  const act = p.last_active ? `active ${fmtDate(p.last_active)}` : '';
  return `<a class="row lg-prow" href="#/person/${encodeURIComponent(p.id)}"><span class="lead">${icon('user-round')}</span><span class="body"><span class="title">${esc(personName(p))}</span><span class="sub">${esc([whereOf(p), act].filter(Boolean).join(' · ') || p.email || '')}</span></span><span class="end">${p.actions ? `${p.actions} action${p.actions === 1 ? '' : 's'}` : ''}${icon('chevron-right', { cls: 'chev' })}</span></a>`;
};
const convRow = (g, q) => `<a class="row lg-prow lg-cvrow" href="${esc(convHref(g))}"><span class="lead">${icon('message-square')}</span><span class="body"><span class="title">${esc(convWho(g))}</span><span class="sub">${esc(convSub(g))}</span><span class="lg-cvq">${esc(convQuote(g, q))}</span></span><span class="end">${icon('chevron-right', { cls: 'chev' })}</span></a>`;
const more = (key, n, shown, label) => n > shown ? showAllBtn(n, { 'data-lgsmore': key }, { what: label, cls: 'lg-more' }) : '';
const group = (id, title, n, inner) => `<section class="rows lg-grp" aria-labelledby="${id}"><h2 class="sv-group" id="${id}"><span>${title}</span><span class="n">${n}</span></h2>${inner}</section>`;

const nOf = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
function resultsHTML(q) {
  const s = st();
  if (!q) return empty({ title: 'Search everything', text: 'Find bills by number or words, legislators by name, town or district, conversations with legislators by what was said, supporters by name or email, and the app’s places, such as the Inbox or the partner update.' });
  // untracked bills: only when the query is long enough to mean something (the current app's rule, 3 characters)
  const tracked = billHits(q), ids = new Set(S.bills.map(b => b.id)), nums = new Set(S.bills.map(b => b.bill_number));
  const un = s.un && s.un.q === q ? (s.un.rows || []).filter(r => !ids.has(r.id) && !nums.has(r.bill_number)) : null;
  const legs = matchLegs(q), week = weekIndex(), convs = convHits(q);
  const peopleReady = S.peopleLoaded || (S.people || []).length, people = peopleReady ? peopleHits(q) : [];
  const nb = s.more.has('b') ? tracked.length : SHOW.bills, nl = s.more.has('l') ? legs.length : SHOW.legs, np = s.more.has('p') ? people.length : SHOW.people, nc = s.more.has('c') ? convs.length : SHOW.convs;
  const unBlock = q.length < 3 ? '' : un === null ? `<div class="row lg-snote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Looking through every bill of the session</span></div>`
    : un.length ? `<h3 class="lg-subh">Not tracked yet <span class="lg-n">${un.length}</span></h3>${un.map(untrackedRow).join('')}` : '';
  const main = [], side = [];
  // R-277 fix 19: the places that match, at most 3, above the groups.
  const pl = placeHits(q), plHTML = pl.length ? `<section class="rows lg-grp lg-places" aria-labelledby="lg-gpl"><h2 class="sv-group" id="lg-gpl"><span>Places</span><span class="n">${pl.length}</span></h2>${pl.map(p => `<a class="row lg-plrow" href="${esc(p.href)}"><span class="lead">${icon(p.icon)}</span><span class="body"><span class="title">${esc(p.title)}</span><span class="sub">${esc(p.sub || '')}</span></span><span class="end">${icon('chevron-right', { cls: 'chev' })}</span></a>`).join('')}</section>` : '';
  const nBills = tracked.length + (un ? un.length : 0);
  if (tracked.length || (un && un.length) || un === null && q.length >= 3)
    main.push(group('lg-gb', 'Bills', nBills, tracked.slice(0, nb).map(b => blRow(b, { sub: esc(billSub(b)), href: `${billRoute(b)}` })).join('') + more('b', tracked.length, nb, 'tracked bills') + unBlock));
  if (legs.length) side.push(group('lg-gl', 'Legislators', legs.length, legs.slice(0, nl).map(l => legRow(l, { week })).join('') + more('l', legs.length, nl, 'legislators')));
  if (convs.length) side.push(group('lg-gc', 'Conversations', convs.length, convs.slice(0, nc).map(g => convRow(g, q)).join('') + more('c', convs.length, nc, 'conversations')));
  if (!peopleReady) side.push(group('lg-gp', 'Supporters', '', `<div class="row lg-snote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Loading supporters</span></div>`));
  else if (people.length) side.push(group('lg-gp', 'Supporters', people.length, people.slice(0, np).map(personRow).join('') + more('p', people.length, np, 'supporters')));
  if (!main.length && !side.length) return plHTML || empty({ title: `Nothing matches “${esc(q)}”`, text: 'Try a bill number such as HB1562, a word from its title, a last name or a town.' });
  // What was found, in words, above the groups (each group's header repeats its own count).
  const parts = [nBills ? nOf(nBills, 'bill', 'bills') : '', legs.length ? nOf(legs.length, 'legislator', 'legislators') : '', convs.length ? nOf(convs.length, 'conversation', 'conversations') : '', people.length ? nOf(people.length, 'supporter', 'supporters') : ''].filter(Boolean);
  const sum = parts.length ? `<p class="st-ssum">${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]} for “${esc(q)}”${keysUsed() ? '<span class="st-skeys"> · The arrow keys move through the results, Enter opens one</span>' : ''}</p>` : '';
  const two = main.length && side.length;
  return `${plHTML}${sum}<div class="st-sgrid${two ? ' st-two' : ''}">${main.length ? `<div class="st-scol" data-scol="0">${main.join('')}</div>` : ''}${side.length ? `<div class="st-scol${two ? ' st-sside' : ''}" data-scol="1">${side.join('')}</div>` : ''}</div>`;
}

// ---- arrow keys through the results (they are the list's own keys, like a menu's, not shortcuts: they only act
// inside the search box and the results, so they never fire on a stray letter) ----
const ITEMS = '#lg-sres a.row, #lg-sres .lg-urow [data-lgtrack], #lg-sres .lg-more';
const items = () => [...document.querySelectorAll(ITEMS)].filter(el => el.offsetParent);
function moveResult(e, box) {
  const list = items(), cur = document.activeElement, i = list.indexOf(cur);
  const go = el => { if (!el) return; e.preventDefault(); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); };
  if (i < 0) { if (e.key === 'ArrowDown' && list.length) go(list[0]); return; }      // from the search box
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); box()?.focus(); return; }
  if (e.key === 'ArrowDown') return go(list[Math.min(list.length - 1, i + 1)]);
  if (e.key === 'ArrowUp') { if (i === 0) { e.preventDefault(); box()?.focus(); } else go(list[i - 1]); return; }
  if (e.key === 'Home') return go(list[0]);
  if (e.key === 'End') return go(list[list.length - 1]);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // the other column, at about the same height
    const col = cur.closest('[data-scol]'), to = document.querySelector(`#lg-sres [data-scol="${e.key === 'ArrowRight' ? 1 : 0}"]`);
    if (!col || !to || to === col || getComputedStyle(to.parentElement).display !== 'grid') return;
    const y = cur.getBoundingClientRect().top, cand = list.filter(el => to.contains(el));
    go(cand.sort((a, b) => Math.abs(a.getBoundingClientRect().top - y) - Math.abs(b.getBoundingClientRect().top - y))[0]);
  }
}

export default {
  tab: '', title: () => 'Search',
  wide: () => true,   // the frame's 720px column (900 to 1099px) cannot hold two groups side by side; the CSS caps the page at 1120px
  render(route) {
    const q = qOf(route), s = st();
    if (s.q !== q) { s.q = q; s.more = new Set(); }
    // Supporters load on first use on the live tracker (the sandbox has them already).
    loadAllNotes();   // R-316 H-15: every conversation, once, when the data layer offers the list
    if (!S.peopleLoaded && !S.peopleLoading && !S.lgPeopleTried) { S.lgPeopleTried = true; DB.loadPeople().then(refresh).catch(() => { S.peopleLoaded = true; S.people ??= []; refresh(); }); }
    return `<div class="lg-search st-srch">
      <h1 class="lg-dtitle">Search</h1>
      <form class="searchbox lg-sbox lg-sphone" role="search" data-lgsform novalidate>
        <label class="sr" for="lg-sq">Search bills, legislators, conversations and supporters</label>
        ${icon('search')}
        <input id="lg-sq" class="input" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Bills, legislators, supporters" value="${esc(q)}">
      </form>
      <p class="sr" role="status" id="lg-sstatus"></p>
      <div id="lg-sres">${resultsHTML(q)}</div>
    </div>`;
  },
  wire(route, app) {
    const root = app.querySelector('.lg-search'); if (!root) return;
    const s = st(), res = root.querySelector('#lg-sres'), own = root.querySelector('#lg-sq'), hdr = app.querySelector('#hq');
    const boxes = [own, hdr].filter(Boolean);
    wireLinks(root);
    const paint = () => {
      res.innerHTML = resultsHTML(s.q);
      const n = res.querySelectorAll('.row[href], .lg-urow').length;
      root.querySelector('#lg-sstatus').textContent = s.q ? `${n} result${n === 1 ? '' : 's'} shown` : '';
    };
    repaint = paint;
    // The untracked half comes from the database, debounced, and repaints when it lands.
    const untracked = () => {
      clearTimeout(s.t); const q = s.q;
      if (q.length < 3 || (s.un && s.un.q === q && s.un.rows)) return;
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
    // Down from the box goes into the results; inside them the arrow keys move, and Esc comes back to the box.
    const boxNow = () => boxes.find(b => b.offsetParent);
    const keys = e => { if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) moveResult(e, boxNow); };
    res.addEventListener('keydown', keys);
    boxes.forEach(b => b.addEventListener('keydown', e => { if (e.key === 'ArrowDown') keys(e); }));
    // Enter in either box: a bill number that names exactly one tracked bill opens that bill (B-2: a number in hand is
    // two steps from its page, and a results page in between made it four; R-022). The header box does the same on
    // every other page. Anything else keeps this page (the header's own submit would push another history entry).
    const openExact = q => { const b = exactBill(q); if (!b) return false; S.go(billRoute(b)); return true; };
    root.querySelector('[data-lgsform]').onsubmit = e => { e.preventDefault(); if (!openExact(own.value)) own.blur(); };
    const hf = hdr?.closest('form');
    if (hf) hf.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); if (!openExact(hdr.value)) onType(hdr); }, { capture: true });
    // Focus the box that is on screen (the page's on a phone, the header's on a desktop).
    // With a keyboard and a mouse the box takes the focus on arrival even with words in it (type on, or press Down for
    // the results); a phone only when it is empty, so its keyboard does not cover the results.
    const fine = (() => { try { return matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches; } catch { return false; } })();
    requestAnimationFrame(() => { const f = boxes.find(b => b.offsetParent), at = document.activeElement;
      if (f && at !== f && (!s.q || fine && (!at || at === document.body || at.id === 'main'))) { f.focus({ preventScroll: true }); try { f.setSelectionRange(f.value.length, f.value.length); } catch { /* not a text box */ } } });
    root.addEventListener('click', async e => {
      const m = e.target.closest('[data-lgsmore]'); if (m) { s.more.add({ b: 'b', l: 'l', c: 'c', p: 'p' }[m.dataset.lgsmore]); paint(); return; }
      const tr = e.target.closest('[data-lgtrack]'); if (!tr) return;
      const r = (s.un?.rows || []).find(x => String(x.id) === tr.dataset.lgtrack); if (!r) return;
      tr.setAttribute('aria-busy', 'true'); tr.disabled = true;
      // DB.track adds the row to the tracked list as it is; give it the empty fields a tracked bill always has so every
      // screen can show it before the next load fills them in.
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
