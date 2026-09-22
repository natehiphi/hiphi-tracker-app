// The three lessons of the public first visit (R-023, 9/21): "Reading a bill", "The session, January to May" and
// "What a hearing is", told with the person's own bill. Ported from the prototype Nate approved (backend
// docs/first-visit-prototype, version 3, after the second review); every behaviour and word is from backend
// docs/FIRST-VISIT-PLAN.md "The three lessons" and "The second review", with the real bill's values filled in.
// B-1: a person comes here to learn how a bill page, the session and a hearing work, on a bill of their own.
//
// pub/start.js owns the flow, the heading focus and the bar; this module draws one lesson and walks its steps:
//   exampleFrom(b, { off, via })        the example bill, turned into what the lessons draw (E, below)
//   lessonHTML(name, E)                 { intro, main }: intro is the h1 and the lede; main is the picture, the caption
//                                       (an aria-live region), the step dots or month buttons, and the quiz
//   lessonStart(name, E, { back, redraw, onAnswer })
//                                       after the screen is in the DOM. A fresh start plays step 1. back: the person
//                                       came back with Back, so the LAST step shows, with no motion. redraw: the frame
//                                       rebuilt the page without the person moving, so the step they were on (and the
//                                       quiz answer) comes back, with no motion and no onAnswer. onAnswer('right' |
//                                       'wrong' | 'shown') is called once, when "Try it" gets its outcome.
//   lessonNext(name, E)                 the primary was pressed: true when it did something inside the lesson (next
//                                       step, the quiz shown or answered), false when the flow should move on
//   lessonStop()                        the screen is being left or redrawn: every timer and trip stops
//
// E, the example (exampleFrom). b's hearings must be loaded first (b in S.bills, or `await ensureBill(num)`), because
// situation() and stopOf() read them; without them the hearing lesson falls back to the made-up hearing.
//   b, x          the bill (public_all_bills shape) and situation(b) from bill.js, the same one the bill page uses
//   id, num       the bill id; 'HB 2121' (a no-break space, so the number never splits across lines)
//   name, hasNick the nickname, else a short plain summary; whether it was a nickname
//   sum           the plain summary (only when a nickname leads, as on the bill page), else ''
//   pos           'HIPHI strongly supports' ... or '' (posInfo, the bill page's words)
//   start, other  'House' | 'Senate': where it started, and the other side
//   now           1 in its first side's committees, 2 passed them (its first side's floor vote), 3 in the other side
//                 (committees, floor or conference), 4 at the Governor or law. A stopped bill: where it stopped.
//   stopped       true when it stopped (dead, vetoed); isLaw true when it became law
//   stat          the bill page's own words for where it is ('In Senate committees', 'Became law', 'Stopped in House
//                 committees'), read from railHTML so the lessons can never disagree with the bill page
//   law, signed   'Act 189' and 'July 7' when the Capitol's last action says so, else ''; nosig: law without signature
//   year          its session year
//   hear          the hearing the lesson uses: in session, the next scheduled one; between sessions, the first past one
//                 it passed, else its first; otherwise a made-up one ("Say a hearing is Wednesday at 1:00 PM") on the
//                 committee holding the bill. { codes, brief ('Senate Health and Commerce committees'), day ('Friday'),
//                 when ('Friday', or 'Fri, Mar 27' a week or more away), date ('Fri, Mar 20'), time ('9:30 AM'), room
//                 ('Room 229'), dueDay, dueTime, dueDate, ahead ('24 hours'), posted ('Monday', or '' when unknown),
//                 past, example, outcome ('passed' ... or ''), id, at (ISO) }
//   chairs        legislator objects (S.legislators, plus `committee`) chairing hear's committees
//   path          the bill's referral committee codes in order, both sides, joint referrals split ('HHS', 'CPN')
//   mine          the person follows it (S.watch); off, via as given ('link': opened from a shared link;
//                 'followed': opened from a link and its issue just followed)
import { S, esc, icon, nick, blurb, spaced, sessionInfo, hearingsOf, outcomeOf, codesOf, cmteLabel, roomLabel, legPhoto,
  legTitle, posInfo, plainStatus, dateLong, timeWord, HST, CHAMBER_NAME } from './core.js';
import { posChip } from './ui.js';
import { situation, railHTML } from './bill.js';
import { reduced, later, burst, travel, stopTravel } from './fx.js';

export const LESSON_TITLES = { bill: 'Reading a bill', session: 'The session, January to May', hearing: 'What a hearing is' };
const LAST = { bill: 2, session: 4, hearing: 2 };

// ---------------------------------------------------------------- small helpers
const NBSP = '\u00a0';
const NUMW = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayBefore = d => WEEK[(WEEK.indexOf(d) + 6) % 7];
const weekday = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' });
const hstYmd = t => new Date(t).toLocaleDateString('en-CA', { timeZone: HST });
const words = list => list.length <= 1 ? (list[0] || '') : list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
const count = n => n === 1 ? 'one' : n === 2 ? 'two' : 'several';
const lcFirst = s => s ? s[0].toLowerCase() + s.slice(1) : s;
const plainSum = (b, n) => { const t = blurb(b, n); return /^relating to\s/i.test(t) ? 'A bill about ' + t.replace(/^relating to\s+/i, '') : t; };
const unent = s => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// "Health and Human Services" -> "Health" for a joint hearing's short label; a short name stays whole ("Ways and Means").
const shortName = n => n.length <= 14 ? n : n.split(/\s+(?:and|&)\s+|,\s*/)[0];

// ---------------------------------------------------------------- the example
// A committee label short enough for the notice on a 320px picture: one committee by its full name, two by their first
// words ("Senate Health and Commerce committees"), three or more by how many ("Three Senate committees").
function briefOf(codes) {
  const cs = codes.map(c => S.committees[c]).filter(Boolean);
  if (!cs.length) return codes.length ? cmteLabel(codes.join('/')) : 'A committee';
  const ch = CHAMBER_NAME[cs[0].chamber] || '';
  if (cs.length === 1) return `${ch} ${cs[0].name} Committee`.trim();
  if (cs.length === 2) return `${ch} ${shortName(cs[0].name)} and ${shortName(cs[1].name)} committees`.trim();
  return `${NUMW[cs.length] || cs.length} ${ch} committees`.trim();
}
function chairsOf(codes) {
  const out = [], seen = new Set();
  for (const c of codes) {
    const m = (S.committeeMembers || []).find(x => x.committee === c && x.role === 'chair');
    const l = m && (S.legislators || []).find(x => x.id === m.legislator_id);
    if (l && !seen.has(l.id)) { seen.add(l.id); out.push({ ...l, committee: c }); }
  }
  return out;
}
// The Capitol's last action for a law: "Act 189, on 07/07/2026 (Gov. Msg. No. 1291)." or "Became law without the
// Governor's signature, Act 266, 07/16/2026, ...". Anything else (the sandbox imagines laws with other last actions)
// leaves both empty, and the words say "It became law" without the number.
function actOf(b) {
  const t = b.last_action || '', m = /\bAct\s+(\d+)\b,?\s*(?:on\s+)?(?:(\d{1,2})\/(\d{1,2})\/(\d{4}))?/i.exec(t);
  if (!m) return { law: '', signed: '', nosig: false };
  const nosig = /without the governor/i.test(t);
  const signed = m[2] && !nosig ? new Date(Date.UTC(+m[4], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' }) : '';
  return { law: `Act ${m[1]}`, signed, nosig };
}
// The rail's own words for where the bill is ("Now: In Senate committees" -> "In Senate committees").
function railWords(html) {
  const m = /<p class="bl-nowlbl[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html || '');
  return m ? unent(m[1].replace(/<[^>]+>/g, '')).replace(/^Now:\s*/, '').trim() : '';
}
// Where the bill is on the session's four steps (see E.now above). A stopped bill is placed where the bill page's rail
// says it stopped ("Stopped in House committees", "Stopped before the Senate vote"), so the two always agree.
function nowOf(b, x, stat, other) {
  const st = x.st;
  if (x.law || /^(governor|vetoed|enacted)$/.test(b.stage || '') || /^(law|governor|vetoed)$/.test(st.phase)) return 4;
  if (x.stopped) return /final vote/i.test(stat) || new RegExp(`\\b${other}\\b`).test(stat) ? 3 : /vote/i.test(stat) ? 2 : 1;
  if (st.phase === 'conference') return 3;
  if (st.phase === 'floor') return st.leg === 'first' ? 2 : 3;
  return st.leg === 'first' ? 1 : 3;
}
function hearingOf(h, off) {
  const at = h.scheduled_at, due = h.testimony_deadline || new Date(new Date(at).getTime() - 864e5).toISOString();
  const hrs = Math.round((new Date(at) - new Date(due)) / 36e5), o = off ? outcomeOf(h) : null;
  const soon = (new Date(at) - Date.now()) < 6 * 864e5 && new Date(at) > Date.now() - 864e5;
  return { id: h.id, at, codes: codesOf(h.committee), brief: briefOf(codesOf(h.committee)), day: weekday(at), when: soon ? weekday(at) : dateLong(at),
    date: dateLong(at), time: timeWord(at), room: roomLabel(h.room), dueDay: weekday(due), dueTime: timeWord(due), dueDate: dateLong(due),
    ahead: hrs === 24 || hrs < 1 ? '24 hours' : hrs % 24 === 0 ? `${hrs / 24} days` : `${hrs} hours`,
    posted: h.notice_posted_at ? weekday(h.notice_posted_at) : '', past: new Date(at) <= Date.now(), example: false, outcome: o?.outcome || '' };
}
// No hearing to show: the prototype's example ("Say a hearing is Wednesday at 1:00 PM"), dated the first Wednesday at
// least three days off so its notice never looks stale (between sessions, the first Wednesday of the next session's
// February, when committees meet), on the committee holding the bill, or the last one that heard it.
function madeUpHearing(codes, chamber, off) {
  const si = sessionInfo(), next = off && si.nextOpen ? new Date(`${si.nextOpen.slice(0, 4)}-02-01T12:00:00-10:00`).getTime() : 0;
  let t = Math.max(Date.now() + 3 * 864e5, next); while (new Date(t).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) !== 'Wednesday') t += 864e5;
  const at = `${hstYmd(t)}T13:00:00-10:00`, due = `${hstYmd(t - 864e5)}T13:00:00-10:00`;
  const slot = codes.length ? (S.slots || []).find(s => s.code === codes[0] && s.room) : null;
  return { id: '', at, codes, brief: codes.length ? briefOf(codes) : `A ${chamber} committee`, day: 'Wednesday', when: 'Wednesday', date: dateLong(at), time: '1:00 PM',
    room: slot ? (/^\d/.test(slot.room) ? `Room ${slot.room}` : roomLabel(slot.room)) : 'Room 229', dueDay: 'Tuesday', dueTime: '1:00 PM', dueDate: dateLong(due), ahead: '24 hours', posted: 'Friday',
    past: false, example: true, outcome: '' };
}
export function exampleFrom(b, { off = false, via = '' } = {}) {
  if (!b) return null;
  const x = situation(b), st = x.st, rail = railHTML(b, x);
  const o = b.chamber || (/^S/.test(b.bill_number) ? 'S' : 'H'), start = CHAMBER_NAME[o] || 'House', other = o === 'H' ? 'Senate' : 'House';
  const name = nick(b), act = x.law ? actOf(b) : { law: '', signed: '', nosig: false };
  const hs = hearingsOf(b).filter(h => h.status !== 'cancelled'), now = Date.now();
  let h = null;
  if (!off) h = hs.find(q => q.status === 'scheduled' && new Date(q.scheduled_at) > now) || null;
  else { const past = hs.filter(q => new Date(q.scheduled_at) <= now); h = past.find(q => /^passed/.test(outcomeOf(q)?.outcome || '')) || past[0] || null; }
  // the made-up hearing's committee: the one holding the bill, else the last one that heard it, so it names a real chair
  const holding = st.committee || (st.hearing && st.hearing.committee) || ([...hs].reverse().find(q => new Date(q.scheduled_at) <= now) || {}).committee || '';
  const hear = h ? hearingOf(h, off) : madeUpHearing(codesOf(holding), CHAMBER_NAME[st.chamber] || start, off);
  const path = [...new Set((b.referrals || []).flatMap(r => codesOf(r)))];
  const E = { b, x, id: b.id, num: spaced(b.bill_number).replace(' ', NBSP), name: name || plainSum(b, 70), hasNick: !!name,
    sum: name ? blurb(b, 200) : '', pos: posInfo(b)?.text || '', start, other, now: 0, stopped: !!x.stopped, isLaw: !!x.law,
    stat: railWords(rail), ...act, year: +(b.session_year || (sessionInfo().phase === 'in' ? sessionInfo().yr : sessionInfo().recapYear)),
    hear, chairs: chairsOf(hear.codes), path, mine: S.watch.has(b.id), off: !!off, via: via || '', rail,
    pastHearings: hs.filter(q => new Date(q.scheduled_at) <= now).length };
  E.now = nowOf(b, x, E.stat, other);
  return E;
}

// ---------------------------------------------------------------- the words
// The prototype's captions (billCaps, sessionCaps, hearCaps) word for word with the real bill's values. Where the real
// bill is somewhere the prototype's example never was (still in its first side, at the Governor, stopped), the sentence
// about the bill says where it really is, in the same plain words.
function whose(E) {
  if (E.via === 'followed') return 'Here’s the one you just followed.';
  if (E.via === 'link') return 'Here’s the bill you opened.';
  if (E.off) return E.isLaw ? `Here’s one that became law in ${E.year}.` : `Here’s one from the ${E.year} session.`;
  return E.mine ? 'Here’s one of your bills.' : 'Here’s one HIPHI is working on.';
}
function ledeOf(name, E) {
  const num = esc(E.num), H = E.hear, n = E.pastHearings;
  if (name === 'bill') return `${whose(E)} Every bill page looks like this.`;
  if (name === 'session') return E.off ? `Every bill takes the same trip. Here’s the one ${num} took in ${E.year}.`
    : `Every bill takes the same trip. ${E.mine || E.via === 'followed' ? 'Watch one of yours.' : `Watch ${num}.`}`;
  const tail = !H.example && !H.past ? `${num} has one on ${esc(H.when)}.`
    : E.isLaw ? `${num} had ${n ? count(n) : 'several'} on its way to becoming law.`
    : E.stopped ? (n ? `${num} had ${count(n)} before it stopped.` : `${num} never got one.`)
    : E.now === 4 ? `${num} had ${n ? count(n) : 'several'} on its way to the Governor.`
    : E.x.st.hearingState === 'held' && E.x.st.hearing ? `${num} had one on ${esc(dateLong(E.x.st.hearing.scheduled_at))}.`
    : E.x.st.phase === 'committee' ? `${num} is waiting for one.`
    : n ? `${num} has had ${count(n)} so far.` : `${num} is waiting for one.`;
  return `It’s when your voice counts most. ${tail}`;
}
function billCaps(E) {
  const B = /^HB/.test(E.b.bill_number) ? 'HB' : /^SB/.test(E.b.bill_number) ? 'SB' : '';
  const what = E.pos ? 'Its name, what it does in plain words, and where HIPHI stands.' : 'Its name, and what it does in plain words.';
  const st = E.x.st, ch = CHAMBER_NAME[st.chamber] || E.start;
  const where = E.isLaw ? (E.signed ? `This one made every step: the Governor signed it on ${esc(E.signed)}.` : 'This one made every step: it became law.')
    : E.stopped ? (/^vetoed/i.test(E.stat) ? 'This one was vetoed by the Governor.' : `This one ${esc(lcFirst(E.stat || 'Stopped this session'))}.`)
    : st.phase === 'governor' || E.now === 4 ? 'This one is on the Governor’s desk.'
    : st.phase === 'conference' ? 'This one passed both sides. Now they’re working out one version.'
    : st.phase === 'floor' ? `This one is waiting for the ${ch} vote.`
    : `This one is with ${ch} committees now.`;
  return [
    ['What it is', `${what} ${B ? `${B} means ${B === 'HB' ? 'House' : 'Senate'} Bill: it` : 'It'} started in the ${E.start}.`],
    ['Where it is, and how to help', `Each dot is a step toward becoming law. ${where}${E.x.live && !E.off ? ' When you can help, the button says how, and by when.' : ''}`],
  ];
}
function sessionCaps(E) {
  const num = esc(E.num), { start, other, off } = E, n = E.now;
  const march = n === 4 ? (off || E.isLaw ? `${num} moved to the ${other}.` : `${num} did it all again in the ${other}, and passed.`)
    : n === 3 ? (E.stopped ? `${num} moved to the ${other}, and stopped there.` : off ? `${num} moved to the ${other}.` : `${num} is in the ${other} now.`)
    : E.stopped ? `${num} stopped before it got there.` : `${num} is still in the ${start}.`;
  const april = E.isLaw ? (E.signed && E.law ? `Both sides passed the same wording, and the Governor signed it on ${esc(E.signed)}. It became law: ${esc(E.law)}. About 1 in 10 bills gets this far.`
      : `Both sides passed the same wording, and it became law${E.law ? `: ${esc(E.law)}` : ''}. About 1 in 10 bills gets this far.`)
    : 'Both sides must pass the same wording by early May. Then the Governor has until mid-July to sign or veto it. About 1 in 10 bills becomes law.';
  // Checked 9/21 against the Public Access Room: first crossover was 12 Mar 2026, the session ended 8 May, the Governor
  // had until 15 July to sign or veto, and about 1 in 10 bills becomes law (252 of 2,463 in our data).
  return [
    ['January: bills start', `Lawmakers ${off ? 'introduced' : 'introduce'} more than 2,000 new bills, each in the House or the Senate. ${num} started in the ${start}.`],
    ['February: committees decide', 'Committees are small groups of lawmakers, each on a topic like health. A bill needs a yes from every one it’s sent to. More than half stop here.'],
    ['March: switch sides (“crossover”)', `A bill that passes one side moves to the other and does it all again. ${march}`],
    ['April to July: final votes, then the Governor', april],
  ];
}
const pastTense = E => E.hear.past && !E.hear.example;
function hearCaps(E) {
  const H = E.hear;
  if (pastTense(E)) {
    const did = H.outcome === 'passed_amended' ? 'passed it with changes' : H.outcome === 'passed' ? 'passed it' : '';
    return [
      ['Before the hearing', `The committee posted a notice a few days ahead. Anyone could send a short note saying what they think (“testimony”), due ${H.ahead} before.`],
      ['At the hearing', H.outcome === 'deferred' ? 'The committee heard from people, then put it off (“deferred”). That usually stops a bill for the year.'
        : `The committee heard from people, then ${did || 'voted'}. A bill that’s put off (“deferred”) usually stops for the year.`],
    ];
  }
  return [
    ['Before the hearing', `The committee posts a notice a few days ahead. You can send a short note saying what you think (“testimony”), due ${H.ahead} before.`],
    ['At the hearing', 'The committee hears from people, then decides: pass it, pass it with changes, or put it off (“deferred”). That usually stops it for the year.'],
  ];
}

// ---------------------------------------------------------------- shared parts: caption, step dots, timers, scrolling
// Each lesson's step (and the hearing's answer) lives here between draws, so Back and a redraw can bring it back.
// L.answered is kept for the example as a whole: onAnswer is called once, however often the lesson is walked again.
const ST = { bill: { step: 1 }, session: { step: 1, mineAt: 0 }, hearing: { step: 1, quiz: null, shown: false } };
const L = { name: null, E: null, key: '', run: 0, timers: new Set(), onAnswer: null, toks: null, answered: false };
const fresh = name => { ST[name] = name === 'bill' ? { step: 1 } : name === 'session' ? { step: 1, mineAt: 0 } : { step: 1, quiz: null, shown: false }; };
const rootOf = name => document.querySelector(`.lx[data-lx="${name}"]`);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
// A pause that only exists when things move (fx.later), remembered so lessonStop can cancel it.
function after(fn, ms) { let id; id = later(() => { L.timers.delete(id); fn(); }, ms); L.timers.add(id); return id; }
// Restart a one-off animation class (the caption's entrance, the label's status, the law's tick).
function play(el, cls) { if (!el) return; el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); }
// "No motion replayed" (back and redraw): the end state is set directly, then every transition and animation the
// change started is finished at once.
function settle(root) {
  if (!root) return; void root.getBoundingClientRect();
  (document.getAnimations ? document.getAnimations() : []).forEach(a => { const t = a.effect && a.effect.target; if (t && root.contains(t)) { try { a.finish(); } catch { /* an endless one */ } } });
}
const capHTML = ([h, p], num) => `${num ? `<span class="lx-capnum" aria-hidden="true">${num}</span>` : ''}<div><h2>${h}</h2><p>${p}</p></div>`;
function caption(c, { num = 0, swap = true } = {}) {
  const el = $('#lx-cap'); if (!el) return;
  el.classList.toggle('lx-nonum', !num); el.innerHTML = capHTML(c, num);
  if (swap) play(el, 'lx-swap'); else el.classList.remove('lx-swap');
}
// The caption keeps the height of its longest step, so what sits under it (the quiz, the dots, a laptop's Next) never
// jumps when the step changes, and no step leaves a gap. Measured at the page's own width, and again when the window
// or the fonts change.
function fitCaption() {
  const root = L.name && rootOf(L.name), cap = root && $('#lx-cap', root); if (!cap || !L.E) return;
  const caps = L.name === 'bill' ? billCaps(L.E) : L.name === 'session' ? sessionCaps(L.E) : hearCaps(L.E), num = L.name === 'bill';
  const probe = document.createElement('div');
  probe.className = `lx-caption${num ? '' : ' lx-nonum'}`; probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;min-height:0;pointer-events:none';
  root.appendChild(probe);
  let h = 0; caps.forEach((c, i) => { probe.innerHTML = capHTML(c, num ? i + 1 : 0); h = Math.max(h, probe.getBoundingClientRect().height); });
  probe.remove(); cap.style.minHeight = `${Math.ceil(h)}px`;
}
let resizeRaf = 0;
function onResize() {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => { fitCaption(); if (L.name === 'session' && L.E && rootOf('session')) placeBill(minePoints()[ST.session.mineAt]); });
}
const dotsHTML = labels => `<div class="lx-beats" role="group" aria-label="Steps">${labels.map((l, i) =>
  `<button type="button" class="lx-beat" data-lx-beat="${i + 1}" aria-label="${i + 1}: ${esc(l)}"${i ? '' : ' aria-current="step"'}></button>`).join('')}</div>`;
function paintDots(root, k) {
  $$('.lx-beat', root).forEach(b => { const n = +b.dataset.lxBeat; b.classList.toggle('lx-done', n < k);
    if (n === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
}
// The part of the page the phone's sticky header and fixed bottom bar leave in view (on a wide screen the bar sits in
// the page, so only the window's edge counts).
function bounds() {
  const hdr = document.querySelector('.hdr'), top = (hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0) + 8;
  const bar = document.querySelector('.actionbar'), fixed = bar && getComputedStyle(bar).position === 'fixed';
  return { top, bottom: (fixed ? bar.getBoundingClientRect().top : innerHeight) - 8 };
}
// Keep the part being explained and its caption in view, clear of the header and the bar (the prototype's reveal).
function reveal(target, cap) {
  requestAnimationFrame(() => {
    if (!cap || !cap.isConnected) return;
    const { top, bottom } = bounds(), c = cap.getBoundingClientRect(), t = target ? target.getBoundingClientRect() : c;
    let dy = 0;
    if (t.top < top) dy = t.top - top;
    else if (c.bottom > bottom) dy = Math.min(c.bottom - bottom, t.top - top);
    if (Math.abs(dy) > 4) scrollBy({ top: dy, behavior: reduced() ? 'auto' : 'smooth' });
  });
}

// ================================================================ 1. Reading a bill
// The real bill page in miniature, from the page's own parts (situation() and railHTML() from bill.js, posChip from
// ui.js), so the two can never disagree. Pin 1 lights the name, number, summary and HIPHI's position; pin 2 the status,
// the dots and the action button with its deadline. The picture is aria-hidden (the caption says it), but its numbered
// pins look pressable, so a tap on a pinned part jumps to that step (A-12); keyboards have Next and the dots.
function ctaHTML(E) {
  const x = E.x, h = x.act && x.act.h;
  const dl = h ? (h.testimony_deadline || new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString()) : '';
  const due = dl ? `${x.act.late ? 'was due' : 'due'} ${dateLong(dl)}, ${timeWord(dl)}` : '';
  const btn = (ic, label, line) => `<span class="lx-mcta">${icon(ic)}<span>${esc(label)}</span></span>${line ? `<p class="lx-mdue">${esc(line)}</p>` : ''}`;
  // The same button the bill page shows for this person (bill.js mainButton), and "Due", never "Closes" (late
  // testimony is still taken, marked late: the second review, 9/21).
  switch (x.kind) {
    case 'email': return btn('mail', 'Send a quick email · 2 min', due && `Testimony ${due}`);
    case 'testify': return btn('notebook-pen', 'Write my testimony · 5 min', due && due[0].toUpperCase() + due.slice(1));
    case 'capitol': return btn('landmark', x.act ? 'Testify at the Capitol site' : 'See the Capitol bill page', x.act && due ? `Testimony ${due}` : '');
    case 'ask': return btn('mail', x.chairs.length > 1 ? 'Ask the chairs for a hearing' : 'Ask the chair for a hearing', 'A short email. About 2 minutes.');
    case 'hold': return btn('mail', 'Email the chair · 2 min', '');
    case 'law': return `<span class="lx-mcta lx-done">${icon('circle-check')}<span>Became law</span></span>`;
    case 'stopped': return `<span class="lx-mcta lx-stop">${icon('archive')}<span>Stopped this session</span></span>`;
    default: return btn('share-2', 'Share this bill', '');
  }
}
// The status line: the bill page's own sentence, except that a hearing ahead is said the prototype's short way
// ("Passed the House. Two Senate committees hear it together on Friday.") so it fits the miniature.
function statusLine(E) {
  const x = E.x, st = x.st, H = E.hear;
  if (x.law) return `Became law${E.law ? `: ${E.law}` : ''}${E.law && E.signed ? `, signed ${E.signed}, ${E.year}` : ''}.`;
  if (x.live && !H.example && !H.past) {
    const passed = st.leg === 'second' ? `Passed the ${st.chamber === 'H' ? 'Senate' : 'House'}. ` : '';
    const n = H.codes.length, ch = CHAMBER_NAME[S.committees[H.codes[0]]?.chamber] || '';
    const who = n > 1 ? `${NUMW[n] || n} ${ch} committees hear it together` : `The ${cmteLabel(H.codes[0])} hears it`;
    return `${passed}${who} on ${H.when}.`;
  }
  return plainStatus(E.b).text;
}
function billMain(E) {
  // Only the seven dots and the "Now" line: the page's "See all steps" fold would be a control inside a picture.
  const rail = E.rail.replace(/<details class="bl-steps"[\s\S]*?<\/details>/, '');
  const caps = billCaps(E);
  return `<div class="lx lx-l-bill" data-lx="bill">
    <div class="lx-pic lx-minipic" aria-hidden="true">
      <div class="lx-mini" id="lx-mini" data-beat="0">
        <div class="lx-mbar">${icon('arrow-left')}<span>${esc(E.num)}</span>${icon('star')}</div>
        <div class="lx-msec" data-lx-sec="1"><p class="lx-mname">${esc(E.name)}</p><p class="lx-mnum">${esc(E.num)}</p><span class="lx-pin">1</span></div>
        <div class="lx-msec" data-lx-sec="1">${E.sum ? `<p class="lx-msum">${esc(E.sum)}</p>` : ''}${posChip(E.b)}</div>
        <div class="lx-msec" data-lx-sec="2"><p class="lx-mstatus">${esc(statusLine(E))}</p><div class="bl-page lx-mrail">${rail}</div><span class="lx-pin">2</span></div>
        <div class="lx-msec" data-lx-sec="2">${ctaHTML(E)}</div>
      </div>
    </div>
    <div class="lx-caption" id="lx-cap" aria-live="polite">${capHTML(caps[0], 1)}</div>
    ${dotsHTML(caps.map(c => c[0]))}
  </div>`;
}
function billSet(k, { instant = false, initial = false } = {}) {
  const root = rootOf('bill'), mini = $('#lx-mini'); if (!root || !mini) return;
  L.run++; ST.bill.step = k; mini.dataset.beat = k;
  $$('.lx-msec', mini).forEach(s => { const j = +s.dataset.lxSec; s.classList.toggle('lx-cur', j === k); s.classList.toggle('lx-seen', j < k); });
  if (instant) mini.classList.remove('lx-play'); else play(mini, 'lx-play');
  caption(billCaps(L.E)[k - 1], { num: k, swap: !instant });
  paintDots(root, k);
  if (!initial && !instant) reveal($(`.lx-msec[data-lx-sec="${k}"]`, mini), $('#lx-cap'));
}

// ================================================================ 2. The session, January to May
// The Capitol (viewBox 360x252): the Governor's office on the roof, the House (left) and Senate (right) cones, the tray
// of bills stopped for the year along the bottom. Every moving thing is named on the picture, and one thing moves at a
// time: the other bills first (from 300 ms, 0.7 s each), then the person's bill alone (from 1150 ms, 1 s along a curve);
// in March the order flips. A faint dashed outline stays where the bill was, and one label under it says its number,
// then where it is in the bill page's words. The real bill moves with the months up to where it is now, then stays, and
// its label says what is ahead.
const HX = 112, SX = 248, GOV = [180, 34], VW = 360, VH = 252, RH = 236;
const pct = (x, y) => `left:${(x / VW * 100).toFixed(2)}%;top:${(y / VH * 100).toFixed(2)}%`;
const MONTHS = [['Jan', 'Bills start'], ['Feb', 'Committees'], ['Mar', 'Switch sides'], ['Apr–Jul', 'Final votes']];
function journeyToks(E) {
  const toks = [], wideGov = E.now === 4;   // the person's own bill is at the Governor: the two laws make room for it
  for (let i = 0; i < 26; i++) {
    const side = i % 2, x0 = side ? SX : HX, rnd = n => { const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
    const x1 = x0 - 44 + rnd(1) * 88, y1 = 146 + rnd(2) * 22, dead = i % 13 !== 0 && i % 3 !== 0 && i % 7 !== 0;   // about half stop at their first committees
    // the ones that pass sit beside the person's bill, never under its label; after crossover, beside it again
    const sgn = rnd(10) < .5 ? -1 : 1, x2 = x0 + sgn * (24 + rnd(3) * 26), y2 = 92 + rnd(4) * 18;
    const x3 = (side ? HX : SX) + sgn * (24 + rnd(5) * 28), y3 = 130 + rnd(6) * 16;
    const law = i % 13 === 0, pile = k => [22 + ((i * 37 + k * 11) % 316), 230 + ((i * 7) % 3) * 3];
    const gov = [GOV[0] + (i ? 1 : -1) * (wideGov ? 17 : 8), 38];   // the two that become law end inside the Governor's office
    toks.push({ i, dead, law, pos: [[x0 - 40 + rnd(7) * 80, 70 + rnd(8) * 8], [x1, y1], dead ? pile(0) : [x2, y2], dead ? pile(0) : [x3, y3], law ? gov : dead ? pile(0) : pile(1)] });
  }
  return toks;
}
function journeyHTML(E, toks) {
  const a = E.start === 'House' ? HX : SX, b = E.start === 'House' ? SX : HX;
  const cone = cx => `M${cx - 58} 182 C ${cx - 42} 162, ${cx - 27} 138, ${cx - 11} 128 H ${cx + 11} C ${cx + 27} 138, ${cx + 42} 162, ${cx + 58} 182 Z`;
  const cols = [30, 46, 62, 298, 314, 330].map(x => `<path d="M${x} 182V69l-5-8h10l-5 8z" fill="var(--p700)"/>`).join('');
  const future = !E.off && !E.stopped && E.now < 4;
  return `<svg class="lx-sv" viewBox="0 0 ${VW} ${VH}" focusable="false">
      <defs><marker id="lx-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--p700)"/></marker></defs>
      <g class="lx-gov"><rect x="${GOV[0] - 22}" y="26" width="44" height="22" rx="3" fill="var(--p800)"/><rect x="${GOV[0] - 16}" y="32" width="8" height="8" rx="1" fill="var(--p200)"/><rect x="${GOV[0] - 4}" y="32" width="8" height="8" rx="1" fill="var(--p200)"/><rect x="${GOV[0] + 8}" y="32" width="8" height="8" rx="1" fill="var(--p200)"/></g>
      <rect x="18" y="48" width="324" height="7" rx="2" fill="var(--p900)"/><rect x="22" y="55" width="316" height="6" fill="var(--p800)"/>
      ${cols}
      <path class="lx-cone" id="lx-hcone" d="${cone(HX)}"/><path class="lx-cone" id="lx-scone" d="${cone(SX)}"/>
      <rect x="14" y="182" width="332" height="6" rx="2" fill="var(--p800)"/>
      <rect class="lx-tray" x="8" y="222" width="344" height="26" rx="10"/>
      <path class="lx-xarc" d="M${a} 96 Q 180 34 ${b} 112" fill="none" stroke="var(--p700)" stroke-width="2.5" stroke-dasharray="5 5" marker-end="url(#lx-arrow)"/>
      <g>${toks.map(t => `<g class="lx-tok lx-pre" data-i="${t.i}" style="--d:${(t.i % 9) * 25}ms;transform:translate(${t.pos[0][0].toFixed(1)}px,${t.pos[0][1].toFixed(1)}px)"><rect x="-5" y="-7" width="10" height="13" rx="1.5"/></g>`).join('')}</g>
      ${future ? `<path class="lx-future" d="M${b} 115 Q ${b} 60 ${GOV[0] + (E.start === 'House' ? 24 : -24)} 37" stroke="var(--p700)" stroke-width="2" stroke-dasharray="4 5" fill="none"/>` : ''}
      <g class="lx-lawmark" id="lx-lawmark"><circle cx="${GOV[0] + 36}" cy="37" r="11" fill="var(--ok-text)"/><path d="M${GOV[0] + 31} 37l4 4 7-8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="lx-ghost" id="lx-ghost" transform="translate(-99 -99)"><rect x="-13" y="-17" width="26" height="34" rx="3"/></g>
      <g class="lx-mine lx-pre" id="lx-mine" transform="translate(${a} 70)"><g class="lx-mi"><rect class="lx-paper" x="-13" y="-17" width="26" height="34" rx="3"/><rect class="lx-tab" x="-13" y="-17" width="26" height="8" rx="3"/>
        <path d="M-7 -2h14M-7 4h14M-7 10h9" stroke="var(--p300)" stroke-width="2" stroke-linecap="round"/></g></g>
    </svg>
    <span class="lx-jl lx-jl-gov" style="${pct(GOV[0], 14)}">GOVERNOR</span><span class="lx-jl" style="${pct(HX, 211)}">HOUSE</span><span class="lx-jl" style="${pct(SX, 211)}">SENATE</span>
    <span class="lx-jtag lx-jnew" style="${pct(180, 78)}">2,000+ new bills</span>
    <span class="lx-jtag lx-jstop" style="${pct(14, 235)}">${icon('x')}Stopped for the year</span>
    <span class="lx-jtag lx-jcross" style="${pct(180, 66)}">Crossover</span>
    <span class="lx-jbill lx-pre" id="lx-jbill" style="${pct(a, 91)}"><b>${esc(E.num)}</b><span class="lx-jst" id="lx-jst"></span></span>`;
}
// "Today" sits on the month the session is in, in session only.
function todayMonth(E) {
  if (E.off || sessionInfo().phase !== 'in') return 0;
  const m = +new Date().toLocaleDateString('en-US', { timeZone: HST, month: 'numeric' });
  return m <= 1 ? 1 : m === 2 ? 2 : m === 3 ? 3 : 4;
}
function sessionMain(E) {
  L.toks = journeyToks(E);
  const today = todayMonth(E);
  return `<div class="lx lx-l-session" data-lx="session">
    <div class="lx-pic lx-scene lx-journey" id="lx-journey" data-beat="0" aria-hidden="true">${journeyHTML(E, L.toks)}</div>
    <div class="lx-months" role="group" aria-label="The session, by month">${MONTHS.map(([m, s], i) =>
      `<button type="button" class="lx-month" data-lx-month="${i + 1}"${i ? '' : ' aria-current="step"'}>${m} <small>${s}</small>${today === i + 1 ? ' <span class="lx-today">Today</span>' : ''}</button>`).join('')}</div>
    <div class="lx-caption lx-nonum" id="lx-cap" aria-live="polite">${capHTML(sessionCaps(E)[0], 0)}</div>
  </div>`;
}
function minePoints() {
  const E = L.E, a = E.start === 'House' ? HX : SX, b = E.start === 'House' ? SX : HX;
  const base = innerWidth < 360 ? 128 : 134;   // a little higher on the smallest phones, so its label clears HOUSE and SENATE
  return { 0: [a, 70], 1: [a, base], 2: [a, 100], 3: [b, base], 4: [GOV[0], 37] };
}
function mineCurve(from, to) {
  const P = minePoints(), A = P[from], B = P[to];
  if (Math.abs(from - to) === 1 && Math.min(from, to) === 2) return [A, [180, 40], B];   // the crossover arcs over the middle
  return [A, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - (to === 4 || from === 4 ? 30 : 0)], B];
}
// One label under the bill, its number and its status, never covering it and kept inside the picture.
function placeBill(p) {
  const lb = $('#lx-jbill'), j = $('#lx-journey'); if (!lb || !j) return;
  lb.setAttribute('style', pct(p[0], p[1] < 60 ? 64 : p[1] + 21));
  const sc = j.getBoundingClientRect(), r = lb.getBoundingClientRect();
  const dx = r.left < sc.left + 4 ? sc.left + 4 - r.left : r.right > sc.right - 4 ? sc.right - 4 - r.right : 0;
  if (dx) lb.style.marginLeft = `${dx}px`;
}
// What the label says in month k: the month's step while the bill is taking it; after that, what is ahead of it (or,
// for a bill that stopped, where it stopped).
function mineLabel(E, k) {
  if (k > E.now) return E.stopped ? [E.stat || 'Stopped this session', 'stop']
    : [k === 2 ? 'Next: committee votes' : k === 3 ? 'Later: the other side' : 'Later: final votes', 'next'];
  if (k === 1) return ['Introduced', ''];
  if (k === 2) return ['Passed its committees', 'ok'];
  if (k === 3) return [k === E.now && !E.stopped && E.stat ? E.stat : `In ${E.other} committees`, 'here'];
  if (E.isLaw) return [E.signed ? 'Signed into law' : 'Became law', 'ok'];   // "signed" only when the Capitol says so
  if (E.stopped) return [E.stat || 'Vetoed by the Governor', 'stop'];
  return ['On the Governor’s desk', 'here'];
}
function sessionSet(k, { instant = false, initial = false } = {}) {
  const E = L.E, st = ST.session, root = rootOf('session'), j = $('#lx-journey'); if (!root || !j) return;
  const run = ++L.run, quick = instant || reduced(), P = minePoints(), from = st.mineAt, target = Math.min(k, E.now);
  const steps = []; if (target !== from) { const d = target > from ? 1 : -1; for (let s = from; s !== target; s += d) steps.push([s, s + d]); }
  const mineFirst = k === 3 && steps.length > 0, od = quick ? 0 : mineFirst ? 1400 : 300, md = quick ? 0 : mineFirst ? 300 : 1150;
  st.step = k; j.dataset.beat = k; j.style.setProperty('--od', `${od}ms`);
  L.toks.forEach(t => { const g = $(`.lx-tok[data-i="${t.i}"]`, j); if (!g) return; const p = t.pos[k]; g.classList.remove('lx-pre');
    g.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`; g.classList.toggle('lx-dead', (k >= 2 && t.dead) || (k >= 4 && !t.law)); });
  const house = E.start === 'House';
  $('#lx-hcone', j).classList.toggle('lx-lit', ((k === 1 || k === 2) && house) || (k === 3 && !house));
  $('#lx-scone', j).classList.toggle('lx-lit', ((k === 1 || k === 2) && !house) || (k === 3 && house));
  const mine = $('#lx-mine', j), lb = $('#lx-jbill', j), jst = $('#lx-jst', j), gh = $('#lx-ghost', j), lm = $('#lx-lawmark', j);
  const law = E.isLaw && target === 4;
  // A month tapped while the bill is still on its way: its trip stops where it is, and the next one starts from there
  // (or, when this month keeps it where it was going from, it goes back), so the bill and its label never part.
  stopTravel(mine);
  const tm = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(mine.getAttribute('transform') || ''), cur = tm ? [+tm[1], +tm[2]] : P[from];
  if (!steps.length && !mine.classList.contains('lx-pre') && Math.hypot(cur[0] - P[target][0], cur[1] - P[target][1]) > 1) steps.push([target, target]);
  if (!law) lm.classList.remove('lx-on', 'lx-play');
  mine.classList.toggle('lx-atgov', target === 4);
  mine.classList.toggle('lx-dead', E.stopped && k > E.now);
  const land = () => {
    st.mineAt = target; const [txt, kind] = mineLabel(E, k);
    jst.textContent = txt; lb.className = `lx-jbill lx-st-on${kind ? ' lx-' + kind : ''}`; if (!quick) play(lb, 'lx-play');
    placeBill(P[target]);
    lm.classList.toggle('lx-on', law); if (law && !quick) play(lm, 'lx-play');
  };
  let first = true;
  const hop = () => { if (run !== L.run) return; const s = steps.shift(); if (!s) { land(); return; }
    const c = mineCurve(s[0], s[1]);
    if (first) { first = false; c[0] = cur; if (s[0] === s[1]) c[1] = [(cur[0] + c[2][0]) / 2, (cur[1] + c[2][1]) / 2]; }
    travel(mine, c, quick ? 0 : steps.length ? 520 : 1000, hop, placeBill); };
  if (steps.length) {
    // a faint dashed outline stays where the bill was, so the move reads as a move (the second review, 9/21)
    if (from > 0 && from !== target) { gh.setAttribute('transform', `translate(${P[from][0]} ${P[from][1]})`); gh.classList.add('lx-on'); } else gh.classList.remove('lx-on');
    lb.className = `lx-jbill${mine.classList.contains('lx-pre') ? ' lx-pre' : ''}`; jst.textContent = '';
    const go = () => { if (run !== L.run) return; mine.classList.remove('lx-pre'); lb.classList.remove('lx-pre'); hop(); };
    if (quick) go(); else after(go, md);
  } else { mine.classList.remove('lx-pre'); lb.classList.remove('lx-pre'); gh.classList.remove('lx-on'); land(); }
  $$('.lx-month', root).forEach(b => { if (+b.dataset.lxMonth === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  caption(sessionCaps(E)[k - 1], { swap: !instant });
  if (!initial && !instant) reveal(j, $('#lx-cap'));
}

// ================================================================ 3. What a hearing is
// Step 1, before the hearing: the notice drops in over a dimmed room and stays 3 s, then shrinks to "Notice posted
// <day>"; a letter flies from a phone to the committee table and a chip says "Testimony is open". The rule is taught
// first, then "Try it" asks when testimony is due, with three answers side by side (the right one in the middle). Only
// an answer (or Next) turns the chip into "Testimony due ...": green and a small burst when right, blue information
// when not, never red, no score. Step 2, at the hearing: LIVE, talk bubbles, the chair ringed, hands at 2.3 s; at 2.6 s
// LIVE gives way to the three ways it can go. Under Reduce Motion the notice stays up with the phone and the chip.
function roomSVG() {
  const members = [[60, 84, 'var(--p600)'], [120, 71, 'var(--p700)'], [180, 66, 'var(--p900)'], [240, 71, 'var(--p700)'], [300, 84, 'var(--p600)']];
  const fig = ([x, y, c], i) => `<g class="lx-fig"><circle cx="${x}" cy="${y}" r="10" fill="${c}"/><path d="M${x - 17} ${y + 32} C ${x - 16} ${y + 16}, ${x + 16} ${y + 16}, ${x + 17} ${y + 32} Z" fill="${c}"/>
    <path class="lx-hand" style="--d:${2300 + i * 90}ms" d="M${x + 13} ${y + 22} L${x + 19} ${y - 6}" stroke="${c}" stroke-width="6" stroke-linecap="round"/></g>`;
  return `<svg class="lx-sv" viewBox="0 0 ${VW} ${RH}" focusable="false">
    <circle class="lx-chairring" cx="180" cy="66" r="15" fill="none" stroke="var(--p400)" stroke-width="3"/>
    ${members.map(fig).join('')}
    <path d="M14 116 Q180 84 346 116 L346 146 Q180 114 14 146 Z" fill="var(--p800)"/>
    <rect x="170" y="104" width="20" height="7" rx="2" fill="var(--p100)"/>
    <g class="lx-stackp"><rect x="128" y="99" width="22" height="7" rx="1" fill="var(--n0)" stroke="var(--p300)"/><rect x="130" y="95" width="22" height="7" rx="1" fill="var(--n0)" stroke="var(--p300)"/><rect x="132" y="91" width="22" height="7" rx="1" fill="var(--n0)" stroke="var(--p300)"/></g>
    <g class="lx-bubble lx-b1"><rect x="196" y="36" width="44" height="22" rx="11" fill="var(--n0)"/><circle cx="208" cy="47" r="2.4" fill="var(--p700)"/><circle cx="218" cy="47" r="2.4" fill="var(--p700)"/><circle cx="228" cy="47" r="2.4" fill="var(--p700)"/></g>
    <rect x="112" y="162" width="136" height="12" rx="4" fill="var(--p900)"/><path d="M180 162v-14" stroke="var(--n700)" stroke-width="2.5"/><circle cx="180" cy="146" r="4" fill="var(--n700)"/>
    <g class="lx-bubble lx-b2"><rect x="200" y="176" width="44" height="22" rx="11" fill="var(--n0)"/><circle cx="212" cy="187" r="2.4" fill="var(--p700)"/><circle cx="222" cy="187" r="2.4" fill="var(--p700)"/><circle cx="232" cy="187" r="2.4" fill="var(--p700)"/></g>
    <circle cx="180" cy="196" r="13" fill="var(--p400)"/><path d="M152 236 C 153 214, 207 214, 208 236 Z" fill="var(--p400)"/>
    ${[26, 48, 70, 92, 268, 290, 312, 334].map((x, i) => `<rect x="${x - 9}" y="${204 + (i % 2) * 4}" width="18" height="24" rx="6" fill="var(--p200)"/>`).join('')}
    <g class="lx-phone"><rect x="22" y="150" width="26" height="46" rx="5" fill="var(--n900)"/><rect x="25" y="156" width="20" height="32" rx="2" fill="var(--p100)"/></g>
    <g id="lx-letter" transform="translate(35 172)" opacity="0"><rect x="-9" y="-6" width="18" height="12" rx="1.5" fill="var(--n0)" stroke="var(--p700)" stroke-width="1.5"/><path d="M-9 -6 L0 1 L9 -6" fill="none" stroke="var(--p700)" stroke-width="1.5"/></g>
    <rect class="lx-dim" x="0" y="0" width="${VW}" height="${RH}" fill="rgba(9,53,70,.45)"/>
  </svg>`;
}
// The testimony chip: "open" while the question waits, the time it is due once answered (the picture must not give the
// answer away), and "due", never "closes".
const closesChip = (E, known) => { const H = E.hear, past = pastTense(E);
  return known ? `${icon('clock')}<span>Testimony ${past ? 'was due' : 'due'} <span class="lx-nobr">${esc(H.dueDate)}, ${esc(H.dueTime)}</span></span>` : `${icon('mail')}<span>Testimony ${past ? 'was' : 'is'} open</span>`; };
function feedHTML(E, i) {
  if (i === null || i === undefined) return '';
  const H = E.hear, right = `${H.dueDay} at ${H.dueTime}`;
  return i === 1 ? `<div class="lx-qfeed">${icon('circle-check')}<p><b>Yes: ${esc(H.ahead)} before.</b> No need to count: we can remind you.</p></div>`
    : `<div class="lx-qfeed lx-meh">${icon('info')}<p><b>It${pastTense(E) ? ' was' : '’s'} due ${esc(H.ahead)} before: ${esc(right)}.</b> No need to count: we can remind you.</p></div>`;
}
function quizHTML(E, chosen) {
  const H = E.hear, past = pastTense(E), num = esc(E.num);
  const opts = [[H.day, past ? 'just before it started' : 'just before it starts'], [H.dueDay, `at ${H.dueTime}`], [dayBefore(H.dueDay), `at ${H.dueTime}`]];
  const cls = i => chosen === null ? '' : i === 1 && chosen === 1 ? ' lx-right' : i === chosen ? ' lx-wrong' : i === 1 ? ' lx-answer' : '';
  return `<div class="lx-quiz" role="group" aria-labelledby="lx-qq"><p class="lx-q" id="lx-qq"><span class="lx-qtag">Try it</span> ${H.example ? 'Say a hearing is' : `${num}’s hearing ${past ? 'was' : 'is'}`} ${esc(H.day)} at ${esc(H.time)}. ${past ? 'When was' : 'When is'} testimony due?</p>
    <div class="lx-qopts">${opts.map(([a, b], i) => `<button type="button" class="lx-qopt${cls(i)}" data-lx-q="${i}" aria-pressed="${chosen === i}"${chosen === null ? '' : ' aria-disabled="true"'}><span>${esc(a)}</span> <span>${esc(b)}</span></button>`).join('')}</div>
    <div id="lx-qfeed" aria-live="polite">${feedHTML(E, chosen)}</div></div>`;
}
function chairsHTML(E) {
  const ch = E.chairs; if (!ch.length) return '';
  return `<p class="lx-chairline"><span class="lx-pics" aria-hidden="true">${ch.map(l => legPhoto(l, 'lx-legmini')).join('')}</span><span>${ch.length > 1 ? 'Chairs' : 'Chair'}: ${esc(words(ch.map(l => `${legTitle(l)} ${l.name}`)))}. ${ch.length > 1 ? 'They pick' : 'The chair picks'} which bills get a hearing.</span></p>`;
}
function hearingMain(E) {
  const H = E.hear, caps = hearCaps(E);
  return `<div class="lx lx-l-hearing" data-lx="hearing">
    <div class="lx-pic lx-scene lx-room" id="lx-room" data-beat="0" aria-hidden="true">${roomSVG()}
      <div class="lx-notice"><p class="lx-nt">NOTICE OF HEARING${H.example ? ' · EXAMPLE' : ''}</p><p class="lx-nc">${esc(H.brief)}</p>
        <p class="lx-nw">${esc(H.date)} · ${esc(H.time)} · ${esc(H.room)}</p><p class="lx-nb"><b>${esc(E.num)}</b> · ${esc(E.name)}</p></div>
      ${H.posted ? `<span class="lx-posted">${icon('file-text')}<span>Notice posted ${esc(H.posted)}</span></span>` : ''}
      <div class="lx-closes" id="lx-closes">${closesChip(E, false)}</div>
      <span class="lx-live"><i></i>LIVE</span>
      <div class="lx-outcomes"><span class="chip ok" style="--d:0ms">${icon('check')}Pass</span><span class="chip ok" style="--d:90ms">${icon('check')}Pass with changes</span><span class="chip lx-putoff" style="--d:180ms">${icon('x')}Put off</span></div>
    </div>
    <div class="lx-caption lx-nonum" id="lx-cap" aria-live="polite">${capHTML(caps[0], 0)}</div>
    <div class="lx-hextra" id="lx-hextra">${quizHTML(E, null)}</div>
    ${dotsHTML(caps.map(c => c[0]))}
  </div>`;
}
// An answer (i 0-2), or Next before one (-1): the options are marked where they stand, so focus stays on the one chosen
// (aria-disabled, not disabled, which would drop it), and the feedback goes into the live region that is already on the
// page, so a screen reader hears it.
function answer(i) {
  const E = L.E, st = ST.hearing, root = rootOf('hearing'); if (!root || st.quiz !== null) return;
  st.quiz = i;
  $$('.lx-qopt', root).forEach(o => { const q = +o.dataset.lxQ;
    o.setAttribute('aria-pressed', String(q === i)); o.setAttribute('aria-disabled', 'true');
    o.classList.toggle('lx-right', q === 1 && i === 1); o.classList.toggle('lx-wrong', q === i && i !== 1); o.classList.toggle('lx-answer', q === 1 && i !== 1); });
  const fb = $('#lx-qfeed', root); if (fb) fb.innerHTML = feedHTML(E, i);
  const cl = $('#lx-closes', root); if (cl) { cl.innerHTML = closesChip(E, true); play(cl, 'lx-known'); }
  if (i === 1) burst($('.lx-qopt.lx-right', root), 12, 50);
  if (!L.answered) { L.answered = true; try { L.onAnswer && L.onAnswer(i === 1 ? 'right' : i === -1 ? 'shown' : 'wrong'); } catch (e) { console.error(e); } }
  reveal($('.lx-quiz', root), $('#lx-qfeed', root));
}
function hearingSet(k, { instant = false, initial = false } = {}) {
  const E = L.E, st = ST.hearing, root = rootOf('hearing'), room = $('#lx-room'); if (!root || !room) return;
  const run = ++L.run; st.step = k;
  room.dataset.beat = k; room.classList.remove('lx-phase2', 'lx-voted', 'lx-rmstill');
  const letter = $('#lx-letter', room); stopTravel(letter); if (letter) { letter.setAttribute('opacity', '0'); letter.setAttribute('transform', 'translate(35 172)'); }
  caption(hearCaps(E)[k - 1], { swap: !instant });
  paintDots(root, k);
  const x = $('#lx-hextra', root), cl = $('#lx-closes', room);
  if (cl) cl.innerHTML = closesChip(E, st.quiz !== null);
  if (k === 1) {
    if (reduced()) room.classList.add('lx-rmstill');          // the notice stays, with the phone and "Testimony is open"
    else if (instant) room.classList.add('lx-phase2');
    else after(() => {                                         // the notice is held 3 s, then it is posted and testimony flies in
      if (run !== L.run) return; room.classList.add('lx-phase2');
      if (letter) { letter.setAttribute('opacity', '1'); travel(letter, [[35, 172], [80, 60], [141, 92]], 1100, () => after(() => { if (run === L.run) letter.setAttribute('opacity', '0'); }, 200)); }
    }, 3000);
    x.innerHTML = quizHTML(E, st.quiz);
  } else {
    x.innerHTML = chairsHTML(E);
    // the vote: LIVE gives way to the three ways it can go, along the top of the room, once the hands are up
    if (instant) room.classList.add('lx-voted'); else after(() => { if (run === L.run) room.classList.add('lx-voted'); }, 2600);
  }
  if (!initial && !instant) reveal(room, k === 1 ? $('#lx-cap') : (x.innerHTML ? x : $('#lx-cap')));
}

// ---------------------------------------------------------------- the interface
export function lessonHTML(name, E) {
  if (!E || !LESSON_TITLES[name]) return { intro: '', main: '' };
  const intro = `<h1 class="hero lx-h1" id="st-h">${LESSON_TITLES[name]}</h1><p class="lede lx-lede">${ledeOf(name, E)}</p>`;
  const main = name === 'bill' ? billMain(E) : name === 'session' ? sessionMain(E) : hearingMain(E);
  return { intro, main };
}
const SETS = { bill: billSet, session: sessionSet, hearing: hearingSet };
export function lessonStart(name, E, { back = false, redraw = false, onAnswer = null } = {}) {
  lessonStop();
  const root = rootOf(name); if (!E || !root || !SETS[name]) return;
  const key = `${E.id}|${E.off ? 'off' : 'in'}|${E.hear?.id || ''}`;
  if (key !== L.key) { fresh('bill'); fresh('session'); fresh('hearing'); L.key = key; L.answered = false; }
  if (!back && !redraw) fresh(name);
  L.name = name; L.E = E; L.onAnswer = onAnswer;
  if (name === 'session') { ST.session.mineAt = 0; L.toks = journeyToks(E); }   // a new DOM: the bill is back at the start
  if (name === 'hearing') ST.hearing.shown = false;
  root.onclick = e => {
    const t = e.target.closest('[data-lx-beat], [data-lx-month], [data-lx-sec], [data-lx-q]'); if (!t || !root.contains(t)) return;
    if (t.dataset.lxBeat) SETS[name](+t.dataset.lxBeat);
    else if (t.dataset.lxMonth) sessionSet(+t.dataset.lxMonth);
    else if (t.dataset.lxSec) billSet(+t.dataset.lxSec);
    else if (t.dataset.lxQ !== undefined && t.getAttribute('aria-disabled') !== 'true') answer(+t.dataset.lxQ);
  };
  const step = redraw ? ST[name].step : back ? LAST[name] : 1;
  if (back || redraw) { SETS[name](step, { instant: true, initial: true }); settle(root); }
  else { void root.getBoundingClientRect(); SETS[name](1, { initial: true }); }   // the first state is laid out, so step 1 moves
  fitCaption();
  addEventListener('resize', onResize);
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (L.name === name && rootOf(name) === root) fitCaption(); });
}
export function lessonNext(name, E) {
  if (!E || L.name !== name || !rootOf(name)) return false;
  if (name === 'bill') { if (ST.bill.step < LAST.bill) { billSet(ST.bill.step + 1); return true; } return false; }
  if (name === 'session') { if (ST.session.step < LAST.session) { sessionSet(ST.session.step + 1); return true; } return false; }
  if (name === 'hearing') {
    const st = ST.hearing;
    if (st.step === 1 && st.quiz === null) {
      // On a small phone the question can sit under the bar: the first Next brings it into view, the second shows the answer.
      const q = $('.lx-quiz'), { bottom } = bounds();
      if (q && !st.shown && q.getBoundingClientRect().bottom > bottom + 4) {
        st.shown = true; scrollBy({ top: q.getBoundingClientRect().bottom - bottom + 8, behavior: reduced() ? 'auto' : 'smooth' });
        const qq = $('#lx-qq'); if (qq) { qq.setAttribute('tabindex', '-1'); qq.focus({ preventScroll: true }); }
        return true;
      }
      answer(-1); return true;                                 // Next before answering shows the answer
    }
    if (st.step < LAST.hearing) { hearingSet(st.step + 1); return true; }
    return false;
  }
  return false;
}
export function lessonStop() {
  L.run++;
  L.timers.forEach(clearTimeout); L.timers.clear();
  removeEventListener('resize', onResize); cancelAnimationFrame(resizeRaf);
  stopTravel(document.getElementById('lx-mine')); stopTravel(document.getElementById('lx-letter'));
}
