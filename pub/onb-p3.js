// Plan 3, "Meet your people" (R-164; pub/plans.js: island -> you -> topics -> picks -> join -> hello -> wrap). Its own
// screen is the first one: which island? It is the lightest possible first question about where someone lives (C-2: one
// tap, any answer good, Skip costs nothing), and it changes what comes next at once (C-13): the island lights up in the
// drawing here and on the address step after it (start.js myIsland). The address step itself is today's ('you'), and the
// plan's hello and ending are the shared ones in onb.js.
// The plan asks for the street address before showing any bills, which bends C-1 (value first) and C-5 (ask late); Nate
// takes that to the test on purpose (R-164), recorded as an exception in docs/DESIGN-AUDIT.md.
import { S, esc, icon, wiz, wizSet } from './core.js';
import { shell, topRow, bar2, sayRow, sureWide, track, goStep, partnerLine } from './start.js';
import { islands } from './art.js';
import { burst } from './fx.js';
import { PLAN_SURE } from './plans.js';

export const STEPS = ['island'];
// The six islands people live on, west to east as on the map; the keys are art.js's names for them.
const ISLES = [['kauai', 'Kauaʻi'], ['oahu', 'Oʻahu'], ['molokai', 'Molokaʻi'], ['lanai', 'Lānaʻi'], ['maui', 'Maui'], ['hawaii', 'Hawaiʻi Island']];

function stepIsland(step) {
  const sel = wiz().island || '';
  return shell('st1 ob3-island', `${topRow('island', step)}${partnerLine()}<div class="st-art ob3-art">${islands(sel)}</div>
    <h1 class="hero" id="st-h">Meet the two people who vote for you</h1>
    <p class="lede">HIPHI follows the health bills at the Hawaiʻi Legislature. One senator and one representative vote there for where you live. Let’s find yours.</p>${sureWide('clock', PLAN_SURE.p3)}`,
    `${sayRow('clock', PLAN_SURE.p3)}<fieldset class="ob3-isles"><legend class="ob3-q">Which island do you live on?</legend>
      <div class="ob3-grid">${ISLES.map(([k, n]) => `<button type="button" class="ob3-isle${sel === k ? ' on' : ''}" data-ob3isle="${k}" aria-pressed="${sel === k}">
        <span class="ob3-dot" aria-hidden="true">${icon('check')}</span><span>${esc(n)}</span></button>`).join('')}</div></fieldset>`);
}
function wireIsland({ step, $, $$ }) {
  $$('[data-ob3isle]').forEach(el => el.onclick = () => {
    const k = el.dataset.ob3isle, on = wiz().island !== k;
    wizSet({ island: on ? k : '' });
    // The map answers at once: the island lights up, with a small burst on the button (C-7, C-13).
    const art = $('.ob3-art'); if (art) art.innerHTML = islands(on ? k : '');
    $$('[data-ob3isle]').forEach(b => { const me = b === el && on; b.classList.toggle('on', me); b.setAttribute('aria-pressed', String(me)); });
    if (on) burst(el.querySelector('.ob3-dot'), 8, 26);
    const lb = $('[data-stnext] span'); if (lb) lb.textContent = on ? 'Next: find your two' : 'Next';
  });
  const nb = $('[data-stnext]');
  if (nb) nb.onclick = () => { track('island', 'next'); goStep(step, step + 1); };
}
export function renderStep(name, step) { return stepIsland(step); }
export function wireStep(name, ctx) { wireIsland(ctx); }
export function barStep() { return bar2(wiz().island ? 'Next: find your two' : 'Next', { iconEnd: 'arrow-right' }); }
