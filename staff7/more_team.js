// Staff7 "A teammate's Home" (R-398 piece 11, look only): #/more/team picks a person, #/more/team/<initials> shows their Home as they see it.
// It draws Home's own parts (home.js: withMe, homeModel, listsHTML, overviewParts) for that person, read-only, then turns every link and button in them into plain text:
// nothing here can be opened or done from the viewer's side, and no step page is ever opened from here. Nothing is written.
import { S } from '../staff6/data.js';
import { withMe, homeModel, listsHTML, overviewParts } from './home.js';
import { stepsFor, first } from './steps.js';
import { plainBand, personMark, esc } from './parts.js';
import { ic } from './icons7.js';

const enc = encodeURIComponent;
const key = a => a.initials || a.id;
// everyone on the team but the viewer, by first name
export const teammates = me => (S.advocates || []).filter(a => a.is_active !== false && a.id !== me?.id).sort((x, y) => first(x).localeCompare(first(y)) || String(x.full_name).localeCompare(String(y.full_name)));
export const findMate = (me, id) => teammates(me).find(a => String(a.initials || '').toUpperCase() === String(id).toUpperCase() || String(a.id) === String(id)) || null;
const stepCount = p => stepsFor(p).length;

export function pickerPage(me) {
  const rows = teammates(me).map(a => { const n = stepCount(a);
    return `<li><a class="tmr" href="#/more/team/${enc(key(a))}">${personMark(a.initials)}<span class="tmn">${esc(first(a))}</span><span class="tms${n ? '' : ' none'}">${n ? `${n} ${n === 1 ? 'step' : 'steps'}` : 'Nothing waiting'}</span>${ic('chevron-right', 'tmgo')}</a></li>`; }).join('');
  return { html: `<div class="pn">${plainBand('A teammate’s Home', 'Pick a person to see their Home as they see it. You can look, and nothing you see can be changed.')}<div class="pbody mpage"><ul class="tmlist">${rows}</ul></div></div>`, bind: null };
}

// Every link and button becomes plain text (same classes, so the look stays; no href, id or control attributes; more.css gives it no pointer or hover),
// the Overview row and the Suggested group are dropped, and the To do heading says whose steps these are.
function lookOnly(html, who) {
  const t = document.createElement('template'); t.innerHTML = html;
  const c = t.content;
  c.querySelectorAll('.ovl, section[aria-labelledby="hg"], .fgo').forEach(e => e.remove());
  c.querySelectorAll('a, button').forEach(el => {
    const s = document.createElement('span'); s.className = el.className; s.innerHTML = el.innerHTML;
    if (el.hasAttribute('aria-current')) s.setAttribute('aria-current', el.getAttribute('aria-current'));
    el.replaceWith(s);
  });
  c.querySelectorAll('[aria-controls], [aria-expanded], [href]').forEach(e => { for (const a of ['aria-controls', 'aria-expanded', 'href']) e.removeAttribute(a); });
  const h = c.querySelector('#hs'); if (h) h.textContent = `${who}’s steps`;
  c.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
  const div = document.createElement('div'); div.appendChild(c); return div.innerHTML;
}

export function mateHomePage({ me, id, phone }) {
  const p = findMate(me, id);
  if (!p) return { html: `<div class="pn">${plainBand('No teammate by that name.', 'Pick one from the list.')}<div class="pbody mpage"><p class="lead"><a class="btn text" href="#/more/team">See the teammates</a></p></div></div>`, col: '', bind: null, label: 'A teammate’s Home', missing: true };
  const who = first(p), m = withMe(p, () => homeModel(p, stepsFor(p))), ov = withMe(p, () => overviewParts(m));
  const list = lookOnly(listsHTML(m, '#/more/none'), who);
  const bar = `<div class="lobar" role="note">${ic('eye')}<p><b>${esc(who)}’s Home, look only</b> <span aria-hidden="true">·</span> This is what ${esc(who)} sees. Nothing here can be done from your side.</p></div>`;
  const body = phone ? lookOnly(`<div class="ov">${ov.top}</div>`, who) + `<div class="lopanel lophone">${list}</div>` + lookOnly(`<div class="ov">${ov.rest}</div>`, who)   // a phone shows the list between the greeting and the facts, as Home does
    : lookOnly(`<div class="ov">${ov.top}${ov.rest}</div>`, who);
  const sheet = `<div class="pn lo" data-lookonly="${esc(key(p))}">${bar}${body}</div>`;
  return { html: sheet, col: phone ? '' : `<div class="lopanel lo">${list}</div>`, bind: null, label: `${who}’s Home`, p };
}
