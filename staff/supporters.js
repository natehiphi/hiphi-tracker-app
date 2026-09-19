// Outreach > Supporters (plan 3.7): everyone HIPHI knows, what they follow and what they did. The same people, rules
// and calls as the current app's People page (app.js renderPeople / wirePeople), laid out for a phone: one search box,
// saved segments as a chip row, one Filter sheet in four groups, removable filter chips, and a select mode whose bar
// sits where the tab bar was. Desktop gets a table with the Bills, Emails and Last active columns.
import { S, DB, DEMO, hooks, esc, fmtDate, advocate, peopleMatch, segmentPeople, personById } from './data.js';
import { ISLANDS, INTERESTS, personName, whereOf, sortPeople, parsePeopleCSV, exportPeopleCSV, billById, blurb } from './model.js';
import { icon, btn, iconBtn, row, empty, skeleton, toast, openSheet, closeSheet, menuSheet, pickerSheet, confirmSheet, switchRow } from './ui.js';

// ---- the filter model (the same shape as people_match() in the database, so a saved segment counts the same here,
// on the Emails page and when the email is sent) ----
export const EMPTY_PF = () => ({ q: '', tags: [], interests: [], islands: [], house: [], senate: [], account: 'any', optin: false, bills: [], lists: [], campaigns: [], active_days: 0, acted: false });
// data.js copied peopleMatch() from app.js but not the EMPTY_PF() it calls, so segmentPeople() throws
// "EMPTY_PF is not defined". A name a module cannot resolve falls back to the global object, so this keeps segment
// counts (here and in the composer's audience) working until data.js carries its own copy (requested in the report).
if (typeof globalThis.EMPTY_PF !== 'function') globalThis.EMPTY_PF = EMPTY_PF;
const pfClean = f => { const o = {}; for (const [k, v] of Object.entries(f)) if (Array.isArray(v) ? v.length : v && v !== 'any') o[k] = v; return o; };
const pfEmpty = f => !Object.keys(pfClean(f)).length;
const clone = f => ({ ...EMPTY_PF(), ...JSON.parse(JSON.stringify(f || {})) });
// Order inside a group does not matter (tapping Maui off and on again is not a change to the segment).
const norm = f => { const o = pfClean({ ...EMPTY_PF(), ...f }); for (const k in o) if (Array.isArray(o[k])) o[k] = o[k].map(String).sort(); return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); };
const nFilters = f => f.islands.length + f.senate.length + f.house.length + f.bills.length + f.lists.length + f.campaigns.length + f.tags.length + f.interests.length + (f.account !== 'any') + !!f.optin + !!f.active_days + !!f.acted;

// ui.js closes a sheet with history.back(), which lands a moment later. Opening the next sheet (or navigating) before
// it lands lets that Back swallow the new history entry, and the next close then leaves the page. So anything that
// follows a closing sheet waits for that Back first (or 400ms, if there was none).
export function afterSheet(fn) {
  let done = false;
  const go = () => { if (done) return; done = true; window.removeEventListener('popstate', go); clearTimeout(t); fn(); };
  window.addEventListener('popstate', go); const t = setTimeout(go, 400);
}

export const V = () => S.spView ??= { f: EMPTY_PF(), sort: 'active', seg: null, sel: new Set(), selecting: false, limit: 200 };
const SORTS = [['active', 'Last active'], ['score', 'Most engaged'], ['newest', 'Newest first'], ['name', 'Name, A to Z']];
const isDesk = () => matchMedia('(min-width: 900px)').matches;
const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const shown = v => sortPeople((S.people || []).filter(p => peopleMatch(p, v.f)), v.sort);
const allTags = () => [...new Set((S.people || []).flatMap(p => p.tags || []))].sort((a, b) => a.localeCompare(b));
const activeAdvs = () => S.advocates.filter(a => a.is_active !== false);
const firstName = a => (a?.full_name || '').split(' ')[0] || 'someone';
const segOf = v => v.seg && (S.segments || []).find(x => x.id === v.seg);
const campName = id => (S.campaigns || []).find(c => c.id === id)?.name || 'a coalition';
const listName = id => (S.lists || []).find(l => l.id === id)?.title || 'a list';
const intLabel = k => INTERESTS.find(x => x[0] === k)?.[1] || k;

// Every filter that is on, as a removable chip: [group, value, label]
function activeChips(f) {
  const out = [];
  f.islands.forEach(x => out.push(['islands', x, x]));
  f.senate.forEach(x => out.push(['senate', x, `SD ${x}`]));
  f.house.forEach(x => out.push(['house', x, `HD ${x}`]));
  f.bills.forEach(x => out.push(['bills', x, `Follows ${billById(x)?.bill_number || 'a bill'}`]));
  f.lists.forEach(x => out.push(['lists', x, `Follows ${listName(x)}`]));
  f.campaigns.forEach(x => out.push(['campaigns', x, `Coalition: ${campName(x)}`]));
  f.tags.forEach(x => out.push(['tags', x, `Tag: ${x}`]));
  f.interests.forEach(x => out.push(['interests', x, intLabel(x)]));
  if (f.account !== 'any') out.push(['account', f.account, f.account === 'yes' ? 'Has an account' : 'Contact only']);
  if (f.optin) out.push(['optin', '1', 'Action alerts on']);
  if (f.active_days) out.push(['active_days', f.active_days, `Active in the last ${f.active_days} days`]);
  if (f.acted) out.push(['acted', '1', 'Took an action']);
  return out;
}
function dropFilter(f, key, val) {
  if (Array.isArray(f[key])) f[key] = f[key].filter(x => String(x) !== String(val));
  else f[key] = EMPTY_PF()[key];
}

// ---- the Outreach switcher (Lists and Emails show the same three links) ----
export const outreachNav = cur => `<nav class="sv-seg sp-seg" aria-label="Outreach">${[['supporters', '#/outreach', 'Supporters'], ['lists', '#/outreach/lists', 'Lists'], ['emails', '#/outreach/emails', 'Emails']]
  .map(([k, href, l]) => `<a href="${href}"${k === cur ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;

// ---- rows ----
// "Oʻahu · SD 17 · active 3/16": where they are and when we last heard from them; problems with their email first.
function subLine(p) {
  const bits = [];
  if (p.bounced_at) bits.push('Email bounced');
  else if (p.unsubscribed_at) bits.push('Unsubscribed');
  if (p.island) bits.push(p.island);
  if (p.senate_district) bits.push(`SD ${p.senate_district}`);
  if (p.last_active) bits.push(`active ${fmtDate(p.last_active)}`);
  return bits.join(' · ') || 'No district or activity yet';
}
const actionsText = p => p.actions ? plural(p.actions, 'action') : '';
function phoneRow(p, v) {
  const title = esc(personName(p)), sub = esc(subLine(p)), end = actionsText(p) ? `<span class="sp-acts">${esc(actionsText(p))}</span>` : '';
  if (!v.selecting) return row({ title, sub, end, href: `#/person/${encodeURIComponent(p.id)}`, attrs: { 'data-pid': p.id, 'data-k': 'p:' + p.id }, cls: 'sp-row' });
  const on = v.sel.has(p.id);
  return row({ leadHtml: `<span class="sp-check" aria-hidden="true">${icon(on ? 'square-check-big' : 'square')}</span>`, title, sub, end, chevron: false,
    attrs: { 'data-pick': p.id, 'data-k': 'p:' + p.id, 'aria-pressed': on ? 'true' : 'false' }, cls: 'sp-row' + (on ? ' sel' : '') });
}
function deskRow(p, v) {
  const on = v.sel.has(p.id), dash = '<span class="muted" aria-label="none">–</span>';
  const emails = p.emails_sent ? `${p.emails_sent} sent · ${p.emails_opened || 0} opened` : dash;
  return `<tr data-row="${esc(p.id)}"${on ? ' class="sel"' : ''}>
    <td class="cb"><label class="sp-cbl"><input type="checkbox" data-sel="${esc(p.id)}" data-k="c:${esc(p.id)}" ${on ? 'checked' : ''} aria-label="Select ${esc(personName(p))}"></label></td>
    <td class="who"><a href="#/person/${encodeURIComponent(p.id)}" data-k="p:${esc(p.id)}">${esc(personName(p))}</a><span class="em">${esc(p.email)}</span></td>
    <td>${p.bounced_at ? `<span class="sp-flag">${icon('triangle-alert')}Email bounced</span>` : p.unsubscribed_at ? '<span class="sp-flag">Unsubscribed</span>' : ''}${esc(whereOf(p)) || (p.bounced_at || p.unsubscribed_at ? '' : dash)}</td>
    <td class="num">${p.actions || dash}</td>
    <td class="num">${(p.bill_ids || []).length || dash}</td>
    <td>${emails}</td>
    <td>${p.last_active ? esc(fmtDate(p.last_active)) : dash}</td>
  </tr>`;
}

// The part under the search box: filter chips, the select helpers and the people. Re-drawn on its own while typing so
// the search box keeps focus.
function resultsHTML(v) {
  const all = S.people || [], rows = shown(v), seg = segOf(v), changed = seg && norm(v.f) !== norm(seg.filter);
  const chips = activeChips(v.f);
  const head = chips.length || v.f.q.trim() ? `<div class="sp-active">
      <span class="sp-match" aria-live="polite">${esc(plural(rows.length, 'person', 'people'))} ${rows.length === 1 ? 'matches' : 'match'}</span>
      ${chips.map(([k, val, l]) => `<button type="button" class="chip sp-fchip" data-drop="${esc(k)}" data-val="${esc(val)}" data-k="d:${esc(k)}:${esc(val)}" aria-label="Remove filter: ${esc(l)}">${esc(l)}${icon('x')}</button>`).join('')}
      ${btn('Clear all', { kind: 'text', sm: true, attrs: { 'data-sp': 'clear' } })}
      ${changed ? btn(`Save to “${esc(seg.name)}”`, { kind: 'text', sm: true, attrs: { 'data-sp': 'segupdate' } }) : ''}
    </div>` : '';
  const selHead = v.selecting && !isDesk() ? `<div class="sp-selhead">${rows.length && rows.every(p => v.sel.has(p.id))
    ? btn('Clear the selection', { kind: 'text', sm: true, attrs: { 'data-sp': 'selnone' } })
    : btn(`Select all ${rows.length.toLocaleString()}`, { kind: 'text', sm: true, attrs: { 'data-sp': 'selall', disabled: !rows.length } })}</div>` : '';
  if (!all.length) return `${head}${empty({ title: 'No supporters yet', text: 'Add someone by hand, or import a list from a CSV file.', action: btn('Add a person', { icon: 'user-plus', attrs: { 'data-sp': 'add' } }) })}`;
  if (!rows.length) return `${head}${empty({ title: 'Nobody matches', text: 'Try fewer filters or a shorter search.', action: btn(nFilters(v.f) ? 'Clear filters' : 'Clear the search', { kind: 'secondary', attrs: { 'data-sp': 'clear' } }) })}`;
  const page = rows.slice(0, v.limit);
  const more = rows.length > page.length ? `<div class="sp-more"><span class="meta">Showing ${page.length.toLocaleString()} of ${rows.length.toLocaleString()}</span>${btn(`Show ${Math.min(200, rows.length - page.length)} more`, { kind: 'secondary', sm: true, attrs: { 'data-sp': 'morerows' } })}</div>` : '';
  if (isDesk()) {
    const allOn = rows.every(p => v.sel.has(p.id)), some = !allOn && rows.some(p => v.sel.has(p.id));
    return `${head}<table class="sp-table"><caption class="sr">Supporters, ${esc(plural(rows.length, 'person', 'people'))}. Select a name to open it.</caption>
      <colgroup><col class="c-cb"><col><col class="c-where"><col class="c-n"><col class="c-n"><col class="c-em"><col class="c-last"></colgroup>
      <thead><tr><th class="cb" scope="col"><label class="sp-cbl"><input type="checkbox" data-selall data-k="c:all" ${allOn ? 'checked' : ''} ${some ? 'data-mixed' : ''} aria-label="Select all ${rows.length}"></label></th>
        <th scope="col">Name</th><th scope="col">Where</th><th scope="col" class="num">Actions</th><th scope="col" class="num">Bills</th><th scope="col">Emails</th><th scope="col">Last active</th></tr></thead>
      <tbody>${page.map(p => deskRow(p, v)).join('')}</tbody></table>${more}`;
  }
  return `${head}${selHead}<div class="rows sp-list">${page.map(p => phoneRow(p, v)).join('')}</div>${more}`;
}

function segChips(v) {
  const total = (S.people || []).length, noneOn = !v.seg && !nFilters(v.f);
  return `<div class="sp-segs" role="group" aria-label="Saved segments">
    <button type="button" class="chip" data-segpick="" data-k="s:" aria-pressed="${noneOn}">Everyone<span class="sp-cn">${total.toLocaleString()}</span></button>
    ${(S.segments || []).map(x => `<button type="button" class="chip" data-segpick="${esc(x.id)}" data-k="s:${esc(x.id)}" aria-pressed="${v.seg === x.id}">${esc(x.name)}<span class="sp-cn">${segmentPeople(x.id).length.toLocaleString()}</span></button>`).join('')}
  </div>`;
}

// ---- the screen ----
export default {
  tab: 'outreach',
  title: () => 'Outreach',
  wide: () => true,
  noTabs: () => !!S.spView?.selecting && !isDesk() && document.body.dataset.screen === 'supporters',
  render(route) {
    const v = V();
    if (!S.peopleLoaded) {
      if (!DEMO && !S.spLoadKick) {
        S.spLoadKick = true;
        DB.loadPeople().then(() => { S.spLoadErr = null; hooks.render(); }).catch(e => { S.spLoadErr = e; S.spLoadKick = false; hooks.render(); });
      }
      return `<div class="sp-page"><h1 class="sp-h1">Supporters</h1>${outreachNav('supporters')}${S.spLoadErr
        ? empty({ title: 'Supporters did not load', text: 'Check your connection and try again.', action: btn('Try again', { icon: 'rotate-ccw', attrs: { 'data-sp': 'retry' } }) })
        : skeleton(6)}</div>`;
    }
    // #/outreach?segment=ID (from the Emails page) opens with that segment on
    if (route.q?.segment && v.fromQ !== route.q.segment) { v.fromQ = route.q.segment; const sg = (S.segments || []).find(x => String(x.id) === route.q.segment); if (sg) { v.seg = sg.id; v.f = clone(sg.filter); } }
    // Select mode is a mode: coming back from another page starts without it (the frame sets data-screen after render).
    if (document.body.dataset.screen !== 'supporters') { v.selecting = false; v.sel.clear(); }
    for (const id of [...v.sel]) if (!personById(id)) v.sel.delete(id);
    const n = nFilters(v.f);
    return `<div class="sp-page">
      <h1 class="sp-h1">Supporters</h1>
      ${outreachNav('supporters')}
      <div class="sp-tools">
        <div class="sp-search" role="search"><label class="sr" for="sp-q">Search supporters by name, email or phone</label>${icon('search')}
          <input id="sp-q" type="search" placeholder="Search people" value="${esc(v.f.q)}" autocomplete="off" enterkeyhint="search">
          ${iconBtn('x', 'Clear the search', { 'data-sp': 'qclear', hidden: !v.f.q })}</div>
        <button type="button" class="btn secondary sm sp-filterbtn" data-sp="filter" data-k="filter" aria-haspopup="dialog">${icon('sliders-horizontal')}<span>Filter</span>${n ? `<span class="sp-n" aria-label="${n} on">${n}</span>` : ''}</button>
        ${iconBtn('ellipsis', 'More actions', { 'data-sp': 'more', 'data-k': 'more', 'aria-haspopup': 'dialog' })}
      </div>
      ${segChips(v)}
      <div id="sp-results">${resultsHTML(v)}</div>
      <input type="file" id="sp-file" accept=".csv,text/csv" hidden>
    </div>`;
  },
  bar() {
    const v = S.spView;
    if (!v || !(v.selecting || (isDesk() && v.sel.size))) return '';
    const n = v.sel.size;
    return `<div class="sp-bar">
      ${iconBtn('x', 'Stop selecting', { 'data-sp': 'selexit' })}
      <span class="sp-selcount" aria-live="polite">${n.toLocaleString()} selected</span>
      ${btn('Tag', { kind: 'secondary', icon: 'tag', attrs: { 'data-sp': 'tag', disabled: !n } })}
      ${btn('Follow up', { kind: 'secondary', icon: 'calendar-plus', attrs: { 'data-sp': 'fup', disabled: !n } })}
    </div>`;
  },
  wire(route, root) {
    const v = V(), page = root.querySelector('.sp-page');
    if (!page) return;
    const on = (sel, fn) => root.querySelectorAll(sel).forEach(el => { el.onclick = e => fn(el, e); });
    on('[data-sp="retry"]', () => { S.spLoadErr = null; hooks.render(); });
    if (!S.peopleLoaded) return;
    const q = page.querySelector('#sp-q'), qx = page.querySelector('[data-sp="qclear"]');
    q.oninput = () => {
      v.f.q = q.value; qx.hidden = !q.value;
      clearTimeout(v.qT); v.qT = setTimeout(() => { v.limit = 200; drawResults(root); }, 150);
    };
    q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); q.blur(); } };
    qx.onclick = () => { v.f.q = ''; q.value = ''; qx.hidden = true; drawResults(root); q.focus(); };
    on('[data-sp="filter"]', () => filterSheet());
    on('[data-sp="more"]', () => moreMenu(root));
    on('[data-segpick]', el => {
      const id = el.dataset.segpick, sg = (S.segments || []).find(x => String(x.id) === id);
      if (!sg || v.seg === sg.id) { v.seg = null; v.f = { ...EMPTY_PF(), q: '' }; }
      else { v.seg = sg.id; v.f = clone(sg.filter); }
      v.limit = 200; rerender(el.dataset.k);
    });
    // select mode bar (outside main, so looked up on the whole frame)
    on('[data-sp="selexit"]', () => { v.selecting = false; v.sel.clear(); hooks.render(); });
    on('[data-sp="tag"]', () => tagSheet([...v.sel]));
    on('[data-sp="fup"]', () => followupSheet([...v.sel], { onDone: () => { v.selecting = false; v.sel.clear(); hooks.render(); } }));
    wireResults(root);
    // Keep the chosen segment in view in its sideways strip (without moving the page).
    const strip = page.querySelector('.sp-segs'), cur = strip?.querySelector('[aria-pressed="true"]');
    if (strip && cur && strip.scrollWidth > strip.clientWidth && (cur.offsetLeft + cur.offsetWidth > strip.scrollLeft + strip.clientWidth || cur.offsetLeft < strip.scrollLeft)) strip.scrollLeft = cur.offsetLeft - 16;
    const file = page.querySelector('#sp-file');
    file.onchange = async () => { const f = file.files[0]; file.value = ''; if (f) importSheet(f); };
  },
};

function drawResults(root) {
  const box = root.querySelector('#sp-results'); if (!box) return;
  box.innerHTML = resultsHTML(V()); wireResults(root);
}
// Re-draw the whole frame (the bar and the tab bar change with selection) and put focus back where it was.
function rerender(key) {
  const y = window.scrollY; hooks.render(); window.scrollTo(0, y);
  if (key) document.querySelector(`#app [data-k="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}
let suppressUntil = 0;   // a long press ends in a click on the row that just turned into a checkbox; ignore it
function wireResults(root) {
  const v = V(), box = root.querySelector('#sp-results'); if (!box) return;
  const on = (sel, fn) => box.querySelectorAll(sel).forEach(el => { el.onclick = e => fn(el, e); });
  on('[data-sp="clear"]', () => { v.f = { ...EMPTY_PF() }; v.seg = null; v.limit = 200; rerender('filter'); });
  on('[data-drop]', el => { dropFilter(v.f, el.dataset.drop, el.dataset.val); v.limit = 200; rerender('filter'); });
  on('[data-sp="segupdate"]', () => saveSegmentChanges());
  on('[data-sp="add"]', () => addPersonSheet());
  on('[data-sp="morerows"]', () => { v.limit += 200; drawResults(root); });
  on('[data-sp="selall"]', () => { for (const p of shown(v)) v.sel.add(p.id); rerender('p:' + ([...v.sel][0] || '')); });
  on('[data-sp="selnone"]', () => { v.sel.clear(); hooks.render(); });
  on('[data-pick]', el => {
    if (Date.now() < suppressUntil) return;
    const id = el.dataset.pick; v.sel.has(id) ? v.sel.delete(id) : v.sel.add(id); rerender(el.dataset.k);
  });
  // desktop table: the whole row opens the person; the tick box selects
  box.querySelectorAll('tr[data-row]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('a, input, label, button')) return;
    S.go('#/person/' + encodeURIComponent(tr.dataset.row));
  }));
  box.querySelectorAll('[data-sel]').forEach(cb => cb.onchange = () => { cb.checked ? v.sel.add(cb.dataset.sel) : v.sel.delete(cb.dataset.sel); rerender(cb.dataset.k); });
  const all = box.querySelector('[data-selall]');
  if (all) { all.indeterminate = all.hasAttribute('data-mixed'); all.onchange = () => { const rows = shown(v); if (all.checked) rows.forEach(p => v.sel.add(p.id)); else v.sel.clear(); rerender('c:all'); }; }
  // Long press on a phone row starts select mode with that person picked (the ⋯ menu has "Select people" too).
  const list = box.querySelector('.sp-list');
  if (list && !v.selecting) {
    let t = 0, sx = 0, sy = 0;
    const stop = () => clearTimeout(t);
    list.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const r = e.target.closest('[data-pid]'); if (!r) return;
      sx = e.clientX; sy = e.clientY; stop();
      t = setTimeout(() => { suppressUntil = Date.now() + 800; v.selecting = true; v.sel.add(r.dataset.pid); try { navigator.vibrate?.(12); } catch { /* not supported */ } rerender('p:' + r.dataset.pid); }, 500);
    });
    list.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) stop(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => list.addEventListener(k, stop));
    list.addEventListener('click', e => { if (Date.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
    list.addEventListener('contextmenu', e => { if (e.target.closest('[data-pid]')) e.preventDefault(); });
  }
}

// ---- ⋯ menu ----
function moreMenu(root) {
  const v = V(), rows = shown(v), all = S.people || [], seg = segOf(v), changed = seg && norm(v.f) !== norm(seg.filter), admin = !!S.me?.is_admin;
  const sortL = SORTS.find(s => s[0] === v.sort)?.[1] || 'Last active';
  menuSheet({ title: 'Supporters', items: [
    { label: 'Add a person', icon: 'user-plus', run: () => afterSheet(addPersonSheet) },
    admin ? { label: 'Import CSV', icon: 'upload', sub: 'Adds new people and updates the rest. Nothing is blanked.', run: () => root.querySelector('#sp-file')?.click() } : null,
    admin ? { label: rows.length === all.length ? `Export all ${all.length.toLocaleString()} as CSV` : `Export these ${rows.length.toLocaleString()} as CSV`, icon: 'download', disabled: !rows.length, reason: 'Nobody matches, so there is nothing to export.', run: () => { exportPeopleCSV(rows); toast(`Downloading ${plural(rows.length, 'person', 'people')} as a CSV file.`); } } : null,
    { label: 'Select people', icon: 'square-check-big', sub: 'Then tag them or add a follow-up', disabled: !rows.length, reason: 'Nobody matches, so there is no one to select.', run: () => { v.selecting = true; rerender(); } },
    { label: `Sort: ${sortL}`, icon: 'list', run: () => afterSheet(() => pickerSheet({ title: 'Sort supporters', value: v.sort, options: SORTS.map(([k, l]) => [k, l]), onPick: val => { v.sort = val; hooks.render(); toast(`Sorted by ${SORTS.find(s => s[0] === val)[1].toLowerCase()}.`); } })) },
    changed ? { label: `Save changes to “${seg.name}”`, icon: 'bookmark-check', run: () => saveSegmentChanges() } : null,
    { label: seg && changed ? 'Save as a new segment' : 'Save as segment', icon: 'bookmark', sub: 'Keeps these filters one tap away, here and in Emails',
      disabled: pfEmpty(v.f) || (seg && !changed), reason: pfEmpty(v.f) ? 'Add a filter or a search first.' : `These filters are already saved as “${seg?.name}”.`, run: () => afterSheet(saveSegmentSheet) },
    seg ? { label: `Email “${seg.name}”`, icon: 'mail', sub: changed ? 'Goes to the saved segment, not your unsaved changes' : 'Starts an action alert to this segment', run: () => afterSheet(() => S.go('#/email/new?segment=' + encodeURIComponent(seg.id))) }
      : { label: 'Email this segment', icon: 'mail', disabled: true, reason: 'Pick a saved segment first. Emails go to segments, lists or a bill’s followers.' },
    seg ? { label: `Delete “${seg.name}”`, icon: 'trash-2', danger: true, run: () => afterSheet(() => deleteSegment(seg)) } : null,
  ] });
}

// ---- the Filter sheet: pick in one go, see the count, then Show N people ----
function filterSheet() {
  const v = V(), all = S.people || [];
  let d = clone(v.f), billQ = '';
  const tags = allTags();
  const sds = [...new Set(all.map(p => p.senate_district).filter(Boolean))].sort((a, b) => a - b);
  const hds = [...new Set(all.map(p => p.house_district).filter(Boolean))].sort((a, b) => a - b);
  // Counts for one group: everyone who passes every other group, split by this group's options.
  // Which groups each person fails, worked out once per redraw with peopleMatch() one group at a time (the rules are a
  // plain AND of groups, so this is the same answer), so the counts stay quick with thousands of people.
  let fails = [];
  const recount = () => { const keys = Object.keys(pfClean(d)); fails = all.map(p => keys.filter(k => !peopleMatch(p, { [k]: d[k] }))); };
  const base = key => all.filter((p, i) => fails[i].every(k => k === key));
  const tally = (key, test) => { const b = base(key); return val => b.filter(p => test(p, val)).length; };
  const multi = (key, opts, count) => opts.map(([val, label]) => {
    const onNow = d[key].map(String).includes(String(val)), n = count(val);
    return `<button type="button" class="chip" data-fk="${key}" data-fv="${esc(val)}" data-k="f:${key}:${esc(val)}" aria-pressed="${onNow}"${!onNow && !n ? ' disabled' : ''}>${onNow ? icon('check') : ''}${esc(label)}<span class="sp-cn">${n}</span></button>`;
  }).join('');
  const one = (key, opts, count) => opts.map(([val, label]) => {
    const onNow = String(d[key]) === String(val), n = count ? count(val) : null;
    return `<button type="button" class="chip" data-f1="${key}" data-fv="${esc(val)}" data-k="f:${key}:${esc(val)}" aria-pressed="${onNow}"${!onNow && n === 0 ? ' disabled' : ''}>${onNow ? icon('check') : ''}${esc(label)}${n === null ? '' : `<span class="sp-cn">${n}</span>`}</button>`;
  }).join('');
  const sel = (key, label, opts, prefix) => {
    const cur = d[key].map(Number), c = tally(key, (p, val) => p[key === 'senate' ? 'senate_district' : 'house_district'] === val);
    return `<div class="field"><label for="sp-f-${key}">${label}</label><select id="sp-f-${key}" data-fsel="${key}" data-k="f:${key}">
      <option value="">Any</option>${cur.length > 1 ? `<option value="__keep" selected>${esc(cur.map(x => prefix + ' ' + x).join(', '))}</option>` : ''}
      ${opts.map(x => `<option value="${x}"${cur.length === 1 && cur[0] === x ? ' selected' : ''}>${prefix} ${x} (${c(x)})</option>`).join('')}</select></div>`;
  };
  const billSug = () => {
    const qq = billQ.trim().toUpperCase().replace(/\s+/g, ''); if (!qq) return '';
    const words = /\d/.test(qq) ? null : billQ.trim().toLowerCase();
    const hits = S.bills.filter(b => b.is_public && !d.bills.includes(b.id) && (words ? words.length >= 3 && (b.public_summary || b.description || b.title || '').toLowerCase().includes(words) : b.bill_number.includes(qq))).slice(0, 6);
    return hits.length ? hits.map(b => `<button type="button" class="sp-sug" data-addbill="${esc(b.id)}"><b>${esc(b.bill_number)}</b><span>${esc(blurb(b, 60))}</span></button>`).join('')
      : `<p class="meta sp-sugnone">No public bill matches “${esc(billQ.trim())}”. Supporters can follow only public bills.</p>`;
  };
  const body = () => {
    const isl = tally('islands', (p, x) => p.island === x), lst = tally('lists', (p, x) => (p.list_ids || []).includes(x)),
      cmp = tally('campaigns', (p, x) => (p.bill_ids || []).some(id => (S.billCampaigns[id] || []).includes(x))),
      tg = tally('tags', (p, x) => (p.tags || []).includes(x)), it = tally('interests', (p, x) => (p.interests || []).includes(x)),
      ac = tally('account', (p, x) => x === 'any' || (x === 'yes') === !!p.has_account),
      act = tally('active_days', (p, x) => !+x || (p.last_active && Date.now() - new Date(p.last_active) < +x * 864e5));
    return `<div class="sp-sheet sp-filter">
      <section aria-labelledby="sp-g1"><h3 id="sp-g1">Where</h3>
        <fieldset><legend>Island</legend><div class="chips">${multi('islands', ISLANDS.map(x => [x, x]), isl)}</div></fieldset>
        <div class="sp-two">${sel('senate', 'Senate district', sds, 'SD')}${sel('house', 'House district', hds, 'HD')}</div>
      </section>
      <section aria-labelledby="sp-g2"><h3 id="sp-g2">Follows</h3>
        <div class="field sp-billpick"><label for="sp-f-bill">A bill</label>
          <div class="chips">${d.bills.map(id => `<button type="button" class="chip" aria-pressed="true" data-fk="bills" data-fv="${esc(id)}" data-k="f:bills:${esc(id)}" aria-label="Remove ${esc(billById(id)?.bill_number || 'bill')}">${esc(billById(id)?.bill_number || 'A bill')}${icon('x')}</button>`).join('')}</div>
          <input id="sp-f-bill" type="search" placeholder="Type a number, like HB1563" value="${esc(billQ)}" autocomplete="off" data-k="f:billq">
          <div class="sp-sugs" id="sp-f-sugs">${billSug()}</div></div>
        ${(S.lists || []).length ? `<fieldset><legend>A list</legend><div class="chips">${multi('lists', S.lists.map(l => [l.id, l.title]), lst)}</div></fieldset>` : ''}
        ${(S.campaigns || []).length ? `<fieldset><legend>A bill in this coalition</legend><div class="chips">${multi('campaigns', S.campaigns.map(c => [c.id, c.name]), cmp)}</div></fieldset>` : ''}
      </section>
      <section aria-labelledby="sp-g3"><h3 id="sp-g3">About them</h3>
        ${tags.length ? `<fieldset><legend>Tags</legend><div class="chips">${multi('tags', tags.map(t => [t, t]), tg)}</div></fieldset>` : ''}
        <fieldset><legend>Interests</legend><div class="chips">${multi('interests', INTERESTS, it)}</div></fieldset>
        <fieldset><legend>Account</legend><div class="chips">${one('account', [['any', 'Anyone'], ['yes', 'Has an account'], ['no', 'Contact only']], ac)}</div></fieldset>
        ${switchRow('sp-f-optin', 'Opted in to action alerts', d.optin, 'Only people an action alert can reach', { 'data-fsw': 'optin', 'data-k': 'f:optin' })}
      </section>
      <section aria-labelledby="sp-g4"><h3 id="sp-g4">Activity</h3>
        <fieldset><legend>Last active</legend><div class="chips">${one('active_days', [[0, 'Any time'], [7, '7 days'], [30, '30 days'], [90, '90 days']], act)}</div></fieldset>
        ${switchRow('sp-f-acted', 'Took an action', d.acted, 'Testified, emailed a chair, went to a hearing or shared', { 'data-fsw': 'acted', 'data-k': 'f:acted' })}
      </section>
    </div>`;
  };
  const count = () => fails.filter(f => !f.length).length;
  const foot = () => { const n = count(); return `${nFilters(d) ? btn('Clear all', { kind: 'text', attrs: { 'data-fx': 'clear' } }) : ''}${btn(n ? `Show ${plural(n, 'person', 'people')}` : 'Nobody matches', { attrs: { 'data-fx': 'apply', disabled: !n } })}`; };
  recount();
  openSheet({ title: 'Filter supporters', size: 'full', body: body(), foot: foot(), wire: dlg => {
    const bodyEl = dlg.querySelector('.sv-sh-body'), footEl = dlg.querySelector('.sv-sh-foot');
    const redraw = key => {
      recount(); const y = bodyEl.scrollTop; bodyEl.innerHTML = body(); footEl.innerHTML = foot(); bodyEl.scrollTop = y;
      if (key) dlg.querySelector(`[data-k="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    };
    dlg.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t || !dlg.contains(t)) return;
      if (t.dataset.fk) { const k = t.dataset.fk, val = t.dataset.fv; const has = d[k].map(String).includes(String(val)); d[k] = has ? d[k].filter(x => String(x) !== String(val)) : [...d[k], val]; redraw(has && k === 'bills' ? 'f:billq' : t.dataset.k); }
      else if (t.dataset.f1) { const k = t.dataset.f1; d[k] = k === 'active_days' ? +t.dataset.fv : t.dataset.fv; redraw(t.dataset.k); }
      else if (t.dataset.addbill) { d.bills = [...d.bills, t.dataset.addbill]; billQ = ''; redraw('f:billq'); }
      else if (t.dataset.fx === 'clear') { d = { ...EMPTY_PF(), q: d.q }; billQ = ''; redraw(); }
      else if (t.dataset.fx === 'apply') { v.f = d; if (v.seg && !segOf(v)) v.seg = null; v.limit = 200; closeSheet({ silent: true }); rerender('filter'); }
    });
    dlg.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.fsel && t.value !== '__keep') { d[t.dataset.fsel] = t.value ? [Number(t.value)] : []; redraw(t.dataset.k); }
      else if (t.dataset.fsw) { d[t.dataset.fsw] = t.checked; redraw(t.dataset.k); }
    });
    dlg.addEventListener('input', e => {
      if (e.target.id !== 'sp-f-bill') return;
      billQ = e.target.value; dlg.querySelector('#sp-f-sugs').innerHTML = billSug();
    });
    dlg.addEventListener('keydown', e => {
      if (e.target.id === 'sp-f-bill' && e.key === 'Enter') { e.preventDefault(); const first = dlg.querySelector('[data-addbill]'); if (first) first.click(); }
    });
  } });
}

// ---- segments ----
function saveSegmentSheet() {
  const v = V();
  openSheet({ title: 'Save as segment', size: 'auto',
    body: `<div class="sp-sheet"><div class="field"><label for="sp-segname">Name</label><input id="sp-segname" maxlength="80" autocomplete="off" placeholder="e.g. Maui parents" autofocus><span class="help">Everyone on the team sees it here and in Emails.</span></div><div id="sp-segerr" role="alert"></div>
      <p class="meta sp-segsum">${esc(plural(shown(v).length, 'person', 'people'))} match right now. The segment updates itself as people change.</p></div>`,
    foot: btn('Save segment', { attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const inp = dlg.querySelector('#sp-segname'), go = dlg.querySelector('[data-go]'); inp.focus();
      const save = async () => {
        const name = inp.value.trim();
        if (name.length < 2) { dlg.querySelector('#sp-segerr').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}Give it a name first.</p>`; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { const sg = await DB.saveSegment({ name, filter: pfClean(v.f) }); v.seg = sg.id; closeSheet({ silent: true }); rerender(); toast(`Saved “${name}”. It is in Emails too.`, { ok: true }); }
        catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
      go.onclick = save; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
    } });
}
async function saveSegmentChanges() {
  const v = V(), sg = segOf(v); if (!sg) return;
  const before = sg.filter;
  try {
    await DB.saveSegment({ id: sg.id, name: sg.name, filter: pfClean(v.f) }); rerender();
    toast(`Saved the changes to “${sg.name}”.`, { ok: true, undo: async () => { await DB.saveSegment({ id: sg.id, name: sg.name, filter: before }); v.f = clone(before); hooks.render(); toast('The segment is back as it was.'); } });
  } catch (e) { toast(e, { err: true }); }
}
async function deleteSegment(sg) {
  const ok = await confirmSheet({ title: `Delete “${esc(sg.name)}”?`, text: 'The people stay. Only this saved filter goes, here and in Emails.', ok: 'Delete segment', danger: true });
  if (!ok) return;
  try { await DB.deleteSegment(sg.id); const v = V(); v.seg = null; v.f = EMPTY_PF(); rerender(); toast(`Deleted the segment “${sg.name}”.`); }
  catch (e) { toast(e, { err: true }); }
}

// ---- add, import ----
function addPersonSheet() {
  openSheet({ title: 'Add a person', size: 'auto',
    body: `<div class="sp-sheet"><div class="field"><label for="sp-ae">Email</label><input id="sp-ae" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200" aria-describedby="sp-aerr"></div>
      <div class="field"><label for="sp-an">Name (optional)</label><input id="sp-an" autocomplete="off" maxlength="120"></div>
      <div id="sp-aerr" role="alert"></div><p class="meta sp-addnote">They are added as a contact. They get action alerts only if they opt in.</p></div>`,
    foot: btn('Add person', { icon: 'user-plus', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const em = dlg.querySelector('#sp-ae'), nm = dlg.querySelector('#sp-an'), go = dlg.querySelector('[data-go]'); em.focus();
      const err = m => { dlg.querySelector('#sp-aerr').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; em.toggleAttribute('aria-invalid', !!m); };
      const save = async () => {
        const e = em.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { err('Enter an email address, like name@example.com.'); em.focus(); return; }
        const ex = (S.people || []).find(p => (p.email || '').toLowerCase() === e);
        if (ex) { closeSheet({ silent: true }); afterSheet(() => { S.go('#/person/' + encodeURIComponent(ex.id)); toast(`${personName(ex)} is already in Supporters.`); }); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { const p = await DB.addPerson({ email: e, name: nm.value.trim() || null, tags: [], interests: [] }); closeSheet({ silent: true }); afterSheet(() => { S.go('#/person/' + encodeURIComponent(p.id)); toast(`Added ${personName(p)}.`, { ok: true }); }); }
        catch (x) { go.removeAttribute('aria-busy'); go.disabled = false; toast(x, { err: true }); }
      };
      go.onclick = save; [em, nm].forEach(i => i.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
    } });
}
// Import shows what will happen before anything is written: new, updated, opted in, and the first rows as read.
async function importSheet(file) {
  let parsed;
  try { parsed = parsePeopleCSV(await file.text()); } catch { parsed = { rows: [], cols: [] }; }
  const { rows, cols } = parsed;
  if (!rows.length) {
    openSheet({ title: 'Nothing to import', size: 'auto', body: `<div class="sp-sheet"><p>${esc(file.name)} has no rows with an email address.</p>
      <p class="meta sp-cols">${cols.length ? `The first row reads: ${esc(cols.slice(0, 12).join(', '))}. One of these has to say “email”.` : 'The file looks empty.'}</p></div>`,
      foot: btn('OK', { attrs: { 'data-ok': '1' } }), wire: d => { d.querySelector('[data-ok]').onclick = () => closeSheet(); } });
    return;
  }
  const have = new Set((S.people || []).map(p => (p.email || '').toLowerCase()));
  const uniq = [...new Set(rows.map(r => r.email.toLowerCase()))];
  const upd = uniq.filter(e => have.has(e)).length, add = uniq.length - upd, opted = rows.filter(r => r.action_alerts).length;
  const found = ['email', rows.some(r => r.name) && 'name', rows.some(r => r.phone) && 'phone', rows.some(r => r.tags.length) && 'tags', rows.some(r => r.interests.length) && 'interests', rows.some(r => r.action_alerts !== null) && 'opt-in'].filter(Boolean);
  openSheet({ title: `Import ${plural(rows.length, 'row')}?`, size: 'auto',
    body: `<div class="sp-sheet sp-import"><p class="meta">From ${esc(file.name)}</p>
      <ul class="sp-sum">
        <li>${icon('user-plus')}<span><b>${add.toLocaleString()}</b> new, added as contacts</span></li>
        <li>${icon('user-check')}<span><b>${upd.toLocaleString()}</b> already here, updated. Nothing they have is blanked.</span></li>
        <li>${icon('bell')}<span><b>${opted.toLocaleString()}</b> marked as opted in to action alerts</span></li>
      </ul>
      <p class="meta">Read from the file: ${esc(found.join(', '))}. First rows:</p>
      <ul class="sp-peek">${rows.slice(0, 3).map(r => `<li><b>${esc(r.name || '(no name)')}</b><span>${esc(r.email)}${r.tags.length ? ' · ' + esc(r.tags.join(', ')) : ''}</span></li>`).join('')}</ul></div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn(`Import ${plural(rows.length, 'person', 'people')}`, { icon: 'upload', attrs: { 'data-go': '1' } })}`,
    wire: dlg => {
      dlg.querySelector('[data-no]').onclick = () => closeSheet();
      const go = dlg.querySelector('[data-go]');
      go.onclick = async () => {
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { const r = await DB.importPeople(rows, file.name); closeSheet({ silent: true }); rerender(); toast(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped.`, { ok: true }); }
        catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
    } });
}

// ---- bulk: tag and follow-up (the follow-up sheet is shared with the person page) ----
function tagSheet(ids) {
  if (!ids.length) return;
  const tags = allTags();
  openSheet({ title: `Tag ${plural(ids.length, 'person', 'people')}`, size: 'auto',
    body: `<div class="sp-sheet"><div class="field"><label for="sp-tagin">Tag</label><input id="sp-tagin" autocomplete="off" maxlength="60" placeholder="e.g. volunteer" aria-describedby="sp-tagerr"></div>
      ${tags.length ? `<div class="chips sp-tagpick" role="group" aria-label="Tags in use">${tags.slice(0, 24).map(t => `<button type="button" class="chip" data-tagfill="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>` : ''}
      <div id="sp-tagerr" role="alert"></div></div>`,
    foot: `${btn('Remove tag', { kind: 'secondary', attrs: { 'data-tag': 'rm' } })}${btn('Add tag', { icon: 'tag', attrs: { 'data-tag': 'add' } })}`,
    wire: dlg => {
      const inp = dlg.querySelector('#sp-tagin'); inp.focus();
      dlg.querySelectorAll('[data-tagfill]').forEach(b => b.onclick = () => { inp.value = b.dataset.tagfill; dlg.querySelectorAll('[data-tagfill]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); inp.removeAttribute('aria-invalid'); dlg.querySelector('#sp-tagerr').innerHTML = ''; });
      inp.oninput = () => dlg.querySelectorAll('[data-tagfill]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tagfill === inp.value.trim())));
      const run = async add => {
        const tag = inp.value.trim();
        if (!tag) { dlg.querySelector('#sp-tagerr').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}Type a tag or pick one first.</p>`; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        // Undo touches only the people this changed, so a tag someone already had is never taken away.
        const changed = ids.filter(id => { const has = (personById(id)?.tags || []).includes(tag); return add ? !has : has; });
        dlg.querySelectorAll('[data-tag]').forEach(b => { b.disabled = true; });
        try {
          await DB.bulkTag(ids, tag, add); closeSheet({ silent: true }); hooks.render();
          const msg = add ? `Tagged ${plural(changed.length, 'person', 'people')} “${tag}”.` : `Removed “${tag}” from ${plural(changed.length, 'person', 'people')}.`;
          toast(msg, changed.length ? { ok: true, undo: async () => { await DB.bulkTag(changed, tag, !add); hooks.render(); toast('Undone.'); } } : { ok: true });
        } catch (e) { dlg.querySelectorAll('[data-tag]').forEach(b => { b.disabled = false; }); toast(e, { err: true }); }
      };
      dlg.querySelector('[data-tag="add"]').onclick = () => run(true);
      dlg.querySelector('[data-tag="rm"]').onclick = () => run(false);
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); run(true); } };
    } });
}
export function followupSheet(ids, { onDone } = {}) {
  if (!ids.length) return;
  const single = ids.length === 1 ? personById(ids[0]) : null;
  const who = single ? personName(single) : plural(ids.length, 'person', 'people');
  openSheet({ title: `Follow up with ${esc(who)}`, size: 'auto',
    body: `<div class="sp-sheet"><div class="field"><label for="sp-fw">What to do</label><textarea id="sp-fw" rows="2" maxlength="300" placeholder="e.g. Call before the EDU hearing" aria-describedby="sp-fwerr"></textarea><div id="sp-fwerr" role="alert"></div></div>
      <div class="sp-two"><div class="field"><label for="sp-fd">Due (optional)</label><input id="sp-fd" type="date"></div>
      <div class="field"><label for="sp-fa">Who does it</label><select id="sp-fa">${activeAdvs().map(a => `<option value="${esc(a.id)}"${a.id === S.me?.id ? ' selected' : ''}>${esc(a.id === S.me?.id ? `${firstName(a)} (you)` : firstName(a))}</option>`).join('')}</select></div></div>
      <p class="meta sp-fnote">It shows in Today for whoever does it.</p></div>`,
    foot: btn(single ? 'Add follow-up' : `Add ${ids.length} follow-ups`, { icon: 'calendar-plus', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const w = dlg.querySelector('#sp-fw'), go = dlg.querySelector('[data-go]'); w.focus();
      go.onclick = async () => {
        const what = w.value.trim();
        if (!what) { dlg.querySelector('#sp-fwerr').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}Say what to do first.</p>`; w.setAttribute('aria-invalid', 'true'); w.focus(); return; }
        const advId = dlg.querySelector('#sp-fa').value, due = dlg.querySelector('#sp-fd').value || null, adv = advocate(advId);
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (single) await DB.addFollowup(single.id, advId, what, due); else await DB.bulkFollowup(ids, advId, what, due);
          closeSheet({ silent: true });
          const whose = advId === S.me?.id ? 'your Today' : `${firstName(adv)}’s Today`;
          toast(single ? `Follow-up added. It is in ${whose}.` : `Added ${ids.length} follow-ups. They are in ${whose}.`, { ok: true });
          onDone ? onDone() : hooks.render();
        } catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
    } });
}

// Crossing the desktop breakpoint swaps rows for the table (and back); Esc leaves select mode.
try {
  matchMedia('(min-width: 900px)').addEventListener('change', () => { if (document.body.dataset.screen === 'supporters') hooks.render(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || document.body.dataset.screen !== 'supporters' || document.querySelector('dialog[open]')) return;
    const v = S.spView; if (v && (v.selecting || v.sel.size)) { v.selecting = false; v.sel.clear(); hooks.render(); }
  });
} catch { /* no matchMedia: phone layout only */ }
