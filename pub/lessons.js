// The lessons of the public tracker, told with the person's own bill. Since 9/29 (R-062, Nate: "Let's use concept 1 as a
// primer for how session works during onboarding") the full first visit teaches ONE lesson, "A bill's story" (story,
// section 4 below): one page in three stages that the page's own Next walks (Nate 9/29: "First it highlights the bill,
// then it moves throughout the process, then it shows why speaking up can help"): the bill itself, its road to where it
// really is, and a choice of what you would do ("Email the chair", "Send testimony", "Tell my legislators", "Stay
// quiet"), each playing what can happen. The three older lessons, "Reading a bill", "The session, January to May" and "What a
// hearing is" (R-023, 9/21), still open on their own at #/learn/<bill|session|hearing>, linked from bill pages and Help. Ported from the prototype Nate approved (backend
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
//   lessonPrev(name)                    Back was pressed: true when the story stepped back a stage, false to leave
//   lessonStep(name)                    the story's stage (1-3), so the lesson page can say Done on the last
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
//                 past, example, outcome ('passed' ... or ''), id, at (ISO), due (ISO), dueReal (the committee posted
//                 the due time; otherwise due is only a guess, which the story never says out loud) }
//   chairs        legislator objects (S.legislators, plus `committee`) chairing hear's committees
//   path          the bill's referral committee codes in order, both sides, joint referrals split ('HHS', 'CPN')
//   mine          the person follows it (S.watch); off, via as given ('link': opened from a shared link;
//                 'followed': opened from a link and its issue just followed; 'bill': a lesson opened from that bill's page)
import { S, esc, icon, nick, blurb, spaced, sessionInfo, hearingsOf, outcomeOf, codesOf, cmteLabel, roomLabel, legPhoto,
  legTitle, posInfo, plainStatus, dateLong, timeWord, HST, CHAMBER_NAME, winsIn, EARLIER_WINS, loadRecapPool } from './core.js';
import { posChip } from './ui.js';
import { situation, railHTML } from './bill.js';
import { reduced, later, burst, travel, stopTravel } from './fx.js';
import { endHome } from './variant.js';

export const LESSON_TITLES = { bill: 'Reading a bill', session: 'The session, January to May', hearing: 'What a hearing is', story: 'A bill’s story' };
const LAST = { bill: 2, session: 4, hearing: 2, story: 3 };   // the story: one page in three stages (9/29)

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
    ahead: hrs === 24 || hrs < 1 ? '24 hours' : hrs % 24 === 0 ? `${hrs / 24} days` : `${hrs} hours`, due, dueReal: !!h.testimony_deadline,
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
    due, dueReal: false, past: false, example: true, outcome: '' };
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
  if (name === 'story') return storyLede(E);
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
// The committees a bill was sent to in the chamber it is in, in words and in order, and which one it is at (R-005,
// DESIGN-AUDIT G-13): "This one is in the Senate’s committees: Health and Commerce together, then Judiciary. It needs a
// yes from each, in that order, and it’s at the first." This is what staff shorthand calls "stop 1 of 2"; the lesson
// says it without the shorthand. Committee names are shortened the way the hearing notice shortens them (shortName).
// Empty when the chamber has no referral yet or a name is missing, and the plain sentence stands alone.
const ORDW = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
function orderWords(E) {
  const b = E.b, st = E.x.st, refs = b.referrals || [];
  if (st.phase !== 'committee' || !refs.length || !st.stop) return '';
  const n = Math.min(b.origin_stops || refs.length, refs.length), list = st.leg === 'second' ? refs.slice(n) : refs.slice(0, n);
  if (!list.length || st.stop > list.length) return '';
  const names = list.map(r => { const cs = codesOf(r).map(c => S.committees[c]?.name);
    if (!cs.length || cs.some(x => !x)) return null;
    // "Ways and Means" says nothing about money to a newcomer; the House's is plainly called Finance.
    const nm = cs.map(x => /^ways and means$/i.test(x) ? 'Ways and Means (the budget committee)' : shortName(x));
    return nm.length > 1 ? `${words(nm)} together` : nm[0]; });
  if (names.some(x => !x)) return '';
  const ch = CHAMBER_NAME[st.chamber] || '';
  if (list.length === 1) return `This one is in one ${ch} committee: ${esc(names[0])}. It needs a yes there to move on.`;
  return `This one is in the ${ch}’s committees: ${esc(names.join(', then '))}. It needs a yes from each, in that order, and it’s at the ${ORDW[st.stop] || 'next'}.`;
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
    : orderWords(E) || `This one is with ${ch} committees now.`;
  return [
    ['What it is', `${what} ${B ? `${B} means ${B === 'HB' ? 'House' : 'Senate'} Bill: it` : 'It'} started in the ${E.start}.`],
    ['Where it is, and how to help', `Each dot is a step toward becoming law. ${where}${E.x.live && !E.off ? ' On the real page, the button at the bottom says how you can help, and by when. This one is only a picture.' : ''}`],
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
      ['At the hearing', H.outcome === 'deferred' ? 'The committee heard from people, then put it on hold (the Capitol says “deferred”). That usually stops a bill for the year.'
        : `The committee heard from people, then ${did || 'voted'}. A bill that’s put off (“deferred”) usually stops for the year.`],
    ];
  }
  return [
    ['Before the hearing', `The committee posts a notice a few days ahead. You can send a short note saying what you think (“testimony”), due ${H.ahead} before.`],
    ['At the hearing', 'The committee hears from people, then decides: pass it, pass it with changes, or put it on hold (the Capitol says “deferred”). That usually stops it for the year.'],
  ];
}

// ---------------------------------------------------------------- shared parts: caption, step dots, timers, scrolling
// Each lesson's step (and the hearing's answer) lives here between draws, so Back and a redraw can bring it back.
// L.answered is kept for the example as a whole: onAnswer is called once, however often the lesson is walked again.
const ST = { bill: { step: 1 }, session: { step: 1, mineAt: 0 }, hearing: { step: 1, quiz: null, shown: false }, story: { step: 1, choice: null } };
const L = { name: null, E: null, key: '', run: 0, timers: new Set(), onAnswer: null, toks: null, answered: false };
const fresh = name => { ST[name] = name === 'session' ? { step: 1, mineAt: 0 } : name === 'hearing' ? { step: 1, quiz: null, shown: false } : name === 'story' ? { step: 1, choice: null } : { step: 1 }; };
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
  if (L.name === 'story') { fitStory(); return; }
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
    case 'email': return btn('mail', 'Send a quick email', due && `Testimony ${due}`);
    case 'testify': return btn('notebook-pen', 'Write my testimony', due && due[0].toUpperCase() + due.slice(1));
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
      <p class="lx-example">${icon('eye')}<span>An example: how a bill looks in the tracker</span></p>
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

// ================================================================ 4. A bill's story, three stages (R-062, Nate 9/29)
// The full first visit's only lesson, and #/learn/story. Nate, 9/29: "The bill's story should be one page, with three
// different animations. First it highlights the bill, then it moves throughout the process, then it shows why speaking
// up can help. The user clicks through each stage." He picked "one choice at the end". So it is ONE page whose drawing
// and short caption change in place, walked with the page's own Next (Back walks back first):
//   1. This is your bill   the bill as a sheet of paper: its number and name, HIPHI's stance as a rubber stamp, and the
//                          chamber it started in. The caption: what it is in plain words, and what HB/SB means.
//   2. Its road            one winding road of stops (its first side's committees and vote, the other side's, the
//                          Governor, the law). The bill travels it up to where it really is, ticking the stops it passed.
//                          The caption: the road in one sentence, and the bill's own next chance (storyNow).
//   3. Why speaking up     who can hear you (the committee and its chair, your own legislators) and a bill waiting. A
//      can help           choice of four, drawn as story choices, not app buttons: "Email the chair", "Send testimony",
//                          "Tell my legislators", "Stay quiet". Each plays what CAN happen (an email reaches the chair
//                          and the chair's hearing list gets a bill; notes land on the committee's table; your
//                          legislators hear from you; nothing is sent, and the bill waits and stops) with one sentence.
//                          The others stay there to try. Then why it matters (few people write in; a real win).
// Where the bill is decides what is true: a law or a stopped bill still gets the choices, asked about next time.
// The drawing is aria-hidden and the words say all of it (A-10: motion is never the only way something is said). Nothing
// else here can be pressed: the four choices are the only controls, and they look like a story's choices, not the app's
// buttons (A-12, C-12). Drawn people are one silhouette each, in one flat colour. Testimony is "due", never "closes".
// Motion (A-10): each stage's movement is short (about 1.5 seconds at most), plays when the person taps, and ends on the
// still picture that says the same thing; Back and a redraw show the still picture; under Reduce Motion the still
// picture shows at once. The drawing sits at the end of the lesson's intro, so on a laptop it stays beside the words.
const SW = 360, SH = 280;
const svgText = (x, y, t, { size = 13, fill = 'var(--p900)', anchor = 'middle', cls = '', ls = 0, weight = 700 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}"${ls ? ` letter-spacing="${ls}"` : ''} fill="${fill}"${cls ? ` class="${cls}"` : ''}>${esc(t)}</text>`;
// One person: a single silhouette in one flat colour (head and body overlap; no outline per part).
const person = (x, y, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><circle cx="0" cy="-30" r="11"/><path d="M-19 16 C-19 -8 -10 -16 0 -16 C10 -16 19 -8 19 16 Z"/></g>`;
const PROPS = {
  mail: (x, y, r = -10) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-9" y="-6.5" width="18" height="13" rx="2" fill="var(--n0)" stroke="var(--p700)" stroke-width="1.8"/><path d="M-9 -6.5 L0 1 L9 -6.5" fill="none" stroke="var(--p700)" stroke-width="1.8" stroke-linejoin="round"/></g>`,
  note: (x, y, r = 8) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-7.5" y="-9.5" width="15" height="19" rx="1.5" fill="var(--n0)" stroke="var(--p700)" stroke-width="1.8"/><path d="M-3.5 -4h7M-3.5 0h7M-3.5 4h4.5" stroke="var(--p400)" stroke-width="1.8" stroke-linecap="round"/></g>`,
  talk: (x, y) => `<g transform="translate(${x} ${y})"><path d="M-12 -8 Q-12 -11 -9 -11 H9 Q12 -11 12 -8 V3 Q12 6 9 6 H-2 L-8 11 L-7 6 H-9 Q-12 6 -12 3 Z" fill="var(--n0)" stroke="var(--p700)" stroke-width="1.8" stroke-linejoin="round"/><circle cx="-5" cy="-2.5" r="1.7" fill="var(--p700)"/><circle cx="0" cy="-2.5" r="1.7" fill="var(--p700)"/><circle cx="5" cy="-2.5" r="1.7" fill="var(--p700)"/></g>`,
};
const smallBill = (stopped = false) => `<g transform="translate(-14 -20)">
  <path d="M0 2 Q0 0 2 0 H22 L28 6 V38 Q28 40 26 40 H2 Q0 40 0 38 Z" fill="${stopped ? 'var(--n100)' : 'var(--n0)'}" stroke="${stopped ? 'var(--n500)' : 'var(--p800)'}" stroke-width="2"/>
  <rect x="-3" y="5" width="20" height="8" rx="2" fill="${stopped ? 'var(--n500)' : 'var(--p700)'}"/><path d="M5 22h16M5 29h16" stroke="${stopped ? 'var(--n300)' : 'var(--p200)'}" stroke-width="3" stroke-linecap="round"/></g>`;

// ---- stage 1: the sheet of paper ----
// The bill's name on the paper, wrapped to three lines at most. The type sizes are the page's own (22, 18 or 16), and a
// line that still comes out too wide is fitted after drawing (fitTitles), never left to run off the paper.
const TITLE_W = 124;
function paperTitle(t) {
  const ws = String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const wrap = max => { const out = []; let cur = '';
    for (const w of ws) { if (!cur) cur = w; else if (`${cur} ${w}`.length <= max) cur += ` ${w}`; else { out.push(cur); cur = w; } }
    if (cur) out.push(cur); return out; };
  for (const fs of [22, 18]) { const max = Math.floor(TITLE_W / (fs * .6)); if (ws.every(w => w.length <= max)) { const lines = wrap(max); if (lines.length <= 3) return { fs, lines }; } }
  const lines = wrap(Math.floor(TITLE_W / (16 * .6)));
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/[,;:.]?$/, '…'); }
  return { fs: 16, lines };
}
function fitTitles(root) {
  $$('.lx-ptitle', root).forEach(t => { try { if (t.getComputedTextLength() > TITLE_W + 2) { t.setAttribute('textLength', TITLE_W); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } catch { /* not drawn yet */ } });
}
// HIPHI's position as the words of a rubber stamp (present tense: a stamp is a stamp), and as the caption's sentence.
const STAMP = { strongly_support: ['STRONGLY', 'SUPPORTS'], support: ['SUPPORTS'], support_amend: ['SUPPORTS', 'WITH', 'CHANGES'],
  strongly_oppose: ['STRONGLY', 'OPPOSES'], oppose: ['OPPOSES'], neutral: ['HAS', 'COMMENTS'] };
const STAND = { strongly_support: ['strongly supports it', 'strongly supported it'], support: ['supports it', 'supported it'],
  support_amend: ['supports it, with changes', 'supported it, with changes'], strongly_oppose: ['strongly opposes it', 'strongly opposed it'],
  oppose: ['opposes it', 'opposed it'], neutral: ['has comments on it', 'had comments on it'] };
function paperSVG(E) {
  const T = paperTitle(E.name), lh = T.fs + 4, titleY = 74, last = titleY + (T.lines.length - 1) * lh;
  const bodyTop = last + 22, nBody = Math.max(1, Math.min(4, Math.floor((186 - bodyTop) / 16) + 1));
  const body = [112, 120, 96, 108].slice(0, nBody).map((w, i) => `<path d="M22 ${bodyTop + i * 16}h${w}"/>`).join('');
  const numW = Math.max(96, String(E.num).length * 12 + 18);
  const words = STAMP[E.b.hiphi_position], cy = Math.max(184, 18 + last + 58);
  const stamp = words ? (() => { const lines = ['HIPHI', ...words], top = 5 - (lines.length - 1) * 7.5;
    return `<g transform="translate(298 ${cy}) rotate(-14)" opacity=".94"><g class="lx-s1stamp">
      <circle r="50" fill="var(--p50)" stroke="var(--p700)" stroke-width="3.5"/><circle r="43" fill="none" stroke="var(--p700)" stroke-width="1.5"/>
      ${lines.map((l, i) => svgText(0, (top + i * 15).toFixed(1), l, { fill: 'var(--p700)', ls: .6 })).join('')}</g></g>`; })() : '';
  return `<g class="lx-lay lx-lay1"><g transform="translate(0 10)">
    <ellipse cx="190" cy="236" rx="150" ry="10" fill="var(--p100)"/>
    <path d="M22 206c10-16 20-34 32-40h18c12 6 22 24 32 40z" fill="var(--p300)"/>
    <rect x="14" y="204" width="98" height="6" rx="3" fill="var(--p800)"/>
    ${svgText(63, 232, E.start.toUpperCase(), { ls: 1.2 })}
    <g class="lx-s1arrow"><path d="M70 158 C 80 104, 112 82, 150 76" fill="none" stroke="var(--p600)" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>
      <path d="M142 68 L154 76 L141 84" fill="none" stroke="var(--p600)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${svgText(110, 180, 'started', { anchor: 'start' })}${svgText(110, 196, 'here', { anchor: 'start' })}</g>
    <g transform="translate(168 18) rotate(-3)"><g class="lx-s1paper">
      <path d="M0 4 Q0 0 4 0 H138 L160 22 V196 Q160 200 156 200 H4 Q0 200 0 196 Z" fill="var(--n0)" stroke="var(--p900)" stroke-width="2"/>
      <path d="M138 0 V22 H160" fill="var(--p100)" stroke="var(--p900)" stroke-width="2" stroke-linejoin="round"/>
      <rect x="-8" y="16" width="${numW}" height="30" rx="4" fill="var(--p700)"/>
      ${svgText(numW / 2 - 8, 37, E.num, { size: 18, fill: 'var(--n0)' })}
      ${T.lines.map((l, i) => svgText(20, titleY + i * lh, l, { size: T.fs, fill: 'var(--n900)', anchor: 'start', cls: 'lx-ptitle' })).join('')}
      <g stroke="var(--p200)" stroke-width="5" stroke-linecap="round">${body}</g>
    </g></g>
    ${stamp}
  </g></g>`;
}

// ---- stage 2: the road ----
// In the drawing's own units: the first side along the bottom (left to right), the other side back along the middle,
// the Governor along the top, and the law at its end. Its length is worked out here, so the bill's place on it is a
// share of it (the page measures the drawn path too, and moves the bill along it).
const RB = 222, RM = 144, RT = 52, RXR = 290, RXL = 64, RXE = 286, R1 = (RB - RM) / 2, R2 = (RM - RT) / 2;
const ROAD = `M-10 ${RB} H${RXR} A${R1} ${R1} 0 0 0 ${RXR} ${RM} H${RXL} A${R2} ${R2} 0 0 1 ${RXL} ${RT} H${RXE}`;
const ROADLEN = (RXR + 10) + Math.PI * R1 + (RXR - RXL) + Math.PI * R2 + (RXE - RXL);
const STOPS = [[116, RB], [262, RB], [236, RM], [96, RM], [160, RT]];
const along = ([x, y]) => y === RB ? x + 10 : y === RM ? RXR + 10 + Math.PI * R1 + (RXR - x) : RXR + 10 + Math.PI * R1 + (RXR - RXL) + Math.PI * R2 + (x - RXL);
// Where the bill stands on the road: 0-4 the stop it is at (or stopped at), 5 past them all, at the law. The same places
// the bill page's rail uses (E.now, E.stat), so the two never disagree.
function storyAt(E) {
  const st = E.x.st;
  if (E.isLaw) return 5;
  if (E.now === 4) return 4;
  if (E.stopped) return E.now === 3 ? (/vote/i.test(E.stat) ? 3 : 2) : E.now === 2 ? 1 : 0;
  if (E.now === 3) return st.phase === 'floor' || st.phase === 'conference' ? 3 : 2;
  return E.now === 2 ? 1 : 0;
}
function roadSVG(E) {
  const at = storyAt(E), num = E.num, ballot = !!E.x.ballot;
  const names = [`${E.start} committees`, `${E.start} vote`, `${E.other} committees`, `${E.other} vote`, ballot ? 'The voters' : 'Governor'];
  const [bx, by] = at === 5 ? [258, RT] : STOPS[at], end = along([bx, by]);
  const stops = STOPS.map(([x, y], i) => {
    const below = y === RB, near = below ? y + 34 : y - 26, far = below ? near + 16 : near - 16;
    const mark = i < at ? `<g class="lx-tick" data-at="${(along([x, y]) / ROADLEN).toFixed(4)}" transform="translate(${x} ${y})"><g class="lx-ticki"><circle r="13" fill="var(--p700)"/><path d="M-6 0 l4 4 8-8" fill="none" stroke="var(--n0)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></g>`
      : i > at ? `<circle cx="${x}" cy="${y}" r="12" fill="var(--n0)" stroke="var(--p300)" stroke-width="3"/>` : '';
    const here = i === at ? svgText(x, far, `${num} ${E.stopped ? 'stopped here' : 'is here'}`, { fill: E.stopped ? 'var(--n700)' : 'var(--p800)', cls: 'lx-here' }) : '';
    return `${mark}${svgText(x, near, names[i])}${here}`;
  }).join('');
  return `<g class="lx-lay lx-lay2">
    <path d="${ROAD}" fill="none" stroke="var(--n0)" stroke-width="22" stroke-linecap="round"/>
    <path id="lx-road" d="${ROAD}" fill="none" stroke="var(--p200)" stroke-width="2.5" stroke-dasharray="7 9"/>
    <path id="lx-trav" d="${ROAD}" fill="none" stroke="var(--p600)" stroke-width="3.5" style="stroke-dasharray:${end.toFixed(1)} ${Math.ceil(ROADLEN + 40)}"/>
    <g transform="translate(292 ${RT - 16})"><rect x="0" y="0" width="42" height="26" fill="var(--p300)"/><path d="M-5 0 L21 -16 L47 0 Z" fill="var(--p800)"/><rect x="17" y="12" width="9" height="14" fill="var(--p800)"/></g>
    ${at === 5 ? svgText(352, RT + 40, `${num} became law`, { anchor: 'end', fill: 'var(--p800)', cls: 'lx-here' }) : svgText(313, RT + 30, ballot ? 'Constitution' : 'Law')}
    ${stops}
    <g id="lx-sbill" data-end="${(end / ROADLEN).toFixed(4)}" transform="translate(${bx} ${by})">${smallBill(E.stopped)}</g>
  </g>`;
}

// ---- stage 3: who can hear you, and the four choices ----
// The committee (its chair in the middle) at the top, your own legislators on the right, you at the bottom left, and a
// bill waiting. Each choice is its own small scene, drawn where it ends (the still picture) and flown there from you.
const fly = (dx, dy, d, inner) => `<g class="lx-fly" style="--dx:${dx}px;--dy:${dy}px;--d:${d}ms">${inner}</g>`;
function voiceSVG() {
  return `<g class="lx-lay lx-lay3">
    <g class="lx-in3" style="--d:0ms"><g class="lx-cmte">
      ${person(128, 66, 'var(--p600)', .7)}${person(212, 66, 'var(--p600)', .7)}${person(170, 64, 'var(--p900)', .8)}
      <rect x="104" y="70" width="132" height="18" rx="4" fill="var(--p800)"/>
      ${svgText(170, 22, 'Chair', { fill: 'var(--p800)' })}${svgText(170, 108, 'Committee')}
    </g></g>
    <g class="lx-c3 lx-c3-legislators"><ellipse class="lx-pop" style="--d:600ms" cx="312" cy="146" rx="36" ry="32" fill="var(--p100)"/></g>
    <g class="lx-in3" style="--d:120ms">${person(300, 150, 'var(--p500)', .72)}${person(324, 154, 'var(--p700)', .72)}
      ${svgText(312, 186, 'Your')}${svgText(312, 201, 'legislators')}</g>
    <g class="lx-in3" style="--d:240ms">${person(54, 238, 'var(--p600)', .85)}${svgText(54, 272, 'You')}</g>
    <g class="lx-in3" style="--d:300ms"><g transform="translate(250 226)">${smallBill()}</g><g class="lx-blbl">${svgText(250, 266, 'A bill')}</g></g>
    <g class="lx-in3 lx-q3" style="--d:450ms"><g transform="translate(94 190)"><circle r="15" fill="var(--n0)" stroke="var(--p700)" stroke-width="2"/><path d="M-11 9 L-18 17 L-5 13" fill="var(--n0)" stroke="var(--p700)" stroke-width="2" stroke-linejoin="round"/><circle r="13.6" fill="var(--n0)"/>${svgText(0, 6, '?', { size: 18, fill: 'var(--p800)' })}</g></g>
    <g class="lx-c3 lx-c3-chair">
      ${fly(-78, 170, 0, PROPS.mail(148, 36, -8))}
      <circle class="lx-pop" style="--d:550ms" cx="170" cy="40" r="16" fill="none" stroke="var(--p400)" stroke-width="3"/>
      <g class="lx-pop" style="--d:650ms"><rect x="10" y="30" width="80" height="66" rx="4" fill="var(--n0)" stroke="var(--p700)" stroke-width="1.5"/><path d="M10 34 Q10 30 14 30 H86 Q90 30 90 34 V48 H10 Z" fill="var(--p700)"/>
        ${svgText(50, 44, 'Hearings', { fill: 'var(--n0)' })}<path d="M20 60h46M20 72h40" stroke="var(--n300)" stroke-width="4" stroke-linecap="round"/></g>
      <path class="lx-grow" style="--d:950ms" d="M20 84h46" stroke="var(--p600)" stroke-width="4" stroke-linecap="round"/>
      <g transform="translate(77 84)"><g class="lx-pop" style="--d:1150ms"><circle r="7" fill="var(--p700)"/><path d="M-3.2 0 l2.2 2.2 4.2-4.2" fill="none" stroke="var(--n0)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></g>
    </g>
    <g class="lx-c3 lx-c3-testimony">
      <g class="lx-pop" style="--d:0ms">${person(104, 244, 'var(--p400)', .72)}</g><g class="lx-pop" style="--d:120ms">${person(146, 244, 'var(--p700)', .72)}</g>
      ${fly(-78, 132, 200, PROPS.note(138, 76, -8))}${fly(-66, 142, 420, PROPS.note(172, 78, 4))}${fly(-58, 146, 640, PROPS.note(206, 76, 10))}
      <path class="lx-pop" style="--d:1150ms" d="M118 58 q-6 -6 0 -12 M222 58 q6 -6 0 -12" fill="none" stroke="var(--p400)" stroke-width="2.2" stroke-linecap="round"/>
    </g>
    <g class="lx-c3 lx-c3-legislators">
      ${fly(-206, 87, 0, PROPS.mail(276, 118, 8))}
      <g class="lx-pop" style="--d:750ms">${PROPS.talk(318, 104)}</g>
    </g>
    <g class="lx-c3 lx-c3-quiet">
      <g transform="translate(250 170)"><g class="lx-pop" style="--d:0ms"><circle r="15" fill="var(--n0)" stroke="var(--n500)" stroke-width="2"/><path class="lx-hand" d="M0 0 V-9" stroke="var(--n700)" stroke-width="2.2" stroke-linecap="round"/><path d="M0 0 H6" stroke="var(--n700)" stroke-width="2.2" stroke-linecap="round"/></g></g>
      <g class="lx-fade" style="--d:850ms"><g transform="translate(250 226)">${smallBill(true)}</g>${svgText(250, 266, 'Stopped', { fill: 'var(--n700)' })}</g>
    </g>
  </g>`;
}
function storyPic(E) {
  return `<div class="lx-pic lx-scene lx-story" id="lx-story" data-stage="1" aria-hidden="true"><svg class="lx-sv" viewBox="0 0 ${SW} ${SH}" focusable="false">
    ${paperSVG(E)}${roadSVG(E)}${voiceSVG()}</svg></div>`;
}

// ---- the words ----
// When testimony is due, for a hearing ahead: the real due time the committee posted; otherwise "by the deadline the
// committee sets". A deadline already past still takes notes, marked late (the second review, 9/21).
function storyDue(E) {
  const H = E.hear, ahead = !E.off && !H.example && !H.past && !E.stopped && !E.isLaw;
  if (!ahead) return { kind: 'none' };
  if (H.dueReal && new Date(H.due) <= Date.now()) return { kind: 'late' };
  if (H.dueReal) {
    const d = new Date(H.due), soon = d - Date.now() < 6 * 864e5, today = hstYmd(d) === hstYmd(Date.now());
    return { kind: 'due', words: `${today ? 'today' : soon ? H.dueDay : H.dueDate} at ${H.dueTime}` };
  }
  return { kind: 'hearing' };
}
// "the chair of the Senate Health Committee decides" / "the chairs of the House Health and Finance committees decide"
function chairWords(E, ch) {
  const codes = codesOf(E.x.st.committee), cs = codes.map(c => S.committees[c]).filter(Boolean);
  if (!cs.length) return `the ${ch} committee chair decides`;
  const brief = briefOf(codes);   // "Senate Health Committee", "Senate Health and Energy committees", "Three Senate committees"
  return cs.length === 1 ? `the chair of the ${brief} decides` : `the chairs of ${cs.length > 2 ? lcFirst(brief) : `the ${brief}`} decide`;
}
const nextOpenWords = () => { const n = sessionInfo().nextOpen; return n ? new Date(`${n}T12:00:00-10:00`).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' }) : ''; };
// The bill's own next chance, in the words of its real state.
function storyNow(E) {
  const num = `<b>${esc(E.num)}</b>`, x = E.x, st = x.st, H = E.hear, at = storyAt(E);
  const ch = CHAMBER_NAME[st.chamber] || (at <= 1 ? E.start : E.other);
  const open = nextOpenWords(), again = E.off && open ? ` The next session opens ${esc(open)}.` : '';
  if (E.isLaw) return `${num} made it all the way and became law${E.law ? ` as ${esc(E.law)}` : ''}${E.off ? ` in ${E.year}` : ''}.${again}`;
  if (x.ballot) return `${num} passed the Legislature. The voters decide in November.`;
  if (E.stopped) {
    const said = at === 4 ? `${num} passed both sides, and the Governor vetoed it` : `${num} ${esc(lcFirst(E.stat || 'Stopped this session'))}`;
    return `${said}${E.off ? ` in ${E.year}` : ''}.${again || ' The same idea can come back in a later session.'}`;
  }
  if (at === 4) return `Right now ${num} is on the Governor’s desk. The Governor decides whether it becomes law.`;
  if (st.phase === 'conference') return `Right now the House and Senate are working out one version of ${num}. A note to your own legislators can still help.`;
  if (st.phase === 'floor') return `Right now ${num} is waiting for the ${ch} vote. That’s when a note to your own ${ch === 'Senate' ? 'senator' : 'representative'} can help.`;
  const due = storyDue(E), where = `Right now ${num} is with ${ch} committees.`;
  if (due.kind !== 'none') {
    const hearing = `Its hearing is ${hstYmd(H.at) === hstYmd(Date.now()) ? 'today' : esc(H.when)} at ${esc(H.time)}`;
    return due.kind === 'due' ? `${where} ${hearing}, and testimony is due ${esc(due.words)}.`
      : due.kind === 'late' ? `${where} ${hearing}. The testimony deadline has passed, but late notes are still taken, marked late.`
      : `${where} ${hearing}. Testimony is due by the deadline the committee sets.`;
  }
  if (st.hearingState === 'held' && st.hearing) return `${where} It had its hearing ${esc(dateLong(st.hearing.scheduled_at))}, and the committee is deciding.`;
  if (st.phase === 'committee' && st.committee) return `Right now ${chairWords(E, ch)} whether ${num} gets a hearing. That’s where you come in.`;
  return where;
}
// Proof that speaking up works, counted from the data as Home's wins card counts it (core.js winsIn, EARLIER_WINS):
// between sessions, the session just past; in session, the one before it (loaded quietly, see storySet), else the
// latest year Nate listed by hand.
function winsYear(E) { const si = sessionInfo(); return E.off ? si.recapYear : si.yr - 1; }
function winsWords(E) {
  const yr = winsYear(E), w = winsIn(yr);
  if (w && w.length) return `Speaking up works: in ${yr}, ${w.length} ${w.length === 1 ? 'bill' : 'bills'} HIPHI backed became law.`;
  const y = Math.max(0, ...EARLIER_WINS.map(x => x.year)), win = EARLIER_WINS.find(x => x.year === y);
  return win ? `Speaking up works. One ${y} win: ${esc(lcFirst(win.text))}.` : '';
}
// The four choices: what each is called, its small drawing, and what CAN happen (never a promise).
const CHOICES = [
  ['chair', 'Email the chair', 'The chair hears from you.', 'A chair decides which bills get a hearing. Notes from the public can move a bill onto the list.'],
  ['testimony', 'Send testimony', 'Your note lands on the committee’s table.', 'Committee members read the notes people send before they vote. One note can change a mind.'],
  ['legislators', 'Tell my legislators', 'Your legislators hear from you.', 'Before the full House or Senate votes, a note from someone they represent can sway a vote.'],
  ['quiet', 'Stay quiet', 'Nothing reaches them.', 'The bill waits, and at the deadline it can stop. Most bills stop this way, often without anyone asking about them.'],
];
const MINI = {
  chair: '<rect x="4" y="9" width="28" height="19" rx="3" fill="var(--n0)" stroke="var(--p700)" stroke-width="2"/><path d="M4.5 11 L18 20.5 L31.5 11" fill="none" stroke="var(--p700)" stroke-width="2" stroke-linejoin="round"/>',
  testimony: '<rect x="8" y="4" width="20" height="28" rx="2" fill="var(--n0)" stroke="var(--p700)" stroke-width="2"/><path d="M13 12h10M13 17.5h10M13 23h6" stroke="var(--p500)" stroke-width="2.2" stroke-linecap="round"/>',
  legislators: '<path d="M4 9 Q4 6 7 6 H29 Q32 6 32 9 V21 Q32 24 29 24 H15 L9 30 L10 24 H7 Q4 24 4 21 Z" fill="var(--n0)" stroke="var(--p700)" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="15" r="2" fill="var(--p700)"/><circle cx="18" cy="15" r="2" fill="var(--p700)"/><circle cx="24" cy="15" r="2" fill="var(--p700)"/>',
  quiet: '<path d="M10 5 H26 M10 31 H26" stroke="var(--n700)" stroke-width="2.5" stroke-linecap="round"/><path d="M12 6 C12 14 16.5 15 16.5 18 C16.5 21 12 22 12 30 H24 C24 22 19.5 21 19.5 18 C19.5 15 24 14 24 6 Z" fill="var(--n0)" stroke="var(--n700)" stroke-width="2" stroke-linejoin="round"/><path d="M14.5 28.5 Q18 24 21.5 28.5 Z" fill="var(--n500)"/>',
};
const choiceOf = k => CHOICES.find(c => c[0] === k);
// Stage 3 is asked about the bill's real state: in session and still moving, "What would you do?"; a law, a stopped bill
// or the session over, about next time.
function voiceAsk(E) {
  if (E.off) return 'When the session opens, what would you do?';
  if (E.isLaw || E.stopped || storyAt(E) === 4 || E.x.ballot) return 'Next time, what would you do?';
  return 'What would you do?';
}
function voiceLead(E) {
  const num = esc(E.num);
  const was = E.isLaw ? `${num} became law. Every law passed moments like these. `
    : E.stopped ? `${num} stopped this time. Moments like these are how a bill gets further. `
    : E.x.ballot ? `${num} passed moments like these on its way to the voters. `
    : storyAt(E) === 4 ? `${num} passed moments like these on its way to the Governor. ` : '';
  return `${was}Pick one to see what can happen.`;
}
function stageTitle(E, k) {
  if (k === 1) return E.mine || E.via === 'followed' ? 'This is your bill' : 'Meet the bill';
  return k === 2 ? 'Its road' : 'Why speaking up can help';
}
function stageBody(E, k) {
  if (k === 1) {
    const num = esc(E.num), b = E.b, pre = (/^(HB|SB)\d/.exec(b.bill_number || '') || [])[1];
    const said = pre ? `${pre} means ${pre === 'HB' ? 'House' : 'Senate'} Bill: it started in the ${pre === 'HB' ? 'House' : 'Senate'}.` : `It started in the ${E.start}.`;
    let sum = plainSum(b, 150); if (sum && !/[.…!?]$/.test(sum)) sum += '.';
    const stand = STAND[b.hiphi_position] ? `HIPHI ${STAND[b.hiphi_position][E.off ? 1 : 0]}.` : '';
    return `<p><b>${num}</b> is its number. ${said}</p><p>${`${esc(sum)} ${stand}`.trim()}</p>`;
  }
  if (k === 2) {
    const road = `Every bill takes this road: ${E.start} committees and a vote, then the same in the ${E.other}, then ${E.x.ballot ? 'the voters' : 'the Governor'}.`;
    return `<p>${esc(road)}</p><p class="lx-now">${storyNow(E)}</p>`;
  }
  // "Nothing to do now" was said even when this bill's testimony was due the next day (R-098): a real hearing ahead is
  // named. The version that ends on Home (?end=home) says where the moment will be waiting: the top of the home page.
  const H = E.hear, home = endHome();
  const now = !E.off && H && !H.example && !H.past && !E.stopped && !E.isLaw
    ? `${E.num.replace(NBSP, ' ')} is at one of these moments now: ${H.dueReal && new Date(H.due) > Date.now() ? `testimony is due ${H.dueDay}` : `it has a hearing ${H.when}`}.` : '';
  const calm = now ? `${now} ${home ? 'It’ll be waiting at the top of your home page.' : 'We’ll show you how.'}`
    : home ? `When ${E.off ? 'the session opens and ' : ''}a bill you follow reaches one of these moments, it goes to the top of your home page, with what to do and by when.`
    : E.off ? 'Nothing to do now. When the session opens and a bill you follow reaches one of these moments, we tell you what to do and by when.'
    : 'Nothing to do now. When a bill you follow reaches one of these moments, we tell you what to do and by when.';
  return `<p class="lx-out" id="lx-out">${voiceLead(E)}</p>
    <div class="lx-choose" role="group" aria-labelledby="lx-ask"><p class="lx-ask" id="lx-ask">${esc(voiceAsk(E))}</p>
      <div class="lx-chs">${CHOICES.map(([k2, label]) => `<button type="button" class="lx-ch lx-ch-${k2}" data-lx-ch="${k2}" aria-pressed="false"><svg class="lx-chart" viewBox="0 0 36 36" aria-hidden="true" focusable="false">${MINI[k2]}</svg><span>${esc(label)}</span></button>`).join('')}</div></div>
    <p class="lx-why">Few people write in, so each note gets noticed. <span id="lx-wins">${winsWords(E)}</span></p>
    <p class="lx-calm">${icon('info')}<span>${esc(calm)}</span></p>`;
}
const stageHTML = (E, k) => `<p class="lx-count">${k} of 3</p><h2>${esc(stageTitle(E, k))}</h2>${stageBody(E, k)}`;
function storyLede(E) {
  if (E.via === 'bill') return `Here’s the story of ${esc(E.num)}.`;
  if (E.via === 'followed') return 'Here’s the story of the bill you just followed.';
  if (E.via === 'link') return 'Here’s the story of the bill you opened.';
  if (E.off) return E.isLaw ? `Here’s the story of one that became law in ${E.year}.` : `Here’s the story of one from the ${E.year} session.`;
  return E.mine ? 'Here’s the story of one bill on your issues.' : 'Here’s the story of one bill HIPHI is working on.';
}
function storyMain(E) {
  return `<div class="lx lx-l-story" data-lx="story" data-stage="1">
    <div class="lx-caption lx-nonum lx-scap" id="lx-cap" aria-live="polite">${stageHTML(E, 1)}</div>
  </div>`;
}

// ---- the stages ----
// Stage 2's trip: the bill is moved along the drawn road (its real length, measured), the road behind it fills in, and
// each stop it passes is ticked as it gets there; "<bill> is here" comes last. Under Reduce Motion, on Back and on a
// redraw, the end state is simply there (it is what the drawing was built as).
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function roadPlay(pic, instant) {
  const road = $('#lx-road', pic), trav = $('#lx-trav', pic), bill = $('#lx-sbill', pic); if (!road || !trav || !bill) return;
  const ticks = $$('.lx-tick', pic), here = $$('.lx-lay2 .lx-here', pic);
  let total = ROADLEN; try { total = road.getTotalLength() || ROADLEN; } catch { /* not laid out */ }
  const end = +bill.dataset.end * total;
  const put = d => {
    let pt = null; try { pt = road.getPointAtLength(Math.max(0, d)); } catch { /* not laid out */ }
    if (pt) bill.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    trav.style.strokeDasharray = `${Math.max(0, d).toFixed(1)} ${Math.ceil(total + 40)}`;
    ticks.forEach(t => { if (t.classList.contains('lx-pre') && d >= +t.dataset.at * total - 2) { t.classList.remove('lx-pre'); if (!instant) play(t, 'lx-popin'); } });
  };
  const finish = () => { put(end); ticks.forEach(t => t.classList.remove('lx-pre')); here.forEach(h => h.classList.remove('lx-pre')); };
  ticks.forEach(t => t.classList.remove('lx-popin')); here.forEach(h => h.classList.remove('lx-fadein'));
  if (instant || reduced()) { finish(); return; }
  ticks.forEach(t => t.classList.add('lx-pre')); here.forEach(h => h.classList.add('lx-pre'));
  put(0);
  const run = L.run, t0 = performance.now(), ms = Math.round(400 + 800 * end / total);   // at most 1.2 s, then the label
  const step = now => {
    if (L.run !== run) { finish(); return; }
    const t = Math.min(1, (now - t0) / ms); put(end * easeInOut(t));
    if (t < 1) requestAnimationFrame(step);
    else here.forEach(h => { h.classList.remove('lx-pre'); play(h, 'lx-fadein'); });
  };
  requestAnimationFrame(step);
}
function storyChoose(k, { instant = false } = {}) {
  const root = rootOf('story'), pic = $('#lx-story'), c = choiceOf(k); if (!root || !pic || !c) return;
  ST.story.choice = k; pic.dataset.choice = k;
  $$('[data-lx-ch]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lxCh === k)));
  const out = $('#lx-out', root), ask = $('#lx-ask', root);
  if (out) { out.innerHTML = `<b>${esc(c[2])}</b> ${esc(c[3])}`; out.classList.add('lx-got'); out.classList.toggle('lx-gotq', k === 'quiet'); if (!instant) play(out, 'lx-swap'); }
  if (ask) ask.textContent = 'Try another';
  if (instant) { pic.classList.add('lx-cplay'); settle(pic); }
  else { play(pic, 'lx-cplay'); reveal(pic, out); }
}
function storySet(k, { instant = false, initial = false } = {}) {
  const root = rootOf('story'), pic = $('#lx-story'); if (!root || !pic || !L.E) return;
  const E = L.E, forward = k > ST.story.step && !instant;
  L.run++; ST.story.step = k; pic.dataset.stage = k; root.dataset.stage = k;
  if (forward && k === 3) ST.story.choice = null;   // coming to the choice afresh: nothing is chosen yet
  pic.classList.remove('lx-play', 'lx-cplay'); delete pic.dataset.choice;
  const cap = $('#lx-cap', root);
  if (cap) { cap.innerHTML = stageHTML(E, k); if (!instant && !initial) play(cap, 'lx-swap'); else cap.classList.remove('lx-swap'); }
  if (k === 1) fitTitles(pic);
  if (k === 2) roadPlay(pic, instant);
  else if (instant) { pic.classList.add('lx-play'); settle(pic); }
  else { void pic.getBoundingClientRect(); play(pic, 'lx-play'); }
  if (k === 3 && ST.story.choice) storyChoose(ST.story.choice, { instant: true });
  fitStory();
  if (!initial && !instant) reveal(pic, cap);
  // In session the wins are the session before this one's, which nothing else here has loaded: load them quietly and
  // change only that sentence when they land (no redraw, so nothing replays).
  const yr = winsYear(E);
  if (!E.off && !winsIn(yr) && !S.recapPool && !S.recapLoading) {
    loadRecapPool(yr).then(() => { const el = document.getElementById('lx-wins'); if (el && L.E === E) el.textContent = unent(winsWords(E)); }).catch(() => {});
  }
}
// The caption keeps the height of the taller of stages 1 and 2, so Next does not jump between them on a laptop (stage 3
// is longer; it has the choices).
function fitStory() {
  const root = rootOf('story'), cap = root && $('#lx-cap', root); if (!cap || !L.E) return;
  if (ST.story.step === 3) { cap.style.minHeight = ''; return; }
  const probe = document.createElement('div');
  probe.className = cap.className.replace(/\blx-swap\b/, ''); probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:0;right:0;top:0;visibility:hidden;min-height:0;pointer-events:none';
  root.appendChild(probe);
  let h = 0; [1, 2].forEach(k => { probe.innerHTML = stageHTML(L.E, k); h = Math.max(h, probe.getBoundingClientRect().height); });
  probe.remove(); cap.style.minHeight = `${Math.ceil(h)}px`;
}
// The first visit's own Back (and the lesson page's Back) walks the story back a stage at a time before it leaves the
// screen (B-4), showing the earlier stage's still picture.
export function lessonPrev(name) {
  if (name !== 'story' || L.name !== name || !rootOf(name) || ST.story.step <= 1) return false;
  storySet(ST.story.step - 1, { instant: true });
  return true;
}
// Which stage the story is on (1-3), so the lesson page can say Done on the last.
export const lessonStep = name => (L.name === name && ST[name] ? ST[name].step : 1);

// ---------------------------------------------------------------- the interface
export function lessonHTML(name, E) {
  if (!E || !LESSON_TITLES[name]) return { intro: '', main: '' };
  // The story's drawing ends the intro: on a phone it sits under the lede as before, and on a laptop it stays in the left
  // column beside the words and the choices (start.css puts the intro there).
  const intro = `<h1 class="hero lx-h1" id="st-h">${LESSON_TITLES[name]}</h1><p class="lede lx-lede">${ledeOf(name, E)}</p>${name === 'story' ? storyPic(E) : ''}`;
  const main = name === 'story' ? storyMain(E) : name === 'bill' ? billMain(E) : name === 'session' ? sessionMain(E) : hearingMain(E);
  return { intro, main };
}
const SETS = { bill: billSet, session: sessionSet, hearing: hearingSet, story: storySet };
export function lessonStart(name, E, { back = false, redraw = false, onAnswer = null } = {}) {
  lessonStop();
  const root = rootOf(name); if (!E || !root || !SETS[name]) return;
  const key = `${E.id}|${E.off ? 'off' : 'in'}|${E.hear?.id || ''}`;
  if (key !== L.key) { Object.keys(LAST).forEach(fresh); L.key = key; L.answered = false; }
  if (!back && !redraw) fresh(name);
  L.name = name; L.E = E; L.onAnswer = onAnswer;
  if (name === 'session') { ST.session.mineAt = 0; L.toks = journeyToks(E); }   // a new DOM: the bill is back at the start
  if (name === 'hearing') ST.hearing.shown = false;
  root.onclick = e => {
    const t = e.target.closest('[data-lx-beat], [data-lx-month], [data-lx-sec], [data-lx-q], [data-lx-ch]'); if (!t || !root.contains(t)) return;
    if (t.dataset.lxCh) storyChoose(t.dataset.lxCh);
    else if (t.dataset.lxBeat) SETS[name](+t.dataset.lxBeat);
    else if (t.dataset.lxMonth) sessionSet(+t.dataset.lxMonth);
    else if (t.dataset.lxSec) billSet(+t.dataset.lxSec);
    else if (t.dataset.lxQ !== undefined && t.getAttribute('aria-disabled') !== 'true') answer(+t.dataset.lxQ);
  };
  const step = redraw ? ST[name].step : back ? LAST[name] : 1;
  if (back || redraw) { SETS[name](step, { instant: true, initial: true }); settle(root); if (name === 'story') settle($('#lx-story')); }
  else { void root.getBoundingClientRect(); SETS[name](1, { initial: true }); }   // the first state is laid out, so step 1 moves
  fitCaption();
  addEventListener('resize', onResize);
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (L.name === name && rootOf(name) === root) fitCaption(); });
}
export function lessonNext(name, E) {
  if (!E || L.name !== name || !rootOf(name)) return false;
  if (name === 'bill') { if (ST.bill.step < LAST.bill) { billSet(ST.bill.step + 1); return true; } return false; }
  if (name === 'session') { if (ST.session.step < LAST.session) { sessionSet(ST.session.step + 1); return true; } return false; }
  if (name === 'story') { if (ST.story.step < LAST.story) { storySet(ST.story.step + 1); return true; } return false; }
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
