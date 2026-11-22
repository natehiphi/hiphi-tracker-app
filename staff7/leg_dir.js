// The Directory (R-398 piece 12, part 1): the right side of #/more/legislators. Every member of the House and Senate in one aligned table that reads and scans: District, Name and
// party, Towns, Seats, Phone, Our bills (yours · team) and Our contact. Three views (By chamber, By committee, A to Z), section headings with counts that stay in view, and a
// whole row that opens the legislator. The same words as the left box narrow it (ids). On a phone the table becomes cards.
import { esc } from './parts.js';
import { directorySections, ourBills, contactName, towns, phoneHref, partyWord } from './leg_data.js';

export const DIR_VIEWS = [['chamber', 'By chamber'], ['committee', 'By committee'], ['az', 'A to Z']];
export const dirHref = id => `#/more/legislators/${encodeURIComponent(id)}`;

function rowHTML(r, me, cache) {
  const l = r.l, ob = cache.get(l.id) || (cache.set(l.id, ourBills(l, me)), cache.get(l.id)), contact = contactName(l, me), t = towns(l);
  const bills = `<span class="${ob.yours ? 'lgd-y' : 'lgd-mut'}">${ob.yours}</span> · ${ob.team}<span class="lgd-bw"> bills</span>`;
  const none = l2 => `<span class="lgd-mut" aria-label="${l2}">\u2013</span>`;
  const call = l.phone ? `<a class="lk" href="${esc(phoneHref(l))}">${esc(l.phone)}</a>`
    : `<span class="lgd-mut lgd-nl">Office line not listed</span>${l.email ? ` <a class="lk lgd-em" href="mailto:${esc(l.email)}" title="${esc(l.email)}">Email</a>` : ''}`;
  return `<tr class="lgd-row" data-href="${dirHref(l.id)}" data-id="${l.id}"><td class="lgd-d" data-l="District">${l.district}</td>`
    + `<th scope="row" class="lgd-n" data-l="Name"><a class="lgd-a" href="${dirHref(l.id)}">${esc(l.name)}</a> <span class="lgd-p" title="${esc(partyWord(l))}">${esc(l.party)}</span></th>`
    + `<td class="lgd-t" data-l="Towns" title="${esc(t)}">${esc(t)}</td><td class="lgd-s" data-l="Seats">${r.seats ? esc(r.seats) : none('No seat')}</td>`
    + `<td class="lgd-ph" data-l="Phone">${call}</td><td class="lgd-b" data-l="Our bills" title="Yours, then the team's">${bills}</td>`
    + `<td class="lgd-c" data-l="Our contact">${contact ? esc(contact) : none('No contact yet')}</td></tr>`;
}
// the table body only (the views and the find redraw this part without losing the box's focus)
export function directoryBody({ me, view, ids }) {
  const secs = directorySections(view, ids), cache = new Map();
  if (!secs.length) return '<p class="hint lgd-none">No one matches. Try a name, a district number, a town or a committee.</p>';
  return `<table class="lgd-tab"><thead><tr><th scope="col">District</th><th scope="col">Name</th><th scope="col">Towns</th><th scope="col">Seats</th><th scope="col">Phone</th><th scope="col">Yours · team</th><th scope="col">Our contact</th></tr></thead>`
    + secs.map(s => `<tbody id="lgd-${esc(s.key)}"><tr class="lgd-sec"><th colspan="7" scope="colgroup"><h2>${esc(s.title)} <span class="cmcount">· ${s.count}</span></h2></th></tr>${s.rows.map(r => rowHTML(r, me, cache)).join('')}</tbody>`).join('') + '</table>';
}
export function directoryHTML({ me, view, ids, total }) {
  const sw = `<div class="lgd-sw" role="group" aria-label="How to read the directory">${DIR_VIEWS.map(([k, t]) => `<button class="seg" type="button" data-dview="${k}" aria-pressed="${k === view}"${k === view ? ' aria-current="true"' : ''}>${t}</button>`).join('')}</div>`;
  return `<div class="pn lgdir" data-sheet="directory"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">Legislators</h1><p class="bsub">Every member of the House and Senate, and how to reach them.</p></div></div>`
    + `<div class="pbody mpage lgd-body"><div class="lgd-bar">${sw}<span class="lgd-n0" id="lgdCount" aria-live="polite">${ids ? `${ids.size} of ${total}` : `${total} members`}</span></div><div id="lgdBody">${directoryBody({ me, view, ids })}</div></div></div>`;
}
// a click anywhere on a row opens the legislator (a link or phone number inside it keeps its own job)
export function bindDirectory(root = document) {
  root.querySelector('#lgdBody')?.addEventListener('click', e => { if (e.target.closest('a')) return; const r = e.target.closest('tr.lgd-row'); if (r) location.hash = r.dataset.href; });
}
