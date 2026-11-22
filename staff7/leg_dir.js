// The Directory (R-398 piece 13): the right side of #/more/legislators, warm and friendly. On top, "Who your bills are with now" (the viewer's own legislators, in a soft panel), then
// everyone as photo cards: By chamber, By island, By committee or A to Z, with section headings that stay in view. A whole card opens the person; Call or Email keep their own job.
// The same words as the left box narrow it (ids). On a phone the cards are one across and a find box sits above the block (the left list is a page of its own there).
import { esc } from './parts.js';
import { ic } from './icons7.js';
import { directorySections, ourBills, towns, phoneHref, partyWord, yoursIds, yoursSource, chairLine, roleLine, seatsOf, allLegs, plain, normQ } from './leg_data.js';

export const DIR_VIEWS = [['chamber', 'By chamber'], ['island', 'By island'], ['committee', 'By committee'], ['az', 'A to Z']];
export const dirHref = id => `#/more/legislators/${encodeURIComponent(id)}`;
const NB = ' ';
const initials = l => String(l.name).split(' ').map(w => w[0]).slice(0, 2).join('');

// the Capitol photo, or initials on a tint circle when there is none (a photo that fails is swapped for the same by bindDirectory)
const photo = (l, cls, n) => l.photo_url
  ? `<img class="lgd-ph ${cls}" src="${esc(l.photo_url)}" alt="" width="${n}" height="${n}" data-ini="${esc(initials(l))}">`
  : `<span class="lgd-ph lgd-ph0 ${cls}" aria-hidden="true">${esc(initials(l))}</span>`;
// "Call 808-586-6680", or "Email" with no phone, or nothing when the data has neither (never a dash, never "not listed")
const reach = l => l.phone ? `<a class="lgd-reach" href="${esc(phoneHref(l))}" aria-label="Call ${esc(l.name)} at ${esc(l.phone)}">Call<span class="lgd-num"> ${esc(l.phone)}</span></a>`
  : l.email ? `<a class="lgd-reach" href="mailto:${esc(l.email)}" aria-label="Email ${esc(l.name)}">Email</a>` : '';
const party = l => `<span class="lgd-p" title="${esc(partyWord(l))}">${esc(l.party)}</span>`;
// the first three towns whole, then "and 4 more" (never an ellipsis, never cut mid-word); the data's own spelling
// while finding, a town that matches the words and would be hidden behind "and N more" comes first, so the card shows why it matched
const townsLine = (l, q = '') => {
  const t = (l.places || '').split(/,\s*/).map(x => plain(x.replace(/^and\s+/i, '')).trim()).filter(Boolean), w = normQ(q).replace(/^district\s*/, '');
  const hit = w && !/^\d+$/.test(w) ? t.findIndex(x => normQ(x).includes(w)) : -1;
  if (hit >= 3) t.unshift(...t.splice(hit, 1));
  return t.length > 3 ? `${t.slice(0, 3).join(', ')} and${NB}${t.length - 3}${NB}more` : t.join(', ');
};

// ---- the block on top ----
function blockCard(l, me, src, cache) {
  const ob = cache.get(l.id) || (cache.set(l.id, ourBills(l, me)), cache.get(l.id));
  const sent = src === 'chairs' ? chairLine(l, me) : (ob.yours > 0 ? `Has a say on ${ob.yours} of your bills.` : (roleLine(l) ? roleLine(l) + '.' : ''));
  return `<div class="lgd-bc" data-href="${dirHref(l.id)}">${photo(l, 'lgd-bph', 72)}<div class="lgd-bt"><p class="lgd-bn"><a href="${dirHref(l.id)}">${esc(l.name)}</a>${party(l)}</p>${sent ? `<p class="lgd-bs">${esc(sent)}</p>` : ''}</div><div class="lgd-bf">${reach(l)}</div></div>`;
}
export function directoryBlock({ me, ids }) {
  const src = yoursSource(me), mine = yoursIds(me);
  if (ids || !src || !mine.size) return '';   // while the find box holds words the cards below are the answer; no ids, no empty heading
  const cache = new Map(), ob = l => (cache.get(l.id) || (cache.set(l.id, ourBills(l, me)), cache.get(l.id))).yours;
  const legs = allLegs().filter(l => mine.has(l.id)).sort((a, b) => ob(b) - ob(a) || a.district - b.district);
  const head = src === 'chairs' ? 'Who your bills are with now' : 'People you keep in touch with';
  return `<section class="lgd-yours" aria-labelledby="lgdY"><h2 id="lgdY">${head}</h2>${src === 'chairs' ? '<p class="lgd-why">The chairs of the committees holding your bills.</p>' : ''}<div class="lgd-bcs">${legs.map(l => blockCard(l, me, src, cache)).join('')}</div></section>`;
}

// ---- the grid of everyone ----
function cardHTML(r, view, me, cache, q) {
  const l = r.l, ob = cache.get(l.id) || (cache.set(l.id, ourBills(l, me)), cache.get(l.id)), more = seatsOf(l.id).length - 1;
  const seat = view === 'committee' ? r.seats : (roleLine(l) ? roleLine(l) + (more > 0 ? ` and${NB}${more}${NB}more` : '') : '');
  const dist = (view === 'chamber' ? '' : (l.chamber === 'S' ? 'Senate ' : 'House ')) + `District ${l.district}`, t = townsLine(l, q);
  return `<article class="lgd-card" data-href="${dirHref(l.id)}" data-id="${l.id}">${photo(l, 'lgd-cph', 96)}<div class="lgd-tx"><h3 class="lgd-n"><a href="${dirHref(l.id)}">${esc(l.name)}</a>${party(l)}</h3>`
    + `<p class="lgd-d">${esc(dist)}${t ? ' · ' + esc(t) : ''}</p>${seat ? `<p class="lgd-s">${esc(seat)}</p>` : ''}${ob.yours > 0 ? `<p class="lgd-b">Has a say on ${ob.yours} of your bills</p>` : ''}</div>`
    + `<div class="lgd-ft">${reach(l)}</div></article>`;
}
// the sections only (the views and the find redraw this part without losing the box's focus)
export function directoryBody({ me, view, ids, q = '' }) {
  const secs = directorySections(view, ids), cache = new Map();
  if (!secs.length) return '<p class="hint lgd-none">No one matches. Try a name, a district number, a town or a committee.</p>';
  return secs.map(s => `<section class="lgd-sec" id="lgd-${esc(s.key)}"><h2 class="lgd-h">${esc(s.title)} <span class="cmcount">· ${s.count}</span></h2><div class="lgd-grid">${s.rows.map(r => cardHTML(r, view, me, cache, ids ? q : '')).join('')}</div></section>`).join('');
}
export const countText = (ids, total) => ids ? `${ids.size} of ${total}` : `${total} members`;
// one call for everything a find or a view changes: the block, the sections and the count
export function redrawDirectory({ me, view, ids, total, q = '' }) {
  const $ = id => document.getElementById(id);
  if ($('lgdBlock')) $('lgdBlock').innerHTML = directoryBlock({ me, ids });
  if ($('lgdBody')) $('lgdBody').innerHTML = directoryBody({ me, view, ids, q });
  if ($('lgdCount')) $('lgdCount').textContent = countText(ids, total);
}
export function directoryHTML({ me, view, ids, total, q = '' }) {
  const sw = `<div class="segs3 lgd-sw" role="group" aria-label="How to read the directory">${DIR_VIEWS.map(([k, t]) => `<button class="seg" type="button" data-dview="${k}" aria-pressed="${k === view}"${k === view ? ' aria-current="true"' : ''}>${t}</button>`).join('')}</div>`;
  const blockOn = !!(yoursSource(me) && yoursIds(me).size);
  // no number here: the data can list two people for one district, so "all 77" might not be true (the count chip counts the cards)
  const line = 'Everyone in the Senate and House, and the quickest way to reach each one.'; void blockOn;
  // the find box is only for a phone, where the left list is a page of its own; at laptop width the left panel's box does the job (leg.css hides this one there)
  const find = `<div class="findw lgd-find"><div class="findb">${ic('search')}<input id="lgdIn" type="text" aria-label="Find by name, district or town" placeholder="Find by name, district or town" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(q)}"></div></div>`;
  return `<div class="pn lgdir" data-sheet="directory"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">Legislators</h1><p class="bsub">${esc(line)}</p></div></div>`
    + `<div class="pbody mpage lgd-body">${find}<div id="lgdBlock">${directoryBlock({ me, ids })}</div><div class="lgd-bar">${sw}<span class="lgd-n0" id="lgdCount" aria-live="polite">${countText(ids, total)}</span></div><div id="lgdBody">${directoryBody({ me, view, ids, q })}</div></div></div>`;
}
// a click anywhere on a card opens the legislator (the name link, Call and Email keep their own job); a photo that fails shows initials
export function bindDirectory(root = document) {
  const pn = root.querySelector('.lgdir'); if (!pn) return;
  const swap = i => { const s = document.createElement('span'); s.className = i.className + ' lgd-ph0'; s.setAttribute('aria-hidden', 'true'); s.textContent = i.dataset.ini || ''; i.replaceWith(s); };
  pn.addEventListener('click', e => { if (e.target.closest('a')) return; const c = e.target.closest('.lgd-card, .lgd-bc'); if (c) location.hash = c.dataset.href; });
  pn.addEventListener('error', e => { if (e.target.matches?.('img.lgd-ph')) swap(e.target); }, true);
  pn.querySelectorAll('img.lgd-ph').forEach(i => { if (i.complete && !i.naturalWidth) swap(i); });
}
