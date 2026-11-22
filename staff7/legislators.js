// Legislators in More (R-398 piece 12, part 1): the LEFT PANEL (the list column), and the model the frame draws for #/more/legislators (the Directory on the right) and
// #/more/legislators/<id> (one legislator's page; part 3 draws it, this file draws only its strip until then). The words the left box understands are in leg_data.js findLegs().
//   legislatorsModel({ me, rt, phone }) -> { col, sheet, bind, label, picked, listOnly, back, backLabel }     (more.js calls it for every #/more/legislators address)
//   legislatorSheet(id, ctx)            -> the page's HTML for one legislator (id may be a number or a string); part 3 replaces its body
//   listColHTML({ me, picked, phone })  -> the column;  rowHTML(l, o)  -> one list row
// On a phone the list is a page of its own; its "Directory" row opens #/more/legislators/directory (the same Directory as a page with Back to Legislators).
import { ic } from './icons7.js';
import { esc, plainBand } from './parts.js';
import { allLegs, legOf, listGroups, findLegs, roleLine, towns, metaLine, holds, seatsOf, seatText, cname, yoursIds } from './leg_data.js';
import { directoryHTML, directoryBody, bindDirectory, dirHref } from './leg_dir.js';

try { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./leg.css', import.meta.url).href; document.head.appendChild(l); } catch { /* the page still works unstyled */ }

// what the person has typed and chosen, kept for the tab (not saved anywhere)
const U = { q: '', group: 'name', view: 'chamber' };
const LIST = '#/more/legislators';
const photo = (l, n = 32) => l.photo_url ? `<img src="${esc(l.photo_url)}" alt="" width="${n}" height="${n}" loading="lazy">` : `<span class="lgph0" style="width:${n}px;height:${n}px" aria-hidden="true">${esc(String(l.name).split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>`;

export function rowHTML(l, { picked, sub } = {}) {
  const on = String(picked) === String(l.id), s = sub != null ? sub : [`District ${l.district}`, roleLine(l)].filter(Boolean).join(' · ');
  return `<a class="lgr${on ? ' sel' : ''}" href="${dirHref(l.id)}" data-id="${l.id}"${on ? ' aria-current="true"' : ''}>${photo(l)}<span class="lgt"><span class="lgn"><b>${esc(l.name)}</b> <span class="lgp">${esc(l.party)}</span></span><span class="lgs">${esc(s)}</span></span></a>`;
}
const groupHTML = (g, o) => `<section class="lgg" id="lgg-${esc(g.key)}"><h3 class="lggh">${esc(g.title)} <span class="cmcount">· ${g.items.length}</span></h3>${g.items.map(i => rowHTML(i.l || i, { ...o, sub: i.note ? `District ${(i.l || i).district} · ${i.note}` : undefined })).join('')}</section>`;

// the groups under the box: a find shows why each person matched, otherwise Yours, House, Senate (or by committee)
function bodyHTML(me, picked) {
  const f = findLegs(U.q);
  if (f.q) return f.total ? f.groups.map(g => groupHTML(g, { picked })).join('') : `<p class="hint lgnone">No legislator matches “${esc(U.q.trim())}”. Try a name, a district number, a town or a committee.</p>`;
  return listGroups(me, U.group).filter(g => g.items.length || g.key === 'yours' && false).map(g => groupHTML(g, { picked })).join('');
}
function ctlHTML(me) {
  const f = findLegs(U.q), total = allLegs().length;
  if (f.q) return `<p class="lgjump">${f.total} found · <button class="btn text" type="button" id="legClear">Clear</button></p>`;
  const g = listGroups(me, U.group), jump = U.group === 'name' ? ` · Jump to ${g.filter(x => x.items.length).map(x => `<button class="lk lgjb" type="button" data-jump="lgg-${x.key}">${esc(x.title)}</button>`).join(' · ')}` : '';
  return `<p class="lgjump">${total}${jump}</p><div class="lgby"><span>Group by</span><button type="button" class="lgbt" data-group="name" aria-pressed="${U.group === 'name'}">Name</button><button type="button" class="lgbt" data-group="committee" aria-pressed="${U.group === 'committee'}">Committee</button></div>`;
}
export function listColHTML({ me, picked, phone, dirOn }) {
  const total = allLegs().length, dirHrefNow = phone ? LIST + '/directory' : LIST;
  return `<div class="lgcol"><div class="lgstick" id="lgStick"><header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">Legislators</h2></div>`
    + `<div class="findw" id="legW"><div class="findb">${ic('search')}<input id="legIn" type="text" aria-label="Find a legislator" placeholder="Find a legislator" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(U.q)}"></div><div class="vh" id="legLive" role="status" aria-live="polite"></div></div></header>`
    + `<a class="lgdirrow${dirOn ? ' sel' : ''}" id="lgDirRow" href="${dirHrefNow}"${dirOn ? ' aria-current="true"' : ''}><span class="lgdi">${ic('list')}</span><span class="lgt"><span class="lgn"><b>Directory</b></span><span class="lgs">All ${total}, organised</span></span></a>`
    + `<div id="legCtl">${ctlHTML(me)}</div></div><div id="legList" class="lglist">${bodyHTML(me, picked)}</div></div>`;
}

// ---- one legislator's page: the strip only, until part 3 draws the rest (photo, name, chamber · party · district and towns, seats) ----
export function legislatorSheet(id, ctx = {}) {
  const l = legOf(id);
  if (!l) return `<div class="pn" data-notfound="1">${plainBand('That legislator is not here.', 'Pick one from the list.')}<div class="pbody mpage"></div></div>`;
  const h = holds(l.id), mem = seatsOf(l.id).filter(s => s.role === 'member'), seatTxt = h.map(s => seatText(s)).join(' · ') + (mem.length ? `${h.length ? ' · ' : ''}Member: ${mem.map(s => esc(cname(s.committee))).join('; ')}` : '');
  const strip = `<div class="hband neutral lgstrip"><div class="lgin">${l.photo_url ? `<img class="lgph" src="${esc(l.photo_url)}" alt="" width="64" height="64">` : ''}<div class="ht"><h1 tabindex="-1">${esc(l.name)}</h1><p class="bsub">${esc(metaLine(l))}</p>${seatTxt ? `<p class="lgseat">${h.length ? esc(h.map(s => seatText(s)).join(' · ')) : ''}${mem.length ? `${h.length ? ' · ' : ''}Member: ${esc(mem.map(s => cname(s.committee)).join('; '))}` : ''}</p>` : ''}</div></div></div>`;
  return `<div class="pn" data-sheet="legislator" data-leg="${l.id}">${strip}<div class="pbody mpage lgpage" id="lgPageBody"></div></div>`;
}

// ---- the model the frame draws ----
// sub: '' (the Directory), 'directory' (the Directory as a page, phone), or a legislator id
export function legislatorsModel({ me, rt, phone }) {
  const sub = String(rt.id || '').replace(/^legislators\/?/, '').replace(/\/+$/, ''), isDir = !sub || sub === 'directory', l = isDir ? null : legOf(decodeURIComponent(sub));
  const picked = l ? l.id : null, ctx = { me, phone };
  const col = listColHTML({ me, picked, phone, dirOn: isDir && (!phone || sub === 'directory') });
  const dir = () => directoryHTML({ me, view: U.view, ids: findLegs(U.q).ids, total: allLegs().length });
  const bind = () => bindList(me, phone, !!l);
  if (isDir) return phone && !sub ? { col, sheet: dir(), bind, label: 'Legislators', listOnly: true }
    : { col, sheet: dir(), bind, label: 'Legislators', picked: phone, back: LIST, backLabel: 'Legislators' };
  return { col, sheet: legislatorSheet(sub, ctx), bind, label: l ? l.name : 'Not found', picked: true, back: LIST, backLabel: 'Legislators', notFound: !l };
}

function bindList(me, phone, onPage) {
  const $ = id => document.getElementById(id), box = $('legIn');
  if (!box) return;
  const total = allLegs().length;
  const refresh = () => {
    const f = findLegs(U.q), pick = document.querySelector('#legList .lgr.sel')?.dataset.id || document.querySelector('[data-leg]')?.dataset.leg || null;
    $('legList').innerHTML = bodyHTML(me, pick); $('legCtl').innerHTML = ctlHTML(me); wireCtl();
    const body = $('lgdBody'); if (body) { body.innerHTML = directoryBody({ me, view: U.view, ids: f.ids }); const c = $('lgdCount'); if (c) c.textContent = f.ids ? `${f.ids.size} of ${total}` : `${total} members`; }
    $('legLive').textContent = f.q ? `${f.total} found` : '';
    sticky();
  };
  const sticky = () => { const s = $('lgStick'); if (s) document.documentElement.style.setProperty('--lgs', s.getBoundingClientRect().height + 'px'); };
  const wireCtl = () => {
    document.querySelectorAll('#legCtl [data-group]').forEach(b => b.addEventListener('click', () => { U.group = b.dataset.group; refresh(); }));
    document.querySelectorAll('#legCtl [data-jump]').forEach(b => b.addEventListener('click', () => { const t = document.getElementById(b.dataset.jump), w = $('wl'); if (t && w) w.scrollTo({ top: t.offsetTop - (document.getElementById('lgStick')?.offsetHeight || 0) + 1, behavior: 'smooth' }); }));
    $('legClear')?.addEventListener('click', () => { U.q = ''; box.value = ''; refresh(); box.focus(); });
  };
  box.addEventListener('input', () => { U.q = box.value; refresh(); });
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && U.q) { e.preventDefault(); e.stopPropagation(); U.q = ''; box.value = ''; refresh(); } });
  document.querySelectorAll('[data-dview]').forEach(b => b.addEventListener('click', () => { U.view = b.dataset.dview; document.querySelectorAll('[data-dview]').forEach(x => { const on = x === b; x.setAttribute('aria-pressed', on); on ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current'); }); refresh(); }));
  wireCtl(); bindDirectory(); sticky();
  const sel = document.querySelector('#legList .lgr.sel'); if (sel && $('wl') && !phone) { const w = $('wl'), top = sel.offsetTop - ($('lgStick')?.offsetHeight || 0) - 40; if (sel.offsetTop < w.scrollTop + 120 || sel.offsetTop > w.scrollTop + w.clientHeight - 80) w.scrollTop = Math.max(0, top); }   // the picked row is on the screen
  void onPage; void yoursIds;
}
