// Staff7 "Capitol words" (R-398 piece 11): #/more/words. What the Capitol's words mean, in plain language, with a box that narrows the list as you type.
// Each entry is headed with the app's own name where it has one (words.js) and the Capitol's word after it in muted text. Read-only; nothing here writes anything.
import { plainBand } from './parts.js';
import { esc } from './parts.js';
import { ic } from './icons7.js';
import { WORDS } from './words.js';
import { CAPITOL_WORDS } from './capitol_words.js';

// the Capitol's word -> the name this app uses for the same event (words.js is the one table of those names)
const APP = { 'Three-committee deadline': WORDS.first_triple.name, Lateral: WORDS.first_lateral.name, Decking: WORDS.first_decking.name, Crossover: WORDS.first_crossover.name, 'Cross back': WORDS.second_crossover.name, Conference: WORDS.conference.name, 'Sine die': WORDS.governor.name };
export const ENTRIES = CAPITOL_WORDS.map(([cap, says]) => ({ app: APP[cap] || '', cap, says }));
const norm = s => String(s).toLowerCase();
// the entries a typed phrase leaves: it must be in the app's name, the Capitol's word or the meaning
export const matches = q => { const t = norm(q).trim(); return t ? ENTRIES.filter(e => [e.app, e.cap, e.says].some(x => norm(x).includes(t))) : ENTRIES; };
// the text with each match wrapped in <mark>, everything else escaped
const lit = (s, q) => { const t = norm(q).trim(); if (!t) return esc(s); let out = '', i = 0, low = norm(s); for (;;) { const k = low.indexOf(t, i); if (k < 0) break; out += esc(s.slice(i, k)) + `<mark>${esc(s.slice(k, k + t.length))}</mark>`; i = k + t.length; } return out + esc(s.slice(i)); };
const entry = (e, q) => `<li class="cw"><h2 class="cwh">${e.app ? `${lit(e.app, q)} <span class="cwcap">(Capitol: ${lit(e.cap, q)})</span>` : lit(e.cap, q)}</h2><p>${lit(e.says, q)}</p></li>`;
const count = (n, q) => `${n} of ${ENTRIES.length} words`;

export function wordsPage() {
  const html = `<div class="pn">${plainBand('Capitol words', 'What the Capitol’s words mean, in plain language.')}<div class="pbody mpage"><div class="cwfind"><label class="cwl" for="cwIn">Find a word</label>`
    + `<div class="cwbox">${ic('search')}<input id="cwIn" type="search" autocomplete="off" spellcheck="false" aria-describedby="cwCount"></div></div>`
    + `<p class="cwcount" id="cwCount" role="status">${count(ENTRIES.length)}</p><ul class="cwlist" id="cwList">${ENTRIES.map(e => entry(e, '')).join('')}</ul>`
    + `<p class="cwnone" id="cwNone" hidden>No word matches that. Try a shorter piece of it.</p></div></div>`;
  const bind = () => {
    const inp = document.getElementById('cwIn'); if (!inp) return;
    const draw = () => { const q = inp.value, hit = matches(q); document.getElementById('cwList').innerHTML = hit.map(e => entry(e, q)).join(''); document.getElementById('cwCount').textContent = count(hit.length); document.getElementById('cwNone').hidden = hit.length > 0; };
    inp.addEventListener('input', draw);
  };
  return { html, bind };
}
