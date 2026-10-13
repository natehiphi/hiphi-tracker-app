// R-277 fix 17 (U-1): one open-bill panel for Today and Bills.
// The review found the same bill, in the same minute, opening in two different panels: Today said "Testimony due today
// 10:00 AM" and Bills "Mon 3/16, 10:00 AM · under an hour"; "File at the Capitol" was filled on one and outlined on the
// other; only Bills had a close X and the "…" sat somewhere else on each. Both now draw the panel here, in one order:
//   1. the bill's number (P1 after it), then its "…", then the close X, on the top line;
//   2. its name as the heading, and the plain summary;
//   3. the one deadline line (today.js says it the same way for both);
//   4. the one hearing line: committee, day, time and room, who is going, and I'm going;
//   5. the step: its words, and its buttons with the main step as the one filled button (A-3);
//   6. the rest: what else is open on the bill, then the facts (folded on Today, open on Bills, where the table beside it
//      gives up its columns to make room); and "Open the bill" at the foot, held in view while the panel scrolls.
// Only the frame is here. What the step is, its buttons and the "…" menu are Today's (today.js billPaneOf, dockPane), so
// one bill has one step wherever it is opened. Its looks are staff.css's .bp-* (one set of rules for both screens).
import { esc } from './data.js';
import { icon, goingBtn } from './ui.js';
import { billNum, blurb, hearingWhen, billRoute } from './model.js';

// `b` the bill (or null for an item that is not about one: `kind` is then its icon and word for the top line).
export function billPane({ b = null, kind = '', p1 = '', headId, more = '', close = '', due = '', hear = '', step = '', rest = '', open = null }) {
  const top = `<div class="bp-top"><p class="bp-num">${b ? `<span class="bn-num">${esc(billNum(b))}</span>${p1}` : kind}</p>${more}${close}</div>`;
  const name = b ? `<h2 class="bp-name" id="${esc(headId)}">${esc(b.nickname || blurb(b, 120))}</h2>${b.nickname && blurb(b, 400) ? `<p class="bp-sum">${esc(blurb(b, 400))}</p>` : ''}` : '';
  const foot = open ? `<a class="bp-open" href="${esc(open[0])}"${open[2] ? ` ${open[2]}` : ''}><span>${esc(open[1])}</span>${icon('arrow-right')}</a>` : '';
  return `${top}${name}${due ? `<p class="bp-due">${due}</p>` : ''}${hear}${step ? `<div class="bp-step">${step}</div>` : ''}${rest}${foot}`;
}

// The one hearing line: "HHS hearing today 1:10 PM · Room 225", then who is going and the I'm going toggle (ui.js goingBtn).
// `from` is the screen the hearing page's Back returns to.
export function bpHearing(h, { from = '', going = '', mine = false, isNew = false } = {}) {
  if (!h) return '';
  return `<div class="bp-hear"><a class="bp-hl" href="#/hearing/${esc(h.id)}${from ? `?from=${esc(from)}` : ''}">${icon('landmark')}<span><b>${esc(h.committee)} ${isNew ? 'new hearing' : 'hearing'}</b> ${esc(hearingWhen(h))}</span>${icon('chevron-right', { cls: 'chev' })}</a>
    <p class="bp-go">${icon('users')}<span>${esc(going || 'Nobody going yet')}</span>${goingBtn(mine, { 'data-going': h.id })}</p></div>`;
}

// The facts under the step: the stage ribbon and the list of terms (look.js), folded unless `open`.
export const bpFacts = (html, { open = false } = {}) => html ? `<details class="bp-sec bp-facts"${open ? ' open' : ''}><summary class="bp-h3">${icon('chevron-right', { cls: 'chev' })}About this bill</summary>${html}</details>` : '';

export const bpOpen = b => [billRoute(b), 'Open the bill', `data-bill="${esc(b.id)}"`];
