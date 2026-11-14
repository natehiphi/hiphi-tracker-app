// Staff7's bill path (the sample's one progress drawing): five stops, passed = a small dot, now = a large dot, to come = a ring, did not advance = a grey dot with a bar.
// Two drawings per bill, so the words stay readable at any width: a compact one (only where the bill is now) and a wide one (every stop); the page's container decides which shows.
// Colours are CSS classes (app.css), so nothing here names a colour. Drawn from the Capitol's stage and committees (staff6/model.js stopOf), nothing else.
import { effStage } from '../staff6/data.js';
import { diedish, stopOf } from '../staff6/model.js';
import { esc } from './parts.js';
import { cmteWords } from './steps.js';
import { PATH_NAMES } from './words.js';

// the five stops, named in words.js (the one table the session line and "Why" use too)
export const STOPS = PATH_NAMES;
const IDX = st => /^first_(triple|lateral|decking|floor)$/.test(st) ? 1 : st === 'first_crossover' ? 2 : /^second_(triple|lateral|decking|floor)$/.test(st) || st === 'second_crossover' || st === 'conference' ? 3 : /^(governor|enacted|vetoed|ballot)$/.test(st) ? 4 : 0;

// { i: the stop it is at (0 to 4), dead, label: where it is in a few words }
export function pathOf(b) {
  const dead = diedish(b), stage = effStage(b), st = stopOf(b), refs = Array.isArray(b.referrals) && b.referrals.length;
  let s = dead && stage === 'dead' && b.died_at_stage ? b.died_at_stage : stage, i = IDX(s);
  if (i === 0 && refs && (s === 'introduced' || s === 'dead')) i = 1;   // referred to its committees: it is waiting in them
  if (!dead && s === 'first_crossover') i = st.committee ? 3 : 2;   // already in a second-chamber committee, or not yet sent to one
  let label = STOPS[i];
  if (!dead) {
    if (st.phase === 'committee' && st.committee && (i === 1 || i === 3)) label = cmteWords(st.committee);
    else if (st.phase === 'floor') label = 'Floor vote';
    else if (st.phase === 'conference') label = 'Conference';
    else if (st.phase === 'law') label = 'Law';
    else if (st.phase === 'vetoed') label = 'Vetoed';
    else if (st.phase === 'ballot') label = 'To the voters';
  }
  return { i, dead, label };
}

// a label is wrapped at about 16 letters a line, so a long committee name never runs into its neighbour: at most four lines
function lines(l) {
  const out = []; let cur = '';
  for (const w of String(l).split(' ')) { if (cur && (cur + ' ' + w).length > 16) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) out.push(cur);
  return out.length > 4 ? [...out.slice(0, 3), out.slice(3).join(' ').slice(0, 15) + '…'] : out;
}

function svg(p, labels, wide) {
  const n = STOPS.length, w = wide ? 640 : 240, pad = wide ? 56 : 12, y = 10, xs = labels.map((_, k) => pad + k * (w - 2 * pad) / (n - 1)), { i, dead } = p;
  const show = wide ? xs.map((_, k) => k).filter(k => !dead || k <= i) : [i];
  const ml = Math.max(1, ...show.map(k => lines(labels[k]).length)), H = 42 + ml * 16;
  let h = `<svg class="trk ${wide ? 'wide' : 'row'}${dead ? ' dead' : ''}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${esc(dead ? `Did not advance, stopped at ${labels[i]}` : `Stop ${i + 1} of ${n}: ${labels[i]}`)}">`;
  h += `<line class="tr" x1="${xs[0]}" y1="${y}" x2="${dead ? xs[i] : xs[n - 1]}" y2="${y}"/>`;
  if (i > 0) h += `<line class="tp" x1="${xs[0]}" y1="${y}" x2="${xs[i]}" y2="${y}"/>`;
  xs.forEach((x, k) => {
    const tt = `<title>${esc(STOPS[k])}${k < i ? ', passed' : k === i ? (dead ? ', where it stopped' : ', now') : ', to come'}</title>`;   // the short name on hover where the drawing has no room to say it
    if (k < i) h += `<circle class="tp" cx="${x}" cy="${y}" r="4">${tt}</circle>`;
    else if (k === i) h += `<circle class="tn" cx="${x}" cy="${y}" r="7">${tt}</circle>`;
    else if (!dead) h += `<circle class="tc" cx="${x}" cy="${y}" r="4.5">${tt}</circle>`;
  });
  if (dead) h += `<line class="tx" x1="${xs[i] + 12}" y1="${y - 7}" x2="${xs[i] + 12}" y2="${y + 7}"/>`;
  for (const k of show) {
    const L = lines(labels[k]), wd = Math.max(...L.map(t => t.length)) * 7.2, tx = wide ? xs[k] : Math.min(Math.max(xs[k], wd / 2), w - wd / 2);
    h += `<text class="tl${k === i ? ' now' : ''}" x="${tx}" y="34" text-anchor="middle">${L.map((t, m) => `<tspan x="${tx}" dy="${m ? 16 : 0}">${esc(t)}</tspan>`).join('')}</text>`;
  }
  return h + '</svg>';
}
// The bill's path, both sizes. `wide: false` draws only the compact one (a row in a list).
export function billPath(b, { wide = false } = {}) {
  const p = pathOf(b), labels = STOPS.map((t, k) => k === p.i ? p.label : t);
  const said = STOPS.map((t, k) => `${t}${k < p.i ? ', passed' : k === p.i ? (p.dead ? ', where it stopped' : ', now') : p.dead ? '' : ', to come'}`).filter((_, k) => !p.dead || k <= p.i).join('. ');
  return svg(p, labels, false) + (wide ? svg(p, labels, true) : '') + `<span class="sr">${esc(said)}.</span>`;
}
