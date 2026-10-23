// Holding our bills (#/legislators?view=holding, F139), who introduced a bill (F140), and the ask model every Legislators
// screen shares. R-316 W41, live 10/22 (R-329); Staff v6 (R-336 spec 6, V23, V24).
// - The ask model, one path for Who to ask, Holding our bills and a legislator's page (X7): the bills waiting for a hearing
//   in a scope (askItems: My bills · My coalitions · Team, the same switch and the same bills as Hearings > Get hearings,
//   push.js's when it is there), grouped by chair (chairGroups). Each bill under each chair reads one way everywhere
//   (chairLine): steps.js's words (askWords and the row line), said of that one chair. On a joint committee each chair is
//   asked on their own: asking one never marks the other (V24, chairAsk), and every email goes to that chair alone.
//   A chair's email (chairEmail) is ONE button wherever the chair is drawn: the viewer's own asks with them, new ones and
//   follow-ups, named by bill ("Email about HB 1563 and HB 756"), so a chair never carries two email buttons.
// - Holding our bills: the compact view of the same board, one row per chair (name, role on our bills, what is left to
//   ask, last contact), the soonest open ask first, with that same one email button.
// - Committee member lists mark who introduced the bill, or its twin in the other chamber ("Introduced SB3044, the Senate
//   version"): introChip(b, l) and introSort(b, members), drawn by the bill's Committees (pathway.js) and a hearing's page.
//   Their signatures stay as they are (spec 11).
// - In the opening weeks: "2 of your top issues have no bill yet · introduction closes Wed 1/28" (F141), a calm line at
//   the top of Holding. My issues says it too (ISSUES).
// - Last contact (lastContact, contactWords, ensureContacts): the newest logged talk or ask, for every Legislators tab.
import { S, DB, DEMO, DEADLINES, esc, isMine } from './data.js';
import { codesOf, stopOf, billByNum, companionsOf, plain, chairIdsOf, legNotesAll, chairAskMail, legById, ASK_ANSWERS } from './model.js';
import { icon, btn, menuSheet } from './ui.js';
import * as PUSH from './push.js';
import { wirePush } from './push.js';
import { askWords, billStep, committeeName, dayWords, firstWords, orWords, numWords, itemRow, nw } from './steps.js';
import { askLine, recordAsk } from './chairask.js';

export const HOLDING = () => true;   // live 10/22 at Nate's go, after W3 (R-329)

const DAY = 864e5;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const mine = b => (S.assignments?.[b.id] || []).includes(S.me?.id);
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

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
// chair nobody has asked yet this is still "ask", and their email goes to them alone. Only a row saved as an ask counts
// (it carries its answer, migration 183): a talk that was not an ask never marks the bill asked.
export function chairAsk(b, chairId) {
  const aw = askWords(b); if (!aw || aw.key === 'scheduled') return aw;
  const ids = chairIdsOf(aw.code); if (ids.length < 2 || !ids.includes(chairId)) return aw;
  const own = legNotesAll().filter(n => n.bill_id === b.id && n.legislator_id === chairId && n.answer && (!n.committee || n.committee === aw.code))
    .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
  if (own.length) {
    const a = { by: own[0].advocate_id, at: new Date(own[0].created_at).getTime(), answer: own.at(-1).answer || 'asked', last: own.at(-1), n: own[0], rows: own };
    return { ...aw, key: a.answer === 'said_no' ? 'said_no' : 'waiting', words: askLine(a), asker: a.by, at: a.at, lastAt: new Date(a.last.created_at).getTime(), answer: a.answer, other: false };
  }
  if (aw.key === 'waiting' || aw.key === 'said_no') {   // the other chair was asked; this one not yet
    if (aw.aw?.a.passed) return { ...aw, key: 'passed', words: 'Notice time passed · only the chair can help now', other: true };
    const day = aw.aw ? aw.aw.day : '';
    return { ...aw, key: 'ask', words: aw.decide ? `Ask the chair for decision making${day ? ` by ${day}` : ''}` : `Ask the chair by ${day}`, day, by: aw.aw?.a.at ?? null, other: true };
  }
  return aw;
}
// This chair's address: the directory's, else the Capitol's pattern (model.js chairMail's rule).
const mailOf = l => l.email || `${l.chamber === 'S' ? 'sen' : 'rep'}${String(l.sort_name || l.name).split(',')[0].toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov`;
export const chairWho = l => `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(l.sort_name || l.name).split(',')[0].trim()}`;
// The approved chair-ask email (W3) for these bills, to this chair alone, so "Did you send it?" records only them (V24).
// followUp: the same words, its subject starting "Following up:" (model.js chairAskMail). A bill heard but not voted on
// gets the decision-making email (one bill a time: that email names one bill).
export function chairMailFor(l, bills, { followUp = false } = {}) {
  const aw = bills.length ? askWords(bills[0]) : null; if (!aw?.code) return null;
  const st = stopOf(bills[0]);
  return chairAskMail(aw.code, aw.decide ? bills.slice(0, 1) : bills, { dl: st.deadline, to: { who: chairWho(l), email: mailOf(l), legId: l.id }, codes: bills.map(b => askWords(b)?.code || aw.code),
    followUp, ...(aw.decide ? { heardAt: st.hearing?.scheduled_at || new Date().toISOString() } : {}) });
}
// The asks with this chair that are the viewer's own to make: their bill's open ask (they own it, or it was given to them).
export const ownAsk = (b, s) => !!s && ((s.key === 'ask' && mine(b)) || (s.key === 'giving' && s.who === S.me?.id));
// This chair's ask the viewer made, with no reply after 3 working days (or 2 before the notice): time to follow up.
const followOf = (s, st) => !!s && s.key === 'waiting' && s.asker === S.me?.id && ['asked', 'left_message'].includes(s.answer || 'asked') && !!st?.ask?.followUp;

// The line a bill reads under one chair, the same on every Legislators screen: steps.js's row line (its words, askWords),
// said of this chair. Own: "Ask the chair by Fri 3/27", "Follow up with Sen. Keohokalole · asked Tue 3/10, no reply".
// Someone else's: "Lauren asks the chair by Tue 3/24", "Kris is asking · by Mon 3/23", "Asked by Kevin Tue 3/10 · no
// reply yet". Returns { s (this chair's ask), line, own (the viewer's to ask), follow (the viewer's to follow up),
// waitingMine (the viewer asked and waits: They replied), at (its day, to sort) }.
export function chairLine(b, l) {
  const s = chairAsk(b, l.id); if (!s || s.key === 'scheduled') return { s, line: s?.words || '', own: false, follow: false, at: Infinity };
  const st = billStep(b), me = S.me?.id, follow = followOf(s, st);
  let line = s.words;
  if (follow) line = `Follow up with ${chairWho(l)} · asked ${dayWords(s.at)}, ${s.answer === 'left_message' ? 'left a message' : 'no reply'}`;
  else if (s.key === 'ask' && !mine(b)) {
    const by = s.decide ? `for decision making${s.day ? ` by ${s.day}` : ''}` : `by ${s.day}`;
    const ids = (S.assignments?.[b.id] || []).filter(id => (S.advocates || []).some(a => a.id === id && a.is_active !== false));
    line = ids.length ? `${cap(orWords(ids))} ${ids.length > 1 ? 'ask' : 'asks'} the chair ${by}` : `No one holds it · ask the chair ${by}`;
  } else if (s.key === 'giving' && s.who !== me) {
    // A handed-over ask names whose bill it is, so it reads differently from the owner's own ("Rick asks the chair by
    // Tue 3/24"): askWords' "Kris is asking · by Mon 3/23" with "for Rick" (asked of steps.js too, so Hearings says it).
    const owners = (S.assignments?.[b.id] || []).filter(id => id !== s.who && (S.advocates || []).some(a => a.id === id && a.is_active !== false));
    if (owners.length) line = `${cap(firstWords(s.who))} is asking for ${orWords(owners, undefined, { and: true })}${s.aw && !s.aw.a.passed ? ` · by ${s.aw.day}` : ''}`;
  }
  const own = ownAsk(b, s) && s.key !== 'passed';
  return { s, line, own, follow, waitingMine: s.key === 'waiting' && (s.asker === me || mine(b)), at: s.by ?? s.aw?.a?.at ?? Infinity };
}
// The order of a chair's bills: the viewer's own first (to ask, then to follow up), then the rest by the day to ask.
const RANK = x => x.own ? 0 : x.follow ? 1 : x.waitingMine ? 2 : x.s?.key === 'ask' || x.s?.key === 'giving' ? 3 : x.s?.key === 'waiting' ? 4 : 5;
export const byChairOrder = (p, q) => RANK(p) - RANK(q) || p.at - q.at || p.b.bill_number.localeCompare(q.b.bill_number, 'en', { numeric: true });

// A chair's ONE email button: the viewer's own asks with them (new ones and follow-ups) in one approved email, to this
// chair alone, named by bill. '' when there is none. kind: 'secondary' on a list, 'primary' on the chair's own page.
export function chairEmail(l, rows, { kind = 'secondary', sm = true } = {}) {
  const ask = rows.filter(x => x.own), fu = rows.filter(x => x.follow), list = [...ask, ...fu];
  if (!list.length) return '';
  const hear = list.filter(x => !x.s?.decide), use = hear.length ? hear : list.slice(0, 1);   // the decision-making email names one bill
  const m = chairMailFor(l, use.map(x => x.b), { followUp: !ask.some(x => use.includes(x)) });
  if (!m) return '';
  const nums = use.map(x => numWords(x.b)), names = use.length > 2 ? `${use.length} bills` : andList(nums.map(n => n.replace(' ', '\u00a0')));   // "HB 756" never breaks
  const label = ask.some(x => use.includes(x)) ? `Email about ${names}` : `Email again about ${names}`;
  return btn(label, { kind, sm, icon: 'mail', href: m.href, attrs: { 'aria-label': `${label}, to ${chairWho(l)}${use.length > 2 ? `: ${andList(nums)}` : ''}` } });
}
// "They replied" for one chair: the chair's answer, saved for that chair only (V24; chairask.js's answerSheet saves it
// for every chair of the committee). One document listener, so any screen that draws the button wires nothing.
export const replyBtn = (b, l, code) => btn('They replied', { kind: 'secondary', sm: true, icon: 'message-square',
  attrs: { 'data-lgreply': `${b.id}|${code}|${l.id}`, 'aria-haspopup': 'dialog', 'aria-label': `${chairWho(l)} replied about ${numWords(b)}` } });
function replySheet(b, code, l) {
  menuSheet({ title: `What did ${chairWho(l)} say?`, items: ASK_ANSWERS.filter(([k]) => k !== 'asked')
    .map(([k, label, ic]) => ({ label, icon: ic, sub: numWords(b), run: () => recordAsk([{ id: b.id, code, legs: [l.id] }], k) })) });
}
if (typeof document !== 'undefined' && !globalThis.__lgReply) {
  globalThis.__lgReply = true;
  document.addEventListener('click', e => {
    const el = e.target?.closest?.('[data-lgreply]'); if (!el) return;
    e.preventDefault();
    const [bid, code, lid] = el.dataset.lgreply.split('|'), b = (S.bills || []).find(x => String(x.id) === bid), l = legById(lid);
    if (b && l) replySheet(b, code, l);
  });
}

// ---- the board's model: whose bills, which chairs (one path for every Legislators tab, X7) ----
// The scope switch is Hearings > Get hearings' own (push.js scopesFor, defaultScope, scopeOk) when it is there, so both
// places list the same bills; until then the same rules here: My bills (owned, followed or on my issue), My coalitions
// (helpers), Team.
export const SCOPE_WORDS = { mine: 'My bills', coal: 'My coalitions', team: 'Team' };
function coalOf(a = S.me) {
  const c = a?.prefs?.coalitions;
  if (c === 'all') return { ids: new Set((S.campaigns || []).map(x => x.id)) };
  const ids = Array.isArray(c) ? c.filter(id => (S.campaigns || []).some(x => x.id === id)) : [];
  return ids.length ? { ids: new Set(ids) } : null;
}
const inCoal = (b, co) => !!co && (S.billCampaigns?.[b.id] || []).some(id => co.ids.has(id));
export function askScopes() {
  if (typeof PUSH.scopesFor === 'function') return PUSH.scopesFor();
  return [...((S.bills || []).some(isMine) ? [['mine', SCOPE_WORDS.mine]] : []), ...(coalOf() ? [['coal', SCOPE_WORDS.coal]] : []), ['team', SCOPE_WORDS.team]];
}
export function askDefault() {
  if (typeof PUSH.defaultScope === 'function') return PUSH.defaultScope();
  const ok = askScopes().map(x => x[0]), owns = (S.bills || []).some(mine);
  return owns && ok.includes('mine') ? 'mine' : ok.includes('coal') ? 'coal' : ok[0];
}
function scopeOk(scope) {
  if (typeof PUSH.scopeOk === 'function') return PUSH.scopeOk(scope);
  const co = coalOf();
  return scope === 'team' ? b => b.tracked !== false : scope === 'coal' ? b => b.tracked !== false && (inCoal(b, co) || isMine(b)) : b => isMine(b);
}
export const askScope = want => { const ok = askScopes().map(x => x[0]); return ok.includes(want) ? want : askDefault(); };
export const scopeWhose = scope => scope === 'mine' ? 'your bills' : scope === 'coal' ? 'your coalitions’ bills' : 'the team’s bills';
// The bills waiting for a hearing in this scope (each with its ask), and how many have one set.
export function askItems(scope) {
  const ok = scopeOk(scope), all = (S.bills || []).filter(b => b.tracked !== false && ok(b)).map(b => ({ b, aw: askWords(b) })).filter(x => x.aw);
  return { items: all.filter(x => x.aw.key !== 'scheduled'), scheduled: all.filter(x => x.aw.key === 'scheduled').length };
}
// Each chair of each bill's committee with their bills (chairLine for each), the chairs by their soonest open ask: the
// day the line shows, so "the soonest ask first" is true of what is on the screen. Chairs with nothing left to ask after.
export function chairGroups(items) {
  const by = new Map();
  for (const x of items) for (const id of chairIdsOf(x.aw.code)) { if (!by.has(id)) by.set(id, []); by.get(id).push(x); }
  return [...by].map(([id, xs]) => { const l = legById(id); if (!l) return null;
    const rows = xs.map(x => ({ ...x, ...chairLine(x.b, l) })).sort(byChairOrder);
    const open = rows.filter(x => ['ask', 'giving'].includes(x.s?.key) || x.follow);
    return { l, rows, open, at: open.length ? Math.min(...open.map(x => x.at)) : Infinity, any: Math.min(...rows.map(x => x.at)) }; })
    .filter(Boolean).sort((p, q) => p.at - q.at || p.any - q.any || p.l.sort_name.localeCompare(q.l.sort_name));
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
// What is left with one chair, in the board's words: "HB 1563 to ask by Fri 3/27, HB 756 to follow up", or counts once
// there are more than two bills of a kind ("4 bills to ask by Tue 3/24"). One fact: the parts are joined by commas.
function leftWords(rows) {
  const part = (xs, what) => { if (!xs.length) return ''; const who = xs.length > 2 ? plural(xs.length, 'bill') : andList(xs.map(x => numWords(x.b))); return `${who} ${what}`; };
  const toAsk = rows.filter(x => ['ask', 'giving'].includes(x.s?.key)), day = toAsk.find(x => x.s.day || x.s.aw?.day);
  return [part(toAsk, `to ask${day ? ` by ${day.s.day || day.s.aw.day}` : ''}`), part(rows.filter(x => x.follow), 'to follow up'),
    part(rows.filter(x => x.s?.key === 'waiting' && !x.follow), 'waiting on a reply'), part(rows.filter(x => x.s?.key === 'said_no'), 'said no'),
    part(rows.filter(x => x.s?.key === 'passed'), 'out of time')].filter(Boolean).join(', ');
}
// One chair as a row: the name, their role on our bills ("Chair, Senate Commerce: HB 756 to follow up", one fact: the
// committee and what is left in it) and the last contact; at most one button, the chair's email (D16, at most 4 facts).
function holdRow(g) {
  const l = g.l, role = [chairRole(l, g.rows.map(x => x.aw.code)), leftWords(g.rows)].filter(Boolean).join(': ');
  const line = [role, contactWords(l)].filter(Boolean).join(' · ');
  return itemRow({ key: `hold-${l.id}`, name: `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${l.name}`, line: nw(esc(line)), href: `#/legislator/${l.id}?from=holding`, button: chairEmail(l, g.rows), cls: 'lg6-wrap' });
}
// holders(): kept for callers of the v5 shape ({ out, whose, own }); the rows are the board's (team-wide when you own none).
export function holders(scope = askDefault()) {
  const gs = chairGroups(askItems(scope).items);
  return { out: gs.map(g => ({ id: g.l.id, l: g.l, rows: g.rows, at: g.at })), whose: scopeWhose(scope), own: scope === 'mine' };
}
export function holdingHTML({ scope } = {}) {
  const sc = askScope(scope), gs = chairGroups(askItems(sc).items), whose = scopeWhose(sc);
  // Says what the tab is for beside Who to ask (the same chairs, one line each), so a newcomer can tell the two apart;
  // two lines at most on a 320 phone, so the first chair starts within 400px (A-1).
  const head = `<p class="lg6-sum">${esc(gs.length ? `${plural(gs.length, 'chair')} from Who to ask, one line each, the soonest ask first.` : `No chair holds ${whose} without a hearing.`)}</p>`;
  return `<div class="lg6-hold">${introLine()}${head}${gs.length ? `<div class="v6-list lg6-list" role="list" aria-label="${esc(`Chairs holding ${whose}`)}">${gs.map(holdRow).join('')}</div>` : ''}</div>`;
}
// Kept for v5 callers: the push board's ask buttons. Holding's own rows need no wiring (links, and the email is a link).
export const wireHolding = (root, after) => wirePush(root, after);
