// Speaking up by email beyond testimony (R-079, R-080, Nate 9/29). Three things live here, all opening the email
// walkthrough in pub/helper.js (app.openMail):
// 1. The bill page's email buttons to a chair ("Ask the chair for a hearing", "Email" beside a chair in "Who decides next",
//    the old quick-email button) and its floor-vote "Ask Rep. ... to vote yes" open the walkthrough instead of a bare
//    mailto. pub/bill.js belongs to another session, so this listens for those clicks first (capture) and takes them
//    over; a button this file does not know stays exactly as bill.js made it.
// 2. Writing to your own legislators at the right moment (R-080; Nate: "when their bill is near a floor vote or a
//    committee vote that their legislators sits on, or when their bill needs a hearing in a committee they sit on").
//    A moment is one of: 'floor' (a followed bill waits for a vote of the chamber one of theirs sits in), 'hearing' (one
//    of theirs sits on or chairs the committee at an upcoming hearing), 'chair' / 'member' (the bill waits for a hearing
//    in a committee one of theirs chairs / sits on). A hearing's moment is a row under "More ways to help"
//    (actions.js), where testimony still leads; the others are one card on Home, as the main suggestion only when Home
//    has nothing more urgent (no testimony, no ask of a chair).
// 3. The one-time introduction (R-080 C): a card on Home once someone has found their legislators and follows an issue,
//    "Introduce yourself to your legislators". Sent or "No thanks", it never comes back (hiphi_intro, this browser).
// Home (pub/home.js) belongs to another session too: its wire() already calls wireActions(root), and wireActions calls
// mountHome(root) here, which adds the cards to the page Home just drew.
// Who "your legislators" are: the districts this browser keeps after the address step or the Legislators page
// (hiphi_districts: the two district numbers, never the address) or, signed in, the account's districts.
import { S, esc, icon, spaced, nick, blurb, alive, posInfo, stopOf, hearingsOf, openActions, legsOf, askMark, agrees, myStance,
  followedIssues, firstVisit, cmteLabel, CHAMBER_NAME, app, billPath } from './core.js';
import { btn } from './ui.js';

const DISTRICTS_KEY = 'hiphi_districts', INTRO_KEY = 'hiphi_intro', SKIP_KEY = 'hiphi_speak_skip';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: it just is not remembered */ } };

// ---------------- your legislators ----------------
export function myDistricts() {
  const d = read(DISTRICTS_KEY, null);
  if (d && (+d.senate || +d.house)) return { senate: +d.senate || null, house: +d.house || null };
  const p = S.profile || {};
  return p.senate_district || p.house_district ? { senate: +p.senate_district || null, house: +p.house_district || null } : null;
}
// After a mid-term appointment the directory can list two people for one seat; the one with a Capitol email serves
// (the same rule as the Settings page).
function seat(ch, n) {
  if (!n) return null;
  const ls = (S.legislators || []).filter(l => l.chamber === ch && +l.district === +n && l.active !== false);
  return ls.find(l => l.email) || ls[0] || null;
}
export function myLegs() { const d = myDistricts(); return d ? [seat('S', d.senate), seat('H', d.house)].filter(Boolean) : []; }
const legName = l => `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(l.sort_name || l.name || '').split(',')[0].trim()}`;
const legWord = l => l.chamber === 'S' ? 'senator' : 'representative';
const the = code => { const c = cmteLabel(code); return /^the /i.test(c) ? c : `the ${c}`; };

// ---------------- the moments ----------------
// Every moment on one bill where one of the person's own legislators can make a difference now. all: also the ones
// they have already written about (the "More ways to help" row then shows "Sent").
export function legMoments(b, { all = false } = {}) {
  const legs = myLegs();
  if (!b || !legs.length || !alive(b) || !posInfo(b)) return [];
  const mine = code => legsOf(code).filter(m => legs.some(l => l.id === m.l.id));
  const out = [], st = stopOf(b);
  if (st.phase === 'floor') { const l = legs.find(x => x.chamber === st.chamber); if (l) out.push({ kind: 'floor', key: 'floor-' + st.chamber, chamber: st.chamber, legs: [l] }); }
  const acts = openActions([b], hearingsOf(b));
  for (const { h } of acts) {
    const on = mine(h.committee);
    if (on.length) out.push({ kind: 'hearing', key: 'hearing-' + h.id, h, code: h.committee, chair: on.some(m => m.role === 'chair'), legs: on.map(m => m.l) });
  }
  // Only while no hearing is coming at all: a bill heard today in one committee is not "waiting" in its next one yet.
  if (!acts.length && st.phase === 'committee' && st.hearingState === 'none' && st.committee && !st.deadline?.missed) {
    const on = mine(st.committee), chair = on.some(m => m.role === 'chair');
    if (on.length) out.push({ kind: chair ? 'chair' : 'member', key: 'cmte-' + st.committee, code: st.committee, chair, legs: (chair ? on.filter(m => m.role === 'chair') : on).map(m => m.l), days: st.deadline?.days });
  }
  // An ask already sent: by this moment, or by the bill page's own "Email the chair" for the same committee (R-120, Bug 4).
  const sent = m => S.done.has(askMark(b, m.key)) || (m.code && !m.h && S.done.has(askMark(b, m.code)));
  return all ? out : out.filter(m => !sent(m));
}
export const momentSent = (b, m) => S.done.has(askMark(b, m.key)) || (!!m.code && !m.h && S.done.has(askMark(b, m.code)));
export function openMoment(b, m) {
  app.openMail?.({ mode: 'legislators', bill: b.id, hearing: m.h?.id, legs: m.legs.map(l => l.id),
    moment: { kind: m.kind, key: m.key, chamber: m.chamber || m.legs[0]?.chamber, code: m.code || null, chair: !!m.chair } });
}
const stanceOf = b => { const s = myStance(b.id); return s === 'support' || s === 'oppose' ? s : agrees(b) === false ? '' : /oppose/.test(b.hiphi_position || '') ? 'oppose' : 'support'; };
// The words for one moment: a headline that says the ask, and one line of why.
function momentWords(b, m) {
  const who = m.legs.map(legName), one = who.join(' and '), n = spaced(b.bill_number), s = stanceOf(b);
  const head = m.kind === 'floor' ? (s ? `Ask ${one} to vote ${s === 'oppose' ? 'no' : 'yes'} on ${n}` : `Tell ${one} what you think of ${n}`)
    : m.kind === 'hearing' ? `Write to ${one} about ${n}`
    : m.kind === 'chair' ? (s === 'oppose' ? `Ask ${one} to hold ${n}` : `Ask ${one} to give ${n} a hearing`)
    : `Ask ${one} to help ${n} get a hearing`;
  const your = m.legs.length === 1 ? `your ${legWord(m.legs[0])}` : 'your legislators';
  const why = m.kind === 'floor' ? `It comes to a vote of the full ${CHAMBER_NAME[m.chamber] || 'chamber'} soon, and ${one} is ${your}.`
    : m.kind === 'hearing' ? `${one}, ${your}, ${m.chair ? 'chairs' : 'sits on'} ${the(m.code)}, which hears it soon.`
    : m.kind === 'chair' ? `It is waiting for a hearing in ${the(m.code)}, and ${one}, ${your}, chairs it.`
    : `It is waiting for a hearing in ${the(m.code)}, where ${one}, ${your}, is a member.`;
  return { head, why };
}

// The row under "More ways to help" on an action card, for a hearing where one of theirs sits on the committee.
export function hearingRow(b, h, moreRow) {
  const m = legMoments(b, { all: true }).find(x => x.kind === 'hearing' && x.h.id === h.id); if (!m) return '';
  const who = m.legs.map(legName).join(' and '), your = m.legs.length === 1 ? `Your ${legWord(m.legs[0])}` : 'Your legislators';
  return moreRow('user-check', `Write to ${esc(who)} · 3 min`, `${your} ${m.chair ? 'chairs' : m.legs.length > 1 ? 'sit on' : 'sits on'} this committee. A note from someone they represent carries weight.`,
    { 'data-speak': `${b.id}|${m.key}`, 'data-mail-h': h.id }, momentSent(b, m) && 'Sent');
}

// ---------------- Home: one moment card, and the introduction ----------------
const skipped = () => new Set(read(SKIP_KEY, []));
function homeMoment() {
  const skip = skipped(), rank = { floor: 0, chair: 1, member: 2 };
  const all = (S.bills || []).filter(b => S.watch.has(b.id)).flatMap(b => legMoments(b).filter(m => m.kind !== 'hearing' && !skip.has(`${b.id}|${m.key}`)).map(m => ({ b, m })));
  return all.sort((x, y) => rank[x.m.kind] - rank[y.m.kind] || (x.m.days ?? 99) - (y.m.days ?? 99))[0] || null;
}
function momentCard({ b, m }, primary) {
  const w = momentWords(b, m), id = `sp-m-${esc(b.id)}`;
  return `<section class="card sp-card" aria-labelledby="${id}" data-sp="moment">
    <p class="sp-eyebrow">${icon('user-check')}<span>${m.legs.length === 1 ? `Your ${legWord(m.legs[0])} can help` : 'Your legislators can help'}</span></p>
    <h2 class="sp-t" id="${id}"><a href="${billPath(b)}">${esc(w.head)}</a></h2>
    <p class="small sp-what">${esc(nick(b) || blurb(b, 120))}</p>
    <p class="small">${esc(w.why)} A short note from someone they represent carries weight.</p>
    <div class="btnrow sp-btns">${btn(`Write to ${m.legs.length === 1 ? esc(legName(m.legs[0])) : 'them'}`, { kind: primary ? 'primary' : 'secondary', icon: 'mail', attrs: { 'data-speak': `${b.id}|${m.key}` } })}
      ${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-speak-no': `${b.id}|${m.key}` } })}</div>
  </section>`;
}
export const introState = () => read(INTRO_KEY, null);
export function introMark(how) { write(INTRO_KEY, { how, at: new Date().toISOString() }); }
// Offered once someone has found their legislators (an address, a district or the account's) and follows an issue.
export const introOffered = () => !introState() && !firstVisit() && followedIssues().length > 0 && myLegs().some(l => l.email);
function introCard() {
  const legs = myLegs().filter(l => l.email), names = legs.map(legName).join(' and ');
  return `<section class="card sp-card sp-intro" aria-labelledby="sp-it" data-sp="intro">
    <h2 class="sp-t" id="sp-it">${icon('hand-heart')}<span>Introduce yourself to your ${legs.length === 1 ? legWord(legs[0]) : 'legislators'}</span></h2>
    <p class="small">A short hello to ${esc(names)}: who you are and the issues you follow. About 3 minutes, and they know you before any vote.</p>
    <div class="btnrow sp-btns">${btn('Write my introduction', { kind: 'secondary', icon: 'mail', attrs: { 'data-speak-intro': '1' } })}
      ${btn('No thanks', { kind: 'text', sm: true, attrs: { 'data-speak-introno': '1' } })}</div>
  </section>`;
}
// Called by wireActions on every Home draw. Home's own columns: '.hm-main' and '.hm-side' in session, two '.hm-col'
// between sessions. Nothing is added to the first visit's Home or when Home has not drawn its columns.
export function mountHome(root) {
  if (!root?.classList?.contains('hm') || root.querySelector('[data-sp]')) return;
  const side = root.querySelector('.cols > .hm-side'), cols = root.querySelectorAll('.cols > .hm-col'), main = root.querySelector('.cols > .hm-main');
  const moment = main ? homeMoment() : null;
  if (moment) {
    // The main suggestion only when Home offers nothing more urgent: no testimony card, no ask of a chair (A-3).
    const calm = !main.querySelector('.btn.primary') && !main.querySelector('.hm-now, .hm-asks');
    const html = momentCard(moment, calm);
    if (calm) (main.querySelector('.hm-head') || main.firstElementChild)?.insertAdjacentHTML('afterend', html);
    else side?.insertAdjacentHTML('afterbegin', html);
  }
  if (introOffered()) {
    if (side) side.insertAdjacentHTML('afterbegin', introCard());
    else if (cols[1]) (cols[1].querySelector('.hm-ready') || cols[1].firstElementChild)?.insertAdjacentHTML('afterend', introCard());
  }
  wire(root);
}
function wire(root) {
  root.querySelectorAll('[data-speak]').forEach(el => el.onclick = () => openKey(el.dataset.speak));
  root.querySelectorAll('[data-speak-no]').forEach(el => el.onclick = () => { write(SKIP_KEY, [...skipped(), el.dataset.speakNo]); app.render(); });
  root.querySelector('[data-speak-intro]')?.addEventListener('click', () => app.openMail?.({ mode: 'intro', legs: myLegs().filter(l => l.email).map(l => l.id) }));
  root.querySelector('[data-speak-introno]')?.addEventListener('click', () => { introMark('no'); app.render(); });
}
const allBills = () => [...(S.bills || []), ...Object.values(S.extra || {}), ...((S.featured || {}).bills || []), ...((S.pool || {}).bills || [])];
export function openKey(k) {
  const i = k.indexOf('|'), b = allBills().find(x => x.id === k.slice(0, i)), key = k.slice(i + 1);
  const m = b && legMoments(b, { all: true }).find(x => x.key === key);
  if (m) openMoment(b, m);
}

// ---------------- the bill page's email buttons (pub/bill.js) ----------------
// The bill in the address, with its session when the link names one (#/bill/2026/HB1518: every share page's link, R-110).
// Without the year these buttons fell back to a bare email for anyone who came from a shared link (found 10/5, R-169).
const numOf = () => { const m = /#\/bill\/(?:(\d{4})\/)?([A-Za-z]+\s?\d+)/.exec(decodeURIComponent(location.hash)) || [];
  return { num: String(m[2] || '').replace(/\s/g, '').toUpperCase(), year: +m[1] || 0 }; };
function planFor(el, b) {
  const act = openActions([b], hearingsOf(b))[0] || null, st = stopOf(b), waiting = st.phase === 'committee' && st.hearingState === 'none' && !!st.committee;
  if (el.matches('[data-bl-compose]')) { const hid = el.dataset.blCompose.split('|')[1]; return hid ? { mode: 'email', bill: b.id, hearing: hid, chair: el.dataset.blChair || '' } : null; }
  if (el.matches('[data-bl-go="compose"]')) return act ? { mode: 'email', bill: b.id, hearing: act.h.id } : null;
  if (el.matches('[data-bl-main="ask"], [data-bl-main="hold"]')) return waiting ? { mode: 'email', bill: b.id, code: st.committee } : null;
  if (el.matches('[data-bl-main="remind"]')) return waiting ? { mode: 'email', bill: b.id, code: st.committee, remind: true } : null;   // R-153
  if (el.matches('[data-bl-main="floor"]')) {
    const m = legMoments(b, { all: true }).find(x => x.kind === 'floor');
    return m ? { mode: 'legislators', bill: b.id, legs: m.legs.map(l => l.id), moment: { kind: 'floor', key: m.key, chamber: m.chamber } } : null;
  }
  // "Email" beside a chair: the hearing's email when one is coming, the ask for a hearing while the bill waits. After a
  // hearing (the committee is deciding) the plain email stays as it was.
  if (el.matches('[data-bl-chair][data-bl-mail]')) return act ? { mode: 'email', bill: b.id, hearing: act.h.id } : waiting ? { mode: 'email', bill: b.id, code: st.committee } : null;
  return null;
}
document.addEventListener('click', e => {
  if (!app.openMail || !/^#\/bill\//.test(location.hash) || e.button > 0 || e.metaKey || e.ctrlKey) return;
  const el = e.target.closest?.('[data-bl-compose], [data-bl-go="compose"], [data-bl-main="ask"], [data-bl-main="hold"], [data-bl-main="remind"], [data-bl-main="floor"], [data-bl-chair][data-bl-mail]');
  if (!el) return;
  const { num, year } = numOf(), mine = allBills().filter(x => x.bill_number === num);
  const b = (year && mine.find(x => +x.session_year === year)) || mine[0], plan = b && planFor(el, b);
  if (!plan) return;
  e.preventDefault(); e.stopPropagation();
  app.openMail(plan);
}, true);
