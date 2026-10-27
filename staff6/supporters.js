// Outreach > Supporters (plan 3.7): everyone HIPHI knows, what they follow and what they did. The same people, rules
// and calls as the current app's People page (app.js renderPeople / wirePeople), laid out for a phone: one search box,
// saved segments as a chip row, one Filter sheet in four groups, removable filter chips, and a select mode whose bar
// sits where the tab bar was. Desktop (900px and wider) gets a real table in the Bills table's look: a pinned header
// whose columns sort, tags and phone in the row, tick boxes, and the whole row opens the person.
// Privacy: staff see a supporter's island and districts, never a street address. Nothing here reads p.address.
// v3 (R-264): the first of Outreach's two tabs, Supporters · Emails (ui.js sectionNav), at every width. A supporter's
// number is called its score everywhere (the table, the sort, the person's page).
// v4 (R-269): the last of Outreach's four tabs, at #/outreach/supporters; Outreach opens on This week's asks (asks.js).
// v6 (R-336 V31, Saya and Lauren: 199 controls over 5.7 screens, a 52-control filter, 10 clicks to save a group): four
// columns (name, where, tags, last active), 10 rows then Show all; the filter's four common choices first and the rest
// under More filters, with no choice that matches nobody; a results bar with Save as a group and Email these people; Select
// (Tag, Follow up) as a mode; and an admin's Import CSV and Export in plain sight at the foot (F177). "Segments" are
// "groups" on screen (one word per thing); the database and its calls keep their names.
import { S, DB, DEMO, hooks, esc, fmtDate, asDate, advocate, peopleMatch, segmentPeople, personById } from './data.js';
import { ISLANDS, INTERESTS, personName, parsePeopleCSV, exportPeopleCSV, billById, billTag, billSay } from './model.js';
import { icon, btn, iconBtn, chip, empty, skeleton, toast, openSheet, closeSheet, pickerSheet, confirmSheet, switchRow, keysOn, sheetOpen, sectionNav, filterBtn } from './ui.js';
import { pageHead } from './lists.js';
import { nameWords, numWords } from './steps.js';
import { emailDoor } from './composer.js';   // one email rule at every door (V20)
const SCORE_LINE = () => true;   // R-316 W55: live at Nate's go 10/22 (R-332)
import { TITLES, titleLabel } from '../pub/titles.js';   // "They are": the public profile's titles (R-147)

// ---- the filter model (the same shape as people_match() in the database, so a saved segment counts the same here,
// on the Emails page and when the email is sent) ----
export const EMPTY_PF = () => ({ q: '', tags: [], titles: [], interests: [], islands: [], house: [], senate: [], account: 'any', optin: false, bills: [], lists: [], campaigns: [], active_days: 0, acted: false });
// data.js copied peopleMatch() from app.js but not the EMPTY_PF() it calls, so segmentPeople() throws
// "EMPTY_PF is not defined". A name a module cannot resolve falls back to the global object, so this keeps segment
// counts (here and in the composer's audience) working until data.js carries its own copy (requested in the report).
if (typeof globalThis.EMPTY_PF !== 'function') globalThis.EMPTY_PF = EMPTY_PF;
const pfClean = f => { const o = {}; for (const [k, v] of Object.entries(f)) if (Array.isArray(v) ? v.length : v && v !== 'any') o[k] = v; return o; };
const pfEmpty = f => !Object.keys(pfClean(f)).length;
const clone = f => ({ ...EMPTY_PF(), ...JSON.parse(JSON.stringify(f || {})) });
// Order inside a group does not matter (tapping Maui off and on again is not a change to the segment).
const norm = f => { const o = pfClean({ ...EMPTY_PF(), ...f }); for (const k in o) if (Array.isArray(o[k])) o[k] = o[k].map(String).sort(); return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])); };
const nFilters = f => f.islands.length + f.senate.length + f.house.length + f.bills.length + f.lists.length + f.campaigns.length + f.tags.length + (f.titles || []).length + f.interests.length + (f.account !== 'any') + !!f.optin + !!f.active_days + !!f.acted;

// ui.js closes a sheet with history.back(), which lands a moment later. Opening the next sheet (or navigating) before
// it lands lets that Back swallow the new history entry, and the next close then leaves the page. So anything that
// follows a closing sheet waits for that Back first (or 400ms, if there was none).
export function afterSheet(fn) {
  let done = false;
  const go = () => { if (done) return; done = true; window.removeEventListener('popstate', go); clearTimeout(t); fn(); };
  window.addEventListener('popstate', go); const t = setTimeout(go, 400);
}

export const V = () => S.spView ??= { f: EMPTY_PF(), sort: ['active', -1], seg: null, sel: new Set(), selecting: false, limit: 10 };   // V31: 10 rows, then Show all
// One sort for both layouts: the phone's Sort picker and the desktop's column headers set the same v.sort = [key, dir].
// Each key has the direction a first click gives it (names A to Z; numbers and dates biggest or newest first).
const ISLAND_ORDER = Object.fromEntries(ISLANDS.map((x, i) => [x, i]));
// SORT_KEYS and SORTS (the orders a person can pick) are with the table below.
const cmp = (a, b) => Array.isArray(a) ? a.reduce((r, x, i) => r || cmp(x, b[i]), 0) : typeof a === 'string' ? a.localeCompare(b) : a - b;
function sortRows(rows, [k, d]) {
  const get = (SORT_KEYS[k] || SORT_KEYS.active)[1];
  // Someone with nothing to sort by (no district, never active) goes last whichever way the column runs.
  return rows.map(p => [get(p), p]).sort(([a, pa], [b, pb]) => (a == null) - (b == null) || (a == null ? 0 : d * cmp(a, b)) || personName(pa).localeCompare(personName(pb))).map(x => x[1]);
}
const isDesk = () => matchMedia('(min-width: 900px)').matches;
const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const shown = v => { if (!Array.isArray(v.sort)) v.sort = ['active', -1]; return sortRows((S.people || []).filter(p => peopleMatch(p, v.f)), v.sort); };
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
  f.senate.forEach(x => out.push(['senate', x, `Senate district ${x}`]));
  f.house.forEach(x => out.push(['house', x, `House district ${x}`]));
  f.bills.forEach(x => out.push(['bills', x, `Follows ${billById(x) ? nameWords(billById(x), 40) : 'a bill'}`]));
  f.lists.forEach(x => out.push(['lists', x, `Follows the list ${listName(x)}`]));
  f.campaigns.forEach(x => out.push(['campaigns', x, `Follows ${campName(x)}’s bills`]));
  f.tags.forEach(x => out.push(['tags', x, `Tag: ${x}`]));
  (f.titles || []).forEach(x => out.push(['titles', x, `They are: ${titleLabel(x)}`]));
  f.interests.forEach(x => out.push(['interests', x, intLabel(x)]));
  if (f.account !== 'any') out.push(['account', f.account, f.account === 'yes' ? 'Has an account' : 'Contact only']);
  if (f.optin) out.push(['optin', '1', 'Said yes to supporter emails']);
  if (f.active_days) out.push(['active_days', f.active_days, `Active in the last ${f.active_days} days`]);
  if (f.acted) out.push(['acted', '1', 'Took an action']);
  return out;
}
function dropFilter(f, key, val) {
  if (Array.isArray(f[key])) f[key] = f[key].filter(x => String(x) !== String(val));
  else f[key] = EMPTY_PF()[key];
}

// ---- rows (R-336 V31: a name and one line; everything else is on the person's page) ----
// "Oʻahu, Senate 18, House 34": where they are, in words (no district codes in a row, D15).
const whereText = p => [p.island, p.senate_district ? `Senate ${p.senate_district}` : '', p.house_district ? `House ${p.house_district}` : ''].filter(Boolean).join(', ');
// Their email's trouble, said first, only when there is one (status by exception, D3).
const flagText = p => p.bounced_at ? 'Email bounced' : p.unsubscribed_at ? 'Unsubscribed' : '';
// The phone's one line: "Oʻahu, Senate 18 · active 3/16".
function subLine(p) {
  const w = [p.island, p.senate_district ? `Senate ${p.senate_district}` : ''].filter(Boolean).join(', ');
  const bits = [flagText(p), w, p.last_active ? `active ${shortDate(p.last_active)}` : ''].filter(Boolean);
  return bits.join(' · ') || 'No district or activity yet';
}
function phoneRow(p, v) {
  const name = esc(personName(p)), line = `<span class="v6-row-line"><span>${esc(subLine(p))}</span></span>`;
  if (!v.selecting) return `<div class="v6-row sp-r" role="listitem"><a class="v6-row-main" href="#/person/${encodeURIComponent(p.id)}" data-pid="${esc(p.id)}" data-k="p:${esc(p.id)}"><span class="v6-row-top"><span class="v6-row-name">${name}</span></span>${line}</a></div>`;
  const on = v.sel.has(p.id);
  return `<div class="v6-row sp-r${on ? ' sel' : ''}" role="listitem"><button type="button" class="v6-row-main sp-pickrow" data-pick="${esc(p.id)}" data-k="p:${esc(p.id)}" aria-pressed="${on}">
    <span class="v6-row-top"><span class="sp-check" aria-hidden="true">${icon(on ? 'square-check-big' : 'square')}</span><span class="v6-row-name">${name}</span></span>${line}</button></div>`;
}
// ---- the laptop table: four columns (V31: name, where, tags, last active), roomy 64px rows, the whole row opens the
// person. The rest (phone, score, emails, actions, joined) is on their page. The order is chosen with "Sorted by ..." in
// the line over the table (one control, not a button in every header). Select mode adds a tick box column. ----
const COLS = [{ k: 'name', label: 'Name' }, { k: 'where', label: 'Where' }, { k: 'tags', label: 'Tags' }, { k: 'active', label: 'Last active' }];
const SORT_KEYS = {
  name: [1, p => personName(p).toLowerCase()],
  where: [1, p => p.island || p.senate_district || p.house_district ? [ISLAND_ORDER[p.island] ?? 9, p.senate_district || 99, p.house_district || 99] : null],
  score: [-1, p => p.score || 0],
  active: [-1, p => p.last_active || null],
  joined: [-1, p => p.created_at || null],
};
const SORTS = [['active', 'Last active, newest first'], ['score', 'Highest score'], ['joined', 'Newest supporters first'], ['name', 'Name, A to Z'], ['where', 'Island, then district']];
// A phone says the order in a few words, so the count, the order and Select fit one line.
const sortShort = ([k]) => ({ name: 'name', where: 'island', score: 'score', active: 'last active', joined: 'newest' }[k] || 'last active');
const sortWords = ([k]) => ({ name: 'name, A to Z', where: 'island, then district', score: 'highest score', active: 'last active, newest first', joined: 'newest supporters first' }[k] || 'last active, newest first');
const DASH = '<span class="sp-dash" aria-hidden="true">–</span><span class="sr">none</span>';
// "3/16" this year, "11/2/25" for an older date (imports go back years).
const shortDate = d => d ? fmtDate(d, asDate(d).getFullYear() === new Date().getFullYear() ? {} : { year: '2-digit' }) : '';
function deskRow(p, v) {
  const on = v.sel.has(p.id), name = personName(p), w = whereText(p), tags = (p.tags || []).join(', '), flag = flagText(p);
  return `<tr data-row="${esc(p.id)}"${on ? ' class="sel"' : ''}>
    ${v.selecting ? `<td class="c-cb"><label class="sp-cbl"><input type="checkbox" data-sel="${esc(p.id)}" data-k="c:${esc(p.id)}" ${on ? 'checked' : ''} aria-label="Select ${esc(name)}"></label></td>` : ''}
    <td class="c-name"><a class="sp-nm" href="#/person/${encodeURIComponent(p.id)}" data-k="p:${esc(p.id)}">${esc(name)}</a>${flag ? `<span class="sp-flag">${esc(flag)}</span>` : ''}</td>
    <td class="c-where">${w ? esc(w) : DASH}</td>
    <td class="c-tags">${tags ? `<span class="sp-tagt" title="${esc(tags)}">${esc(tags)}</span>` : DASH}</td>
    <td class="c-active">${p.last_active ? esc(shortDate(p.last_active)) : DASH}</td></tr>`;
}

// ---- the results bar (V31): once a filter, a search or a group is on, the count and what to do with these people ----
function barHTML(v, rows) {
  const seg = segOf(v), changed = !!seg && norm(v.f) !== norm(seg.filter), n = rows.length;
  if (pfEmpty(v.f) && !seg) return '';
  const acts = [];
  if (seg && !changed) acts.push(emailDoor({ segment: seg }, { label: 'Email this group' }), btn('Delete group', { kind: 'text', attrs: { 'data-sp': 'segdel', 'aria-haspopup': 'dialog' } }));
  else {
    if (changed) acts.push(btn(`Save changes to “${esc(seg.name)}”`, { kind: 'secondary', icon: 'bookmark-check', attrs: { 'data-sp': 'segupdate' } }));
    acts.push(btn(seg ? 'Save as a new group' : 'Save as a group', { kind: 'secondary', icon: 'bookmark', attrs: { 'data-sp': 'segsave', 'aria-haspopup': 'dialog', ...(n ? {} : { disabled: true }) } }),
      btn('Email these people', { kind: 'secondary', icon: 'mail', attrs: { 'data-sp': 'mailthese', 'aria-haspopup': 'dialog', ...(n ? {} : { disabled: true }) } }));
  }
  // A phone (A-1, the list in the first 400px): the bar is the buttons alone; the count sits in the "Sorted by" line, Clear
  // with the filter chips, and "Everyone" is the groups row's own first chip.
  if (!isDesk()) return `<div class="sp-rbar sp-rbarp"><div class="sp-racts">${acts.join('')}</div></div>`;
  // A group just as saved: the groups row's "Everyone" chip shows everyone again (a text button "Everyone" here repeated it
  // and did not say what it did); with a filter changed, Clear.
  if (!(seg && !changed)) acts.push(btn('Clear', { kind: 'text', attrs: { 'data-sp': 'clear' } }));
  return `<div class="sp-rbar"><p class="sp-rn" aria-live="polite"><b>${barWhat(v, rows)}</b></p><div class="sp-racts">${acts.join('')}</div></div>`;
}
const barWhat = (v, rows) => { const seg = segOf(v), n = rows.length, pristine = !!seg && norm(v.f) === norm(seg.filter);
  return pristine ? `${esc(seg.name)}: ${esc(plural(n, 'person', 'people'))}` : `${esc(plural(n, 'person', 'people'))} ${n === 1 ? 'matches' : 'match'}`; };
// A phone shows the filter chips instead of the groups row while a filter is on (a saved group just as saved keeps the row,
// with its chip pressed): one row, not two.
const groupsHidden = v => { const seg = segOf(v); return !isDesk() && activeChips(v.f).length > 0 && !(seg && norm(v.f) === norm(seg.filter)); };

// The part under the search box: filter chips, the results bar, the people. Re-drawn on its own while typing so the
// search box keeps focus.
function resultsHTML(v) {
  const all = S.people || [], rows = shown(v), seg = segOf(v), desk = isDesk();
  const chips = desk || groupsHidden(v) ? activeChips(v.f) : [];
  const clearAll = !desk && chips.length > 1 ? btn('Clear', { kind: 'text', sm: true, attrs: { 'data-sp': 'clear', 'data-k': 'clear' } }) : '';
  const on = chips.length ? `<div class="sp-active" aria-label="Filters on">${chips.map(([k, val, l]) => `<button type="button" class="chip sp-fchip" data-drop="${esc(k)}" data-val="${esc(val)}" data-k="d:${esc(k)}:${esc(val)}" aria-label="Remove filter: ${esc(l)}">${esc(l)}${icon('x')}</button>`).join('')}${clearAll}</div>` : '';
  const bar = barHTML(v, rows);
  if (!all.length) return `${empty({ title: 'No supporters yet', text: 'Add someone by hand, or an admin imports a list from a CSV file.', action: btn('Add a person', { kind: 'secondary', icon: 'user-plus', attrs: { 'data-sp': 'add' } }) })}`;
  if (!rows.length) return `${on}${bar}${empty({ title: 'Nobody matches', text: 'Try fewer filters or a shorter search.' })}`;
  const page = rows.slice(0, v.limit);
  const more = rows.length > page.length ? `<p class="sp-more">${btn(page.length <= 10 && rows.length <= 500 ? `Show all ${rows.length.toLocaleString()}` : `Show ${Math.min(500, rows.length - page.length)} more`, { kind: 'text', icon: 'chevron-down', attrs: { 'data-sp': 'morerows' } })}<span class="sp-shown">${page.length.toLocaleString()} of ${rows.length.toLocaleString()} shown</span></p>` : '';
  // The order in words, and the one control that changes it; the count when no bar says it (A-14: said once).
  const sortB = `<button type="button" class="linkbtn sp-sortbtn" data-sp="sort" data-k="sort" aria-haspopup="dialog">Sorted by ${esc(desk ? sortWords(v.sort) : sortShort(v.sort))}</button>`;
  // A phone: the count, the order and Select on one line (Add a person waits at the foot of the list).
  const selB = btn(v.selecting ? 'Done' : 'Select', { kind: 'text', sm: true, icon: v.selecting ? 'check' : 'square-check-big', attrs: { 'data-sp': v.selecting ? 'selexit' : 'select', 'data-k': 'select' } });
  const sum = (desk ? `<p class="sp-tsum">${bar ? '' : `<b>${esc(plural(all.length, 'person', 'people'))}</b> · `}${sortB}</p>`
    : `<div class="sp-tsum sp-tsump"><p><b aria-live="polite">${esc(plural(bar ? rows.length : all.length, 'person', 'people'))}</b> · ${sortB}</p>${selB}</div>`)
    + `${SCORE_LINE() && v.sort[0] === 'score' ? '<p class="sp-score">Score: 1 for each bill they follow, 5 for each action (testimony, an email to a chair, a hearing, a share), 2 for each click in our emails and a quarter for each email opened.</p>' : ''}`;
  const selHead = v.selecting ? `<div class="sp-selhead">${rows.every(p => v.sel.has(p.id)) ? btn('Clear the selection', { kind: 'text', sm: true, attrs: { 'data-sp': 'selnone' } }) : btn(`Select all ${rows.length.toLocaleString()}`, { kind: 'text', sm: true, attrs: { 'data-sp': 'selall' } })}</div>` : '';
  if (isDesk()) {
    return `${on}${bar}${sum}${selHead}<div class="sp-twrap"><table class="sp-table${v.selecting ? ' selecting' : ''}"><caption class="sr">Supporters, ${esc(plural(rows.length, 'person', 'people'))}, ${esc(sortWords(v.sort))}. Select a name to open that person.</caption>
      <thead><tr>${v.selecting ? '<th class="c-cb" scope="col"><span class="sr">Selected</span></th>' : ''}${COLS.map(c => `<th scope="col" class="c-${c.k}">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${page.map(p => deskRow(p, v)).join('')}</tbody></table></div>${more}`;
  }
  const add = v.selecting ? '' : `<p class="sp-addp">${btn('Add a person', { kind: 'secondary', icon: 'user-plus', attrs: { 'data-sp': 'add', 'data-k': 'add', 'aria-haspopup': 'dialog' } })}</p>`;
  return `${on}${bar}${sum}${selHead}<div class="v6-list sp-list" role="list" aria-label="Supporters">${page.map(p => phoneRow(p, v)).join('')}</div>${more}${add}`;
}

// The saved groups (v5 called them segments; one word per thing): Everyone first, each with its count.
function groupChips(v) {
  const total = (S.people || []).length, noneOn = !v.seg && pfEmpty(v.f);
  const one = (id, label, n, on) => `<button type="button" class="chip" data-segpick="${esc(id)}" data-k="s:${esc(id)}" aria-pressed="${on}">${on ? icon('check') : ''}${esc(label)}<span class="sp-cn">${n.toLocaleString()}</span></button>`;
  if (groupsHidden(v)) return '';
  // The chips wrap on a phone (spec 12.3: never a sideways row that hides some). With more than four saved groups a phone
  // shows the first three (and the one picked) and an "All groups (N)" chip that opens the rest in place, so the row stays
  // two lines and every group is one press away.
  const segs = S.segments || [], fold = !isDesk() && segs.length > 4 && !v.allGroups;
  const shownSegs = fold ? segs.filter((x, n) => n < 3 || v.seg === x.id) : segs;
  const all = fold ? `<button type="button" class="chip sp-allg" data-sp="allgroups" aria-expanded="false">All groups (${segs.length})${icon('chevron-down')}</button>` : '';
  return `<div class="sp-groups" role="group" aria-labelledby="sp-gl"><span class="sp-gl" id="sp-gl">Groups</span>
    ${one('', 'Everyone', total, noneOn)}${shownSegs.map(x => one(x.id, x.name, segmentPeople(x.id).length, v.seg === x.id)).join('')}${all}</div>`;
}

// ---- the screen ----
export default {
  tab: 'outreach',
  title: () => 'Supporters',
  wide: () => true,
  noTabs: () => !!S.spView?.selecting && !isDesk() && document.body.dataset.screen === 'supporters',
  render(route) {
    const v = V(), nav = sectionNav('outreach', 'supporters');
    if (!S.me?.is_admin) return teamPageHTML(nav);   // R-341: the list is an admin's
    if (!S.peopleLoaded) {
      if (!DEMO && !S.spLoadKick) {
        S.spLoadKick = true;
        DB.loadPeople().then(() => { S.spLoadErr = null; hooks.render(); }).catch(e => { S.spLoadErr = e; S.spLoadKick = false; hooks.render(); });
      }
      return `<div class="le-page sp-page">${pageHead(nav, 'Outreach', '', '')}${S.spLoadErr
        ? empty({ title: 'Supporters did not load', text: 'Check your connection and try again.', action: btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-sp': 'retry' } }) })
        : skeleton(6)}</div>`;
    }
    // #/outreach/supporters?segment=ID opens with that group on (app.js still sends an older #/outreach?segment=ID here)
    if (route.q?.segment && v.fromQ !== route.q.segment) { v.fromQ = route.q.segment; const sg = (S.segments || []).find(x => String(x.id) === route.q.segment); if (sg) { v.seg = sg.id; v.f = clone(sg.filter); } }
    // Select mode is a mode: coming back from another page starts without it (the frame sets data-screen after render).
    if (document.body.dataset.screen !== 'supporters') { v.selecting = false; v.sel.clear(); }
    for (const id of [...v.sel]) if (!personById(id)) v.sel.delete(id);
    const n = nFilters(v.f), admin = !!S.me?.is_admin, rows = shown(v), all = S.people || [];
    const acts = `${btn('Add a person', { kind: 'secondary', icon: 'user-plus', attrs: { 'data-sp': 'add', 'data-k': 'add', 'aria-haspopup': 'dialog' } })}${all.length ? btn(v.selecting ? 'Done' : 'Select', { kind: 'text', icon: v.selecting ? 'check' : 'square-check-big', attrs: { 'data-sp': v.selecting ? 'selexit' : 'select', 'data-k': 'select' } }) : ''}`;
    // F177: import and export are an admin's, in plain sight at the foot (they exist nowhere else; rule 3: no "…" for them).
    const foot = admin ? `<section class="sp-admin" aria-labelledby="sp-admin-h"><h2 class="sp-adminh" id="sp-admin-h">For admins</h2><div class="sp-adminb">
      ${btn('Import CSV', { kind: 'secondary', icon: 'upload', attrs: { 'data-sp': 'import', 'aria-haspopup': 'dialog' } })}
      ${btn(rows.length === all.length ? `Export all ${all.length.toLocaleString()} as CSV` : `Export these ${rows.length.toLocaleString()} as CSV`, { kind: 'secondary', icon: 'download', attrs: { 'data-sp': 'export', ...(rows.length ? {} : { disabled: true }) } })}</div></section>` : '';
    return `<div class="le-page sp-page${isDesk() ? ' sp-desk' : ''}">
      ${pageHead(nav, 'Outreach', '', isDesk() ? acts : '')}
      <div class="sp-find">
        <div class="sp-search" role="search"><label class="sr" for="sp-q">Filter supporters by name, email or phone</label>${icon('search')}
          <input id="sp-q" type="search" placeholder="${isDesk() ? 'Filter by name, email or phone' : 'Filter by name or email'}" value="${esc(v.f.q)}" autocomplete="off" enterkeyhint="search">
          ${iconBtn('x', 'Clear the search', { 'data-sp': 'qclear', hidden: !v.f.q })}</div>
        ${filterBtn(n, { 'data-sp': 'filter', 'data-k': 'filter' })}
      </div>
      ${groupChips(v)}
      <div id="sp-results">${resultsHTML(v)}</div>
      ${foot}${rollHTML()}
      <input type="file" id="sp-file" accept=".csv,text/csv" hidden>
    </div>`;
  },
  // Select mode's bar, the same on phones and laptops and the same as Bills: x on the left, the count, the actions on
  // the right (F175: Tag, Follow up).
  bar() {
    const v = S.spView;
    if (!v || !v.selecting) return '';
    const n = v.sel.size;
    return `<div class="sp-bar${n > 9 ? ' sp-many' : ''}" role="toolbar" aria-label="Change the selected people">
      ${iconBtn('x', 'Stop selecting', { 'data-sp': 'selexit' })}
      <span class="sp-selcount" aria-live="polite"><b>${n.toLocaleString()}</b><span class="sp-selw"> selected</span></span>
      <span class="sp-baract">${btn('Tag', { kind: 'secondary', icon: 'tag', attrs: { 'data-sp': 'tag', disabled: !n } })}${btn('Follow up', { kind: 'secondary', icon: 'calendar-plus', attrs: { 'data-sp': 'fup', disabled: !n } })}</span>
    </div>`;
  },
  wire(route, root) {
    const v = V(), page = root.querySelector('.sp-page');
    if (!page) return;
    const on = (sel, fn) => root.querySelectorAll(sel).forEach(el => { el.onclick = e => fn(el, e); });
    on('[data-sp="retry"]', () => { S.spLoadErr = null; hooks.render(); });
    if (!S.me?.is_admin) { on('[data-sp="add"]', () => addPersonSheet()); const roll = page.querySelector('.sp-roll'); if (roll) roll.ontoggle = () => { S.spRollOpen = roll.open; }; return; }
    if (!S.peopleLoaded) return;
    const roll = page.querySelector('.sp-roll'); if (roll) roll.ontoggle = () => { S.spRollOpen = roll.open; };
    const q = page.querySelector('#sp-q'), qx = page.querySelector('[data-sp="qclear"]');
    q.oninput = () => {
      v.f.q = q.value; qx.hidden = !q.value;
      clearTimeout(v.qT); v.qT = setTimeout(() => { v.limit = 10; drawResults(root); }, 150);
    };
    q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); q.blur(); } };
    qx.onclick = () => { v.f.q = ''; q.value = ''; qx.hidden = true; drawResults(root); q.focus(); };
    on('[data-sp="filter"]', () => filterSheet());
    on('.sp-page [data-sp="add"]', () => addPersonSheet());
    on('[data-sp="select"]', () => { startSelect(); rerender('select'); });
    on('[data-sp="import"]', () => importSheet());
    on('[data-sp="export"]', () => { const rows = shown(v); if (!rows.length) return; exportPeopleCSV(rows); toast(`Downloading ${plural(rows.length, 'person', 'people')} as a CSV file.`); });
    on('[data-sp="allgroups"]', () => { v.allGroups = true; rerender('s:' + ((S.segments || [])[3]?.id ?? '')); });
    on('[data-segpick]', el => {
      const id = el.dataset.segpick, sg = (S.segments || []).find(x => String(x.id) === id);
      if (!sg || v.seg === sg.id) { v.seg = null; v.f = { ...EMPTY_PF(), q: '' }; }
      else { v.seg = sg.id; v.f = clone(sg.filter); }
      v.limit = 10; rerender(el.dataset.k);
    });
    // select mode bar (outside main, so looked up on the whole frame)
    on('[data-sp="selexit"]', () => stopSelect());
    on('[data-sp="tag"]', () => tagSheet([...v.sel]));
    on('[data-sp="fup"]', () => followupSheet([...v.sel], { onDone: () => stopSelect() }));
    wireResults(root);
    ioArrive(route, page);
    const file = page.querySelector('#sp-file');
    file.onchange = async () => {
      const f = file.files[0]; file.value = ''; if (!f) return;
      let text = ''; try { text = await f.text(); } catch { text = ''; }
      if (!text.trim()) { toast(`${f.name} is empty, or this browser could not read it.`, { err: true }); return; }
      reviewSheet(text, f.name);
    };
  },
};

// R-341 (Nate 10/26): supporters' names, emails, phones and histories are for admins. Everyone else on the team gets this
// page: what they can still do (add someone from a sign-up sheet, email a saved group, see how many), and who to ask for
// the rest. The database gives them no list either (migration 190), so this page is the whole of it, not a curtain.
const AUD = () => S.spAud ??= {};
function groupCount(sg) {
  const a = AUD(); if (a[sg.id] === undefined) { a[sg.id] = null; DB.alertAudience(null, null, sg.id).then(n => { a[sg.id] = n; if (S.route?.name === 'supporters') hooks.render(); }).catch(() => { a[sg.id] = -1; }); }
  const n = a[sg.id]; return n == null || n < 0 ? 'A saved group of supporters' : `${n.toLocaleString()} ${n === 1 ? 'person says' : 'people say'} yes to supporter emails`;
}
function teamPageHTML(nav) {
  const admins = (S.advocates || []).filter(a => a.is_admin && a.is_active !== false).map(a => a.full_name.split(' ')[0]);
  const who = admins.length ? admins.length === 1 ? admins[0] : `${admins.slice(0, -1).join(', ')} or ${admins[admins.length - 1]}` : 'an admin';
  const segs = S.segments || [];
  const groups = segs.length ? `<section class="sp-tgroups" aria-labelledby="sp-tg-h"><h2 class="sp-th" id="sp-tg-h">Email a saved group</h2>
      <ul class="sp-tglist">${segs.map(sg => `<li><span class="sp-tgname">${icon('users')}<span><b>${esc(sg.name)}</b><span class="meta">${esc(groupCount(sg))}</span></span></span>${emailDoor({ segment: sg }, { sm: true, label: 'Write an email' })}</li>`).join('')}</ul>
      <p class="meta">An approver reads it before it goes out.</p></section>` : '';
  return `<div class="le-page sp-page sp-team">${pageHead(nav, 'Outreach', '', '')}
    <section class="sp-tlock">${icon('lock')}<div><h2 class="sp-th">The supporter list is for admins</h2>
      <p>Supporters’ names, emails, phone numbers and histories stay with admins, so fewer people hold them. Ask ${esc(who)} when you need to reach someone.</p></div></section>
    <section class="sp-tadd"><div><h2 class="sp-th">Met someone who wants to help?</h2><p>Add them here. They get supporter emails only if they say yes.</p></div>
      ${btn('Add a person', { icon: 'user-plus', attrs: { 'data-sp': 'add', 'aria-haspopup': 'dialog' } })}</section>
    ${groups}${rollHTML()}
  </div>`;
}

// More tools' "Supporters' groups, import and export" opens #/outreach/supporters?io=1: the admin foot (Import CSV, Export)
// brought into view and its first button focused, once per arrival, so the row keeps its promise without a scroll (C-6). It
// does nothing a second time for the same address (a redraw leaves the page where it is). The one place this is done.
let ioSeen = '';
function ioArrive(route, page) {
  if (!route?.q?.io) { ioSeen = ''; return; }
  if (!S.me?.is_admin || ioSeen === location.hash) return;
  const sec = page.querySelector('.sp-admin'); if (!sec) return;
  ioSeen = location.hash; S.scrollClaimed = true;
  requestAnimationFrame(() => { const s = document.querySelector('main .sp-admin') || sec; if (!s.isConnected) return;
    s.scrollIntoView({ block: 'center' }); s.querySelector('button:not([disabled])')?.focus({ preventScroll: true }); });
}

// What supporters say about themselves (R-156 E1, E2), folded at the foot: how many gave titles, a story, and said HIPHI
// may quote them; the list titles by use; and the titles people wrote themselves, so the common ones join the list before
// each session (pub/titles.js). Counts and title words only, never a story's text. Reference, so it waits to be opened.
function rollHTML() {
  const r = S.spRoll;
  if (!r) { if (!S.spRollKick) { S.spRollKick = true; DB.profileRollup().then(x => { S.spRoll = x; hooks.render(); }).catch(() => { S.spRollKick = false; }); } return ''; }
  if (!r.with_titles && !r.with_story) return '';
  const li = (label, n) => `<li><span>${label}</span><b>${n.toLocaleString()}</b></li>`;
  return `<details class="sp-roll"${S.spRollOpen ? ' open' : ''}><summary>${icon('user-round')}<span>What supporters say about themselves: <b>${r.with_titles.toLocaleString()}</b> gave a title · <b>${r.with_story.toLocaleString()}</b> shared a story</span>${icon('chevron-down', { cls: 'sp-roll-chev' })}</summary>
    <div class="sp-roll-b">
      <p class="sp-rollq">${r.quote.toLocaleString()} said HIPHI may quote them, after asking again.</p>
      ${(r.list || []).length ? `<div><h3>Titles from the list</h3><ol class="sp-roll-l">${r.list.slice(0, 12).map(x => li(esc(titleLabel(x.k) || x.k), x.n)).join('')}</ol></div>` : ''}
      <div><h3>Titles people wrote themselves</h3>${(r.own || []).length ? `<ol class="sp-roll-l">${r.own.slice(0, 20).map(x => li(`“${esc(x.t)}”`, x.n)).join('')}</ol>` : '<p class="meta">None yet.</p>'}
        <p class="meta">Before each session, a title 10 or more people wrote can join the list that everyone picks from. Tell Nate which.</p></div>
    </div></details>`;
}
function drawResults(root) {
  const box = root.querySelector('#sp-results'); if (!box) return;
  box.innerHTML = resultsHTML(V()); wireResults(root);
  const n = nFilters(V().f), fb = root.querySelector('[data-sp="filter"]'); if (fb) fb.outerHTML = filterBtn(n, { 'data-sp': 'filter', 'data-k': 'filter' });
  root.querySelector('[data-sp="filter"]')?.addEventListener('click', () => filterSheet());
}
// Re-draw the whole frame (the bar and the tab bar change with selection) and put focus back where it was.
function rerender(key) {
  const y = window.scrollY; hooks.render(); window.scrollTo(0, y);
  if (key) document.querySelector(`#app [data-k="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}
// Select mode on a phone is a place you can go Back from (assessment 9/19: Back left the page with the mode still on).
// Starting it adds a history entry, the way a sheet does; the phone's Back, the x and Esc all end it the same way.
let inSelEntry = false;
function startSelect(id) {
  const v = V(); v.selecting = true; if (id) v.sel.add(id);
  if (!isDesk() && !history.state?.spSel) { history.pushState({ ...(history.state || {}), spSel: true }, ''); inSelEntry = true; }
}
function stopSelect() {
  const v = V(); v.selecting = false; v.sel.clear(); lastBox = null;
  if (inSelEntry && history.state?.spSel) history.back(); else { inSelEntry = false; hooks.render(); }   // the Back lands in the listener below
}
// This file loads before the frame, so this runs before the frame's own popstate handler: leaving the select entry
// ends the mode and redraws here (the address has not changed), and the frame is not asked to scroll anywhere.
window.addEventListener('popstate', e => {
  if (!inSelEntry || e.state?.spSel || sheetOpen()) return;
  inSelEntry = false; e.stopImmediatePropagation();
  const v = S.spView; if (v) { v.selecting = false; v.sel.clear(); }
  if (S.route?.name === 'supporters') hooks.render();
});
let suppressUntil = 0;   // a long press ends in a click on the row that just turned into a checkbox; ignore it
let lastBox = null;      // the last tick box clicked in the laptop table, for Shift+click runs
function wireResults(root) {
  const v = V(), box = root.querySelector('#sp-results'); if (!box) return;
  const on = (sel, fn) => box.querySelectorAll(sel).forEach(el => { el.onclick = e => fn(el, e); });
  on('[data-sp="clear"]', () => { v.f = { ...EMPTY_PF() }; v.seg = null; v.limit = 10; rerender('filter'); });
  on('[data-drop]', el => { dropFilter(v.f, el.dataset.drop, el.dataset.val); v.limit = 10; rerender('filter'); });
  on('[data-sp="segupdate"]', () => saveSegmentChanges());
  on('[data-sp="segsave"]', () => saveSegmentSheet());
  on('[data-sp="mailthese"]', () => emailThese());
  on('[data-sp="segdel"]', () => { const sg = segOf(v); if (sg) deleteSegment(sg); });
  on('[data-sp="add"]', () => addPersonSheet());
  on('[data-sp="select"]', () => { startSelect(); rerender('select'); });   // a phone's Select sits in the results' count line
  on('[data-sp="selexit"]', () => stopSelect());
  on('[data-sp="morerows"]', () => { v.limit = v.limit <= 10 ? 500 : v.limit + 500; drawResults(root); });
  on('[data-sp="sort"]', () => pickerSheet({ title: 'Sort supporters', value: v.sort[0], options: SORTS.map(([k, l]) => [k, l]), onPick: val => { v.sort = [val, SORT_KEYS[val][0]]; v.limit = 10; hooks.render(); toast(`Sorted by ${sortWords(v.sort)}.`); } }));
  on('[data-sp="selall"]', () => { for (const p of shown(v)) v.sel.add(p.id); rerender('p:' + ([...v.sel][0] || '')); });
  on('[data-sp="selnone"]', () => { v.sel.clear(); hooks.render(); });
  on('[data-pick]', el => {
    if (Date.now() < suppressUntil) return;
    const id = el.dataset.pick; v.sel.has(id) ? v.sel.delete(id) : v.sel.add(id); rerender(el.dataset.k);
  });
  // Rows drawn after the first paint (a search, "Show all") are not wired by the frame, so their links are routed here
  // the same way: through S.go, so Back returns to this list where it was.
  box.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); S.go(a.getAttribute('href'));
  }));
  // Laptop table: the whole row opens the person, unless the click was on a control or ended a text selection; in
  // select mode the tick box selects, and Shift+click ticks the run from the last box, as in Bills.
  box.querySelectorAll('tr[data-row]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.closest('a, input, label, button') || getSelection()?.toString()) return;
    if (v.selecting) { const cb = tr.querySelector('[data-sel]'); cb?.click(); return; }
    if (e.metaKey || e.ctrlKey) { window.open('#/person/' + encodeURIComponent(tr.dataset.row), '_blank', 'noopener'); return; }
    S.go('#/person/' + encodeURIComponent(tr.dataset.row));
  }));
  const boxes = [...box.querySelectorAll('[data-sel]')];
  boxes.forEach((cb, i) => cb.onclick = e => {
    const to = cb.checked, a = e.shiftKey && lastBox != null && lastBox < boxes.length ? Math.min(lastBox, i) : i, z = e.shiftKey && lastBox != null && lastBox < boxes.length ? Math.max(lastBox, i) : i;
    for (let j = a; j <= z; j++) to ? v.sel.add(boxes[j].dataset.sel) : v.sel.delete(boxes[j].dataset.sel);
    lastBox = i; rerender(cb.dataset.k);
  });
  // Long press on a phone row starts select mode with that person picked ("Select" in the head does too).
  const list = box.querySelector('.sp-list');
  if (list && !v.selecting) {
    let t = 0, sx = 0, sy = 0;
    const stop = () => clearTimeout(t);
    list.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const r = e.target.closest('[data-pid]'); if (!r) return;
      sx = e.clientX; sy = e.clientY; stop();
      t = setTimeout(() => { suppressUntil = Date.now() + 800; startSelect(r.dataset.pid); try { navigator.vibrate?.(12); } catch { /* not supported */ } rerender('p:' + r.dataset.pid); }, 500);
    });
    list.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) stop(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => list.addEventListener(k, stop));
    list.addEventListener('click', e => { if (Date.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); } }, true);
    list.addEventListener('contextmenu', e => { if (e.target.closest('[data-pid]')) e.preventDefault(); });
  }
}

// "Email these people": an email goes to a saved group (the server counts and sends to it), so people who are not one yet
// are saved as one first, in the same sheet, and the composer opens on it.
function emailThese() {
  const v = V(), seg = segOf(v);
  if (seg && norm(v.f) === norm(seg.filter)) { S.go('#/email/new?segment=' + encodeURIComponent(seg.id)); return; }
  saveSegmentSheet({ then: sg => S.go('#/email/new?segment=' + encodeURIComponent(sg.id)) });
}

// ---- the Filter sheet: the four common choices first (V31: island, follows, tag, said yes to supporter emails), the
// rest under More filters; a choice that matches nobody is not offered; pick in one go, see the count, Show N people ----
function filterSheet() {
  const v = V(), all = S.people || [];
  let d = clone(v.f), billQ = '', moreOpen = !!S.spMoreF;
  const tags = allTags();
  const sds = [...new Set(all.map(p => p.senate_district).filter(Boolean))].sort((a, b) => a - b);
  const hds = [...new Set(all.map(p => p.house_district).filter(Boolean))].sort((a, b) => a - b);
  // Counts for one group: everyone who passes every other group, split by this group's options. Which groups each
  // person fails is worked out once per redraw with peopleMatch() one group at a time (the rules are a plain AND of
  // groups, so this is the same answer), so the counts stay quick with thousands of people.
  let fails = [];
  const recount = () => { const keys = Object.keys(pfClean(d)); fails = all.map(p => keys.filter(k => !peopleMatch(p, { [k]: d[k] }))); };
  const base = key => all.filter((p, i) => fails[i].every(k => k === key));
  const tally = (key, test) => { const b = base(key); return val => b.filter(p => test(p, val)).length; };
  // A chip per option with its count; an option nobody matches is left out unless it is on (V31).
  const multi = (key, opts, count) => opts.map(([val, label]) => {
    const onNow = d[key].map(String).includes(String(val)), n = count(val);
    return !onNow && !n ? '' : `<button type="button" class="chip" data-fk="${key}" data-fv="${esc(val)}" data-k="f:${key}:${esc(val)}" aria-pressed="${onNow}">${onNow ? icon('check') : ''}${esc(label)}<span class="sp-cn">${n}</span></button>`;
  }).join('');
  const one = (key, opts, count) => opts.map(([val, label]) => {
    const onNow = String(d[key]) === String(val), n = count ? count(val) : null;
    return !onNow && n === 0 ? '' : `<button type="button" class="chip" data-f1="${key}" data-fv="${esc(val)}" data-k="f:${key}:${esc(val)}" aria-pressed="${onNow}">${onNow ? icon('check') : ''}${esc(label)}${n === null ? '' : `<span class="sp-cn">${n}</span>`}</button>`;
  }).join('');
  // One <select> for a group with many options: "Any", then each option with its count (none with 0). More than one on
  // (from an older group) shows as one option that keeps them.
  const pick = (id, label, cur, opts, keepLabel) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-fpick="${id}" data-k="f:${id}">
      <option value="">Any</option>${cur.length > 1 ? `<option value="__keep" selected>${esc(keepLabel)}</option>` : ''}
      ${opts.map(([val, l, n, onNow]) => `<option value="${esc(val)}"${cur.length === 1 && onNow ? ' selected' : ''}>${esc(l)} (${n})</option>`).join('')}</select></div>`;
  const sel = (key, label, opts, prefix) => {
    const cur = d[key].map(Number), c = tally(key, (p, val) => p[key === 'senate' ? 'senate_district' : 'house_district'] === val);
    return `<div class="field"><label for="sp-f-${key}">${label}</label><select id="sp-f-${key}" data-fsel="${key}" data-k="f:${key}">
      <option value="">Any</option>${cur.length > 1 ? `<option value="__keep" selected>${esc(cur.map(x => prefix + ' ' + x).join(', '))}</option>` : ''}
      ${opts.filter(x => c(x) || cur.includes(x)).map(x => `<option value="${x}"${cur.length === 1 && cur[0] === x ? ' selected' : ''}>${prefix} ${x} (${c(x)})</option>`).join('')}</select></div>`;
  };
  const billSug = () => {
    const qq = billQ.trim().toUpperCase().replace(/\s+/g, ''); if (!qq) return '';
    const words = /\d/.test(qq) ? null : billQ.trim().toLowerCase();
    const hits = S.bills.filter(b => b.is_public && !d.bills.includes(b.id) && (words ? words.length >= 3 && (b.public_summary || b.description || b.title || '').toLowerCase().includes(words) : b.bill_number.includes(qq))).slice(0, 6);
    return hits.length ? hits.map(b => `<button type="button" class="sp-sug" data-addbill="${esc(b.id)}"><b>${esc(nameWords(b, 1e4))}</b> ${esc(numWords(b))}</button>`).join('')
      : `<p class="meta sp-sugnone">No public bill matches “${esc(billQ.trim())}”. Supporters can follow only public bills.</p>`;
  };
  const moreN = () => d.senate.length + d.house.length + d.bills.length + (d.titles || []).length + d.interests.length + (d.account !== 'any') + !!d.active_days + !!d.acted;
  const body = () => {
    const isl = tally('islands', (p, x) => p.island === x), lst = tally('lists', (p, x) => (p.list_ids || []).includes(x)),
      cmp = tally('campaigns', (p, x) => (p.bill_ids || []).some(id => (S.billCampaigns[id] || []).includes(x))),
      tg = tally('tags', (p, x) => (p.tags || []).includes(x)), it = tally('interests', (p, x) => (p.interests || []).includes(x)),
      ti = tally('titles', (p, x) => (p.titles || []).includes(x)), had = TITLES.filter(t => (S.people || []).some(p => (p.titles || []).includes(t.k))),
      ac = tally('account', (p, x) => x === 'any' || (x === 'yes') === !!p.has_account),
      act = tally('active_days', (p, x) => !+x || (p.last_active && Date.now() - new Date(p.last_active) < +x * 864e5)),
      opt = base('optin').filter(p => peopleMatch(p, { optin: true })).length;
    // Follows: a coalition's bills or a list, in one choice (the common question is "who follows CTFH's bills?").
    const fol = [...(S.campaigns || []).map(c => [`c:${c.id}`, `${c.name}’s bills`, cmp(c.id), d.campaigns.includes(c.id)]), ...(S.lists || []).map(l => [`l:${l.id}`, `The list ${l.title}`, lst(l.id), d.lists.includes(l.id)])].filter(o => o[2] || o[3]);
    const tagOpts = tags.map(t => [t, t, tg(t), d.tags.includes(t)]).filter(o => o[2] || o[3]);
    return `<div class="sp-sheet sp-filter">
      <fieldset><legend>Island</legend><div class="chips">${multi('islands', ISLANDS.map(x => [x, x]), isl) || '<p class="meta">Nobody here has an island yet.</p>'}</div></fieldset>
      ${pick('sp-f-fol', 'Follows', [...d.campaigns, ...d.lists], fol, 'Several')}
      ${tagOpts.length ? pick('sp-f-tag', 'Tag', d.tags, tagOpts, d.tags.join(', ')) : ''}
      ${switchRow('sp-f-optin', `Said yes to supporter emails <span class="sp-cn">${opt}</span>`, d.optin, 'Only people a supporter email can reach', { 'data-fsw': 'optin', 'data-k': 'f:optin' })}
      <details class="sp-moref"${moreOpen ? ' open' : ''}><summary data-k="f:more">${icon('chevron-down', { cls: 'sp-mfchev' })}<span>More filters${moreN() ? ` <span class="sp-cn">${moreN()} on</span>` : ''}</span></summary>
        <div class="sp-mfb">
          <div class="sp-two">${sel('senate', 'Senate district', sds, 'Senate')}${sel('house', 'House district', hds, 'House')}</div>
          <div class="field sp-billpick"><label for="sp-f-bill">Follows a bill</label>
            <div class="chips">${d.bills.map(id => `<button type="button" class="chip" aria-pressed="true" data-fk="bills" data-fv="${esc(id)}" data-k="f:bills:${esc(id)}" aria-label="Remove ${esc(billById(id) ? nameWords(billById(id), 60) : 'bill')}">${esc(billById(id) ? nameWords(billById(id), 40) : 'A bill')}${icon('x')}</button>`).join('')}</div>
            <input id="sp-f-bill" type="search" placeholder="Type a number, like HB 1563" value="${esc(billQ)}" autocomplete="off" data-k="f:billq">
            <div class="sp-sugs" id="sp-f-sugs">${billSug()}</div></div>
          ${had.length ? `<fieldset><legend>They are</legend><div class="chips">${multi('titles', had.map(t => [t.k, t.label]), ti)}</div></fieldset>` : ''}
          <fieldset><legend>Interests</legend><div class="chips">${multi('interests', INTERESTS, it) || '<p class="meta">None noted on anyone here.</p>'}</div></fieldset>
          <fieldset><legend>Account</legend><div class="chips">${one('account', [['any', 'Anyone'], ['yes', 'Has an account'], ['no', 'Contact only']], ac)}</div></fieldset>
          <fieldset><legend>Last active</legend><div class="chips">${one('active_days', [[0, 'Any time'], [7, '7 days'], [30, '30 days'], [90, '90 days']], act)}</div></fieldset>
          ${switchRow('sp-f-acted', 'Took an action', d.acted, 'Testified, emailed a chair, went to a hearing or shared', { 'data-fsw': 'acted', 'data-k': 'f:acted' })}
        </div></details>
    </div>`;
  };
  const count = () => fails.filter(f => !f.length).length;
  const foot = () => { const n = count(); return `${nFilters(d) ? btn('Clear all', { kind: 'text', attrs: { 'data-fx': 'clear' } }) : ''}${btn(n ? `Show ${plural(n, 'person', 'people')}` : 'Nobody matches', { attrs: { 'data-fx': 'apply', disabled: !n } })}`; };
  recount();
  // A laptop with a mouse: a panel under the Filter button (ui.js anchors it), like the Bills filter, so the list stays
  // in view beside it. Phones and touch tablets get the full sheet.
  openSheet({ title: 'Filter supporters', size: isDesk() ? 'auto sp-fpop' : 'full', pop: true, body: body(), foot: foot(), wire: dlg => {
    const bodyEl = dlg.querySelector('.sv-sh-body'), footEl = dlg.querySelector('.sv-sh-foot');
    const redraw = key => {
      moreOpen = !!dlg.querySelector('.sp-moref')?.open;
      recount(); const y = bodyEl.scrollTop; bodyEl.innerHTML = body(); footEl.innerHTML = foot(); bodyEl.scrollTop = y;
      if (key) dlg.querySelector(`[data-k="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    };
    dlg.addEventListener('toggle', e => { if (e.target.matches?.('.sp-moref')) S.spMoreF = moreOpen = e.target.open; }, true);
    dlg.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t || !dlg.contains(t)) return;
      if (t.dataset.fk) { const k = t.dataset.fk, val = t.dataset.fv; const has = d[k].map(String).includes(String(val)); d[k] = has ? d[k].filter(x => String(x) !== String(val)) : [...d[k], val]; redraw(has && k === 'bills' ? 'f:billq' : t.dataset.k); }
      else if (t.dataset.f1) { const k = t.dataset.f1; d[k] = k === 'active_days' ? +t.dataset.fv : t.dataset.fv; redraw(t.dataset.k); }
      else if (t.dataset.addbill) { d.bills = [...d.bills, t.dataset.addbill]; billQ = ''; redraw('f:billq'); }
      else if (t.dataset.fx === 'clear') { d = { ...EMPTY_PF(), q: d.q }; billQ = ''; redraw(); }
      else if (t.dataset.fx === 'apply') { v.f = d; if (v.seg && !segOf(v)) v.seg = null; v.limit = 10; closeSheet({ silent: true }); rerender('filter'); }
    });
    dlg.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.fsel && t.value !== '__keep') { d[t.dataset.fsel] = t.value ? [Number(t.value)] : []; redraw(t.dataset.k); }
      else if (t.dataset.fpick === 'sp-f-fol' && t.value !== '__keep') { const [k, id] = [t.value.slice(0, 1), t.value.slice(2)]; d.campaigns = k === 'c' ? [id] : []; d.lists = k === 'l' ? [id] : []; redraw(t.dataset.k); }
      else if (t.dataset.fpick === 'sp-f-tag' && t.value !== '__keep') { d.tags = t.value ? [t.value] : []; redraw(t.dataset.k); }
      else if (t.dataset.fsw) { d[t.dataset.fsw] = t.checked; redraw(t.dataset.k); }
    });
    dlg.addEventListener('input', e => {
      if (e.target.id !== 'sp-f-bill') return;
      billQ = e.target.value; dlg.querySelector('#sp-f-sugs').innerHTML = billSug();
    });
    dlg.addEventListener('keydown', e => {
      if (e.target.id === 'sp-f-bill' && e.key === 'Enter') { e.preventDefault(); const f = dlg.querySelector('[data-addbill]'); if (f) f.click(); }
    });
  } });
}

// ---- groups (saved filters; the database calls them segments) ----
function saveSegmentSheet({ then } = {}) {
  const v = V(), n = shown(v).length;
  openSheet({ title: then ? 'Save these people as a group' : 'Save as a group', size: 'auto',
    body: `<div class="sp-sheet">${then ? '<p class="sp-segwhy">An email goes to a saved group, so these people become one first.</p>' : ''}<div class="field"><label for="sp-segname">Name of the group</label><input id="sp-segname" maxlength="80" autocomplete="off" placeholder="e.g. Maui parents" aria-describedby="sp-seghelp sp-segerr"><span class="help" id="sp-seghelp">Everyone on the team sees it here and in Emails.</span></div><div id="sp-segerr" role="alert"></div>
      <p class="meta sp-segsum">${esc(plural(n, 'person', 'people'))} match right now. The group updates itself as people change.</p></div>`,
    foot: btn(then ? 'Save group and write the email' : 'Save group', { icon: then ? 'mail' : 'bookmark', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const inp = dlg.querySelector('#sp-segname'), go = dlg.querySelector('[data-go]'); inp.focus();
      const save = async () => {
        const name = inp.value.trim();
        if (name.length < 2) { dlg.querySelector('#sp-segerr').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}Give it a name first.</p>`; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          const sg = await DB.saveSegment({ name, filter: pfClean(v.f) }); v.seg = sg.id; closeSheet({ silent: true });
          if (then) { afterSheet(() => { then(sg); toast(`Saved the group “${name}”. Write the email to it here.`, { ok: true }); }); return; }
          rerender(); toast(`Saved “${name}”. It is in Groups here and in Emails.`, { ok: true });
        } catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
      go.onclick = save; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } };
    } });
}
async function saveSegmentChanges() {
  const v = V(), sg = segOf(v); if (!sg) return;
  const before = sg.filter;
  try {
    await DB.saveSegment({ id: sg.id, name: sg.name, filter: pfClean(v.f) }); rerender();
    toast(`Saved the changes to “${sg.name}”.`, { ok: true, undo: async () => { await DB.saveSegment({ id: sg.id, name: sg.name, filter: before }); v.f = clone(before); hooks.render(); toast('The group is back as it was.'); } });
  } catch (e) { toast(e, { err: true }); }
}
async function deleteSegment(sg) {
  const ok = await confirmSheet({ title: `Delete the group “${esc(sg.name)}”?`, text: 'The people stay. Only this saved group goes, here and in Emails.', ok: 'Delete group', danger: true });
  if (!ok) return;
  try { await DB.deleteSegment(sg.id); const v = V(); v.seg = null; v.f = EMPTY_PF(); rerender(); toast(`Deleted the group “${sg.name}”.`); }
  catch (e) { toast(e, { err: true }); }
}
// ---- add, import ----
function addPersonSheet() {
  openSheet({ title: 'Add a person', size: 'auto',
    body: `<div class="sp-sheet"><div class="field"><label for="sp-ae">Email</label><input id="sp-ae" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200" aria-describedby="sp-aerr"></div>
      <div class="field"><label for="sp-an">Name (optional)</label><input id="sp-an" autocomplete="off" maxlength="120"></div>
      <div id="sp-aerr" role="alert"></div><p class="meta sp-addnote">They are added as a contact. They get supporter emails only if they say yes.</p></div>`,
    foot: btn('Add person', { icon: 'user-plus', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const em = dlg.querySelector('#sp-ae'), nm = dlg.querySelector('#sp-an'), go = dlg.querySelector('[data-go]'); em.focus();
      const err = m => { dlg.querySelector('#sp-aerr').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; em.toggleAttribute('aria-invalid', !!m); };
      const save = async () => {
        const e = em.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { err('Enter an email address, like name@example.com.'); em.focus(); return; }
        if (!S.me?.is_admin) {
          go.setAttribute('aria-busy', 'true'); go.disabled = true;
          try { const r = await DB.addPerson({ email: e, name: nm.value.trim() || null }); closeSheet({ silent: true });
            afterSheet(() => toast(r.added ? `Added ${nm.value.trim() || e}. An admin can see them in Supporters.` : `${e} is already in Supporters.`, { ok: r.added })); }
          catch (x) { go.removeAttribute('aria-busy'); go.disabled = false; toast(x, { err: true }); }
          return;
        }
        const ex = (S.people || []).find(p => (p.email || '').toLowerCase() === e);
        if (ex) { closeSheet({ silent: true }); afterSheet(() => { S.go('#/person/' + encodeURIComponent(ex.id)); toast(`${personName(ex)} is already in Supporters.`); }); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { const p = await DB.addPerson({ email: e, name: nm.value.trim() || null, tags: [], interests: [] }); closeSheet({ silent: true }); afterSheet(() => { S.go('#/person/' + encodeURIComponent(p.id)); toast(`Added ${personName(p)}.`, { ok: true }); }); }
        catch (x) { go.removeAttribute('aria-busy'); go.disabled = false; toast(x, { err: true }); }
      };
      go.onclick = save; [em, nm].forEach(i => i.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
    } });
}
// ---- import: a file or pasted text, a preview, then the numbers ----
// The fields are read by parsePeopleCSV() in model.js, the one parser both staff apps share; nothing here picks a
// column apart. To be able to say WHICH row was left out, the text is first cut into records the same way the parser
// does (a newline inside quotes is not a row break) and each record is handed to that parser with the header in
// front of it. Row numbers are the line numbers of the file, so they match what Nate sees in a spreadsheet.
function csvRecords(text) {
  const out = []; let cur = '', q = false, line = 1, start = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { q = !q; cur += c; continue; }
    if (!q && (c === '\n' || c === '\r')) { if (c === '\r' && text[i + 1] === '\n') i++; out.push({ line: start, text: cur }); line++; start = line; cur = ''; continue; }
    if (c === '\n') line++;                        // a wrapped line inside quotes still counts in the file
    cur += c;
  }
  if (cur.trim()) out.push({ line: start, text: cur });
  return out;
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;     // the same test the import does before it writes a row
// What the file will do, row by row. Nothing from a row is ever shown back except the name, the email and the tags:
// a list can carry a street address, and staff never see one.
function reviewCSV(text) {
  const recs = csvRecords(text.replace(/^﻿/, ''));
  const head = recs.shift() || { text: '', line: 1 };
  const cols = parsePeopleCSV(head.text + '\n').cols;
  const hasEmail = cols.some(h => h.includes('email') || h.includes('e-mail'));
  const have = new Set((S.people || []).map(p => (p.email || '').toLowerCase()));
  const rows = [], skipped = [], seen = new Map();
  for (const rec of recs) {
    if (!rec.text.trim()) continue;                // a blank line is not a problem, so it is not reported
    const r = hasEmail ? parsePeopleCSV(head.text + '\n' + rec.text).rows[0] : null;
    if (!r) { skipped.push({ line: rec.line, why: hasEmail ? 'No email address in this row' : 'The file has no email column' }); continue; }
    const e = r.email.toLowerCase();
    if (!EMAIL_RE.test(r.email)) { skipped.push({ line: rec.line, why: `“${r.email}” is not an email address`, who: r.name || '' }); continue; }
    if (seen.has(e)) { skipped.push({ line: rec.line, why: `Already on line ${seen.get(e)} of this file`, who: r.email }); continue; }
    seen.set(e, rec.line);
    rows.push({ ...r, line: rec.line, known: have.has(e) });
  }
  const found = ['email', rows.some(r => r.name) && 'name', rows.some(r => r.phone) && 'phone', rows.some(r => r.tags.length) && 'tags',
    rows.some(r => r.interests.length) && 'interests', rows.some(r => r.action_alerts !== null) && 'opt-in'].filter(Boolean);
  return { rows, skipped, cols, hasEmail, found,
    add: rows.filter(r => !r.known).length, upd: rows.filter(r => r.known).length,
    opted: rows.filter(r => r.action_alerts).length, noName: rows.filter(r => !r.name).length };
}
const SKIP_SHOWN = 8;
const skipList = skipped => `<div class="sp-imskip"><h3 class="sp-imskh">${icon('circle-alert')}<span>${plural(skipped.length, 'row')} will not be imported</span></h3>
  <ul class="sp-imskl">${skipped.slice(0, SKIP_SHOWN).map(s => `<li><b>Line ${s.line}</b><span>${esc(s.why)}${s.who ? ` · ${esc(s.who)}` : ''}</span></li>`).join('')}</ul>
  ${skipped.length > SKIP_SHOWN ? `<p class="meta">and ${(skipped.length - SKIP_SHOWN).toLocaleString()} more, all for the same kinds of reason.</p>` : ''}</div>`;
const sandboxNote = what => DEMO ? `<p class="notice info sp-imdemo">${icon('info')}<span>Sandbox: ${what} only in this browser, until you reload. Nothing reaches the live list.</span></p>` : '';

// Step 1: where the CSV comes from. A file on a laptop, a paste on a phone (where picking a file is the harder way).
function importSheet() {
  openSheet({ title: 'Import people', size: 'auto',
    body: `<div class="sp-sheet sp-imstart">
      <p class="meta">A CSV from a mailing list or a sign-up sheet. One column has to say <b>email</b>; name (or first and last), phone, tags, interests and an opt-in column are read when they are there.</p>
      ${btn('Choose a CSV file', { kind: 'secondary', icon: 'upload', attrs: { 'data-imfile': '1' } })}
      <p class="sp-imor"><span>or</span></p>
      <div class="field"><label for="sp-imtx">Paste the text of a CSV</label>
        <textarea id="sp-imtx" rows="5" spellcheck="false" autocapitalize="off" aria-describedby="sp-imerr" placeholder="name,email,tags&#10;Ana Sample,ana@example.com,volunteer"></textarea></div>
      <div id="sp-imerr" role="alert"></div>
      ${sandboxNote('an import changes the list')}</div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn('Check the text', { attrs: { 'data-go': '1' } })}`,
    wire: dlg => {
      dlg.querySelector('[data-no]').onclick = () => closeSheet();
      dlg.querySelector('[data-imfile]').onclick = () => document.querySelector('#sp-file')?.click();
      const tx = dlg.querySelector('#sp-imtx'), err = m => { dlg.querySelector('#sp-imerr').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; tx.toggleAttribute('aria-invalid', !!m); };
      dlg.querySelector('[data-go]').onclick = () => {
        const text = tx.value.trim();
        if (!text) { err('Paste the text first, or choose a file above.'); tx.focus(); return; }
        if (!text.includes('\n')) { err('That is one line. A CSV needs a heading row and then a row for each person.'); tx.focus(); return; }
        err(''); reviewSheet(text, 'the text you pasted');
      };
    } });
}
// Step 2: what will happen, before anything is written.
function reviewSheet(text, source) {
  const r = reviewCSV(text);
  if (!r.rows.length) {
    openSheet({ title: 'Nothing to import', size: 'auto',
      body: `<div class="sp-sheet sp-import"><p>Nothing in ${esc(source)} can be imported.</p>
        <p class="meta sp-cols">${!r.hasEmail ? (r.cols.length ? `The heading row reads: ${esc(r.cols.slice(0, 12).join(', '))}. One of these has to say “email”.` : 'The heading row is empty. The first line has to name the columns.')
          : 'Every row was left out for the reason beside it.'}</p>
        ${r.skipped.length ? skipList(r.skipped) : ''}</div>`,
      foot: `${btn('Back', { kind: 'text', attrs: { 'data-back': '1' } })}${btn('Close', { attrs: { 'data-ok': '1' } })}`,
      wire: d => { d.querySelector('[data-ok]').onclick = () => closeSheet(); d.querySelector('[data-back]').onclick = () => importSheet(); } });
    return;
  }
  openSheet({ title: `Import ${plural(r.rows.length, 'person', 'people')}?`, size: 'auto',
    body: `<div class="sp-sheet sp-import"><p class="meta">From ${esc(source)}</p>
      <ul class="sp-sum">
        <li>${icon('user-plus')}<span><b>${r.add.toLocaleString()}</b> new, added as contacts</span></li>
        <li>${icon('user-check')}<span><b>${r.upd.toLocaleString()}</b> already here, updated. Nothing they have is blanked.</span></li>
        <li>${icon('bell')}<span><b>${r.opted.toLocaleString()}</b> marked as saying yes to supporter emails</span></li>
        ${r.skipped.length ? `<li class="sp-imbad">${icon('circle-alert')}<span><b>${r.skipped.length.toLocaleString()}</b> skipped, listed below</span></li>` : ''}
      </ul>
      <p class="meta">Read from the file: ${esc(r.found.join(', '))}. First rows:</p>
      <ul class="sp-peek">${r.rows.slice(0, 3).map(x => `<li><b>${esc(x.name || 'No name')}</b><span>${esc(x.email)}${x.tags.length ? ' · ' + esc(x.tags.join(', ')) : ''}</span></li>`).join('')}</ul>
      ${r.noName ? `<p class="meta">${plural(r.noName, 'row')} with no name: they show as their email address until someone adds one.</p>` : ''}
      ${r.skipped.length ? skipList(r.skipped) : ''}
      ${sandboxNote('this changes the list')}</div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn(`Import ${plural(r.rows.length, 'person', 'people')}`, { icon: 'upload', attrs: { 'data-go': '1' } })}`,
    wire: dlg => {
      dlg.querySelector('[data-no]').onclick = () => closeSheet();
      const go = dlg.querySelector('[data-go]');
      go.onclick = async () => {
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        // line and known are ours, for the preview; the import gets the same shape it has always been given.
        const payload = r.rows.map(({ line, known, ...row }) => row);
        try { const res = await DB.importPeople(payload, source); rerender(); doneSheet(res, r); }
        catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
    } });
}
// Step 3: what actually happened, in the same words, and it stays on screen until it is closed.
function doneSheet(res, r) {
  const late = Math.max(0, (res.skipped || 0));
  openSheet({ title: 'Imported', size: 'auto',
    body: `<div class="sp-sheet sp-import"><ul class="sp-sum">
        <li>${icon('user-plus')}<span><b>${(res.added || 0).toLocaleString()}</b> added</span></li>
        <li>${icon('user-check')}<span><b>${(res.updated || 0).toLocaleString()}</b> updated</span></li>
        <li${r.skipped.length || late ? ' class="sp-imbad"' : ''}>${icon(r.skipped.length || late ? 'circle-alert' : 'check')}<span><b>${(r.skipped.length + late).toLocaleString()}</b> skipped</span></li>
      </ul>
      ${r.skipped.length ? skipList(r.skipped) : ''}
      ${late ? `<p class="meta">${plural(late, 'row')} the list itself turned down, for an email address it would not take.</p>` : ''}
      ${sandboxNote('this list changed')}</div>`,
    foot: btn('Done', { attrs: { 'data-ok': '1' } }),
    wire: d => { d.querySelector('[data-ok]').onclick = () => { closeSheet(); }; } });
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
    foot: btn(single ? 'Add a to-do' : `Add ${ids.length} to-dos`, { icon: 'calendar-plus', attrs: { 'data-go': '1' } }),
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
          toast(single ? `To-do added. It is in ${whose}.` : `Added ${ids.length} to-dos. They are in ${whose}.`, { ok: true });
          onDone ? onDone() : hooks.render();
        } catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
    } });
}

// Esc leaves select mode (the x in the bar does the same). Like every shortcut in v2 it can be switched off in My
// settings and it never fires while someone is typing. (The frame redraws the page when the window crosses 900px or
// 1100px, which swaps the rows for the table and back.)
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !keysOn() || S.route?.name !== 'supporters' || document.querySelector('dialog[open]') || (typing(e.target) && e.target.type !== 'checkbox')) return;
  const v = S.spView; if (v && (v.selecting || v.sel.size)) { e.preventDefault(); stopSelect(); }
});
