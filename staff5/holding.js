// R-316 W41 (Show me: on the practice copy until Nate's yes makes HOLDING `() => true`). Who to ask.
// - "Holding our bills" (#/legislators?view=holding): the chairs of the committees where our bills wait for a hearing,
//   soonest ask-by first, each with its bills, whether anyone has asked (push.js, as This week's push board) and the last
//   logged conversation. Kevin could not see the chairs holding HB756, HB1563 and SB2175 in one place.
// - Committee member lists mark who introduced the bill, or its twin in the other chamber ("introduced SB3044, the
//   Senate version"): 18 bills that crossed sat in a committee with someone who introduced their twin, 7 with its lead
//   introducer (SB3202's HLT chair, Rep. Takayama, led HB2206).
// - In the opening weeks: "2 of your top issues have no bill yet · introduction closes Wed 1/28", which no screen said.
import { S, DEMO, DEADLINES, esc, advocate } from './data.js';
import { codesOf, stopOf, diedish, wantsHearing, askWords, billTag, billRoute, billByNum, companionsOf, cmteName, plain } from './model.js';
import { icon, btn } from './ui.js';
import { chairIds, askState, askChip, chairEmailHref, wirePush } from './push.js';
import { chairMail } from './model.js';

export const HOLDING = () => DEMO;

const HST = { timeZone: 'Pacific/Honolulu' };
const dayAt = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const mine = b => (S.assignments?.[b.id] || []).includes(S.me?.id);

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
export const introChip = (b, l) => { if (!HOLDING()) return ''; const x = introOf(b, l); return x ? `<span class="hb-intro">${icon('pencil')}<span>${esc(x.words)}</span></span>` : ''; };
// Leadership first (chairs decide), then the introducers, the lead first, then everyone else (legsOf's order kept).
export const introSort = (b, members) => !HOLDING() ? members : members.map((m, i) => [m, i, m.role !== 'member' ? -1 : introOf(b, m.l)?.rank ?? 9]).sort((x, y) => x[2] - y[2] || x[1] - y[1]).map(x => x[0]);

// The chairs holding our bills: a bill with a position HIPHI wants heard, waiting in a committee with no hearing yet.
// Yours when you own any; everyone's otherwise (Kris owns none).
export function holders() {
  const pool = S.bills.filter(b => b.tracked !== false && wantsHearing(b) && !diedish(b)), own = pool.filter(mine), list = own.length ? own : pool;
  const by = new Map();
  for (const b of list) { const st = stopOf(b); if (st.column !== 'a' || !st.committee || !st.deadline || st.deadline.missed) continue;
    for (const id of chairIds(st.committee)) { if (!by.has(id)) by.set(id, { id, rows: [] }); by.get(id).rows.push({ b, st, aw: askWords(st) }); } }
  const out = [...by.values()].map(g => { g.l = (S.legislators || []).find(x => x.id === g.id); g.rows.sort((p, q) => (p.aw?.a.at ?? Infinity) - (q.aw?.a.at ?? Infinity)); g.at = g.rows[0].aw?.a.at ?? Infinity; return g; })
    .filter(g => g.l).sort((p, q) => p.at - q.at || p.l.sort_name.localeCompare(q.l.sort_name));
  return { out, whose: own.length ? 'your bills' : 'the team’s bills' };
}
const lastWith = id => { const n = [...(S.demoNotes || []), ...Object.values(S.legNotes || {}).flat()].filter(x => x.legislator_id === id).sort((p, q) => String(q.created_at).localeCompare(String(p.created_at)))[0] || S.legLast?.[id];
  return n ? `Last contact ${dayAt(n.created_at)}, ${(advocate(n.advocate_id)?.full_name || 'someone').split(' ')[0]}` : 'No contact logged'; };

// Opening weeks: your top issues with no bill yet, while introduction is still open.
export function introLine() {
  if (!HOLDING() || !S.me) return '';
  const cut = (DEADLINES.introduced || [])[0]?.[1]; if (!cut || new Date(cut + 'T23:59:59-10:00').getTime() < Date.now()) return '';
  const tops = (S.issues || []).filter(i => i.owner_id === S.me.id && (i.recommended || i.top_pick === 'yes') && i.status !== 'retired');
  const none = tops.filter(i => !(S.billIssues || []).some(x => x.issue_id === i.id && S.bills.some(b => b.id === x.bill_id)));
  return none.length ? `<p class="hb-warn">${icon('circle-alert')}<span>${esc(`${none.length} of your top issues ${none.length === 1 ? 'has' : 'have'} no bill yet · introduction closes ${dayAt(cut + 'T12:00:00-10:00')}`)}</span></p>` : '';
}
export function holdingHTML() {
  const { out, whose } = holders();
  const head = `<p class="hb-sum">${esc(out.length ? `${plural(out.length, 'chair')} ${out.length === 1 ? 'holds' : 'hold'} ${whose} with no hearing yet, the soonest ask first.` : `No chair holds ${whose} without a hearing.`)}</p>`;
  const card = g => { const n = g.rows.length, aw = g.rows[0].aw, codes = [...new Set(g.rows.flatMap(x => codesOf(x.st.committee)).filter(k => (S.committeeMembers || []).some(m => m.committee === k && m.role === 'chair' && m.legislator_id === g.id)))];
    const asked = g.rows.filter(x => askState(x.b, x.st.committee).k !== 'none').length, m = chairMail(codes[0]);
    const mail = m ? chairEmailHref({ ...m, who: `${g.l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${g.l.sort_name.split(',')[0]}`, email: g.l.email || m.email.split(',')[0], legId: g.l.id }, g.rows, g.rows[0].st.deadline) : '';
    return `<li class="hb-card"><div class="hb-top"><a class="hb-name" href="#/legislator/${esc(g.l.id)}?from=holding"><b>${esc(`${g.l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${g.l.name}`)}</b></a>
      <span class="hb-meta">${esc([`Chair, ${codes.map(cmteName).join(' and ')}`, plural(n, 'bill'), aw ? (aw.a.passed ? 'notice time passed' : `ask by ${aw.day}`) : '', asked ? `${asked} asked` : 'nobody asked yet', lastWith(g.id)].filter(Boolean).join(' · '))}</span>
      ${mail ? btn(n > 1 ? 'Email about all of them' : 'Email the chair', { kind: 'secondary', sm: true, icon: 'mail', href: mail }) : ''}</div>
      <ul class="hb-bills">${g.rows.map(x => `<li><a href="${billRoute(x.b)}">${billTag(x.b, 60)}</a><span class="hb-end">${x.aw && x.aw.day !== aw?.day ? `<span class="muted">by ${esc(x.aw.day)}</span>` : ''}${askChip(askState(x.b, x.st.committee))}</span></li>`).join('')}</ul></li>`; };
  return `<div class="hb">${introLine()}${head}${out.length ? `<ul class="hb-list">${out.map(card).join('')}</ul>` : ''}</div>`;
}
export const wireHolding = (root, after) => wirePush(root, after);
