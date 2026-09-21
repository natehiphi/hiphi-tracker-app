// The guided start (plan section 3, reworked 9/19 to Nate's decision, restructured 9/20 per HANDOFF 3.5): a
// newcomer's first visit is "follow a few bills and maybe say where you stand", then a longer, skippable guided
// look at how the whole thing works. No action is pushed here; the asks to act come on later visits, easiest
// first. The email is asked as a natural step, now one "keep me updated" opt-in that covers both hearing alerts
// and HIPHI's own advocacy alerts (HANDOFF 3.5 reverses the old separate-ask rule; see core.js sendEmailLink).
// Every step is its own route (#/start/1..N) and pushes history, so Back walks the steps. The step and the picks
// live in hiphi_wiz (wiz()/wizSet()), so a reload resumes where the person left off. Every step can be skipped,
// "Skip" always means "go to the next page" (3.5 - it used to fast-forward some screens straight to the email
// ask), and a primary button is never disabled (selecting it with nothing picked says why, right above the
// choices). There is deliberately no "Step N of 11" indicator (3.5).
// Someone who is already signed in never sees the email step. No tab bar here. On phones the sticky bottom bar
// holds one Skip and the one primary; on wide screens the page is two columns (the story on the left, the choices
// on the right) and the bar sits at the end of the choices (start.css).
import { S, DEMO, app, esc, icon, blurb, nick, spaced, billPath, alive, issues, sessionInfo, billsForCoalitions, recommendations,
  loadBills, saveLocal, wiz, wizSet, followList, listBillsFor, HST, anyBill, myStance, setStance, sendEmailLink, validEmail,
  friendly, toast, nudge, cmteLabel, legTitle, legPhoto, loadRecapPool, ensureRecapPool } from './core.js';
import { btn, chip, posChip, row } from './ui.js';
import { CAPITOL, VOICES, islands, flower } from './art.js';
import { topics, policies } from './topics.js';
import { townMatches, lookupTown } from './people.js';
import { createAddressPicker } from './addresspicker.js';
import { situation, railHTML } from './bill.js';

const isOff = () => sessionInfo().phase !== 'in';
// The email step is the last one; a signed-in person does not get it, so their count is one shorter.
// The guided start, as an ordered list of named screens rather than step numbers. Adding a screen
// is adding a name here: every place that used to compare `step === 3` now asks for the name, so
// inserting one in the middle stops renumbering the rest (Nate's longer flow, 9/20).
// Nate's restructured first visit (HANDOFF 3.5, 9/20): "narrow" and "bills" merge into one screen (topics with
// their bills, collapsible); "howlaw" and "calendar" merge into one new "session" screen; "whatsnext" is new,
// moved here from Home's welcome card. Everything after `stand` is explaining rather than asking, and every one
// of those screens is skippable - a person who wants to get on with it presses Skip and lands on Home with their
// bills already followed.
const FLOW_IN = ['topics', 'bills', 'stand', 'tour', 'session', 'hearing', 'whatsnext', 'legislators'];
const FLOW_OFF = ['topics', 'recap'];
const flowOf = off => [...(off ? FLOW_OFF : FLOW_IN), ...(S.session ? [] : ['email']), 'name'];
const nameAt = (step, off) => { const f = flowOf(off); return f[Math.min(Math.max(step | 0, 1), f.length) - 1]; };
const stepOf = (name, off) => flowOf(off).indexOf(name) + 1;
const total = off => flowOf(off).length;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const andList = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
// Issue names are shown whole and in bold inside sentences: "Healthy Eating, Active Living" has a comma of its own,
// and shortening it to "Healthy Eating" made a crosswalk bill look misfiled (assessment, 9/19).
const namesHtml = list => andList(list.map(i => `<b class="strong">${esc(i.key)}</b>`));
const issuesPhrase = sel => sel.length > 2 ? `your ${sel.length} issues` : namesHtml(sel);
const reduce = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// The live page (track.js) keeps the same hiphi_wiz key and stores a coalition's first internal name, so we do too.
const pickedIssues = () => { const sel = new Set(wiz().issues || []); return topicList().filter(i => sel.has(i.key) || i.names.some(n => sel.has(n))); };
// "Wednesday, January 20" for a Hawaiʻi calendar day
const longDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' });
// What a bill does, in plain words, even when it has no HIPHI summary: never lead with the official "Relating to…".
const plainSum = (b, n = 110) => { const t = blurb(b, n); return /^relating to\s/i.test(t) ? 'A bill about ' + t.replace(/^relating to\s+/i, '') : t; };
const POS_W = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
const hasPos = b => b.hiphi_position && b.hiphi_position !== 'monitor';
// Which island to pick out in the drawing, when this device or the account knows the person's Senate district:
// 1-4 Hawaiʻi Island, 5-6 Maui, 8 Kauaʻi, 9-25 Oʻahu (7 spans Maui, Molokaʻi and Lānaʻi, so it picks none).
function myIsland() {
  let sd = +((S.profile || {}).senate_district) || 0;
  if (!sd) { try { sd = +JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate || 0; } catch { sd = 0; } }
  return sd >= 9 ? 'oahu' : sd === 8 ? 'kauai' : sd >= 5 && sd <= 6 ? 'maui' : sd >= 1 && sd <= 4 ? 'hawaii' : '';
}

// ---------- history: forward steps are tagged, so the on-screen Back can use the real Back when it is safe ----------
function goStep(from, to) {
  app.go('#/start/' + to);
  try { history.replaceState({ ...(history.state || {}), stFrom: from }, ''); } catch { /* ignore */ }
}
function goBack(step) {
  // A person who resumed straight onto step 2 has no step 1 behind them; history.back() would leave the site.
  if (history.state?.stFrom === step - 1) history.back(); else app.go('#/start/' + (step - 1));
}
// Home shows a calm welcome for the rest of this visit instead of pushing actions (home.js reads this key). It is
// set as soon as bills are followed, so leaving early by Skip or the logo still lands on the calm Home.
const welcome = () => { try { sessionStorage.setItem('hiphi_welcome', '1'); } catch { /* private mode */ } };
// Finishing the start. Off-season we also note when the next session opens, so the start can greet them with
// HIPHI's picks then (core: readyForSession). No email nudge is queued: the email was just asked as its own step.
function finish() {
  const si = sessionInfo();
  wizSet({ done: true, step: 1, ...(si.phase !== 'in' ? { ready: si.nextOpen } : {}) });
  welcome();
  app.go('#/', { replace: true });
}
const skipAll = () => { wizSet({ skipped: true }); app.go('#/'); };

// ---------- the page frame of a step: the story (left on wide screens) and the choices (right) ----------
// No "Step N of 11" here (HANDOFF 3.5) - just Back, when there is somewhere to go back to.
const backBtn = step => btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stback': String(step) } });
const stepRow = step => step > 1 ? `<div class="steps st-steps">${backBtn(step)}</div>` : '';
const shell = (cls, intro, main, busy = false) => `<div class="st ${cls}"${busy ? ' aria-busy="true"' : ''}><div class="st-intro">${intro}</div><div class="st-main">${main}</div></div>`;
// The drawing of each step (wide screens show one on every step; phones only where there is room, see start.css).
const artFor = (step, off) => { const n = nameAt(step, off);
  return `<div class="st-art">${n === 'email' || n === 'legislators' ? islands(myIsland()) : n === 'stand' || n === 'name' || n === 'hearing' ? VOICES : CAPITOL}</div>`; };
// One line above the choices: a reassurance, which the "pick at least one" message replaces in place (so nothing
// below it moves and no choice gets covered).
const sayRow = (ic, sure) => `<div class="st-say"><p class="st-sure">${icon(ic)}<span>${sure}</span></p><p class="st-alert" id="st-alert" role="alert"></p></div>`;
// On wide screens the reassurance belongs with the story on the left, and only the message shows above the choices.
const sureWide = (ic, sure) => `<p class="st-sure st-surewide">${icon(ic)}<span>${sure}</span></p>`;

// ---------- the bar: one Skip, one primary ----------
const bar2 = (label, opt = {}, attrs = { 'data-stnext': '1' }, skip = 'Skip') => `<div class="st-bar"><div class="st-btns">
  ${btn(skip, { kind: 'text', attrs: { 'data-stskip': '1' } })}${btn(label, { kind: 'primary', ...opt, attrs })}</div></div>`;
// While the bills load the primary says so, and when they could not be loaded it is the way to try again, so the
// one button on the screen is never a dead one.
const barBusy = () => bar2('Finding bills…', { icon: 'loader-circle' }, { 'data-stnext': '1', 'aria-busy': 'true' });
const barRetry = () => bar2('Try again', { icon: 'rotate-ccw' }, { 'data-stretry': '1' });
const bar1 = label => `<div class="st-bar st-one">${btn(label, { kind: 'primary', iconEnd: 'arrow-right', attrs: { 'data-stdone': '1' } })}</div>`;
const followLabel = n => n ? `Follow ${plural(n, 'bill')}` : 'Follow bills';
// A policy HIPHI backs hardest: its lead bill carries a strongly_ position. These are offered and
// ticked first, because they are the ones the team is actually campaigning on.
// A policy HIPHI backs hardest, or one staff have flagged recommended (bills.recommended, migration 061 - a
// P2 bill can be recommended over a P1, so this is independent of priority). These are offered and pre-ticked
// first, because they are the ones the team is actually campaigning on (HANDOFF 3.5).
const isPromoted = pol => { const b = pol.bills[0] || {}; return !!b.hiphi_recommended || (b.hiphi_position || b.position || '') === 'strongly_support'; };

// ================= Step 1 (in session and off-season): welcome and issues =================
// The six topics, counted over the pool of live bills HIPHI has taken a position on. This replaced
// the nine coalitions, one of which ("General Public Health") held 64 of the 218 supported bills and
// told a stranger nothing about what they had chosen. See pub/topics.js.
const supports = b => /support/.test(b.hiphi_position || b.position || '');
const poolBills = () => ((S.pool && S.pool.bills) || []).filter(supports);
// Between sessions nothing is moving and the pool is empty, so the topics are counted over last session's bills
// instead (core loadRecapPool). Counting the empty pool is what printed "0 bills in 2026" on every topic (R-019).
// Every bill HIPHI worked on counts here, not only the ones it supported: the recap's "HIPHI worked on 68 bills"
// and Home's "Your issues" say the same number for the same topic (A-14).
const recapBills = () => (S.recapPool && S.recapPool.bills) || [];
const topicList = () => topics(isOff() ? recapBills() : poolBills());
function issueRows(off, yr) {
  const sel = new Set(wiz().issues || []);
  // In session, issues() puts the ones with nothing moving after the rest, and General Public Health last. Between
  // sessions nothing is moving, so the busiest issues of the last session lead instead (still General last).
  // Last session's bills load once and the screen redraws when they land; until then a count is left out rather
  // than shown as a zero.
  if (off) ensureRecapPool(sessionInfo().recapYear);
  const counted = !off || !!(S.recapPool && S.recapPool.yr === sessionInfo().recapYear);
  const list = topicList().sort((a, b) => (b.bills || 0) - (a.bills || 0));
  return `<div class="st-issues" role="group" aria-labelledby="st-h">${list.map(i => {
    const on = sel.has(i.key) || i.names.some(n => sel.has(n));
    const extra = counted ? `<span class="st-icount">${plural(i.bills || 0, 'bill')}${off ? ` in ${yr}` : ''}</span>` : '';
    return `<button type="button" class="st-issue" data-stissue="${esc(i.names[0])}" aria-pressed="${on}">
      <span class="st-ilead">${icon(i.icon)}</span>
      <span class="st-ibody"><span class="st-iname">${esc(i.key)}</span>${extra}${i.description ? `<span class="st-idesc">${esc(i.description)}</span>` : ''}</span>
      <span class="st-tick" aria-hidden="true">${icon('check')}</span></button>`;
  }).join('')}</div>`;
}
const SURE1 = 'Takes about a minute. No account needed.', SURE2 = 'You can change this any time.';
function step1() {
  const si = sessionInfo(), off = si.phase !== 'in', yr = off ? si.recapYear : si.yr;
  const next = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1;
  return shell('st1', `${artFor(stepOf('topics', off), off)}${stepRow(stepOf('topics', off))}
    <h1 class="hero" id="st-h">${off ? `Get ready for the ${next} session` : 'Speak up for a healthier Hawaiʻi'}</h1>
    <p class="lede">${off ? `The Legislature is on break until ${esc(shortDay(si.nextOpen))}. Pick the issues you care about, and HIPHI’s bills for them will be ready when hearings start.`
      : 'Pick the issues you care about. We’ll show you a few bills you can follow.'}</p>${sureWide('clock', SURE1)}`,
    `${sayRow('clock', SURE1)}${issueRows(off, yr)}`);
}

// ================= Screen 2 (in session): your topics, and their bills =================
// Replaces both the old "Anything in particular?" narrowing screen and the flat "Pick your bills" screen
// (HANDOFF 3.5): one collapsible section per topic picked on screen 1, each showing every one of that
// topic's policies (pub/topics.js policies(), one row per idea regardless of how many bills carry it).
// A <details> per topic does the folding for free - no separate "More N bills" overflow mechanism needed
// now that each topic keeps its own bills out of the way until opened.
// Soonest upcoming hearing per bill, from what the page already loaded for suggestions (the next two weeks).
function ranker() {
  const now = Date.now(), soon = new Map();
  for (const h of [...((S.pool || {}).hearings || []), ...((S.featured || {}).hearings || []), ...S.hearings]) {
    if (h.status !== 'scheduled' || new Date(h.scheduled_at) <= now) continue;
    const c = soon.get(h.bill_id); if (!c || h.scheduled_at < c.scheduled_at) soon.set(h.bill_id, h);
  }
  const info = b => { const h = soon.get(b.id) || null, open = !!h && (!h.testimony_deadline || new Date(h.testimony_deadline) > now);
    return { h, tier: open ? 0 : h ? 1 : /^strongly/.test(b.hiphi_position || '') ? 2 : 3, when: h ? ((open && h.testimony_deadline) || h.scheduled_at) : '' }; };
  // Plan 3/S2: an open testimony window first (soonest deadline), then HIPHI's strongest positions, then the rest.
  const cmp = (a, b) => { const x = info(a), y = info(b); return x.tier - y.tier || x.when.localeCompare(y.when)
    || (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }); };
  return { info, cmp };
}
const sigOf = (off, sel) => `${off ? 'off' : 'in'}|${sel.map(i => i.key).join('|')}`;
function model2() {
  const sel = pickedIssues(), sig = sigOf(false, sel), L = S.stLoad;
  if (!sel.length) return { none: true };
  if (!L || L.sig !== sig) return { loading: true, sig, sel };
  if (L.err) return { err: true, sig, sel };
  if (!L.rows) return { loading: true, sig, sel };
  const R = ranker(), w = wiz(), seen = new Set(), per = sel.map(i => ({ i, bills: [] }));
  for (const b of L.rows) {
    if (seen.has(b.id) || !alive(b) || !hasPos(b)) continue;
    const g = per.find(p => (p.i.match ? p.i.match(b) : (b.coalitions || []).some(n => p.i.names.includes(n)))); if (!g) continue;
    seen.add(b.id); g.bills.push(b);
  }
  // Bills become POLICIES here. Eleven bills say "Let counties regulate tobacco sales"; offering
  // them as eleven rows asks somebody to choose between identical things and lets the other ten slip
  // past whichever one they tick. One row, every bill under it, nothing missed. (Nate, 9/20)
  per.forEach(p => { p.bills.sort(R.cmp); p.pols = policies(p.bills);
    p.pols.forEach(x => x.bills.sort(R.cmp)); p.pols.sort((a, b) => R.cmp(a.bills[0], b.bills[0])); });
  const empty = per.filter(p => !p.pols.length).map(p => p.i);
  const allPols = per.flatMap(p => p.pols);
  let fallback = false, fallbackPols = [];
  if (!allPols.length) { fallbackPols = policies(recommendations(3).map(r => r.b)); fallback = true; }
  const picked = new Set(w.picksFor === sig ? (w.picks || []) : []);
  return { sig, sel, per, empty, fallback, fallbackPols, allPols, picked, R };
}
function load2(sig, sel, off) {
  if (S.stLoad && S.stLoad.sig === sig && !S.stLoad.err) return;
  S.stLoad = { sig };
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  const work = (async () => {
    // Between sessions: every bill HIPHI took a position on last session. (Asking for them by coalition, as this
    // did, found nothing once the start moved to topics on 9/20 - R-019.)
    const rows = off ? await loadRecapPool(sessionInfo().recapYear)
      : poolBills().length ? poolBills() : await billsForCoalitions(sel.flatMap(i => i.names));
    // Off-season: HIPHI's published lists, to offer "Follow HIPHI's list" on the issues they cover.
    if (off) await Promise.all((S.lists || []).map(l => listBillsFor(l.slug).catch(() => null)));
    return rows;
  })();
  Promise.race([work, timeout]).then(rows => {
    if (!S.stLoad || S.stLoad.sig !== sig) return;
    S.stLoad.rows = rows || [];
    if (!off) {
      // New issues, new picks: every strongly-backed or staff-recommended policy starts ticked (3.5).
      const m = model2(), w = wiz();
      if (m.allPols && w.picksFor !== sig) {
        const tick = m.allPols.filter(isPromoted);
        const ids = (tick.length ? tick : m.allPols.slice(0, 3)).flatMap(x => x.bills.map(b => b.id));
        wizSet({ picksFor: sig, picks: ids });
      }
    }
    app.render();
  }).catch(e => { console.error(e); if (S.stLoad && S.stLoad.sig === sig) { S.stLoad.err = true; app.render(); } });
}
// One bill to follow. The whole card is the toggle (a real button). With a nickname the everyday name leads and
// what the bill does sits under it; without one the plain summary is the headline, as before. The text is cut by
// lines, not characters, so a wide screen simply shows more of it. Where it is cut, a small "What it does" button
// opens it in place. That button sits on the card's bottom edge, beside the toggle rather than inside it (a button
// cannot hold a button), so reading more never ticks or unticks the bill. HIPHI's position is always on the card.
// No topic chip here any more (3.5): the card lives inside its topic's own <details> section now, so naming the
// topic again on every row repeated what the heading just said.
S.stWhat ??= new Set();
function pickCard(pol, R, picked) {
  const b = pol.bills[0], n = pol.bills.length, ids = pol.bills.map(x => x.id);
  const inf = R.info(b);
  const within8 = inf.h && new Date(inf.h.scheduled_at) - Date.now() < 8 * 864e5;
  const day = within8 ? new Date(inf.h.scheduled_at).toLocaleDateString('en-CA', { timeZone: HST }) === new Date().toLocaleDateString('en-CA', { timeZone: HST })
    ? 'today' : new Date(inf.h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : '';
  const on = ids.every(id => picked.has(id)), name = pol.name || nick(b), full = plainSum(b, 300);
  const open = S.stWhat.has(pol.key), tid = 'st-w-' + pol.key.replace(/\W/g, '');
  return `<li class="st-pcard${on ? ' on' : ''}${open ? ' st-open' : ''}">
    <button type="button" class="st-pick" data-stpick="${esc(ids.join(','))}" aria-pressed="${on}">
      <span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="st-pbody">
        ${day || isPromoted(pol) ? `<span class="st-ptop">${day ? chip(`Hearing ${day}`, 'info', 'calendar') : ''}${!day && isPromoted(pol) ? chip('HIPHI recommends', 'info', 'sparkles') : ''}</span>` : ''}
        ${name ? `<span class="st-phead">${esc(name)}</span><span class="st-pwhat st-clamp" id="${tid}">${esc(full)}</span>`
          : `<span class="st-phead st-clamp" id="${tid}">${esc(full)}</span>`}
        <span class="st-pmeta"><span>${n > 1 ? `${n} bills, incl. ${esc(spaced(b.bill_number))}` : esc(spaced(b.bill_number))}</span>${posChip(b)}</span>
      </span></button>
    <button type="button" class="st-what" data-stwhat="${esc(pol.key)}" aria-expanded="${open}" aria-controls="${tid}" hidden><span>What it does<span class="sr">: ${esc(spaced(b.bill_number))}</span></span>${icon('chevron-down')}</button></li>`;
}
// Show "What it does" only on cards whose text is really cut off at this width (or is open, so it can be closed).
function fitWhat() {
  document.querySelectorAll('.st-pcard').forEach(card => {
    const t = card.querySelector('.st-clamp'), w = card.querySelector('.st-what'); if (!t || !w) return;
    const need = card.classList.contains('st-open') || t.scrollHeight > t.clientHeight + 1;
    w.hidden = !need; card.classList.toggle('st-haswhat', need);
  });
}
// The cut moves when the window is resized, a phone is turned, or the web fonts arrive.
let fitT = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(fitT); fitT = requestAnimationFrame(fitWhat); });
function tickPhrase(allPols, picked) {
  const on = allPols.filter(x => x.bills.every(b => picked.has(b.id)));
  if (!on.length) return '';
  const strong = on.filter(isPromoted).length;
  const bits = [];
  if (strong) bits.push(`the ${strong === 1 ? 'one' : strong} HIPHI recommends`);
  const what = bits.length ? bits.join(' ') : `${on.length === 1 ? 'one' : on.length}`;
  return `We checked ${what}. Uncheck anything you don’t want.`;
}
// One <details> per topic. The first always starts open, so the screen never arrives with nothing to
// see (a fresh-eyes review caught two collapsed rows over a wall of empty space); a small one (three
// policies or fewer) also starts open, so a person with one narrow interest never has to click twice;
// a busy topic past the first starts folded so the screen does not open into a wall of bills instead.
function topicSection(g, R, picked, isFirst) {
  const n = g.pols.reduce((a, x) => a + x.bills.length, 0), open = isFirst || g.pols.length <= 3;
  const allOn = g.pols.length > 0 && g.pols.every(x => x.bills.every(b => picked.has(b.id)));
  return `<details class="st-tsec"${open ? ' open' : ''}>
    <summary><span class="st-tsum">${icon(g.i.icon)}<span class="st-tname">${esc(g.i.key)}</span><span class="st-tcount">${plural(n, 'bill')}</span></span>${icon('chevron-down', { cls: 'st-tchev' })}</summary>
    <div class="st-tbody2">
      ${g.pols.length > 1 ? btn(allOn ? `All ${plural(n, 'bill')} checked` : `Follow all ${plural(n, 'bill')} in ${esc(g.i.key)}`, { kind: 'text', sm: true, icon: allOn ? 'check' : 'star', attrs: allOn ? { disabled: 'true' } : { 'data-stfollowtopic': g.i.key } }) : ''}
      <ul class="st-picks" role="list">${g.pols.map(x => pickCard(x, R, picked)).join('')}</ul>
    </div></details>`;
}
const skel = (step, off) => shell('', `${artFor(step, off)}${stepRow(step)}<p class="sr" role="status">Finding HIPHI’s picks for you</p>
  <div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:64px"></div>`, '<div class="skel" style="height:128px"></div>'.repeat(3), true);
const loadErr = (step, off) => shell('', `${artFor(step, off)}${stepRow(step)}`, `<div class="empty st-err"><h1 class="st-errh" id="st-h">We couldn’t load the bills</h1><p>Check your connection and try again.</p></div>`);
function step2() {
  const m = model2();
  if (m.none) return skel(2, false);
  if (m.loading) { load2(m.sig, m.sel, false); return skel(2, false); }
  if (m.err) return loadErr(2, false);
  const { sel, per, fallback, fallbackPols, empty, picked, R } = m, w = wiz();
  const opened = w.ready && !S.watch.size;   // picked issues off-season; the session has opened since
  const groups = per.filter(g => g.pols.length);
  const n = groups.reduce((a, g) => a + g.pols.reduce((b, x) => b + x.bills.length, 0), 0), rows = groups.reduce((a, g) => a + g.pols.length, 0);
  const allN = groups.reduce((a, g) => a + g.pols.reduce((b, x) => b + x.bills.length, 0), 0);
  const ticks = tickPhrase(groups.flatMap(g => g.pols), picked), saved = `We saved your ${empty.length === 1 ? 'pick' : 'picks'}`;
  let h1, lede;
  const fbN = fallbackPols.reduce((a, x) => a + x.bills.length, 0);
  if (fallback && fbN) { h1 = fbN === 1 ? 'Start with this bill' : `Start with these ${fbN} bills`;
    lede = `Nothing is moving on ${namesHtml(empty)} right now. ${saved}. Meanwhile, HIPHI is working on ${fbN === 1 ? 'this bill' : 'these bills'} this week.`; }
  else if (fallback) { h1 = 'Nothing is moving yet';
    lede = `There are no bills moving on ${namesHtml(empty)} right now. ${saved}, and your page will show bills as soon as they start moving.`; }
  else if (opened) { h1 = 'The session is open!'; lede = `Here are HIPHI’s picks for ${issuesPhrase(sel)}. ${n === 1 ? 'It’s checked for you.' : `${ticks} Uncheck any you don’t want.`}`; }
  else if (n === 1) { h1 = 'Start with this bill'; lede = `HIPHI picked it for ${issuesPhrase(sel)}. It’s checked for you.`; }
  else { h1 = 'Your topics, and their bills';
    lede = `${plural(rows, 'idea')} inside ${issuesPhrase(sel)}${n > rows ? `, ${plural(n, 'bill')} in all` : ''}. Open a topic to see its bills. ${ticks}`; }
  const followAllOverall = !fallback && rows > 1 ? btn(`Follow all ${plural(allN, 'bill')}`, { kind: 'secondary', sm: true, icon: 'star', attrs: { 'data-stfollowall': '1' } }) : '';
  return shell('st2', `${artFor(stepOf('bills', false), false)}${stepRow(stepOf('bills', false))}
    <h1 class="hero" id="st-h">${h1}</h1>
    <p class="lede">${lede}</p>${n ? sureWide('info', SURE2) : ''}`,
    fallback
      ? `${sayRow('info', SURE2)}<ul class="st-picks" role="list" aria-labelledby="st-h">${fallbackPols.map(b => pickCard(b, R, picked)).join('')}</ul>`
      : `${sayRow('info', SURE2)}${followAllOverall ? `<div class="st-followall">${followAllOverall}</div>` : ''}
    <div class="st-tsecs" role="group" aria-labelledby="st-h">${groups.map((g, i) => topicSection(g, R, picked, i === 0)).join('')}</div>
    ${empty.length ? `<p class="note">${icon('info')}<span>Nothing is moving on ${namesHtml(empty)} right now. ${saved}.</span></p>` : ''}`);
}

// ================= Step 3 (in session): where do you stand? (optional) =================
// The bills just followed, in the order they were shown (else everything followed, for someone who came back).
function followedBills() {
  let ids = (wiz().followed || []).filter(id => S.watch.has(id)); if (!ids.length) ids = [...S.watch];
  return ids.map(id => S.bills.find(b => b.id === id) || anyBill(id)).filter(Boolean);
}
const STANCES = [['support', 'Support', 'thumbs-up'], ['oppose', 'Oppose', 'thumbs-down'], ['unsure', 'Not sure yet', '']];
const tookStand = () => Object.values(S.stances || {}).some(v => v === 'support' || v === 'oppose');
// The first "Took a stand" is a milestone (core MILESTONES). Kept calm: a small orange chip on that card, no burst.
const mileChip = () => `<span class="chip yay st-mile">${flower(16)}Took a stand</span>`;
// One card per idea, not per bill: the disposable vape ban is two bills (HB 2121, SB 2175) and was asked about twice.
// The answer is saved on every bill carrying the idea. Ideas come in the order screen 2 offered them, most urgent first.
function standCard(pol) {
  const b = pol.bills[0], ids = pol.bills.map(x => x.id), mine = myStance(b.id), name = pol.name || nick(b), hid = 'st-s-' + String(b.id).replace(/\W/g, '');
  const nums = pol.bills.map(x => spaced(x.bill_number)), numText = nums.length <= 2 ? nums.join(' and ') : `${nums.length} bills, incl. ${nums[0]}`;
  return `<li class="card st-stand">
    <div class="st-sbody"><h2 class="st-shead" id="${hid}">${esc(name || plainSum(b, 110))}</h2>
      <p class="st-smeta"><span>${esc(numText)}</span>${posChip(b)}${ids.includes(S.stMile) && (mine === 'support' || mine === 'oppose') ? mileChip() : ''}</p></div>
    <div class="st-chips" role="group" aria-labelledby="${hid}">${STANCES.map(([v, label, ic]) =>
      `<button type="button" class="chip" data-ststance="${esc(ids.join(','))}|${v}" aria-pressed="${mine === v}">${ic ? icon(ic) : ''}${label}</button>`).join('')}</div></li>`;
}
// Three at most, the rest folded behind one control (Nate, 9/20: "only ask for decisions on 3 bills maximum, with
// users given the opportunity to make a decision on others if they choose"). Recorded as built in 3.6; it was not
// until R-019.
const STAND_MAX = 3;
function step3() {
  const bills = followedBills(), n = bills.length;
  if (!n) return skel(3, false);
  const ideas = policies(bills), first = ideas.slice(0, STAND_MAX), rest = ideas.slice(STAND_MAX);
  return shell('st3', `${artFor(stepOf('stand', false), false)}${stepRow(stepOf('stand', false))}
    <p class="st-won st-mile" role="status">${flower(30)}<span>You’re following ${plural(n, 'bill')}. Mahalo!</span></p>
    <h2 class="st-ask" id="st-h">Where do you stand? <span class="st-opt">(optional)</span></h2>
    <p class="lede">Private — we never show your answer publicly, and you can change it any time.</p>`,
    `<ul class="st-stands" role="list" aria-labelledby="st-h">${first.map(standCard).join('')}</ul>
    ${rest.length ? `<details class="st-standmore"><summary><span>Say where you stand on ${rest.length} more</span>${icon('chevron-down', { cls: 'st-tchev' })}</summary>
      <ul class="st-stands" role="list">${rest.map(standCard).join('')}</ul></details>` : ''}
    <p class="sr" role="status" id="st-live"></p>`);
}

// ================= The explaining screens: tour, the session, hearings, what happens next =========
// Everything here teaches rather than asks. Each one is one idea, each is skippable, and each is
// built from what the person has already chosen so it is about THEIR bills, not a generic tour.
const stShell = (cls, name, h1, lede, body) => shell(cls,
  `${artFor(stepOf(name, false), false)}${stepRow(stepOf(name, false))}
   <h1 class="hero" id="st-h">${h1}</h1><p class="lede">${lede}</p>`, body);

// The bill used as the running example on every teaching screen (3.5: personalize instead of generic
// examples). Prefers one with a hearing ahead - the most concrete story - else the first followed, in
// the urgency order screen 2 offered them. Nate has asked to review which real bills read best here
// once this is visually working; this is a reasonable default, not a final choice.
function exampleBill() {
  const bills = followedBills(); if (!bills.length) return null;
  const soon = ((S.pool && S.pool.hearings) || []).filter(h => new Date(h.scheduled_at) > Date.now());
  return bills.find(b => soon.some(h => h.bill_id === b.id)) || bills[0];
}
// Tap-to-reveal callouts, numbered: one line of explanation opens at a time (Nate: let the reader set
// the pace). No hover - DESIGN B-9 bans a reveal that only works with a mouse.
const callouts = (items, open, attr) => `<ol class="st-callouts" role="list">${items.map(([t, d], i) => `<li class="st-callout${open.has(i) ? ' st-open' : ''}">
    <button type="button" class="st-calnum" data-${attr}="${i}" aria-expanded="${open.has(i)}" aria-controls="st-${attr}-${i}">
      <span class="st-calbadge" aria-hidden="true">${i + 1}</span><span>${esc(t)}</span>${icon('chevron-down', { cls: 'st-calchev' })}
    </button><p class="st-calbody" id="st-${attr}-${i}">${esc(d)}</p></li>`).join('')}</ol>`;

// A guided, numbered look at a real bill, built from the real bill page's own parts (situation()/railHTML()
// from bill.js) rather than redrawn from scratch, so the miniature and the real page can never disagree
// (3.5: "mimic the look of a bill"). No new glossary or tooltip component: the real bill page already
// proves jargon is better rewritten in plain words than glossed (DESIGN-AUDIT G-13), and this does the same.
S.stCallout ??= new Set();
function stepTour() {
  const b = exampleBill();
  if (!b) return stShell('st1 st-teach', 'tour', 'Reading a bill', 'Every bill page says the same few things.',
    callouts(TOUR, S.stCallout, 'stcal'));
  const x = situation(b), name = nick(b);
  const rows = [
    ['Its everyday name', name ? `HIPHI calls it "${name}."` : 'This one has no everyday name yet - the plain summary below leads instead.'],
    ['The official title, in plain words', `The Capitol calls it "${b.title || 'a bill'}." In plain words: ${plainSum(b, 180)}`],
    ['Where it is now', (x.st && x.st.says) || 'Waiting for its next step.'],
    ['What you can do', whatNow(b)],
  ];
  return stShell('st1 st-teach', 'tour', 'Reading a bill',
    'Here is one you just followed, built the same way every bill page is. Tap each one to read more.',
    `<div class="st-tourcard"><p class="st-tournum">${esc(spaced(b.bill_number))}</p>
      <h3 class="st-tourname">${esc(name || plainSum(b, 60))}</h3>${posChip(b)}
      <div class="st-minirail bl-page">${railHTML(b, x)}</div>
      ${callouts(rows, S.stCallout, 'stcal')}
      <p class="st-tourlink">${btn('Open this bill', { kind: 'text', iconEnd: 'arrow-right', href: billPath(b) })}</p></div>`);
}
// What this particular bill lets you do today. Said of a bill that already had a hearing on the
// calendar, "when a hearing is set" was true of bills in general and wrong about the one on screen.
function whatNow(b) {
  const h = ((S.pool && S.pool.hearings) || []).filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now())
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (!h) return 'Nothing yet. When a hearing is set we email you, and you can send a short email or written testimony.';
  const d = new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'short', day: 'numeric' });
  return `It has a hearing ${d}. You can send written testimony before then — it usually closes a day ahead.`;
}
const TOUR = [['Its everyday name', 'What the team calls it, in plain words.'],
  ['The official title, in plain words', 'The Capitol’s own title never leads - a plain summary always does.'],
  ['Where it is now', 'Which committee has it, and what has to happen next.'],
  ['What you can do', 'A short email, or written testimony when a hearing is set.']];

// ================= Screen 5 (NEW, HANDOFF 3.5): the session, January to May =================
// Replaces "How a bill becomes law" and "The session calendar" with one page: the stages AND when they
// happen. Five windows instead of twelve deadline keys or seven abstract steps - the same story, once.
// Tap a window to read it (a fuller scrubbable timeline is a real option later; five clear taps teach
// the same thing without a drag gesture that has to work on every device before it teaches anything).
const SESSION_MONTHS = [
  ['Mid-January', 'The session opens', 'Legislators introduce bills — about three thousand of them. The window to file a new one closes after about three weeks.'],
  ['February', 'First committees', 'Each bill’s first chamber holds hearings and votes on it, one to three committees deep. Most bills stop here — it is the biggest filter of the year.'],
  ['Early March', 'Crossover', 'Bills that passed their first chamber cross to the other one and start over: new committees, new hearings, a new chance to stop.'],
  ['March–April', 'Second committees, then a floor vote', 'The other chamber does its own hearings and votes. If the two chambers passed different versions, a small conference group agrees on one.'],
  ['Late April–early May', 'The Governor, and Sine Die', 'The Governor signs bills, lets them become law without signing, or vetoes them. The session ends (Sine Die) on a fixed date in early May.'],
];
// Roughly where a bill's current stage sits on the five windows above, for the "Yours is here" marker.
function monthForStage(x) {
  const st = x.st || {};
  if (x.law || /governor|vetoed/.test(st.phase || '')) return 4;
  if (st.phase === 'conference') return 3;
  if (st.leg === 'second') return 3;
  if (st.phase === 'floor' && st.leg === 'first') return 2;
  if (st.leg === 'first' && st.phase === 'committee') return 1;
  return 0;
}
S.stMonth ??= 0;
function stepSession() {
  const b = exampleBill(), x = b ? situation(b) : null;
  const mine = x && !x.law && !x.stopped ? monthForStage(x) : null;
  const m = SESSION_MONTHS[S.stMonth] || SESSION_MONTHS[0];
  return stShell('st1 st-teach st-session', 'session', 'The session, January to May',
    'Every bill moves through the same five windows. Most stop somewhere along the way; a few become law.',
    `<div class="st-months" role="tablist" aria-label="Point in the session">${SESSION_MONTHS.map((mo, i) => `<button type="button" role="tab" class="st-monthbtn${S.stMonth === i ? ' on' : ''}" aria-selected="${S.stMonth === i}" data-stmonth="${i}">${esc(mo[0])}${mine === i ? `<span class="st-mine">${icon('map-pin')}</span>` : ''}</button>`).join('')}</div>
    <div class="st-monthbody" role="tabpanel"><h3>${esc(m[1])}</h3><p>${esc(m[2])}</p>${mine === S.stMonth ? `<p class="st-mineline">${icon('map-pin')}<span>${b ? (nick(b) || spaced(b.bill_number)) : 'Yours'} is here right now.</span></p>` : ''}</div>`);
}

// What a hearing is, and the one fact people miss: testimony closes before the hearing starts.
S.stHearOpen ??= new Set();
function stepHearing() {
  const b = exampleBill(), x = b ? situation(b) : null, chairLeg = x?.chairs?.[0]?.leg;
  const items = [
    ['Notice', 'A hearing is posted about two days ahead.'],
    ['Testimony', 'Anyone may send written testimony. It usually closes 24 hours before the hearing starts — the deadline people miss.'],
    ['The hearing', 'The committee discusses it and votes. You can watch, or turn up and speak.'],
    ['Afterwards', 'It moves on, or is put off — which usually means it stops for the year.'],
  ];
  return stShell('st1 st-teach', 'hearing', 'What a hearing is',
    'A committee meets in public, hears from anyone who wants to speak, and votes. Tap each one to read more.',
    `${callouts(items, S.stHearOpen, 'sthear')}
    ${chairLeg ? `<div class="st-chair"><p class="st-chairlbl">Meet a committee chair</p>
      <a class="st-chaircard" href="#/legislator/${chairLeg.id}">${legPhoto(chairLeg, 'st-legpic')}
        <span><b>${esc(legTitle(chairLeg))} ${esc(chairLeg.name)}</b><span>Chair, ${esc(cmteLabel(x.code))}</span></span>${icon('chevron-right', { cls: 'st-chairchev' })}</a></div>` : ''}`);
}

// ================= Screen 7 (NEW, HANDOFF 3.5): what happens next =================
// The same three beats Home's welcome card says to a returning visitor (pub/home.js hm-nextup),
// given their own onboarding screen, placed right before the address ask - "we'll tell you" comes
// just before "so tell us where you are."
// No celebration banner here (tried "You're all set up to stay in the loop" and cut it on review): the
// email/advocacy-alerts ask is the NEXT screen and is skippable, so a line implying it is already done
// was simply untrue for anyone who goes on to skip it. The one onboarding celebration stays on "where
// do you stand" (st-won on followedBills), which a fresh-eyes review confirmed already works well.
function stepWhatsNext() {
  const soon = followedBills().some(b => ((S.pool && S.pool.hearings) || []).some(h => h.bill_id === b.id && new Date(h.scheduled_at) > Date.now()));
  const step = (ic, title, text) => `<li><span class="st-tlabel-ic">${icon(ic)}</span><span class="st-tbody"><b>${esc(title)}</b><span>${esc(text)}</span></span></li>`;
  return stShell('st1 st-teach', 'whatsnext', 'What happens next',
    'Here is what HIPHI does for you from here.',
    `<ul class="st-teach-list st-nextlist">
      ${step('eye', 'We keep watch.', 'We check your bills every day, so you don’t have to.')}
      ${step('calendar-clock', 'When a bill has a hearing, you can help.', `${soon ? 'One of your bills already has one coming up. ' : ''}We’ll show one simple way to help, right here. Most take a couple of minutes.`)}
      ${step('circle-check', 'You see what happened.', 'When a committee decides, the result shows up here and in My bills.')}
    </ul>`);
}

// ================= Screen 8: who speaks for you, by street address =================
// 3.5: street address, not town - the town lookup only fully resolves 80 of 265 towns. The debounced
// address search is its own module (addresspicker.js) so this screen runs an independent instance from
// the full Legislators finder rather than sharing its state. Town stays as a quick fallback underneath.
const APstart = createAddressPicker();
S.stAddr ??= { q: '', pick: null, finding: false, err: '' };
const card_wrap = inner => `<div class="st-legwrap">${inner}</div>`;
function stepLegs() {
  const A = S.stAddr, w = wiz(), town = w.town ? lookupTown(w.town) : null;
  const legCard = l => `<li class="st-leg">${legPhoto(l, 'st-legpic')}<span class="st-tbody"><b>${esc(legTitle(l))} ${esc(l.name)}</b><span>${l.chamber === 'S' ? 'Senator' : 'Representative'} · District ${esc(String(l.district))}</span></span></li>`;
  let body;
  if (A.pick) {
    const legs = A.pick.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean);
    body = `<p class="st-ok-small">${icon('circle-check')}<span>Your senator and representative</span></p>
      <ul class="st-legs" role="list">${legs.map(legCard).join('')}</ul>
      ${btn('Look up a different address', { kind: 'text', attrs: { 'data-staddrclear': '1' } })}`;
  } else if (A.finding) {
    body = `<p class="st-info-small" role="status">${icon('loader-circle', { cls: 'pp-spin' })}<span>Finding your districts…</span></p>`;
  } else {
    const q = A.q.trim(), results = APstart.results(q);
    const sug = town ? [] : townMatches(S.stTown ?? '');
    body = `<div class="field"><label for="st-addr">Your street address</label>
        <input id="st-addr" type="text" autocomplete="street-address" placeholder="123 Main St, Kailua" value="${esc(A.q)}" data-staddr="1">
        <span class="help">We use it only to look up your districts; it is not saved.</span></div>
      ${A.err ? `<p class="st-info-small">${icon('info')}<span>${esc(A.err)}</span></p>` : ''}
      ${results.length ? `<div class="st-sugs" role="group" aria-label="Addresses">${results.map((r, i) => `<button type="button" class="st-sug" data-staddrpick="${i}">${icon('map-pin')}<span>${esc(r.label)}</span></button>`).join('')}</div>` : ''}
      <p class="st-orrow"><span>or, just your town</span></p>
      ${town
        ? `<p class="st-info-small">${icon('info')}<span>In ${esc(town.label)}: ${[town.senator, town.rep].filter(Boolean).map(l => l.name).join(' and ') || 'it depends on your street'}</span></p>${btn('Use a different town', { kind: 'text', sm: true, attrs: { 'data-sttownclear': '1' } })}`
        : `<div class="field"><label for="st-town">Town</label><input id="st-town" type="text" autocomplete="address-level2" placeholder="Kailua, Hilo, Waipahu…" value="${esc(S.stTown ?? '')}" data-sttown="1"></div>
           ${sug.length ? `<div class="st-sugs" role="group" aria-label="Towns">${sug.map(x => `<button type="button" class="st-sug" data-sttownpick="${esc(x.key)}">${icon('map-pin')}<span>${esc(x.label)}</span></button>`).join('')}</div>` : ''}`}`;
  }
  return stShell('st1 st-teach st-legstep', 'legislators', 'Who speaks for you',
    'Two people at the Capitol represent where you live: one senator and one representative. They are the ones who vote on your bills. Optional.',
    card_wrap(body));
}

// The last thing asked, and the smallest: a name to greet them by. It stays on this device only when
// no email was given this visit (3.5: the old copy claimed that unconditionally, which stopped being
// true the moment the name started saving with the account - core.js loadUser()).
function stepName() {
  const w = wiz(), willSave = S.session || !!(S.stMail && S.stMail.sent);
  const copy = willSave
    ? 'What should we call you? We’ll use it to greet you, and save it with your account so it follows you between devices.'
    : 'What should we call you? We’ll use it to greet you, nothing else — and it stays on this device unless you add your email.';
  return stShell('st1 st-teach', 'name', 'One last thing', copy,
    `<div class="field"><label for="st-name">Your name</label>
      <input id="st-name" type="text" autocomplete="given-name" placeholder="Leilani" value="${esc(w.name || '')}" data-stname="1"></div>`);
}

// ================= Screen 9 (in session) and step 3 (off-season): keep me updated =================
// One opt-in for both hearing alerts and HIPHI's own advocacy alerts (HANDOFF 3.5, 9/20) - this reverses
// the earlier rule that action alerts stayed a separate, off-by-default choice. frontend/CLAUDE.md's
// public-tracker rule 2 and DESIGN.md C-4 are rewritten in the same commit as this code, per 3.5's own note.
// S.stMail: this visit's email step. The typed address survives a trip to the privacy page and back.
S.stMail ??= { email: '', sent: '', demo: false };
const SMALL_PRINT = 'No password — we send a link to sign in, which can take a minute. It also keeps your bills on any device. HIPHI staff can see which bills people follow, so they know what the community cares about.';
// A real link was sent earlier in this visit (core notes the address): a reload still says "check your inbox".
function mailSent() {
  if (!S.stMail.sent) { try { S.stMail.sent = sessionStorage.getItem('hiphi_link_sent') || ''; } catch { /* ignore */ } }
  return S.stMail.sent;
}
// Buttons live in the sticky bar (bar(), below), not inside the card, so this screen keeps the same
// Skip/primary rhythm as every other screen instead of its own one-off row (3.5/3.6: this screen used
// to state its promise twice - once here, once in the bar - and put Skip in a different place than the
// seven screens before it). The primary button submits the form by id from outside it (form="st-eform").
function emailCard() {
  const M = S.stMail, sent = mailSent();
  if (sent) return `<section class="card st-sent" aria-labelledby="st-sent-t">
    <span class="st-ilead">${icon('mail-check')}</span>
    <div class="st-sentbody"><h2 id="st-sent-t" tabindex="-1">Check your inbox at <span class="st-break">${esc(sent)}</span></h2>
      <p>Open the link on this device and your bills come with you. Hearing alerts and HIPHI’s updates start once you do.</p>
      <p class="small muted">${M.demo ? 'This is the sandbox, so nothing was sent.' : 'It can take a minute. If you don’t see it, check your spam folder.'}</p>
      <div class="st-formbtns">${btn('Use a different email', { kind: 'text', attrs: { 'data-stother': '1' } })}</div></div>
  </section>`;
  return `<form class="card st-form" id="st-eform" novalidate>
    <div class="field"><label for="st-email">Your email</label>
      <input id="st-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="name@example.com" value="${esc(M.email)}">
      <span class="err" id="st-email-err" role="alert"></span></div>
    <p class="st-promise">We’ll email you when one of your bills gets a hearing, and when HIPHI has an update or a way to help. Unsubscribe in one tap, any time.</p>
    <p class="meta">${SMALL_PRINT} <a href="#/privacy">Read about privacy</a></p>
  </form>`;
}
function step4() {
  return shell('st4', `${artFor(stepOf('email', false), false)}${stepRow(stepOf('email', false))}
    <h1 class="hero" id="st-h">Keep me updated</h1>`,
    emailCard());
}

// ================= Off-season step 2: what happened last session =================
const ORDER = ['introduced', 'first_triple', 'first_lateral', 'first_decking', 'first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'second_crossover', 'conference', 'governor', 'enacted'];
const reach = b => b.stage === 'enacted' ? 99 : b.stage === 'dead' ? ORDER.indexOf(b.died_at_stage || '') : ORDER.indexOf(b.stage || '');
// Each row opens the bill's page (Back returns here), so someone curious in September has something to explore.
function recapRow(b) {
  const law = b.stage === 'enacted', gov = b.stage === 'governor', name = nick(b);
  return `<li><a class="st-rrow" href="${billPath(b)}"><span class="st-rbody"><span class="st-rhead${name ? '' : ' st-clamp'}">${esc(name || plainSum(b, 300))}</span>
    ${name ? `<span class="st-rwhat">${esc(plainSum(b, 160))}</span>` : ''}
    <span class="st-rmeta"><span>${esc(spaced(b.bill_number))}</span>${law ? chip('Became law', 'ok', 'circle-check') : gov ? chip('On the Governor’s desk', 'info', 'landmark') : chip('Stopped this session', '', 'archive')}</span></span>
    ${icon('chevron-right', { cls: 'chev' })}</a></li>`;
}
function step2off() {
  const si = sessionInfo(), yr = si.recapYear, nextYr = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1, sel = pickedIssues(), sig = sigOf(true, sel), L = S.stLoad;
  if (!sel.length) return skel(2, true);
  if (!L || L.sig !== sig || (!L.rows && !L.err)) { load2(sig, sel, true); return skel(2, true); }
  if (L.err) return loadErr(2, true);
  const used = new Set();
  // A pick is a topic (its own matcher) or, for picks saved before 9/20, a coalition name. Matching topics by
  // coalition name is what made this screen say "HIPHI worked on 0 bills" (R-019).
  const inIssue = (i, b) => i.match ? i.match(b) : (b.coalitions || []).some(n => i.names.includes(n));
  // Good news first: the issues with the most bills that became law, then the busiest.
  const lawsOn = i => L.rows.filter(b => b.stage === 'enacted' && hasPos(b) && inIssue(i, b)).length;
  const order = sel.slice().sort((a, b) => lawsOn(b) - lawsOn(a) || (b.bills || 0) - (a.bills || 0));
  const cards = order.map(i => {
    const rows = L.rows.filter(b => hasPos(b) && inIssue(i, b) && (!b.session_year || +b.session_year === yr));
    const laws = rows.filter(b => b.stage === 'enacted').sort((a, b) => (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9));
    const far = rows.filter(b => b.stage !== 'enacted').sort((a, b) => reach(b) - reach(a) || (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9));
    const show = [...laws, ...far].slice(0, 2);
    const worked = Math.max(i.bills || 0, rows.length);
    const said = `HIPHI worked on ${plural(worked, 'bill')} on this issue in ${yr}. ${laws.length ? `${laws.length === 1 ? 'One' : laws.length} became law.` : show.length ? `None became law this time. ${show.length === 1 ? 'This one' : 'These'} went furthest:` : ''}`;
    // A published HIPHI list with bills on this issue (each list offered once).
    const list = (S.lists || []).find(l => !used.has(l.slug) && (S.listBills[l.slug] || []).some(x => inIssue(i, x.b)));
    if (list) used.add(list.slug);
    const following = list && S.listFollows.has(list.id), hid = 'st-r-' + String(i.names[0]).replace(/\W/g, '');
    return `<section class="card st-recap" aria-labelledby="${hid}">
      <h2 id="${hid}"><span class="st-ilead">${icon(i.icon)}</span>${esc(i.key)}</h2>
      <p>${esc(said)}</p>
      ${show.length ? `<ul class="st-rrows" role="list">${show.map(recapRow).join('')}</ul>` : ''}
      ${list ? `<button type="button" class="st-list" data-stlist="${esc(list.slug)}" aria-pressed="${!!following}">
        <span class="st-ilead">${icon(following ? 'check' : 'list-checks')}</span>
        <span class="st-ibody"><span class="st-iname">${following ? `Following “${esc(list.title)}”` : `Follow HIPHI’s “${esc(list.title)}” list`}</span>
        <span class="st-idesc">${following ? `HIPHI’s ${nextYr} bills will show up on your page as they are added.` : `HIPHI’s ${nextYr} bills will show up on your page when they are added to it.`}</span></span></button>` : ''}
    </section>`;
  }).join('');
  return shell('st2 st-off', `${artFor(stepOf('recap', true), true)}${stepRow(stepOf('recap', true))}
    <h1 class="hero" id="st-h">What happened in ${yr}</h1>
    <p class="lede">Here’s how HIPHI’s bills did on the ${sel.length === 1 ? 'issue' : 'issues'} you picked. Select a bill to read more.</p>`, cards);
}

// ================= Off-season step 3: the email step, in off-season words =================
// True and visible: the picked issues are named (they live in this browser), with a way back to change them. The
// email is for hearing alerts and keeping bills across devices; no "the session is open" email exists, so none is promised.
function step3off() {
  const si = sessionInfo(), nextYr = si.nextOpen ? +si.nextOpen.slice(0, 4) : si.yr + 1, sel = pickedIssues(), opens = esc(longDay(si.nextOpen));
  const saved = `<p class="st-ok" role="status">${icon('circle-check')}<span>We saved your ${sel.length === 1 ? 'issue' : 'issues'} in this browser: ${namesHtml(sel)}. <a href="#/start/1">Change</a></span></p>`;
  const legs = `<div class="rows st-legs">${row({ lead: 'landmark', title: 'Find my legislators', sub: 'The senator and representative who work for you. Takes 30 seconds.', href: '#/legislators', attrs: { 'data-stready': '1' } })}</div>`;
  const intro = S.session
    ? `<h1 class="hero" id="st-h">You’re set for January</h1>
      <p class="lede">The ${nextYr} session opens on ${opens}. HIPHI’s bills for your issues will be here then, ready to follow.</p>`
    : `<h1 class="hero" id="st-h">Keep me updated</h1>
      <p class="lede">Add your email now and you’re set for ${nextYr}: when a bill you follow has a hearing, or HIPHI has advocacy news, we’ll tell you in time. It also keeps your bills and lists on any device.</p>`;
  return shell('st3 st-off', `${artFor(stepOf('email', true), true)}${stepRow(stepOf('email', true))}${saved}${intro}`,
    `${S.session ? '' : emailCard()}<h2 class="st-subh st-alsoh">One more thing you can do now</h2>${legs}`);
}

// ================= wiring =================
function flash(text) {
  const el = document.getElementById('st-alert'); if (!el) return;
  el.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`;
  const box = el.closest('.st-say'); box.classList.add('st-alerting');
  // The message sits above the choices. Someone who pressed the button from further down the list is brought to it.
  const r = box.getBoundingClientRect();
  if (r.top < 64 || r.bottom > window.innerHeight - 96) box.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
}
function clearFlash() {
  const el = document.getElementById('st-alert'); if (!el || !el.innerHTML) return;
  el.innerHTML = ''; el.closest('.st-say').classList.remove('st-alerting');
}
function toggleTick(el) {
  const on = el.getAttribute('aria-pressed') !== 'true';
  el.setAttribute('aria-pressed', String(on));
  el.closest('.st-pcard')?.classList.toggle('on', on);
  const t = el.querySelector('.st-tick'); if (t && on && !reduce()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
  return on;
}
// Follow what is ticked. Coming Back to this step and unticking a bill followed a moment ago unfollows it again, so
// "Follow 2 bills" always ends with exactly those 2 from this step.
async function followIds(ids, drop = []) {
  const fresh = ids.filter(id => !S.watch.has(id)), gone = drop.filter(id => S.watch.has(id));
  ids.forEach(id => S.watch.add(id)); gone.forEach(id => S.watch.delete(id)); saveLocal();
  // Signed in: the account's watchlist too (a failure heals itself: the next sign-in adds what this device follows).
  if (S.user && !DEMO) {
    try {
      if (fresh.length) { const r = await S.supa.from('watchlist').insert(fresh.map(bill_id => ({ user_id: S.user.id, bill_id, stance: (S.stances || {})[bill_id] || null }))); if (r.error) console.error(r.error); }
      if (gone.length) { const r = await S.supa.from('watchlist').delete().eq('user_id', S.user.id).in('bill_id', gone); if (r.error) console.error(r.error); }
    } catch (e) { console.error(e); }
  }
  try { await loadBills(); } catch (e) { console.error(e); }
}
const busy = (el, label) => { if (!el) return; el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}${label ? `<span>${esc(label)}</span>` : ''}`; };

// Where a step cannot be shown (nothing picked, nothing followed, signed in on the email step), where to go instead.
function redirectFor(step, off) {
  const picked = pickedIssues().length > 0, n = nameAt(step, off), T = total(off);
  const back = () => picked ? stepOf('bills', off) : stepOf('topics', off);
  if (step > T) return T;
  if (off) return n !== 'topics' && !picked ? stepOf('topics', off) : 0;
  if (n === 'bills') return picked ? 0 : stepOf('topics', off);
  if (['stand', 'tour', 'session', 'hearing', 'whatsnext', 'legislators'].includes(n)) return S.watch.size ? 0 : back();
  if (n === 'email') return S.session ? 'home' : S.watch.size ? 0 : back();
  return 0;
}

function wire(route) {
  const step = route.step || 1, off = isOff();
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  const to = redirectFor(step, off);
  if (to) { setTimeout(() => (to === 'home' ? finish() : app.go('#/start/' + to, { replace: true })), 0); return; }
  if (wiz().step !== step) wizSet({ step });

  // Skip always means "go to the next page" (HANDOFF 3.5) - it used to fast-forward the teaching
  // screens straight to the email ask, and leave the wizard entirely from topics, bills or email,
  // which quietly cost the email ask and, from bills, cost every follow too.
  $$('[data-stskip]').forEach(el => el.onclick = () => {
    const here = nameAt(step, off);
    if (here === 'name') return finish();   // nothing after it; Skip means done
    // Nothing picked on the first screen: every screen after it needs a pick, and its redirect sent Skip straight
    // back here, so Skip did nothing and the start could not be left (R-019). With no picks, Skip leaves the start.
    if (here === 'topics' && !pickedIssues().length) return skipAll();
    if (here === 'bills') {
      // Skip still follows whatever is already ticked (the pre-ticked defaults, usually), the same
      // commit Next makes - it is "move on", not "undo my picks".
      const m = model2();
      if (m.loading || m.err || m.none) return skipAll();
      const w = wiz(), ids = w.picksFor === m.sig ? (w.picks || []) : [];
      if (!ids.length) { nudge('follow'); return skipAll(); }   // nothing ticked at all: let Home ask later
      Promise.resolve(followIds(ids, (w.followed || []).filter(id => !ids.includes(id)))).then(() => {
        wizSet({ step: 3, done: true, ready: null, followed: ids });
        welcome();
        goStep(step, stepOf('stand', off));
      });
      return;
    }
    goStep(step, step + 1);
  });
  $$('[data-stback]').forEach(el => el.onclick = () => goBack(+el.dataset.stback));
  $$('[data-stretry]').forEach(el => el.onclick = () => { S.stLoad = null; app.render(); });
  $$('[data-stdone]').forEach(el => el.onclick = () => finish());
  // "Find my legislators" leaves the start for good; the link itself does the navigating.
  $$('[data-stready]').forEach(el => el.addEventListener('click', () => { wizSet({ done: true, step: 1, ready: sessionInfo().nextOpen }); welcome(); }));

  if (nameAt(step, off) === 'topics') {
    $$('[data-stissue]').forEach(el => el.onclick = () => {
      const on = toggleTick(el), set = new Set(wiz().issues || []), name = el.dataset.stissue;
      // Store the topic's own key; drop any other spelling of the same one (its label, a sibling).
      const t = topicList().find(i => i.names.includes(name) || i.key === name);
      (t ? [t.key, ...t.names] : [name]).forEach(n => set.delete(n));
      if (on) set.add(name);
      wizSet({ issues: [...set] }); clearFlash();
    });
    const next = $('[data-stnext]');
    if (next) next.onclick = () => {
      if (!pickedIssues().length) { flash('Pick at least one issue, or select Skip.'); return; }
      // Between sessions the next screen is the recap: there is no "bills" screen in that flow, and asking for its
      // number returned 0, which redrew this same screen - Next did nothing on the live site (R-019).
      goStep(step, stepOf(off ? 'recap' : 'bills', off));
    };
  }

  // The explaining screens: Next simply moves on; the ones with a field remember what was typed.
  if (['tour', 'session', 'hearing', 'whatsnext'].includes(nameAt(step, off))) {
    const next = $('[data-stnext]'); if (next) next.onclick = () => goStep(step, step + 1);
  }
  // Tap-to-reveal callouts (tour, hearing): toggled in place, so nothing else on the page moves.
  if (['tour', 'hearing'].includes(nameAt(step, off))) {
    $$('[data-stcal], [data-sthear]').forEach(el => el.onclick = () => {
      const open = el.getAttribute('aria-expanded') !== 'true';
      el.setAttribute('aria-expanded', String(open)); el.closest('.st-callout')?.classList.toggle('st-open', open);
      const set = el.hasAttribute('data-stcal') ? S.stCallout : S.stHearOpen, i = +(el.dataset.stcal ?? el.dataset.sthear);
      if (open) set.add(i); else set.delete(i);
    });
  }
  if (nameAt(step, off) === 'session') {
    $$('[data-stmonth]').forEach(el => el.onclick = () => { S.stMonth = +el.dataset.stmonth; app.render();
      requestAnimationFrame(() => document.querySelector(`[data-stmonth="${S.stMonth}"]`)?.focus({ preventScroll: true })); });
  }
  if (nameAt(step, off) === 'legislators') {
    const abox = $('[data-staddr]');
    if (abox) abox.oninput = () => {
      S.stAddr.q = abox.value; S.stAddr.err = '';
      APstart.search(abox.value.trim(), () => app.render());
      app.render();
      requestAnimationFrame(() => { const again = document.querySelector('[data-staddr]'); if (again) { again.focus({ preventScroll: true }); again.setSelectionRange(again.value.length, again.value.length); } });
    };
    $$('[data-staddrpick]').forEach(el => el.onclick = async () => {
      const r = APstart.results(S.stAddr.q.trim())[+el.dataset.staddrpick]; if (!r) return;
      S.stAddr.finding = true; app.render();
      try {
        const res = await APstart.resolve(r.label, r);
        if (!res || res.none || !res.ids?.length) { S.stAddr.finding = false; S.stAddr.err = 'We couldn’t find that address. Try your town instead.'; app.render(); return; }
        S.stAddr.pick = { ids: res.ids }; S.stAddr.finding = false; app.render();
      } catch { S.stAddr.finding = false; S.stAddr.err = 'We couldn’t look that up. Try your town instead.'; app.render(); }
    });
    const aclear = $('[data-staddrclear]'); if (aclear) aclear.onclick = () => { S.stAddr = { q: '', pick: null, finding: false, err: '' }; app.render(); };
    const box = $('[data-sttown]');
    if (box) box.oninput = () => { S.stTown = box.value; app.render();
      const again = document.querySelector('[data-sttown]');
      if (again) { again.focus({ preventScroll: true }); again.setSelectionRange(again.value.length, again.value.length); } };
    $$('[data-sttownpick]').forEach(el => el.onclick = () => { wizSet({ town: el.dataset.sttownpick }); S.stTown = ''; app.render(); });
    const clear = $('[data-sttownclear]'); if (clear) clear.onclick = () => { wizSet({ town: '' }); S.stTown = ''; app.render(); };
    const next = $('[data-stnext]'); if (next) next.onclick = () => goStep(step, step + 1);
  }
  if (nameAt(step, off) === 'name') {
    const box = $('[data-stname]'); if (box) box.oninput = () => wizSet({ name: box.value.trim().slice(0, 40) });
    const next = $('[data-stnext]'); if (next) next.onclick = () => { if (box) wizSet({ name: box.value.trim().slice(0, 40) }); finish(); };
  }

  if (nameAt(step, off) === 'bills') {
    const m = model2();
    $$('[data-stpick]').forEach(el => el.onclick = () => {
      const on = toggleTick(el), w = wiz(), set = new Set(w.picksFor === m.sig ? (w.picks || []) : []);
      for (const id of el.dataset.stpick.split(',')) { if (on) set.add(id); else set.delete(id); }
      wizSet({ picksFor: m.sig, picks: [...set] });
      const nb = $('[data-stnext] span'); if (nb) nb.textContent = followLabel(set.size);
      clearFlash();
    });
    // "What it does" opens the text in place (no redraw), so focus and the ticks stay exactly where they were.
    $$('[data-stwhat]').forEach(el => el.onclick = () => {
      const open = el.getAttribute('aria-expanded') !== 'true', id = el.dataset.stwhat;
      el.setAttribute('aria-expanded', String(open)); el.closest('.st-pcard').classList.toggle('st-open', open);
      if (open) S.stWhat.add(id); else { S.stWhat.delete(id); fitWhat(); }
    });
    fitWhat();
    document.fonts?.ready?.then(fitWhat);
    // Follow all in one topic: tick every policy in that <details>, without touching the others.
    $$('[data-stfollowtopic]').forEach(el => el.onclick = () => {
      const g = m.per.find(p => p.i.key === el.dataset.stfollowtopic); if (!g) return;
      const w = wiz(), set = new Set(w.picksFor === m.sig ? (w.picks || []) : []);
      g.pols.forEach(x => x.bills.forEach(b => set.add(b.id)));
      wizSet({ picksFor: m.sig, picks: [...set] });
      app.render();
    });
    // Follow all, overall: every policy in every open topic.
    $$('[data-stfollowall]').forEach(el => el.onclick = () => {
      const set = new Set();
      m.per.forEach(g => g.pols.forEach(x => x.bills.forEach(b => set.add(b.id))));
      wizSet({ picksFor: m.sig, picks: [...set] });
      app.render();
    });
    const next = $('[data-stnext]');
    if (next) next.onclick = async () => {
      // Never a dead button: if the bills are somehow not ready, say so rather than swallowing the tap.
      if (m.loading || m.err || m.none) { flash(m.err ? 'The bills did not load. Try again.' : 'Still finding bills — one moment.'); return; }
      const w = wiz(), ids = w.picksFor === m.sig ? (w.picks || []) : [];
      if (!ids.length) { flash('Check at least one bill, or select Skip.'); return; }
      if (next.getAttribute('aria-busy') === 'true') return;
      busy(next, 'Following…');
      await followIds(ids, (w.followed || []).filter(id => !ids.includes(id)));
      // done: Home stops sending them back here even if they later unfollow everything. ready: the off-season promise is kept.
      wizSet({ step: 3, done: true, ready: null, followed: ids });
      welcome();
      goStep(step, stepOf('stand', off));
    };
  }

  if (nameAt(step, off) === 'recap') {
    $$('[data-stlist]').forEach(el => el.onclick = async () => {
      if (el.getAttribute('aria-busy') === 'true') return;
      const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-busy', 'true'); busy(el.querySelector('.st-ilead'), '');
      await followList(el.dataset.stlist, on);
      // The row itself now says what happened. Between sessions core's toast would cheer "Following 0 bills" on top of it.
      const t = document.getElementById('toast'); if (t) t.innerHTML = '';
    });
    // On to the email ask (or the name, when signed in). This asked for "stand", which the between-sessions flow does
    // not have, and went back to the first screen (R-019).
    const next = $('[data-stnext]'); if (next) next.onclick = () => goStep(step, step + 1);
  }

  if (nameAt(step, off) === 'stand') {
    $$('[data-ststance]').forEach(el => el.onclick = () => {
      // One card is one idea, which may be several bills: the answer goes on each of them.
      const [idList, v] = el.dataset.ststance.split('|'), ids = idList.split(','), id = ids[0], had = tookStand(), now = myStance(id) === v ? null : v;
      Promise.all(ids.map(x => setStance(x, now))).catch(e => toast(e, true));
      // In place, so focus stays on the chip: the one selected, its neighbours cleared; the same chip again clears it.
      const card = el.closest('.st-stand');
      card.querySelectorAll('[data-ststance]').forEach(c => c.setAttribute('aria-pressed', String(!!now && c === el)));
      // The chip marks the card where the first stand was taken, for as long as that card keeps a stand.
      const live = document.getElementById('st-live');
      if (!had && tookStand()) {
        S.stMile = id; card.querySelector('.st-smeta')?.insertAdjacentHTML('beforeend', mileChip());
        if (live) live.textContent = 'Milestone: you took a stand.';
      } else if (S.stMile && !['support', 'oppose'].includes(myStance(S.stMile))) {
        // Scoped to the cards: the "You're following N bills" banner above them carries .st-mile too, and a bare
        // querySelector removed the banner instead of the chip.
        S.stMile = null; document.querySelector('.st-stand .st-mile')?.remove(); if (live) live.textContent = '';
      }
    });
    const next = $('[data-stnext]'); if (next) next.onclick = () => goStep(step, step + 1);
  }

  // The email step (in session step 4, off-season step 3). It is this visit's one email ask, so Home will not ask again.
  const form = $('#st-eform'), sentCard = $('.st-sent');
  if (form || sentCard) { S.nudge = null; S.nudgedThisVisit = true; }
  if (form) {
    // The submit button lives in the sticky bar now, outside this form (form="st-eform"), so the bar
    // stays consistent with every other screen; look it up by id, not as a descendant of the form.
    const inp = form.querySelector('#st-email'), err = form.querySelector('#st-email-err'), send = document.getElementById('st-send');
    const showErr = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'st-email-err'); err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; };
    inp.oninput = () => { S.stMail.email = inp.value; if (err.innerHTML) { err.innerHTML = ''; inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); } };
    form.onsubmit = async e => {
      e.preventDefault();
      if (send.getAttribute('aria-busy') === 'true') return;
      const email = inp.value.trim();
      // Checked only now, never while typing.
      if (!validEmail(email)) { showErr(email ? 'That doesn’t look like an email. Try one like name@example.com.' : 'Enter your email, or select Skip.'); inp.focus(); return; }
      const label = send.innerHTML; busy(send, 'Sending…');
      try {
        const r = await sendEmailLink(email, { hearing_alerts: true, action_alerts: true });
        S.stMail = { email, sent: email, demo: !!(r && r.demo) };
        app.render();
        document.getElementById('st-sent-t')?.focus({ preventScroll: true });
      } catch (error) { console.error(error); send.removeAttribute('aria-busy'); send.innerHTML = label; showErr(friendly(error)); inp.focus(); }
    };
  }
  $$('[data-stother]').forEach(el => el.onclick = () => {
    S.stMail = { email: S.stMail.sent || '', sent: '', demo: false };
    try { sessionStorage.removeItem('hiphi_link_sent'); } catch { /* ignore */ }
    app.render(); const i = document.getElementById('st-email'); if (i) { i.focus(); i.select(); }
  });
}

const TITLE = { topics: 'Pick your issues', bills: 'Your topics, and their bills',
  stand: 'Where do you stand?', tour: 'Reading a bill', session: 'The session, January to May',
  hearing: 'What a hearing is', whatsnext: 'What happens next', legislators: 'Who speaks for you',
  email: 'Keep me updated', name: 'Your name', recap: 'What happened' };
export default {
  tab: 'home',
  tabs: false,
  title: route => TITLE[nameAt(route.step || 1, isOff())] || 'Get started',
  render(route) {
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return skel(Math.min(step, total(off)), off);   // wire() sends them on
    switch (nameAt(step, off)) {
      case 'topics': return step1();
      case 'bills':  return step2();
      case 'stand':  return step3();
      case 'tour':   return stepTour();
      case 'session': return stepSession();
      case 'hearing': return stepHearing();
      case 'whatsnext': return stepWhatsNext();
      case 'legislators': return stepLegs();
      case 'name':   return stepName();
      case 'recap':  return step2off();
      case 'email':  return off ? step3off() : step4();
      default:       return step1();
    }
  },
  wire,
  bar(route) {
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return '';
    switch (nameAt(step, off)) {
      case 'topics': return bar2(off ? 'Next' : 'Show me bills', { iconEnd: 'arrow-right' });
      case 'recap':  { const L = S.stLoad, sig = sigOf(true, pickedIssues());
        return L && L.sig === sig && L.err ? barRetry() : bar2('Next', { iconEnd: 'arrow-right' }); }
      case 'bills': {
        const m = model2();
        if (m.err) return barRetry();
        if (m.loading || m.none) return barBusy();
        if (m.fallback && !m.fallbackPols.length) return bar1('Go to my page');
        return bar2(followLabel(m.picked.size), { icon: 'star' });
      }
      case 'stand': return bar2('Next', { iconEnd: 'arrow-right' });
      case 'tour': case 'session': case 'hearing': case 'whatsnext': case 'legislators':
        return bar2('Next', { iconEnd: 'arrow-right' });   // Skip defaults to plain "Skip" (3.5)
      case 'name': return bar2('Done', { iconEnd: 'check' });
      case 'email': return mailSent() ? bar2('Go to my page', { iconEnd: 'arrow-right' }, { 'data-stdone': '1' })
        : bar2('Yes, keep me updated', { icon: 'bell' }, { type: 'submit', form: 'st-eform', id: 'st-send' });
      default: return '';
    }
  },
};
