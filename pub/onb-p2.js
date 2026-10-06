// Plan 2, "A bill's journey" (R-164; pub/plans.js: story -> topics -> road -> join -> wrap). The doc "Onboarding: five
// plans" says it: the first visit is a short drawn story of one real bill that people helped pass, six scenes, one idea
// and one drawing each; at the moment the public can help (the hearing) the newcomer practises that help and sees what it
// did; then they pick topics and see today's bills on that same road, each one tap to follow. The topics screen is
// today's (start.js); the sign-up and the ending are the shared ones (onb.js). This file draws the plan's two own steps:
//   story  the arrival screen (C-11: a stranger gets it in four seconds) and the six scenes, all one step: Next walks the
//          scenes, Back steps back a scene before it leaves, "Skip to the bills" goes straight on (to the topics, which
//          lead to the bills: Skip never lands on an empty screen). The scene is kept in S.obScene, so a redraw keeps it.
//   road   "Where your bills are on the road": the most important issues on the picked topics (onb.js planIssues), each a
//          card with its lead bill on a small copy of the story's road and where it is in words, one tap to tick, one
//          button to follow the ticked ones.
// The road is the shared picture: six stops (an idea, the hearing, the first vote, the other side, the final votes, the
// Governor), the same in every scene and on every card, so what the story taught is what the cards show (C-12).
// Design rules this follows: C-7 (a small burst for the win at the end of the story, nothing full-screen), C-10 (every
// scene under 30 words at grade 8; "e-cigarettes", never "vape"), C-12 (one idea per scene, every word visible), A-10
// (motion only when the person taps, short, ending on the still picture that says the same thing; nothing moves under
// Reduce Motion), A-3 (one primary: the bar's Next), A-11 (no emoji), P-5 (the practice note is plainly practice).
import { S, app, esc, icon, nick, spaced, blurb, sessionInfo, ensureRecapPool, winsIn, EARLIER_WINS, setFollows, wizSet, issueFollowed, plainStatus, whyStoppedShort, HELD_RE } from './core.js';
import { shell, topRow, bar1, bar2, sayRow, sureWide, skel, loadErr, isOff, goStep, track, plural, andList, shortDay, flash, clearFlash, busy, welcome, pickedIssues, hasPos } from './start.js';
import { btn, posChip } from './ui.js';
import { burst, later, reduced, swap, travel } from './fx.js';
import { planIssues } from './onb.js';

export const STEPS = ['story', 'road'];

// ================= the drawing: one road, six stops =================
// Every drawing is aria-hidden: the words beside it say all of it (A-10: pictures and motion are never the only way
// something is said). Flat colour, one silhouette per person (no outline per part), the page's own tokens; orange only
// for the sun on the two scenes that are a win.
const VW = 360, VH = 230;
const RX0 = 28, RX1 = 332, RY = 186;
// A gentle wave, so it reads as a road and not a progress bar (C-7: never a bar that implies homework).
const roadY = x => RY + 6 * Math.sin((x - RX0) / (RX1 - RX0) * Math.PI * 2);
const STOPX = [0, 1, 2, 3, 4, 5].map(i => RX0 + i * (RX1 - RX0) / 5);
const roadD = (from, to) => { let d = ''; for (let k = 0; k <= 40; k++) { const x = from + (to - from) * k / 40; d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${roadY(x).toFixed(1)}`; } return d; };
const ROAD_START = RX0 - 16, ROAD_END = RX1 + 16;
const txt = (x, y, t, { size = 13, fill = 'var(--p900)', anchor = 'middle', weight = 700 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(t)}</text>`;
// One person (the lessons' silhouette): head and body overlap in one flat colour. `hand` raises an arm (a vote, a cheer).
const person = (x, y, c, s = 1, hand = false) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><circle cx="0" cy="-30" r="11"/><path d="M-19 16 C-19 -8 -10 -16 0 -16 C10 -16 19 -8 19 16 Z"/>${hand
  ? `<path d="M10 -10 L19 -44" stroke="${c}" stroke-width="8" stroke-linecap="round"/><circle cx="20" cy="-47" r="5.5"/>` : ''}</g>`;
// A bill as a sheet of paper with its number on a tab (the lessons' paper, smaller).
const paper = (x, y, w, h, num, { rot = 0, grey = false } = {}) => {
  const ink = grey ? 'var(--n500)' : 'var(--p900)', tab = grey ? 'var(--n500)' : 'var(--p700)', tw = Math.max(46, String(num).length * 9 + 16);
  const lines = [0, 1, 2, 3].filter(i => 48 + i * 13 < h - 8).map(i => `<path d="M14 ${48 + i * 13}h${w - 30 - (i % 2) * 14}"/>`).join('');
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M0 3 Q0 0 3 0 H${w - 16} L${w} 16 V${h - 3} Q${w} ${h} ${w - 3} ${h} H3 Q0 ${h} 0 ${h - 3} Z" fill="${grey ? 'var(--n100)' : 'var(--n0)'}" stroke="${ink}" stroke-width="2"/>
    ${num ? `<rect x="-6" y="12" width="${tw}" height="22" rx="4" fill="${tab}"/>${txt(tw / 2 - 6, 28, num, { size: 13, fill: 'var(--n0)' })}` : ''}
    <g stroke="${grey ? 'var(--n300)' : 'var(--p200)'}" stroke-width="4" stroke-linecap="round">${lines}</g></g>`;
};
// The bill travelling the road: a small sheet riding just above its stop.
const token = () => `<path d="M-10 -13 H4 L10 -7 V13 H-10 Z" fill="var(--n0)" stroke="var(--p800)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M-5 -4h9M-5 1.5h9M-5 7h6" stroke="var(--p300)" stroke-width="2.2" stroke-linecap="round"/>`;
const check = (r, c = 'var(--p700)') => `<circle r="${r}" fill="${c}"/><path d="M${(-r * .45).toFixed(1)} 0 l${(r * .3).toFixed(1)} ${(r * .3).toFixed(1)} ${(r * .6).toFixed(1)} ${(-r * .6).toFixed(1)}" fill="none" stroke="var(--n0)" stroke-width="${Math.max(2, r * .26).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;

// The road with its six stops. at: the stop the bill is at (0-5); done: every stop passed (the welcome: the law it
// became); from: the stop it came from, so a forward Next can move it from there (the CSS plays that only on .ob2-play).
function roadSVG(at, names, { done = false, from = null } = {}) {
  const end = done ? ROAD_END : STOPX[at], prev = from == null || from >= at ? at : from;
  const share = ((STOPX[prev] - ROAD_START) / (end - ROAD_START)) || 0;
  const stops = STOPX.map((x, i) => {
    const y = roadY(x);
    if (done || i < at) return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">${check(9)}</g>`;
    if (i > at) return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="var(--n0)" stroke="var(--p300)" stroke-width="3"/>`;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="ob2-lit"><circle r="16" fill="var(--p100)"/><circle r="11" fill="var(--p700)"/><circle r="4" fill="var(--n0)"/></g></g>`;
  }).join('');
  // Only the current stop is named (A-13: one focal point); the first and last names are anchored so they stay inside.
  const lx = STOPX[at], anchor = at === 0 ? 'start' : at === 5 ? 'end' : 'middle', ax = at === 0 ? lx - 14 : at === 5 ? lx + 14 : lx;
  const label = done ? '' : txt(ax.toFixed(1), 222, names[at], { fill: 'var(--p800)', anchor });
  const tok = done ? '' : `<g transform="translate(${lx.toFixed(1)} ${(roadY(lx) - 32).toFixed(1)})"><g class="ob2-tok" style="--fx:${(STOPX[prev] - lx).toFixed(1)}px;--fy:${(roadY(STOPX[prev]) - roadY(lx)).toFixed(1)}px">${token()}</g></g>`;
  return `<path d="${roadD(ROAD_START, ROAD_END)}" fill="none" stroke="var(--n0)" stroke-width="22" stroke-linecap="round"/>
    <path d="${roadD(ROAD_START, ROAD_END)}" fill="none" stroke="var(--p200)" stroke-width="2.5" stroke-dasharray="7 9"/>
    <path class="ob2-trav" d="${roadD(ROAD_START, end)}" pathLength="100" fill="none" stroke="var(--p600)" stroke-width="3.5" stroke-linecap="round" style="--o:${(100 - share * 100).toFixed(1)}"/>
    ${stops}${label}${tok}`;
}

// What stands above the road in each scene (0 is the welcome). E is the story's bill (storyBill below).
// The practice note goes from beside "You" onto the committee's desk, in front of the chair.
const NOTE_FROM = [64, 100], NOTE_TO = [234, 101];
const SUN = '<circle class="ob2-sun" cx="318" cy="38" r="14" fill="var(--o400)"/>';
function sceneArt(k, E) {
  const num = E.num || '';
  switch (k) {
    case 0: return `${SUN}
      <g class="ob2-in">${person(64, 128, 'var(--p500)', .78, true)}${person(106, 122, 'var(--p700)', .9, true)}${person(148, 130, 'var(--p400)', .76, true)}</g>
      <g class="ob2-in" style="--d:.12s">${paper(206, 30, 92, 116, num, { rot: 4 })}
        <g transform="translate(286 132) rotate(-12)"><circle r="25" fill="var(--p50)" stroke="var(--p700)" stroke-width="3"/><circle r="20" fill="none" stroke="var(--p700)" stroke-width="1.2"/>
          ${txt(0, E.yr ? -1 : 5, 'LAW', { size: 13, fill: 'var(--p700)' })}${E.yr ? txt(0, 12, String(E.yr), { size: 10, fill: 'var(--p700)' }) : ''}</g></g>`;
    case 1: return `<g class="ob2-in">${person(92, 150, 'var(--p700)', 1)}</g>
      <g class="ob2-in" style="--d:.15s"><path d="M70 44 l-8 -6 M92 34 v-10 M114 44 l8 -6" stroke="var(--p400)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="92" cy="62" r="16" fill="var(--n0)" stroke="var(--p700)" stroke-width="2.5"/><path d="M86 64 q6 -8 12 0" fill="none" stroke="var(--p400)" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="85" y="77" width="14" height="9" rx="2" fill="var(--p700)"/></g>
      <g class="ob2-in" style="--d:.35s"><path d="M126 100 C150 70, 172 64, 196 70" fill="none" stroke="var(--p600)" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>
        <path d="M188 62 L199 70 L187 77" fill="none" stroke="var(--p600)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="ob2-in" style="--d:.5s">${paper(212, 34, 92, 114, num || 'BILL', { rot: -3 })}</g>`;
    case 2: return `<g class="ob2-in">${person(196, 94, 'var(--p600)', .62)}${person(274, 94, 'var(--p600)', .62)}${person(235, 90, 'var(--p900)', .74)}
        <rect x="150" y="96" width="170" height="7" rx="3" fill="var(--p700)"/><rect x="156" y="103" width="158" height="40" fill="var(--p800)"/>
        ${txt(235, 128, 'Committee', { fill: 'var(--n0)' })}${txt(235, 40, 'Chair', { fill: 'var(--p800)' })}</g>
      <g class="ob2-in" style="--d:.15s">${person(38, 134, 'var(--p700)', .8)}${txt(38, 164, 'You', { fill: 'var(--p800)' })}</g>
      <circle class="ob2-ring" cx="${NOTE_TO[0]}" cy="${NOTE_TO[1]}" r="18" fill="none" stroke="var(--p400)" stroke-width="3"/>
      <g id="ob2-note" transform="translate(${S.ob2Sent ? NOTE_TO.join(' ') : NOTE_FROM.join(' ')})"><g transform="rotate(-6)">
        <rect x="-10" y="-12" width="20" height="25" rx="2" fill="var(--n0)" stroke="var(--p700)" stroke-width="2" stroke-dasharray="4 3"/>
        <path d="M-5 -5h10M-5 0h10M-5 5h6" stroke="var(--p400)" stroke-width="2" stroke-linecap="round"/></g>
        <g transform="translate(11 -13)"><g class="ob2-notecheck">${check(7)}</g></g></g>`;
    case 3: return `<g class="ob2-in"><circle cx="104" cy="82" r="42" fill="var(--n0)" stroke="var(--p800)" stroke-width="4"/>
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => { const a = i * Math.PI / 6, r1 = i % 3 ? 33 : 29; return `<path d="M${(104 + Math.sin(a) * r1).toFixed(1)} ${(82 - Math.cos(a) * r1).toFixed(1)}L${(104 + Math.sin(a) * 36).toFixed(1)} ${(82 - Math.cos(a) * 36).toFixed(1)}" stroke="var(--p300)" stroke-width="2.5" stroke-linecap="round"/>`; }).join('')}
        <path class="ob2-hand" d="M104 82 V54" stroke="var(--p800)" stroke-width="4" stroke-linecap="round"/><path d="M104 82 L124 92" stroke="var(--p800)" stroke-width="4" stroke-linecap="round"/><circle cx="104" cy="82" r="4.5" fill="var(--p800)"/></g>
      <g class="ob2-in" style="--d:.3s">${paper(234, 52, 70, 86, '', { rot: 10, grey: true })}${txt(266, 162, 'Missed it', { fill: 'var(--n700)' })}</g>`;
    case 4: {
      const cone = (x, c) => `<g transform="translate(${x} 66) scale(1.35)"><path d="M0 34c10-14 18-28 28-33h16c10 5 18 19 28 33z" fill="${c}"/></g><rect x="${x - 6}" y="112" width="109" height="6" rx="3" fill="var(--p800)"/>`;
      return `<g class="ob2-in">${cone(30, 'var(--p200)')}${txt(79, 138, E.start || 'House')}</g>
        <g class="ob2-in" style="--d:.15s">${cone(222, 'var(--p400)')}${txt(271, 138, E.other || 'Senate')}</g>
        <g class="ob2-in" style="--d:.35s"><path d="M92 56 Q176 -14 256 52" fill="none" stroke="var(--p600)" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>
          <path d="M246 49 L257 54 L257 41" fill="none" stroke="var(--p600)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    case 5: return `<g class="ob2-in">${person(50, 114, 'var(--p500)', .7, true)}${person(86, 110, 'var(--p700)', .74, true)}${person(122, 114, 'var(--p400)', .7, true)}${txt(86, 148, 'House')}</g>
      <g class="ob2-in" style="--d:.15s">${person(196, 114, 'var(--p400)', .7, true)}${person(232, 110, 'var(--p700)', .74, true)}${person(268, 114, 'var(--p500)', .7, true)}${txt(232, 148, 'Senate')}</g>
      <g class="ob2-in" style="--d:.4s"><g transform="translate(159 46)"><g class="ob2-lit">${check(20)}</g></g></g>`;
    case 6: return `${SUN}
      <g class="ob2-in">${person(126, 104, 'var(--p900)', .9)}
        <rect x="64" y="104" width="226" height="7" rx="3" fill="var(--p700)"/><rect x="70" y="111" width="214" height="36" fill="var(--p800)"/></g>
      <g class="ob2-in ob2-signed" style="--d:.15s"><g transform="translate(178 50) rotate(-3)"><rect width="84" height="54" rx="3" fill="var(--n0)" stroke="var(--p900)" stroke-width="2"/>
        <path d="M12 16h58M12 25h44" stroke="var(--p200)" stroke-width="4" stroke-linecap="round"/>
        <path class="ob2-sig" pathLength="100" d="M12 44 c5 -10 9 -10 11 0 s7 7 11 -2 s7 -7 11 2 s6 4 11 -4" fill="none" stroke="var(--p900)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>
        <path d="M274 26 L250 54" stroke="var(--p900)" stroke-width="5" stroke-linecap="round"/><path d="M250 54 l-3 5 5 -2z" fill="var(--p900)"/></g>`;
  }
  return '';
}
function storyPic(k, E, from) {
  // The stop each scene stands at: the welcome shows the whole road done (the law it became); scene k is stop k-1.
  const at = k === 0 ? 5 : k - 1, fromStop = from == null ? null : Math.max(0, from - 1);
  return `<svg class="ob2-svg" viewBox="0 0 ${VW} ${VH}" aria-hidden="true" focusable="false">
    <rect width="${VW}" height="${VH}" rx="24" fill="var(--p50)"/>
    ${roadSVG(at, E.stops, { done: k === 0, from: fromStop })}${sceneArt(k, E)}</svg>`;
}

// ================= the story's bill: a real law HIPHI backed =================
// Between sessions, last session's wins (the recap pool); in session, the session before this one's (the same year the
// lessons count wins from, lessons.js winsYear), so a newcomer in January 2027 meets a 2026 law. The pool loads once, with
// a skeleton until it lands (as planIssues does). Of the wins, the one HIPHI backed most strongly, signed by the Governor
// (the last scene says the Governor signs), with a nickname. Nothing is said about it beyond what the data holds: its
// name, its summary, its number (which says where it started) and the year it became law.
// When the pool has none (the practice copy in session: its records start with the 2026 session), the earlier win Nate
// named with a bill number stands in (core.js EARLIER_WINS); with none of those, a story with no bill named.
const pre = num => (/^(HB|SB)\s?\d/.exec(num || '') || [])[1] || '';
const sides = p => p === 'SB' ? ['Senate', 'House'] : p === 'HB' ? ['House', 'Senate'] : ['', ''];
const stopNames = start => ['Idea', 'Hearing', start ? `${start} vote` : 'First vote', 'Other side', 'Final votes', 'Governor'];
function storyBill() {
  const si = sessionInfo(), yr = isOff() ? si.recapYear : si.yr - 1;
  if (!(S.recapPool && S.recapPool.yr === yr) && S.recapFailed !== yr) { ensureRecapPool(yr); return { loading: true }; }
  const signed = b => !/without the governor/i.test(b.last_action || '');
  const score = b => (b.hiphi_position === 'strongly_support' ? 8 : 0) + (signed(b) ? 4 : 0) + (nick(b) ? 2 : 0) + (b.hiphi_recommended || b.recommended ? 1 : 0);
  const b = (winsIn(yr) || []).filter(x => pre(x.bill_number)).sort((x, y) => score(y) - score(x) || x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true }))[0];
  if (b) {
    const p = pre(b.bill_number), [start, other] = sides(p), name = nick(b);
    return { num: spaced(b.bill_number), pre: p, start, other, yr, name: name || blurb(b, 80), what: name ? blurb(b, 150) : '', stops: stopNames(start) };
  }
  const w = EARLIER_WINS.find(x => pre(x.bill));
  if (w) { const p = pre(w.bill), [start, other] = sides(p); return { num: spaced(w.bill.replace(/\s/g, '')), pre: p, start, other, yr: w.year, name: w.text, what: '', stops: stopNames(start) }; }
  return { num: '', pre: '', start: '', other: '', yr: 0, name: '', what: '', stops: stopNames('') };
}

// ================= story: the welcome and six scenes =================
// The words of each scene: a title and one short paragraph (under 30 words, grade 8; C-10). The bill's own facts are
// said only where the data has them (its number says where it started; the year it became law).
const LAST = 6;
function sceneWords(k, E) {
  const num = E.num ? `<b>${esc(E.num)}</b>` : '';
  if (k === 1) return ['It starts with an idea', E.num
    ? `Every law starts as an idea. A lawmaker writes it up as a bill. ${num} started in the ${E.start}: ${E.pre} means ${E.start} Bill.`
    : 'Every law starts as an idea. A lawmaker writes it up as a bill. It starts in the House (an HB) or the Senate (an SB).'];
  if (k === 2) return ['The hearing', `First, a ${E.start ? `${E.start} ` : ''}committee holds a hearing on it. Anyone can send a short note, called testimony. The chair and members read them before they vote.`];
  if (k === 3) return ['Deadlines', `Every stop has a deadline. To keep going, a bill must pass the full ${E.start || 'House or Senate'} in time. A bill that misses a deadline stops for the year.`];
  if (k === 4) return ['The other side', `Next it goes to the ${E.other || 'other side'} and does it all again: a hearing, a deadline and a vote. You can send notes there too.`];
  if (k === 5) return ['The final votes', 'The House and Senate agree on one final version, and both vote on it. A note to your own lawmakers before the vote can help.'];
  return ['The Governor signs', `The Governor signs it, and the bill becomes law.${E.num ? ` ${num} became law in ${E.yr}.` : ''} People who spoke up${E.num ? '' : ' at these moments'} helped get it there.`];
}
const welcomeH = E => E.name ? 'People across Hawaiʻi helped pass this law' : 'People across Hawaiʻi help pass health laws';
// The practice note (the doc's risk: "Practice notes must look nothing like real ones"). It is said to be practice before
// the tap and after it, its button is dashed, not the filled button every real action uses (A-12), and its drawing is a
// dashed sheet. Nothing leaves the page.
const SENT = `<span class="ob2-sentic" aria-hidden="true">${icon('circle-check')}</span><span><b>It landed on the chair’s desk.</b> In real life, your note goes to the chair before the vote. This was practice: nothing was sent.</span>`;
function practiceHTML() {
  return `<div class="ob2-try"><p class="ob2-trytag">${icon('sparkle')}<span>Try it. It’s only practice.</span></p>
    ${btn(S.ob2Sent ? 'Send it again' : 'Send a practice note', { kind: 'secondary', icon: 'send', cls: 'ob2-practice', attrs: { 'data-ob2practice': '1' } })}
    <p class="ob2-sent${S.ob2Sent ? ' on' : ''}" id="ob2-sent" role="status">${S.ob2Sent ? SENT : ''}</p></div>`;
}
S.obScene ??= 0;
S.ob2Sent ??= false;
S.ob2From ??= null;   // the scene a forward Next came from: the drawing moves from there once, then it is the still picture
const scene = () => Math.max(0, Math.min(LAST, S.obScene | 0));
const backRow = () => `<div class="steps st-steps">${btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stback': '1' } })}</div>`;
function stepStory(step) {
  const E = storyBill();
  if (E.loading) return skel(step, 'Getting the story ready');
  const k = scene(), from = S.ob2From, play = from != null;
  // Step 1 has no Back in the frame (nothing is behind it); from the first scene on, Back steps back a scene.
  const top = `${topRow('story', step)}${k > 0 && step === 1 ? backRow() : ''}`;
  const cls = `ob2-pic${play ? ' ob2-play' : ''}${k === 0 ? ' ob2-welcomepic' : ''}${k === 2 && S.ob2Sent ? ' ob2-sentpic' : ''}`;
  const pic = `<div class="${cls}" data-scene="${k}">${storyPic(k, E, from)}</div>`;
  if (k === 0) {
    // The arrival (C-11, C-2): what this is, one real law, one question (see how?) and a skip that costs nothing.
    const card = E.name ? `<article class="card ob2-law" aria-labelledby="ob2-law-h">
        <p class="ob2-lawtop">${E.num ? `<span class="ob2-num">${esc(E.num)}</span>` : ''}<span class="chip ok">${icon('circle-check')}Became law in ${esc(String(E.yr))}</span></p>
        <h2 class="ob2-lawh" id="ob2-law-h">${esc(E.name)}</h2>${E.what ? `<p class="ob2-lawwhat">${esc(E.what)}</p>` : ''}</article>` : '';
    return shell('st1 ob2 ob2-story ob2-welcome', `${top}<div class="ob2-words">
        <p class="ob2-eyebrow">${E.name ? 'A true story from the Hawaiʻi Legislature' : 'How a bill becomes law in Hawaiʻi'}</p>
        <h1 class="hero" id="st-h" tabindex="-1">${welcomeH(E)}</h1>
        ${card}<p class="lede">${E.name ? '' : 'Every year, people like you help health bills become law. '}Want to see how? About 3 minutes.</p></div>`, pic);
  }
  const [h, p] = sceneWords(k, E);
  return shell('st1 ob2 ob2-story', `${top}<div class="ob2-words">
      <p class="ob2-count"><span class="sr">Scene </span>${k} of ${LAST}</p>
      <h1 class="hero" id="st-h" tabindex="-1">${esc(h)}</h1>
      <p class="lede ob2-say">${p}</p>${k === 2 ? practiceHTML() : ''}</div>`, pic);
}
// A screen reader hears each new scene from a polite live region that lives outside the page's redraws (the page is
// drawn again for every scene, and a live region drawn fresh is not reliably read); focus stays on Next.
function say(text) {
  let el = document.getElementById('ob2-live');
  if (!el) { el = document.createElement('div'); el.id = 'ob2-live'; el.className = 'sr'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.textContent = ''; setTimeout(() => { el.textContent = text; }, 80);
}
const plain = html => html.replace(/<[^>]+>/g, '');
// Next and Back between scenes: the page is drawn again (the scene slides the way the person is going, fx.js swap), the
// window goes back to the top so the drawing is in view, and the new scene is read out.
function toScene(k, dir) {
  const was = scene();
  S.obScene = k; S.ob2From = dir === 'fwd' && !reduced() ? was : null;
  swap(() => { app.render(); window.scrollTo(0, 0); if (!document.activeElement || document.activeElement === document.body) document.getElementById('st-h')?.focus({ preventScroll: true }); }, dir);
  const E = storyBill();
  if (!E.loading) { if (k === 0) say(`${welcomeH(E)}.`); else { const [h, p] = sceneWords(k, E); say(`Scene ${k} of ${LAST}. ${h}. ${plain(p)}`); } }
  // The win at the end of the story: a small burst on the signed law once the signature has drawn itself (C-7: in
  // proportion; the visit's big moments are the first follow and the end). fx.burst does nothing under Reduce Motion.
  if (k === LAST && dir === 'fwd') later(() => burst(document.querySelector('.ob2-signed'), 12, 46), 1700);
}
function wireStory({ step, $ }) {
  const k = scene();
  // The drawing moves once, on the forward step that drew it; any later redraw (data landing, a resize) is the still picture.
  if (S.ob2From != null) setTimeout(() => { S.ob2From = null; }, 0);
  const nb = $('[data-stnext]');
  if (nb) nb.onclick = () => {
    track('story', 'next', { lesson_step: k });
    if (k < LAST) toScene(k + 1, 'fwd'); else goStep(step, step + 1);
  };
  // Back walks back a scene first (B-4); on the welcome there is nothing behind it in this step, so the frame's own Back
  // (only drawn when the story is not step 1) leaves the step as usual.
  const bk = $('[data-stback]');
  if (bk && k > 0) bk.onclick = () => { track('story', 'back', { lesson_step: k }); toScene(k - 1, 'back'); };
  const pb = $('[data-ob2practice]');
  if (pb) pb.onclick = () => {
    const note = document.getElementById('ob2-note'), pic = $('.ob2-pic'), out = $('#ob2-sent');
    if (!note || !pic) return;
    track('story', 'answer', { lesson_step: 2 });
    pic.classList.remove('ob2-landed', 'ob2-sentpic');
    if (out) { out.classList.remove('on'); out.innerHTML = ''; }
    // From your hand, up and over, onto the chair's desk (about a second; at once under Reduce Motion), then the words.
    travel(note, [NOTE_FROM, [150, 4], NOTE_TO], 950, () => {
      S.ob2Sent = true; void pic.getBoundingClientRect(); pic.classList.add('ob2-landed');
      if (out) { out.innerHTML = SENT; out.classList.add('on');
        // On a short phone the words land below the fold, under the bar: bring them up (A-16: what it did is said in view).
        const r = out.getBoundingClientRect(), bar = document.querySelector('.actionbar')?.getBoundingClientRect();
        if (r.bottom > (bar && bar.top < window.innerHeight ? bar.top : window.innerHeight)) out.scrollIntoView({ block: 'end', behavior: reduced() ? 'auto' : 'smooth' }); }
      const lb = pb.querySelector('span'); if (lb) lb.textContent = 'Send it again';
    });
  };
}
function barStory() {
  const E = storyBill(); if (E.loading) return '';
  const k = scene();
  // The welcome: two equal choices (C-2: any answer is a good answer; "Skip to the bills" is a full button, not a quiet
  // link). The frame's Skip handler takes it straight on to the topics, and from there the bills.
  if (k === 0) return `<div class="st-bar"><div class="st-btns ob2-two">${btn('Skip to the bills', { kind: 'secondary', attrs: { 'data-stskip': '1' } })}${btn('Show me how', { kind: 'primary', iconEnd: 'arrow-right', attrs: { 'data-stnext': '1' } })}</div></div>`;
  // The last scene's button says where it goes (C-6).
  if (k === LAST) return bar1('Next: your issues', 'arrow-right');
  return bar2('Next', { iconEnd: 'arrow-right' });
}

// ================= road: where your bills are on the road =================
// The road's six stops, from a bill's stage (the same stages core.js words in STAGE_PLAIN): in its first side's committees
// it is at the hearing; waiting for its first side's vote, at the first vote; in the other side (its committees and its
// vote), on the other side; being agreed between the two, at the final votes; then the Governor.
const STOP_OF = { introduced: 0, first_triple: 1, first_lateral: 1, first_decking: 1, first_floor: 2, first_crossover: 3,
  second_triple: 3, second_lateral: 3, second_decking: 3, second_floor: 3, second_crossover: 4, conference: 4, governor: 5, enacted: 5, vetoed: 5, ballot: 5 };
const AT = ['Just starting', 'At the hearing', 'At the first vote', 'On the other side', 'At the final votes', 'With the Governor'];
const STOPPED = ['Stopped at the start', 'Stopped at the hearing', 'Stopped at the first vote', 'Stopped on the other side', 'Stopped at the final votes', 'Stopped at the Governor'];
// Where a bill is, as a stop on the road and in words: a bold "where on the road", then the page's own plain words for its
// status (plainStatus, or whyStoppedShort for one that stopped), so the card never contradicts the bill's own page.
export function placeOf(b, off, yr) {
  const law = b.stage === 'enacted', stopped = !law && (b.stage === 'dead' || b.stage === 'vetoed' || HELD_RE.test(b.last_action || ''));
  const k = law ? 5 : stopped ? (b.stage === 'vetoed' ? 5 : STOP_OF[b.died_at_stage] ?? STOP_OF[b.stage] ?? 1) : STOP_OF[b.stage] ?? 1;
  let head, more = '';
  if (law) head = `Became law${off && yr ? ` in ${yr}` : ''}`;
  else if (stopped) { head = STOPPED[k]; try { more = b.stage === 'vetoed' ? 'Vetoed by the Governor' : whyStoppedShort(b); } catch { more = ''; } }
  else if (b.stage === 'ballot') head = 'Goes to the voters';
  else { head = AT[k]; try { more = plainStatus(b).short || ''; } catch { more = ''; } }
  if (more && more.toLowerCase() === head.toLowerCase()) more = '';
  return { k, law, stopped, head, more };
}
// The small road on a card: the same six stops in a line, the bill's stop lit, the ones behind it filled. Grey for a bill
// that stopped, a tick in the last stop for a law. The words beside it say the same (A-5: never colour alone).
export function miniRoad({ k, law, stopped }) {
  const xs = [10, 54, 98, 142, 186, 230], ink = stopped ? 'var(--n500)' : 'var(--p700)';
  const dots = xs.map((x, i) => {
    if (law && i === 5) return `<g transform="translate(${x} 12)">${check(9)}</g>`;
    if (i < k || law) return `<circle cx="${x}" cy="12" r="5" fill="${stopped ? 'var(--n400)' : 'var(--p700)'}"/>`;
    if (i > k) return `<circle cx="${x}" cy="12" r="5" fill="var(--n0)" stroke="${stopped ? 'var(--n300)' : 'var(--p300)'}" stroke-width="2"/>`;
    return `<circle cx="${x}" cy="12" r="10" fill="${stopped ? 'var(--n200)' : 'var(--p100)'}"/><circle cx="${x}" cy="12" r="7" fill="${ink}"/>${stopped
      ? `<path d="M${x - 3.5} 12h7" stroke="var(--n0)" stroke-width="2.4" stroke-linecap="round"/>` : `<circle cx="${x}" cy="12" r="2.6" fill="var(--n0)"/>`}`;
  }).join('');
  return `<svg class="ob2-minisvg" viewBox="0 0 240 24" aria-hidden="true" focusable="false">
    <path d="M10 12H230" stroke="${stopped ? 'var(--n200)' : 'var(--p100)'}" stroke-width="4" stroke-linecap="round"/>
    <path d="M10 12H${law ? 230 : xs[k]}" stroke="${stopped ? 'var(--n300)' : 'var(--p600)'}" stroke-width="4" stroke-linecap="round"/>${dots}</svg>`;
}
// The road with every stop named, beside the cards on a laptop: the key to the small roads (on a phone each card's own
// words carry it, and the room goes to the cards). Names alternate above and below the road so they never collide.
function roadKey() {
  const names = stopNames('');
  const stops = STOPX.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${roadY(x).toFixed(1)}" r="8" fill="var(--n0)" stroke="var(--p600)" stroke-width="3"/>
    ${txt(x.toFixed(1), (i % 2 ? roadY(x) - 20 : roadY(x) + 31).toFixed(1), names[i], { fill: 'var(--p800)', anchor: i === 0 ? 'start' : i === 5 ? 'end' : 'middle' })}`).join('');
  return `<svg class="ob2-keysvg" viewBox="0 150 ${VW} 76" aria-hidden="true" focusable="false">
    <path d="${roadD(ROAD_START, ROAD_END)}" fill="none" stroke="var(--n0)" stroke-width="22" stroke-linecap="round"/>
    <path d="${roadD(ROAD_START, ROAD_END)}" fill="none" stroke="var(--p200)" stroke-width="2.5" stroke-dasharray="7 9"/>${stops}</svg>`;
}

// What starts ticked: the most important issue, and only when HIPHI recommends it (staff recommended, or strongly
// supported and not already won: issueInfo's `promoted`). B-12 lets HIPHI's own recommendation start selected when it is
// on screen, one tap undoes it and Skip follows nothing; C-4: nothing is followed unseen. One, not three as the other
// plans' picks: this plan's promise is "following is one tap", so the person does the choosing, while the primary button
// still does something on arrival. An issue they already follow starts ticked too (it is theirs).
const ROAD_N = 4;
S.ob2Road ??= null;
function roadModel() {
  const m = planIssues(); if (m.err || m.loading) return m;
  const top = m.rows.slice(0, ROAD_N), sig = top.map(x => x.i.id).join('|');
  if (!S.ob2Road || S.ob2Road.sig !== sig) S.ob2Road = { sig, on: new Set([...(top[0] && top[0].promoted ? [top[0].i.id] : []), ...top.filter(x => issueFollowed(x.i)).map(x => x.i.id)]) };
  return { ...m, top };
}
// Between sessions the card shows a law where the issue had one (the good news is the true news), else its lead bill.
const shownBill = (x, off) => (off && x.bills.find(b => b.stage === 'enacted' && hasPos(b))) || x.lead;
// The bill's name is not said twice when it is the issue's own name ("Disposable e-cigarette ban" is both), and a bill HIPHI
// is against says so: a card reads as "HIPHI backs this", and "Tax cut for canned cocktails" under "Higher liquor taxes"
// would read backwards without it.
function roadCard(x, on, off, yr) {
  const i = x.i, b = shownBill(x, off), pl = b ? placeOf(b, off, yr) : null;
  const name = b ? nick(b) || blurb(b, 70) : '', same = name.trim().toLowerCase() === String(i.name || '').trim().toLowerCase();
  return `<li class="st-pcard ob2-rcard${on ? ' on' : ''}"><button type="button" class="st-pick" data-ob2pick="${esc(i.id)}" aria-pressed="${on}">
    <span class="st-tick" aria-hidden="true">${icon('check')}</span>
    <span class="st-pbody"><span class="st-phead">${esc(i.name)}</span>
      ${b ? `<span class="ob2-rbill">${same ? '' : `<span>${esc(name)}</span> `}<span class="ob2-rnum">${esc(spaced(b.bill_number))}</span>${/oppose|neutral/.test(b.hiphi_position || '') ? ` ${posChip(b)}` : ''}</span>
      <span class="ob2-mini">${miniRoad(pl)}</span>
      <span class="ob2-where${pl.stopped ? ' ob2-stopped' : ''}"><b>${esc(pl.head)}</b>${pl.more ? `<span> · ${esc(pl.more)}</span>` : ''}</span>` : ''}</span></button></li>`;
}
function stepRoad(step) {
  const m = roadModel();
  if (m.loading) return skel(step);
  if (m.err) return loadErr(step);
  const si = sessionInfo(), off = m.off, yr = si.recapYear;
  const cats = pickedIssues().map(c => c.key), on = S.ob2Road.on.size;
  const where = cats.length ? `the bills on ${esc(andList(cats))}` : 'HIPHI’s bills';
  // Someone who skipped the story has not seen the road yet, so the words do not lean on it.
  const saw = (S.obScene | 0) > 0;
  const h = off ? `Where your bills ended up in ${yr}` : 'Where your bills are on the road';
  const lede = off ? `${saw ? 'The same road as the story. ' : ''}Here’s where ${where} ended in ${yr}. Follow the ones you care about, and we’ll tell you when new bills on them start${si.nextOpen ? `, from ${esc(shortDay(si.nextOpen))}` : ''}.`
    : `${saw ? 'The same road as the story. ' : 'Every bill takes the same road. '}Here’s where ${where} are now. Tap the ones to follow, and we’ll tell you when you can help.`;
  const sure = 'Free. Change them any time.';
  if (!m.top.length) return shell('st2 ob2 ob2-road', `${topRow('road', step)}<h1 class="hero" id="st-h">${esc(h)}</h1>`,
    `<p class="ob2-none">${icon('info')}<span>Nothing is on the road for these topics yet. We’ll keep watch, and you can pick issues any time in Find.</span></p>`);
  return shell('st2 ob2 ob2-road', `${topRow('road', step)}<div class="ob2-key">${roadKey()}</div>
    <h1 class="hero" id="st-h">${esc(h)}</h1><p class="lede">${lede}</p>${sureWide('star', sure)}`,
    `${sayRow('star', sure)}<ul class="st-picks" role="list">${m.top.map(x => roadCard(x, S.ob2Road.on.has(x.i.id), off, yr)).join('')}</ul>
     ${m.rows.length > ROAD_N ? `<p class="small muted ob2-more">${icon('search')}<span>${plural(m.rows.length - ROAD_N, 'more issue')} on these topics in Find, any time.</span></p>` : ''}
     <p class="sr" aria-live="polite" id="ob2-said">${on} ticked</p>`);
}
const followLabel = n => n ? `Follow ${plural(n, 'issue')}` : 'Follow issues';
function wireRoad({ step, $, $$ }) {
  const m = roadModel(); if (m.loading || m.err) return;
  if (!m.top.length) { const nb = $('[data-stnext]'); if (nb) nb.onclick = () => { track('road', 'next'); goStep(step, step + 1); }; return; }
  $$('[data-ob2pick]').forEach(el => el.onclick = () => {
    const id = el.dataset.ob2pick, on = el.getAttribute('aria-pressed') !== 'true';
    el.setAttribute('aria-pressed', String(on)); el.closest('.st-pcard')?.classList.toggle('on', on);
    if (on) S.ob2Road.on.add(id); else S.ob2Road.on.delete(id);
    const t = el.querySelector('.st-tick'); if (t && on && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
    const n = S.ob2Road.on.size, lb = $('[data-stnext] span');
    if (lb) lb.textContent = followLabel(n);
    const said = $('#ob2-said'); if (said) said.textContent = `${n} ticked`;
    clearFlash();
  });
  // Follow the ticked issues, exactly as the other plans' picks do (onb.js wirePicks): a small burst on the button, then on.
  const nb = $('[data-stnext]');
  if (nb) nb.onclick = async () => {
    const ids = [...(S.ob2Road?.on || [])];
    if (!ids.length) { flash('Tick at least one, or select Skip.'); return; }
    busy(nb, 'Following…');
    try { await setFollows({ issuesOn: ids }); wizSet({ followedIssues: ids }); welcome(); } catch (e) { console.error(e); }
    track('road', 'next', { counts: { issues: ids.length } });
    burst(nb, 12, 48); later(() => goStep(step, step + 1), 420);
  };
}
function barRoad() {
  const m = roadModel(); if (m.loading || m.err) return '';
  if (!m.top.length) return bar1('Next', 'arrow-right');
  return bar2(followLabel(S.ob2Road.on.size), { icon: 'star' });
}

// ---------- the dispatch onb.js calls ----------
export function renderStep(name, step) { return name === 'road' ? stepRoad(step) : stepStory(step); }
export function wireStep(name, ctx) { if (name === 'road') wireRoad(ctx); else wireStory(ctx); }
export function barStep(name) { return name === 'road' ? barRoad() : barStory(); }
