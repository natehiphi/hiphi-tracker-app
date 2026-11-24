// Staff7 Help (R-398 piece 12): #/more/help, the six how-to guides, Where things are, and Capitol words (moved here from #/more/words).
// Read-only text; nothing here writes. more.js routes #/more/help and #/more/help/<x> to helpModel.
import { plainBand, esc } from './parts.js';
import { ic } from './icons7.js';
import { wordsPage } from './more_words.js';
import { GUIDES, ORDER, MORE_ROWS, WHERE } from './help_guides.js';

try { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./help.css', import.meta.url).href; document.head.appendChild(l); } catch { /* the page still works unstyled */ }

const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const ask = () => `<section class="hp-ask" aria-labelledby="hpAsk"><h2 class="hp-h" id="hpAsk">Who to ask</h2><p>Still stuck? Message Nate in Slack.</p></section>`;
const row = (href, title, line) => `<li><a class="hp-r" href="${href}"><span class="hp-rt"><b>${esc(title)}</b><span class="hp-rl">${esc(line)}</span></span>${ic('chevron-right', 'hp-go')}</a></li>`;
const wrap = (band, body) => `<div class="pn">${band}<div class="pbody mpage hp">${body}</div></div>`;

function home() {
  const how = ORDER.map(k => row(`#/more/help/${k}`, GUIDES[k].title, GUIDES[k].line)).join('');
  const more = MORE_ROWS.map(r => row(`#/more/help/${r.id}`, r.title, r.line)).join('');
  return wrap(plainBand('Help', 'How to do the main jobs, where things are, and what the Capitol’s words mean.'),
    `<section aria-labelledby="hpHow"><h2 class="hp-h" id="hpHow">How to</h2><ul class="hp-list">${how}${more}</ul></section>${ask()}`);
}
function guide(k) {
  const g = GUIDES[k];
  return wrap(plainBand(g.title, ''), `<p class="hp-need">${esc(g.need)}</p><ol class="hp-steps">${g.steps.map((s, i) => `<li><span class="hp-n" aria-hidden="true">${i + 1}</span><span class="hp-t">${bold(s)}</span></li>`).join('')}</ol>${ask()}`);
}
function where() {
  const list = rows => `<ul class="hp-defs">${rows.map(([n, t]) => `<li><b>${esc(n)}</b><span>${esc(t)}</span></li>`).join('')}</ul>`;
  return wrap(plainBand('Where things are', WHERE.line),
    `<section aria-labelledby="hpD"><h2 class="hp-h" id="hpD">Along the left side, or the bottom</h2>${list(WHERE.doors)}</section>`
    + `<section aria-labelledby="hpM"><h2 class="hp-h" id="hpM">Inside More</h2>${list(WHERE.more)}</section>`
    + `<section aria-labelledby="hpY"><h2 class="hp-h" id="hpY">Your initials</h2>${list(WHERE.you)}</section>${ask()}`);
}

export const helpName = id => id === 'words' ? 'Capitol words' : id === 'where' ? 'Where things are' : GUIDES[id] ? GUIDES[id].title : 'Help';
// the model the frame draws, like more.js's other pages
export function helpModel(id) {
  id = String(id || '').replace(/^\/+|\/+$/g, '');
  const base = { solo: true, col: '' }, toHelp = { back: '#/more/help', backLabel: 'Help' };
  if (!id) return { ...base, sheet: home(), bind: null, label: 'Help', back: '#/', backLabel: 'Home' };
  if (id === 'words') { const p = wordsPage(); return { ...base, ...toHelp, sheet: p.html, bind: p.bind, label: 'Capitol words' }; }
  if (id === 'where') return { ...base, ...toHelp, sheet: where(), bind: null, label: 'Where things are' };
  if (GUIDES[id]) return { ...base, ...toHelp, sheet: guide(id), bind: null, label: GUIDES[id].title };
  return { ...base, ...toHelp, sheet: wrap(plainBand('That guide is not here.', ''), `<p><a href="#/more/help">Back to Help</a></p>`), bind: null, label: 'Help' };
}
