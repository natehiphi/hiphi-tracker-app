// The five first-visit plans' own screens (R-164; the plans' shapes are pub/plans.js, the test is 'onb' in variant.js).
// start.js draws the frame (the named parts, Back, the bar's place) and today's topics screen; start-rest.js the address
// step ('you'); this module the rest, loaded as soon as a plan's first visit is drawn. Plan-specific screens live in
// their own files (onb-p2.js the story and the road, onb-p3.js the island, onb-p4.js the ways to help) so each can change
// without touching the others; the steps several plans share are here:
//   picks  what's moving on your topics: three issues ticked for you, each with an untick (Plans 3, 4, 5)
//   one    one bill that needs voices this week, and the two-minute email to its chair (Plan 1)
//   hello  say aloha to your two legislators: the one-time introduction (Plan 1 between sessions, Plan 3)
//   join   the alerts sign-up, the visit's one ask (every plan; Nate 10/5: "more friendly and warm and positive")
//   wrap   the ending: what you did, what happens next, and a hello from the HIPHI team
// Design rules this follows: C-1 (something useful before the ask), C-3 (the ask right after a success, skippable as an
// equal choice), C-4 (the consent words are pub/alerts.js's, unchanged and versioned), C-7 (a burst for each small win,
// one moment for the first follow or action, the peak at the end), C-13 (every answer changes what comes next), P-5.
import { S, DEMO, app, esc, icon, blurb, nick, spaced, sessionInfo, wiz, wizSet, HST, anyBill, legTitle, legPhoto, ensureRecapPool, issuesIn, followedIssues, followsAnything, setFollows, issuesOf, issueFollowed, textSaved, cmteLabel, chairContacts, plainStatus } from './core.js';
import { shell, topRow, artFor, bar1, bar2, sayRow, sureWide, skel, loadErr, isOff, planOn, goStep, finish, track, pickedIssues, issueInfo, ranker, byScore, mailSent, welcome, flash, clearFlash, plural, andList, shortDay, shown, poolBills, busy, stepOf } from './start.js';
import { btn, chip, posChip } from './ui.js';
import { CAPITOL, VOICES, flower } from './art.js';
import { burst, celebrate, later, reduced, petals } from './fx.js';
import { alertFields, alertButton, wireAlertForm, alertDoneHTML, changeBtn, fmtPhone, codeStep, alertStatus, alertRowHTML, wireAlertRow } from './alerts.js';
import * as P2 from './onb-p2.js';
import * as P3 from './onb-p3.js';
import * as P4 from './onb-p4.js';
import { joinWords, sampleText, joinDone, OFTEN } from './onb-join.js';
import { GO_HELP } from './topics.js';
import { armOf, abSeen } from './variant.js';

// ---------- what the person picked, as issues ranked the way the first visit ranks them (start.js issueInfo) ----------
// Between sessions the issues' bills are last session's, which load with the recap pool; until then a skeleton.
export function planIssues() {
  const off = isOff(), yr = sessionInfo().recapYear;
  if (!S.issues.length) return { err: true };
  if (off && !(S.recapPool && S.recapPool.yr === yr)) { if (S.recapFailed === yr) return { err: true }; ensureRecapPool(yr); return { loading: true }; }
  const R = ranker(), sel = pickedIssues();
  const pool = sel.length ? sel.flatMap(c => c.issues && c.issues.length ? c.issues : issuesIn(c.topicKey)) : S.issues;
  const seen = new Set(), rows = [];
  for (const i of pool) { if (!i || seen.has(i.id) || !shown(i)) continue; seen.add(i.id); const x = issueInfo(i, R); if (x.bills.length) rows.push(x); }
  return { R, off, rows: rows.sort(byScore), cats: sel };
}
const topicWords = () => { const sel = pickedIssues(); return sel.length ? andList(sel.map(c => c.key)) : 'HIPHI’s issues'; };
export const hiphiWords = 'HIPHI';

// ================= picks: what's moving on your topics (Plans 3, 4 and 5) =================
// Three issues, the most important first, ticked for the person and said so ("We picked three to start you off"), each
// a real toggle they can untick (C-4: nothing is followed unseen). The card is cut to the issue's name, one line and its
// lead bill (R-139's finding: the long cards made people deliberate).
S.obPicks ??= null;
const PICK_N = 3;
function picksModel() {
  const m = planIssues(); if (m.err || m.loading) return m;
  const top = m.rows.slice(0, PICK_N), sig = top.map(x => x.i.id).join('|');
  if (!S.obPicks || S.obPicks.sig !== sig) S.obPicks = { sig, on: new Set(top.map(x => x.i.id)) };
  return { ...m, top };
}
function pickCard(x, on) {
  const i = x.i, b = x.lead, h = x.inf && x.inf.h;
  const when = h ? chip(`Hearing ${new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })}`, 'info', 'calendar') : '';
  return `<li class="st-pcard ob-pcard${on ? ' on' : ''}"><button type="button" class="st-pick" data-obpick="${esc(i.id)}" aria-pressed="${on}">
    <span class="st-tick" aria-hidden="true">${icon('check')}</span>
    <span class="st-pbody">${when ? `<span class="st-ptop">${when}</span>` : ''}<span class="st-phead">${esc(i.name)}</span>
      ${i.description ? `<span class="st-pwhat ob-one">${esc(i.description)}</span>` : ''}
      <span class="st-pmeta"><span>${b ? `Bill: ${esc(spaced(b.bill_number))}` : ''}</span>${x.pos ? posChip({ hiphi_position: x.pos }) : ''}</span></span></button></li>`;
}
const PICKS_LEDE = {
  p3: 'These are the issues your legislators will decide on soonest. We ticked them for you; untick any you don’t want.',
  p4: 'We picked three to start you off, the ones moving soonest. Untick any you don’t want.',
  p5: 'We’ll follow these for you, so you don’t have to check. Untick any you don’t want.',
};
function stepPicks(step) {
  const m = picksModel();
  if (m.loading) return skel(step);
  if (m.err) return loadErr(step);
  const p = planOn(), n = [...S.obPicks.on].length;
  return shell('st2 ob-picks', `${topRow('picks', step)}${artFor('picks')}
    <h1 class="hero" id="st-h">${m.off ? `Your issues for ${sessionInfo().nextOpen ? sessionInfo().nextOpen.slice(0, 4) : 'next session'}` : `What’s moving on ${esc(topicWords())}`}</h1>
    <p class="lede">${esc(PICKS_LEDE[p] || PICKS_LEDE.p5)}</p>${sureWide('star', 'Free. Change them any time.')}`,
    `${sayRow('star', 'Free. Change them any time.')}<ul class="st-picks" role="list">${m.top.map(x => pickCard(x, S.obPicks.on.has(x.i.id))).join('')}</ul>
     ${m.rows.length > PICK_N ? `<p class="small muted ob-more">${icon('search')}<span>${plural(m.rows.length - PICK_N, 'more issue')} on these topics in Find, any time.</span></p>` : ''}
     <p class="sr" aria-live="polite" id="ob-picksaid">${n} ticked</p>`);
}
function wirePicks({ step, next, $, $$ }) {
  $$('[data-obpick]').forEach(el => el.onclick = () => {
    const id = el.dataset.obpick, on = el.getAttribute('aria-pressed') !== 'true';
    el.setAttribute('aria-pressed', String(on)); el.closest('.st-pcard')?.classList.toggle('on', on);
    if (on) S.obPicks.on.add(id); else S.obPicks.on.delete(id);
    const t = el.querySelector('.st-tick'); if (t && on && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
    const n = S.obPicks.on.size, lb = $('[data-stnext] span');
    if (lb) lb.textContent = n ? `Follow ${plural(n, 'issue')}` : 'Follow issues';
    const said = $('#ob-picksaid'); if (said) said.textContent = `${n} ticked`;
    clearFlash();
  });
  const nb = $('[data-stnext]');
  if (nb) nb.onclick = async () => {
    const ids = [...(S.obPicks?.on || [])];
    if (!ids.length) { flash('Tick at least one, or select Skip.'); return; }
    busy(nb, 'Following…');
    try { await setFollows({ issuesOn: ids }); wizSet({ followedIssues: ids }); welcome(); } catch (e) { console.error(e); }
    track('picks', 'next', { counts: { issues: ids.length } });
    burst(nb, 12, 48); later(() => goStep(step, step + 1), 420);
  };
}

// ================= find, learn, decide: Plan 1's gradual build-up (R-164) =================
// Nate 10/5, after trying the first build: "Plan 1 is too aggressive. Immediately writing testimony without a gradual
// build up is too much", and the shape: "find a bill they want first, then learn, then decide". So nothing is asked of the
// person until they have chosen a bill themselves and seen how it can move:
//   find    a few bills on their topics with a chance to move soon; they pick the one they want to learn about
//   learn   that bill: what it does, where it is on its road (Plan 2's small road), and when people can help
//   decide  three equal ways on: write the email now (the walkthrough every bill page uses), a reminder before the
//           deadline (the sign-up then offers it), or no thanks. None is the "right" answer (P-5).
// The email walkthrough's Done comes back through app.onbActed and goes on to the sign-up.
const FIND_N = 4;
// The bills to choose from: HIPHI has a position on each; soonest real chance first (open testimony, then any hearing,
// then the most important), at most four, one per issue so the list is a real choice and not one issue's twins.
export function findBills() {
  const m = planIssues(); if (m.err || m.loading) return m;
  const R = m.R, seen = new Set(), out = [];
  const pos = b => b && b.hiphi_position && b.hiphi_position !== 'monitor';
  for (const x of m.rows) {
    const b = (x.live.length ? x.live : x.bills).filter(pos).slice().sort(R.cmp)[0];
    if (b && !seen.has(b.id)) { seen.add(b.id); out.push(b); }
  }
  const list = out.sort(R.cmp).slice(0, FIND_N);
  return { ...m, list };
}
const chosen = () => { const id = S.obBill || wiz().obBill; return id ? anyBill(id) : null; };
const hearingOf = (b, R) => { const h = b ? (R || ranker()).soon.get(b.id) || null : null; return h && new Date(h.scheduled_at) > Date.now() ? h : null; };
const dueOf = h => h && h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? h.testimony_deadline : null;
const dayWord = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
const shortWhen = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' });
const timeWord = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });
// The bill's own plain status sentence (the bill page's words), never Plan 2's road names ("On the other side").
const statusWords = b => { try { return plainStatus(b).text; } catch { return ''; } };
const chairOf = (b, h) => { const c = chairContacts(h ? h.committee : (b.committee || '').split('/')[0])[0]; return c ? `${c.title} ${c.leg?.name || c.name}` : ''; };

function findCard(b, R, on) {
  const h = hearingOf(b, R), name = nick(b) || spaced(b.bill_number);
  const when = h ? chip(`Hearing ${shortWhen(h.scheduled_at)}`, 'info', 'calendar') : chip('Needs a hearing', '', 'hourglass');
  return `<li class="st-pcard ob-pcard${on ? ' on' : ''}"><button type="button" class="st-pick" data-obfind="${esc(b.id)}" aria-pressed="${on}">
    <span class="st-tick" aria-hidden="true">${icon('check')}</span>
    <span class="st-pbody"><span class="st-ptop">${when}</span><span class="st-phead">${esc(name)}</span>
      <span class="st-pwhat ob-one">${esc(blurb(b, 140))}</span>
      <span class="st-pmeta"><span>${esc(spaced(b.bill_number))}</span>${posChip(b)}</span></span></button></li>`;
}
function stepFind(step) {
  const m = findBills();
  if (m.loading) return skel(step);
  if (m.err) return loadErr(step);
  if (!m.list.length) return stepHello(step);   // nothing on the calendar at all: the hello stands in
  const sel = chosen()?.id;
  return shell('st2 ob-picks ob-find', `${topRow('find', step)}${artFor('find')}
    <h1 class="hero" id="st-h">Find a bill you care about</h1>
    <p class="lede">These bills on ${esc(topicWords())} could move soon. Pick one to learn about.</p>${sureWide('eye', 'Just looking. You decide later.')}`,
    `${sayRow('eye', 'Just looking. You decide later.')}<ul class="st-picks" role="list" aria-label="Bills to learn about">${m.list.map(b => findCard(b, m.R, b.id === sel)).join('')}</ul>`);
}
function wireFind({ step, $, $$ }) {
  $$('[data-obfind]').forEach(el => el.onclick = () => {
    const id = el.dataset.obfind;
    S.obBill = id; wizSet({ obBill: id });
    $$('[data-obfind]').forEach(b => { const on = b === el; b.setAttribute('aria-pressed', String(on)); b.closest('.st-pcard')?.classList.toggle('on', on); });
    const t = el.querySelector('.st-tick'); if (t && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
    clearFlash();
  });
  const nb = $('[data-stnext]');
  if (nb) nb.onclick = () => { if (!chosen()) { flash('Pick one, or select Skip.'); return; } track('find', 'next'); goStep(step, step + 1); };
  // Skip: no bill to learn about, so straight on to the sign-up, past learn and decide.
  const sk = $('[data-stskip]');
  if (sk) sk.onclick = () => { track('find', 'skip'); const j = stepOf('join', isOff()); goStep(step, j || step + 1); };
}

function stepLearn(step) {
  const b = chosen(); if (!b) return stepFind(step);
  const R = ranker(), h = hearingOf(b, R), due = dueOf(h), name = nick(b) || spaced(b.bill_number), to = chairOf(b, h);
  const pl = P2.placeOf ? P2.placeOf(b, isOff(), sessionInfo().recapYear) : null;
  const help = h
    ? `Anyone can send the chair a short note before ${due ? `${esc(dayWord(due).split(',')[0])} at ${esc(timeWord(due))}` : 'the hearing'}. Lawmakers listen closest to the people a bill affects.`
    : `It needs a hearing to move. Anyone can send the chair${to ? `, ${esc(to)},` : ''} a short note asking for one.`;
  return shell('st1 ob-learn', `${topRow('learn', step)}
    <p class="ob-num">${esc(spaced(b.bill_number))}${posChip(b)}</p>
    <h1 class="hero" id="st-h">${esc(name)}</h1>
    <p class="lede">${esc(blurb(b, 140))}</p>`,
    `<section class="card ob-lsec" aria-labelledby="ob-l1"><h2 class="ob-lh" id="ob-l1">${icon('route')}<span>Where it is now</span></h2>
      ${pl ? `<div class="ob2-mini">${P2.miniRoad(pl)}</div>` : ''}<p class="ob-lp">${esc(statusWords(b))}</p></section>
    <section class="card ob-lsec" aria-labelledby="ob-l2"><h2 class="ob-lh" id="ob-l2">${icon('message-square')}<span>How people can help</span></h2>
      <p class="ob-lp">${help}</p></section>`);
}
function wireLearn({ step, $ }) {
  const nb = $('[data-stnext]'); if (nb) nb.onclick = () => { track('learn', 'next'); goStep(step, step + 1); };
}

S.obActed ??= null;
function stepDecide(step) {
  const b = chosen(); if (!b) return stepFind(step);
  const R = ranker(), h = hearingOf(b, R), due = dueOf(h), name = nick(b) || spaced(b.bill_number), to = chairOf(b, h);
  const acted = S.obActed;
  if (acted) return shell('st1 ob-decide', `${topRow('decide', step)}${artFor('decide')}
    <h1 class="hero" id="st-h">You added your voice</h1><p class="lede">Mahalo for writing about ${esc(name)}. Next: how we’ll tell you what happens.</p>`,
    `<p class="ob-did">${icon('circle-check')}<span>You emailed ${esc(to || 'the chair')}.</span></p>`);
  const what = h ? `A short email to ${esc(to || 'the committee’s chair')}${due ? `, before ${esc(dayWord(due).split(',')[0])} at ${esc(timeWord(due))}` : ''}. We help you write it; you send it.`
    : `A short email asking ${esc(to || 'the committee’s chair')} to give it a hearing. We help you write it; you send it.`;
  return shell('st1 ob-decide', `${topRow('decide', step)}${artFor('decide')}
    <h1 class="hero" id="st-h">Want to add your voice?</h1>
    <p class="lede">${what}</p>`,
    `<ul class="ob-ways" role="list">
      <li><button type="button" class="card ob-way" data-obwrite="1"><span class="ob-wayic" aria-hidden="true">${icon('mail')}</span><span><b>Write it now</b><span>About 2 minutes, with help</span></span>${icon('chevron-right')}</button></li>
      ${h ? `<li><button type="button" class="card ob-way" data-obcal="1"><span class="ob-wayic" aria-hidden="true">${icon('calendar-plus')}</span><span><b>Add the hearing to my calendar</b><span>The time and place, in your own calendar</span></span>${icon('chevron-right')}</button></li>` : ''}
      <li><button type="button" class="card ob-way" data-obnot="1"><span class="ob-wayic" aria-hidden="true">${icon('eye')}</span><span><b>Not now, just keep watch</b><span>It stays on your home page</span></span>${icon('chevron-right')}</button></li>
    </ul>`);
}
function wireDecide({ step, $ }) {
  const b = chosen(); if (!b) return;
  const h = hearingOf(b);
  const w = $('[data-obwrite]');
  if (w) w.onclick = () => { track('decide', 'next'); S.obOpen = { kind: 'email', step }; app.openMail?.({ mode: 'email', bill: b.id, hearing: h?.id, code: h ? undefined : (b.committee || '').split('/')[0] }); };
  // D1-1 (R-180 wave 2): nothing sends a reminder yet (Nate 10/5: "not for now, maybe later"), so this card does the one thing that
  // exists, the hearing in their own calendar, and says so. The bill's issue is followed, as with "just keep watch".
  const r = $('[data-obcal]');
  if (r) r.onclick = async () => { track('decide', 'next'); try { (await import('./actions.js')).downloadIcs(b, h); } catch (e) { console.error(e); } followBill(b); burst(r.querySelector('.ob-wayic'), 10, 34); later(() => goStep(step, step + 1), 380); };
  const n = $('[data-obnot]');
  if (n) n.onclick = () => { track('decide', 'skip'); followBill(b); goStep(step, step + 1); };
  const go = $('[data-obon]'); if (go) go.onclick = () => goStep(step, step + 1);
}
// "Just keep watch" and a reminder both follow the bill's issue, so it stays on Home and its alerts come (C-4: they chose it).
function followBill(b) {
  const i = issuesOf(b).find(shown) || issuesOf(b)[0];
  if (i && !issueFollowed(i)) setFollows({ issuesOn: [i.id] }).then(() => { wizSet({ followedIssues: [...new Set([...(wiz().followedIssues || []), i.id])] }); welcome(); }).catch(e => console.error(e));
}
// The three ways are the choices themselves (equal cards, A-3, P-5); the bar only goes back or, once acted, on.
const barDecide = () => S.obActed ? bar1('Next', 'arrow-right', { 'data-obon': '1' }) : '';

// The walkthrough's Done hands back here (helper.js) when it was opened from a plan's step, then the sign-up.
app.onbActed = x => {
  const o = S.obOpen; if (!o || !planOn() || wiz().done || wiz().skipped) return false;
  S.obOpen = null;
  // The walkthrough's last page already celebrated the first action and followed the bill's issue (with "Don't follow
  // it"), so here it only goes on; who it went to is kept for the sign-up's first line ("Your note to ... is on its way").
  S.obActed = { kind: o.kind, bill: x?.b?.id || null, to: (x?.to || []).map(t => t.label).filter(Boolean).slice(0, 2) };
  wizSet({ obActed: S.obActed });
  if (x?.b) { const i = issuesOf(x.b).find(shown) || issuesOf(x.b)[0]; if (i && issueFollowed(i)) { wizSet({ followedIssues: [...new Set([...(wiz().followedIssues || []), i.id])] }); welcome(); } }
  later(() => goStep(o.step, o.step + 1), 200);
  return true;
};

// ================= hello: say aloha to your two legislators (Plan 1 between sessions, Plan 3) =================
// The one-time introduction (helper.js mode 'intro'), already written, naming what they care about. Without an address
// yet, the address step comes first (start-rest.js 'you'); Plan 1 between sessions has it in its flow (plans.js).
const myLegs = () => (S.stAddr?.pick?.ids || []).map(id => S.legislators.find(l => l.id === id)).filter(Boolean)
  .sort((a, b) => (a.chamber === 'H' ? 0 : 1) - (b.chamber === 'H' ? 0 : 1));
function stepHello(step) {
  const legs = myLegs(), names = legs.map(l => `${legTitle(l)} ${l.name}`), done = S.obActed && S.obActed.kind === 'intro';
  const topics = followedIssues().map(i => i.name).slice(0, 3);
  const off = isOff(), open = sessionInfo().nextOpen;
  return shell('st1 ob-hello', `${topRow('hello', step)}${artFor('hello')}
    <h1 class="hero" id="st-h">${done ? 'Aloha sent' : legs.length ? 'Say aloha to your legislators' : 'Say aloha at the Capitol'}</h1>
    <p class="lede">${done ? 'They know you now, and what you care about. That counts when your issues come up.'
      : `A short note ${off && open ? `before the session opens on ${esc(shortDay(open))} ` : ''}tells them you care about ${topics.length ? esc(topics[0]) : 'health in Hawaiʻi'}, and asks where they stand. We help you write it; you send it.`}</p>`,
    legs.length ? `<ul class="st-legs ob-legs" role="list">${legs.map(l => `<li class="st-leg">${legPhoto(l, 'st-legpic')}<span class="st-tbody"><b>${esc(legTitle(l))} ${esc(l.name)}</b><span>Your ${l.chamber === 'S' ? 'senator' : 'representative'} · District ${esc(String(l.district))}</span></span></li>`).join('')}</ul>
      ${done ? `<p class="ob-did">${icon('circle-check')}<span>You said hello to ${esc(andList(names))}.</span></p>` : '<p class="small muted ob-legnote">Lawmakers listen closest to the people they represent.</p>'}`
      : `<p class="ob-noaddr">${icon('map-pin')}<span>Find your two legislators first, and we’ll write the hello with you.</span></p>`);
}
function wireHello({ step, $ }) {
  const legs = myLegs();
  const w = $('[data-obhello]');
  if (w) w.onclick = () => { track('hello', 'next'); S.obOpen = { kind: 'intro', step }; app.openMail?.({ mode: 'intro', legs: legs.filter(l => l.email).map(l => l.id) }); };
  const f = $('[data-obfind]');
  if (f) f.onclick = () => { const y = stepOf('you', isOff()); if (y) goStep(step, y); };
  const n = $('[data-obnot]');
  if (n) n.onclick = () => { track('hello', 'skip'); goStep(step, step + 1); };
  const go = $('[data-obon]');
  if (go) go.onclick = () => goStep(step, step + 1);
}
function barHello() {
  if (S.obActed && S.obActed.kind === 'intro') return bar1('Next', 'arrow-right', { 'data-obon': '1' });
  const legs = myLegs();
  if (!legs.length) return `<div class="st-bar"><div class="st-btns">${btn('Not now', { kind: 'text', attrs: { 'data-obnot': '1' } })}${stepOf('you', isOff()) ? btn('Find my legislators', { kind: 'primary', icon: 'landmark', attrs: { 'data-obfind': '1' } }) : ''}</div></div>`;
  return `<div class="st-bar"><div class="st-btns ob-joinbtns">${btn('Not now', { kind: 'secondary', attrs: { 'data-obnot': '1' } })}${btn('Write my hello · 2 min', { kind: 'primary', icon: 'mail', attrs: { 'data-obhello': '1' } })}</div></div>`;
}

// ================= join: the alerts sign-up (every plan) =================
// The words, the example and the two versions under test are in onb-join.js (R-164: Nate asked for better options, from
// best practice; the research's report is kept with R-164). The box itself, its consent line and its saving are
// pub/alerts.js's, the same everywhere (C-4: what is agreed is versioned in text_consent_words and must not change here).
// "Not now" is a full button the size of the main one (C-3: an equal choice). After a yes, the same screen says what
// happens now, warmly, before moving on.
const acted = () => S.obActed || wiz().obActed || null;
S.obJoined ??= null;
const boxFirst = () => { try { return matchMedia('(max-width: 600px)').matches; } catch { return false; } };
const short = () => { try { return matchMedia('(max-height: 740px)').matches; } catch { return false; } };
function stepJoin(step) {
  const t = textSaved(), sent = mailSent(), given = !S.alertEdit && (t || sent || S.session);
  const arm = armOf('join'), follows = followedIssues(), si = sessionInfo();
  const W = joinWords({ arm, acted: acted(), follows, off: isOff(), open: si.nextOpen });
  if (given) {
    const r = S.obJoined || (t ? { kind: 'phone', phone: t.phone, confirmed: !!t.confirmed } : sent ? { kind: 'email', email: sent } : { kind: 'account' });
    const D = joinDone(r, follows, alertStatus());
    return shell('st4 st-alertspage ob-join ob-joined', `${topRow('join', step)}<div class="st-art ob-joinart">${VOICES}</div>
      <h1 class="hero" id="st-h">${esc(D.h)}</h1><p class="lede">${esc(D.lede)}</p>`,
      `<section class="card ob-set" aria-labelledby="ob-set-h"><span class="ob-setic${alertStatus().key === 'on' ? '' : ' wait'}" aria-hidden="true">${icon(r.kind === 'email' ? 'mail-check' : r.kind === 'phone' ? 'message-square' : 'bell')}</span>
        <div><p class="strong" id="ob-set-h">${r.kind === 'phone' ? `Alerts to ${esc(fmtPhone(r.phone))}` : r.kind === 'email' ? `A link to ${esc(r.email)}` : esc(alertStatus().title)}</p>
        ${D.tip ? `<p class="small">${esc(D.tip)}</p>` : ''}<p class="small muted">${esc(OFTEN)}.${DEMO ? ' This is the practice copy: nothing was sent or saved.' : ''}</p>
        ${r.kind !== 'account' ? `<div class="st-formbtns st-alchange">${changeBtn('data-stalchange', r.kind === 'phone' ? 'Use a different number' : 'Use a different email')}</div>` : ''}</div></section>`);
  }
  const email = S.alertMode === 'email', topic = pickedIssues().map(c => c.key)[0] || '', ex = sampleText({ follows, email, topic });
  // How often rides with the example (the review: said once, and the box nearer the top on a phone, A-1, A-14).
  const example = arm === 'watch'
    ? `<ol class="ob-steps" role="list" aria-label="How it works">${W.steps.map(([ic, s], k) => `<li style="--k:${k}"><span class="ob-stepic" aria-hidden="true">${icon(ic)}</span><span>${esc(s)}</span></li>`).join('')}</ol>
       <p class="ob-often">${icon('calendar-check')}<span>${esc(OFTEN)}.</span></p>`
    : `<figure class="ob-sample"><figcaption class="ob-samplecap">${icon(email ? 'mail' : 'message-square')}<span>${email ? 'Example email' : 'Example text'} · ${esc(OFTEN.charAt(0).toLowerCase() + OFTEN.slice(1))}</span></figcaption>
        ${email ? `<div class="ob-bubble ob-mail"><b>${esc(ex.subject)}</b><span>${esc(ex.body)}</span></div>` : `<p class="ob-bubble">${esc(ex.body)}</p>`}</figure>`;
  return shell('st4 st-alertspage ob-join', `${topRow('join', step)}<div class="st-art ob-joinart">${VOICES}</div>
    ${W.receipt ? `<p class="ob-receipt">${icon('circle-check')}<span>${esc(W.receipt)}</span></p>` : ''}
    <h1 class="hero" id="st-h">${codeStep('st-a') ? 'Check your texts' : esc(W.h)}</h1>
    ${codeStep('st-a') ? '<p class="lede">Type the 6-digit code from the text to turn on alerts.</p>' : short() ? '' : `<p class="lede">${esc(W.lede)}</p>`}`,
    // D1-6 (R-180 wave 2): on a phone the example goes under the box (and on a short one the lede too), so the promise and the small print are on the screen
    // whenever "Text me" is (CTIA: the disclosures sit next to the button on every screen size); a taller screen keeps it above.
    (form => boxFirst() ? form + (codeStep('st-a') ? '' : `${short() ? `<p class="lede ob-lede2">${esc(W.lede)}</p>` : ''}${example}`) : (codeStep('st-a') ? '' : example) + form)(
      `<form class="card st-form st-askcard st-alertform ob-joinform" id="st-aform" novalidate>${alertFields('st-a')}</form>`));
}
// Leaving the sign-up: the follow's moment if the visit has had no big moment yet (C-7: the first follow fills the
// screen; Plan 1's first action had its own in the walkthrough), else straight on.
function leaveJoin(step, r = null) {
  S.alertEdit = false;
  const go = () => goStep(step, step + 1);
  if (acted() || S.obMoment) { go(); return; }
  S.obMoment = true;
  const n = followedIssues().length, D = r && r.kind !== 'given' ? joinDone(r, followedIssues(), alertStatus()) : null;
  if (!n && !D) { go(); return; }
  celebrate({ title: 'Mahalo!', sub: n ? `You’re following ${plural(n, 'issue')}.` : 'You’re in the loop.',
    small: D ? `${D.lede}${D.tip ? ` ${D.tip}` : ''}` : r ? 'We’ll tell you when it counts.' : 'Turn on alerts any time from More.', go: 'Next: You’re All Set' }, go);
}
function wireJoin({ step, fresh, $ }) {
  // The visit's one alerts ask, so Home will not ask again after "Not now" (C-3; today's step does the same in start-rest.js; D1-6).
  S.nudge = null; S.nudgedThisVisit = true;
  if (fresh) abSeen('join');
  const form = $('#st-aform');
  // A yes goes straight on to the moment (or, after an action that had its own, to the ending): a "You're set" screen,
  // then the Mahalo, then "You're all set" ended the visit three times (the review, 10/5). The moment carries the one
  // thing worth knowing now: which number we'll text, and to save it.
  wireAlertForm(form, { pfx: 'st-a', source: 'first_visit', onDone: r => {
    S.obJoined = r; track('join', 'next', { counts: { phone: r.kind === 'phone', email: r.kind === 'email' } });
    burst($('#st-send') || form, 14, 52); later(() => leaveJoin(step, r), 380);
  } });
  const ch = $('[data-stalchange]'); if (ch) ch.onclick = () => { S.alertEdit = true; S.obJoined = null; app.render(); };
  // The frame's Skip just moves on; here "Not now" first plays the follow's moment (assigned after the frame's, so it
  // replaces it).
  const sk = $('[data-stskip]'); if (sk) sk.onclick = () => { track('join', 'skip'); leaveJoin(step); };
  const nb = $('[data-obon]'); if (nb) nb.onclick = () => leaveJoin(step, S.obJoined || { kind: 'given' });
}
function barJoin() {
  if (!S.alertEdit && (textSaved() || mailSent() || S.session)) return bar1('Next', 'arrow-right', { 'data-obon': '1' });
  const b = alertButton('st-a');
  return `<div class="st-bar"><div class="st-btns ob-joinbtns">${btn('Not now', { kind: 'secondary', attrs: { 'data-stskip': '1' } })}${btn(b.label, { kind: 'primary', icon: b.icon, attrs: { type: 'submit', form: 'st-aform', id: 'st-send' } })}</div></div>`;
}

// ================= wrap: the ending (every plan) =================
// What they did, each line ticking in, the petals and flowers of today's finale (the peak, C-7), what happens next, and
// a hello from the HIPHI team. Then Home.
function didRows() {
  const f = followedIssues(), a = S.obActed || wiz().obActed, legs = myLegs();
  const b = a?.bill ? anyBill(a.bill) : null;
  return [
    a && a.kind === 'email' ? ['send', `You spoke up on ${b ? nick(b) || spaced(b.bill_number) : 'a bill'}`, 'You emailed the committee’s chair', 'ok'] : null,
    a && a.kind === 'intro' ? ['hand-heart', 'You said aloha to your legislators', legs.map(l => `${legTitle(l)} ${l.name}`).join(' and ') || 'They know you now', 'ok'] : null,
    f.length ? ['star', `You follow ${plural(f.length, 'issue')}`, andList(f.slice(0, 3).map(i => i.name)) + (f.length > 3 ? ', and more' : ''), 'ok'] : null,
    legs.length && !(a && a.kind === 'intro') ? ['users', 'You know who speaks for you', legs.map(l => `${legTitle(l)} ${l.name}`).join(' and '), 'ok'] : null,
    S.obWay || wiz().obWay ? ['heart-handshake', `You help by ${S.obWay || wiz().obWay}`, 'We’ll fit your next steps to it', 'ok'] : null,
    // The alerts row comes last, drawn by alerts.js alertRowHTML, as in today's ending: one status rule (D1-4), and its own
    // "Turn on alerts" when they are off (X10-4).
  ].filter(Boolean);
}
// What happens next, said only as far as it is true (the review, 10/5): "we keep watch" only when something is followed,
// "we tell you" only when alerts are on; otherwise where to look instead.
const NEXT3 = {
  p1: ['We keep watch on your bill and your issues.', 'When it’s your moment, we tell you, with one simple way to help.'],
  p2: ['We keep watch as your bills travel that road.', 'At each moment you practised, we tell you.'],
  p3: ['We keep watch on what your legislators decide.', 'When your issues come up, we tell you.'],
  p4: ['We keep watch on your issues.', 'When your way of helping counts, we tell you.'],
  p5: ['We keep watch on your issues.', 'When one needs you, we tell you. Each visit, we show you one more thing.'],
};
function nextLines(p) {
  // "we tell you" only once alerts are on or almost set by the one rule (D1-4), never for an account with both choices off.
  const [watch, tell] = NEXT3[p] || NEXT3.p5, al = alertStatus(), told = al.key === 'on' || al.key === 'almost';
  return [followsAnything() ? watch : 'Follow an issue any time, and we keep watch on it for you.',
    told ? tell : 'When it’s your moment, it’s at the top of your home page.',
    'You see what happened, on your home page.'];
}
function stepWrap(step) {
  const p = planOn(), rows = didRows(), off = isOff(), open = sessionInfo().nextOpen;
  const name = (S.stMail?.name || wiz().name || '').trim();
  const art = CAPITOL.replace(/<circle ([^>]*fill="var\(--o400\)"[^>]*)\/>/, '<circle class="st-sun" $1/>');
  const did = rows.some(r => r[3] === 'ok') || alertStatus().key === 'on', spoke = !!(S.obActed || wiz().obActed);
  const next = nextLines(p), ics = ['eye', 'calendar-clock', 'circle-check'];
  // The peak only for something really done (C-7): petals over "Alerts are off" alone read as a prize for nothing.
  // The finale's timings (start.css, fx.js petals(); X11-2, R-180): the words first, nothing moving after 2 s.
  return shell(`st-done ob-wrap${S.stCalm ? ' st-calm' : ''}`, `${topRow('wrap', step)}
    <div class="st-fx" aria-hidden="true"><div class="st-finart">${art}</div>${did ? `<div class="st-petals">${petals()}</div>
      <div class="st-blooms">${[0, 1, 2, 3, 4].map(i => `<span style="--k:${i}">${flower(22 + (i % 2) * 8)}</span>`).join('')}</div>` : ''}</div>
    <h1 class="hero" id="st-h">You’re all set${name ? `, ${esc(name)}` : ''}!</h1>
    <p class="lede">${spoke ? 'Mahalo for speaking up for a healthier Hawaiʻi. Here’s what you did today.' : did ? 'Mahalo for joining in. Here’s what you did today.' : 'Here’s where things stand.'}</p>`,
    `<ul class="st-did" role="list">${rows.map(([ic, b, s, kind], k) => `<li style="--k:${k}"><span class="st-rc st-rc-${kind}">${icon(kind === 'ok' ? 'check' : ic)}</span><div><b>${esc(b)}</b><span>${esc(s)}</span></div></li>`).join('')}${alertRowHTML(rows.length)}</ul>
    <h2 class="st-nexth">What happens next</h2>
    <ol class="st-next3" role="list">${next.map((s, k) => `<li style="--k:${k}"><span class="st-nic">${icon(ics[k])}</span><div><span>${esc(k === 0 && off && open ? `${s.replace(/\.$/, '')}, from ${shortDay(open)}.` : s)}</span></div></li>`).join('')}</ol>
    ${p === 'p1' || p === 'p3' ? `<aside class="card ob-note" aria-label="A note from HIPHI"><span class="ob-noteic" aria-hidden="true">${icon('heart-handshake')}</span>
      <p><b>Mahalo from the HIPHI team.</b> We’re at the Capitol every day, and we’ll celebrate the wins with you.</p></aside>` : ''}`);
}
function wireWrap({ $ }) {
  const d = $('[data-stdone]'); if (d) d.onclick = () => finish();
  wireAlertRow(document, { source: 'first_visit' });   // "Turn on alerts" on the alerts row (X10-4)
}

// ---------- the dispatch start.js calls ----------
const MINE = {
  picks: [stepPicks, wirePicks, () => bar2(`Follow ${plural(S.obPicks?.on?.size || PICK_N, 'issue')}`, { icon: 'star' })],
  find: [stepFind, wireFind, () => bar2('Learn about it', { iconEnd: 'arrow-right' })],
  learn: [stepLearn, wireLearn, () => bar1('Next: Your Choice', 'arrow-right')],
  decide: [stepDecide, wireDecide, barDecide],
  hello: [stepHello, wireHello, barHello],
  join: [stepJoin, wireJoin, barJoin],
  wrap: [stepWrap, wireWrap, () => bar1(GO_HELP, 'arrow-right', { 'data-stdone': '1' })],
};
const PLANS = [P2, P3, P4];
const owner = name => MINE[name] ? null : PLANS.find(m => m.STEPS?.includes(name)) || null;
export function renderStep(name, step) {
  const m = owner(name); if (m) return m.renderStep(name, step);
  return MINE[name] ? MINE[name][0](step) : skel(step);
}
export function wireStep(name, ctx) {
  const m = owner(name); if (m) { m.wireStep(name, ctx); return; }
  if (MINE[name]) MINE[name][1](ctx);
}
export function barStep(name, step, off) {
  const m = owner(name); if (m) return m.barStep(name, step, off);
  return MINE[name] ? MINE[name][2](step, off) : '';
}
