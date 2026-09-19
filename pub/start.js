// The guided start (plan section 3, reworked 9/19 to Nate's decision): a newcomer's first visit is "follow a few
// bills and maybe say where you stand". No action is pushed here; the asks to act come on later visits, easiest
// first. The email is asked as a natural step: "email me when my bills have a hearing" IS the consent for alerts.
//   In session:   1 pick issues -> 2 follow a few bills -> 3 where do you stand? (optional) -> 4 get a heads-up
//   Off-season:   1 pick issues -> 2 what happened last session -> 3 the same email step, in off-season words
// Every step is its own route (#/start/1..4) and pushes history, so Back walks the steps. The step and the picks
// live in hiphi_wiz (wiz()/wizSet()), so a reload resumes where the person left off. Every step can be skipped, and
// a primary button is never disabled (selecting it with nothing picked says why, right above the choices).
// Someone who is already signed in never sees the email step. No tab bar here. On phones the sticky bottom bar
// holds one Skip and the one primary; on wide screens the page is two columns (the story on the left, the choices
// on the right) and the bar sits at the end of the choices (start.css).
import { S, DEMO, app, esc, icon, blurb, nick, spaced, billPath, alive, issues, sessionInfo, billsForCoalitions, recommendations,
  loadBills, saveLocal, wiz, wizSet, followList, listBillsFor, HST, anyBill, myStance, setStance, sendEmailLink, validEmail,
  friendly, toast } from './core.js';
import { btn, chip, posChip, row, steps } from './ui.js';
import { CAPITOL, VOICES, islands, flower } from './art.js';

const isOff = () => sessionInfo().phase !== 'in';
// The email step is the last one; a signed-in person does not get it, so their count is one shorter.
const total = off => (off || S.session ? 3 : 4);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const andList = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
// Issue names are shown whole and in bold inside sentences: "Healthy Eating, Active Living" has a comma of its own,
// and shortening it to "Healthy Eating" made a crosswalk bill look misfiled (assessment, 9/19).
const namesHtml = list => andList(list.map(i => `<b class="strong">${esc(i.key)}</b>`));
const issuesPhrase = sel => sel.length > 2 ? `your ${sel.length} issues` : namesHtml(sel);
const reduce = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// The live page (track.js) keeps the same hiphi_wiz key and stores a coalition's first internal name, so we do too.
const pickedIssues = () => { const sel = new Set(wiz().issues || []); return issues().filter(i => sel.has(i.key) || i.names.some(n => sel.has(n))); };
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
const backBtn = step => btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stback': String(step) } });
const stepRow = (step, off) => `<div class="steps st-steps">${step > 1 ? backBtn(step) : ''}${steps(step, total(off))}</div>`;
const shell = (cls, intro, main, busy = false) => `<div class="st ${cls}"${busy ? ' aria-busy="true"' : ''}><div class="st-intro">${intro}</div><div class="st-main">${main}</div></div>`;
// The drawing of each step (wide screens show one on every step; phones only where there is room, see start.css).
const artFor = (step, off) => `<div class="st-art">${step === (off ? 3 : 4) ? islands(myIsland()) : step === 3 ? VOICES : CAPITOL}</div>`;
// One line above the choices: a reassurance, which the "pick at least one" message replaces in place (so nothing
// below it moves and no choice gets covered).
const sayRow = (ic, sure) => `<div class="st-say"><p class="st-sure">${icon(ic)}<span>${sure}</span></p><p class="st-alert" id="st-alert" role="alert"></p></div>`;
// On wide screens the reassurance belongs with the story on the left, and only the message shows above the choices.
const sureWide = (ic, sure) => `<p class="st-sure st-surewide">${icon(ic)}<span>${sure}</span></p>`;

// ---------- the bar: one Skip, one primary ----------
const bar2 = (label, opt = {}, attrs = { 'data-stnext': '1' }) => `<div class="st-bar"><div class="st-btns">
  ${btn('Skip', { kind: 'text', attrs: { 'data-stskip': '1' } })}${btn(label, { kind: 'primary', ...opt, attrs })}</div></div>`;
// While the bills load the primary says so, and when they could not be loaded it is the way to try again, so the
// one button on the screen is never a dead one.
const barBusy = () => bar2('Finding bills…', { icon: 'loader-circle' }, { 'data-stnext': '1', 'aria-busy': 'true' });
const barRetry = () => bar2('Try again', { icon: 'rotate-ccw' }, { 'data-stretry': '1' });
const bar1 = label => `<div class="st-bar st-one">${btn(label, { kind: 'primary', iconEnd: 'arrow-right', attrs: { 'data-stdone': '1' } })}</div>`;
const followLabel = n => n ? `Follow ${plural(n, 'bill')}` : 'Follow bills';

// ================= Step 1 (in session and off-season): welcome and issues =================
function issueRows(off, yr) {
  const sel = new Set(wiz().issues || []);
  // In session, issues() puts the ones with nothing moving after the rest, and General Public Health last. Between
  // sessions nothing is moving, so the busiest issues of the last session lead instead (still General last).
  const list = off ? issues().sort((a, b) => a.general - b.general || (b.bills || 0) - (a.bills || 0)) : issues();
  return `<div class="st-issues" role="group" aria-labelledby="st-h">${list.map(i => {
    const on = sel.has(i.key) || i.names.some(n => sel.has(n));
    const extra = off ? `<span class="st-icount">${plural(i.bills || 0, 'bill')} in ${yr}</span>` : i.live ? '' : chip('Quiet right now', '', 'hourglass');
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
  return shell('st1', `${artFor(1, off)}${stepRow(1, off)}
    <h1 class="hero" id="st-h">${off ? `Get ready for the ${next} session` : 'Speak up for a healthier Hawaiʻi'}</h1>
    <p class="lede">${off ? `The Legislature is on break until ${esc(shortDay(si.nextOpen))}. Pick the issues you care about, and HIPHI’s bills for them will be ready when hearings start.`
      : 'Pick the issues you care about. We’ll show you a few bills you can follow.'}</p>${sureWide('clock', SURE1)}`,
    `${sayRow('clock', SURE1)}${issueRows(off, yr)}`);
}

// ================= Step 2 (in session): a few bills to follow =================
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
    const g = per.find(p => (b.coalitions || []).some(n => p.i.names.includes(n))); if (!g) continue;
    seen.add(b.id); g.bills.push(b);
  }
  per.forEach(p => p.bills.sort(R.cmp));
  const empty = per.filter(p => !p.bills.length).map(p => p.i);
  let first = [], fallback = false;
  if (!per.some(p => p.bills.length)) { first = recommendations(3).map(r => r.b); fallback = true; }
  else {
    // At most 5 to start. Round-robin across the picked issues so each one shows up, most urgent first each round.
    const qs = per.map(p => p.bills.slice());
    while (first.length < 5 && qs.some(q => q.length)) {
      for (const q of qs.filter(x => x.length).sort((a, b) => R.cmp(a[0], b[0]))) { if (first.length < 5) first.push(q.shift()); }
    }
    first.sort(R.cmp);
  }
  const firstIds = new Set(first.map(b => b.id)), more = (w.moreFor === sig && w.more) || {};
  const extras = per.map(p => { const rest = p.bills.filter(b => !firstIds.has(b.id)), n = Math.min(rest.length, (more[p.i.key] || 0) * 6);
    return { i: p.i, shown: rest.slice(0, n), left: rest.length - n }; });
  const picked = new Set(w.picksFor === sig ? (w.picks || []) : []);
  return { sig, sel, first, fallback, empty, extras, picked, R };
}
function load2(sig, sel, off) {
  if (S.stLoad && S.stLoad.sig === sig && !S.stLoad.err) return;
  S.stLoad = { sig };
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  const work = (async () => {
    const rows = await billsForCoalitions(sel.flatMap(i => i.names));
    // Off-season: HIPHI's published lists, to offer "Follow HIPHI's list" on the issues they cover.
    if (off) await Promise.all((S.lists || []).map(l => listBillsFor(l.slug).catch(() => null)));
    return rows;
  })();
  Promise.race([work, timeout]).then(rows => {
    if (!S.stLoad || S.stLoad.sig !== sig) return;
    S.stLoad.rows = rows || [];
    if (!off) {
      // New issues, new picks: the 3 that need voices soonest start ticked.
      const m = model2(), w = wiz();
      if (m.first && w.picksFor !== sig) wizSet({ picksFor: sig, picks: m.first.slice(0, 3).map(b => b.id), moreFor: sig, more: {} });
    }
    app.render();
  }).catch(e => { console.error(e); if (S.stLoad && S.stLoad.sig === sig) { S.stLoad.err = true; app.render(); } });
}
// One bill to follow. The whole card is the toggle (a real button). With a nickname the everyday name leads and
// what the bill does sits under it; without one the plain summary is the headline, as before. The text is cut by
// lines, not characters, so a wide screen simply shows more of it. Where it is cut, a small "What it does" button
// opens it in place. That button sits on the card's bottom edge, beside the toggle rather than inside it (a button
// cannot hold a button), so reading more never ticks or unticks the bill. HIPHI's position is always on the card.
S.stWhat ??= new Set();
function pickCard(b, R, picked) {
  const inf = R.info(b), iss = issues().find(i => (b.coalitions || []).some(n => i.names.includes(n)));
  const within8 = inf.h && new Date(inf.h.scheduled_at) - Date.now() < 8 * 864e5;
  const day = within8 ? new Date(inf.h.scheduled_at).toLocaleDateString('en-CA', { timeZone: HST }) === new Date().toLocaleDateString('en-CA', { timeZone: HST })
    ? 'today' : new Date(inf.h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : '';
  const on = picked.has(b.id), name = nick(b), full = plainSum(b, 300), open = S.stWhat.has(b.id), tid = 'st-w-' + String(b.id).replace(/\W/g, '');
  return `<li class="st-pcard${on ? ' on' : ''}${open ? ' st-open' : ''}">
    <button type="button" class="st-pick" data-stpick="${esc(b.id)}" aria-pressed="${on}">
      <span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="st-pbody">
        <span class="st-ptop">${iss ? `<span class="issueline">${icon(iss.icon)}<span>${esc(iss.key)}</span></span>` : '<span></span>'}${day ? chip(`Hearing ${day}`, 'info', 'calendar') : ''}</span>
        ${name ? `<span class="st-phead">${esc(name)}</span><span class="st-pwhat st-clamp" id="${tid}">${esc(full)}</span>`
          : `<span class="st-phead st-clamp" id="${tid}">${esc(full)}</span>`}
        <span class="st-pmeta"><span>${esc(spaced(b.bill_number))}</span>${posChip(b)}</span>
      </span></button>
    <button type="button" class="st-what" data-stwhat="${esc(b.id)}" aria-expanded="${open}" aria-controls="${tid}" hidden><span>What it does<span class="sr">: ${esc(spaced(b.bill_number))}</span></span>${icon('chevron-down')}</button></li>`;
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
function tickPhrase(first, R) {
  const t = Math.min(3, first.length), k = first.slice(0, 3).filter(b => R.info(b).h).length;
  if (!t) return '';
  if (k === t) return t === 1 ? 'The one with a hearing coming up is checked.' : `The ${t} with hearings soonest are checked.`;
  if (k) return `The ${k === 1 ? 'one' : k} with ${k === 1 ? 'a hearing' : 'hearings'} coming up ${k === 1 ? 'is' : 'are'} checked, plus ${t - k === 1 ? 'HIPHI’s top pick' : `${t - k} of HIPHI’s top picks`}.`;
  return t === 1 ? 'HIPHI’s top pick is checked.' : `HIPHI’s top ${t} are checked.`;
}
const skel = (step, off) => shell('', `${artFor(step, off)}${stepRow(step, off)}<p class="sr" role="status">Finding HIPHI’s picks for you</p>
  <div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:64px"></div>`, '<div class="skel" style="height:128px"></div>'.repeat(3), true);
const loadErr = (step, off) => shell('', `${artFor(step, off)}${stepRow(step, off)}`, `<div class="empty st-err"><h1 class="st-errh" id="st-h">We couldn’t load the bills</h1><p>Check your connection and try again.</p></div>`);
function step2() {
  const m = model2();
  if (m.none) return skel(2, false);
  if (m.loading) { load2(m.sig, m.sel, false); return skel(2, false); }
  if (m.err) return loadErr(2, false);
  const { sel, first, fallback, empty, extras, picked, R } = m, w = wiz();
  const opened = w.ready && !S.watch.size;   // picked issues off-season; the session has opened since
  const n = first.length, ticks = tickPhrase(first, R), saved = `We saved your ${empty.length === 1 ? 'pick' : 'picks'}`;
  let h1, lede;
  if (fallback && n) { h1 = n === 1 ? 'Start with this bill' : `Start with these ${n} bills`;
    lede = `Nothing is moving on ${namesHtml(empty)} right now. ${saved}. Meanwhile, HIPHI is working on ${n === 1 ? 'this bill' : 'these bills'} this week.`; }
  else if (fallback) { h1 = 'Nothing is moving yet';
    lede = `There are no bills moving on ${namesHtml(empty)} right now. ${saved}, and your page will show bills as soon as they start moving.`; }
  else if (opened) { h1 = 'The session is open!'; lede = `Here are HIPHI’s picks for ${issuesPhrase(sel)}. ${n === 1 ? 'It’s checked for you.' : `${ticks} Uncheck any you don’t want.`}`; }
  // One bill: there is nothing to uncheck "any" of (assessment, 9/19).
  else if (n === 1) { h1 = 'Start with this bill'; lede = `HIPHI picked it for ${issuesPhrase(sel)}. It’s checked for you.`; }
  else { h1 = `Start with these ${n} bills`; lede = `HIPHI picked them for ${issuesPhrase(sel)}. ${ticks} Uncheck any you don’t want.`; }
  const more = extras.filter(x => x.shown.length).map(x => `<h2 class="st-subh">More ${esc(x.i.key)} bills</h2>
    <ul class="st-picks" role="list">${x.shown.map(b => pickCard(b, R, picked)).join('')}</ul>`).join('');
  const moreBtns = fallback ? '' : extras.filter(x => x.left > 0).map(x => btn(`More ${esc(x.i.key)} bills (${x.left})`, { kind: 'text', icon: 'plus', attrs: { 'data-stmore': x.i.key } })).join('');
  return shell('st2', `${artFor(2, false)}${stepRow(2, false)}
    <h1 class="hero" id="st-h">${h1}</h1>
    <p class="lede">${lede}</p>${n ? sureWide('info', SURE2) : ''}`,
    `${n ? `${sayRow('info', SURE2)}<ul class="st-picks" role="list" aria-labelledby="st-h">${first.map(b => pickCard(b, R, picked)).join('')}</ul>` : ''}
    ${more}
    ${moreBtns ? `<div class="st-more">${moreBtns}</div>` : ''}
    ${!fallback && empty.length ? `<p class="note">${icon('info')}<span>Nothing is moving on ${namesHtml(empty)} right now. ${saved}.</span></p>` : ''}`);
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
function standCard(b) {
  const mine = myStance(b.id), name = nick(b), hid = 'st-s-' + String(b.id).replace(/\W/g, '');
  return `<li class="card st-stand">
    <div class="st-sbody"><h2 class="st-shead" id="${hid}">${esc(name || plainSum(b, 110))}</h2>
      <p class="st-smeta"><span>${esc(spaced(b.bill_number))}</span>${posChip(b)}${S.stMile === b.id && (mine === 'support' || mine === 'oppose') ? mileChip() : ''}</p></div>
    <div class="st-chips" role="group" aria-labelledby="${hid}">${STANCES.map(([v, label, ic]) =>
      `<button type="button" class="chip" data-ststance="${esc(b.id)}|${v}" aria-pressed="${mine === v}">${ic ? icon(ic) : ''}${label}</button>`).join('')}</div></li>`;
}
function step3() {
  const bills = followedBills(), n = bills.length;
  if (!n) return skel(3, false);
  return shell('st3', `${artFor(3, false)}${stepRow(3, false)}
    <p class="st-ok" role="status">${icon('circle-check')}<span>You’re following ${plural(n, 'bill')}. Mahalo!</span></p>
    <h1 class="hero" id="st-h">Where do you stand?</h1>
    <p class="lede">Optional, and private: we never show your answer publicly. It helps us suggest the right ways to help later, and you can change it any time.</p>`,
    `<ul class="st-stands" role="list" aria-labelledby="st-h">${bills.map(standCard).join('')}</ul>
    <p class="sr" role="status" id="st-live"></p>`);
}

// ================= Step 4 (in session) and step 3 (off-season): the email step =================
// S.stMail: this visit's email step. The typed address survives a trip to the privacy page and back.
S.stMail ??= { email: '', sent: '', demo: false };
const SMALL_PRINT = 'No password: we email you a link to confirm. Unsubscribe any time. HIPHI staff can see the bills that signed-in people follow.';
function emailCard() {
  const M = S.stMail;
  // A real link was sent earlier in this visit (core notes the address): a reload still says "check your inbox".
  if (!M.sent) { try { M.sent = sessionStorage.getItem('hiphi_link_sent') || ''; } catch { /* ignore */ } }
  if (M.sent) return `<section class="card st-sent" aria-labelledby="st-sent-t">
    <span class="st-ilead">${icon('mail-check')}</span>
    <div class="st-sentbody"><h2 id="st-sent-t" tabindex="-1">Check your inbox at <span class="st-break">${esc(M.sent)}</span></h2>
      <p>Open the link on this device and your bills come with you. Hearing alerts start once you do.</p>
      <p class="small muted">${M.demo ? 'This is the sandbox, so nothing was sent.' : 'It can take a minute. If you don’t see it, check your spam folder.'}</p>
      <div class="st-formbtns">${btn('Go to my page', { kind: 'primary', iconEnd: 'arrow-right', attrs: { 'data-stdone': '1' } })}${btn('Use a different email', { kind: 'text', attrs: { 'data-stother': '1' } })}</div></div>
  </section>`;
  return `<form class="card st-form" id="st-eform" novalidate>
    <div class="field"><label for="st-email">Your email</label>
      <input id="st-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="name@example.com" value="${esc(M.email)}">
      <span class="err" id="st-email-err" role="alert"></span></div>
    <div class="st-formbtns">${btn('Send me alerts', { kind: 'primary', icon: 'bell', attrs: { type: 'submit', id: 'st-send' } })}${btn('Skip for now', { kind: 'text', attrs: { 'data-stdone': '1' } })}</div>
    <p class="meta">${SMALL_PRINT} <a href="#/privacy">Read about privacy</a></p>
  </form>`;
}
function step4() {
  const n = S.watch.size;
  return shell('st4', `${artFor(4, false)}${stepRow(4, false)}
    <h1 class="hero" id="st-h">Want a heads-up when a hearing is set?</h1>
    <p class="lede">Hearings are posted about two days ahead. Add your email and we’ll tell you in time when ${n === 1 ? 'your bill has' : `one of your ${n} bills has`} one. It also keeps your bills on any device.</p>`,
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
  // Good news first: the issues with the most bills that became law, then the busiest.
  const lawsOn = i => L.rows.filter(b => b.stage === 'enacted' && hasPos(b) && (b.coalitions || []).some(n => i.names.includes(n))).length;
  const order = sel.slice().sort((a, b) => lawsOn(b) - lawsOn(a) || (b.bills || 0) - (a.bills || 0));
  const cards = order.map(i => {
    const rows = L.rows.filter(b => hasPos(b) && (b.coalitions || []).some(n => i.names.includes(n)) && (!b.session_year || +b.session_year === yr));
    const laws = rows.filter(b => b.stage === 'enacted').sort((a, b) => (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9));
    const far = rows.filter(b => b.stage !== 'enacted').sort((a, b) => reach(b) - reach(a) || (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9));
    const show = [...laws, ...far].slice(0, 2);
    const worked = Math.max(i.bills || 0, rows.length);
    const said = `HIPHI worked on ${plural(worked, 'bill')} on this issue in ${yr}. ${laws.length ? `${laws.length === 1 ? 'One' : laws.length} became law.` : show.length ? `None became law this time. ${show.length === 1 ? 'This one' : 'These'} went furthest:` : ''}`;
    // A published HIPHI list with bills on this issue (each list offered once).
    const list = (S.lists || []).find(l => !used.has(l.slug) && (S.listBills[l.slug] || []).some(x => (x.b.coalitions || []).some(n => i.names.includes(n))));
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
  return shell('st2 st-off', `${artFor(2, true)}${stepRow(2, true)}
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
    : `<h1 class="hero" id="st-h">Want a heads-up when your bills have a hearing?</h1>
      <p class="lede">Add your email now and you’re set for ${nextYr}: when a bill you follow has a hearing, we’ll tell you in time. It also keeps your bills and lists on any device.</p>`;
  return shell('st3 st-off', `${artFor(3, true)}${stepRow(3, true)}${saved}${intro}`,
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
  const picked = pickedIssues().length > 0;
  if (off) return step > 3 ? 3 : step >= 2 && !picked ? 1 : 0;
  if (step === 2) return picked ? 0 : 1;
  if (step === 3) return S.watch.size ? 0 : picked ? 2 : 1;
  if (step === 4) return S.session ? 'home' : S.watch.size ? 0 : picked ? 2 : 1;
  return 0;
}

function wire(route) {
  const step = route.step || 1, off = isOff();
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  const to = redirectFor(step, off);
  if (to) { setTimeout(() => (to === 'home' ? finish() : app.go('#/start/' + to, { replace: true })), 0); return; }
  if (wiz().step !== step) wizSet({ step });

  $$('[data-stskip]').forEach(el => el.onclick = skipAll);
  $$('[data-stback]').forEach(el => el.onclick = () => goBack(+el.dataset.stback));
  $$('[data-stretry]').forEach(el => el.onclick = () => { S.stLoad = null; app.render(); });
  $$('[data-stdone]').forEach(el => el.onclick = finish);
  // "Find my legislators" leaves the start for good; the link itself does the navigating.
  $$('[data-stready]').forEach(el => el.addEventListener('click', () => { wizSet({ done: true, step: 1, ready: sessionInfo().nextOpen }); welcome(); }));

  if (step === 1) {
    $$('[data-stissue]').forEach(el => el.onclick = () => {
      const on = toggleTick(el), set = new Set(wiz().issues || []), name = el.dataset.stissue;
      // Store the coalition's first name; drop any other spelling of the same issue (its public name, a sibling).
      const iss = issues().find(i => i.names.includes(name));
      (iss ? [iss.key, ...iss.names] : [name]).forEach(n => set.delete(n));
      if (on) set.add(name);
      wizSet({ issues: [...set] }); clearFlash();
    });
    const next = $('[data-stnext]');
    if (next) next.onclick = () => {
      if (!pickedIssues().length) { flash('Pick at least one issue, or select Skip.'); return; }
      goStep(1, 2);
    };
  }

  if (step === 2 && !off) {
    const m = model2();
    $$('[data-stpick]').forEach(el => el.onclick = () => {
      const on = toggleTick(el), w = wiz(), set = new Set(w.picksFor === m.sig ? (w.picks || []) : []);
      if (on) set.add(el.dataset.stpick); else set.delete(el.dataset.stpick);
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
    $$('[data-stmore]').forEach(el => el.onclick = () => {
      const w = wiz(), more = { ...((w.moreFor === m.sig && w.more) || {}) }, k = el.dataset.stmore;
      const before = new Set([...document.querySelectorAll('[data-stpick]')].map(x => x.dataset.stpick));
      more[k] = (more[k] || 0) + 1; wizSet({ moreFor: m.sig, more });
      app.render();
      // Keep keyboard and screen-reader users where the new cards start.
      const added = [...document.querySelectorAll('[data-stpick]')].find(x => !before.has(x.dataset.stpick));
      if (added) { added.focus({ preventScroll: true }); added.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); }
    });
    const next = $('[data-stnext]');
    if (next) next.onclick = async () => {
      if (m.loading || m.err || m.none) return;
      const w = wiz(), ids = w.picksFor === m.sig ? (w.picks || []) : [];
      if (!ids.length) { flash('Check at least one bill, or select Skip.'); return; }
      if (next.getAttribute('aria-busy') === 'true') return;
      busy(next, 'Following…');
      await followIds(ids, (w.followed || []).filter(id => !ids.includes(id)));
      // done: Home stops sending them back here even if they later unfollow everything. ready: the off-season promise is kept.
      wizSet({ step: 3, done: true, ready: null, followed: ids });
      welcome();
      goStep(2, 3);
    };
  }

  if (step === 2 && off) {
    $$('[data-stlist]').forEach(el => el.onclick = async () => {
      if (el.getAttribute('aria-busy') === 'true') return;
      const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-busy', 'true'); busy(el.querySelector('.st-ilead'), '');
      await followList(el.dataset.stlist, on);
      // The row itself now says what happened. Between sessions core's toast would cheer "Following 0 bills" on top of it.
      const t = document.getElementById('toast'); if (t) t.innerHTML = '';
    });
    const next = $('[data-stnext]'); if (next) next.onclick = () => goStep(2, 3);
  }

  if (step === 3 && !off) {
    $$('[data-ststance]').forEach(el => el.onclick = () => {
      const [id, v] = el.dataset.ststance.split('|'), had = tookStand(), now = myStance(id) === v ? null : v;
      Promise.resolve(setStance(id, now)).catch(e => toast(e, true));
      // In place, so focus stays on the chip: the one selected, its neighbours cleared; the same chip again clears it.
      const card = el.closest('.st-stand');
      card.querySelectorAll('[data-ststance]').forEach(c => c.setAttribute('aria-pressed', String(!!now && c === el)));
      // The chip marks the card where the first stand was taken, for as long as that card keeps a stand.
      const live = document.getElementById('st-live');
      if (!had && tookStand()) {
        S.stMile = id; card.querySelector('.st-smeta')?.insertAdjacentHTML('beforeend', mileChip());
        if (live) live.textContent = 'Milestone: you took a stand.';
      } else if (S.stMile && !['support', 'oppose'].includes(myStance(S.stMile))) {
        S.stMile = null; document.querySelector('.st-mile')?.remove(); if (live) live.textContent = '';
      }
    });
    const next = $('[data-stnext]'); if (next) next.onclick = () => (S.session ? finish() : goStep(3, 4));
  }

  // The email step (in session step 4, off-season step 3). It is this visit's one email ask, so Home will not ask again.
  const form = $('#st-eform'), sentCard = $('.st-sent');
  if (form || sentCard) { S.nudge = null; S.nudgedThisVisit = true; }
  if (form) {
    const inp = form.querySelector('#st-email'), err = form.querySelector('#st-email-err'), send = form.querySelector('#st-send');
    const showErr = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'st-email-err'); err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; };
    inp.oninput = () => { S.stMail.email = inp.value; if (err.innerHTML) { err.innerHTML = ''; inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); } };
    form.onsubmit = async e => {
      e.preventDefault();
      if (send.getAttribute('aria-busy') === 'true') return;
      const email = inp.value.trim();
      // Checked only now, never while typing.
      if (!validEmail(email)) { showErr(email ? 'That doesn’t look like an email. Try one like name@example.com.' : 'Enter your email, or select Skip for now.'); inp.focus(); return; }
      const label = send.innerHTML; busy(send, 'Sending…');
      try {
        const r = await sendEmailLink(email, { hearing_alerts: true });
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

const TITLES = { in: ['Pick your issues', 'Pick your bills', 'Where do you stand?', 'Get a heads-up'], off: ['Get ready', 'What happened', 'Get a heads-up'] };
export default {
  tab: 'home',
  tabs: false,
  title: route => { const t = TITLES[isOff() ? 'off' : 'in']; return t[Math.min(route.step || 1, t.length) - 1]; },
  render(route) {
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return skel(Math.min(step, total(off)), off);   // wire() sends them on
    if (step === 1) return step1();
    if (step === 2) return off ? step2off() : step2();
    if (step === 3) return off ? step3off() : step3();
    return step4();
  },
  wire,
  bar(route) {
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return '';
    if (step === 1) return bar2(off ? 'Next' : 'Show me bills', { iconEnd: 'arrow-right' });
    if (off && step === 2) { const L = S.stLoad, sig = sigOf(true, pickedIssues()); return L && L.sig === sig && L.err ? barRetry() : bar2('Next', { iconEnd: 'arrow-right' }); }
    if (off) return S.session ? bar1('Go to my page') : '';
    if (step === 2) {
      const m = model2();
      if (m.err) return barRetry();
      if (m.loading || m.none) return barBusy();
      if (m.fallback && !m.first.length) return bar1('Go to my page');
      return bar2(followLabel(m.picked.size), { icon: 'star' });
    }
    if (step === 3) return bar2(S.session ? 'Go to my page' : 'Next', { iconEnd: 'arrow-right' });
    return '';   // the email step holds its own buttons, next to the field
  },
};
