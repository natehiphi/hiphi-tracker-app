// One list (#/list/:id, plan 3.8): a Publish switch, a Share menu, an Add bills search and the bills in their public
// order. The same calls and rules as the current app's open list card (app.js renderLists / wireLists): an empty list
// cannot be published, only public bills can be added, each bill can carry a public note, the order is rewritten as
// sort_order 100, 101, … and Archive asks first. Reorder: a 44px drag handle on desktop (arrow keys work on it too),
// Move up / Move down in each row's ⋯ everywhere.
import { S, DB, hooks, esc, advocate } from './data.js';
import { billNum, PUBLIC_APP, billById, plain } from './model.js';
import { icon, btn, iconBtn, switchRow, empty, toast, openSheet, closeSheet, menuSheet, confirmSheet } from './ui.js';
import { listById, listRows, listIcon, plural, afterClose, openListForm, updatedLine, clip } from './lists.js';
import * as SP from './supporters.js';

const publicLink = l => `${PUBLIC_APP()}#list=${l.slug}`;
function embedCode(l) {
  const u = new URL('embed.html', location.href); u.search = ''; u.hash = ''; u.searchParams.set('list', l.slug);
  return `<iframe id="hiphi-tracker" src="${u.href}" title="HIPHI bill list" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`;
}
const numOf = b => billNum(b);
const V = () => S.leList ??= { q: {}, focus: '' };

// Copy right away (the tap is what lets the browser write the clipboard); if the browser refuses, show the text in a
// sheet to copy by hand. Never window.prompt.
function copyText(text, okMsg, what) {
  const fallback = async () => {
    await afterClose();
    openSheet({ title: `Copy the ${what}`, size: 'auto', body: `<div class="le-sheet"><p class="small">Select it all and copy it.</p><textarea class="le-copybox" readonly rows="${what === 'link' ? 2 : 6}" aria-label="The ${what}">${esc(text)}</textarea></div>`,
      wire: d => { const ta = d.querySelector('textarea'); ta.focus(); ta.select(); } });
  };
  try { navigator.clipboard.writeText(text).then(() => toast(okMsg, { ok: true }), fallback); } catch { fallback(); }
}

// The order is saved the way the current app saves it: every row whose place changed gets sort_order 100 + index.
async function saveOrder(l, ids) {
  const rows = (S.listBills || []).filter(x => x.list_id === l.id);
  const byId = new Map(rows.map(r => [r.bill_id, r]));
  const ordered = [...ids.map(id => byId.get(id)).filter(Boolean), ...rows.filter(r => !ids.includes(r.bill_id))];
  for (let k = 0; k < ordered.length; k++) if (ordered[k].sort_order !== 100 + k) await DB.setListBill(l.id, ordered[k].bill_id, { sort_order: 100 + k });
}
async function moveTo(l, billId, to, { focusGrip = false } = {}) {
  const before = listRows(l).map(r => r.b.id), from = before.indexOf(billId);
  if (from < 0 || to < 0 || to >= before.length || to === from) return;
  const after = before.slice(); after.splice(from, 1); after.splice(to, 0, billId);
  const b = billById(billId);
  try {
    await saveOrder(l, after);
    if (focusGrip) V().focus = 'grip:' + billId;
    hooks.render();
    toast(`Moved ${b ? numOf(b) : 'the bill'} to ${to + 1} of ${after.length}.`, { undo: async () => { await saveOrder(l, before); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); hooks.render(); }
}

// ---- the add search: public bills that are not on the list yet ----
function hits(l, q) {
  const t = plain(q.trim()), tn = t.replace(/\s+/g, '');
  if (t.length < 2) return [];
  const on = new Set((S.listBills || []).filter(x => x.list_id === l.id).map(x => x.bill_id));
  const pool = S.bills.filter(b => b.is_public && b.tracked !== false && !on.has(b.id));
  const byNum = pool.filter(b => b.bill_number.toLowerCase().includes(tn)).sort((a, b) => a.bill_number.toLowerCase().startsWith(tn) === b.bill_number.toLowerCase().startsWith(tn) ? a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }) : a.bill_number.toLowerCase().startsWith(tn) ? -1 : 1);
  const byWords = pool.filter(b => !byNum.includes(b) && [b.title, b.public_summary, b.description].some(x => plain(x).includes(t)));
  return [...byNum, ...byWords].slice(0, 8);
}
function hitsHTML(l, q) {
  if (q.trim().length < 2) return '';
  const rows = hits(l, q);
  if (!rows.length) return `<p class="le-none">No public bill matches “${esc(q.trim())}”. Only public bills can go on a list; make a bill public on its Public tab first.</p>`;
  return `<div class="rows le-hits" role="list">${rows.map(b => `<button type="button" class="row le-hit" role="listitem" data-add="${esc(b.id)}" aria-label="Add ${esc(numOf(b))} to the list"><span class="le-plus">${icon('plus')}</span><span class="body"><span class="title"><b>${esc(numOf(b))}</b> <span class="le-t">${esc(clip(b, 90))}</span></span></span></button>`).join('')}</div>`;
}

function billRowHTML(l, x, b, i, n) {
  const num = numOf(b);
  return `<li class="le-brow" data-bid="${esc(b.id)}">
    <button type="button" class="le-grip" data-grip="${esc(b.id)}" aria-label="Move ${esc(num)}, now ${i + 1} of ${n}. Drag it, or press the up and down arrow keys." title="Drag to reorder">${icon('grip-vertical')}</button>
    <a class="le-bmain" href="#/bill/${encodeURIComponent(b.bill_number)}">
      <span class="title"><b>${esc(num)}</b> <span class="le-t">${esc(clip(b, 110))}</span></span>
      ${x.note ? `<span class="le-note">${icon('message-square')}<span>${esc(x.note)}</span></span>` : ''}
      ${b.is_public ? '' : `<span class="le-warn">${icon('eye-off')}Not public, so the public page leaves it out</span>`}
    </a>
    ${iconBtn('ellipsis', `More for ${num}`, { 'data-bmore': b.id, 'aria-haspopup': 'dialog' }, 'le-bmore')}
  </li>`;
}

function followersHTML(l) {
  const f = S.listFollowers?.[l.id] || 0;
  if (!f) return `<span class="le-fol">${icon('users')}<span>${l.is_published ? 'No followers yet' : 'No followers until it is live'}</span></span>`;
  return `<button type="button" class="le-fol le-folbtn" data-le="followers">${icon('users')}<span>${plural(f, 'follower')}</span><span class="le-see">See who</span></button>`;
}

function render(route) {
  const l = listById(route.id);
  if (!l) return `<div class="le-page le-list">${empty({ h: 'h1', title: 'This list is not here', text: 'It may have been archived, or the link is old.', action: btn('See all lists', { href: '#/outreach/lists' }) })}</div>`;
  const v = V(), rows = listRows(l), q = v.q[l.id] || '';
  const owner = l.owner_id ? advocate(l.owner_id)?.full_name : '';
  return `<div class="le-page le-list">
    <a class="le-deskback" href="#/outreach/lists" data-back>${icon('chevron-left')}<span>Lists</span></a>
    <header class="le-lhead">
      <span class="le-licon">${icon(listIcon(l.icon))}</span>
      <div class="le-lhbody">
        <h1>${esc(l.title)}</h1>
        ${l.description ? `<p class="le-ldesc">${esc(l.description)}</p>` : ''}
        <p class="meta">${owner ? `Curated by ${esc(owner)}` : 'Curated by HIPHI'} · ${esc(updatedLine(l))}</p>
      </div>
      ${iconBtn('ellipsis', `More for ${l.title}`, { 'data-le': 'more', 'aria-haspopup': 'dialog' }, 'le-hmore')}
    </header>
    <section class="card le-pubcard" aria-label="Publishing">
      ${switchRow('le-pub', 'Publish', l.is_published, l.is_published ? 'Live. Anyone with the link can find and follow it.' : 'Draft. Only the team can see it.', { 'aria-describedby': 'le-puberr' })}
      <div id="le-puberr" role="alert"></div>
      <div class="le-sharerow">${followersHTML(l)}${btn('Share', { kind: 'secondary', sm: true, icon: 'share-2', attrs: { 'data-le': 'share', 'aria-haspopup': 'dialog' } })}</div>
    </section>
    <section class="le-sec" aria-labelledby="le-bh">
      <div class="le-sechead"><h2 id="le-bh">Bills</h2><span class="meta">${rows.length ? plural(rows.length, 'bill') : ''}</span></div>
      <div class="le-add">
        <label class="sr" for="le-q">Add a bill by number or words</label>
        <div class="le-search">${icon('search')}<input id="le-q" type="search" placeholder="Add a bill: number or words" value="${esc(q)}" autocomplete="off" enterkeyhint="search" aria-describedby="le-qh" aria-controls="le-hits">${iconBtn('x', 'Clear the search', { 'data-le': 'qclear', hidden: !q })}</div>
        <p class="meta" id="le-qh">Only public bills can go on a list.</p>
        <div id="le-hits" aria-live="polite">${hitsHTML(l, q)}</div>
      </div>
      ${rows.length ? `<ol class="rows le-bills">${rows.map(({ x, b }, i) => billRowHTML(l, x, b, i, rows.length)).join('')}</ol>`
        : `<div class="le-empty">${empty({ h: 'h3', title: 'No bills yet', text: 'Search above to add public bills. On the Bills page you can also select several and choose Add to a list.' })}</div>`}
    </section>
  </div>`;
}

// ---- actions ----
function noteSheet(l, x, b) {
  const had = x.note || '';
  openSheet({ title: `Public note on ${esc(numOf(b))}`, size: 'auto',
    body: `<div class="le-sheet"><div class="field"><label for="le-note">Note</label><textarea id="le-note" rows="3" maxlength="160" aria-describedby="le-note-h">${esc(had)}</textarea><span class="help" id="le-note-h">The public sees it under the bill on this list. Say why it matters here. <span id="le-note-n">${had.length}</span> of 160.</span></div></div>`,
    foot: `${had ? btn('Remove note', { kind: 'text', attrs: { 'data-nrm': '1' } }) : ''}${btn('Save note', { icon: 'check', attrs: { 'data-nsave': '1' } })}`,
    wire: d => {
      const ta = d.querySelector('#le-note'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.oninput = () => { d.querySelector('#le-note-n').textContent = ta.value.length; };
      const save = async note => {
        try { await DB.setListBill(l.id, b.id, { note }); closeSheet({ silent: true }); hooks.render();
          toast(note ? 'Note saved.' : 'Note removed.', { ok: !!note, undo: had !== (note || '') ? async () => { await DB.setListBill(l.id, b.id, { note: had || null }); hooks.render(); } : undefined });
        } catch (e) { toast(e, { err: true }); }
      };
      d.querySelector('[data-nsave]').onclick = () => save(ta.value.trim() || null);
      d.querySelector('[data-nrm]')?.addEventListener('click', () => save(null));
    } });
}
async function removeBill(l, b) {
  const x = (S.listBills || []).find(r => r.list_id === l.id && r.bill_id === b.id); if (!x) return;
  const keep = { note: x.note || null, sort_order: x.sort_order };
  try {
    await DB.removeListBill(l.id, b.id); hooks.render();
    // Undo puts it back where it was, note included (the current app's Undo lost both).
    toast(`Removed ${numOf(b)} from the list.`, { undo: async () => { await DB.addListBills(l.id, [b.id]); await DB.setListBill(l.id, b.id, keep); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
function billMenu(l, billId) {
  const rows = listRows(l), i = rows.findIndex(r => r.b.id === billId); if (i < 0) return;
  const { x, b } = rows[i], num = numOf(b);
  menuSheet({ title: esc(num), items: [
    { label: 'Move up', icon: 'move-up', disabled: i === 0, reason: `${num} is already first.`, run: () => moveTo(l, b.id, i - 1) },
    { label: 'Move down', icon: 'move-down', disabled: i === rows.length - 1, reason: `${num} is already last.`, run: () => moveTo(l, b.id, i + 1) },
    { label: x.note ? 'Edit the public note' : 'Add a public note', icon: 'message-square', sub: x.note ? x.note : 'Why this bill matters on this list', run: async () => { await afterClose(); noteSheet(l, x, b); } },
    { label: 'Open the bill', icon: 'scroll-text', run: async () => { await afterClose(); S.go('#/bill/' + encodeURIComponent(b.bill_number)); } },
    { label: 'Remove from the list', icon: 'trash-2', danger: true, run: () => removeBill(l, b) },
  ] });
}
function shareMenu(l) {
  const f = S.listFollowers?.[l.id] || 0;
  menuSheet({ title: 'Share', items: [
    { label: 'Copy link', icon: 'link', sub: l.is_published ? 'Anyone with the link can open the list' : 'It works once the list is published', run: () => copyText(publicLink(l), l.is_published ? 'Link copied.' : 'Link copied. It works once the list is published.', 'link') },
    { label: 'Copy embed code', icon: 'copy', sub: 'Puts this list on another web page', run: () => copyText(embedCode(l), 'Embed code copied.', 'embed code') },
    { label: 'Open the public page', icon: 'external-link', disabled: !l.is_published, reason: 'Publish the list first. The public page shows only live lists.', run: () => { window.open(publicLink(l), '_blank', 'noopener'); } },
    { label: 'Email followers', icon: 'mail', disabled: !l.is_published, reason: 'Publish the list first. Only a live list has followers.', sub: plural(f, 'follower'),
      run: async () => { await afterClose(); S.go('#/email/new?list=' + encodeURIComponent(l.id)); } },
  ] });
}
function pageMenu(l) {
  menuSheet({ title: esc(l.title), items: [
    { label: 'Edit title, description and icon', icon: 'pencil', run: async () => { await afterClose(); openListForm(l); } },
    { label: 'Archive list', icon: 'archive', danger: true, sub: 'The public link stops working', run: async () => {
      await afterClose();
      const ok = await confirmSheet({ title: `Archive “${esc(l.title)}”?`, text: 'The public link stops working. People keep the bills they already follow.', ok: 'Archive list', danger: true });
      if (!ok) return;
      await afterClose();
      try { await DB.archiveList(l.id); S.go('#/outreach/lists', { replace: true }); toast(`Archived “${l.title}”.`); } catch (e) { toast(e, { err: true }); }
    } },
  ] });
}
// Followers: Supporters filtered to the people who follow this list (the same filter Supporters' sheet sets).
function showFollowers(l) {
  if (typeof SP.V === 'function' && typeof SP.EMPTY_PF === 'function') { const v = SP.V(); v.f = { ...SP.EMPTY_PF(), lists: [l.id] }; v.seg = null; }
  S.go('#/outreach');
}

// Desktop drag: the handle follows the pointer, the row moves between its neighbours, and the new order saves on
// release. Window listeners, not pointer capture, because moving the row in the page would drop the capture.
function wireDrag(l, list) {
  list.querySelectorAll('[data-grip]').forEach(g => {
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); g.focus({ preventScroll: true });
      const li = g.closest('li'), before = [...list.children].map(x => x.dataset.bid);
      li.classList.add('le-dragging'); list.classList.add('le-sorting');
      const move = ev => {
        let next = null;
        for (const s of list.children) { if (s === li) continue; const r = s.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { next = s; break; } }
        if (next !== li.nextElementSibling && next !== li) list.insertBefore(li, next);
        if (ev.clientY < 72) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 72) window.scrollBy(0, 12);
      };
      const up = async () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        li.classList.remove('le-dragging'); list.classList.remove('le-sorting');
        const after = [...list.children].map(x => x.dataset.bid);
        if (after.join() === before.join()) return;
        const b = billById(li.dataset.bid);
        try { await saveOrder(l, after); V().focus = 'grip:' + li.dataset.bid; hooks.render();
          toast(`Moved ${b ? numOf(b) : 'the bill'} to ${after.indexOf(li.dataset.bid) + 1} of ${after.length}.`, { undo: async () => { await saveOrder(l, before); hooks.render(); } });
        } catch (err) { toast(err, { err: true }); hooks.render(); }
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    g.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const ids = listRows(l).map(r => r.b.id), i = ids.indexOf(g.dataset.grip);
      moveTo(l, g.dataset.grip, i + (e.key === 'ArrowUp' ? -1 : 1), { focusGrip: true });
    });
  });
}

function wire(route, root) {
  const l = listById(route.id); if (!l) return;
  const page = root.querySelector('.le-list'); if (!page) return;
  const v = V();
  // Publish: an empty list cannot go live (the public page would show an empty list), so the switch says so in place.
  const sw = page.querySelector('#le-pub');
  sw.onchange = async () => {
    const on = sw.checked, err = page.querySelector('#le-puberr');
    if (on && !listRows(l).length) { sw.checked = false; err.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}<span>Add a bill before publishing.</span></p>`; return; }
    err.innerHTML = '';
    try {
      await DB.updateList(l.id, { is_published: on }); hooks.render();
      toast(on ? 'Published. The link works now.' : 'Unpublished. The link stops working.', { ok: on, undo: async () => { await DB.updateList(l.id, { is_published: !on }); hooks.render(); } });
    } catch (e) { sw.checked = !on; toast(e, { err: true }); }
  };
  page.querySelector('[data-le="share"]').onclick = () => shareMenu(l);
  page.querySelector('[data-le="more"]').onclick = () => pageMenu(l);
  page.querySelector('[data-le="followers"]')?.addEventListener('click', () => showFollowers(l));
  page.querySelectorAll('[data-bmore]').forEach(el => el.onclick = () => billMenu(l, el.dataset.bmore));
  const list = page.querySelector('.le-bills'); if (list) wireDrag(l, list);

  // The add search re-draws only its results, so the box keeps focus and the keyboard stays up.
  const q = page.querySelector('#le-q'), out = page.querySelector('#le-hits'), clr = page.querySelector('[data-le="qclear"]');
  const paint = () => { out.innerHTML = hitsHTML(l, q.value); clr.hidden = !q.value; wireHits(); };
  const wireHits = () => out.querySelectorAll('[data-add]').forEach(el => {
    el.onmousedown = e => e.preventDefault();          // keep focus in the search box on desktop
    el.onclick = async () => {
      const b = billById(el.dataset.add);
      try {
        const n = await DB.addListBills(l.id, [el.dataset.add]);
        if (!n) { toast('Only public bills can go on a list.', { err: true }); return; }
        v.focus = 'q'; hooks.render();
        toast(`Added ${b ? numOf(b) : 'the bill'}.`, { ok: true, undo: async () => { await DB.removeListBill(l.id, el.dataset.add); hooks.render(); } });
      } catch (e) { toast(e, { err: true }); }
    };
  });
  let t;
  q.oninput = () => { v.q[l.id] = q.value; clearTimeout(t); t = setTimeout(paint, 120); };
  q.onkeydown = e => { if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; v.q[l.id] = ''; paint(); } if (e.key === 'Enter') { e.preventDefault(); out.querySelector('[data-add]')?.click(); } };
  clr.onclick = () => { q.value = ''; v.q[l.id] = ''; paint(); q.focus(); };
  wireHits();

  // After a re-render caused by this page, put focus back where the person was working.
  if (v.focus === 'q') { q.focus({ preventScroll: true }); q.setSelectionRange(q.value.length, q.value.length); }
  else if (v.focus.startsWith('grip:')) page.querySelector(`[data-grip="${CSS.escape(v.focus.slice(5))}"]`)?.focus({ preventScroll: true });
  v.focus = '';
}

export default {
  tab: 'outreach',
  title: route => listById(route.id)?.title || 'List',
  back: () => ({ href: '#/outreach/lists', label: 'Lists' }),
  render, wire,
};
