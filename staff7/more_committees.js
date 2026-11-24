// Staff7 "Committees" (R-398 piece 11): #/more/committees. Every House and Senate committee from S.committees, House first, then Senate, each in one grid
// so the columns line up. A whole row is a link to the committee's own Search page (#/search/committee/<code>). Read-only.
import { S } from '../staff6/data.js';
import { plainBand, esc } from './parts.js';
import { ic } from './icons7.js';

const enc = encodeURIComponent;
const plain = n => String(n || '').replace(/\s*&\s*/g, ' and ');   // "and", never "&"
export function committeeGroups() {
  const all = Object.values(S.committees || {}).filter(c => c && c.code);
  const of = ch => all.filter(c => c.chamber === ch).sort((a, b) => plain(a.name).localeCompare(plain(b.name)) || String(a.code).localeCompare(String(b.code)));
  return [['House', of('H')], ['Senate', of('S')]].filter(([, l]) => l.length);
}
const row = c => `<li><a class="mc-r" href="#/search/committee/${enc(c.code)}"><span class="mc-n"><b>${esc(plain(c.name))}</b> <span class="mc-c">${esc(c.code)}</span></span><span class="mc-ch">${esc(c.chair || 'Not listed')}</span>${ic('chevron-right', 'mc-go')}</a></li>`;

export function committeesPage() {
  const groups = committeeGroups();
  const body = groups.map(([name, list], k) => `<section class="mc-g" aria-labelledby="cmh${k}"><h2 class="mc-h" id="cmh${k}">${name} <span class="mc-count">· ${list.length}</span></h2>`
    + `<div class="mc-head" aria-hidden="true"><span>Committee</span><span>Chair</span></div><ul class="mc-list">${list.map(row).join('')}</ul></section>`).join('');
  return { html: `<div class="pn">${plainBand('Committees', 'Every House and Senate committee. Open one to see its bills and hearings.')}<div class="pbody mpage">${body || '<p class="lead">No committees are loaded yet.</p>'}</div></div>`, bind: null };
}
