// The first visit (R-023, rebuilt 9/21 from the prototype Nate approved; backend docs/FIRST-VISIT-PLAN.md). Three named
// parts at the top, "Your issues · How it works · Stay connected", and no counting (HANDOFF 3.5; Nate 9/21: keep the
// named steps, remove the progress bar):
//   Your issues     topics -> issues (followed, then the "Mahalo!" moment) -> where you stand (optional, in session)
//   How it works    three short lessons on the person's own bill: reading a bill, the session, a hearing
//                   (pub/lessons.js), then the "Now you know how it works" moment
//   Stay connected  who speaks for you (street address only) -> coming up on your issues, THEN the one ask for an
//                   email (Nate 9/21: ask after the value) -> you're all set (the peak, then Home)
// Someone who arrives on a shared bill starts on the bill page itself (pub/bill.js: the easiest action first); from
// there the flow is "follow this issue?", the lessons on that bill, then the last part.
// People follow ISSUES, not bills (R-018). No action is pushed here; the asks to act come on later visits. The email is
// one "keep me updated" opt-in covering hearing alerts and HIPHI's own advocacy alerts (HANDOFF 3.5). Every step is its
// own route (#/start/1..N) and pushes history, so Back walks the steps. The step and the picks live in hiphi_wiz
// (wiz()/wizSet()), so a reload resumes where the person left off. Every step can be skipped, "Skip" always means "go
// to the next page" (3.5), and a primary button is never disabled. Celebrations are in proportion (DESIGN C-7 as
// rewritten 9/21): a small burst for a small win, a moment that waits for Continue for the first follow and for the
// lessons, and the peak at the end. Motion follows A-10 (pub/fx.js) and stops under Reduce Motion.
import { S, DEMO, app, esc, icon, blurb, nick, spaced, billPath, alive, sessionInfo, wiz, wizSet, HST, hstDay, anyBill, myStance,
  setStance, sendEmailLink, validEmail, friendly, toast, nudge, legTitle, legPhoto, ensureRecapPool, loadCatalog,
  recomputeWatch, issuesIn, issueBills, issueFollowed, followedIssues, followsAnything, viaIssue, issuePos, setFollows,
  issuesOf, toggleWatch, timeWord, ensureBill, supa } from './core.js';
import { btn, chip, posChip } from './ui.js';
import { CAPITOL, VOICES, islands, flower } from './art.js';
import { topics } from './topics.js';
import { createAddressPicker } from './addresspicker.js';
import { burst, celebrate, later, swap, reduced } from './fx.js';
import { exampleFrom, lessonHTML, lessonStart, lessonNext, lessonStop, LESSON_TITLES } from './lessons.js';
import { logVisit, visitVia, partnerWelcome } from './visitlog.js';

const isOff = () => sessionInfo().phase !== 'in';
// The first visit as named screens. Between sessions nothing is moving, so there is no stand to take. From a shared
// bill (wiz().via is its number), the first part happened on the bill page.
const FLOW_IN = ['topics', 'issues', 'stand', 'bill', 'session', 'hearing', 'you', 'soon', 'done'];
const FLOW_OFF = ['topics', 'issues', 'bill', 'session', 'hearing', 'you', 'soon', 'done'];
const FLOW_LINK = ['followask', 'bill', 'session', 'hearing', 'you', 'soon', 'done'];
const flowOf = off => wiz().via ? FLOW_LINK : off ? FLOW_OFF : FLOW_IN;
const nameAt = (step, off) => { const f = flowOf(off); return f[Math.min(Math.max(step | 0, 1), f.length) - 1]; };
const stepOf = (name, off) => flowOf(off).indexOf(name) + 1;
const total = off => flowOf(off).length;
const pathKey = () => wiz().via ? 'link' : isOff() ? 'off' : 'in';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const andList = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
// "Wednesday, January 20" for a Hawaiʻi calendar day
const longDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' });
const hasPos = b => b && b.hiphi_position && b.hiphi_position !== 'monitor';
// Which island to pick out in the drawing, when this device or the account knows the person's Senate district:
// 1-4 Hawaiʻi Island, 5-6 Maui, 8 Kauaʻi, 9-25 Oʻahu (7 spans Maui, Molokaʻi and Lānaʻi, so it picks none).
function myIsland() {
  let sd = +((S.profile || {}).senate_district) || 0;
  if (!sd) { try { sd = +JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate || 0; } catch { sd = 0; } }
  return sd >= 9 ? 'oahu' : sd === 8 ? 'kauai' : sd >= 5 && sd <= 6 ? 'maui' : sd >= 1 && sd <= 4 ? 'hawaii' : '';
}

// ---------- the private visit counts (R-023 decision 8): one row per screen reached and how it was left ----------
let viewKey = '', viewAt = 0;
const track = (step, event, extra = {}) => { try { logVisit(step, event, { path: pathKey(), seconds: viewAt ? Math.round((Date.now() - viewAt) / 1000) : undefined, ...extra }); } catch { /* never in the way */ } };

// Closing the tab (or leaving the site) mid-visit is counted as leaving that screen, with the seconds spent on it.
window.addEventListener('pagehide', () => { if (document.body.dataset.screen === 'start' && viewKey) track(viewKey.split('|')[1], 'leave'); });

// ---------- moving between screens: forward steps are tagged, so the on-screen Back can use the real Back ----------
function goStep(from, to) {
  lessonStop();
  swap(() => {
    app.go('#/start/' + to);
    try { history.replaceState({ ...(history.state || {}), stFrom: from }, ''); } catch { /* ignore */ }
  }, 'fwd');
}
function goBack(step) {
  const off = isOff();
  let to = step - 1;
  // "Where do you stand" is passed over when nothing followed is moving yet, so Back passes over it too.
  if (nameAt(to, off) === 'stand' && !standIdeas().length) to -= 1;
  if (to < 1) { history.back(); return; }
  track(nameAt(step, off), 'back');
  lessonStop();
  S.stBack = true;
  // A person who resumed straight onto a later step has no step behind them; history.back() would leave the site.
  swap(() => { if (history.state?.stFrom === to) history.back(); else app.go('#/start/' + to); }, 'back');
}
// Home shows a calm welcome for the rest of this visit instead of pushing actions (home.js reads this key). It is set
// as soon as issues are followed, so leaving early by Skip or the logo still lands on the calm Home.
const welcome = () => { try { sessionStorage.setItem('hiphi_welcome', '1'); } catch { /* private mode */ } };
// Finishing the first visit. Between sessions we also note when the next session opens, so the start can greet them
// with HIPHI's picks then (core: readyForSession).
function finish() {
  const si = sessionInfo();
  track('done', 'done');
  wizSet({ done: true, step: 1, ...(si.phase !== 'in' ? { ready: si.nextOpen } : {}) });
  welcome();
  app.go('#/', { replace: true });
}
const skipAll = () => { wizSet({ skipped: true }); app.go('#/'); };

// ---------- the three named parts at the top: a signpost, not controls (A-12) ----------
// Done is a green tick and the name, now is the name in bold after a solid dot, still to come is a small grey dot and
// a quiet name. No rings or boxes (they read as radio buttons), no bar, no numbers. Below 360px only the current name
// is written out (start.css); a screen reader hears all three.
const CHAPTERS = ['Your issues', 'How it works', 'Stay connected'];
const CHAPTER_OF = { topics: 0, issues: 0, stand: 0, followask: 0, bill: 1, session: 1, hearing: 1, you: 2, soon: 2, done: 3 };
let lastChapter = -1;
function chaptersRow(name) {
  const k = CHAPTER_OF[name] ?? -1; if (k < 0) return '';
  return `<nav class="st-chapters" aria-label="Your first visit"><ol>${CHAPTERS.map((c, i) => `<li class="${i < k ? 'done' : i === k ? 'on' : ''}"${i === k ? ' aria-current="step"' : ''}>
    <span class="st-cm" aria-hidden="true">${i < k ? icon('check') : ''}</span><span class="st-cl">${c}</span>${i < k ? '<span class="sr"> (done)</span>' : ''}</li>`).join('')}</ol></nav>`;
}
// Finishing a part ticks it with a small burst: one of the stage celebrations (C-7).
function tickChapter(name, back) {
  const k = CHAPTER_OF[name] ?? -1;
  if (!back && lastChapter >= 0 && k > lastChapter) later(() => burst(document.querySelectorAll('.st-chapters li')[k - 1]?.querySelector('.st-cm'), 10, 34), 350);
  if (k >= 0) lastChapter = k;
}

// ---------- the page frame of a step: the story (left on wide screens) and the choices (right) ----------
const backBtn = step => btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stback': String(step) } });
const topRow = (name, step) => `${chaptersRow(name)}${step > 1 ? `<div class="steps st-steps">${backBtn(step)}</div>` : ''}`;
const shell = (cls, intro, main, busy = false) => `<div class="st ${cls}"${busy ? ' aria-busy="true"' : ''}><div class="st-intro">${intro}</div><div class="st-main">${main}</div></div>`;
// The drawing of each step (wide screens show one on every step; phones only where there is room, see start.css).
const artFor = name => `<div class="st-art">${name === 'you' ? islands(myIsland()) : name === 'stand' || name === 'followask' ? VOICES : CAPITOL}</div>`;
// One line above the choices: a reassurance, which the "pick at least one" message replaces in place (so nothing
// below it moves and no choice gets covered).
const sayRow = (ic, sure) => `<div class="st-say"><p class="st-sure">${icon(ic)}<span>${sure}</span></p><p class="st-alert" id="st-alert" role="alert"></p></div>`;
// On wide screens the reassurance belongs with the story on the left, and only the message shows above the choices.
const sureWide = (ic, sure) => `<p class="st-sure st-surewide">${icon(ic)}<span>${sure}</span></p>`;

// ---------- the bar: one Skip, one primary ----------
const bar2 = (label, opt = {}, attrs = { 'data-stnext': '1' }, skip = 'Skip') => `<div class="st-bar"><div class="st-btns">
  ${btn(skip, { kind: 'text', attrs: { 'data-stskip': '1' } })}${btn(label, { kind: 'primary', ...opt, attrs })}</div></div>`;
// While the issues load the primary says so, and when they could not be loaded it is the way to try again, so the
// one button on the screen is never a dead one.
const barBusy = () => bar2('Finding issues…', { icon: 'loader-circle' }, { 'data-stnext': '1', 'aria-busy': 'true' });
const barRetry = () => bar2('Try again', { icon: 'rotate-ccw' }, { 'data-stretry': '1' });
const bar1 = (label, ic = 'arrow-right', attrs = { 'data-stnext': '1' }) => `<div class="st-bar st-one">${btn(label, { kind: 'primary', iconEnd: ic, attrs })}</div>`;
// Only Skip, as a quiet full-width button: an optional screen before anything is done on it (A-3: no primary yet).
const barSkip = () => `<div class="st-bar st-one">${btn('Skip', { kind: 'secondary', attrs: { 'data-stskip': '1' } })}</div>`;
const followLabel = n => n ? `Follow ${plural(n, 'issue')}` : 'Follow issues';

// ================= Importance (Nate, 9/21): what HIPHI backs hardest and the team's top priority lead =================
// An issue's importance, used only for order (FIRST-VISIT-PLAN "Importance"): HIPHI's strongest position on a moving
// bill in it (strongly support 40, support 20, only opposes 15, neutral 5); the team's priority 1 on one of its bills
// (public_issues.top_priority: only this flag is public, never a bill's priority) +30; recommended by staff (the issue
// or one of its bills) +25; a hearing in the next 7 days +15; 3 for each moving bill, up to 3. Between sessions
// "moving" means any of last session's bills, there is no hearing term, and an issue already won loses 25 so the open
// fights lead. A category's importance is the sum of its top four. Staff can leave an issue out of the first visit
// altogether (issues.first_visit, the switch in Staff v2 Outreach > Issues).
const supports = b => /support/.test(b.hiphi_position || b.position || '');
const poolBills = () => (S.pool && S.pool.bills) || [];
let poolRef = null, poolSet = new Set();
const poolIds = () => { if (poolRef !== S.pool) { poolRef = S.pool; poolSet = new Set(poolBills().map(b => b.id)); } return poolSet; };
const shown = i => i.first_visit !== false;
const inPlay = i => shown(i) && (isOff() ? issueBills(i).length > 0 : issueBills(i).some(id => poolIds().has(id)));
// Soonest upcoming hearing per bill, from what the page already loaded (the next two weeks).
function ranker() {
  const now = Date.now(), soon = new Map();
  for (const h of [...((S.pool || {}).hearings || []), ...((S.featured || {}).hearings || []), ...S.hearings]) {
    if (h.status !== 'scheduled' || new Date(h.scheduled_at) <= now) continue;
    const c = soon.get(h.bill_id); if (!c || h.scheduled_at < c.scheduled_at) soon.set(h.bill_id, h);
  }
  const info = b => { const h = soon.get(b.id) || null, open = !!h && (!h.testimony_deadline || new Date(h.testimony_deadline) > now);
    return { h, tier: open ? 0 : h ? 1 : /^strongly/.test(b.hiphi_position || '') ? 2 : 3, when: h ? ((open && h.testimony_deadline) || h.scheduled_at) : '' }; };
  const POS_W = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
  const cmp = (a, b) => { const x = info(a), y = info(b); return x.tier - y.tier || x.when.localeCompare(y.when)
    || (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }); };
  return { info, cmp, soon };
}
// One issue as the first visit sees it: its bills (this session's, or last session's between sessions), HIPHI's
// position on it, what is happening, and how important it is.
function issueInfo(i, R) {
  const off = isOff(), from = off ? ((S.recapPool && S.recapPool.bills) || []) : poolBills();
  const bills = issueBills(i).map(id => from.find(b => b.id === id) || anyBill(id)).filter(Boolean);
  const live = bills.filter(b => alive(b) || b.stage === 'governor');
  const lead = (off ? bills : live).slice().sort(R.cmp)[0] || bills[0] || null;
  const law = bills.some(b => b.stage === 'enacted');
  const moving = off ? bills : live, strong = moving.some(b => b.hiphi_position === 'strongly_support');
  const opposed = moving.length > 0 && moving.every(b => /oppose/.test(b.hiphi_position || ''));
  const neutral = moving.length > 0 && moving.every(b => (b.hiphi_position || 'neutral') === 'neutral');   // HIPHI takes no side: last
  const rec = !!i.recommended || bills.some(b => b.hiphi_recommended);
  const inf = lead && !off ? R.info(lead) : null, soon7 = !off && live.some(b => { const h = R.soon.get(b.id); return h && new Date(h.scheduled_at) - Date.now() < 7 * 864e5; });
  const score = (strong ? 40 : neutral ? 5 : opposed ? 15 : 20) + (i.top_priority ? 30 : 0) + (rec ? 25 : 0) + (soon7 ? 15 : 0) + Math.min(moving.length, 3) * 3 - (off && law ? 25 : 0);
  // Ticked for you (silently: no "HIPHI recommends" label, R-022): staff-recommended, or strongly supported and not
  // already won.
  return { i, bills, live, lead, law, pos: issuePos(off ? bills : live.length ? live : bills), promoted: rec || (strong && !(off && law)), inf, score };
}
const byScore = (x, y) => y.score - x.score || (x.i.sort_order ?? 100) - (y.i.sort_order ?? 100) || x.i.name.localeCompare(y.i.name);
const TOP = 4;
const catScore = rows => rows.slice(0, TOP).reduce((n, x) => n + x.score, 0);
// The six categories, most important first (R-018's categories; if they did not load, the old six from topics.js
// stand in, counted by bills, so the screen still works).
function catList() {
  if (!S.cats.length) return topics(poolBills().filter(supports)).map(t => ({ ...t, count: t.bills, fallback: true, rows: [], score: 0 }));
  const R = ranker();
  return S.cats.map(c => { const iss = issuesIn(c.key).filter(inPlay), rows = iss.map(i => issueInfo(i, R)).sort(byScore);
    return { key: c.name, topicKey: c.key, names: [c.key], icon: c.icon, description: c.description, issues: iss, count: iss.length,
      wins: rows.filter(x => x.law).length, rows, score: catScore(rows) }; })
    .sort((a, b) => b.score - a.score || (b.count || 0) - (a.count || 0));
}
const topicList = catList;
// The picks on screen 1 are categories (R-018).
const pickedIssues = () => { const sel = new Set(wiz().issues || []); return topicList().filter(i => sel.has(i.key) || i.names.some(n => sel.has(n))); };

// ================= Your issues, 1: what do you care about? =================
// Six tiles, most important first (Nate 9/21), each saying what is in play: in session the issues still moving,
// between sessions the wins of last session (or its issues).
const SURE1 = 'About 4 minutes. Free, and no account needed.';
function tiles(off, yr) {
  const sel = new Set(wiz().issues || []);
  return `<div class="st-tiles" role="group" aria-labelledby="st-h">${catList().map(i => {
    const on = sel.has(i.key) || i.names.some(n => sel.has(n));
    const meta = i.fallback ? plural(i.count || 0, 'bill') : off ? (i.wins ? `${plural(i.wins, 'win')} in ${yr}` : `${plural(i.count, 'issue')} in ${yr}`) : `${plural(i.count, 'issue')} moving`;
    return `<button type="button" class="st-issue st-tile" data-stissue="${esc(i.names[0])}" aria-pressed="${on}">
      <span class="st-ilead">${icon(i.icon)}</span><span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="st-iname">${esc(i.key)}</span>${i.description ? `<span class="st-idesc">${esc(i.description)}</span>` : ''}<span class="st-icount">${esc(meta)}</span></button>`;
  }).join('')}</div>`;
}
// Someone who came from a partner's link or flyer (?via=slug) is welcomed in that partner's words, once, above the
// heading (the line staff wrote in Staff v2; nothing when there is none).
S.stWelcome ??= undefined;
function partnerLine() {
  const via = visitVia(); if (!via) return '';
  if (S.stWelcome === undefined) { S.stWelcome = null; partnerWelcome(via).then(t => { if (t) { S.stWelcome = t; app.render(); } }).catch(() => {}); }
  return S.stWelcome ? `<p class="st-partner">${icon('sparkles')}<span>${esc(S.stWelcome)}</span></p>` : '';
}
function stepTopics(step) {
  const si = sessionInfo(), off = si.phase !== 'in', yr = off ? si.recapYear : si.yr;
  const next = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1;
  return shell('st1 st-topics', `${topRow('topics', step)}${partnerLine()}${artFor('topics')}
    <h1 class="hero" id="st-h">${off ? `Get ready for the ${next} session` : 'Speak up for a healthier Hawaiʻi'}</h1>
    <p class="lede">${off ? `The Legislature opens ${esc(shortDay(si.nextOpen))}. Pick what you care about, and we’ll tell you when your voice can count.`
      : 'Pick what you care about. We’ll tell you when your voice can make a difference.'}</p>${sureWide('clock', SURE1)}`,
    `${sayRow('clock', SURE1)}${tiles(off, yr)}`);
}

// ================= Your issues, 2: the issues inside them =================
// Each category picked on screen 1 opens to its issues, most important first: the top four, the rest behind "Show N
// more issues" (Nate 9/21). What gets saved is the issue itself, so its bills - this session's, later ones, next
// session's - reach the person without them doing anything more. Only the four shown can start ticked, so nothing is
// followed unseen: HIPHI's strongly supported and staff-recommended ones among them, else the most important one. One
// "Follow all" per category, which also brings issues HIPHI takes up there later (R-018).
const sigOf = (off, sel) => `${off ? 'off' : 'in'}|${sel.map(i => i.topicKey || i.key).join('|')}`;
function model2() {
  const off = isOff(), sel = pickedIssues(), sig = sigOf(off, sel), yr = sessionInfo().recapYear;
  if (!sel.length) return { none: true };
  if (!S.issues.length) return { err: true, sig, sel };
  if (off && !(S.recapPool && S.recapPool.yr === yr)) {
    if (S.recapFailed === yr) return { err: true, sig, sel };
    ensureRecapPool(yr); return { loading: true, sig, sel };
  }
  const R = ranker(), w = wiz();
  const per = sel.map(c => ({ c, rows: c.rows && c.rows.length ? c.rows : (c.issues || []).map(i => issueInfo(i, R)).sort(byScore) }))
    .sort((a, b) => catScore(b.rows) - catScore(a.rows));
  // An issue in two picked categories (the DUI limit is alcohol policy and road safety) is shown once, in the more
  // important one, so it is never ticked in one place and hidden in another (the review, 9/21).
  const once = new Set();
  per.forEach(p => { p.rows = p.rows.filter(x => !once.has(x.i.id) && once.add(x.i.id)); });
  per.forEach((p, k) => { p.open = S.stOpen[p.c.topicKey] ?? (k < 2 || p.rows.length <= TOP); });
  const all = per.flatMap(p => p.rows);
  // What is ticked: what the person chose on this screen once they have touched it, else HIPHI's defaults.
  let picks = w.picksFor === sig && w.picks && !Array.isArray(w.picks) ? w.picks : null;
  if (!picks) {
    // Ticked for you only where the person can see it: among the four shown in a category that starts open.
    const ids = [];
    for (const p of per.filter(q => q.open)) { const top = p.rows.slice(0, TOP), pro = top.filter(x => x.promoted); (pro.length ? pro : top.slice(0, 1)).forEach(x => ids.push(x.i.id)); }
    picks = { issues: [...new Set(ids)], cats: [] };
  }
  const catOn = new Set(picks.cats), issueOn = new Set(picks.issues);
  const ticked = x => issueOn.has(x.i.id) || x.i.categories.some(c => catOn.has(c));
  const count = new Set(all.filter(ticked).map(x => x.i.id)).size;
  return { off, sig, sel, per, all, picks, catOn, issueOn, ticked, count, R };
}
// One issue to follow. The whole card is the toggle (a real button). Where its description is cut, a small "What it
// does" button opens it in place, on the card's bottom edge beside the toggle rather than inside it.
S.stWhat ??= new Set();
function issueCard(x, m, secKey, extra) {
  const i = x.i, on = m.ticked(x), tid = `st-w-${secKey}-${i.slug}`, open = S.stWhat.has(tid);
  const h = x.inf && x.inf.h, within8 = h && new Date(h.scheduled_at) - Date.now() < 8 * 864e5;
  const day = within8 ? (hstDay(h.scheduled_at) === hstDay(Date.now()) ? 'today' : new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })) : '';
  const top = day ? chip(`Hearing ${day}`, 'info', 'calendar') : m.off && x.law ? chip(`Became law in ${sessionInfo().recapYear}`, 'ok', 'circle-check') : '';
  const n = m.off ? x.bills.length : x.live.length, b = x.lead, billsText = n > 1 ? `${n} bills${b ? `, including ${spaced(b.bill_number)}` : ''}` : b ? spaced(b.bill_number) : '';
  return `<li class="st-pcard${on ? ' on' : ''}${open ? ' st-open' : ''}${extra ? ' st-extra' : ''}"${extra && !S.stMore[secKey] ? ' hidden' : ''}>
    <button type="button" class="st-pick" data-stpick="${esc(i.id)}" data-stcat="${esc(secKey)}" aria-pressed="${on}">
      <span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="st-pbody">
        ${top ? `<span class="st-ptop">${top}</span>` : ''}
        <span class="st-phead">${esc(i.name)}</span>
        ${i.description ? `<span class="st-pwhat st-clamp" id="${tid}">${esc(i.description)}</span>` : ''}
        <span class="st-pmeta"><span>${esc(billsText)}</span>${x.pos ? posChip({ hiphi_position: x.pos }) : ''}</span>
      </span></button>
    ${i.description ? `<button type="button" class="st-what" data-stwhat="${esc(tid)}" aria-expanded="${open}" aria-controls="${tid}" hidden><span>What it does<span class="sr">: ${esc(i.name)}</span></span>${icon('chevron-down')}</button>` : ''}</li>`;
}
// Show "What it does" only on cards whose text is really cut off at this width (or is open, so it can be closed).
function fitWhat() {
  document.querySelectorAll('.st-pcard:not([hidden])').forEach(card => {
    const t = card.querySelector('.st-clamp'), w = card.querySelector('.st-what'); if (!t || !w) return;
    const need = card.classList.contains('st-open') || t.scrollHeight > t.clientHeight + 1;
    w.hidden = !need; card.classList.toggle('st-haswhat', need);
  });
}
let fitT = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(fitT); fitT = requestAnimationFrame(fitWhat); });
const catAll = (c, n, all) => `${btn(`${all ? 'Following all' : 'Follow all'}<span class="sr"> of ${esc(c.key)}</span>`, { kind: 'text', sm: true, icon: all ? 'check' : 'star', cls: all ? 'on' : '', attrs: { 'data-stfollowcat': c.topicKey, 'aria-pressed': String(all) } })}
  <p class="st-catnote">${all ? 'New issues HIPHI takes up too.' : n > 1 ? `All ${n}, plus new ones.` : 'Plus any new ones.'}</p>`;
// One <details> per category. The first always starts open; a small one (four issues or fewer) also starts open; a busy
// one past the first starts folded, and then says what is ticked inside it (A-14).
S.stOpen ??= {};
S.stMore ??= {};
function pickedLine(p, m) {
  if (m.catOn.has(p.c.topicKey)) return 'Following all';
  const on = p.rows.filter(m.ticked).map(x => x.i.name);
  return !on.length ? '' : `${on.length} ticked: ${andList(on)}`;
}
function catSection(p, m, isFirst) {
  const c = p.c, n = p.rows.length, open = p.open, said = pickedLine(p, m), extra = Math.max(0, n - TOP), more = !!S.stMore[c.topicKey];
  return `<details class="st-tsec"${open ? ' open' : ''} data-stsec="${esc(c.topicKey)}">
    <summary><span class="st-tsum">${icon(c.icon)}<span class="st-tnamebox"><span class="st-tname">${esc(c.key)}</span><span class="st-tpicked" data-stpicked="${esc(c.topicKey)}"${said ? '' : ' hidden'}>${esc(said)}</span></span><span class="st-tcount">${plural(n, 'issue')}</span></span>${icon('chevron-down', { cls: 'st-tchev' })}</summary>
    <div class="st-tbody2"><div class="st-catall" data-stcatall="${esc(c.topicKey)}">${catAll(c, n, m.catOn.has(c.topicKey))}</div>
      <ul class="st-picks" role="list">${p.rows.map((x, k) => issueCard(x, m, c.topicKey, k >= TOP)).join('')}</ul>
      ${extra ? `<button type="button" class="st-morebtn" data-stmore="${esc(c.topicKey)}" aria-expanded="${more}">${icon('chevron-down')}<span>${more ? 'Show fewer' : `Show ${plural(extra, 'more issue')}`}</span></button>` : ''}
    </div></details>`;
}
// A category with nothing in play right now can still be followed whole: its issues and bills come as they start.
const quietCat = (c, m) => `<li class="card st-quiet"><span class="st-ilead">${icon(c.icon)}</span>
    <span class="st-ibody"><span class="st-iname">${esc(c.key)}</span><span class="st-idesc">Nothing is moving on it right now.</span></span>
    <div class="st-catall" data-stcatall="${esc(c.topicKey)}">${catAll(c, 0, m.catOn.has(c.topicKey))}</div></li>`;
const skel = (step, said = 'Finding HIPHI’s issues for you') => shell('', `<p class="sr" role="status">${said}</p>
  <div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:64px"></div>`, '<div class="skel" style="height:128px"></div>'.repeat(3), true);
const loadErr = step => shell('', `${topRow('issues', step)}`, `<div class="empty st-err"><h1 class="st-errh" id="st-h">We couldn’t load the issues</h1><p>Check your connection and try again.</p></div>`);
function stepIssues(step) {
  const off = isOff(), m = model2();
  if (m.none || m.loading) return skel(step);
  if (m.err) return loadErr(step);
  const si = sessionInfo(), yr = off ? si.recapYear : si.yr, next = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1;
  const groups = m.per.filter(p => p.rows.length), quiet = m.per.filter(p => !p.rows.length).map(p => p.c);
  const total = new Set(m.all.map(x => x.i.id)).size, ticked = m.count;
  const lede = !total ? `Nothing is moving on ${andList(quiet.map(c => c.key))} right now. Follow ${quiet.length === 1 ? 'it' : 'them'} anyway, and new issues and bills come to you as they start.`
    : off ? `Here’s what HIPHI worked on in ${yr}, most important first. Follow an issue, and its ${next} bills come to you.`
    : ticked ? `Most important first. We ticked ${ticked === 1 ? 'one' : ticked} to start you off; change them any time.` : 'Most important first. Tick the ones you care about.';
  return shell('st2', `${topRow('issues', step)}
    <h1 class="hero" id="st-h">Your issues</h1><p class="lede">${lede}</p>`,
    `<div class="st-say"><p class="st-alert" id="st-alert" role="alert"></p></div>${groups.length ? `<div class="st-tsecs" role="group" aria-labelledby="st-h">${groups.map((p, k) => catSection(p, m, k === 0)).join('')}</div>` : ''}
    ${quiet.length ? `<ul class="st-quiets" role="list">${quiet.map(c => quietCat(c, m)).join('')}</ul>` : ''}`);
}

// ================= Your issues, 3 (in session): where do you stand? (optional) =================
// At most three cards, one at a time, from the issues just followed, most urgent first (then bills followed on their
// own). A card covers every bill of its issue that is still moving, and the answer is saved on each of them. A small
// burst on each Support or Oppose (C-7). Never shown publicly.
function standIdeas() {
  const R = ranker(), w = wiz(), seen = new Set(), out = [];
  for (const id of [...(w.followedIssues || []), ...followedIssues().map(i => i.id)]) {
    if (seen.has(id)) continue; seen.add(id);
    const i = S.issueById.get(id); if (!i || !issueFollowed(i)) continue;
    const bills = issueBills(i).filter(bid => S.watch.has(bid)).map(bid => S.bills.find(b => b.id === bid) || anyBill(bid)).filter(b => b && alive(b)).sort(R.cmp);
    if (bills.length) out.push({ key: 'i:' + i.id, name: i.name, desc: i.description || '', bills });
  }
  for (const b of S.bills) if (S.direct.has(b.id) && !viaIssue(b) && alive(b)) out.push({ key: 'b:' + b.id, name: nick(b) || null, desc: blurb(b, 140), bills: [b] });
  return out;
}
const followedBills = () => standIdeas().flatMap(x => x.bills);
const STAND_MAX = 3;
S.stStandAt ??= 0;
function stepStand(step) {
  const ideas = standIdeas().slice(0, STAND_MAX);
  if (!ideas.length) return skel(step);   // redirectFor moves on: nothing is moving yet
  const at = Math.min(S.stStandAt, ideas.length), doneAll = at >= ideas.length;
  // The card speaks for the issue: HIPHI's position on the issue (not on whichever bill comes first), and an answer is
  // saved only on the bills that go the issue's way. "Higher liquor taxes" holds a bill that raises the tax and one that
  // cuts it; supporting the issue must never be saved as support for the cut (the review, 9/21).
  const card = (x, k) => { const b = x.bills[0], dir = issuePos(x.bills) || '', pos = k - at, hid = `st-sn${k}`, nums = x.bills.length;
    const way = /support/.test(dir) ? /support/ : /oppose/.test(dir) ? /oppose/ : null;
    const aligned = way ? x.bills.filter(y => way.test(y.hiphi_position || '')) : x.bills, ids = (aligned.length ? aligned : [b]).map(y => y.id).join(',');
    return `<article class="st-scard" data-k="${k}" data-pos="${pos < 0 ? 'gone' : pos}" aria-hidden="${pos !== 0}"${pos < 0 ? ' hidden' : ''}>
      <p class="st-seyebrow">${ideas.length > 1 ? `${k + 1} of ${ideas.length}` : 'Just one'}</p>
      <h2 class="st-shead" id="${hid}">${esc(x.name || blurb(b, 90))}</h2>
      <p class="st-smeta"><span>${plural(nums, 'bill')} this session</span>${dir ? posChip({ hiphi_position: dir }) : ''}</p>
      ${x.desc ? `<p class="st-sdesc">${esc(x.desc)}</p>` : ''}
      <div class="st-sbtns" role="group" aria-labelledby="${hid}">
        ${[['support', 'Support', 'thumbs-up'], ['oppose', 'Oppose', 'thumbs-down'], ['unsure', 'Not sure yet', '']].map(([v, label, ic]) =>
          `<button type="button" class="btn secondary${v === 'unsure' ? ' st-swide' : ''}" data-ststance="${esc(ids)}|${v}"${pos !== 0 ? ' tabindex="-1"' : ''}>${ic ? icon(ic) : ''}<span>${label}</span></button>`).join('')}</div></article>`; };
  return shell('st3', `${topRow('stand', step)}${artFor('stand')}
    <h1 class="hero" id="st-h">Where do you stand?</h1>
    <p class="lede">Optional, and never shown publicly. If you add your email, HIPHI staff can see your answers.</p>`,
    `<div class="st-stack" id="st-stack"${doneAll ? ' hidden' : ''}>${ideas.map(card).join('')}</div>
    <div id="st-standdone"${doneAll ? '' : ' hidden'}>${doneAll ? standDone() : ''}</div><p class="sr" role="status" id="st-live"></p>`);
}
const standDone = () => `<div class="st-standdone">${icon('circle-check')}<p><b>Thanks.</b> Change your answers any time on a bill’s page.</p></div>`;

// ================= How it works: three lessons on the person's own bill (pub/lessons.js) =================
// The example (decision 6, which answers R-020). In session: the first followed issue, in the order the person picked
// categories and then screen 2's order, with a bill that has a scheduled hearing in the next 7 days; else a followed
// bill alive in its second chamber; else the most advanced followed bill. Between sessions: a 2026 law with a HIPHI
// position in the first picked category; else the next category's; else SB 2175. From a shared bill: that bill. Never
// a bill in an issue staff left out of the first visit.
let exCache = null, exKey = '';
function exampleBill() {
  const off = isOff(), w = wiz();
  if (w.via) return anyBill(w.viaId) || S.bills.find(b => b.bill_number === w.via) || null;
  const left = b => issuesOf(b).length && issuesOf(b).every(i => !shown(i));
  if (off) {
    // Last session's bills load once per visit (a person who skipped the first screens has not loaded them yet); the
    // lesson waits for them rather than drawing nothing.
    const yr = sessionInfo().recapYear; if (!(S.recapPool && S.recapPool.yr === yr)) { ensureRecapPool(yr); return null; }
    const R = ranker(), cats = [...new Set([...(w.followedCats || []), ...pickedIssues().map(c => c.topicKey), ...followedIssues().map(i => i.category)])];
    for (const k of cats) for (const i of issuesIn(k).filter(i => shown(i) && issueFollowed(i))) {
      const law = issueInfo(i, R).bills.find(b => b.stage === 'enacted' && hasPos(b)); if (law) return law; }
    const recap = (S.recapPool && S.recapPool.bills) || [];
    return recap.find(b => b.bill_number === 'SB2175') || anyBill((recap.find(b => b.stage === 'enacted' && hasPos(b)) || {}).id) || recap.find(b => b.stage === 'enacted') || null;
  }
  const R = ranker(), bills = followedBills().filter(b => !left(b));
  const soon = b => { const h = R.soon.get(b.id); return h && new Date(h.scheduled_at) - Date.now() < 7 * 864e5; };
  const second = b => /^second|conference/.test(b.stage || '');
  const pick = bills.find(soon) || bills.find(second) || bills[0];
  if (pick) return pick;
  // Nothing followed (Skip on the first screen): one HIPHI is working on, with a hearing ahead if there is one.
  const pool = poolBills().filter(b => hasPos(b) && !left(b)).sort(R.cmp);
  return pool.find(b => b.hiphi_position === 'strongly_support' && soon(b)) || pool.find(soon) || pool[0] || null;
}
// An example the page has not loaded in full (a law between sessions, a bill HIPHI works on that nobody here follows) is
// fetched once with its hearings, then the lessons redraw with its real hearing instead of a made-up one.
S.exLoading ??= new Set();
// Between sessions the example is a law whose hearings are months old, older than the public hearings view keeps (30
// days), so its whole history comes from public_bill_hearings (migration 070), once, merged into what is loaded.
S.histLoading ??= new Set();
async function fullHistory(b) {
  if (DEMO || !b || S.histLoading.has(b.id)) return;
  S.histLoading.add(b.id);
  try {
    const { data, error } = await (await supa()).rpc('public_bill_hearings', { bill: b.id }); if (error) throw error;
    const have = new Map(((S.xh || {})[b.id] || []).map(h => [h.id, h]));
    for (const r of data || []) {
      have.set(r.id, { ...have.get(r.id), id: r.id, bill_id: r.bill_id, bill_number: b.bill_number, committee: r.committee, scheduled_at: r.scheduled_at,
        room: r.room, status: r.status, testimony_deadline: r.testimony_deadline, notice_posted_at: r.notice_posted_at });
      if (r.outcome) S.outcomes[r.id] = { hearing_id: r.id, bill_id: r.bill_id, committee: r.committee, scheduled_at: r.scheduled_at, outcome: r.outcome };
    }
    S.xh[b.id] = [...have.values()];
    exKey = ''; app.render();
  } catch (e) { console.error(e); }   // the lesson keeps its labelled example hearing
}
function example() {
  const w = wiz(), b = exampleBill(), full = !!b && (S.bills.some(x => x.id === b.id) || !!(S.xh || {})[b.id]);
  // Between sessions the example is already on the page (last session's bills) and only its hearings are missing:
  // one load, the full history. Two loads raced, and the 30-day one emptied what the full one had filled.
  if (b && isOff()) fullHistory(b);
  else if (b && !full && !S.exLoading.has(b.id)) { S.exLoading.add(b.id); ensureBill(b.bill_number).then(() => { exKey = ''; app.render(); }).catch(() => {}); }
  const via = w.via ? (viaFollowed() ? 'followed' : 'link') : '';
  const key = `${isOff()}|${via}|${b ? b.id : ''}|${full}|${[...S.watch].length}|${S.bills.length}|${(S.recapPool || {}).yr || ''}`;
  if (key !== exKey) { exKey = key; exCache = exampleFrom(b, { off: isOff(), via }); }
  return exCache;
}
function stepLesson(name, step) {
  const E = example();
  if (!E) return skel(step, 'Finding a bill to show you');   // last session's bills are still on their way
  const L = lessonHTML(name, E);
  return shell('st-lesson', `${topRow(name, step)}${L.intro}`, L.main);
}

// ================= Stay connected, 1: who speaks for you, by street address =================
// A street address only (Nate, 9/21: a town is not enough to find a legislator). The debounced address search is its
// own module (addresspicker.js) so this screen runs an independent instance. The address is used to find the districts
// and is never saved, and staff never see it (CLAUDE.md rule 3).
const APstart = createAddressPicker();
S.stAddr ??= { q: '', pick: null, finding: false, err: '' };
const roleWord = r => r === 'chair' ? 'chairs' : r === 'vice_chair' ? 'is vice chair of' : 'sits on';
// Why these two people matter to the example bill: their committee seats against its referrals.
function connection(E, legs) {
  if (!E || !(E.path || []).length) return 'They vote on your bills when they reach the House and Senate floors, and they listen closest to the people they represent.';
  const hearing = new Set((E.hear && !E.hear.example && !E.hear.past ? E.hear.codes : []) || []);
  const parts = legs.map(l => {
    const seats = S.committeeMembers.filter(m => m.legislator_id === l.id && E.path.includes(m.committee))
      .sort((a, b) => ({ chair: 0, vice_chair: 1, member: 2 }[a.role] ?? 3) - ({ chair: 0, vice_chair: 1, member: 2 }[b.role] ?? 3));
    const s = seats[0]; if (!s) return null;
    const ch = l.chamber === 'S' ? 'Senate' : 'House', now = hearing.has(s.committee);
    const crossed = E.now >= 3 && ch === E.start;   // the first side's committees are behind it once it has crossed
    const what = now ? `one of the committees hearing it${E.hear?.day ? ` on ${E.hear.day}` : ''}` : crossed || E.off ? `a ${ch} committee that ${E.off ? 'passed' : 'already passed'} it` : `a ${ch} committee that hears it`;
    return `${legTitle(l)} ${l.last || l.name.split(' ').slice(-1)[0]} ${roleWord(s.role)} ${what}`;
  });
  const said = parts.filter(Boolean);
  if (!said.length) return 'They vote on your bills when they reach the House and Senate floors, and they listen closest to the people they represent.';
  return said.length === 2 ? `Both have a hand in ${E.num}: ${said[0]}, and ${said[1]}.` : `${said[0]}.`;
}
// An address that looks complete can be looked up as typed, as in the full legislator finder: the suggestions come from
// our own address list, which a new street or a slow connection can leave empty (Enter does the same).
const typed = (q, results) => q.length >= 5 && /^\d/.test(q) && !results.some(r => r.exact);
const lastName = l => { const s = String(l.sort_name || '').split(',')[0].trim(); return s || String(l.name || '').split(' ').slice(-1)[0]; };
function stepYou(step) {
  const A = S.stAddr, E = example();
  let body;
  if (A.pick) {
    const legs = A.pick.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean).map(l => ({ ...l, last: lastName(l) }))
      .sort((a, b) => (a.chamber === 'H' ? 0 : 1) - (b.chamber === 'H' ? 0 : 1));
    const legCard = l => `<li class="st-leg">${legPhoto(l, 'st-legpic')}<span class="st-tbody"><b>${esc(legTitle(l))} ${esc(l.name)}</b><span>Your ${l.chamber === 'S' ? 'senator' : 'representative'} · District ${esc(String(l.district))}</span></span></li>`;
    body = `<p class="st-addrline">${icon('map-pin')}<span>${esc(A.pick.label || A.q)}</span></p>
      <ul class="st-legs" id="st-legs" role="list">${legs.map(legCard).join('')}</ul>
      <p class="st-connect">${icon('sparkles')}<span>${esc(connection(E, legs))}</span></p>
      ${btn('Use a different address', { kind: 'text', attrs: { 'data-staddrclear': '1' } })}`;
  } else if (A.finding) {
    body = `<p class="st-info-small" role="status">${icon('loader-circle', { cls: 'pp-spin' })}<span>Finding your districts…</span></p>`;
  } else {
    const q = A.q.trim(), results = APstart.results(q);
    body = `<div class="field"><label for="st-addr">Your street address</label>
        <input id="st-addr" type="text" autocomplete="street-address" placeholder="Start typing, like 45-600 Keaahala Rd" value="${esc(A.q)}" data-staddr="1">
        <span class="help">We use it only to find your districts. It isn’t saved.</span></div>
      ${A.err ? `<p class="st-info-small">${icon('info')}<span>${esc(A.err)}</span></p>` : ''}
      ${results.length || typed(q, results) ? `<div class="st-sugs" role="group" aria-label="Addresses">${results.map((r, i) => `<button type="button" class="st-sug" data-staddrpick="${i}">${icon('map-pin')}<span>${esc(r.label)}</span></button>`).join('')}
        ${typed(q, results) ? `<button type="button" class="st-sug" data-staddrtyped="1">${icon('search')}<span>Look up “${esc(q)}” as typed</span></button>` : ''}</div>` : ''}`;
  }
  return shell('st1 st-you', `${topRow('you', step)}${artFor('you')}
    <h1 class="hero" id="st-h">Who speaks for you</h1>
    <p class="lede">One senator and one representative speak for where you live. Lawmakers listen closest to the people they represent.</p>`,
    `<div class="st-legwrap" id="st-youstage">${body}</div>`);
}

// ================= Stay connected, 2: coming up on your issues, then the one ask =================
// The value first: what is happening this week on the issues they follow (hearings in date order, with the day
// testimony is due). Then one ask, named after that value: a reminder before testimony is due, by email, with an
// optional first name (Nate 9/21: ask for the email after the value). One "keep me updated" opt-in covers hearing
// alerts and HIPHI's advocacy alerts (HANDOFF 3.5). Signed in, there is nothing to ask. Email to the public stays
// paused regardless (sendEmailLink only sends the sign-in link).
S.stMail ??= { email: '', name: '', sent: '', demo: false };
function mailSent() {
  if (!S.stMail.sent) { try { S.stMail.sent = sessionStorage.getItem('hiphi_link_sent') || ''; } catch { /* ignore */ } }
  return S.stMail.sent;
}
const WEEKDAY = d => new Date(d).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' });
// A committee named briefly enough for one line on a phone: "Senate Health and Commerce committees". A long name keeps
// its first part ("Health and Human Services" -> "Health"); a short one stays whole ("Ways and Means").
function briefCmte(code) {
  const cs = String(code || '').split('/').map(c => S.committees[c.trim()]).filter(Boolean);
  if (!cs.length) return 'A committee';
  const ch = cs[0].chamber === 'S' ? 'Senate' : 'House';
  const short = n => { const words = n.split(/\s+/); return words.length <= 3 ? n : n.split(/\s+(?:and|&)\s+|,\s*/)[0]; };
  return `${ch} ${andList(cs.map(c => short(c.name)))} ${cs.length > 1 ? 'committees' : 'Committee'}`;
}
const WEEKDAY_LONG = d => new Date(d).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' });
function upcoming() {
  const off = isOff(), R = ranker(), out = [];
  if (off) {
    const si = sessionInfo(), yr = si.recapYear, next = si.nextOpen;
    for (const i of followedIssues().filter(shown)) { const x = issueInfo(i, R); if (x.law) out.push({ when: String(yr), title: i.name, line: `Became law in ${yr}`, kind: 'ok' }); if (out.length >= 2) break; }
    if (next) out.push({ when: new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' }), title: `The ${+next.slice(0, 4)} session opens`,
      line: `New bills on ${followedIssues().length ? 'the issues you follow' : 'HIPHI’s issues'} can start that week.`, kind: 'soon' });
    return out;
  }
  // One row per followed issue: its soonest hearing in the next 7 days.
  const seen = new Set(), E = example();
  const rows = [];
  for (const i of followedIssues().filter(shown)) {
    const x = issueInfo(i, R), bs = x.live.map(b => ({ b, h: R.soon.get(b.id) })).filter(y => y.h && new Date(y.h.scheduled_at) - Date.now() < 7 * 864e5)
      .sort((p, q) => p.h.scheduled_at.localeCompare(q.h.scheduled_at));
    if (!bs.length || seen.has(i.id)) continue; seen.add(i.id);
    const { b, h } = bs[0], due = h.testimony_deadline ? `Testimony due ${WEEKDAY_LONG(h.testimony_deadline)} at ${timeWord(h.testimony_deadline)}.` : '';
    rows.push({ at: h.scheduled_at, when: WEEKDAY(h.scheduled_at), title: `${i.name}`, line: `${spaced(b.bill_number)}: ${briefCmte(h.committee)} hearing, ${timeWord(h.scheduled_at)}. ${due}`.trim(), kind: 'hear' });
  }
  rows.sort((p, q) => p.at.localeCompare(q.at)).slice(0, 3).forEach(r => out.push(r));
  if (!out.length && E) out.push({ when: 'Soon', title: E.name, line: 'No hearing on your issues this week yet. We’ll tell you when one is set.', kind: 'soon' });
  return out;
}
function askCard() {
  const M = S.stMail, sent = mailSent(), off = isOff();
  if (S.session) return `<section class="card st-sent" aria-labelledby="st-sent-t"><span class="st-ilead">${icon('bell')}</span>
    <div class="st-sentbody"><h2 id="st-sent-t">You’re signed in</h2><p>Reminders and HIPHI’s alerts go to your account’s email. Change them any time in More.</p></div></section>`;
  if (sent) return `<section class="card st-sent" aria-labelledby="st-sent-t" id="st-sentbox">
    <span class="st-ilead">${icon('mail-check')}</span>
    <div class="st-sentbody"><h2 id="st-sent-t" tabindex="-1">Check your inbox at <span class="st-break">${esc(sent)}</span></h2>
      <p>Tap the link in the email to turn on your reminders. It can take a minute; check spam if you don’t see it.</p>
      ${M.demo ? '<p class="small muted">This is the sandbox, so nothing was sent.</p>' : ''}
      <div class="st-formbtns">${btn('Use a different email', { kind: 'text', attrs: { 'data-stother': '1' } })}</div></div></section>`;
  const title = off ? 'Want to know when your issues start moving?' : wiz().via ? 'Want to hear how it goes?' : 'Want a reminder before testimony is due?';
  return `<form class="card st-form st-askcard" id="st-eform" novalidate>
    <h2 class="st-askh">${icon('bell')}<span>${esc(title)}</span></h2>
    <p class="st-promise">We’ll email you when it’s your moment to speak up on your issues, and send HIPHI’s alerts about them. Unsubscribe in one tap.</p>
    <div class="field"><label for="st-email">Your email</label>
      <input id="st-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="name@example.com" value="${esc(M.email)}">
      <span class="err" id="st-email-err" role="alert"></span></div>
    <div class="field"><label for="st-name">First name <span class="st-opt">(optional, so we can greet you)</span></label>
      <input id="st-name" name="name" type="text" autocomplete="given-name" placeholder="Leilani" value="${esc(M.name || wiz().name || '')}"></div>
    <p class="meta">No password: we send you a link to sign in, which also keeps your issues on any device. HIPHI staff can see which issues you follow and where you stand, so they know what the community cares about. <a href="#/privacy">Privacy</a></p>
  </form>`;
}
function stepSoon(step) {
  const off = isOff(), items = upcoming();
  const list = `<ol class="st-soon" role="list">${items.map((it, k) => `<li style="--k:${k}"><span class="st-when st-when-${it.kind}">${esc(it.when)}</span><div><b>${esc(it.title)}</b><span>${esc(it.line)}</span></div></li>`).join('')}</ol>`;
  return shell('st4 st-soonpage', `${topRow('soon', step)}
    <h1 class="hero" id="st-h">${off ? 'Your issues, this year and next' : 'Coming up on your issues'}</h1>
    <p class="lede">${off ? `What happened in ${sessionInfo().recapYear}, and what comes next.` : followsAnything() ? 'Here’s what’s happening this week on the issues you follow.' : 'Here’s what’s happening this week.'}</p>
    ${list}`,
    `<div id="st-askbox">${askCard()}</div>`);
}

// ================= Stay connected, 3: you're all set (the peak; Nate 9/21: end on a high) =================
// Everything they did, each line ticking in, while petals fall once and flowers bloom under the Capitol as the sun
// comes up (the bookend to the first screen's drawing). Then what happens next. Nothing here asks for anything.
function recapRows() {
  const f = followedIssues(), off = isOff(), stances = S.stances || {}, n = [...S.watch].map(anyBill).filter(b => b && (off || alive(b))).length;
  const stood = new Set(followedBills().filter(b => ['support', 'oppose'].includes(stances[b.id])).map(b => viaIssue(b)?.id || b.id)).size;
  const acted = wiz().via && wiz().viaActed;
  const legs = S.stAddr.pick ? S.stAddr.pick.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean)
    .sort((a, b) => (a.chamber === 'H' ? 0 : 1) - (b.chamber === 'H' ? 0 : 1)) : [];
  const sent = mailSent();
  return [
    f.length || n ? ['star', f.length ? `You follow ${plural(f.length, 'issue')}` : `You follow ${plural(n, 'bill')}`, off ? 'Their new bills come to you as they start' : `${plural(n, 'bill')} we’ll watch for you`, 'ok'] : null,
    acted ? ['send', `You spoke up on ${wiz().viaName || spaced(wiz().via)}`, 'Your email to the chairs', 'ok'] : null,
    stood ? ['thumbs-up', `You took a stand on ${plural(stood, 'issue')}`, 'Never shown publicly', 'ok'] : null,
    S.stLearned ? ['landmark', 'You know how a bill becomes law', 'And when your voice counts most', 'ok'] : null,
    legs.length ? ['users', 'You know who speaks for you', legs.map(l => `${legTitle(l)} ${lastName(l)}`).join(' and '), 'ok'] : null,
    S.session ? ['bell', 'Reminders are on', 'At your account’s email', 'ok']
      : sent ? ['mail', 'Reminders: one tap to go', `Tap the link we sent to ${sent}`, 'wait'] : ['bell', 'Reminders are off', 'Turn them on any time in More', 'off'],
  ].filter(Boolean);
}
function stepDone(step) {
  const name = (S.stMail.name || wiz().name || '').trim(), off = isOff();
  const rows = recapRows();
  const petals = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 53) % 100}%;--r:${(i * 47) % 360}deg;--t:${1.6 + (i % 5) * .22}s;--d:${(i % 6) * .12}s;--c:${i % 3 ? 'var(--o400)' : i % 2 ? '#F9D56E' : 'var(--p300)'}"></i>`).join('');
  const art = CAPITOL.replace(/<circle ([^>]*fill="var\(--o400\)"[^>]*)\/>/, '<circle class="st-sun" $1/>');
  return shell('st-done', `${topRow('done', step)}
    <div class="st-fx" aria-hidden="true"><div class="st-finart">${art}</div><div class="st-petals">${petals}</div>
      <div class="st-blooms">${[0, 1, 2, 3, 4].map(i => `<span style="--k:${i}">${flower(22 + (i % 2) * 8)}</span>`).join('')}</div></div>
    <h1 class="hero" id="st-h">You’re all set${name ? `, ${esc(name)}` : ''}!</h1>
    <p class="lede">Mahalo for speaking up for a healthier Hawaiʻi. Here’s what you did today.</p>`,
    `<ul class="st-did" role="list">${rows.map(([ic, b, s, kind], k) => `<li style="--k:${k}"><span class="st-rc st-rc-${kind}">${icon(kind === 'ok' ? 'check' : ic)}</span><div><b>${esc(b)}</b><span>${esc(s)}</span></div></li>`).join('')}</ul>
    <h2 class="st-nexth">What happens next</h2>
    <ol class="st-next3" role="list">
      <li style="--k:0"><span class="st-nic">${icon('eye')}</span><div><b>We keep watch.</b><span>${off ? `From ${esc(shortDay(sessionInfo().nextOpen))} we check your issues every day, so you don’t have to.` : 'We check your issues every day, so you don’t have to.'}</span></div></li>
      <li style="--k:1"><span class="st-nic">${icon('calendar-clock')}</span><div><b>When it’s your moment, we tell you.</b><span>You’ll get one simple way to help. Most take about 2 minutes.</span></div></li>
      <li style="--k:2"><span class="st-nic">${icon('circle-check')}</span><div><b>You see what happened.</b><span>Every result shows up on your home page.</span></div></li>
    </ol>`);
}

// ================= From a shared bill: follow this issue? =================
// The easiest action came first, on the bill page (pub/bill.js); following is offered next (C-3), then the lessons on
// that bill. "Not now" goes to the lessons.
function viaIssueOf() { const b = exampleBill(); return b ? issuesOf(b).find(shown) || issuesOf(b)[0] || null : null; }
const viaFollowed = () => { const b = exampleBill(), i = viaIssueOf(); return !!b && (i ? issueFollowed(i) : S.watch.has(b.id)); };
function stepFollowAsk(step) {
  const b = exampleBill(), i = viaIssueOf(), what = i ? i.name : b ? (nick(b) || spaced(b.bill_number)) : 'this issue';
  return shell('st1 st-followask', `${topRow('followask', step)}${artFor('followask')}
    <h1 class="hero" id="st-h">Want us to tell you next time?</h1>
    <p class="lede">Follow ${esc(what)}, and we’ll tell you when there’s another hearing or a way to help.</p>${sureWide('info', 'No account needed. You can stop any time.')}`,
    `${sayRow('info', 'No account needed. You can stop any time.')}`);
}
async function followVia() {
  const b = exampleBill(), i = viaIssueOf(); if (!b) return;
  if (i) await setFollows({ issuesOn: [i.id] }); else if (!S.watch.has(b.id)) await toggleWatch(b.id);
  wizSet({ done: true, followedIssues: i ? [i.id] : [] }); welcome();
}

// ================= wiring =================
function flash(text) {
  const el = document.getElementById('st-alert'); if (!el) return;
  el.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`;
  const box = el.closest('.st-say'); box.classList.add('st-alerting');
  const r = box.getBoundingClientRect();
  if (r.top < 64 || r.bottom > window.innerHeight - 96) box.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
}
function clearFlash() {
  const el = document.getElementById('st-alert'); if (!el || !el.innerHTML) return;
  el.innerHTML = ''; el.closest('.st-say').classList.remove('st-alerting');
}
function toggleTick(el) {
  const on = el.getAttribute('aria-pressed') !== 'true';
  el.setAttribute('aria-pressed', String(on));
  el.closest('.st-pcard')?.classList.toggle('on', on);
  const t = el.querySelector('.st-tick'); if (t && on && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
  return on;
}
// Follow what is ticked on the issues screen. Coming back to it and unticking undoes what this screen followed a moment
// ago, and nothing else, so "Follow 7 issues" always ends with exactly those.
async function commitIssues(m) {
  const w = wiz(), catsOn = [...m.picks.cats];
  const issuesOn = m.picks.issues.filter(id => !(S.issueById.get(id)?.categories || []).some(c => catsOn.includes(c)));
  const issuesOff = (w.followedIssues || []).filter(id => !issuesOn.includes(id)), catsOff = (w.followedCats || []).filter(k => !catsOn.includes(k));
  await setFollows({ issuesOn, catsOn, issuesOff, catsOff });
  // done: Home stops sending them back here even if they later unfollow everything. ready: the off-season promise is kept.
  wizSet({ done: true, ready: null, followedIssues: issuesOn, followedCats: catsOn });
  welcome();
}
const busy = (el, label) => { if (!el) return; el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}${label ? `<span>${esc(label)}</span>` : ''}`; };

// Where a step cannot be shown, where to go instead.
function redirectFor(step, off) {
  const n = nameAt(step, off), T = total(off);
  if (step > T) return T;
  if (wiz().via) return n === 'followask' && (viaFollowed() || wiz().viaSkipAsk) ? step + 1 : 0;
  if (n === 'issues') return pickedIssues().length ? 0 : stepOf('topics', off);
  // Nothing followed is moving (an issue whose bills are still to come, or nothing followed): no stand to take.
  if (n === 'stand') return standIdeas().length ? 0 : step + 1;
  return 0;
}

function wire(route) {
  const step = route.step || 1, off = isOff(), name = nameAt(step, off);
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  const to = redirectFor(step, off);
  if (to) { setTimeout(() => app.go('#/start/' + to, { replace: true }), 0); return; }
  if (wiz().step !== step) wizSet({ step });
  const back = !!S.stBack; S.stBack = false;
  // The lesson pages put their button right under the lesson on a wide screen (start.css).
  document.body.classList.toggle('st-lessonpage', ['bill', 'session', 'hearing'].includes(name));
  document.body.classList.toggle('st-onecol', name === 'followask');
  const key = `${pathKey()}|${name}`, fresh = key !== viewKey;
  if (fresh) {
    viewKey = key; viewAt = Date.now(); tickChapter(name, back);
    track(name, 'view', name === 'done' ? { counts: { issues: followedIssues().length, stances: Object.values(S.stances || {}).filter(v => v === 'support' || v === 'oppose').length,
      address: !!S.stAddr.pick, email: !!mailSent() } } : {});
  }
  const next = () => { track(name, 'next'); goStep(step, step + 1); };

  // Skip always means "go to the next page" (HANDOFF 3.5).
  $$('[data-stskip]').forEach(el => el.onclick = () => {
    track(name, 'skip');
    // Nothing picked on the first screen: the issues screen needs a pick, so Skip goes on to the lessons, which use one
    // of HIPHI's bills (R-019: Skip must never lead back to where it started).
    if (name === 'topics' && !pickedIssues().length) { lessonStop(); swap(() => app.go('#/start/' + stepOf('bill', off)), 'fwd'); return; }
    // Skip on "Your issues" follows nothing (the approved prototype; C-4: nothing is followed without a yes). It used to
    // follow whatever was ticked, which with HIPHI's picks ticked for them followed several issues nobody chose (the
    // review, 9/21). Home asks again later, once.
    if (name === 'issues') { if (!followsAnything()) nudge('follow'); goStep(step, step + 1); return; }
    if (name === 'soon' || name === 'you') lessonStop();
    goStep(step, step + 1);
  });
  $$('[data-stback]').forEach(el => el.onclick = () => goBack(+el.dataset.stback));
  $$('[data-stretry]').forEach(el => el.onclick = async () => { S.recapFailed = null;
    if (!S.issues.length) { try { await loadCatalog(); recomputeWatch(); } catch (e) { console.error(e); } }
    app.render(); });
  $$('[data-stdone]').forEach(el => el.onclick = () => finish());

  if (name === 'topics') {
    $$('[data-stissue]').forEach(el => el.onclick = () => {
      const on = toggleTick(el), set = new Set(wiz().issues || []), nm = el.dataset.stissue;
      const t = topicList().find(i => i.names.includes(nm) || i.key === nm);
      (t ? [t.key, ...t.names] : [nm]).forEach(n => set.delete(n));
      if (on) set.add(nm);
      wizSet({ issues: [...set] }); clearFlash();
    });
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = () => {
      if (!pickedIssues().length) { flash('Pick at least one, or select Skip.'); return; }
      track(name, 'next', { counts: { cats: pickedIssues().length } });
      goStep(step, stepOf('issues', off));
    };
  }

  if (name === 'issues') {
    const save = picks => { const m = model2(); if (m.sig) wizSet({ picksFor: m.sig, picks }); };
    // The ticks, the "Follow all" blocks and the button are redrawn in place, so focus and open sections stay put.
    const paint = () => {
      const m = model2(); if (!m.all) return;
      $$('[data-stpick]').forEach(t => { const x = m.all.find(r => r.i.id === t.dataset.stpick), on = !!x && m.ticked(x);
        t.setAttribute('aria-pressed', String(on)); t.closest('.st-pcard')?.classList.toggle('on', on); });
      $$('[data-stcatall]').forEach(box => { const k = box.dataset.stcatall, p = m.per.find(q => q.c.topicKey === k);
        if (p) box.innerHTML = catAll(p.c, p.rows.length, m.catOn.has(k)); });
      $$('[data-stpicked]').forEach(el => { const p = m.per.find(q => q.c.topicKey === el.dataset.stpicked); if (!p) return;
        const said = pickedLine(p, m); el.textContent = said; el.hidden = !said; });
      wireCatAll();
      const lb = $('[data-stnext] span'); if (lb) lb.textContent = followLabel(m.count);
      clearFlash();
    };
    const wireCatAll = () => $$('[data-stfollowcat]').forEach(el => el.onclick = () => {
      const m = model2(); if (!m.picks) return;
      const k = el.dataset.stfollowcat, picks = { issues: [...m.picks.issues], cats: [...m.picks.cats] };
      if (picks.cats.includes(k)) picks.cats = picks.cats.filter(c => c !== k);
      else { picks.cats.push(k); const inCat = new Set(issuesIn(k).map(i => i.id)); picks.issues = picks.issues.filter(id => !inCat.has(id)); }
      save(picks); paint();
      document.querySelector(`[data-stfollowcat="${k}"]`)?.focus({ preventScroll: true });
    });
    $$('[data-stpick]').forEach(el => el.onclick = () => {
      const m = model2(); if (!m.picks) return;
      const id = el.dataset.stpick, x = m.all.find(r => r.i.id === id); if (!x) return;
      const picks = { issues: [...m.picks.issues], cats: [...m.picks.cats] };
      if (!m.ticked(x)) picks.issues.push(id);
      else {
        picks.issues = picks.issues.filter(v => v !== id);
        // Taking one issue out of a category followed whole: the category becomes its other issues, one by one.
        for (const c of x.i.categories.filter(k => picks.cats.includes(k))) {
          picks.cats = picks.cats.filter(k => k !== c);
          for (const r of m.per.find(p => p.c.topicKey === c)?.rows || []) if (r.i.id !== id && !picks.issues.includes(r.i.id)) picks.issues.push(r.i.id);
        }
      }
      save(picks); paint();
      const t = el.querySelector('.st-tick'); if (t && el.getAttribute('aria-pressed') === 'true' && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
    });
    wireCatAll();
    // "Show N more issues": the rest of a category, in place; only the newly shown ones slide in.
    $$('[data-stmore]').forEach(el => el.onclick = () => {
      const k = el.dataset.stmore, open = !S.stMore[k]; S.stMore[k] = open;
      const sec = el.closest('.st-tsec'), extra = sec.querySelectorAll('.st-extra');
      extra.forEach((li, j) => { li.hidden = !open; li.classList.remove('st-in'); if (open && !reduced()) { li.style.animationDelay = `${Math.min(j, 8) * 40}ms`; void li.offsetWidth; li.classList.add('st-in'); } });
      el.setAttribute('aria-expanded', String(open));
      el.querySelector('span').textContent = open ? 'Show fewer' : `Show ${plural(extra.length, 'more issue')}`;
      fitWhat();
    });
    // "What it does" opens the text in place (no redraw), so focus and the ticks stay exactly where they were.
    $$('[data-stwhat]').forEach(el => el.onclick = () => {
      const open = el.getAttribute('aria-expanded') !== 'true', id = el.dataset.stwhat;
      el.setAttribute('aria-expanded', String(open)); el.closest('.st-pcard').classList.toggle('st-open', open);
      if (open) S.stWhat.add(id); else { S.stWhat.delete(id); fitWhat(); }
    });
    $$('[data-stsec]').forEach(d => d.addEventListener('toggle', () => { S.stOpen[d.dataset.stsec] = d.open; fitWhat(); }));
    fitWhat();
    document.fonts?.ready?.then(fitWhat);
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = async () => {
      const m = model2();
      if (m.loading || m.err || m.none) { flash(m.err ? 'The issues did not load. Try again.' : 'Still finding issues — one moment.'); return; }
      if (!m.count && !m.catOn.size) { flash('Tick at least one issue, or select Skip.'); return; }
      if (nb.getAttribute('aria-busy') === 'true') return;
      busy(nb, 'Following…');
      const ids = m.all.filter(m.ticked).map(x => x.i.id);
      await commitIssues(m);
      track(name, 'next', { counts: { cats: m.sel.length, issues: new Set(ids).size }, issue_ids: [...new Set(ids)] });
      // The first success: a moment that fills the screen and waits for Continue (C-7).
      const n = new Set(ids).size, bills = [...S.watch].map(anyBill).filter(b => b && (off || alive(b))).length;
      celebrate({ title: 'Mahalo!', sub: `You’re following ${n ? plural(n, 'issue') : 'your picks'}.`,
        small: off ? 'Their bills come to you as soon as the session starts.' : `That’s ${plural(bills, 'bill')} this session. We’ll watch every one.` },
        () => goStep(step, step + 1));
    };
  }

  if (name === 'stand') {
    const ideas = standIdeas().slice(0, STAND_MAX);
    $$('[data-ststance]').forEach(el => el.onclick = () => {
      const card = el.closest('.st-scard'), k = +card.dataset.k; if (k !== S.stStandAt) return;
      const [idList, v] = el.dataset.ststance.split('|'), ids = idList.split(',');
      const first = !Object.values(S.stances || {}).some(x => x === 'support' || x === 'oppose');
      Promise.all(ids.map(x => setStance(x, v))).catch(e => toast(e, true));
      if (v !== 'unsure') burst(el, first ? 14 : 10, first ? 52 : 44);          // a small celebration for each stand (C-7)
      card.classList.add('st-gone-' + v); card.dataset.pos = 'gone'; card.setAttribute('aria-hidden', 'true');
      later(() => { card.hidden = true; }, 420);
      S.stStandAt = k + 1;
      $$('.st-scard').forEach(c => { const j = +c.dataset.k; if (j > k) { c.dataset.pos = j - S.stStandAt; c.setAttribute('aria-hidden', String(j !== S.stStandAt));
        c.querySelectorAll('button').forEach(x => { x.tabIndex = j === S.stStandAt ? 0 : -1; }); } });
      const live = document.getElementById('st-live'); if (live) live.textContent = v === 'unsure' ? 'Noted: not sure yet.' : `Noted: you ${v} it.`;
      // The first answer turns the quiet Skip into Next, in place.
      if (!S.stStood) { S.stStood = true; const bar = document.querySelector('.actionbar .inner');
        if (bar) { bar.innerHTML = bar1('Next'); bar.querySelector('[data-stnext]').onclick = next; } }
      if (S.stStandAt >= ideas.length) later(() => { const st = $('#st-stack'); if (st) st.hidden = true; const d = $('#st-standdone'); if (d) { d.hidden = false; d.innerHTML = standDone(); } }, 380);
      else later(() => document.querySelector(`.st-scard[data-k="${S.stStandAt}"] [data-ststance]`)?.focus({ preventScroll: true }), 380);
    });
    const nb = $('[data-stnext]'); if (nb) nb.onclick = next;
  }

  if (['bill', 'session', 'hearing'].includes(name)) {
    const E = example();
    // A redraw of the same screen (data landing) restores the step the person was on, without replaying motion.
    lessonStart(name, E, { back, redraw: !fresh, onAnswer: quiz => track(name, 'answer', { quiz }) });
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = () => {
      if (lessonNext(name, E)) return;
      if (name === 'hearing') {
        // Finishing "How it works": the second moment (C-7), then on to the last part.
        S.stLearned = true; track(name, 'next');
        celebrate({ art: 'learn', title: 'Now you know how it works', sub: 'Reading a bill, its trip, and when to speak up.' }, () => goStep(step, step + 1));
        return;
      }
      next();
    };
  }

  if (name === 'you') {
    const abox = $('[data-staddr]');
    if (abox) abox.oninput = () => {
      S.stAddr.q = abox.value; S.stAddr.err = '';
      APstart.search(abox.value.trim(), () => app.render());
      app.render();
      requestAnimationFrame(() => { const again = document.querySelector('[data-staddr]'); if (again) { again.focus({ preventScroll: true }); again.setSelectionRange(again.value.length, again.value.length); } });
    };
    const look = async r => {
      S.stAddr.finding = true; app.render();
      try {
        const res = await APstart.resolve(r.label, r.pt);
        if (!res || res.none || !res.ids?.length) { S.stAddr.finding = false; S.stAddr.err = 'We couldn’t find that address. Check the street and number, or pick a suggestion.'; app.render(); return; }
        S.stAddr.pick = { ids: res.ids, label: res.matched || r.label }; S.stAddr.finding = false;
        // The districts (never the address) stay on this device, so bill pages can say "your senator" (people.js does the same).
        const found = res.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean);
        try { localStorage.setItem('hiphi_districts', JSON.stringify({ senate: found.find(l => l.chamber === 'S')?.district || null, house: found.find(l => l.chamber === 'H')?.district || null })); } catch { /* ignore */ }
        app.render();
        later(() => burst(document.getElementById('st-legs'), 14, 70), 300);   // found: a small celebration (C-7)
      } catch { S.stAddr.finding = false; S.stAddr.err = 'We couldn’t look that up just now. Check your connection and try again.'; app.render(); }
    };
    $$('[data-staddrpick]').forEach(el => el.onclick = () => { const r = APstart.results(S.stAddr.q.trim())[+el.dataset.staddrpick]; if (r) look({ label: r.label, pt: r }); });
    $$('[data-staddrtyped]').forEach(el => el.onclick = () => look({ label: S.stAddr.q.trim(), pt: null }));
    if (abox) abox.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault();
      const q = abox.value.trim(), r = APstart.results(q)[0];
      if (r) look({ label: r.label, pt: r }); else if (typed(q, [])) look({ label: q, pt: null }); };
    const aclear = $('[data-staddrclear]'); if (aclear) aclear.onclick = () => { S.stAddr = { q: '', pick: null, finding: false, err: '' }; app.render(); requestAnimationFrame(() => document.getElementById('st-addr')?.focus()); };
    const nb = $('[data-stnext]'); if (nb) nb.onclick = () => { track(name, 'next', { counts: { address: !!S.stAddr.pick } }); goStep(step, step + 1); };
  }

  if (name === 'soon') {
    // This is the visit's one email ask, so Home will not ask again.
    S.nudge = null; S.nudgedThisVisit = true;
    const form = $('#st-eform');
    if (form) {
      const inp = form.querySelector('#st-email'), nm = form.querySelector('#st-name'), err = form.querySelector('#st-email-err'), send = document.getElementById('st-send');
      const showErr = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'st-email-err'); err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; };
      inp.oninput = () => { S.stMail.email = inp.value; if (err.innerHTML) { err.innerHTML = ''; inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); } };
      nm.oninput = () => { S.stMail.name = nm.value; };
      form.onsubmit = async e => {
        e.preventDefault();
        if (send?.getAttribute('aria-busy') === 'true') return;
        const email = inp.value.trim(), first = nm.value.trim().slice(0, 40);
        // Checked only now, never while typing (C-9: nothing typed is lost to an error).
        if (!validEmail(email)) { showErr(email ? 'That email doesn’t look complete. Check it and try again.' : 'Add your email, or select Skip.'); inp.focus(); return; }
        const label = send ? send.innerHTML : ''; busy(send, 'Sending…');
        try {
          const r = await sendEmailLink(email, { hearing_alerts: true, action_alerts: true });
          if (first) wizSet({ name: first });
          S.stMail = { email, name: first, sent: email, demo: !!(r && r.demo) };
          track(name, 'next', { counts: { email: true } });
          app.render();
          document.getElementById('st-sent-t')?.focus({ preventScroll: true });
          later(() => burst(document.querySelector('#st-sentbox .st-ilead'), 12, 46), 150);   // a small celebration (C-7)
        } catch (error) { console.error(error); if (send) { send.removeAttribute('aria-busy'); send.innerHTML = label; } showErr(friendly(error)); inp.focus(); }
      };
    }
    $$('[data-stother]').forEach(el => el.onclick = () => {
      S.stMail = { email: S.stMail.sent || '', name: S.stMail.name, sent: '', demo: false };
      try { sessionStorage.removeItem('hiphi_link_sent'); } catch { /* ignore */ }
      app.render(); const i = document.getElementById('st-email'); if (i) { i.focus(); i.select(); }
    });
    const nb = $('[data-stnext]'); if (nb && !form) nb.onclick = next;
  }

  if (name === 'done') {
    wizSet({ finale: true });
    if (fresh) later(() => burst(document.getElementById('st-h'), 16, 90), 500);
    const nb = $('[data-stdone]'); if (nb) nb.onclick = () => finish();
  }

  if (name === 'followask') {
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = async () => {
      if (nb.getAttribute('aria-busy') === 'true') return;
      busy(nb, 'Following…'); await followVia(); track(name, 'next');
      burst(document.querySelector('.actionbar .btn.primary') || nb, 12, 48);
      later(() => goStep(step, step + 1), 420);
    };
  }
}

const TITLE = { topics: 'What do you care about?', issues: 'Your issues', stand: 'Where do you stand?', ...LESSON_TITLES,
  you: 'Who speaks for you', soon: 'Coming up on your issues', done: 'You’re all set', followask: 'Follow this issue?' };
export default {
  tab: 'home',
  tabs: false,
  title: route => TITLE[nameAt(route.step || 1, isOff())] || 'Get started',
  render(route) {
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return skel(Math.min(step, total(off)));   // wire() sends them on
    switch (nameAt(step, off)) {
      case 'topics': return stepTopics(step);
      case 'issues': return stepIssues(step);
      case 'stand': return stepStand(step);
      case 'bill': case 'session': case 'hearing': return stepLesson(nameAt(step, off), step);
      case 'you': return stepYou(step);
      case 'soon': return stepSoon(step);
      case 'done': return stepDone(step);
      case 'followask': return stepFollowAsk(step);
      default: return stepTopics(step);
    }
  },
  wire,
  bar(route) {
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return '';
    switch (nameAt(step, off)) {
      case 'topics': return bar2('Next', { iconEnd: 'arrow-right' });
      case 'issues': {
        const m = model2();
        if (m.err) return barRetry();
        if (m.loading || m.none) return barBusy();
        return bar2(followLabel(m.count), { icon: 'star' });
      }
      case 'stand': return S.stStood ? bar1('Next') : barSkip();
      case 'bill': case 'session': case 'hearing': return bar2('Next', { iconEnd: 'arrow-right' });
      case 'you': return S.stAddr.pick ? bar1('Next') : barSkip();
      case 'soon': return S.session || mailSent() ? bar1('Next') : bar2(off ? 'Keep me posted' : 'Remind me', { icon: 'bell' }, { type: 'submit', form: 'st-eform', id: 'st-send' });
      case 'done': return bar1('Go to my home page', 'house', { 'data-stdone': '1' });
      case 'followask': return bar2('Follow this issue', { icon: 'star' }, { 'data-stnext': '1' }, 'Not now');
      default: return '';
    }
  },
};
