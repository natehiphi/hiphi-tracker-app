// The guided start (plan section 3): three short steps from "what do you care about?" to a real five-minute action.
//   In session:   S1 pick issues -> S2 follow a few bills -> S3 one focused action card (4 taps to the testimony helper).
//   Off-season:   O1 pick issues -> O2 what happened on them last session -> O3 two things to do before January.
// Routes are #/start/1|2|3 and every step pushes history, so the phone's Back button walks the steps. The step and
// the picks live in hiphi_wiz (wiz()/wizSet()), so a reload resumes where the person left off. No tab bar here; the
// sticky bottom bar holds one Skip and the one primary button, which is never disabled (tapping it with nothing
// picked says why, inline). The after-follows email ask never shows here: it waits for Home.
import { S, DEMO, app, esc, icon, blurb, spaced, alive, issues, countOk, sessionInfo, billsForCoalitions, openActions,
  actedOn, didKind, recommendations, loadBills, saveLocal, wiz, wizSet, nudge, followList, listBillsFor, HST } from './core.js';
import { btn, chip, steps } from './ui.js';
import { actionCard, wireActions } from './actions.js';
import { CAPITOL, VOICES } from './art.js';

const isOff = () => sessionInfo().phase !== 'in';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const num = n => Number(n).toLocaleString('en-US');
// "Healthy Eating, Active Living" reads as two issues inside a sentence; the first part is the name people know.
const short = key => String(key).split(',')[0].trim();
const andList = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const issuesPhrase = sel => sel.length > 2 ? `your ${sel.length} issues` : andList(sel.map(i => short(i.key)));
const actKey = x => `${x.b.id}|${x.h.id}`;
const reduce = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// The live page (track.js) keeps the same hiphi_wiz key and stores a coalition's first internal name, so we do too.
const pickedIssues = () => { const sel = new Set(wiz().issues || []); return issues().filter(i => sel.has(i.key) || i.names.some(n => sel.has(n))); };
// "Wednesday, January 20" for a Hawaiʻi calendar day
const longDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
// A plain headline even when a bill has no HIPHI summary: never lead with the official "Relating to…" title.
const headline = (b, n = 100) => { const t = blurb(b, n); return /^relating to\s/i.test(t) ? 'A bill about ' + t.replace(/^relating to\s+/i, '') : t; };
const POS_SAYS = { strongly_support: 'HIPHI supports it', support: 'HIPHI supports it', support_amend: 'HIPHI supports it with changes',
  strongly_oppose: 'HIPHI opposes it', oppose: 'HIPHI opposes it', neutral: 'HIPHI has comments' };
const POS_W = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
const hasPos = b => b.hiphi_position && b.hiphi_position !== 'monitor';

// ---------- history: forward steps are tagged, so the on-screen Back can use the real Back when it is safe ----------
function goStep(from, to) {
  app.go('#/start/' + to);
  try { history.replaceState({ ...(history.state || {}), stFrom: from }, ''); } catch { /* ignore */ }
}
function goBack(step) {
  // A person who resumed straight onto step 2 has no step 1 behind them; history.back() would leave the site.
  if (history.state?.stFrom === step - 1) history.back(); else app.go('#/start/' + (step - 1));
}
// Leaving the guided start for Home. "done" means it was finished (Home stops offering it); "skipped" that it was
// skipped. Off-season we also note when the next session opens, so the start can greet them with picks then.
function leave(patch) {
  wizSet(patch);
  if (S.watch.size && !S.done.size) nudge('follow');   // the after-follows email ask belongs on Home, under card 1
  app.go('#/');
}

// ---------- the bar: one Skip, one primary ----------
const bar2 = (label, opt = {}) => `<div class="st-bar"><p class="st-alert" id="st-alert" role="alert"></p><div class="st-btns">
  ${btn('Skip', { kind: 'text', attrs: { 'data-stskip': '1' } })}${btn(label, { kind: 'primary', ...opt, attrs: { 'data-stnext': '1' } })}</div></div>`;
const bar1 = (label, kind = 'text') => `<div class="st-bar st-one">${btn(label, { kind, full: kind === 'primary', attrs: { 'data-stlater': '1' } })}</div>`;
const followLabel = n => n ? `Follow ${plural(n, 'bill')}` : 'Follow bills';

// ================= S1 / O1: welcome and issues =================
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
      <span class="st-ibody"><span class="st-iname">${esc(i.key)}</span>${i.description ? `<span class="st-idesc">${esc(i.description)}</span>` : ''}${extra}</span>
      <span class="st-tick" aria-hidden="true">${icon('check')}</span></button>`;
  }).join('')}</div>`;
}
function step1() {
  const si = sessionInfo(), off = si.phase !== 'in', yr = off ? si.recapYear : si.yr, t = (S.totals || {})[yr] || {};
  const people = countOk(t.people);
  const acts = num(t.actions || 0);
  // Kept to one line on a phone: the first screen has to fit four issues above the button.
  const proof = people ? (off ? `In ${yr}, ${num(people)} people spoke up ${acts} times with HIPHI.` : `${num(people)} people have spoken up ${acts} times this session.`) : '';
  const next = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1;
  return `<div class="st st1">
    <div class="st-art">${CAPITOL}</div>
    <div class="steps st-steps">${steps(1, 3)}</div>
    <h1 id="st-h">${off ? `Get ready for the ${next} session` : 'Speak up for a healthier Hawaiʻi'}</h1>
    <p class="lede">${off ? `The Legislature is on break until ${esc(longDay(si.nextOpen))}. Pick the issues you care about, and we’ll line up HIPHI’s bills when hearings start.`
      : 'Pick the issues you care about. We’ll show you a few bills and one easy way to help this week. No account needed.'}</p>
    ${proof ? `<p class="st-proof">${icon('users')}<span>${proof}</span></p>` : ''}
    ${issueRows(off, yr)}
  </div>`;
}

// ================= S2: a few bills to follow =================
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
function pickCard(b, R, picked) {
  const inf = R.info(b), iss = issues().find(i => (b.coalitions || []).some(n => i.names.includes(n)));
  const within8 = inf.h && new Date(inf.h.scheduled_at) - Date.now() < 8 * 864e5;
  const day = within8 ? new Date(inf.h.scheduled_at).toLocaleDateString('en-CA', { timeZone: HST }) === new Date().toLocaleDateString('en-CA', { timeZone: HST })
    ? 'today' : new Date(inf.h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : '';
  const on = picked.has(b.id);
  return `<li><button type="button" class="st-pick" data-stpick="${esc(b.id)}" aria-pressed="${on}">
    <span class="st-tick" aria-hidden="true">${icon('check')}</span>
    <span class="st-pbody">
      <span class="st-ptop">${iss ? `<span class="issueline">${icon(iss.icon)}<span>${esc(short(iss.key))}</span></span>` : '<span></span>'}${day ? chip(`Hearing ${day}`, 'info', 'calendar') : ''}</span>
      <span class="st-phead">${esc(headline(b))}</span>
      <span class="st-pmeta">${esc(spaced(b.bill_number))} · ${esc(POS_SAYS[b.hiphi_position] || 'HIPHI is watching it')}</span>
    </span></button></li>`;
}
function tickPhrase(first, R) {
  const t = Math.min(3, first.length), k = first.slice(0, 3).filter(b => R.info(b).h).length;
  if (!t) return '';
  if (k === t) return t === 1 ? 'The one with a hearing coming up is checked.' : `The ${t} with hearings soonest are checked.`;
  if (k) return `The ${k === 1 ? 'one' : k} with ${k === 1 ? 'a hearing' : 'hearings'} coming up ${k === 1 ? 'is' : 'are'} checked, plus ${t - k === 1 ? 'HIPHI’s top pick' : `${t - k} of HIPHI’s top picks`}.`;
  return t === 1 ? 'HIPHI’s top pick is checked.' : `HIPHI’s top ${t} are checked.`;
}
const backBtn = step => btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stback': String(step) } });
const skel = step => `<div class="st" aria-busy="true"><div class="steps st-steps">${backBtn(step)}${steps(step, 3)}</div>
  <p class="sr" role="status">Finding HIPHI’s picks for you</p>
  <div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:64px"></div>
  ${'<div class="skel" style="height:128px"></div>'.repeat(3)}</div>`;
const loadErr = step => `<div class="st"><div class="steps st-steps">${backBtn(step)}${steps(step, 3)}</div>
  <div class="empty"><h2>We couldn’t load the bills</h2><p>Check your connection and try again.</p>${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-stretry': '1' } })}</div></div>`;
function step2() {
  const m = model2();
  if (m.none) return skel(2);
  if (m.loading) { load2(m.sig, m.sel, false); return skel(2); }
  if (m.err) return loadErr(2);
  const { sel, first, fallback, empty, extras, picked, R } = m, w = wiz();
  const opened = w.ready && !S.watch.size;   // picked issues off-season; the session has opened since
  const n = first.length, ticks = tickPhrase(first, R);
  const emptyNames = andList(empty.map(i => short(i.key)));
  let h1, lede;
  if (fallback && n) { h1 = n === 1 ? 'Start with this bill' : `Start with these ${n} bills`;
    lede = `Nothing is moving on ${esc(emptyNames)} right now. We saved your ${empty.length === 1 ? 'pick' : 'picks'}. Meanwhile, ${n === 1 ? 'this bill needs' : 'these bills need'} voices this week:`; }
  else if (fallback) { h1 = 'Nothing is moving yet';
    lede = `There are no bills moving on ${esc(emptyNames)} right now. We saved your ${empty.length === 1 ? 'pick' : 'picks'}, and your page will show bills as soon as they start moving.`; }
  else if (opened) { h1 = 'The session is open!'; lede = `Here are HIPHI’s picks for ${esc(issuesPhrase(sel))}. ${ticks} Uncheck any you don’t want.`; }
  else { h1 = n === 1 ? 'Start with this bill' : `Start with these ${n} bills`;
    lede = `HIPHI picked ${n === 1 ? 'it' : 'them'} for ${esc(issuesPhrase(sel))}. ${ticks} Uncheck any you don’t want. You can change this any time.`; }
  const more = extras.filter(x => x.shown.length).map(x => `<h2 class="st-subh">More ${esc(short(x.i.key))} bills</h2>
    <ul class="st-picks" role="list">${x.shown.map(b => pickCard(b, R, picked)).join('')}</ul>`).join('');
  const moreBtns = fallback ? '' : extras.filter(x => x.left > 0).map(x => btn(`More ${esc(short(x.i.key))} bills (${x.left})`, { kind: 'text', icon: 'plus', attrs: { 'data-stmore': x.i.key } })).join('');
  return `<div class="st st2">
    <div class="steps st-steps">${backBtn(2)}${steps(2, 3)}</div>
    <h1 id="st-h">${h1}</h1>
    <p class="lede">${lede}</p>
    ${n ? `<ul class="st-picks" role="list" aria-labelledby="st-h">${first.map(b => pickCard(b, R, picked)).join('')}</ul>` : ''}
    ${more}
    ${moreBtns ? `<div class="st-more">${moreBtns}</div>` : ''}
    ${!fallback && empty.length ? `<p class="note">${icon('info')}<span>Nothing is moving on ${esc(emptyNames)} right now. We saved your ${empty.length === 1 ? 'pick' : 'picks'}.</span></p>` : ''}
  </div>`;
}

// ================= S3: the first action =================
// Which card to show: the soonest open action among the bills just followed (kept once chosen, so it stays put
// after they act); else one pool bill that needs voices soon; else nothing is open anywhere.
function plan3() {
  const w = wiz();
  let ids = (w.followed || []).filter(id => S.watch.has(id)); if (!ids.length) ids = [...S.watch];
  const mine = openActions(S.bills.filter(b => ids.includes(b.id)), S.hearings);
  let a = (w.focus && mine.find(x => actKey(x) === w.focus)) || mine.find(x => !x.late && !actedOn(x.b, x.h)) || mine.find(x => !actedOn(x.b, x.h));
  if (a) return { kind: 'mine', a, ids, done: actedOn(a.b, a.h) };
  const pool = S.pool ? openActions((S.pool.bills || []).filter(b => !S.watch.has(b.id)), S.pool.hearings || []).find(x => !x.late) : null;
  if (pool) return { kind: 'pool', a: pool, ids, done: false };
  return { kind: 'none', ids, done: false };
}
function step3() {
  const p = plan3(), n = p.ids.length;
  const ok = n ? `<p class="st-ok" role="status">${icon('circle-check')}<span>You’re following ${plural(n, 'bill')}. Mahalo!</span></p>` : '';
  const head = `<div class="steps st-steps">${steps(3, 3)}</div>${ok}`;
  if (p.kind === 'none') return `<div class="st st3">${head}
    <div class="st-art st-voices">${VOICES}</div>
    <h1 id="st-h">You’re all set</h1>
    <p class="lede">${n ? `Your ${n === 1 ? 'bill is waiting for a hearing' : 'bills are waiting for hearings'}.` : 'No bills have hearings coming up yet.'} Your first action will show up on your page the moment one is scheduled.</p></div>`;
  const { b, h, late } = p.a;
  // They acted (the helper closed back onto this step): thank them once, keep the card in its done state.
  if (p.done) return `<div class="st st3"><div class="steps st-steps">${steps(3, 3)}</div>
    <div class="st-art st-voices">${VOICES}</div>
    <h1 id="st-h">Mahalo for speaking up!</h1>
    <p class="lede">${didKind(b, h, 'testimony') ? `Your testimony on ${esc(spaced(b.bill_number))} is in.` : `You took your first action on ${esc(spaced(b.bill_number))}.`} Your page keeps your bills in one place and shows you when there’s something new to do.</p>
    ${actionCard(b, h, { heading: 'h2' })}</div>`;
  const firstTime = !late && ![...S.done].some(k => k.endsWith('|testimony'));
  const soon = h.testimony_deadline && new Date(h.testimony_deadline) - Date.now() < 7 * 864e5 ? 'this week' : 'soon';
  const lede = p.kind === 'pool' ? `${n ? 'None of your bills has a hearing yet. ' : ''}This one needs voices ${soon}:`
    : late ? 'The deadline for written testimony has passed, but the hearing hasn’t happened yet. A short email to the chair is the quickest way to be heard.'
    : 'Testimony is a short letter to the committee that votes on a bill. Anyone in Hawaiʻi can send one. We’ll write most of it with you.';
  let card = actionCard(b, h, { focus: true, heading: 'h2' });
  // A bill they don't follow yet: the one button follows it and opens the letter (wired below).
  if (p.kind === 'pool') card = card.replace('<span>Write my testimony · 5 min</span>', '<span>Follow and write testimony</span>');
  return `<div class="st st3">${head}
    <h1 id="st-h">${late ? 'Your first 2-minute action' : 'Your first 5-minute action'}</h1>
    <p class="lede">${lede}</p>
    <div class="st-card" data-stpool="${p.kind === 'pool' ? esc(actKey(p.a)) : ''}">${card}</div>
    ${firstTime ? `<p class="note">${icon('info')}<span>First time? The Capitol website asks you to make a free account. That takes about 5 more minutes, once.</span></p>` : ''}
  </div>`;
}

// ================= O2: what happened last session =================
const ORDER = ['introduced', 'first_triple', 'first_lateral', 'first_decking', 'first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'second_crossover', 'conference', 'governor', 'enacted'];
const reach = b => b.stage === 'enacted' ? 99 : b.stage === 'dead' ? ORDER.indexOf(b.died_at_stage || '') : ORDER.indexOf(b.stage || '');
function recapRow(b) {
  const law = b.stage === 'enacted', gov = b.stage === 'governor';
  return `<li class="st-rrow"><span class="st-rhead">${esc(headline(b, 90))}</span>
    <span class="st-rmeta"><span>${esc(spaced(b.bill_number))}</span>${law ? chip('Became law', 'ok', 'circle-check') : gov ? chip('On the Governor’s desk', 'info', 'landmark') : chip('Stopped this session', '', 'archive')}</span></li>`;
}
function step2off() {
  const si = sessionInfo(), yr = si.recapYear, sel = pickedIssues(), sig = sigOf(true, sel), L = S.stLoad;
  if (!sel.length) return skel(2);
  if (!L || L.sig !== sig || (!L.rows && !L.err)) { load2(sig, sel, true); return skel(2); }
  if (L.err) return loadErr(2);
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
    const said = `HIPHI worked on ${plural(worked, `${short(i.key)} bill`)} in ${yr}. ${laws.length ? `${laws.length === 1 ? 'One' : laws.length} became law.` : show.length ? `None became law this time. ${show.length === 1 ? 'This one' : 'These'} went furthest:` : ''}`;
    // A published HIPHI list with bills on this issue (each list offered once).
    const list = (S.lists || []).find(l => !used.has(l.slug) && (S.listBills[l.slug] || []).some(x => (x.b.coalitions || []).some(n => i.names.includes(n))));
    if (list) used.add(list.slug);
    const following = list && S.listFollows.has(list.id);
    return `<section class="card st-recap" aria-labelledby="st-r-${esc(i.names[0]).replace(/\W/g, '')}">
      <h2 id="st-r-${esc(i.names[0]).replace(/\W/g, '')}"><span class="st-ilead">${icon(i.icon)}</span>${esc(i.key)}</h2>
      <p>${esc(said)}</p>
      ${show.length ? `<ul class="st-rrows" role="list">${show.map(recapRow).join('')}</ul>` : ''}
      ${list ? `<button type="button" class="st-list" data-stlist="${esc(list.slug)}" aria-pressed="${!!following}">
        <span class="st-ilead">${icon(following ? 'check' : 'list-checks')}</span>
        <span class="st-ibody"><span class="st-iname">${following ? `Following “${esc(list.title)}”` : `Follow HIPHI’s “${esc(list.title)}” list`}</span>
        <span class="st-idesc">New bills HIPHI adds to it will show up on your page.</span></span></button>` : ''}
    </section>`;
  }).join('');
  return `<div class="st st2 st-off">
    <div class="steps st-steps">${backBtn(2)}${steps(2, 3)}</div>
    <h1 id="st-h">What happened in ${yr}</h1>
    <p class="lede">Here’s how HIPHI’s bills did on the ${sel.length === 1 ? 'issue' : 'issues'} you picked.</p>
    ${cards}
  </div>`;
}

// ================= O3: be ready in January =================
function step3off() {
  const si = sessionInfo(), nextYr = si.nextOpen ? +si.nextOpen.slice(0, 4) : si.yr + 1;
  return `<div class="st st3 st-off">
    <div class="steps st-steps">${backBtn(3)}${steps(3, 3)}</div>
    <h1 id="st-h">Be ready in January</h1>
    <p class="lede">Two quick things now make it easy to speak up when the ${nextYr} session opens on ${esc(longDay(si.nextOpen))}.</p>
    <section class="card st-ready st-main" aria-labelledby="st-leg">
      <span class="st-ilead">${icon('landmark')}</span>
      <div class="st-rbody"><h2 id="st-leg">Find your legislators</h2><p>The senator and representative who work for you. Takes 30 seconds.</p>
      ${btn('Find my legislators', { kind: 'primary', icon: 'map-pin', href: '#/legislators', attrs: { 'data-stready': '1' } })}</div>
    </section>
    ${S.session ? '' : `<section class="card st-ready" aria-labelledby="st-save">
      <span class="st-ilead">${icon('mail')}</span>
      <div class="st-rbody"><h2 id="st-save">Save my picks with my email</h2><p>Keep them on any phone. No password.</p>
      ${DEMO ? '<p class="small muted">Sign-in is off in the sandbox.</p>' : btn('Save my picks', { kind: 'secondary', href: '#/signin', attrs: { 'data-stready': '1' } })}</div>
    </section>`}
  </div>`;
}

// ================= wiring =================
function flash(text) {
  const el = document.getElementById('st-alert'); if (!el) return;
  el.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`;
}
const clearFlash = () => { const el = document.getElementById('st-alert'); if (el) el.innerHTML = ''; };
function toggleTick(el) {
  const on = el.getAttribute('aria-pressed') !== 'true';
  el.setAttribute('aria-pressed', String(on));
  const t = el.querySelector('.st-tick'); if (t && on && !reduce()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
  return on;
}
async function followIds(ids) {
  const fresh = ids.filter(id => !S.watch.has(id));
  ids.forEach(id => S.watch.add(id)); saveLocal();
  // Signed in: the account's watchlist too (a failure heals itself: the next sign-in adds what this device follows).
  if (S.user && !DEMO && fresh.length) { try { const r = await S.supa.from('watchlist').insert(fresh.map(bill_id => ({ user_id: S.user.id, bill_id }))); if (r.error) console.error(r.error); } catch (e) { console.error(e); } }
  try { await loadBills(); } catch (e) { console.error(e); }
}
const busy = (el, label) => { if (!el) return; el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}<span>${esc(label)}</span>`; };

function wire(route) {
  const step = route.step || 1, off = isOff(), root = document.querySelector('.st');
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  if (wiz().step !== step) wizSet({ step });
  // Step 2 or 3 with nothing to show (no issues picked, nothing followed): back to the start of the start.
  if (step >= 2 && !pickedIssues().length && !(step === 3 && !off && S.watch.size)) { setTimeout(() => app.go('#/start/1', { replace: true }), 0); return; }

  $$('[data-stskip]').forEach(el => el.onclick = () => { wizSet({ skipped: true }); app.go('#/'); });
  $$('[data-stback]').forEach(el => el.onclick = () => goBack(+el.dataset.stback));
  $$('[data-stretry]').forEach(el => el.onclick = () => { S.stLoad = null; app.render(); });
  $$('[data-stlater]').forEach(el => el.onclick = () => leave(off ? { done: true, ready: sessionInfo().nextOpen } : { done: true }));
  $$('[data-stready]').forEach(el => el.addEventListener('click', () => wizSet({ done: true, ready: sessionInfo().nextOpen })));

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
      if (!pickedIssues().length) { flash('Pick at least one issue, or tap Skip.'); return; }
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
      if (m.fallback && !m.first.length) { leave({ done: true }); return; }
      const w = wiz(), ids = w.picksFor === m.sig ? (w.picks || []) : [];
      if (!ids.length) { flash('Check at least one bill, or tap Skip.'); return; }
      if (next.getAttribute('aria-busy') === 'true') return;
      busy(next, 'Following…');
      await followIds(ids);
      const acts = openActions(S.bills.filter(b => ids.includes(b.id)), S.hearings);
      const f = acts.find(x => !x.late && !actedOn(x.b, x.h)) || acts.find(x => !actedOn(x.b, x.h));
      wizSet({ step: 3, done: true, followed: ids, focus: f ? actKey(f) : null });
      goStep(2, 3);
    };
  }

  if (step === 2 && off) {
    $$('[data-stlist]').forEach(el => el.onclick = async () => { const on = el.getAttribute('aria-pressed') !== 'true'; busy(el.querySelector('.st-ilead'), ''); await followList(el.dataset.stlist, on); });
    const next = $('[data-stnext]'); if (next) next.onclick = () => goStep(2, 3);
  }

  if (step === 3 && !off && root) {
    wireActions(root);
    const box = root.querySelector('[data-stpool]');
    const k = box && box.dataset.stpool;
    if (k) {
      // "Follow and write testimony": follow first (so it lands on their page), keep this card, then open the letter.
      const [bid, hid] = k.split('|');
      box.querySelectorAll(`[data-helper="${hid}"]`).forEach(el => el.onclick = async () => {
        if (el.getAttribute('aria-busy') === 'true') return;
        busy(el, 'Following…');
        await followIds([bid]);
        const w = wiz(); wizSet({ followed: [...new Set([...(w.followed || []), bid])], focus: k });
        app.render(); app.openHelper(bid, hid);
      });
    }
  }
}

export default {
  tab: 'home',
  tabs: false,
  title: route => (isOff() ? ['Get ready', 'What happened', 'Be ready in January'] : ['Pick your issues', 'Pick your bills', 'Your first action'])[(route.step || 1) - 1],
  render(route) {
    const step = route.step || 1, off = isOff();
    if (step === 1) return step1();
    if (step === 2) return off ? step2off() : step2();
    return off ? step3off() : step3();
  },
  wire,
  bar(route) {
    const step = route.step || 1, off = isOff();
    if (step === 1) return bar2(off ? 'Next' : 'Show me bills', { iconEnd: 'arrow-right' });
    if (step === 2) {
      if (off) return bar2('Next', { iconEnd: 'arrow-right' });
      const m = model2();
      if (m.fallback && !m.first.length) return bar1('Go to my page', 'primary');
      return bar2(followLabel(m.picked ? m.picked.size : 0), { icon: 'star' });
    }
    if (off) return bar1('Maybe later');
    const p = plan3();
    return p.kind === 'none' || p.done ? bar1('Go to my page', 'primary') : bar1('Maybe later, show my page');
  },
};
