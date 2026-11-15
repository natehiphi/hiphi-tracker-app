// Staff7's find box (R-398, Nate's yes 14 Nov): ONE text box, the same everywhere, and nothing else to filter with. It finds an issue, one of our bills, a committee or a legislator, and a bill nobody on the team tracks.
// Where it shows: at the top of the left column on Home, a step page and Issues (under Mine / A teammate / Everyone), in the header of Calendar, and it is the Search door's page (#/search).
//   - Empty and focused: "Recently opened" (the last five things this person opened, kept in this browser only, never in the database).
//   - Words typed: a panel of four groups (Issues, Our bills, Committees and legislators, Other bills at the Legislature), capped, with "See all N results" (#/search?q=) always in view at its foot.
//   - On Issues the words narrow the left list in place instead (issues.js draws it; this file only tells it the words) and the rest is "Also found" under it. The words live in the address (q) and are written
//     with history.replaceState, so nothing is drawn again by render() on a key: the caret and the focus never move.
//   - The Search door lists the results (five to a group, "Show all N" for the rest), and the right side is the picked committee, legislator or bill not tracked (a short look-only sheet).
// ONE matching function serves all of it: a typed word must START a word (case, kahakō, ʻokina and punctuation do not matter); every word must be found; one letter is not enough.
// Inside a group the order is: an exact bill number, then alive before stopped, then names that match before reasons that do (topic, lead, number), then how well the name fits, then the soonest hearing,
// then the viewer's own, then bills on an issue before bills on none, then the order the app already uses. Nothing here writes to the database.
import { S, DB, DEMO, advocate, capitolUrl, myIssueIds, isMine } from '../staff6/data.js';
import { hearingAhead, billRef, billByRef, stopOf, titleCaseTitle } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc, plainBand } from './parts.js';
import { billName, billNo, cmteWords, first, issueOf } from './steps.js';
import { billsOfIssue, isAlive } from './standing.js';
import { pathOf } from './path.js';
import { eCig, issueHref, billHref, hearTxt, posLine, whereShort, tint, iconOf, catsOf, statesFor, nextCtx, sitKeyOf, ui as issuesUi, bindFolds } from './issues.js';

const enc = encodeURIComponent;
const $ = id => document.getElementById(id);
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
export const PLACEHOLDER = 'Find an issue, a bill or a person';
export const HINT = 'Type a bill number, a name, a topic or a person.';
const CAPS = { issues: 3, bills: 3, people: 2, other: 2 };
const DOOR_ROWS = 5;
const TITLES = { issues: 'Issues', bills: 'Our bills', people: 'Committees and legislators', other: 'Other bills at the Legislature' };
const NOUNS = { issues: 'issues', bills: 'bills', people: 'committees and legislators', other: 'other bills' };
const ORDER = ['issues', 'bills', 'people', 'other'];
const WAIT = 150;   // ms after the last key before the Legislature's other bills are asked for
const SEEN = 36;    // a matched word further along a name than this is behind the row's cut: the name is not marked

// ---------------------------------------------------------------------------------- matching: one function for everything
// Case, diacritics (the kahakō), the ʻokina and every apostrophe, and punctuation do not matter: "hawaii" finds "Hawaiʻi", "hb1562", "HB 1562" and "1562" find HB 1562. "&" is read as "and".
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[ʻ‘’ʼ'`]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const VAPE = /^vap(e|es|ing)?$/;   // typing "vape" finds the e-cigarette issues and bills (the app never says "vape" itself, CLAUDE.md R-158)
// The words of a query, each with the spellings that count as finding it. Nothing at all until some word has two letters ("a b" asks for nothing).
export const matchWords = q => {
  const ws = norm(q).split(' ').filter(Boolean).slice(0, 8);
  return ws.length && Math.max(...ws.map(w => w.length)) >= 2 ? ws.map(w => (VAPE.test(w) ? [w, 'cigarette'] : [w])) : [];
};
const startsWord = (hay, a) => (' ' + hay).includes(' ' + a);   // hay is norm()ed: words with one space between
const has = (hay, ws) => ws.length > 0 && ws.every(alts => alts.some(a => startsWord(hay, a)));
const numForms = x => { const t = norm(x); return `${t} ${t.replace(/ /g, '')}`; };   // "HB 1562": "hb 1562 hb1562"
// How well a name fits (the words are norm()ed already): 0 an exact bill number, 1 the name starts with the words, 2 every word starts a word of the name
function tierOf(primary, nq, numbers) {
  const compact = nq.replace(/ /g, '');
  if (numbers && numbers.some(x => norm(x).replace(/ /g, '') === compact || (/^\d+$/.test(compact) && String(x).replace(/\D/g, '') === compact))) return 0;   // "1562" is the number of HB 1562 and SB 1562
  return norm(primary).startsWith(nq) ? 1 : 2;
}
// The matched letters marked, on the ORIGINAL letters (a kahakō, an ʻokina or "&" in the text does not shift them). Words are marked at the start of a word only.
// `vis`: when the first match is further along than this, the row's name is cut before it and nothing is marked.
export function mark(text, q, vis = 0) {
  const t = String(text ?? ''), ws = matchWords(q).flat(); if (!ws.length) return esc(t);
  let nt = ''; const at = [];
  for (let i = 0; i < t.length; i++) {
    const b = t[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/^[ʻ‘’ʼ'`]$/.test(b)) continue;
    if (b === '&') { for (const c of ' and ') { nt += c; at.push(i); } continue; }
    for (const c of b) { nt += /[a-z0-9]/.test(c) ? c : ' '; at.push(i); }
  }
  const on = new Array(t.length).fill(false);
  for (const w of ws) for (let s = nt.indexOf(w); s >= 0; s = nt.indexOf(w, s + 1)) if (s === 0 || nt[s - 1] === ' ') for (let k = s; k < s + w.length; k++) on[at[k]] = true;
  if (vis && on.indexOf(true) >= vis) return esc(t);
  let out = '', open = false;
  for (let i = 0; i < t.length; i++) { if (on[i] !== open) { out += open ? '</mark>' : '<mark>'; open = on[i]; } out += esc(t[i]); }
  return out + (open ? '</mark>' : '');
}
// a bill number: marked as letters, or whole when the words found it with the space left out ("hb1562")
const markNo = (no, q) => { const m = mark(no, q); if (m.includes('<mark>')) return m; const c = norm(no).replace(/ /g, ''); return matchWords(q).flat().some(w => /\d/.test(w) && c.startsWith(w)) ? `<mark>${esc(no)}</mark>` : esc(no); };
const say0 = q => esc(eCig(q));   // the words typed, said back in the app's own words
const clip = (t, k = 150) => { t = String(t); if (t.length <= k) return t; const c = t.slice(0, k).replace(/\s+\S*$/, ''); return (c || t.slice(0, k)).replace(/[,;:.]+$/, '') + '…'; };
const spaced = num => String(num || '').replace(/\s/g, '').replace(/^([A-Za-z]+)(\d)/, '$1 $2').toUpperCase();
const bareNo = num => String(num || '').replace(/\s/g, '').toUpperCase();

// ---------------------------------------------------------------------------------- the index: what each thing can be found by (built once for each drawn page, on first use)
const live = id => !!id && advocate(id)?.is_active !== false;
const person = id => (live(id) ? advocate(id) : null);
const legOf = id => (S.legislators || []).find(l => String(l.id) === String(id));
let IDX = null;
const catName = k => (S.categories || []).find(c => c.key === k)?.name || 'Other';
const topicName = i => catName(catsOf(i)[0]);
const leadPhrase = a => (S.me && a.id === S.me.id ? 'You lead' : `${first(a)} leads`);
function build() {
  const now = Date.now(), soon = new Map();   // bill id -> its soonest coming hearing
  for (const h of S.hearings || []) { const t = new Date(h.scheduled_at).getTime(); if (h.status === 'scheduled' && t > now && (!soon.has(h.bill_id) || t < soon.get(h.bill_id))) soon.set(h.bill_id, t); }
  let mine = new Set(); try { mine = new Set([...myIssueIds()].map(String)); } catch { /* none */ }
  const part = (kind, text, hay) => ({ kind, text, hay: norm(hay ?? text) });
  const issues = (S.issues || []).filter(i => !i.archived_at).map(i => {
    const bills = billsOfIssue(i), lead = person(i.owner_id), name = eCig(i.name), alive = bills.filter(isAlive);
    const parts = [...catsOf(i).map(k => part('topic', catName(k))), ...(lead ? [part('lead', leadPhrase(lead), lead.full_name)] : []), ...bills.map(b => part('no', spaced(b.bill_number), numForms(b.bill_number) + ' ' + numForms(billNo(b))))];
    const nameHay = norm(`${i.name} ${name}`);
    return { kind: 'issue', i, name, nameHay, parts, hay: [nameHay, ...parts.map(p => p.hay)].join(' '), rk: [alive.length ? 0 : 1, Math.min(Infinity, ...alive.map(b => soon.get(b.id) ?? Infinity)), mine.has(String(i.id)) ? 0 : 1, 0] };
  }).sort((x, y) => x.name.localeCompare(y.name, 'en', { numeric: true }));
  const byBill = new Map(); for (const x of S.billIssues || []) { const i = (S.issues || []).find(y => y.id === x.issue_id && !y.archived_at); if (i) byBill.set(x.bill_id, [...(byBill.get(x.bill_id) || []), i]); }
  const bills = (S.bills || []).filter(b => b.tracked !== false).map(b => {
    const iss = byBill.get(b.id) || [], name = billName(b), ids = [...new Set([...(S.assignments?.[b.id] || []), ...iss.map(i => i.owner_id)].filter(live))];
    const parts = [...iss.map(i => part('issue', eCig(i.name), `${i.name} ${eCig(i.name)}`)), part('title', clip(eCig(titleCaseTitle(b.title || '')), 70), `${b.title} ${eCig(b.title)}`), ...ids.map(id => part('lead', leadPhrase(advocate(id)), advocate(id).full_name))];
    const nameHay = norm(`${numForms(b.bill_number)} ${numForms(billNo(b))} ${name}`), own = (S.assignments?.[b.id] || []).includes(S.me?.id) || isMine(b);
    return { kind: 'bill', b, iss, name, nums: [b.bill_number, billNo(b)], nameHay, parts, hay: [nameHay, ...parts.map(p => p.hay)].join(' '), rk: [isAlive(b) ? 0 : 1, isAlive(b) ? soon.get(b.id) ?? Infinity : Infinity, own ? 0 : 1, iss.length ? 0 : 1] };
  });
  const cm = Object.entries(S.committees || {}).map(([code, c]) => { const name = cmteWords(code), nameHay = norm(name), parts = c.chair ? [part('chair', `Chair ${c.chair}`, c.chair)] : []; return { kind: 'cmte', code, c, name, nameHay, parts, hay: [nameHay, ...parts.map(p => p.hay)].join(' '), rk: [0, Infinity, 1, 0] }; }).sort((x, y) => x.name.localeCompare(y.name, 'en'));
  const lg = (S.legislators || []).map(l => { const nameHay = norm(l.name), parts = l.places ? [part('places', l.places)] : []; return { kind: 'leg', l, name: l.name, nameHay, parts, hay: [nameHay, ...parts.map(p => p.hay)].join(' '), rk: [0, Infinity, 1, 0] }; }).sort((x, y) => String(x.l.sort_name || x.name).localeCompare(String(y.l.sort_name || y.name), 'en'));
  return { issues, issueBy: new Map(issues.map(e => [String(e.i.id), e])), bills, people: [...cm, ...lg], second: null, taken: new Set((S.bills || []).map(b => bareNo(b.bill_number))) };
}
const getIdx = () => (IDX ||= build());
// each issue's one line of where it stands, from the same function the Issues list reads
function secondOf(id) {
  const ix = getIdx();
  if (!ix.second) {
    ix.second = new Map();
    try { for (const x of statesFor((S.issues || []).filter(i => !i.archived_at).map(i => ({ issue: i, bills: billsOfIssue(i) })).filter(x => x.bills.length), nextCtx())) ix.second.set(String(x.issue.id), x.second?.text || ''); } catch { /* the line is left out */ }
  }
  return ix.second.get(String(id)) || '';
}
// The issues of a list that match the words (Issues narrows its own list with this)
export function issueHits(list, q) { const ws = matchWords(q), ix = getIdx(); return list.filter(i => { const e = ix.issueBy.get(String(i.id)); return e && has(e.hay, ws); }); }

// ---------------------------------------------------------------------------------- one thing, drawn the same everywhere: an icon tile, a name, a second line saying what it is
const F = { who: { code: '' }, open: false, active: -1, hl: true, seq: 0, timer: 0, other: null, busy: false, text: '', sel: [0, 0], env: null, saved: new Map(), back: false, keepY: null, wantY: null, suppress: false };
const tile = (icon, style = '', plain = false) => `<span class="imark${plain ? ' plain' : ''}"${style ? ` style="${style}"` : ''} aria-hidden="true">${ic(icon)}</span>`;
const issueLead = i => { const a = person(i.owner_id); return a ? leadPhrase(a) : 'No lead yet'; };
// where a bill stands, in the words the issue rows use ("Stopped at First committees"), and "Hearing" written the same way everywhere
const whereOf = b => { if (!isAlive(b)) { const p = pathOf(b); return p.i >= 1 ? `Stopped at ${p.label}` : 'Stopped this year'; } return whereShort(b); };
const hearOf = b => { const h = isAlive(b) ? hearingAhead(b) : null; return h ? `Hearing ${hearTxt(h.scheduled_at)}` : whereOf(b); };
const roleWord = l => (l.chamber === 'S' ? 'Senator' : 'Representative');
const chairsOf = id => (S.committeeMembers || []).filter(m => String(m.legislator_id) === String(id) && m.role === 'chair').map(m => cmteWords(m.committee));
const issueOfBill = (b, iss) => iss.find(i => String(i.id) === String(issueOf(b)?.id)) || iss[0] || null;
// Other bills by their number's letters: what each is, plainly (the second line says it)
const KIND = { HB: 'Bill', SB: 'Bill', HR: 'Resolution', SR: 'Resolution', HCR: 'Concurrent resolution', SCR: 'Concurrent resolution', GM: 'Governor’s message' };
const kindOf = num => KIND[(/^[A-Z]+/.exec(bareNo(num)) || [''])[0]] || 'Measure';
const isBillNo = num => /^(HB|SB)\d/.test(bareNo(num));
// Why a thing matched when its name did not: the first of its other fields that holds a typed word, marked at the start of its second line
const whyOf = (e, ws) => { const p = e.parts.find(x => ws.some(alts => alts.some(a => startsWord(x.hay, a)))); return p && p.kind !== 'no' ? p.text : p ? p.text : ''; };
function toItem(e, recent, ws, nm) {
  const why = !recent && ws && ws.length && nm === false && e.parts ? whyOf(e, ws) : '';
  if (e.kind === 'issue') {
    const i = e.i, st = recent ? '' : secondOf(i.id);
    return { kind: 'issue', key: 'i' + i.id, name: e.name, no: '', why, tile: tile(iconOf(i), tint(i)), path: issueHref(F.who, i.id), sub: recent ? `Issue · ${topicName(i)}` : `Issue · ${billsOfIssue(i).length ? `${issueLead(i)}${st ? ` · ${st}` : ''}` : 'No bill on it this session'}` };
  }
  if (e.kind === 'bill') {
    const b = e.b, is = issueOfBill(b, e.iss);
    return { kind: 'bill', key: 'b' + b.id, name: e.name, no: billNo(b), why, tile: tile(is ? iconOf(is) : 'file-text', is ? tint(is) : '', !is), path: billHref(F.who, b, is?.id), sub: `Bill · ${hearOf(b)}${recent || !is ? '' : ` · ${posLine(b, is, S.me)}`}` };
  }
  if (e.kind === 'cmte') return { kind: 'cmte', key: 'c' + e.code, name: e.name, no: '', why, tile: tile('landmark', '', true), path: `#/search/committee/${enc(e.code)}`, search: true, sub: why || !e.c.chair ? 'Committee' : `Committee · Chair ${e.c.chair}` };
  if (e.kind === 'leg') {
    const l = e.l, ch = chairsOf(l.id);
    return { kind: 'leg', key: 'l' + l.id, name: l.name, no: '', why, tile: tile('user', '', true), path: `#/search/person/${enc(l.id)}`, search: true, sub: `${roleWord(l)} · ${ch.length ? `chairs ${ch.join(' and ')}` : `District ${l.district}`}` };
  }
  const r = e.r;   // a bill nobody on the team tracks
  return { kind: 'other', key: 'o' + r.bill_number, name: eCig(titleCaseTitle(r.title || r.bill_number)), no: spaced(r.bill_number), why: '', tile: tile('file-text', '', true), path: `#/search/other/${enc(bareNo(r.bill_number))}`, search: true, tag: 'Not tracked', sub: `${kindOf(r.bill_number)} · nobody on the team tracks it` };
}
const qs = q => (q ? `?q=${enc(q)}` : '');
let ALLQ = '';   // the door's opened groups: a result picked there keeps them, so the list stays as long as it was
const hrefOf = (it, q) => (it.search ? it.path + (q ? `?q=${enc(q)}${ALLQ ? `&all=${enc(ALLQ)}` : ''}` : '') : it.path);
// One result row: the name on ONE line (cut by the style, the number after it), then the second line. `ix` numbers it for aria-activedescendant; `plain` draws it outside a listbox (inside a sheet, never marked).
function rowHTML(it, q, { ix = -1, plain = false, cur = '', pre = 'fo', nomark = false } = {}) {
  const mq = nomark ? '' : q, on = cur && cur === it.path;
  return `<a class="sr3 ir fit${on ? ' sel' : ''}"${plain ? '' : ` role="option" id="${pre}-${ix}" tabindex="-1" aria-selected="false"`}${on ? ' aria-current="true"' : ''} data-k="${it.kind}" href="${esc(hrefOf(it, q))}">${it.tile}`
    + `<span class="sv"><span class="fn"><b>${mark(it.name, mq, SEEN)}</b>${it.no ? ` <span class="no">${markNo(it.no, mq)}</span>` : ''}</span><span class="ir2">${it.why ? `<span class="why">${markNo(it.why, mq)}</span> · ` : ''}${esc(it.sub)}</span></span>${it.tag ? `<span class="ftag">${esc(it.tag)}</span>` : ''}</a>`;
}

// ---------------------------------------------------------------------------------- results
// Local entries come back ordered; they are turned into rows only when they are drawn.
const cmpKey = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
function local(ws, q, closest) {
  const ix = getIdx(), nq = norm(q), out = { issues: [], bills: [], people: [] };
  if (!ws.length) return out;
  const pick = (arr, nums) => {
    let rows = arr.map((e, idx) => ({ e, idx, cnt: closest ? ws.filter(w => has(e.hay, [w])).length : has(e.hay, ws) ? ws.length : 0 }));
    const best = Math.max(0, ...rows.map(r => r.cnt)); rows = rows.filter(r => r.cnt > 0 && (!closest || r.cnt === best));
    return rows.map(r => { const nm = has(e0(r).nameHay, ws), t = nm ? tierOf(r.e.name, nq, nums ? r.e.nums : null) : 3; return { ...r, nm, t, key: [t === 0 ? 0 : 1, r.e.rk[0], nm ? 0 : 1, t, r.e.rk[1], r.e.rk[2], r.e.rk[3], r.idx] }; }).sort((a, b) => cmpKey(a.key, b.key));
  };
  out.issues = pick(ix.issues); out.bills = pick(ix.bills, true); out.people = pick(ix.people);
  return out;
}
const e0 = r => r.e;
// Other bills first as bills (HB, SB), then resolutions and messages; inside each, how well the name fits, then the order the data layer gave
const orderOther = (rows, q) => { const nq = norm(q); return rows.map((r, idx) => ({ r, idx, t: tierOf(titleCaseTitle(r.title || ''), nq, [r.bill_number]) })).sort((a, b) => (isBillNo(b.r.bill_number) - isBillNo(a.r.bill_number)) || a.t - b.t || a.idx - b.idx).map(x => x.r); };
function groupsOf(q, { closest = false } = {}) {
  const ws = matchWords(q), nq = norm(q);
  let L = local(ws, q, false); const o = F.other && F.other.q === q ? F.other : null;
  const g = { ws, issues: L.issues, bills: L.bills, people: L.people, other: o ? o.items : [], capped: !!o?.capped, failed: !!o?.failed, waiting: !!(F.busy || !o), closest: false };
  // several words and nothing has every one of them: the things that have the most of them
  if (closest && ws.length >= 2 && o && !F.busy && !g.failed && !totalOf(g)) { L = local(ws, q, true); g.issues = L.issues; g.bills = L.bills; g.people = L.people; g.closest = totalOf(g) > 0; }
  return g;
}
function itemsOf(g, k, limit, q) { return k === 'other' ? g.other.slice(0, limit).map(r => toItem({ kind: 'other', r })) : g[k].slice(0, limit).map(w => toItem(w.e, false, g.ws, w.nm)); }
const totalOf = g => g.issues.length + g.bills.length + g.people.length + g.other.length;
const seeAll = (g, q, pre = 'fo') => { const t = totalOf(g); return `<a class="sl fall" role="option" id="${pre}-all" tabindex="-1" aria-selected="false" href="#/search${qs(q)}">${g.capped ? 'See all results' : t === 1 ? 'See the 1 result' : `See all ${t} results`}</a>`; };
const liveWords = g => { const t = totalOf(g); return g.failed && !t ? 'The other bills could not be searched' : t === 0 ? 'No results' : g.capped ? `${t} or more results` : n(t, 'result', 'results'); };
const FAIL = 'The other bills could not be searched. Try again.';

// The recent things, newest first, each looked up again (a thing that is gone is left out)
const ME = () => String(S.me?.initials || '').toUpperCase();
const RK = 'hiphi7_recent';
function recentRead() { try { const o = JSON.parse(localStorage.getItem(RK)); return o && typeof o === 'object' && Array.isArray(o[ME()]) ? o[ME()].filter(x => x && typeof x.k === 'string' && x.id != null) : []; } catch { return []; } }
function recentWrite(list) { try { let o = {}; try { o = JSON.parse(localStorage.getItem(RK)) || {}; } catch { /* a fresh one */ } o[ME()] = list; localStorage.setItem(RK, JSON.stringify(o)); } catch { /* the page works without it */ } }
function thing(k, id) {
  const ix = getIdx();
  if (k === 'issue') { const e = ix.issueBy.get(String(id)); return e ? toItem(e, true) : null; }
  if (k === 'bill') { const b = billByRef(String(id)); const e = b && b.tracked !== false && ix.bills.find(x => x.b.id === b.id); return e ? toItem(e, true) : null; }
  if (k === 'cmte') { const e = ix.people.find(x => x.kind === 'cmte' && x.code === id); return e ? toItem(e, true) : null; }
  if (k === 'leg') { const e = ix.people.find(x => x.kind === 'leg' && String(x.l.id) === String(id)); return e ? toItem(e, true) : null; }
  if (k === 'other') { const r = (S.snapshot?.index || []).find(x => bareNo(x.bill_number) === bareNo(id)); return r && !ix.taken.has(bareNo(r.bill_number)) ? toItem({ kind: 'other', r }, true) : null; }
  return null;
}
export const recents = () => recentRead().map(x => thing(x.k, x.id)).filter(Boolean).slice(0, 5);
// Called when a page is drawn by navigation (never by the minute's tick): an issue, a bill, a committee, a legislator or a bill not tracked is now the latest thing opened.
export function noteOpened(rt) {
  if (!rt || !S.me) return;
  let k = '', id = '';
  const [kind, ...r] = String(rt.id || '').split('/'), rest = r.join('/');
  if (rt.r === 'issue' && rt.id) { k = 'issue'; id = rt.id; }
  else if (rt.r === 'bill' && rt.id && rt.id.length < 40) { const b = billByRef(rt.id); if (b && b.tracked !== false) { k = 'bill'; id = billRef(b); } }
  else if (rt.r === 'search' && kind === 'committee') { k = 'cmte'; id = rest; }
  else if (rt.r === 'search' && kind === 'person') { k = 'leg'; id = rest; }
  else if (rt.r === 'search' && kind === 'other') { k = 'other'; id = rest.toUpperCase(); }
  if (!k || !thing(k, id)) return;
  recentWrite([{ k, id }, ...recentRead().filter(x => !(x.k === k && x.id === id))].slice(0, 5));
}

// The list's scroll is kept for an address, so Back to Issues or the Search door finds the place again. Registered when this file loads, so it runs before the frame draws the next page.
// Only Back and Forward restore it: the entries this file has stamped (state.fs) are the ones the browser walks back to; a link, or a typed address, is a new place and starts at the top.
addEventListener('popstate', e => { F.back = !!(e.state && e.state.fs); });
addEventListener('hashchange', e => { try { const wl = document.querySelector('.wl'); if (wl && e.oldURL) F.saved.set(new URL(e.oldURL).hash, wl.scrollTop); } catch { /* none */ } });

// ---------------------------------------------------------------------------------- the box
export function boxHTML({ who = '', q = '', door = false } = {}) {
  IDX = null; F.who = { code: who || '' };
  return `<div class="findw" id="findW" data-who="${esc(who)}"${door ? ' data-door="1"' : ''}><div class="findb" id="findB">${ic('search')}`
    + `<input id="findIn" type="text" role="combobox" aria-expanded="${door ? 'true' : 'false'}" aria-controls="${door ? 'slist' : 'findList'}" aria-autocomplete="list" aria-label="${PLACEHOLDER}" placeholder="${PLACEHOLDER}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(q)}">`
    + `<kbd class="fkey" aria-hidden="true">/</kbd></div><div class="vh" id="findLive" role="status" aria-live="polite"></div>`
    + (door ? '' : `<div class="fdrop" id="findDrop" hidden><p class="fhint" id="findNote" hidden></p><div id="findList" role="listbox" aria-label="Results"></div><p class="fhint" id="findHint"></p></div>`) + '</div>';
}
// A panel's groups (inside ONE listbox, each group labelled by its heading) and, for "Also found", the same
function panelGroups(g, q, { pre = 'fo' } = {}) {
  let ix = 0, h = '';
  for (const k of ORDER) {
    if (k === 'other' && g.failed) { h += `<p class="fhint" id="otherFail" role="presentation">${FAIL}</p>`; continue; }
    const items = itemsOf(g, k, CAPS[k], q); if (!items.length) continue;
    const id = `${pre}g-${k}`;
    h += `<div class="fgrp" role="group" data-g="${k}" aria-labelledby="${id}"><h4 class="fh4" id="${id}">${TITLES[k]}</h4>${items.map(it => rowHTML(it, q, { ix: ix++, pre })).join('')}</div>`;
  }
  return { html: h, count: ix };
}
// The Search door's groups: each its own listbox under its heading, five rows (all of them once "Show all" is pressed), then that button
function doorGroups(g, q, { cur = '', more = new Set() } = {}) {
  let ix = 0, h = ''; ALLQ = [...more].filter(k => ORDER.includes(k)).join(',');
  for (const k of ORDER) {
    const total = g[k].length, open = more.has(k), id = `sl-${k}`;
    if (k === 'other' && g.failed) { h += `<section class="fgrp" data-g="other"><h3 class="glab">${TITLES.other}</h3><p class="fhint" id="otherFail">${FAIL}</p></section>`; continue; }
    if (!total) continue;
    const items = itemsOf(g, k, open ? Infinity : DOOR_ROWS, q);
    h += `<section class="fgrp" data-g="${k}" aria-labelledby="${id}-h"><h3 class="glab" id="${id}-h">${TITLES[k]} · ${total}${k === 'other' && g.capped ? '+' : ''}</h3><div role="listbox" id="${id}" aria-labelledby="${id}-h">${items.map(it => rowHTML(it, q, { ix: ix++, cur })).join('')}</div>`
      + (total > DOOR_ROWS && !open ? `<p class="more"><button class="sl sbtn" type="button" data-more="${k}">Show all ${total} ${NOUNS[k]}</button></p>` : '') + '</section>';
  }
  ALLQ = ''; return { html: h, count: ix };
}
const recentItems = () => recents();
const recentPanel = () => { const r = recentItems(); return { html: r.length ? `<div class="fgrp" role="group" data-g="recent" aria-labelledby="fg-recent"><h4 class="fh4" id="fg-recent">Recently opened</h4>${r.map((it, ix) => rowHTML(it, '', { ix })).join('')}</div>` : '', count: r.length }; };
const recentDoor = cur => { const r = recentItems(); return r.length ? `<section class="fgrp" data-g="recent" aria-labelledby="sl-recent-h"><h3 class="glab" id="sl-recent-h">Recently opened</h3><div role="listbox" id="sl-recent" aria-labelledby="sl-recent-h">${r.map((it, ix) => rowHTML(it, '', { ix, cur })).join('')}</div></section>` : ''; };
const noteLine = 'No match for every word. Closest:';

const modeOf = () => ($('slist') ? 'door' : $('ilist') ? 'issues' : 'panel');
const val = () => ($('findIn')?.value || '').trim();
// the arrow keys move a highlight over the options; the input keeps the focus and says which one with aria-activedescendant
function options() {
  const m = modeOf();
  if (m === 'door') return [...$('slist').querySelectorAll('[role=option]')];
  if (m === 'issues' && val()) return [...$('ilist').querySelectorAll('[role=option]'), ...($('ialso') ? $('ialso').querySelectorAll('[role=option]') : [])];
  return $('findList') ? [...$('findList').querySelectorAll('[role=option]')] : [];
}
function setActive(k) {
  const os = options(), inp = $('findIn'); if (!inp) return;
  F.active = os.length ? Math.max(F.hl ? 0 : -1, Math.min(k, os.length - 1)) : -1;
  os.forEach((o, i) => { const on = F.hl && i === F.active; o.classList.toggle('on', on); o.setAttribute('aria-selected', on ? 'true' : 'false'); });
  const a = os[F.active]; if (F.hl && a && (F.open || modeOf() !== 'panel')) { inp.setAttribute('aria-activedescendant', a.id); a.scrollIntoView({ block: 'nearest' }); } else inp.removeAttribute('aria-activedescendant');
}
function say(t) { const l = $('findLive'); if (l && l.textContent !== t) l.textContent = t; }

// ---------------------------------------------------------------------------------- drawing what is typed
function close() {
  F.open = false; const d = $('findDrop'), inp = $('findIn'); if (d) d.hidden = true; if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
}
const alsoText = (g, r) => {
  const out = g.issues.filter(w => !r.ids.has(String(w.e.i.id))).length, c = g.people.filter(w => w.e.kind === 'cmte').length, l = g.people.length - c, o = g.other.length;
  const parts = [out && n(out, 'more issue', 'more issues'), c && n(c, 'committee', 'committees'), l && n(l, 'legislator', 'legislators'), g.bills.length && n(g.bills.length, 'bill', 'bills'), o && `${g.capped ? o + '+' : o} other ${o === 1 ? 'bill' : 'bills'}`].filter(Boolean);
  return parts.length ? `also ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]} below` : '';
};
function draw(keep) {
  const inp = $('findIn'); if (!inp) return; const q = val(), mode = modeOf(), w = $('findW');
  if (w) w.dataset.busy = F.busy ? '1' : '0';
  if (mode === 'issues') {
    const redraw = issuesUi.redraw; if (!redraw) return;
    const r = redraw(q), wl = document.querySelector('.wl'), at = wl?.scrollTop, also = $('ialso'), il = $('ilist');
    il.innerHTML = r.html; bindFolds(); also.innerHTML = '';
    if (q) {
      const g = groupsOf(q), pg = panelGroups({ ...g, issues: g.issues.filter(x => !r.ids.has(String(x.e.i.id))) }, q, { pre: 'fa' });
      il.querySelectorAll('section ul.srows3').forEach(u => { u.setAttribute('role', 'listbox'); u.setAttribute('aria-label', u.closest('section')?.querySelector('h3')?.textContent.replace(/ · \d+$/, '') || 'Issues'); u.querySelectorAll(':scope > li').forEach(li => li.setAttribute('role', 'presentation')); });
      il.querySelectorAll('a.ir').forEach((a, i) => { a.setAttribute('role', 'option'); a.id = 'fi-' + i; a.setAttribute('aria-selected', 'false'); });
      if (pg.count || g.failed) also.innerHTML = `<h3 class="alsoh" id="alsoH" tabindex="-1">Also found</h3><div id="alsoList" role="listbox" aria-label="Also found">${pg.html}${pg.count ? seeAll(g, q, 'fa') : ''}</div>`;
      const sa = $('summAlso'), at2 = alsoText(g, r); if (sa) sa.innerHTML = at2 ? ` · <a class="sl" id="alsoLink" href="#alsoH">${esc(at2)}</a>` : '';
      inp.setAttribute('aria-controls', 'ilist ialso'); F.hl = true; say(liveWords(g));
    } else { inp.setAttribute('aria-controls', 'findList'); say(''); }
    if (wl && at != null) wl.scrollTop = at;
    if (q) { close(); setActive(keep ? F.active : 0); } else if (F.open) panel(q, keep); else close();
    return;
  }
  if (mode === 'door') {
    const h = $('slist'), cur = location.hash.split('?')[0], wl = document.querySelector('.wl'), at = F.wantY ?? wl?.scrollTop; h.innerHTML = doorHTML(q, cur, moreOf()); inp.setAttribute('aria-expanded', 'true');
    if (wl && at) { wl.scrollTop = at; if (F.wantY != null && (F.other || !matchWords(q).length)) F.wantY = null; }   // the list keeps its place while it is drawn again (and finds it once the rest of the list has arrived)
    const ids = [...h.querySelectorAll('[role=listbox]')].map(x => x.id); inp.setAttribute('aria-controls', ids.join(' ') || 'slist');
    if (q && matchWords(q).length) say(liveWords(groupsOf(q))); else say('');
    setActive(keep ? F.active : -1); h.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); return;
  }
  if (F.open) panel(q, keep); else close();
}
// the door's left side: recent things, or the results (five to a group), the closest words, or a calm line
function doorHTML(q, cur, more) {
  if (!q) return recentDoor(cur) + `<p class="fhint">${HINT}</p>`;
  if (!matchWords(q).length) return `<p class="fhint">${HINT}</p>`;
  const g = groupsOf(q, { closest: true }), dg = doorGroups(g, q, { cur, more });
  if (!dg.html) return `<p class="calmnote" id="findNone">${g.waiting ? 'Looking…' : `Nothing found for “${say0(q)}”.`}</p>` + (g.waiting ? '' : `<p class="fhint">${HINT}</p>`);
  return (g.closest ? `<p class="fhint" id="findClosest">${noteLine}</p>` : '') + dg.html + `<p class="fhint">${liveWords(g)}.</p>`;
}
function panel(q, keep) {
  const host = $('findList'), d = $('findDrop'), inp = $('findIn'); if (!host) return;
  const note = d.firstElementChild, hint = d.lastElementChild;   // the note above the list and the line under it (the line's id says whether it is the hint or "nothing found")
  let html = '', nt = '', ht = '';
  if (!q) { const r = recentPanel(); html = r.html; ht = HINT; say(''); }
  else if (!matchWords(q).length) ht = HINT;
  else {
    const g = groupsOf(q, { closest: true }), pg = panelGroups(g, q);
    html = pg.html + (pg.count ? seeAll(g, q) : ''); if (g.closest) nt = noteLine;
    if (!pg.html) { ht = g.waiting ? 'Looking…' : `Nothing found for “${say0(q)}”. ${HINT}`; }
    say(liveWords(g));
  }
  host.innerHTML = html; note.textContent = nt; note.hidden = !nt; hint.textContent = ht; hint.hidden = !ht; hint.id = !html && ht && q && !ht.startsWith('Looking') ? 'findNone' : 'findHint';
  d.hidden = false; inp.setAttribute('aria-expanded', 'true'); inp.setAttribute('aria-controls', 'findList');
  // the panel ends inside the window: its height is what is left below it
  d.style.maxHeight = ''; const room = innerHeight - d.getBoundingClientRect().top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s4')) || 16); d.style.maxHeight = Math.max(160, room) + 'px';
  F.hl = true; setActive(keep ? F.active : 0);
}

// ---------------------------------------------------------------------------------- the Legislature's other bills: asked for 150 ms after the last key; only the latest answer is drawn
function ask(q) {
  q = q.trim(); const my = ++F.seq, nq = norm(q);
  if (!matchWords(q).length) { F.other = { q, items: [], capped: false }; F.busy = false; draw(true); return; }
  const asks = [q], alt = q.replace(/\bvap(?:e|es|ing)\b/gi, 'cigarette'); if (alt !== q) asks.push(alt.trim());
  Promise.all(asks.map(a => DB.searchUntracked(a).then(r => ({ ok: true, r: r || [] }), () => ({ ok: false, r: [] })))).then(res => {
    if (my !== F.seq) return;   // newer words were typed: this answer is stale
    const ix = getIdx(), seen = new Set(), rows = [];
    for (const r of res.flatMap(x => x.r)) { const k = bareNo(r.bill_number); if (!seen.has(k)) { seen.add(k); rows.push(r); } }
    const failed = res.every(x => !x.ok), capped = res.some(x => x.r.length >= 40);
    F.other = { q, items: orderOther(rows.filter(r => !ix.taken.has(bareNo(r.bill_number))), q), capped, failed }; F.busy = false; draw(true);
  });
}
// ask for the other bills when words are in the box and no answer for these very words is held
function ensureOther(q) {
  if (!q || !matchWords(q).length || (F.other && F.other.q === q)) return;
  clearTimeout(F.timer); F.busy = true; draw(true); F.timer = setTimeout(() => ask(q), 0);
}
function changed() {
  const q = val(); clearTimeout(F.timer); F.text = q;
  F.seq++; F.busy = !!matchWords(q).length;   // an answer for older words is stale from this key on
  setQ(q); F.other = null; F.open = true; F.hl = modeOf() !== 'door'; F.active = F.hl ? 0 : -1; draw(false);
  if (F.busy) F.timer = setTimeout(() => ask(q), WAIT);
}
// the words (and the "Show all" groups) in the address (Issues and the Search door): replaceState, so nothing is drawn by render() and the history does not grow a step for each key
function setParam(name, value) {
  if (!/^#\/(issues|issue|bill|search)(\/|\?|$)/.test(location.hash)) return;
  const [path, ...r] = location.hash.split('?'), p = new URLSearchParams(r.join('?')); if (value) p.set(name, value); else p.delete(name);
  const s = p.toString(), h = path + (s ? '?' + s : '');
  if (h !== location.hash) { history.replaceState(history.state, '', location.pathname + location.search + h); F.env?.sync?.(); }
}
const setQ = q => setParam('q', q);
const moreOf = () => new Set((new URLSearchParams(location.hash.split('?').slice(1).join('?')).get('all') || '').split(',').filter(k => ORDER.includes(k)));
// a Search address with the words as they are NOW in the box (links drawn on a sheet are older than the box)
function withNow(href) {
  const [path, ...r] = href.split('?'), p = new URLSearchParams(r.join('?')), q = val(); if (q) p.set('q', q); else p.delete('q');
  const s = p.toString(); return path + (s ? '?' + s : '');
}
function clearWords() { const inp = $('findIn'); if (!inp) return; inp.value = ''; changed(); }

// ---------------------------------------------------------------------------------- binding
let wired = false;
function wireOnce() {
  if (wired) return; wired = true;
  document.addEventListener('click', e => {
    const t = e.target.closest ? e.target : e.target.parentElement; if (!t) return;
    if (t.closest('#findClear')) { clearWords(); $('findIn')?.focus(); return; }
    if (t.closest('#alsoLink')) { e.preventDefault(); const h = $('alsoH'); if (h) { h.scrollIntoView({ block: 'start' }); h.focus({ preventScroll: true }); } return; }
    const more = t.closest('[data-more]'); if (more && $('slist')) { const k = more.dataset.more, s = moreOf(); s.add(k); setParam('all', [...s].join(',')); draw(true); return; }
    if (t.closest('#slist a[role=option]')) F.keepY = document.querySelector('.wl')?.scrollTop ?? null;   // a result picked on the door keeps the list where it was
  });
  // links drawn on a sheet (a member, Back to Search) read the words as they are when they are used
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('.wp a[href^="#/search"]'); if (a && $('findIn')) a.setAttribute('href', withNow(a.getAttribute('href'))); }, true);
  document.addEventListener('keydown', e => {   // "/" goes to the box from anywhere, except while typing in a field
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    const inp = $('findIn'); if (!inp) return; e.preventDefault(); inp.focus(); inp.select();
  });
}
// What the box is doing before the page is drawn again: the redraw removes the focused input, and the browser may say it lost focus (which closes the panel) before the new one is made
export const findOpen = () => !!($('findIn') && F.open && !$('findDrop')?.hidden);
export function bindFind(env) {
  F.env = env; wireOnce(); clearTimeout(F.timer);
  const inp = $('findIn'); if (!inp) { F.seq++; F.busy = false; return; }
  const w = $('findW'), mode = modeOf(), addr = new URLSearchParams(location.hash.split('?').slice(1).join('?')).get('q') || '', wasOpen = env.wasOpen ?? F.open;
  F.who = { code: w.dataset.who || '' }; F.seq++; F.busy = false; F.open = false; F.hl = mode !== 'door'; F.active = F.hl ? 0 : -1;
  if (env.tick && !addr && F.text && mode === 'panel') inp.value = F.text; else F.text = inp.value.trim();
  const q = inp.value.trim(); if (!(env.tick && F.other && F.other.q === q)) F.other = null;   // the minute's redraw keeps the answer it holds for these words
  const saveSel = () => { F.sel = [inp.selectionStart, inp.selectionEnd]; };
  inp.addEventListener('input', () => { saveSel(); changed(); });
  inp.addEventListener('keyup', saveSel); inp.addEventListener('click', saveSel);
  const opens = () => mode === 'panel' || (mode === 'issues' && !val());
  inp.addEventListener('focus', () => { if (F.suppress) return; if (opens()) { F.open = true; draw(false); ensureOther(val()); } });
  inp.addEventListener('click', () => { if (!F.open && opens()) { F.open = true; draw(false); ensureOther(val()); } });
  inp.addEventListener('keydown', e => {
    if (e.isComposing) return;   // an input method is still choosing letters
    if (e.key === 'Escape') {
      if (val() || F.open) { e.preventDefault(); if (val()) clearWords(); F.open = false; close(); } else inp.blur();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!F.open && mode === 'panel') { F.open = true; draw(false); ensureOther(val()); return; }
      const k = options().length; if (!k) return;
      const down = e.key === 'ArrowDown'; F.hl = true; setActive(F.active < 0 ? (down ? 0 : k - 1) : (F.active + (down ? 1 : -1) + k) % k); return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode !== 'door' && !(mode === 'issues' && val()) && !F.open) return;   // a closed panel has nothing to open
      const os = options(), a = os[F.active >= 0 ? F.active : 0], href = a ? a.getAttribute('href') : '';
      if (href) { close(); location.hash = href; }
    }
  });
  const drop = $('findDrop');
  if (drop) { drop.addEventListener('mousedown', e => e.preventDefault()); drop.addEventListener('click', e => { if (e.target.closest('a')) close(); }); }
  w.addEventListener('focusout', e => { if (!w.contains(e.relatedTarget)) close(); });
  if (env.tick && env.hadFocus) { F.suppress = !wasOpen; inp.focus({ preventScroll: true }); F.suppress = false; try { inp.setSelectionRange(F.sel[0], F.sel[1]); } catch { /* none */ } if (wasOpen) { F.open = true; } }
  if (mode === 'door') inp.setAttribute('aria-expanded', 'true');
  if (mode === 'issues' && q) { draw(false); ensureOther(q); }
  else if (mode === 'door') { draw(false); ensureOther(q); }
  else if (F.open) { draw(false); ensureOther(q); }
  if (!env.tick) {
    const wl = document.querySelector('.wl'), y = F.back ? F.saved.get(location.hash) : mode === 'door' ? F.keepY : 0; F.back = false; F.keepY = null;
    if (wl && y) { wl.scrollTop = y; F.wantY = mode === 'door' ? y : null; }
    try { history.replaceState({ fs: 1 }, ''); } catch { /* the address stays as it is */ }
  } else F.keepY = null;
}
// ---------------------------------------------------------------------------------- the Search door: the box and the results on the left, the picked thing's sheet on the right
const personHref = (id, q) => `#/search/person/${enc(id)}${qs(q)}`;
const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const notFoundSheet = (what, q) => `<div class="pn" data-notfound="1">${plainBand(`We could not find ${what}.`, 'It may have been renamed, or it is not on the practice copy.')}<div class="pbody"><p class="lead"><a class="btn text" href="#/search${qs(q)}">Back to Search</a></p></div></div>`;
const calmSheet = () => `<div class="pn"><h1 class="vh" tabindex="-1">Search</h1><div class="pbody"><p class="lead mid" id="calmLine">Pick a result to look at it here.</p></div></div>`;
const roleName = r => (r === 'chair' ? 'Chair' : r === 'vice_chair' ? 'Vice chair' : 'Member');
const bySort = (a, b) => String(a.sort_name || a.name).localeCompare(String(b.sort_name || b.name), 'en');
const membersOf = code => (S.committeeMembers || []).filter(m => m.committee === code).map(m => ({ role: m.role, l: legOf(m.legislator_id) })).filter(x => x.l);
const codesOf = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean);
// Is this bill in the committee now (a joint referral counts, and says so) or referred to it next, in the same chamber? Else null.
function placeIn(e, code) {
  const b = e.b; if (!isAlive(b)) return null;
  const st = stopOf(b); if (st.phase !== 'committee') return null;
  const cur = codesOf(st.committee);
  if (cur.includes(code)) { const others = cur.filter(c => c !== code); return { here: true, line: others.length ? `Here now, together with ${cmteWords(others.join('/'))}` : 'Here now' }; }
  const refs = (Array.isArray(b.referrals) ? b.referrals : []).map(codesOf), k = refs.findIndex(r => r.some(c => cur.includes(c)));
  if (k >= 0 && refs[k + 1] && refs[k + 1].includes(code) && S.committees?.[code]?.chamber === st.chamber) return { here: false, line: `Comes here next, after ${cmteWords(cur.join('/'))}` };
  return null;
}
function committeeSheet(code, q) {
  const c = S.committees?.[code]; if (!c) return '';
  const ms = membersOf(code), lk = l => `<a class="lk" href="${personHref(l.id, q)}">${esc(l.name)}</a>`, group = r => ms.filter(x => x.role === r).map(x => x.l).sort(bySort);
  const chairs = group('chair'), vices = group('vice_chair'), rest = ms.filter(x => x.role !== 'chair' && x.role !== 'vice_chair').map(x => x.l).sort(bySort);
  const ix = getIdx(), mine = ix.bills.map((e, idx) => ({ e, idx, p: placeIn(e, code) })).filter(x => x.p).sort((a, b) => (b.p.here - a.p.here) || cmpKey(a.e.rk, b.e.rk) || a.idx - b.idx);
  const now = Date.now(), seen = new Map();
  for (const h of S.hearings || []) { if (h.status !== 'scheduled' || new Date(h.scheduled_at) <= now || !codesOf(h.committee).includes(code)) continue; const k = sitKeyOf(h); if (!seen.has(k)) seen.set(k, { h, k, bills: new Set() }); seen.get(k).bills.add(h.bill_id); }
  const inCal = new Set(); for (const i of S.issues || []) if (!i.archived_at) for (const b of billsOfIssue(i)) if (isAlive(b)) inCal.add(b.id);
  const sits = [...seen.values()].sort((a, b) => new Date(a.h.scheduled_at) - new Date(b.h.scheduled_at));
  let h = `<div class="pn" data-sheet="committee">${plainBand(cmteWords(code), 'Committee')}<div class="pbody">`;
  h += kv([['Chair', chairs.length ? chairs.map(lk).join(', ') : 'None listed'], ['Vice chair', vices.length ? vices.map(lk).join(', ') : 'None listed']]);
  h += `<h2 class="sh">Our bills in this committee</h2>` + (mine.length ? `<ul class="srows3 fsheet">${mine.map(x => { const it = toItem(x.e), hr = isAlive(x.e.b) ? hearingAhead(x.e.b) : null; return `<li>${rowHTML({ ...it, sub: `Bill · ${x.p.line}${hr ? ` · Hearing ${hearTxt(hr.scheduled_at)}` : ''}` }, q, { plain: true, nomark: true })}</li>`; }).join('')}</ul>` : '<p class="hint" id="cNoBills">None of our bills is in this committee right now.</p>');
  h += `<h2 class="sh">Coming hearings</h2>` + (sits.length ? `<ul class="fhear">${sits.map(s => {
    const ours = [...s.bills].filter(id => inCal.has(id)).length, txt = `Hearing ${hearTxt(s.h.scheduled_at)}${ours ? ` · ${n(ours, 'bill', 'bills')} of ours` : ''}`;
    return `<li>${ours ? `<a class="lk" href="#/calendar/sitting/${enc(s.k)}?who=all">${esc(txt)}</a>` : esc(txt)}</li>`; }).join('')}</ul>` : '<p class="hint" id="cNoHear">No hearing is scheduled.</p>');
  h += `<h2 class="sh">Members</h2>` + (rest.length ? `<p class="lead tight">${rest.map(lk).join(', ')}</p>` : '<p class="hint">No other members are listed.</p>');
  return h + '</div></div>';
}
const PARTY = { D: 'Democrat', R: 'Republican' };
function personSheet(id, q) {
  const l = legOf(id); if (!l) return '';
  const cms = (S.committeeMembers || []).filter(m => String(m.legislator_id) === String(l.id)).sort((a, b) => ({ chair: 0, vice_chair: 1 }[a.role] ?? 2) - ({ chair: 0, vice_chair: 1 }[b.role] ?? 2) || cmteWords(a.committee).localeCompare(cmteWords(b.committee), 'en'));
  let h = `<div class="pn" data-sheet="person">${plainBand(l.name, roleWord(l))}<div class="pbody">`;
  h += kv([['District', `${esc(String(l.district))}${l.places ? ` · ${esc(l.places)}` : ''}`], l.party ? ['Party', esc(PARTY[l.party] || l.party)] : null, l.room ? ['Room', esc(String(l.room))] : null]);
  h += `<h2 class="sh">Committees</h2>` + (cms.length ? `<ul class="fhear">${cms.map(m => `<li><a class="lk" href="#/search/committee/${enc(m.committee)}${qs(q)}">${esc(cmteWords(m.committee))}</a> · ${roleName(m.role)}</li>`).join('')}</ul>` : '<p class="hint">Not on a committee.</p>');
  return h + '</div></div>';
}
const otherCache = new Map();
function otherRow(num) {
  const k = bareNo(num), idx = (S.snapshot?.index || []).find(x => bareNo(x.bill_number) === k);
  if (DEMO) return idx || null;
  if (!otherCache.has(k)) { const at = location.hash; otherCache.set(k, 'loading'); DB.untrackedBill(k).then(r => otherCache.set(k, r || 'none')).catch(() => otherCache.set(k, 'none')).finally(() => { if (location.hash === at) F.env?.rerender?.(); }); }   // drawn again only if the person is still on this page
  const c = otherCache.get(k); return c === 'loading' ? 'loading' : c === 'none' ? null : c;
}
function otherSheet(num, q) {
  const r = otherRow(num); if (r === 'loading') return `<div class="pn">${plainBand('One moment', 'Looking for the bill.')}</div>`;
  if (!r || getIdx().taken.has(bareNo(r.bill_number))) return '';
  const url = capitolUrl({ bill_number: bareNo(r.bill_number), session_year: r.session_year, state_url: r.state_url });
  let h = `<div class="pn" data-sheet="other">${plainBand(spaced(r.bill_number), eCig(titleCaseTitle(r.title || '')))}<div class="pbody">`;
  h += `<p class="lead tight"><span class="ftag" id="notTracked">Not tracked</span></p>`;
  if (r.description) h += `<p class="lead" id="oDesc">${esc(eCig(r.description))}</p>`;
  h += `<p class="lead" id="oLook">Nobody on the team tracks this bill, so there is nothing to do here yet.</p>`;
  if (/^https?:\/\//.test(url)) h += `<p class="lead"><a class="lk" id="oCapitol" target="_blank" rel="noopener" href="${esc(url)}">The bill’s page on the Capitol site${ic('external-link')}</a></p>`;
  return h + '</div></div>';
}
// rt: { r: 'search', id: '' | 'committee/<code>' | 'person/<id>' | 'other/<number>', q }
export function searchModel({ rt }) {
  F.who = { code: '' };
  const q = String(rt.q.get('q') || '').trim().slice(0, 200), [kind, ...r] = String(rt.id || '').split('/'), rest = r.join('/');
  let sheet = calmSheet(), picked = false, label = 'Search', cur = '';
  if (rt.id) {
    picked = true;
    const s = kind === 'committee' ? committeeSheet(rest, q) : kind === 'person' ? personSheet(rest, q) : kind === 'other' ? otherSheet(rest, q) : '';
    if (s) { sheet = s; label = kind === 'committee' ? 'Committee' : kind === 'person' ? 'Legislator' : 'Bill'; cur = `#/search/${kind}/${enc(rest)}`; }
    else { sheet = notFoundSheet(kind === 'committee' ? 'that committee' : kind === 'person' ? 'that legislator' : kind === 'other' ? 'that bill' : 'that part of Search', q); label = 'Not found'; }
  }
  const box = boxHTML({ who: '', q, door: true });
  const col = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">Search</h2></div>${box}</header><div id="slist">${doorHTML(q, cur, new Set((rt.q.get('all') || '').split(',')))}</div>`;
  return { col, sheet, picked, label, back: `#/search${qs(q)}`, backLabel: 'Search', bind: null, notFound: /data-notfound/.test(sheet), door: 'search' };
}
