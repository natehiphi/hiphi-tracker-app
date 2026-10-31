// The chair-line helpers that Hearings' Bills That Need Hearings, a legislator's page and conversations share, and who
// introduced a bill (F140). Holding our bills (the page this file was named for) went away in R-356 round 2, decision 4;
// Legislators > Who to ask went with it, so asking chairs for a hearing lives only on Hearings. R-316 W41; Staff v6 (V24).
// - One chair's ask on one bill (chairAsk, chairLine): steps.js's words (askWords) said of that one chair. On a joint
//   committee each chair is asked on their own: asking one never marks the other (V24), and every email goes to that chair.
//   A chair's email (chairEmail) is ONE button wherever the chair is drawn: the viewer's own asks with them, new ones and
//   follow-ups, named by bill ("Email about HB 1563 and HB 756"), so a chair never carries two email buttons.
// - Committee member lists mark who introduced the bill, or its twin in the other chamber ("Introduced SB3044, the Senate
//   version"): introChip(b, l) and introSort(b, members), drawn by the bill's Committees (pathway.js) and a hearing's page.
import { S, esc } from './data.js';
import { stopOf, billByNum, companionsOf, plain, chairIdsOf, legNotesAll, chairAskMail, legById, ASK_ANSWERS } from './model.js';
import { icon, btn, menuSheet } from './ui.js';
import { askWords, billStep, dayWords, firstWords, orWords, numWords } from './steps.js';
import { askLine, recordAsk } from './chairask.js';

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const mine = b => (S.assignments?.[b.id] || []).includes(S.me?.id);
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// ---- who introduced a bill (F140) ----
// A bill's introducers as legislators, the lead first. The Capitol names them by surname ("Kong", "Lee, M."), matched in
// the bill's own chamber, by first initial when two share a surname (as the bill page's W18 links are).
const key = s => plain(String(s || '')).replace(/[^a-z ]/g, '').trim();
function introLegs(b) {
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
function introOf(b, l) {
  const own = introLegs(b).find(x => x.l.id === l.id);
  if (own) return { rank: own.lead ? 0 : 1, words: own.lead ? 'Lead introducer' : 'Introduced this bill' };
  for (const n of companionsOf(b)) { const c = billByNum(n, b.session_year); if (!c || c.id === b.id) continue;
    const x = introLegs(c).find(y => y.l.id === l.id); if (x) return { rank: x.lead ? 2 : 3, words: `${x.lead ? 'Led' : 'Introduced'} ${c.bill_number}, the ${/^H/i.test(c.bill_number) ? 'House' : 'Senate'} version` }; }
  return null;
}
// introChip(b, l): the same call as before (BILL and HEARINGS draw it); its v6 look is in css/legislators.css.
export const introChip = (b, l) => { const x = introOf(b, l); return x ? `<span class="hb-intro">${icon('pencil')}<span>${esc(x.words)}</span></span>` : ''; };
// Leadership first (chairs decide), then the introducers, the lead first, then everyone else (legsOf's order kept).
export const introSort = (b, members) => members.map((m, i) => [m, i, m.role !== 'member' ? -1 : introOf(b, m.l)?.rank ?? 9]).sort((x, y) => x[2] - y[2] || x[1] - y[1]).map(x => x[0]);

// ---- one chair's ask on one bill (V24) ----
// On a joint committee the ask is per chair. The bill's record (askWords) says "asked" once any chair was asked, so for a
// chair nobody has asked yet this is still "ask", and their email goes to them alone. Only a row saved as an ask counts
// (it carries its answer, migration 183): a talk that was not an ask never marks the bill asked.
function chairAsk(b, chairId) {
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
    return { ...aw, key: 'ask', words: aw.decide ? `Ask the chair to schedule a vote${day ? ` by ${day}` : ''}` : `Ask the chair by ${day}`, day, by: aw.aw?.a.at ?? null, other: true };
  }
  return aw;
}
// This chair's address: the directory's, else the Capitol's pattern (model.js chairMail's rule).
const mailOf = l => l.email || `${l.chamber === 'S' ? 'sen' : 'rep'}${String(l.sort_name || l.name).split(',')[0].toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov`;
export const chairWho = l => `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(l.sort_name || l.name).split(',')[0].trim()}`;
// The approved chair-ask email (W3) for these bills, to this chair alone, so "Did you send it?" records only them (V24).
// followUp: the same words, its subject starting "Following up:" (model.js chairAskMail). A bill heard but not voted on
// gets the email asking the chair to schedule a vote (one bill a time: that email names one bill).
export function chairMailFor(l, bills, { followUp = false } = {}) {
  const aw = bills.length ? askWords(bills[0]) : null; if (!aw?.code) return null;
  const st = stopOf(bills[0]);
  return chairAskMail(aw.code, aw.decide ? bills.slice(0, 1) : bills, { dl: st.deadline, to: { who: chairWho(l), email: mailOf(l), legId: l.id }, codes: bills.map(b => askWords(b)?.code || aw.code),
    followUp, ...(aw.decide ? { heardAt: st.hearing?.scheduled_at || new Date().toISOString() } : {}) });
}
// The asks with this chair that are the viewer's own to make: their bill's open ask (they own it, or it was given to them).
const ownAsk = (b, s) => !!s && ((s.key === 'ask' && mine(b)) || (s.key === 'giving' && s.who === S.me?.id));
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
    const by = s.decide ? `to schedule a vote${s.day ? ` by ${s.day}` : ''}` : `by ${s.day}`;
    const ids = (S.assignments?.[b.id] || []).filter(id => (S.advocates || []).some(a => a.id === id && a.is_active !== false));
    line = ids.length ? `${cap(orWords(ids))} ${ids.length > 1 ? 'ask' : 'asks'} the chair ${by}` : `No one holds it · ask the chair ${by}`;
  }
  // A handed-over ask keeps askWords' one wording ("Kris asks the chair for Rick · by Mon 3/23"), as Hearings and the bill
  // say it (spec 7.6: one wording per fact; a third one here read "Kris is asking for Rick").
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
  const hear = list.filter(x => !x.s?.decide), use = hear.length ? hear : list.slice(0, 1);   // the email asking for a vote names one bill
  const m = chairMailFor(l, use.map(x => x.b), { followUp: !ask.some(x => use.includes(x)) });
  if (!m) return '';
  const nums = use.map(x => numWords(x.b));
  // One name per act (spec 8): "Email the chair" and "Follow up", as Get hearings says them; the bills are in the label for
  // screen readers and in the rows under it.
  const fresh = ask.some(x => use.includes(x)), label = fresh ? 'Email the chair' : 'Follow up';
  return btn(label, { kind, sm, icon: fresh ? 'mail' : 'clock', href: m.href, attrs: { 'aria-label': `${fresh ? `Email the chair, ${chairWho(l)},` : `Follow up with ${chairWho(l)}`} about ${andList(nums)}` } });
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
