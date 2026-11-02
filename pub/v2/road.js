// Version 2's teaching, "the island road" (R-357, phase 1; Nate 1 Nov 2026 approved the art, round 3, and the motion set "Road trip").
// Four short pages for the first visit's teaching: 1 the bill (paper, HIPHI's stamp), 2 its road (the bill rides to where it is),
// 3 "It needs a hearing" (Email the chair / Do nothing), 4 "A hearing is set" (Send testimony / Do nothing); the planPic is page 5's
// drawing for the alerts step. Pages 2 to 4 keep ONE svg and only swap what is on it, so the road never jumps. The art is
// backend docs/requests/R-357/teaching-art/opt1.js (journey, act, nothing) re-cut into one parameterised drawing; the motion is
// teaching-mockups/a-template.html's timeline (ride, check pops, email arc, grey creep, sign), re-aimed at this road.
// Nothing here touches the flow: the host (start-rest.js, phase 2) says which bill (E = lessons.js exampleFrom) and calls these.
//   teachHTML(E, o) -> { pic, main }     the drawing and the words for the current page; o = { soft, example, issue, mine, at }
//   teachStart(E, o, { back, redraw, onPick(stop, 'chair'|'testimony'|'none'), onPage(k) })   wires it and plays page 1
//   teachNext() / teachPrev()            true when they moved a page, false at the last / first (the host then leaves the step)
//   planPic(E, o) / planStart({ instant })   page 5's drawing: the flower opens at the bill's stop, the key rises
//   teachStop()                          cancels every timeline and listener
// Words: "can", never a promise; "can't pass this year", never "dies"; e-cigarettes, never "vape" (R-158). Motion: each move under
// ~1.5 s, eased, no overshoot (A-10); under Reduce Motion every timeline jumps to its end.
import { S, esc, blurb, codesOf, CHAMBER_NAME, DEMO } from '../core.js';
import { issueBand, CAPITOL } from '../art.js';

// ---------------------------------------------------------------- the road (360 x 300): two rows joined by one bend
const NS = 'http://www.w3.org/2000/svg';
const P = [[72, 150], [182, 146], [292, 156], [240, 244], [160, 245], [88, 243]];   // Senate committees .. Law
const ROAD = 'M26 152C42 151 57 150 72 150C110 150 146 146 182 146C226 146 266 145 292 156C310 165 318 182 317 200C316 226 290 244 240 244C210 244 186 245 160 245C134 245 112 244 88 243';
const CARD = { x: 214, y: 186, w: 72, h: 40 };   // the hearing card, on the calm plain inside the bend
const LAB = [[0, 72, 117, 'S1'], [0, 72, 131, 'S2'], [1, 182, 130, 'V'], [2, 296, 117, 'C1'], [2, 296, 131, 'C2'], [3, 240, 271, 'O'], [4, 160, 271, 'G'], [5, 88, 271, 'Law']];
const WAIT = [24, 48, 48, 48, 48, 48];   // how far before its stop the bill waits
let MP = null, SL = null;
const mp = () => MP || (MP = (() => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden'); s.innerHTML = `<path d="${ROAD}"/>`; document.body.appendChild(s); const p = s.firstChild; p.tot = p.getTotalLength(); return p; })());
const sl = i => { if (!SL) { const p = mp(); SL = P.map(([sx, sy]) => { let b = 0, bd = 1e9; for (let l = 0; l <= p.tot; l++) { const q = p.getPointAtLength(l), d = Math.hypot(q.x - sx, q.y - sy); if (d < bd) { bd = d; b = l; } } return b; }); } return SL[i]; };
const rest = i => Math.max(sl(i) - WAIT[i], 14);
const pt = l => mp().getPointAtLength(l);

// ---------------------------------------------------------------- the art (palette tokens; the art-only colours stay hex, as art.js)
const lab = (x, y, s, { k = '', a = 'middle', size = 13 } = {}) => `<text x="${x}" y="${y}"${k} font-size="${size}" font-weight="700" stroke="var(--n0)" stroke-width="4" stroke-linejoin="round" paint-order="stroke" text-anchor="${a}">${s}</text>`;
const check = (x, y, s = 1) => `<path d="M${x - 4 * s} ${y + .3 * s}l${2.8 * s} ${2.9 * s}l${5.4 * s} ${-6 * s}" stroke="var(--n0)" stroke-width="${2.4 * s}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const tick = (i, [x, y], r = 9) => `<g transform="translate(${x} ${y})"><g data-k="t${i}" style="opacity:0"><circle r="${r}" fill="var(--p700)"/>${check(0, 0, r / 9)}</g></g>`;
const stop = (i, [x, y], r = 9) => `<circle data-k="s${i}" cx="${x}" cy="${y}" r="${r - 1.5}" fill="var(--n0)" stroke="var(--p300)" stroke-width="3"/><circle data-k="g${i}" cx="${x}" cy="${y}" r="${r - 1.5}" fill="var(--n50)" stroke="var(--n300)" stroke-width="3" style="opacity:0"/>`;
const sheet = (grey, k) => `<g data-k="${k}"${grey ? ' style="opacity:0"' : ''}><path d="M0 2Q0 0 2 0H22L28 6V38Q28 40 26 40H2Q0 40 0 38Z" fill="${grey ? 'var(--n100)' : 'var(--n0)'}" stroke="${grey ? 'var(--n400)' : 'var(--p800)'}" stroke-width="2"/><rect x="-3" y="5" width="20" height="8" rx="2" fill="${grey ? 'var(--n400)' : 'var(--p700)'}"/><path d="M5 22h16M5 29h16" stroke="${grey ? 'var(--n300)' : 'var(--p200)'}" stroke-width="3" stroke-linecap="round"/></g>`;
// the Capitol, the one landmark: a thin roof on six slim columns, the two cone chambers between them, the reflecting pool
const capitol = (x, y) => { const cols = [-50, -30, -10, 10, 30, 50], cone = cx => `M${cx - 23} -3C${cx - 16} -12 ${cx - 10} -30 ${cx - 5} -37H${cx + 5}C${cx + 10} -30 ${cx + 16} -12 ${cx + 23} -3Z`, side = cx => `M${cx} -37H${cx + 5}C${cx + 10} -30 ${cx + 16} -12 ${cx + 23} -3H${cx}Z`;
  return `<g transform="translate(${x} ${y})"><path d="${cone(-22)}" fill="var(--p200)"/><path d="${side(-22)}" fill="var(--p300)"/><path d="${cone(22)}" fill="var(--p200)"/><path d="${side(22)}" fill="var(--p300)"/>
    ${cols.map(d => `<path d="M${d - 1.7} -3L${d - 1.3} -37C${d - 1.4} -39.5 ${d - 3.6} -40.6 ${d - 3.6} -42H${d + 3.6}C${d + 3.6} -40.6 ${d + 1.4} -39.5 ${d + 1.3} -37L${d + 1.7} -3Z" fill="var(--p600)"/>`).join('')}
    <rect x="-60" y="-45.5" width="120" height="4" fill="var(--p800)"/><rect x="-62" y="-48" width="124" height="2.6" rx="1.3" fill="var(--p900)"/><rect x="-61" y="-3" width="122" height="3" rx="1.5" fill="var(--p800)"/>
    <rect x="-56" y="2" width="112" height="10" rx="5" fill="var(--p300)"/><path d="M-42 3L-28 9.5H-16L-2 3ZM2 3L16 9.5H28L42 3Z" fill="var(--p100)" opacity=".85"/>
    ${cols.map(d => `<rect x="${d - .6}" y="3" width="1.2" height="5" fill="var(--p100)"/>`).join('')}</g>`; };
const palm = (x, y, h, flip) => `<g transform="translate(${x} ${y}) scale(${flip} 1)"><path d="M0 0C0 ${-h * .45} 2 ${-h * .8} 6 ${-h}" stroke="#A8714C" stroke-width="3" fill="none" stroke-linecap="round"/><g transform="translate(6 ${-h})" fill="#5E9B2A"><path d="M0 0C-6 -6 -15 -5 -19 1C-12 -2 -6 -2 0 0Z"/><path d="M0 0C6 -7 15 -7 19 -1C12 -3 6 -2 0 0Z"/><path d="M0 0C-3 -7 -1 -13 4 -15C1 -10 1 -5 0 0Z"/><path d="M0 0C7 0 13 5 14 11C9 6 5 3 0 0Z"/><path d="M0 0C-7 1 -12 6 -12 12C-8 7 -4 3 0 0Z"/></g></g>`;
const bloom = (x, y, r = 5, c = 'var(--n0)', rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="${-r * .55}" rx="${r * .42}" ry="${r * .58}" fill="${c}" transform="rotate(${a})"/>`).join('')}<circle r="${r * .22}" fill="#F9D56E"/></g>`;
const cloud = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><rect x="-22" y="-6" width="44" height="12" rx="6"/><circle cx="-6" cy="-7" r="9"/><circle cx="8" cy="-4" r="7"/></g>`;
// The Koʻolau: a smooth crest cut by its many narrow fluted valleys (soft darker folds, clipped to the ridge)
const koolau = (id, x0, x1, base, tops, c, f) => { const n = tops.length, w = (x1 - x0) / (n - 1), pts = tops.map((t, i) => [x0 + i * w, t]); let d = `M${x0} ${base}L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < n; i++) { const [xa, ya] = pts[i - 1], [xb, yb] = pts[i]; d += `C${xa + w * .5} ${ya} ${xb - w * .5} ${yb} ${xb} ${yb}`; } d += `L${x1} ${base}Z`;
  const crest = x => { const i = Math.min(n - 2, Math.max(0, Math.floor((x - x0) / w))), u = (x - x0 - i * w) / w, e = u * u * (3 - 2 * u); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * e; }; let fl = '';
  for (let x = x0 + 5, j = 0; x < x1 - 3; x += 6.5, j++) { const t = crest(x) + 3 + (j % 3) * 2, bw = 2.4 + (j % 2) * 1.2, r = v => v.toFixed(1);
    fl += `<path d="M${r(x)} ${r(t)}C${r(x - .6)} ${r(t + 12)} ${r(x - bw)} ${base - 14} ${r(x - bw)} ${base}H${r(x + bw * .6)}C${r(x + bw * .6)} ${base - 16} ${r(x + .5)} ${r(t + 12)} ${r(x)} ${r(t)}Z"/>`; }
  return `<clipPath id="tr-k${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${c}"/><g clip-path="url(#tr-k${id})" fill="${f}" opacity=".75">${fl}</g>`; };
// People (art.js grown, older, young): one flat silhouette each, no outline per part, no face. `at` scales about the feet.
const at = (x, base, s, inner) => `<g transform="translate(${x} ${base}) scale(${s}) translate(${-x} ${-base})">${inner}</g>`;
const older = (x, base, c, arm) => { const k = { skin: '#C68A5E', hair: '#5A3A22', shirt: 'var(--o400)', shorts: 'var(--n900)', feet: 'var(--p900)', ...c };
  return `<g transform="translate(${x - 117.5} ${base - 113})"><rect x="110.5" y="94" width="5" height="16" rx="2.5" fill="${k.skin}"/><rect x="119.5" y="94" width="5" height="16" rx="2.5" fill="${k.skin}"/>
    <rect x="107" y="108.5" width="10" height="4.5" rx="2.2" fill="${k.feet}"/><rect x="118.5" y="108.5" width="10" height="4.5" rx="2.2" fill="${k.feet}"/><path d="M108 87h19v10h-8l-1.5-3.5L116 97h-8z" fill="${k.shorts}"/>
    ${arm ? `<path d="M125 72l13-15" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>` : `<path d="M126 72l3 16" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>`}
    <rect x="106" y="65" width="22" height="25" rx="7" fill="${k.shirt}"/>${arm ? `<path d="M122 67l7 6-3.5 4-6-4z" fill="${k.shirt}"/>` : `<rect x="121" y="66" width="8" height="10" rx="3.5" fill="${k.shirt}"/>`}
    <rect x="115" y="60" width="5" height="6" fill="${k.skin}"/><circle cx="117.5" cy="55" r="9" fill="${k.skin}"/><path d="M108.5 55a9 9 0 0 1 18 -1.5c-4-2.6-10-2.8-14.5.2-1.3.9-2.4 1.4-3.5 1.3z" fill="${k.hair}"/><path d="M108.6 53.6c-.6 2.4-.3 4.8.7 6.6l2-5.3z" fill="${k.hair}"/></g>`; };
const grown = (x, base, c = {}) => { const k = { skin: '#7A4E31', hair: '#2A211C', shirt: 'var(--p700)', pants: 'var(--n700)', feet: 'var(--n900)', ...c }, t = (dx, dy) => `${x + dx} ${base + dy}`;
  return `<g><rect x="${x - 9.5}" y="${base - 86}" width="19" height="22" rx="7" fill="${k.hair}"/><rect x="${x - 7}" y="${base - 38}" width="6" height="34" rx="2.5" fill="${k.pants}"/><rect x="${x + 1}" y="${base - 38}" width="6" height="34" rx="2.5" fill="${k.pants}"/>
    <rect x="${x - 10}" y="${base - 5}" width="10" height="5" rx="2.4" fill="${k.feet}"/><rect x="${x + 1}" y="${base - 5}" width="10" height="5" rx="2.4" fill="${k.feet}"/>
    <path d="M${t(-9, -64)}l-3 22" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/><path d="M${t(9, -64)}l3 22" stroke="${k.skin}" stroke-width="5.5" stroke-linecap="round"/>
    <rect x="${x - 11}" y="${base - 70}" width="22" height="34" rx="7" fill="${k.shirt}"/><rect x="${x - 2.5}" y="${base - 75}" width="5" height="6" fill="${k.skin}"/><circle cx="${x}" cy="${base - 83}" r="9" fill="${k.skin}"/>
    <path d="M${t(-9, -83)}a9 9 0 0 1 18 0c-4-3.4-12-3.6-18 0z" fill="${k.hair}"/></g>`; };
const young = (x, base) => `<g transform="translate(${x - 72} ${base - 112.5})"><rect x="66.5" y="96" width="4" height="14" rx="2" fill="#C68A5E"/><rect x="73.5" y="96" width="4" height="14" rx="2" fill="#C68A5E"/>
  <rect x="63.5" y="108.5" width="8" height="4" rx="2" fill="var(--p700)"/><rect x="72.5" y="108.5" width="8" height="4" rx="2" fill="var(--p700)"/><path d="M80 82l3 13" stroke="#C68A5E" stroke-width="4" stroke-linecap="round"/><path d="M64 82l-3 13" stroke="#C68A5E" stroke-width="4" stroke-linecap="round"/>
  <path d="M65.5 77h13l5.5 22H60z" fill="var(--o400)"/><path d="M65.5 77h13l1.5 6h-16z" fill="var(--o600)"/><rect x="70" y="73" width="4" height="5" fill="#C68A5E"/><circle cx="72" cy="68" r="7.5" fill="#C68A5E"/>
  <path d="M64.5 68a7.5 7.5 0 0 1 15 0c-3-3.5-9-4-12.5-1-1 .8-1.8 1.2-2.5 1z" fill="#3B2A20"/><circle cx="65.5" cy="62.5" r="3.6" fill="#3B2A20"/></g>`;
const mailG = `<rect x="-9" y="-6" width="18" height="12" rx="2" fill="var(--n0)"/><path d="M-8 -5L0 1L8 -5" stroke="var(--p400)" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;
const noteG = `<rect x="-8" y="-10" width="16" height="20" rx="1.5" fill="var(--n0)" stroke="var(--p700)" stroke-width="1.6"/><path d="M-4 -4h8M-4 0h8M-4 4h5" stroke="var(--p300)" stroke-width="1.8" stroke-linecap="round"/>`;
const petals = k => `<g data-k="${k}">${[[-24, -18, 40], [22, -22, -30], [28, 8, 60], [-26, 10, -50], [2, -30, 20], [-6, 26, 80]].map(([px, py, pr], i) => `<ellipse data-p="${px},${py},${pr}" rx="2.8" ry="4.6" fill="${i % 3 ? 'var(--o400)' : '#F9D56E'}" opacity="0"/>`).join('')}</g>`;

// the island: an organic coast ringed by sand, a pale reef shallow and the deep sea, with a soft shadow under it on the water
const ISLAND = 'M34 96C44 72 84 62 120 66C150 70 170 60 200 62C236 64 262 56 292 68C318 78 330 96 326 116C324 128 338 134 341 152C345 176 333 190 338 212C344 238 338 262 312 272C290 280 262 274 236 280C200 286 160 278 120 282C84 286 50 281 32 268C16 256 22 236 18 218C14 196 24 184 20 166C16 140 22 116 34 96Z';
const wave = (x, y) => `<path d="M${x} ${y}q4 -3 8 0t8 0" stroke="var(--p100)" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
const world = () => `<rect width="360" height="300" fill="var(--p300)"/><rect width="360" height="16" fill="var(--p100)"/><rect y="16" width="360" height="12" fill="#EAF7FD"/><rect y="28" width="360" height="10" fill="var(--o50)"/>
  <circle cx="62" cy="21" r="11" fill="#F4B223"/>${cloud(122, 25, .65, 'var(--n0)')}${cloud(286, 17, .8, 'var(--n0)')}${wave(150, 48)}${wave(250, 46)}${wave(18, 120)}${wave(338, 236)}${wave(190, 292)}${wave(62, 292)}
  <g fill="var(--p600)"><path d="M334 38V51H344Z" fill="var(--n0)"/><path d="M332 40V51H326Z" fill="var(--n0)" opacity=".85"/><path d="M324 52H346L342 56H328Z"/></g>
  <path d="${ISLAND}" transform="translate(3 6)" fill="var(--p400)" stroke="var(--p400)" stroke-width="20" stroke-linejoin="round" opacity=".45"/>
  <path d="${ISLAND}" fill="var(--p200)" stroke="var(--p200)" stroke-width="22" stroke-linejoin="round"/><path d="${ISLAND}" fill="var(--p100)" stroke="var(--p100)" stroke-width="12" stroke-linejoin="round"/>
  <path d="${ISLAND}" fill="#F3E3C0" stroke="#F3E3C0" stroke-width="5" stroke-linejoin="round"/><path d="${ISLAND}" fill="#D6EDC4"/>
  <clipPath id="tr-isl"><path d="${ISLAND}"/></clipPath><g clip-path="url(#tr-isl)">${koolau('f', 70, 334, 116, [104, 86, 72, 66, 74, 63, 69, 80, 92, 106], '#9FD18A', '#86C26C')}${koolau('n', 30, 300, 118, [112, 95, 82, 88, 78, 86, 82, 92, 104, 118], '#6FAE35', '#5E9B2A')}
  <path d="M20 104C90 94 160 102 210 98C260 94 310 100 340 106V116H20Z" fill="var(--n0)" opacity=".45"/><path d="M20 112C90 102 150 109 200 107C250 105 300 107 340 112V140H20Z" fill="#D6EDC4"/></g>
  ${palm(40, 100, 24, 1)}${palm(49, 102, 17, -1)}${palm(318, 268, 24, -1)}${palm(309, 270, 17, 1)}<circle cx="30" cy="254" r="6" fill="#9FD18A"/><circle cx="38" cy="255" r="5" fill="#9FD18A"/>${bloom(28, 252, 4.5)}${bloom(36, 251, 4)}${bloom(40, 256, 3.6, 'var(--o200)')}`;
// "after Email the chair": a warmer sky and light, laid over the world (the off-palette horizon is the orange 50)
const warm = () => `<rect y="16" width="360" height="22" fill="var(--o50)"/><circle cx="62" cy="21" r="22" fill="var(--o200)" opacity=".6"/><circle cx="62" cy="21" r="11" fill="#F4B223"/><g stroke="#F4B223" stroke-width="2.5" stroke-linecap="round" opacity=".7"><path d="M40 21h-6M84 21h6M46 7l-4 -4M78 7l4 -4"/></g><rect width="360" height="300" fill="#F9D56E" opacity=".08"/>`;
// "after Do nothing": the land and sky flatten toward the cool neutrals, a grey cloud in front of the sun
const dim = () => `<rect width="360" height="300" fill="var(--n100)" opacity=".5"/><circle cx="62" cy="21" r="11" fill="var(--n100)" opacity=".7"/>${cloud(68, 24, 1.05, 'var(--n300)')}`;

// ---------------------------------------------------------------- the road drawing
const ids = E => { const nm = [`${E.start} committees`, `${E.start} vote`, `${E.other} committees`, `${E.other} vote`, E.x && E.x.ballot ? 'The voters' : 'Governor']; return nm; };
const stopAt = o => { const a = +(o && o.at) || 0; return a === 2 ? 2 : a === 1 || a === 3 ? a : 0; };
function roadSVG(E, o) {
  const A = stopAt(o), nm = ids(E), [bx, by] = (({ x, y }) => [x, y])(pt(rest(A))), num = esc(E.num), w = Math.round((num.length + 8) * 6.9 + 14), tx = Math.min(Math.max(bx, 16 + w / 2), 344 - w / 2);
  const text = { S1: `${E.start}`, S2: 'committees', V: `${E.start} vote`, C1: `${E.other}`, C2: 'committees', O: `${E.other} vote`, G: nm[4], Law: 'Law' };
  const grpOf = i => LAB.filter(l => l[0] === i).map(([, x, y, key]) => lab(x, y, esc(text[key]))).join('');
  const d = ROAD;
  return `<svg class="tr-sv" viewBox="0 0 360 300" aria-hidden="true" focusable="false"><defs><mask id="tr-gm" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="300"><path data-k="creep" d="${d}" stroke="#fff" stroke-width="32" fill="none" style="stroke-dasharray:0 3000"/></mask></defs>
    ${world()}<g data-k="warm" style="opacity:0">${warm()}</g>${capitol(88, 232)}<g data-k="dim" style="opacity:0">${dim()}</g>
    <path d="${d}" transform="translate(0 2)" stroke="#E6D1A6" stroke-width="14" fill="none" stroke-linecap="round" opacity=".7"/><path d="${d}" stroke="#E6D1A6" stroke-width="14" fill="none" stroke-linecap="round"/><path d="${d}" transform="translate(0 -.6)" stroke="#F3E3C0" stroke-width="10.5" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="var(--n0)" stroke-width="2.2" stroke-dasharray="4 6" fill="none" stroke-linecap="round"/><path data-k="trav" d="${d}" stroke="var(--p500)" stroke-width="3.2" fill="none" stroke-linecap="round" style="stroke-dasharray:0 3000"/>
    <g mask="url(#tr-gm)"><path d="${d}" transform="translate(0 2)" stroke="var(--n300)" stroke-width="14" fill="none" stroke-linecap="round" opacity=".7"/><path d="${d}" stroke="var(--n200)" stroke-width="14" fill="none" stroke-linecap="round"/><path d="${d}" transform="translate(0 -.6)" stroke="var(--n100)" stroke-width="10.5" fill="none" stroke-linecap="round"/><path d="${d}" stroke="var(--n300)" stroke-width="2.2" stroke-dasharray="4 6" fill="none" stroke-linecap="round"/></g>
    ${P.map((p, i) => stop(i, p, i === 5 ? 10 : 9)).join('')}${P.slice(0, 5).map((p, i) => tick(i, p)).join('')}
    <g data-k="card"><g data-k="ce"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="7" fill="var(--n0)" fill-opacity=".7" stroke="var(--p400)" stroke-width="2" stroke-dasharray="5 4"/><text x="${CARD.x + CARD.w / 2}" y="${CARD.y + 25}" font-size="13" font-weight="700" fill="var(--n500)" text-anchor="middle">Hearing</text></g>
      <g data-k="cs" style="opacity:0"><rect x="${CARD.x + 2}" y="${CARD.y + 3}" width="${CARD.w}" height="${CARD.h}" rx="7" fill="var(--p800)" opacity=".15"/><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="7" fill="var(--n0)"/>
        <clipPath id="tr-wipe"><rect data-k="wipe" x="${CARD.x}" y="${CARD.y}" width="0" height="20"/></clipPath><g clip-path="url(#tr-wipe)"><path d="M${CARD.x} ${CARD.y + 7}a7 7 0 0 1 7 -7h${CARD.w - 14}a7 7 0 0 1 7 7v11h-${CARD.w}z" fill="var(--p700)"/><text x="${CARD.x + CARD.w / 2}" y="${CARD.y + 13.5}" font-size="13" font-weight="700" fill="var(--n0)" text-anchor="middle">Hearing</text></g>
        <g transform="translate(${CARD.x + 14} ${CARD.y + 29})"><g data-k="ck"><circle r="7" fill="var(--p700)"/>${check(0, 0, .75)}</g></g><path d="M${CARD.x + 27} ${CARD.y + 26}h34M${CARD.x + 27} ${CARD.y + 32.5}h22" stroke="var(--p100)" stroke-width="3" stroke-linecap="round"/></g></g>
    <g data-k="who"><g data-k="p0">${at(168, 230, .62, grown(168, 230))}</g><g data-k="p1">${at(190, 230, .66, `<g data-k="down">${older(190, 230, {}, 0)}</g><g data-k="up" style="opacity:0">${older(190, 230, {}, 1)}</g>`)}</g></g>
    <g data-k="who3"><g data-k="q0">${at(148, 232, .66, young(148, 232))}</g><g data-k="q1">${at(168, 230, .62, grown(168, 230, { shirt: 'var(--p400)', skin: '#C68A5E', hair: '#5A3A22', pants: 'var(--n500)' }))}</g><g data-k="q2">${at(192, 230, .66, `<g data-k="qdown">${older(192, 230, { shirt: '#F4B223', skin: '#A8714C' }, 0)}</g><g data-k="qup" style="opacity:0">${older(192, 230, { shirt: '#F4B223', skin: '#A8714C' }, 1)}</g>`)}</g></g>
    <g transform="translate(${CARD.x + 36} ${CARD.y + 18})"><g data-k="mail" style="opacity:0">${mailG}</g></g>
    ${[0, 1, 2].map(i => `<g transform="translate(${CARD.x + 42 + i * 6} ${CARD.y + 31 - i * 2})"><g data-k="n${i}" style="opacity:0"><g transform="scale(.85)">${noteG}</g></g></g>`).join('')}
    ${petals('pc')}${petals('px')}
    ${P.slice(0, 6).map((_, i) => `<g data-k="L${i}" style="fill:var(--p900)">${grpOf(i)}</g>`).join('')}
    <circle data-k="halo" r="18" fill="none" stroke="var(--p400)" stroke-width="3" style="opacity:0"/>
    <g data-k="bill" transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><g transform="scale(.78) translate(-14 -20)">${sheet(0, 'bw')}${sheet(1, 'bg')}</g></g>
    ${o.none ? '' : `<g data-k="tag" transform="translate(${tx.toFixed(1)} 161)"><rect x="${-w / 2}" y="0" width="${w}" height="17" rx="8.5" fill="var(--n0)" opacity=".92"/><text data-k="tagt" y="13" font-size="13" font-weight="700" fill="var(--p700)" text-anchor="middle">${num} is here</text></g>`}
    <g data-k="s1" style="opacity:0"><rect x="248" y="226" width="4" height="12" rx="1.5" fill="var(--n400)"/><rect x="${CARD.x - 2}" y="${CARD.y - 2}" width="${CARD.w + 4}" height="${CARD.h + 4}" rx="7" fill="var(--n0)"/><rect x="${CARD.x - 2}" y="${CARD.y - 2}" width="${CARD.w + 4}" height="5" rx="2.5" fill="var(--n400)"/><text x="${CARD.x + CARD.w / 2}" y="${CARD.y + 25}" font-size="13" font-weight="700" fill="var(--n700)" text-anchor="middle">No hearing</text></g>
    <g data-k="s2" style="opacity:0"><rect x="248" y="226" width="4" height="12" rx="1.5" fill="var(--n400)"/><rect x="${CARD.x - 2}" y="${CARD.y - 2}" width="${CARD.w + 4}" height="${CARD.h + 4}" rx="7" fill="var(--n0)"/><rect x="${CARD.x - 2}" y="${CARD.y - 2}" width="${CARD.w + 4}" height="5" rx="2.5" fill="var(--n400)"/><text x="${CARD.x + CARD.w / 2}" y="${CARD.y + 25}" font-size="13" font-weight="700" fill="var(--n700)" text-anchor="middle">Held</text></g></svg>`;
}

// ---------------------------------------------------------------- the timeline: every movement is {at, dur, fn(e), ease}; e runs 0 to 1, eased
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // in and out, as the road's trip
const out = t => 1 - Math.pow(1 - t, 3);                                       // arrivals: quick, then settle
const einv = s => { let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ease(m) < s) lo = m; else hi = m; } return lo; };
const lerp = (a, b, e) => a + (b - a) * e;
const TS = { k: 1, picks: {}, key: '', E: null, o: null, svg: null, run: 0, on: false, onPick: null, onPage: null, st: '' };
function run(steps, still) {
  const id = ++TS.run; steps.forEach(s => s.fn(0));
  if (still || reduced()) { steps.forEach(s => s.fn(1)); return; }
  const t0 = performance.now(), sp = +globalThis.TR_SPEED || 1;
  const tick = now => { if (id !== TS.run) return; let live = false;
    for (const s of steps) { const t = Math.min(1, Math.max(0, (now - t0 - s.at * sp) / (s.dur * sp))); s.fn((s.ease || ease)(t)); if (t < 1) live = true; }
    if (live) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
const el = k => TS.svg && TS.svg.querySelector(`[data-k="${k}"]`);
const sty = (k, n, v) => { const q = el(k); if (q) q.style[n] = v; };
const opa = (k, a = 0, b = 1) => e => sty(k, 'opacity', lerp(a, b, e));
const rise = (k, dy = 10) => e => { const q = el(k); if (q) { q.setAttribute('transform', `translate(0 ${(dy * (1 - e)).toFixed(1)})`); q.style.opacity = e; } };
const pop = k => e => { const q = el(k); if (q) { q.style.opacity = e <= 0 ? 0 : Math.min(1, e * 2); q.setAttribute('transform', `scale(${lerp(.5, 1, e)})`); } };
const ring = (r0, r1) => e => { const q = el('halo'); if (q) { q.setAttribute('r', lerp(r0, r1, e)); q.style.opacity = e <= 0 || e >= 1 ? 0 : .55 * (1 - e); } };
const arc = (k, dx, dy, lift, r0) => e => { const q = el(k); if (q) { q.setAttribute('transform', `translate(${(dx * (1 - e)).toFixed(1)} ${(dy * (1 - e) - lift * 4 * e * (1 - e)).toFixed(1)}) rotate(${(r0 * (1 - e)).toFixed(1)})`); q.style.opacity = Math.min(1, e * 4); } };
const burst = (k, x, y) => e => { const g = el(k); if (!g) return; g.querySelectorAll('ellipse').forEach(p => { const [px, py, pr] = p.dataset.p.split(',').map(Number);
  p.setAttribute('transform', `translate(${x + px * e * .85} ${y + py * e * .85}) rotate(${pr * e})`); p.setAttribute('opacity', e <= 0 || e >= 1 ? 0 : e < .3 ? e / .3 : 1 - (e - .3) / .7); }); };
const ride = (l0, l1) => e => { const q = el('bill'), p = pt(lerp(l0, l1, e)); if (q) q.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); };
const fillTo = (l0, l1) => e => sty('trav', 'strokeDasharray', `${lerp(l0, l1, e).toFixed(1)} 3000`);
const creep = l0 => e => sty('creep', 'strokeDasharray', `0 ${l0.toFixed(1)} ${((mp().tot - l0 + 30) * e).toFixed(1)} 3000`);
const armUp = (up, down) => e => { sty(up, 'opacity', e > .5 ? 1 : 0); sty(down, 'opacity', e > .5 ? 0 : 1); };
const cardSet = e => { sty('cs', 'opacity', e > 0 ? 1 : 0); sty('ce', 'opacity', e > 0 ? 0 : 1); const w = el('wipe'); if (w) w.setAttribute('width', (CARD.w * e).toFixed(1)); sty('ck', 'opacity', e >= 1 ? 1 : 0); };

// Every layer back to its start for a scene: the bill at its waiting place, nothing greyed, nobody standing, the card as asked.
function reset(A, { card = '', ringAt = A } = {}) {
  const b = pt(rest(A)), r = pt(rest(ringAt));
  ['warm', 'dim', 'mail', 'n0', 'n1', 'n2', 's1', 's2'].forEach(k => sty(k, 'opacity', 0));
  ['p0', 'p1', 'q0', 'q1', 'q2', 'card'].forEach(k => { const q = el(k); if (q) { q.removeAttribute('transform'); q.style.opacity = ''; } });
  ['mail', 'n0', 'n1', 'n2'].forEach(k => el(k).removeAttribute('transform'));
  ['p0', 'p1', 'q0', 'q1', 'q2'].forEach(k => sty(k, 'opacity', 0));
  sty('up', 'opacity', 0); sty('down', 'opacity', 1); sty('qup', 'opacity', 0); sty('qdown', 'opacity', 1);
  sty('creep', 'strokeDasharray', '0 3000'); sty('trav', 'strokeDasharray', `${rest(A).toFixed(1)} 3000`);
  for (let i = 0; i < 6; i++) { sty(`g${i}`, 'opacity', 0); sty(`L${i}`, 'fill', 'var(--p900)'); if (i < 5) sty(`t${i}`, 'opacity', i < A ? 1 : 0); const t = el(`t${i}`); if (t) t.removeAttribute('transform'); }
  el('bill').setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`); sty('bw', 'opacity', 1); sty('bg', 'opacity', 0);
  sty('tag', 'opacity', 1); sty('tagt', 'fill', 'var(--p700)');
  const h = el('halo'); h.setAttribute('cx', r.x.toFixed(1)); h.setAttribute('cy', r.y.toFixed(1)); h.style.opacity = 0;
  ['pc', 'px'].forEach(k => el(k).querySelectorAll('ellipse').forEach(p => p.setAttribute('opacity', 0)));
  sty('ce', 'opacity', card === 'empty' ? 1 : 0); sty('cs', 'opacity', card === 'set' ? 1 : 0); el('wipe').setAttribute('width', card === 'set' ? CARD.w : 0); sty('ck', 'opacity', 1);
  sty('card', 'opacity', card ? 1 : 0);
}
// "Do nothing": grey spreads forward from the bill along the road (1.1 s), each stop greying as it is reached; the scene dims; the bill greys; a sign rises
function greyOut(A, sign, cardTo) {
  const L0 = rest(A), tot = mp().tot;
  return [{ at: 0, dur: 1100, fn: creep(L0 + 4), ease: t => t },
    ...[0, 1, 2, 3, 4, 5].filter(i => i >= A).map(i => ({ at: 1100 * Math.max(0, sl(i) - L0) / (tot - L0), dur: 250, fn: e => { sty(`g${i}`, 'opacity', e); if (i > A) sty(`L${i}`, 'fill', e > 0 ? 'var(--n400)' : 'var(--p900)'); } })),
    { at: 200, dur: 900, fn: opa('dim') }, { at: 300, dur: 500, fn: e => { sty('bw', 'opacity', 1 - e); sty('bg', 'opacity', e); sty('tagt', 'fill', e > .5 ? 'var(--n400)' : 'var(--p700)'); } },
    { at: 300, dur: 700, fn: opa('card', 1, cardTo) }, { at: 1000, dur: 350, fn: rise(sign, 12), ease: out }];
}
// one scene: what it starts from and the steps that move it to its end picture
function scene(st, A) {
  const L = rest(A), N = rest(Math.min(A + 1, 5)), [sx, sy] = P[A], cx = CARD.x + 14, cy = CARD.y + 29;
  if (st === 'road') return { r: { card: '' }, steps: [{ at: 0, dur: 1400, fn: ride(0, L) }, { at: 0, dur: 1400, fn: fillTo(0, L) },
    ...[0, 1, 2, 3, 4].filter(i => i < A).map(i => ({ at: 1400 * einv(Math.min(1, sl(i) / L)), dur: 260, fn: pop(`t${i}`), ease: out })),
    { at: 1450, dur: 400, fn: opa('tag') }, { at: 1500, dur: 900, fn: ring(14, 30), ease: out }, { at: 2300, dur: 900, fn: ring(14, 30), ease: out }] };
  if (st === 'need') return { r: { card: 'empty' }, steps: [{ at: 0, dur: 500, fn: rise('card', 8), ease: out }, { at: 200, dur: 900, fn: ring(14, 30), ease: out }] };
  if (st === 'set') return { r: { card: 'set' }, steps: [{ at: 0, dur: 1, fn: cardSet }, { at: 100, dur: 900, fn: ring(14, 30), ease: out }] };
  if (st === 'chair') return { r: { card: 'empty' }, steps: [{ at: 0, dur: 400, fn: opa('warm'), ease: out },
    { at: 0, dur: 350, fn: rise('p0', 8), ease: out }, { at: 80, dur: 350, fn: rise('p1', 8), ease: out }, { at: 380, dur: 100, fn: armUp('up', 'down') },
    { at: 450, dur: 800, fn: arc('mail', 204 - (CARD.x + 36), 190 - (CARD.y + 18), 40, -18) }, { at: 1250, dur: 200, fn: e => { if (e > 0) sty('mail', 'opacity', 1 - e); } },
    { at: 1200, dur: 450, fn: cardSet, ease: out }, { at: 1600, dur: 280, fn: pop('ck'), ease: out }, { at: 1650, dur: 650, fn: burst('pc', cx, cy), ease: out }] };
  if (st === 'no1') return { r: { card: 'empty' }, steps: greyOut(A, 's1', .35) };
  if (st === 'no2') return { r: { card: 'set' }, steps: greyOut(A, 's2', .5) };
  // test: three notes arc onto the card one after another, then the bill rides on, the stop it left gets its check and petals
  const hands = [[150, 190], [170, 176], [200, 186]], ln = [0, 1, 2].map(i => [CARD.x + 42 + i * 6, CARD.y + 31 - i * 2]);
  return { r: { card: 'set', ringAt: Math.min(A + 1, 5) }, steps: [{ at: 0, dur: 250, fn: e => sty('tag', 'opacity', 1 - e) },
    { at: 0, dur: 350, fn: rise('q0', 8), ease: out }, { at: 70, dur: 350, fn: rise('q1', 8), ease: out }, { at: 140, dur: 350, fn: rise('q2', 8), ease: out }, { at: 350, dur: 100, fn: armUp('qup', 'qdown') },
    ...ln.map(([x, y], i) => ({ at: 420 + i * 150, dur: 700, fn: arc(`n${i}`, hands[i][0] - x, hands[i][1] - y, 36, -20) })),
    { at: 1350, dur: 900, fn: ride(L, N) }, { at: 1350, dur: 900, fn: fillTo(L, N) },
    { at: 1350 + 900 * einv(Math.min(1, Math.max(0, (sl(A) - L) / (N - L)))), dur: 280, fn: pop(`t${A}`), ease: out }, { at: 1500, dur: 650, fn: burst('px', sx, sy), ease: out },
    { at: 2250, dur: 900, fn: ring(14, 30), ease: out }] };
}
function show(st, { still = false } = {}) {
  if (!TS.svg || !TS.svg.isConnected) return;
  const A = stopAt(TS.o), sc = scene(st, A);
  TS.st = st; reset(A, sc.r); run(sc.steps, still);
}

// ---------------------------------------------------------------- page 1: the paper and HIPHI's stamp
const STAMP = { strongly_support: ['STRONGLY', 'SUPPORTS'], support: ['SUPPORTS'], support_amend: ['SUPPORTS', 'WITH', 'CHANGES'], strongly_oppose: ['STRONGLY', 'OPPOSES'], oppose: ['OPPOSES'], neutral: ['HAS', 'COMMENTS'] };
const STAND = { strongly_support: ['strongly supports it', 'strongly supported it'], support: ['supports it', 'supported it'], support_amend: ['supports it, with changes', 'supported it, with changes'], strongly_oppose: ['strongly opposes it', 'strongly opposed it'], oppose: ['opposes it', 'opposed it'], neutral: ['has comments on it', 'had comments on it'] };
const plainSum = b => { const t = blurb(b, 150); return /^relating to\s/i.test(t) ? 'A bill about ' + t.replace(/^relating to\s+/i, '') : t; };
// the title on the sheet: two lines at most, the type size chosen to fit the sheet's width
function sheetTitle(t) {
  const ws = String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), W = 128;
  const wrap = max => { const o = []; let c = ''; for (const w of ws) { if (!c) c = w; else if (`${c} ${w}`.length <= max) c += ` ${w}`; else { o.push(c); c = w; } } if (c) o.push(c); return o; };
  for (const fs of [17, 15, 13]) { const max = Math.floor(W / (fs * .56)); if (ws.every(w => w.length <= max)) { const l = wrap(max); if (l.length <= 2) return { fs, l }; } }
  const l = wrap(Math.floor(W / (13 * .56))); if (l.length > 2) { l.length = 2; l[1] = l[1].replace(/[,;:.]?$/, '…'); } return { fs: 13, l };
}
function paperSVG(E) {
  const T = sheetTitle(E.name), num = esc(E.num), nw = Math.max(86, E.num.length * 11 + 22), words = STAMP[E.b.hiphi_position], lines = words ? ['HIPHI', ...words] : [], n = lines.length;
  const Y = { 2: [2, 15], 3: [-3, 9, 19], 4: [-8, 2, 11, 20] }[n] || [], fl = n >= 4 ? null : [n === 3 ? -21 : -19, n === 3 ? .72 : .85], fs = n >= 4 ? 8.5 : 9;
  const stamp = n ? `<g transform="translate(292 104) rotate(-12)"><circle data-k="ink" r="40" fill="none" stroke="var(--o400)" stroke-width="2" opacity="0"/><g data-k="stamp"><circle r="40" fill="var(--o50)" stroke="var(--o600)" stroke-width="3"/><circle r="34" fill="none" stroke="var(--o600)" stroke-width="1.2"/>
    ${fl ? `<g transform="translate(0 ${fl[0]}) scale(${fl[1]})">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-6.5" rx="4.6" ry="6.5" fill="var(--o400)" transform="rotate(${r})"/>`).join('')}<circle r="3" fill="#F9D56E"/></g>` : ''}
    ${lines.map((l, i) => `<text x="0" y="${Y[i]}" font-size="${i ? fs : 12}" font-weight="700" fill="var(--o600)" text-anchor="middle">${l}</text>`).join('')}</g></g>` : '';
  return `<svg class="tr-sv tr-paper" viewBox="0 0 360 150" aria-hidden="true" focusable="false"><g transform="translate(88 6) rotate(-3)"><g data-k="paper"><path d="M0 4Q0 0 4 0H148L168 20V136Q168 140 164 140H4Q0 140 0 136Z" fill="var(--n0)" stroke="var(--p900)" stroke-width="2"/><path d="M148 0V20H168" fill="var(--p100)" stroke="var(--p900)" stroke-width="2" stroke-linejoin="round"/>
    <rect x="-8" y="14" width="${nw}" height="28" rx="4" fill="var(--p700)"/><text x="${nw / 2 - 8}" y="34" font-size="17" font-weight="700" fill="var(--n0)" text-anchor="middle">${num}</text>
    ${T.l.map((l, i) => `<text x="18" y="${66 + i * (T.fs + 4)}" font-size="${T.fs}" font-weight="700" fill="var(--n900)">${esc(l)}</text>`).join('')}
    <path d="M18 ${T.l.length > 1 ? 112 : 100}h110M18 ${T.l.length > 1 ? 124 : 112}h84" stroke="var(--p200)" stroke-width="5" stroke-linecap="round"/></g></g>${stamp}</svg>`;
}
function paperSteps() {
  return [{ at: 0, dur: 550, fn: rise('paper', 22), ease: out },
    { at: 600, dur: 320, fn: e => { const s = el('stamp'); if (s) { s.setAttribute('transform', `scale(${lerp(1.35, 1, e).toFixed(3)})`); s.style.opacity = e <= 0 ? 0 : Math.min(1, e * 1.6); } }, ease: out },
    { at: 900, dur: 600, fn: e => { const r = el('ink'); if (r) { r.setAttribute('r', lerp(40, 56, e)); r.style.opacity = e <= 0 || e >= 1 ? 0 : .7 * (1 - e); } }, ease: out }];
}

// ---------------------------------------------------------------- the words
const NUMW = /^(One|Two|Three|Four|Five|Six)\b/;
const lc = s => s ? s[0].toLowerCase() + s.slice(1) : s;
// "House Health Committee" / "House Health and Finance committees" / "three House committees", from the bill's own committees
function brief(E) {
  const codes = codesOf(E.x && E.x.st && E.x.st.committee), cs = codes.map(c => S.committees && S.committees[c]).filter(Boolean), ch = CHAMBER_NAME[cs[0] && cs[0].chamber] || '';
  if (!cs.length) return null;
  const sh = n => n.length <= 14 ? n : n.split(/\s+(?:and|&)\s+|,\s*/)[0];
  if (cs.length === 1) return { text: `${ch} ${cs[0].name} Committee`.trim(), n: 1 };
  if (cs.length === 2) return { text: `${ch} ${sh(cs[0].name)} and ${sh(cs[1].name)} committees`.trim(), n: 2 };
  return { text: `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][cs.length] || cs.length} ${ch} committees`.trim(), n: cs.length };
}
const wouldWords = (num, sum) => {
  const m = /^([A-Z][a-z]{2,})\s+(.*)$/.exec(sum), w = m && m[1];
  if (!w || !/s$/.test(w) || /ss$|^(This|Its|Hawaii|Funds|Taxes|Bills)$/.test(w)) return `<b>${num}</b>: ${esc(sum)}`;
  const base = /ies$/.test(w) ? w.replace(/ies$/, 'y') : /(sh|ch|x|z|o)es$/.test(w) ? w.replace(/es$/, '') : w.replace(/s$/, '');
  return `<b>${num}</b> would ${esc(lc(base))} ${esc(m[2])}`;
};
function pageWords(E, o, k) {
  const num = esc(E.num);
  if (k === 1) {
    let sum = plainSum(E.b); if (sum && !/[.…!?]$/.test(sum)) sum += '.';
    const iss = o.issue && o.issue.name ? `It’s on ${o.mine ? 'one of your issues' : 'the issue'}: ${esc(o.issue.name.replace(/[.!?]$/, ''))}. ` : '', stand = STAND[E.b.hiphi_position] ? `HIPHI ${STAND[E.b.hiphi_position][E.off ? 1 : 0]}.` : '',
      pre = (/^(HB|SB)\d/.exec(E.b.bill_number || '') || [])[1], said = pre ? `${pre} means ${pre === 'HB' ? 'House' : 'Senate'} Bill: it started in the ${pre === 'HB' ? 'House' : 'Senate'}.` : `It started in the ${E.start}.`;
    return `<p>${sum ? wouldWords(num, sum.replace(/\.$/, '')) + '.' : `<b>${num}</b>`}</p><p>${iss}${stand}</p><p>${said}</p>`.replace('<p></p>', '');
  }
  if (k === 2) {
    const road = `Every bill takes this road: committees and a vote in the ${E.start}, then the same in the ${E.other}, then ${E.x && E.x.ballot ? 'the voters' : 'the Governor'}.`, ch = stopAt(o) <= 1 ? E.start : E.other, b = o.soft ? null : brief(E);
    const where = o.soft ? `Suppose it’s with the ${ch} committees, waiting for a hearing. Each committee’s chair decides which bills get one.`
      : b ? `Right now it’s with ${NUMW.test(b.text) ? lc(b.text) : `the ${b.text}`}. ${b.n > 1 ? 'Each chair decides' : 'Its chair decides'} if it gets a hearing.` : `Right now it’s with the ${ch} committees. Each chair decides if it gets a hearing.`;
    return `<p>${esc(road)}</p><p>${esc(where)}</p>`;
  }
  return '';
}
const TITLE = { 1: E => `Meet ${esc(E.num)}`, 2: () => 'Its road to becoming law', 3: () => 'It needs a hearing', 4: () => 'A hearing is set' };
const ASK = { 3: ['What would you do?', [['chair', 'Email the chair', 'mail'], ['none', 'Do nothing', 'none']]], 4: ['Now what would you do?', [['testimony', 'Send testimony', 'note'], ['none', 'Do nothing', 'none']]] };
const ICON = { mail: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--p700)" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--p700)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 19h4"/></svg>',
  none: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--n500)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/></svg>' };
function said(E, k, v) {
  const num = TS.o.none ? 'the bill' : esc(E.num), nx = esc(ids(E)[Math.min(stopAt(TS.o) + 1, 4)]);
  const T = { chair: ['Chairs pick which bills get a hearing, and they notice who writes in. Emails like yours make a hearing more likely.', 'With nobody asking, it can sit without one.'],
    none3: ['With nobody asking, it can sit without a hearing. Then it can’t pass this year.', 'An email to the chair can help it get one.'],
    testimony: [`Testimony is a few sentences saying what you think. The committee reads it before it votes, and it can carry ${num} on to the ${nx}.`, 'With nothing sent, it can be held.'],
    none4: ['With nothing sent, the committee can hold it, and then it can’t pass this year.', 'Testimony can carry it on.'] }[v === 'none' ? `none${k}` : v];
  return `<p class="lx-said${v === 'none' ? ' lx-said-no' : ''}">${T[0]}</p><p class="lx-other">${T[1]}</p>`;
}
// non-breaking hyphens: "e-cigarettes" never splits across two lines (applied to the text between tags only)
const nbh = h => h.replace(/>([^<]+)</g, (m, t) => '>' + t.replace(/\b([\w\u02bb]+(?:-[\w\u02bb]+)+)\b/g, '<span class="tr-nb">$1</span>') + '<');
function capHTML(E, o, k, { sayAll = '' } = {}) {
  if (k < 3) return nbh(pageWords(E, o, k));
  const [q, opts] = ASK[k], pick = TS.picks[k], v = pick || '';
  return nbh(`<p class="tr-q">${q}</p><div class="lx-doors tr-doors" role="group" aria-label="${q}">${opts.map(([val, l, ic]) => `<button type="button" class="lx-ch lx-door tr-ch" data-tr="${val}" aria-pressed="${pick === val}">${ICON[ic]}<span>${l}</span></button>`).join('')}</div>
    <div class="lx-saidbox lx-got tr-said" id="tr-said" aria-live="polite">${sayAll || (pick ? said(E, k, v) : '')}</div>`);
}
// The screen's own heading (h1#st-h) says the page: "k of n" and the title above it, and an example's small label on page 1.
const off = () => (TS.o && TS.o.none ? 1 : 0);   // with no bill at all, page 1 (the paper) is left out and the others count 1 to 3
function head(E, o, k) {
  const ex = k === 1 && o.example ? '<p class="tr-ex" id="tr-ex">An example bill</p>' : '';
  return `${ex}<p class="lx-count" id="tr-count">${k - off()} of ${TEACH_LAST - off()}</p><h1 class="hero" id="st-h" tabindex="-1">${TITLE[k](E)}</h1>`;
}
function syncHead(k) {
  const h = document.getElementById('st-h'); if (!h) return;
  h.innerHTML = TITLE[k](TS.E);
  let c = document.getElementById('tr-count'); if (!c) { c = document.createElement('p'); c.className = 'lx-count'; c.id = 'tr-count'; h.before(c); }
  c.textContent = `${k - off()} of ${TEACH_LAST - off()}`;
  const ex = document.getElementById('tr-ex'), want = k === 1 && TS.o.example;
  if (want && !ex) { const e = document.createElement('p'); e.className = 'tr-ex'; e.id = 'tr-ex'; e.textContent = 'An example bill'; c.before(e); } else if (!want && ex) ex.remove();
}
const picInner = (E, o, k) => k === 1 ? `<div class="tr-band">${issueBand(o.issue || null, DEMO) || CAPITOL}</div>${paperSVG(E)}` : roadSVG(E, o);

// ---------------------------------------------------------------- the interface
export const TEACH_LAST = 4;
export const teachLast = () => TEACH_LAST - off();   // 3 when HIPHI supports no bill at all (o.none): no page 1
export const teachPage = () => TS.k - off();
const keyOf = (E, o) => `${E.id}|${(o.issue && o.issue.id) || ''}|${stopAt(o)}|${!!o.none}`;
function begin(E, o) { const key = keyOf(E, o); TS.E = E; TS.o = o = { soft: false, example: false, issue: null, mine: false, at: 0, ...o }; if (TS.key !== key) { TS.key = key; TS.k = 1 + off(); TS.picks = {}; } return o; }
export function teachHTML(E, o = {}) {
  o = begin(E, o);
  return { head: head(E, o, TS.k), pic: `<div class="tr-pic${TS.k === 1 ? ' tr-onpaper' : ''}" id="tr-pic" data-page="${TS.k}">${picInner(E, o, TS.k)}</div>`,
    main: `<div class="lx lx-l-road tr-l" data-lx="teach" data-page="${TS.k}"><div class="lx-scap lx-roadcap tr-cap" id="tr-cap">${capHTML(E, o, TS.k)}</div></div>` };
}
const root = () => document.querySelector('.lx[data-lx="teach"]');
function wake() { const k = TS.k, ready = k < 3 || !!TS.picks[k]; document.querySelectorAll('[data-stnext], [data-stlearnnext]').forEach(b => { b.hidden = !ready; }); }
// The caption keeps the height of its taller first page so Next never jumps; pages 3 and 4 keep the room of the longer answer in the box.
function fit() {
  const r = root(), cap = r && r.querySelector('#tr-cap'); if (!cap || !TS.E) return;
  const pr = document.createElement('div'); pr.setAttribute('aria-hidden', 'true'); pr.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;width:' + cap.getBoundingClientRect().width + 'px'; r.appendChild(pr);
  let h = 0;
  if (TS.k < 3) { pr.className = cap.className; [1, 2].forEach(k => { pr.innerHTML = capHTML(TS.E, TS.o, k); h = Math.max(h, pr.getBoundingClientRect().height); }); cap.style.minHeight = `${Math.ceil(h)}px`; }
  else { cap.style.minHeight = ''; const sb = cap.querySelector('#tr-said'); pr.style.width = sb.getBoundingClientRect().width + 'px'; pr.className = 'lx-saidbox';
    ASK[TS.k][1].forEach(([v]) => { pr.innerHTML = said(TS.E, TS.k, v); h = Math.max(h, pr.getBoundingClientRect().height); }); sb.style.minHeight = `${Math.ceil(h)}px`; }
  pr.remove();
}
function paint(k, { still = false, swap = true, focus = false } = {}) {
  const r = root(), pic = document.getElementById('tr-pic'); if (!r || !pic) return;
  const E = TS.E, o = TS.o, was = TS.k; TS.k = k; r.dataset.page = k; syncHead(k);
  const cap = r.querySelector('#tr-cap'); cap.style.minHeight = ''; cap.innerHTML = capHTML(E, o, k);
  if (swap) { cap.classList.remove('tr-swap'); void cap.offsetWidth; cap.classList.add('tr-swap'); }
  pic.dataset.page = k; pic.classList.toggle('tr-onpaper', k === 1);
  if (k === 1) { pic.innerHTML = picInner(E, o, 1); TS.svg = pic.firstElementChild.nextElementSibling; run(paperSteps(), still); }
  else {
    if (was === 1 || !pic.querySelector('.tr-sv') || pic.querySelector('.tr-paper')) { pic.innerHTML = picInner(E, o, k); TS.svg = pic.firstElementChild; } else TS.svg = pic.querySelector('.tr-sv');
    const p = TS.picks[k];
    show(k === 2 ? 'road' : p ? (p === 'none' ? (k === 3 ? 'no1' : 'no2') : p === 'chair' ? 'chair' : 'test') : k === 3 ? 'need' : 'set', { still: still || (k > 2 && !!p) });
  }
  wake(); fit();
  if (TS.onPage) TS.onPage(k - off());
  if (focus) { const h = document.getElementById('st-h'); if (h) h.focus({ preventScroll: true }); }
}
export function teachStart(E, o = {}, { back = false, redraw = false, onPick = null, onPage = null } = {}) {
  teachStop(); o = begin(E, o); TS.onPick = onPick; TS.onPage = onPage;
  const r = root(); if (!r || !document.getElementById('tr-pic')) return; TS.on = true;
  if (!back && !redraw) { TS.k = 1 + off(); TS.picks = {}; }
  r.onclick = e => {
    const b = e.target.closest('[data-tr]'); if (!b || !r.contains(b)) return;
    const k = TS.k, v = b.dataset.tr; if (k < 3) return;
    TS.picks[k] = v; r.querySelectorAll('[data-tr]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const box = r.querySelector('#tr-said'); box.innerHTML = said(E, k, v); box.classList.remove('tr-swap'); void box.offsetWidth; box.classList.add('tr-swap');
    if (TS.onPick) TS.onPick(k === 3 ? 1 : 2, v);
    show(v === 'none' ? (k === 3 ? 'no1' : 'no2') : v === 'chair' ? 'chair' : 'test'); wake();
    const first = box.querySelector('.lx-said'); if (first) { first.tabIndex = -1; first.focus({ preventScroll: true }); }
    requestAnimationFrame(() => { const m = box.getBoundingClientRect(), bar = document.querySelector('.actionbar, .st-bar, .bar'), bot = (bar ? bar.getBoundingClientRect().top : innerHeight) - 8, need = Math.min(m.bottom, m.top + 72);   // the answer's first lines in view above the bar
      if (need > bot) scrollBy({ top: need - bot, behavior: reduced() ? 'auto' : 'smooth' }); });
  };
  TS.rz = () => fit(); addEventListener('resize', TS.rz);
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (TS.on && root()) fit(); });
  paint(back ? TEACH_LAST : redraw ? TS.k : 1 + off(), { still: back || redraw, swap: false });
}
export function teachNext() { if (!TS.on || TS.k >= TEACH_LAST) return false; if (TS.k + 1 >= 3) TS.picks[TS.k + 1] = null; paint(TS.k + 1, { focus: true }); return true; }
export function teachPrev() { if (!TS.on || TS.k <= 1 + off()) return false; paint(TS.k - 1, { still: true, focus: true }); return true; }
export function teachStop() { TS.run++; TS.on = false; if (TS.rz) removeEventListener('resize', TS.rz); TS.rz = null; const r = root(); if (r) r.onclick = null; }

// ---------------------------------------------------------------- page 5: the road, the bill at its stop, the flower, the key
export function planPic(E, o = {}) {
  o = begin(E, o); const A = stopAt(o), [fx, fy] = P[A];   // the flower opens ON the stop's circle
  let svg = roadSVG(E, o);
  const keyG = `<g data-k="key"><rect x="160" y="186" width="140" height="44" rx="10" fill="var(--o50)" stroke="var(--o200)"/>${bloom(176, 200, 6, 'var(--o400)')}<text x="188" y="205" font-size="13" font-weight="700" fill="var(--o600)">Email the chair</text>${bloom(176, 218, 6, 'var(--o400)')}<text x="188" y="223" font-size="13" font-weight="700" fill="var(--o600)">Send testimony</text></g>`;
  const fl = `<g transform="translate(${fx} ${fy}) scale(1.5)">${[0, 72, 144, 216, 288].map((r, i) => `<g transform="rotate(${r})"><ellipse data-k="fp${i}" cx="0" cy="-6.5" rx="4.6" ry="6.5" fill="var(--o400)" opacity="0"/></g>`).join('')}<circle data-k="fc" r="3" fill="#F9D56E" opacity="0"/></g>`;
  svg = svg.replace('</svg>', `${fl}${keyG}</svg>`).replace('<svg class="tr-sv"', '<svg class="tr-sv tr-plan"');
  return `<div class="tr-pic" id="tr-pic" data-page="5">${svg}</div>`;
}
export function planStart({ instant = false } = {}) {
  teachStop(); const pic = document.getElementById('tr-pic'); TS.svg = pic && pic.querySelector('.tr-sv'); if (!TS.svg) return;
  const A = stopAt(TS.o); reset(A, { card: '' }); sty('tag', 'opacity', 0); sty(`s${A}`, 'opacity', 0); sty('card', 'opacity', 0); TS.st = 'plan';
  const pet = [0, 1, 2, 3, 4].map(i => ({ at: 150 + i * 90, dur: 300, fn: e => { const p = el(`fp${i}`); if (p) { p.setAttribute('opacity', e > 0 ? 1 : 0); p.setAttribute('transform', `scale(${e.toFixed(3)})`); } }, ease: out }));
  run([...pet, { at: 600, dur: 200, fn: opa('fc') }, { at: 750, dur: 450, fn: rise('key', 8), ease: out }], instant);
}
