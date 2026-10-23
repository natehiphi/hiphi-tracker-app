// R-277 fix 17 (U-1): one open-bill panel for Today and Bills. Staff v6 (R-336, V07, V17, V22): rebuilt on the one step card.
// openItem(b, ...) is the open item beside Today's list and Bills (and the item's own page below 1100px): the bill's number
// small, its name as the heading and its plain summary, then steps.js stepCard (the step in plain words, its buttons when
// it is the viewer's, the Write -> Approve -> File track, the hearing with who is going and I'm going), then two labelled
// doors: About this bill (the facts, codes small beside their words, each tap-to-explain) and Open the bill. v5's panel
// repeated the row it came from (assessment X16: 10 repeated texts between row and panel); this one adds only what the row
// did not say. Its buttons need no wiring (steps.js delegates them), so the same item works wherever it is drawn.
// The v5 parts below (billPane, bpHearing, bpFacts, bpOpen) stay for today.js and bills.js until those screens switch.
import { S, esc } from './data.js';
import { icon, iconBtn, goingBtn } from './ui.js';
import { billNum, blurb, hearingWhen, billRoute, stopOf, hearingAhead, diedish, deadlineName, legislativeDay } from './model.js';
import { TERMS_TAP, termBtn } from './terms.js';   // R-316 W40: the codes still shown tap open what they mean
import { stepCard, committeeName, versionWords, deadlineWords, numWords, nameWords } from './steps.js';

// ---- v6: the open item ----
// openItem(b, { viewer, where, close, headId, about, primary, from }) -> HTML.
//   close: the close X (closeBtn(attrs)), or '' where Back closes it (the item's own page).
//   about: the facts HTML for About this bill (look.js lookFacts on Bills), else aboutBill(b).
//   primary: false when another filled button owns the screen (spec section 4).
export function openItem(b, { viewer, where = 'pane', close = '', headId = 'v6-item-h', about = null, primary = true } = {}) {
  if (!b) return '';
  const sum = b.nickname ? blurb(b, 400) : '';
  const facts = about ?? aboutBill(b);
  return `<div class="v6-item" data-v6item="${esc(b.id)}">
    <div class="v6-item-top"><p class="v6-item-num">${esc(numWords(b))}</p>${close}</div>
    <h2 class="v6-item-name" id="${esc(headId)}" tabindex="-1">${esc(nameWords(b, 160))}</h2>
    ${sum ? `<p class="v6-item-sum">${esc(sum)}</p>` : ''}
    ${stepCard(b, { viewer, where, primary })}
    <div class="v6-item-doors">
      ${facts ? `<details class="v6-item-det"${S.v6About?.[b.id] ? ' open' : ''} data-v6about="${esc(b.id)}"><summary class="v6-item-door">${icon('info')}<span>About this bill</span>${icon('chevron-down')}</summary><div class="v6-item-about">${facts}</div></details>` : ''}
      <a class="v6-item-door" href="${esc(billRoute(b))}" data-bill="${esc(b.id)}">${icon('scroll-text')}<span>Open the bill</span>${icon('arrow-right')}</a>
    </div>
  </div>`;
}
export const closeBtn = (attrs = {}) => iconBtn('x', 'Close', attrs, 'v6-item-close');
// Whether About is open is kept per bill for the visit, so a redraw after a step does not fold it again.
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('toggle', e => {
  const d = e.target; if (!d?.dataset?.v6about) return; (S.v6About ??= {})[d.dataset.v6about] = d.open;
}, true);

// The facts in plain words, each Capitol code small beside the words it stands for and tap-to-explain (spec section 5:
// codes appear only where the Capitol itself uses them, About and the filing card): where it stands, its committees in
// order, its version, the deadline it is racing, the hearing ahead.
export function aboutBill(b) {
  if (!b) return '';
  const st = stopOf(b), h = hearingAhead(b), rows = [];
  const code = (text, key) => TERMS_TAP() ? ` <span class="v6-code">(${termBtn(text, key)})</span>` : ` <span class="v6-code">(${esc(text)})</span>`;
  if (st.says) rows.push(['Where it stands', esc(String(st.says).replace(/\.$/, ''))]);
  const refs = (b.referrals || []).map(r => String(r)).filter(Boolean);
  if (refs.length) rows.push(['Committees', refs.map(r => `${esc(committeeName(r))}${code(r, 'cmte:' + r)}`).join(', then ')]);
  rows.push(['Version', `${esc(versionWords(b.current_version))}${b.current_version ? code(b.current_version, 'ver:' + b.current_version) : ''}`]);
  if (!diedish(b) && st.deadline && !st.deadline.missed) { const nm = deadlineName(st.deadline);
    rows.push(['Deadline', `${esc(deadlineWords(st.deadline.label, st.deadline.date).replace(/^must/, 'It must'))}${nm ? code(nm, 'gate:' + nm) : ''}`]); }
  if (h) rows.push(['Hearing', `${esc(committeeName(h.committee))} · ${esc(hearingWhen(h))}`]);
  const ld = legislativeDay(); if (ld) rows.push(['Session', TERMS_TAP() ? termBtn(ld.text, 'word:Legislative day') : esc(ld.text)]);
  return `<dl class="v6-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

// ---- v5's panel parts (today.js and bills.js still draw these until they switch to openItem) ----
// `b` the bill (or null for an item that is not about one: `kind` is then its icon and word for the top line).
export function billPane({ b = null, kind = '', p1 = '', headId, more = '', close = '', due = '', hear = '', step = '', rest = '', open = null }) {
  // W40: with the gate on the version (HD1, SD2) follows the number as a term that opens what it means.
  const num = b && TERMS_TAP() && b.current_version ? `<span class="bn-num">${esc(billNum({ ...b, current_version: null }))}</span> ${termBtn(b.current_version, 'ver:' + b.current_version)}` : b ? `<span class="bn-num">${esc(billNum(b))}</span>` : '';
  const top = `<div class="bp-top"><p class="bp-num">${b ? `${num}${p1}` : kind}</p>${more}${close}</div>`;
  const name = b ? `<h2 class="bp-name" id="${esc(headId)}">${esc(b.nickname || blurb(b, 120))}</h2>${b.nickname && blurb(b, 400) ? `<p class="bp-sum">${esc(blurb(b, 400))}</p>` : ''}` : '';
  const foot = open ? `<a class="bp-open" href="${esc(open[0])}"${open[2] ? ` ${open[2]}` : ''}><span>${esc(open[1])}</span>${icon('arrow-right')}</a>` : '';
  return `${top}${name}${due ? `<p class="bp-due">${due}</p>` : ''}${hear}${step ? `<div class="bp-step">${step}</div>` : ''}${rest}${foot}`;
}

// The one hearing line: "HHS hearing today 1:10 PM · Room 225", then who is going and the I'm going toggle (ui.js goingBtn).
// `from` is the screen the hearing page's Back returns to.
export function bpHearing(h, { from = '', going = '', mine = false, isNew = false } = {}) {
  if (!h) return '';
  // R-316 W24 (G1-1): a sitting cancelled with no new one yet says so, with no day, time, room or I'm going: there is
  // nothing to go to until a new notice lists the bill. It still opens the hearing's page.
  if (h.status === 'cancelled') return `<div class="bp-hear"><a class="bp-hl" href="#/hearing/${esc(h.id)}${from ? `?from=${esc(from)}` : ''}">${icon('landmark')}<span><b>${esc(h.committee)} hearing cancelled</b>, no new date yet${TERMS_TAP() && cmteWords(h.committee) ? `<span class="bp-cn">${esc(cmteWords(h.committee))}</span>` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</a></div>`;
  return `<div class="bp-hear"><a class="bp-hl" href="#/hearing/${esc(h.id)}${from ? `?from=${esc(from)}` : ''}">${icon('landmark')}<span><b>${esc(h.committee)} ${isNew ? 'new hearing' : 'hearing'}</b> ${esc(hearingWhen(h))}${TERMS_TAP() && cmteWords(h.committee) ? `<span class="bp-cn">${esc(cmteWords(h.committee))}</span>` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</a>
    <p class="bp-go">${icon('users')}<span>${esc(going || 'Nobody going yet')}</span>${goingBtn(mine, { 'data-going': h.id })}</p></div>`;
}

// W40 (L-6): the committee in words. v6: the one name for it, steps.js committeeName ("Senate Health and Human Services,
// and Commerce"), so the panel, the rows and the hearing card say the same.
export const cmteWords = code => committeeName(code);

// The facts under the step: the stage ribbon and the list of terms (look.js), folded unless `open`.
export const bpFacts = (html, { open = false } = {}) => html ? `<details class="bp-sec bp-facts"${open ? ' open' : ''}><summary class="bp-h3">${icon('chevron-right', { cls: 'chev' })}About this bill</summary>${html}</details>` : '';

export const bpOpen = b => [billRoute(b), 'Open the bill', `data-bill="${esc(b.id)}"`];
