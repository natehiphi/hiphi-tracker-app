// Holding our bills (#/legislators?view=holding, F139) and who introduced a bill (F140). R-316 W41, live 10/22 (R-329);
// Staff v6 (R-336 spec 6, V23, V24) draws it in the shared row shape.
// - Holding our bills: one row per chair of a committee where our bills wait for a hearing, soonest ask first. A row is the
//   chair's name, their role on our bills and the last contact, with at most one button, "Email the chair", only when the
//   ask is the viewer's own and inside its notice window (D16). The row opens the legislator. Whether anyone has asked comes
//   from the one record of chair asks (steps.js askWords, model.js chairAskOf), so this list, Who to ask and Hearings › Get
//   hearings always agree (X7). On a joint committee each chair is asked on their own: asking one never marks the other
//   (V24, chairAsk below), and the email goes to that chair alone.
// - Committee member lists mark who introduced the bill, or its twin in the other chamber ("Introduced SB3044, the Senate
//   version"): introChip(b, l) and introSort(b, members), drawn by the bill's Committees (pathway.js) and a hearing's page.
//   Their signatures stay as they are (spec 11).
// - In the opening weeks: "2 of your top issues have no bill yet · introduction closes Wed 1/28" (F141), a calm line at
//   the top of Holding. My issues says it too (ISSUES).
// - Last contact (lastContact, contactWords, ensureContacts): the newest logged talk or ask, for every Legislators tab.
import { S, DB, DEMO, DEADLINES, esc } from './data.js';
import { codesOf, stopOf, diedish, wantsHearing, askWords as stopAsk, billByNum, companionsOf, plain, chairIdsOf, legNotesAll, chairAskMail } from './model.js';
import { icon, btn } from './ui.js';
import { chairIds, wirePush } from './push.js';
import { askWords, committeeName, dayWords, firstWords, nameWords, itemRow, nw } from './steps.js';
import { askLine } from './chairask.js';

export const HOLDING = () => true;   // live 10/22 at Nate's go, after W3 (R-329)

const DAY = 864e5;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const mine = b => (S.assignments?.[b.id] || []).includes(S.me?.id);

// ---- who introduced a bill (F140) ----
// A bill's introducers as legislators, the lead first. The Capitol names them by surname ("Kong", "Lee, M."), matched in
// the bill's own chamber, by first initial when two share a surname (as the bill page's W18 links are).
const key = s => plain(String(s || '')).replace(/[^a-z ]/g, '').trim();
export function introLegs(b) {
  const names = [];
  for (const s of b?.sponsors || []) { const n = String(s.n || s.name || s).replace(/\(.*?\)/g, '').trim(); if (/^[A-Z]\.$/.test(n) && names.length) names[names.length - 1] += ', ' + n; else if (n) names.push(n); }
  const ch = /^H/i.test(b?.bill_number || '') ? 'H' : 'S';
  return names.map((nm, i) => { const [last, ini = ''] = nm.split(',').map(key);
    let l = (S.legislators || []).filter(x => x.chamber === ch && key((x.sort_name || '').split(',')[0]) === last);
    if (l.length > 1 && ini) l = l.filter(x => key((x.sort_name || '').split(',')[1] || '').startsWith(ini[0]));
    return l.length === 1 ? { l: l[0], lead: i === 0 } : null; }).filter(Boolean);
}
// What a committee member has to do with this bill: "Lead introducer", "Introduced this bill", "Led SB3044, the Senate
// version", or nothing. `rank`: 0 lead, 1 introducer, 2 led the twin, 3 introduced the twin, 9 neither (to order the list).
export function introOf(b, l) {
  const own = introLegs(b).find(x => x.l.id === l.id);
  if (own) return { rank: own.lead ? 0 : 1, words: own.lead ? 'Lead introducer' : 'Introduced this bill' };
  for (const n of companionsOf(b)) { const c = billByNum(n, b.session_year); if (!c || c.id === b.id) continue;
    const x = introLegs(c).find(y => y.l.id === l.id); if (x) return { rank: x.lead ? 2 : 3, words: `${x.lead ? 'Led' : 'Introduced'} ${c.bill_number}, the ${/^H/i.test(c.bill_number) ? 'House' : 'Senate'} version` }; }
  return null;
}
// introChip(b, l): the same call as before (BILL and HEARINGS draw it); its v6 look is in css/legislators.css.
export const introChip = (b, l) => { if (!HOLDING()) return ''; const x = introOf(b, l); return x ? `<span class="hb-intro">${icon('pencil')}<span>${esc(x.words)}</span></span>` : ''; };
// Leadership first (chairs decide), then the introducers, the lead first, then everyone else (legsOf's order kept).
export const introSort = (b, members) => !HOLDING() ? members : members.map((m, i) => [m, i, m.role !== 'member' ? -1 : introOf(b, m.l)?.rank ?? 9]).sort((x, y) => x[2] - y[2] || x[1] - y[1]).map(x => x[0]);

// ---- last contact (every Legislators tab) ----
// The newest logged talk or chair ask with a legislator (a dated note about them is not a contact, R-335): the practice
// copy's own rows, each opened legislator page's, the chair asks loaded at sign-in, and the newest row per legislator that
// DB.legLatestNotes brings in one request. ensureContacts asks for that once and redraws when it lands.
const noteQ = { asked: false, failed: false };
export function lastContact(l) {
  let best = null;
  const hidden = S.cvHidden || new Set();
  for (const n of [...(S.demoNotes || []), ...(S.legNotes?.[l.id] || []), ...(S.chairAsks || [])]) {
    if (n.legislator_id !== l.id || n.kind === 'note' || hidden.has('n:' + n.id) || (n.conversation_id && hidden.has('c:' + n.conversation_id))) continue;
    const t = new Date(n.created_at).getTime(); if (!best || t > best.t) best = { t, n };
  }
  const x = S.legLast?.[l.id];
  if (x && x.kind !== 'note') { const t = new Date(x.created_at).getTime(); if (!best || t > best.t) best = { t, n: x }; }
  return { loaded: !!S.legLast || noteQ.failed || DEMO, best };
}
// "Last contact Mon 3/16, Kevin" (the viewer is "you"), "No contact yet", or '' while it loads.
export function contactWords(l) {
  const { loaded, best } = lastContact(l);
  if (best) return `Last contact ${dayWords(best.t)}, ${firstWords(best.n.advocate_id)}`;
  return loaded ? 'No contact yet' : '';
}
export function ensureContacts(after) {
  if (DEMO || S.legLast || noteQ.asked || noteQ.failed) return;
  noteQ.asked = true;
  DB.legLatestNotes().catch(() => { noteQ.failed = true; }).finally(() => { noteQ.asked = false; after?.(); });
}

// ---- one chair's ask on one bill (V24) ----
// On a joint committee the ask is per chair. The bill's record (askWords) says "asked" once any chair was asked, so for a
// chair nobody has asked yet this says "Not asked yet · ask by Fri 3/27", and their email goes to them alone. Only a row
// saved as an ask counts (it carries its answer, migration 183): a talk that was not an ask never marks the bill asked.
export function chairAsk(b, chairId) {
  const aw = askWords(b); if (!aw || aw.key === 'scheduled') return aw;
  const ids = chairIdsOf(aw.code); if (ids.length < 2 || !ids.includes(chairId)) return aw;
  const own = legNotesAll().filter(n => n.bill_id === b.id && n.legislator_id === chairId && n.answer && (!n.committee || n.committee === aw.code))
    .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
  if (own.length) {
    const a = { by: own[0].advocate_id, at: new Date(own[0].created_at).getTime(), answer: own.at(-1).answer || 'asked', last: own.at(-1), n: own[0], rows: own };
    return { ...aw, key: a.answer === 'said_no' ? 'said_no' : 'waiting', words: askLine(a), asker: a.by, at: a.at, answer: a.answer };
  }
  if (aw.key === 'waiting' || aw.key === 'said_no') {
    const day = aw.aw && !aw.aw.a.passed ? aw.aw.day : '';
    return { ...aw, key: 'ask', words: `Not asked yet${day ? ` · ask by ${day}` : ''}`, day, by: aw.aw?.a.at ?? null, other: true };
  }
  return aw;
}
// This chair's address: the directory's, else the Capitol's pattern (model.js chairMail's rule).
const mailOf = l => l.email || `${l.chamber === 'S' ? 'sen' : 'rep'}${String(l.sort_name || l.name).split(',')[0].toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov`;
export const chairWho = l => `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(l.sort_name || l.name).split(',')[0].trim()}`;
// The approved chair-ask email (W3) for these bills, to this chair alone, so "Did you send it?" records only them (V24).
export function chairMailFor(l, bills) {
  const aw = bills.length ? askWords(bills[0]) : null; if (!aw?.code) return null;
  const st = stopOf(bills[0]);
  return chairAskMail(aw.code, bills, { dl: st.deadline, to: { who: chairWho(l), email: mailOf(l), legId: l.id }, codes: bills.map(b => askWords(b)?.code || aw.code),
    ...(aw.decide ? { heardAt: st.hearing?.scheduled_at || new Date().toISOString() } : {}) });
}
// The asks with this chair that are the viewer's own: their bill's open ask (they own it, or it was given to them).
export const ownAsk = (b, s) => !!s && ((s.key === 'ask' && mine(b)) || (s.key === 'giving' && s.who === S.me?.id));

// ---- Holding our bills (F139) ----
// The chairs holding our bills: a bill with a position HIPHI wants heard, waiting in a committee with no hearing yet.
// Yours when you own any; everyone's otherwise (Kris owns none).
export function holders() {
  const pool = S.bills.filter(b => b.tracked !== false && wantsHearing(b) && !diedish(b)), own = pool.filter(mine), list = own.length ? own : pool;
  const by = new Map();
  for (const b of list) { const st = stopOf(b); if (st.column !== 'a' || !st.committee || !st.deadline || st.deadline.missed) continue;
    for (const id of chairIds(st.committee)) { if (!by.has(id)) by.set(id, { id, rows: [] }); by.get(id).rows.push({ b, st, aw: stopAsk(st) }); } }
  const out = [...by.values()].map(g => { g.l = (S.legislators || []).find(x => x.id === g.id); g.rows.sort((p, q) => (p.aw?.a.at ?? Infinity) - (q.aw?.a.at ?? Infinity)); g.at = g.rows[0].aw?.a.at ?? Infinity; return g; })
    .filter(g => g.l).sort((p, q) => p.at - q.at || p.l.sort_name.localeCompare(q.l.sort_name));
  return { out, whose: own.length ? 'your bills' : 'the team’s bills', own: own.length > 0 };
}

// Opening weeks (F141): your top issues with no bill yet, while introduction is still open. A fact, not an alarm (D3).
export function introLine() {
  if (!HOLDING() || !S.me) return '';
  const cut = (DEADLINES.introduced || [])[0]?.[1]; if (!cut || new Date(cut + 'T23:59:59-10:00').getTime() < Date.now()) return '';
  const tops = (S.issues || []).filter(i => i.owner_id === S.me.id && (i.recommended || i.top_pick === 'yes') && i.status !== 'retired');
  const none = tops.filter(i => !(S.billIssues || []).some(x => x.issue_id === i.id && S.bills.some(b => b.id === x.bill_id)));
  return none.length ? `<p class="lg6-note">${icon('lightbulb')}<span>${esc(`${none.length} of your top issues ${none.length === 1 ? 'has' : 'have'} no bill yet · introduction closes ${dayWords(cut)}.`)} <a href="#/my-issues">See them</a></span></p>` : '';
}

// The committees this legislator chairs among these bills' committees, in words ("Chair, Senate Health and Human
// Services"); a joint referral names only the half they chair.
export function chairRole(l, codes) {
  const cs = [...new Set(codes.flatMap(codesOf))].filter(k => (S.committeeMembers || []).some(m => m.committee === k && m.role === 'chair' && m.legislator_id === l.id));
  return cs.length ? `Chair, ${cs.map(c => committeeName(c)).join(' and ')}` : '';
}
// One chair as a row: name, role on our bills, last contact; at most one button (D16).
function holdRow(g) {
  const l = g.l, n = g.rows.length;
  const asks = g.rows.map(x => ({ ...x, s: chairAsk(x.b, l.id) }));
  const open = asks.filter(x => x.s && ['ask', 'giving', 'passed'].includes(x.s.key)), asked = asks.filter(x => x.s && ['waiting', 'said_no'].includes(x.s.key));
  const day = open.find(x => x.s.key !== 'passed' && x.s.day)?.s.day || '';
  const what = n === 1 ? nameWords(g.rows[0].b, 40) : plural(n, 'bill');
  const state = !open.length ? (asked.length ? 'asked' : '') : open.every(x => x.s.key === 'passed') ? 'notice time passed'
    : `${asked.length ? `${open.length} not asked yet` : 'not asked yet'}${day ? `, ask by ${day}` : ''}`;
  const line = [chairRole(l, g.rows.map(x => x.st.committee)), [what, state].filter(Boolean).join(', '), contactWords(l)].filter(Boolean).join(' · ');
  const mineOpen = open.filter(x => ownAsk(x.b, x.s) && x.s.by != null && x.s.by - Date.now() <= 7 * DAY);
  const m = mineOpen.length ? chairMailFor(l, mineOpen.map(x => x.b)) : null;
  const button = m ? btn(mineOpen.length > 1 ? `Email about ${mineOpen.length === 2 ? 'both' : `all ${mineOpen.length}`}` : 'Email the chair', { kind: 'secondary', sm: true, icon: 'mail', href: m.href }) : '';
  return itemRow({ key: `hold-${l.id}`, name: `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${l.name}`, line: nw(esc(line)), href: `#/legislator/${l.id}?from=holding`, button, cls: 'lg6-wrap' });
}
export function holdingHTML() {
  const { out, whose } = holders();
  const head = `<p class="lg6-sum">${esc(out.length ? `${plural(out.length, 'chair')} ${out.length === 1 ? 'holds' : 'hold'} ${whose} with no hearing yet, the soonest ask first.` : `No chair holds ${whose} without a hearing.`)}</p>`;
  return `<div class="lg6-hold">${introLine()}${head}${out.length ? `<div class="v6-list lg6-list" role="list" aria-label="${esc(`Chairs holding ${whose}`)}">${out.map(holdRow).join('')}</div>` : ''}</div>`;
}
// Kept for v5 callers: the push board's ask buttons. Holding's own rows need no wiring (links, and the email is a link).
export const wireHolding = (root, after) => wirePush(root, after);
