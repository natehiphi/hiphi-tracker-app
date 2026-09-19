// Staff v2 · Bills (#/bills, #/bills/muted), plan 3.4. One list for every screen size: two-line rows on phones, a
// table on desktop, both grouped by where each bill stands in the order the current app's board reads left to right
// (hearing scheduled, at risk, waiting, through committee, governor or law), with Monitoring and Did not advance
// folded at the bottom. It replaces the current app's Tracked bills table, the board, the Did not advance page, the
// Still alive and monitor chips, the Coalitions & lists menu and the Muted menu, and keeps what each of them did.
import { S, DB, DEADLINES, esc, fmtDate, fmtDT, effStage, owners, isMuted, daysAgo, STAGES, STAGE_LABEL, hooks } from './data.js';
import { factsOf, stopOf, whyDead, billNum, glossCommittee } from './model.js';
import { CHAMBER_NAME } from '../stops.js';
import { icon, btn, iconBtn, billRow, groupHead, segmented, empty, notice, toast, menuSheet, pickerSheet, openSheet, switchRow, avatar, ownerOf, POS_ICON, POS_WORD } from './ui.js';
import { bl, save, shownBills, liveCount, freshFacts, QUICK, quickCount, isOn, toggle, clearAll, changed, activeFilters, openFilters, placePop, wideNow, settled } from './filters.js';
import { bulkBar, wireBulkBar, startSelect, stopSelect, FIELD } from './bulk.js';

// ---- groups, in stage order ----
const GROUPS = [['hear', 'Hearing scheduled'], ['risk', 'At risk: no hearing yet'], ['wait', 'Waiting for a hearing'], ['thru', 'Through its committees'],
  ['done', 'At the governor or law'], ['mon', 'Monitoring'], ['dead', 'Did not advance']];
const FOLDED = new Set(['mon', 'dead']);
// The stand comes from factsOf, the same fact the filter counts use, so a group and its filter always agree.
const groupKey = b => { const f = factsOf(b);
  if (f.stand === 'dead') return 'dead';
  if (b.position === 'monitor') return 'mon';
  return f.stand === 'b' ? 'hear' : f.stand === 'a' ? (f.risk ? 'risk' : 'wait') : f.stand === 'done' ? 'done' : 'thru'; };
const ST = new Map();   // stopOf per render: it filters every hearing, so each bill is worked out once
const stOf = b => { let s = ST.get(b.id); if (!s) ST.set(b.id, s = stopOf(b)); return s; };
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const byPri = (a, b) => (a.priority || 9) - (b.priority || 9);
const hearAt = b => stOf(b).hearing?.scheduled_at || '9';
const dlDays = b => stOf(b).deadline?.days ?? 999;
const NATURAL = {
  hear: (a, b) => hearAt(a).localeCompare(hearAt(b)) || byPri(a, b) || byNum(a, b),
  risk: (a, b) => dlDays(a) - dlDays(b) || byPri(a, b) || byNum(a, b),
  wait: (a, b) => byPri(a, b) || dlDays(a) - dlDays(b) || byNum(a, b),
  thru: (a, b) => byPri(a, b) || String(b.last_action_date || '').localeCompare(String(a.last_action_date || '')) || byNum(a, b),
  done: (a, b) => byPri(a, b) || byNum(a, b), mon: byNum, dead: (a, b) => byPri(a, b) || byNum(a, b),
};
// Desktop column sorts, inside each group (dead bills stay at the bottom because their group does).
const STAGE_ORDER = Object.fromEntries(STAGES.map(([k], i) => [k, i]));
const POS_ORDER = ['strongly_support', 'support', 'support_amend', 'neutral', 'oppose', 'strongly_oppose', 'monitor'];
const nextKey = b => { const s = stOf(b); return s.hearing?.scheduled_at || (s.deadline && !s.deadline.missed ? s.deadline.date : '9'); };
const SORTS = { num: null, stage: b => STAGE_ORDER[effStage(b)] ?? 99, next: nextKey, pos: b => POS_ORDER.indexOf(b.position || 'monitor'), pri: b => b.priority || 9,
  own: b => ownerOf(b)?.full_name || '~', last: b => b.last_action_date || '', pulse: b => S.pulse[b.id]?.last_team_touch || '' };
function sorter() {
  const s = bl().sort; if (!s || !wideNow()) return null;
  const [k, dir] = s, f = SORTS[k];
  return (a, b) => { if (!f) return byNum(a, b) * dir; const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * dir || byNum(a, b); };
}
let NAV = [];   // the bills in the order shown, for the bill page's Previous and Next
function build() {
  freshFacts(); ST.clear();
  const v = bl(), list = shownBills(), by = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
  for (const b of list) by[groupKey(b)].push(b);
  const srt = sorter();
  const groups = GROUPS.map(([k, title]) => ({ k, title, rows: by[k].sort(srt || NATURAL[k]) })).filter(g => g.rows.length);
  // Monitoring and Did not advance start folded only in the plain list: once a search or a filter asks for something,
  // every bill it found is on screen, so "Show 15 bills" means 15 rows.
  const asked = !!v.q.trim() || activeFilters().length > 0, only = groups.length === 1;
  for (const g of groups) g.open = v.folds[g.k] ?? (asked || only || !FOLDED.has(g.k));
  NAV = groups.filter(g => g.open).flatMap(g => g.rows.map(b => b.id));
  return { list, groups };
}

// ---- what each row says ----
const md = d => fmtDate(d);
const chamberOf = s => CHAMBER_NAME[s.chamber] || 'chamber';
// Line 2 on phones: one plain sentence about where the bill is and what it needs next.
function statusLine(b) {
  const f = factsOf(b);
  if (f.stand === 'dead') return shortWhy(b);
  const s = stOf(b), cm = esc(s.committee || '');
  const muted = bl().scope === 'all' && isMuted(b) ? 'Muted · ' : '';
  let t;
  if (s.phase === 'law') { const act = /\bAct \d+/i.exec(b.last_action || ''); t = `Law${act ? ' · ' + esc(act[0]) : ''}`; }
  else if (s.phase === 'governor') t = 'At the governor';
  else if (s.hearingState === 'scheduled') t = `Hearing ${esc(fmtDT(s.hearing.scheduled_at))} · ${esc(s.hearing.committee)}`;
  else if (s.hearingState === 'held') t = `Heard ${md(s.hearing.scheduled_at)} · waiting for the ${esc(s.hearing.committee)} report`;
  else if (s.phase === 'committee') {
    const by = s.deadline && !s.deadline.missed ? ` by ${md(s.deadline.date)}` : '';
    if (s.deadline?.missed) t = `Missed the ${esc(s.deadline.label)} deadline ${md(s.deadline.date)} with no hearing`;
    // the date comes before the committee: on a phone the end of the line is the part that gets cut
    else if (f.risk) t = `<b>At risk:</b> needs a hearing${by}${cm ? ` · ${cm}` : ''}`;
    else t = cm ? `Needs a hearing${by} · ${cm}` : `Waiting for a ${chamberOf(s)} referral${s.deadline ? ` · ${esc(s.deadline.label)} ${md(s.deadline.date)}` : ''}`;
  }
  else if (s.phase === 'floor') t = `Waiting for the ${chamberOf(s)} floor vote${s.deadline && !s.deadline.missed ? ` · ${esc(s.deadline.label)} ${md(s.deadline.date)}` : ''}`;
  else if (s.phase === 'conference') t = `In conference${s.deadline && !s.deadline.missed ? ` · ${esc(s.deadline.label)} ${md(s.deadline.date)}` : ''}`;
  else t = esc(s.says || STAGE_LABEL[effStage(b)] || '');
  return muted + t;
}
// whyDead, cut to what fits one phone line with the date kept: "Missed Decking 3/6/26 · in FIN".
function shortWhy(b) {
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (m) return `Missed ${esc(m[1])} ${m[2]}${b.committee ? ` · in ${esc(b.committee)}` : ''}`;
  if (/deferred/i.test(b.last_action || '') && !b.died_deadline) return 'Deferred by the committee';
  if (/failed to pass/i.test(b.last_action || '') && !b.died_deadline) return 'Failed a floor vote';
  return whyDead(b);                                              // whyDead escapes its own parts
}
// Desktop splits the sentence into two columns: where the bill is, and what comes next.
function whereCell(b) {
  const s = stOf(b), f = factsOf(b);
  if (f.stand === 'dead') { const at = b.died_at_stage ? STAGE_LABEL[b.died_at_stage] : ''; return [`Stopped${at ? ' at ' + esc(at) : ''}`, ''] }
  if (s.phase === 'law') return ['Law', ''];
  if (s.phase === 'governor') return ['Governor', ''];
  if (s.phase === 'floor') return [`${chamberOf(s)} floor`, ''];
  if (s.phase === 'conference') return ['Conference', ''];
  if (s.committee) return [`In ${esc(s.committee)}${s.stops > 1 ? ` · ${s.stop} of ${s.stops}` : ''}`, glossCommittee(s.committee)];
  return [`${chamberOf(s)}, no referral yet`, ''];
}
function nextCell(b) {
  const s = stOf(b), f = factsOf(b);
  if (f.stand === 'dead') { const w = whyDead(b); return [w, w.replace(/<[^>]+>/g, '')]; }
  if (s.hearingState === 'scheduled') return [`Hearing ${esc(fmtDT(s.hearing.scheduled_at))}`, `${s.hearing.committee}${s.hearing.room ? ', ' + s.hearing.room : ''}`];
  if (s.hearingState === 'held') return ['Waiting for the report', `Heard ${md(s.hearing.scheduled_at)}`];
  if (s.phase === 'law') { const act = /\bAct \d+/i.exec(b.last_action || ''); return [act ? esc(act[0]) : '', ''] }
  if (!s.deadline || s.deadline.missed) return ['', ''];
  const d = `${esc(s.deadline.label)} ${md(s.deadline.date)}`, days = s.deadline.days;
  // At risk needs no word here: those rows sit under the "At risk: no hearing yet" group row.
  if (s.phase === 'committee') return [`Hearing by ${md(s.deadline.date)} <span class="bl-days">· ${days <= 0 ? 'today' : days === 1 ? '1 day' : days + ' days'}</span>`, `${s.deadline.label} deadline${f.risk ? '. At risk: no hearing yet' : ''}`];
  return [d, `${s.deadline.label} deadline`];
}
const pulseText = b => { const d = daysAgo(S.pulse[b.id]?.last_team_touch); return d == null ? 'Never' : d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`; };
const titleOf = b => b.nickname || b.public_summary || b.description || b.title || '';

// ---- the page ----
function controls(wide) {
  const v = bl(), n = activeFilters().length;
  const seg = segmented('blscope', [['me', 'Mine'], ['all', 'Everyone']], v.scope, 'Whose bills');
  const search = `<div class="searchbox bl-search" role="search"><label class="sr" for="bl-q">Find a bill by number or words</label>${icon('search')}<input id="bl-q" class="input" type="search" placeholder="Find a bill by number or words" value="${esc(v.q)}" autocomplete="off" enterkeyhint="search">${iconBtn('x', 'Clear the search', { 'data-qclear': '1', hidden: !v.q })}</div>`;
  const fbtn = `<button type="button" class="btn secondary sm bl-fbtn" data-filter aria-haspopup="dialog">${icon('sliders-horizontal')}<span>Filter</span>${n ? `<span class="bl-cnt" aria-label="${n} on">${n}</span>` : ''}</button>`;
  const more = iconBtn('ellipsis', 'More for bills', { 'data-more': '1' });
  return wide
    ? `<div class="bl-top"><h1 class="bl-h1">Bills</h1>${seg}${search}<span class="bl-sp"></span>${fbtn}${btn('Columns', { kind: 'secondary', sm: true, icon: 'columns-3', attrs: { 'data-cols': '1', 'aria-haspopup': 'dialog' } })}${more}</div>`
    : `<div class="bl-top">${seg}<span class="bl-sp"></span>${fbtn}${more}</div>${search}`;
}
// The opening weeks of a session: every new bill needs one decision (the current app's rule for its banner).
function openWeeks() {
  const c = (DEADLINES.introduced || [])[0]; if (!c) return false;
  const cut = new Date(c[1] + 'T23:59:59-10:00').getTime(), now = Date.now();
  return now > cut - 18 * 864e5 && now < cut + 3 * 864e5;
}
function banner() {
  if (!openWeeks()) return '';
  if (!S.triageCounts && !S.triageCountsLoading) { S.triageCountsLoading = true;
    DB.triageCounts().then(c => { S.triageCounts = c; const el = document.getElementById('bl-banner'); if (el) el.innerHTML = banner(); }).catch(() => {}); }
  const c = S.triageCounts, n = c ? (c.suggested || c.undecided || 0) : null;
  if (c && !n) return '';
  return notice('info', 'sparkles', n ? `<b>${n} new bill${n === 1 ? '' : 's'} to sort.</b> Track them or pass.` : '<b>New bills are coming in.</b> Each one needs a decision: track it or pass.', btn('Sort new bills', { sm: true, href: '#/bills/new' }));
}
function dyn() {
  const v = bl(), wide = wideNow(), q = v.q.trim(), { list, groups } = build();
  const act = activeFilters(), quickSpecs = new Set(QUICK.map(x => x[0])), sheetOn = act.filter(([s]) => !quickSpecs.has(s));
  const clear = btn('Clear all', { kind: 'text', sm: true, attrs: { 'data-fclearall': '1' } });
  const quick = QUICK.map(([spec, label, test]) => { const on = isOn(spec), n = quickCount(spec, test);
    return `<button type="button" class="chip bl-q" data-ft="${spec}" aria-pressed="${on}" ${!on && !n ? 'disabled' : ''}>${on ? icon('check') : ''}<span>${label}</span><span class="bl-n">${n}</span></button>`; }).join('');
  const nm = S.mutes?.size || 0;
  const mutedChip = nm ? `<a class="chip bl-q" href="#/bills/muted">${icon('bell-off')}<span>Muted</span><span class="bl-n">${nm}</span></a>` : '';
  const onRow = sheetOn.length ? `<div class="bl-on" role="group" aria-label="Filters that are on">${sheetOn.map(([s, l]) => `<button type="button" class="chip bl-onchip" data-ft="${esc(s)}" aria-label="Remove the filter ${esc(l)}"><span>${esc(l)}</span>${icon('x')}</button>`).join('')}${clear}</div>` : '';
  const quickRow = `<div class="bl-quick" role="group" aria-label="Quick filters">${quick}${mutedChip}${!sheetOn.length && act.length ? clear : ''}</div>`;
  const filtered = act.length || q;
  // A search in Mine says when Everyone has more, and offers the switch (the current app's "show everyone").
  const more = q && v.scope === 'me' && list.length ? (() => { v.scope = 'all'; const n = shownBills().length; v.scope = 'me'; return n > list.length ? n : 0; })() : 0;
  const sum = filtered ? `<b>${list.length}</b> bill${list.length === 1 ? ' matches' : 's match'}${q ? ` “${esc(q)}”` : ''}${more ? ` · <button type="button" class="linkbtn" data-scopeall="1">${more} under Everyone</button>` : ''}` : `<b>${liveCount(list)}</b> live bill${liveCount(list) === 1 ? '' : 's'}`;
  const selHead = !wide && v.selecting && list.length ? (() => { const shown = NAV, all = shown.length && shown.every(id => v.sel.has(id));
    return `<div class="bl-selhead"><span>Tap bills to select them.</span>${btn(all ? 'Select none' : `Select all ${shown.length}`, { kind: 'text', sm: true, attrs: { 'data-selall': all ? 'none' : 'all' } })}</div>`; })() : '';
  return `${onRow}${quickRow}<div id="bl-banner">${banner()}</div>
    <p class="bl-sum" aria-live="polite">${list.length ? sum : ''}</p>${selHead}
    ${list.length ? (wide ? table(groups) : phoneList(groups)) : emptyState(q, act.length)}`;
}
function emptyState(q, nf) {
  const v = bl();
  if (q) {
    const elsewhere = v.scope === 'me' ? (() => { v.scope = 'all'; const n = shownBills().length; v.scope = 'me'; return n; })() : 0;
    return empty({ title: `No bills ${v.scope === 'me' ? 'of yours ' : ''}match “${esc(q)}”`, text: elsewhere ? `${elsewhere} match under Everyone.` : nf ? 'Your filters may be hiding it.' : 'Bills that are not tracked yet show up in search, where you can track them.',
      action: elsewhere ? btn('Show Everyone', { attrs: { 'data-scopeall': '1' } }) : nf ? btn('Clear all filters', { attrs: { 'data-fclearall': '1' } }) : btn('Search all bills', { href: '#/search?q=' + encodeURIComponent(q) }) });
  }
  if (nf) return empty({ title: 'No bills match these filters', text: 'Take one off, or clear them all.', action: btn('Clear all filters', { attrs: { 'data-fclearall': '1' } }) });
  if (v.scope === 'me') return empty({ title: 'You have no bills yet', text: 'Your bills are the ones you own or follow. Follow a bill from its page.', action: btn('Show everyone’s bills', { attrs: { 'data-scopeall': '1' } }) });
  return empty({ title: 'No bills are tracked yet', text: 'Sort the new bills to start.', action: btn('Sort new bills', { href: '#/bills/new' }) });
}

// ---- phones: two-line rows under sticky group headers ----
function phoneList(groups) {
  const v = bl();
  // Each group is its own box, so its header sticks only while its rows are on screen and the next header pushes it away.
  const row = b => (v.selecting ? billRow(b, { sub: statusLine(b), selectable: true, selected: v.sel.has(b.id) })
    : billRow(b, { sub: statusLine(b), href: '#/bill/' + b.bill_number })).replace(NOBODY, NOBODY_ICON);
  return `<div class="bl-list${v.selecting ? ' bl-selecting' : ''}">${groups.map(g => `<div class="bl-grp">${groupHead(esc(g.title), g.rows.length, { fold: g.k, open: g.open, id: 'bl-g-' + g.k })}${g.open ? g.rows.map(row).join('') : ''}</div>`).join('')}</div>`;
}
// ui.js draws a bill with no owner as a "?" circle; here it is the same dashed circle the desktop table uses.
const NOBODY = '<span class="sv-av" style="--av:24px" aria-hidden="true">?</span>';
const NOBODY_ICON = `<span class="bl-noown" title="No owner">${icon('circle-dashed')}<span class="sr">No owner</span></span>`;

// ---- desktop: a real table, grouped the same way ----
const OPT_COLS = [['cmte', 'Committees', 'Every committee the bill is referred to'], ['coal', 'Coalitions', 'The coalitions working on it'], ['last', 'Last action', 'The Capitol’s latest step and its date'], ['pulse', 'Team pulse', 'When the team last did something on it']];
// Each column has a width it needs to stay readable (min, px) and a share of any room left over (grow). The seven
// standard columns fit at 900px; the optional ones can add more than a screen holds, and then the table scrolls
// sideways inside its own box with the tick box and bill number pinned on the left (the page itself never does).
const COLS = [
  { k: 'sel', min: 44 }, { k: 'bill', label: 'Bill', min: 104, grow: .2, sort: 'num' }, { k: 'title', label: 'Title', min: 150, grow: 3 },
  { k: 'where', label: 'Where it stands', min: 124, grow: .8, sort: 'stage' }, { k: 'next', label: 'Next', min: 176, grow: 1, sort: 'next' },
  { k: 'cmte', label: 'Committees', min: 104, grow: .5, opt: 1 }, { k: 'coal', label: 'Coalitions', min: 116, grow: .7, opt: 1 }, { k: 'last', label: 'Last action', min: 190, grow: 1.4, opt: 1, sort: 'last' }, { k: 'pulse', label: 'Team pulse', min: 96, grow: .2, opt: 1, sort: 'pulse' },
  { k: 'pos', label: 'Position', min: 128, grow: .6, sort: 'pos' }, { k: 'pri', label: 'P', min: 52, sort: 'pri', aria: 'Priority' }, { k: 'own', label: 'Owner', min: 60, sort: 'own' },
];
const tableAvail = () => Math.min(1200, innerWidth) - 48 - 2;   // main's 24px gutters and the table's border
function table(groups) {
  const v = bl(), cols = COLS.filter(c => !c.opt || v.cols.has(c.k));
  const need = cols.reduce((t, c) => t + c.min, 0), avail = tableAvail(), scroll = need > avail;
  const extra = scroll ? 0 : avail - need, W = cols.reduce((t, c) => t + (c.grow || 0), 0);
  const colg = `<colgroup>${cols.map(c => { const px = c.min + extra * (c.grow || 0) / W; return `<col style="width:${scroll ? px + 'px' : (px / avail * 100).toFixed(3) + '%'}">`; }).join('')}</colgroup>`;
  const rowsShown = groups.filter(g => g.open).flatMap(g => g.rows), selShown = rowsShown.filter(b => v.sel.has(b.id)).length;
  const [sk, sd] = v.sort || [];
  const th = c => {
    if (c.k === 'sel') return `<th scope="col" class="bl-ck"><label title="Select every bill shown"><input type="checkbox" id="bl-all" ${rowsShown.length && selShown === rowsShown.length ? 'checked' : ''} aria-label="Select every bill shown"></label></th>`;
    if (!c.sort) return `<th scope="col">${c.label}</th>`;
    const on = sk === c.sort;
    return `<th scope="col" aria-sort="${on ? (sd > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="bl-sort" data-sort="${c.sort}"${c.aria ? ` aria-label="${c.aria}"` : ''}>${c.label}${on ? icon(sd > 0 ? 'chevron-up' : 'chevron-down') : ''}</button></th>`;
  };
  const cell = (c, b) => {
    switch (c.k) {
      case 'sel': return `<td class="bl-ck"><label><input type="checkbox" data-sel="${b.id}" ${v.sel.has(b.id) ? 'checked' : ''} aria-label="Select ${esc(billNum(b))}"></label></td>`;
      case 'bill': return `<td class="bl-num"><a href="#/bill/${esc(b.bill_number)}" data-bill="${b.id}">${esc(billNum(b))}</a></td>`;
      case 'title': return `<td class="bl-ti" title="${esc(titleOf(b))}">${esc(titleOf(b))}</td>`;
      case 'where': { const [h, t] = whereCell(b); return `<td${t ? ` title="${esc(t)}"` : ''}>${h}</td>`; }
      case 'next': { const [h, t] = nextCell(b); return `<td${t ? ` title="${esc(t)}"` : ''}>${h || '<span class="bl-dash">None</span>'}</td>`; }
      case 'cmte': { const r = (b.referrals || []).join(', '); return `<td title="${esc(glossCommittee((b.referrals || []).join('/')))}">${esc(r) || '<span class="bl-dash">None</span>'}</td>`; }
      case 'coal': { const n = (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(x => x.id === id)?.name).filter(Boolean).join(', '); return `<td title="${esc(n)}">${esc(n) || '<span class="bl-dash">None</span>'}</td>`; }
      case 'last': return `<td title="${esc(b.last_action || '')}">${b.last_action_date ? `<span class="bl-date">${md(b.last_action_date)}</span> ` : ''}${esc(b.last_action || '')}</td>`;
      case 'pulse': return `<td>${pulseText(b)}</td>`;
      case 'pos': { const p = b.position || ''; return `<td><button type="button" class="bl-cell" data-edit="pos" data-id="${b.id}" aria-label="Position for ${esc(billNum(b))}: ${esc(POS_WORD[p] || p)}. Change it">${icon(POS_ICON[p] || 'circle-dashed')}<span>${esc(POS_WORD[p] || p)}</span></button></td>`; }
      case 'pri': return `<td><button type="button" class="bl-cell bl-pri" data-edit="pri" data-id="${b.id}" aria-label="Priority for ${esc(billNum(b))}: ${b.priority ? 'P' + b.priority : 'none'}. Change it">${b.priority === 1 ? '<span class="sv-p1">P1</span>' : b.priority ? `P${b.priority}` : '<span class="bl-dash">None</span>'}</button></td>`;
      case 'own': { const o = ownerOf(b); return `<td><button type="button" class="bl-cell bl-own" data-edit="own" data-id="${b.id}" aria-label="Owner of ${esc(billNum(b))}: ${esc(o ? (o.id === S.me?.id ? 'you' : o.full_name) : 'nobody')}. Change it">${o ? avatar(o) : `<span class="bl-noown">${icon('circle-dashed')}</span>`}</button></td>`; }
    }
    return '<td></td>';
  };
  const n = cols.length;
  return `${scroll ? `<div class="bl-tscroll" role="region" aria-label="Bills table, scrolls sideways" tabindex="0">` : ''}<table class="bl-table${v.compact ? ' bl-compact' : ''}"${scroll ? ` style="width:${need}px"` : ''}>${colg}<caption class="sr">Bills, grouped by where they stand</caption>
    <thead><tr>${cols.map(th).join('')}</tr></thead>
    ${groups.map(g => `<tbody class="bl-tg"><tr class="bl-gr"><th colspan="${n}" scope="colgroup"><button type="button" class="sv-group bl-grb" data-fold="${g.k}" aria-expanded="${g.open}"${scroll ? ` style="width:${avail}px"` : ''}><span>${esc(g.title)}</span><span class="n">${g.rows.length}</span>${icon(g.open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button></th></tr>
      ${g.open ? g.rows.map(b => `<tr data-row="${b.id}" class="${v.sel.has(b.id) ? 'sel' : ''}">${cols.map(c => cell(c, b)).join('')}</tr>`).join('') : ''}</tbody>`).join('')}
  </table>${scroll ? '</div>' : ''}`;
}

// ---- muted bills (#/bills/muted) ----
function renderMuted() {
  const rows = S.bills.filter(b => S.mutes?.has(b.id)).sort(byNum);
  ST.clear(); freshFacts();
  return `<div class="bl-page bl-muted">
    <h1 class="bl-ptitle">Muted bills</h1>
    <p class="bl-lede">They stay off your list and send you no alerts. A new hearing brings a bill back on its own.</p>
    ${rows.length ? `<div class="bl-list">${rows.map(b => `<div class="bl-mrow">${billRow(b, { sub: statusLine(b), href: '#/bill/' + b.bill_number }).replace(NOBODY, NOBODY_ICON)}${btn('Unmute', { kind: 'secondary', sm: true, attrs: { 'data-unmute': b.id, 'aria-label': `Unmute ${billNum(b)}` } })}</div>`).join('')}</div>`
      : empty({ title: 'No muted bills', text: 'Mute a bill from its page when you do not need its alerts for a while.', action: btn('Back to bills', { href: '#/bills', kind: 'secondary' }) })}
  </div>`;
}
function wireMuted(page) {
  page.querySelectorAll('[data-unmute]').forEach(el => el.onclick = async () => {
    const b = S.bills.find(x => x.id === el.dataset.unmute); if (!b) return;
    el.setAttribute('aria-busy', 'true');
    try {
      await DB.mute(b.id, false); hooks.render();
      toast(`${billNum(b)} is back on your list.`, { undo: async () => { await DB.mute(b.id, true); hooks.render(); } });
    } catch (e) { el.removeAttribute('aria-busy'); toast(e, { err: true }); }
  });
}

// ---- ⋯, columns, CSV, single-cell edits ----
function exportCSV(list) {
  // The current app's columns and quoting, for the bills in this list in the order shown.
  const rows = [['Bill', 'Title', 'Coalitions', 'Owner', 'Stage', 'Position', 'Priority', 'Committee', 'Last action', 'Last action date']];
  list.forEach(b => rows.push([b.bill_number, b.title, (S.billCampaigns[b.id] || []).map(c => S.campaigns.find(x => x.id === c)?.name).join('; '),
    owners(b).map(a => a.full_name).join('; '), STAGE_LABEL[effStage(b)], b.position || '', b.priority || '', b.committee || '', b.last_action || '', b.last_action_date || '']));
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'hiphi-bill-tracker.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Downloaded ${list.length} bill${list.length === 1 ? '' : 's'} as a spreadsheet file.`);
}
const listInOrder = () => build().groups.flatMap(g => g.rows);
function moreMenu() {
  const v = bl(), wide = wideNow(), nm = S.mutes?.size || 0, n = shownBills().length, tc = S.triageCounts;
  menuSheet({ title: 'Bills', items: [
    { label: 'Weekly memo', icon: 'notebook-pen', sub: 'This week for your bills, ready to paste into an email', run: async () => { await settled(); S.go('#/bills/memo'); } },
    { label: `Muted bills (${nm})`, icon: 'bell-off', sub: nm ? 'See them and unmute' : 'None right now', run: async () => { await settled(); S.go('#/bills/muted'); } },
    { label: 'Export CSV', icon: 'download', sub: `The ${n} bill${n === 1 ? '' : 's'} in this list, as a spreadsheet file`, run: () => exportCSV(listInOrder()) },
    wide ? null : { label: 'Select bills', icon: 'square-check-big', sub: 'Change several at once. You can also press and hold a bill.', run: () => startSelect() },
    wide ? { label: v.compact ? 'Roomy rows' : 'Compact rows', icon: 'rows-3', sub: v.compact ? 'Back to taller rows' : 'Shorter rows, more bills on screen', run: () => { v.compact = !v.compact; save(); hooks.render(); } } : null,
    { label: 'Sort new bills', icon: 'sparkles', sub: tc?.undecided ? `${tc.undecided} waiting for a decision` : 'Track or pass on bills that are not tracked yet', run: async () => { await settled(); S.go('#/bills/new'); } },
  ] });
}
function columnsSheet(anchor) {
  const v = bl();
  openSheet({ title: 'Columns', size: 'auto bl-pop', body: `<p class="small muted bl-colhelp">Bill, title, where it stands, next, position, priority and owner always show.</p>${OPT_COLS.map(([k, l, help]) => switchRow('bl-col-' + k, l, v.cols.has(k), help, { 'data-col': k })).join('')}`,
    wire: d => { placePop(d, anchor); d.querySelectorAll('[data-col]').forEach(el => el.onchange = () => { el.checked ? v.cols.add(el.dataset.col) : v.cols.delete(el.dataset.col); save(); hooks.render(); }); } });
}
function editCell(field, id) {
  const b = S.bills.find(x => x.id === id); if (!b) return;
  const F = FIELD[field], cur = F.cur(b);
  pickerSheet({ title: `${F.word[0].toUpperCase() + F.word.slice(1)} for ${billNum(b)}`, options: F.opts(), value: cur, onPick: async val => {
    if (val === cur) return;
    try {
      if (field === 'own') {
        const prev = (S.assignments[id] || [])[0] || null;
        await DB.setOwner(id, val === 'none' ? null : val); hooks.render();
        toast('Saved', { undo: async () => { await DB.setOwner(id, prev); hooks.render(); } });
      } else {
        const key = field === 'pos' ? 'position' : 'priority', prev = b[key] ?? null;
        await DB.updateBill(id, { [key]: field === 'pos' ? val : Number(val) }); hooks.render();
        toast('Saved', { undo: async () => { await DB.updateBill(id, { [key]: prev }); hooks.render(); } });
      }
    } catch (e) { hooks.render(); toast(e, { err: true }); }
  } });
}

// ---- wiring ----
// Re-render the whole page but keep the reader where they were: same scroll, focus back on the same control.
function repaint(focusSel, fallback = '[data-filter]') {
  const y = scrollY; hooks.render(); if (scrollY !== y) scrollTo(0, y);
  if (focusSel) (document.querySelector(focusSel) || document.querySelector(fallback))?.focus({ preventScroll: true });
}
let ROOT = null, longAt = 0;
function repaintDyn() {
  // Typing in the search box: only the results change, so the box keeps its focus, caret and keyboard.
  const el = document.getElementById('bl-dyn'); if (!el) return;
  el.innerHTML = dyn(); wireDyn(el.closest('.bl-page'));
  const inner = ROOT?.querySelector('.actionbar .inner'); if (inner) { inner.innerHTML = bulkBar(); wireBulkBar(ROOT); }
}
function wireDyn(page) {
  const v = bl(), dynEl = page.querySelector('#bl-dyn');
  dynEl.querySelectorAll('[data-ft]').forEach(el => el.onclick = () => { const spec = el.dataset.ft; toggle(spec); repaint(`.bl-quick [data-ft="${CSS.escape(spec)}"], .bl-on [data-ft="${CSS.escape(spec)}"]`); });
  dynEl.querySelectorAll('[data-fclearall]').forEach(el => el.onclick = () => { clearAll(); repaint('[data-filter]'); });
  dynEl.querySelectorAll('[data-scopeall]').forEach(el => el.onclick = () => { v.scope = 'all'; changed(); repaint('[data-seg="blscope"][data-val="all"]'); });
  dynEl.querySelectorAll('[data-fold]').forEach(el => el.onclick = () => { v.folds[el.dataset.fold] = el.getAttribute('aria-expanded') !== 'true'; repaint(`[data-fold="${el.dataset.fold}"]`); });
  dynEl.querySelectorAll('[data-selall]').forEach(el => el.onclick = () => { if (el.dataset.selall === 'all') NAV.forEach(id => v.sel.add(id)); else NAV.forEach(id => v.sel.delete(id)); repaint('[data-selall]'); });
  // Phones: in select mode a tap picks the bill; otherwise press and hold starts select mode with that bill.
  const listEl = dynEl.querySelector('.bl-list');
  if (listEl && v.selecting) listEl.querySelectorAll('button[data-bill]').forEach(el => el.onclick = () => { const id = el.dataset.bill; v.sel.has(id) ? v.sel.delete(id) : v.sel.add(id); repaint(`[data-bill="${id}"]`); });
  else if (listEl) {
    let t = null, x0 = 0, y0 = 0;
    const cancel = () => { clearTimeout(t); t = null; };
    listEl.addEventListener('pointerdown', e => { const row = e.target.closest('a.sv-billrow'); if (!row || e.button > 0) return; x0 = e.clientX; y0 = e.clientY;
      t = setTimeout(() => { t = null; longAt = Date.now(); navigator.vibrate?.(12); startSelect(row.dataset.bill); }, 520); });
    listEl.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => listEl.addEventListener(k, cancel));
    listEl.addEventListener('contextmenu', e => { if (e.target.closest('.sv-billrow')) e.preventDefault(); });
  }
  // Desktop table: tick boxes (shift-click ticks a run), sortable headers, a row click opens the bill, cells edit.
  const tbl = dynEl.querySelector('.bl-table'); if (!tbl) return;
  const all = tbl.querySelector('#bl-all'), boxes = [...tbl.querySelectorAll('[data-sel]')];
  if (all) { const n = boxes.filter(b => b.checked).length; all.indeterminate = n > 0 && n < boxes.length;
    all.onchange = () => { boxes.forEach(b => all.checked ? v.sel.add(b.dataset.sel) : v.sel.delete(b.dataset.sel)); repaint('#bl-all'); }; }
  boxes.forEach((el, i) => el.onclick = e => {
    const on = el.checked, from = e.shiftKey && lastBox != null ? Math.min(lastBox, i) : i, to = e.shiftKey && lastBox != null ? Math.max(lastBox, i) : i;
    for (let j = from; j <= to; j++) on ? v.sel.add(boxes[j].dataset.sel) : v.sel.delete(boxes[j].dataset.sel);
    lastBox = i; repaint(`[data-sel="${el.dataset.sel}"]`);
  });
  tbl.querySelectorAll('[data-sort]').forEach(el => el.onclick = () => { const k = el.dataset.sort, s = v.sort; v.sort = s && s[0] === k ? (s[1] > 0 ? [k, -1] : null) : [k, 1]; repaint(`[data-sort="${k}"]`); });
  tbl.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => editCell(el.dataset.edit, el.dataset.id));
  tbl.querySelectorAll('tr[data-row]').forEach(tr => tr.onclick = e => {
    if (e.target.closest('a, button, input, label') || getSelection()?.toString()) return;
    const b = S.bills.find(x => x.id === tr.dataset.row); if (!b) return;
    S.billNav = NAV.slice(); S.go('#/bill/' + b.bill_number);
  });
}
let lastBox = null;

export default {
  tab: 'bills',
  title: r => r.muted ? 'Muted bills' : 'Bills',
  back: r => r.muted ? { href: '#/bills', label: 'Bills' } : null,
  wide: r => !r.muted,
  noTabs: r => !r.muted && bl().selecting && !wideNow(),
  render(route) {
    bl();
    if (route.muted) return renderMuted();
    const wide = wideNow();
    return `<div class="bl-page ${wide ? 'bl-wide' : 'bl-phone'}">${controls(wide)}<div id="bl-dyn">${dyn()}</div></div>`;
  },
  bar(route) {
    if (route.muted) return '';
    return wideNow() || bl().selecting ? bulkBar() : '';
  },
  wire(route, root) {
    ROOT = root;
    const page = root.querySelector('.bl-page'); if (!page) return;
    if (route.muted) return wireMuted(page);
    const v = bl();
    wireDyn(page);
    wireBulkBar(root);
    // Previous and Next on the bill page walk this list in the order shown.
    page.addEventListener('click', e => { if (e.target.closest('a[data-bill]')) S.billNav = NAV.slice(); }, true);
    // Links added after the first paint (search results) are not wired by the frame; route them the same way.
    page.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); S.go(a.getAttribute('href')); });
    page.querySelectorAll('[data-seg="blscope"]').forEach(el => el.onclick = () => { if (v.scope === el.dataset.val) return; v.scope = el.dataset.val; changed(); repaint(`[data-seg="blscope"][data-val="${v.scope}"]`); });
    const qi = page.querySelector('#bl-q'), qx = page.querySelector('[data-qclear]');
    qi.oninput = () => { v.q = qi.value; v.folds = {}; qx.hidden = !qi.value; repaintDyn(); };
    qi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); qi.blur(); } if (e.key === 'Escape' && qi.value) { e.stopPropagation(); qi.value = ''; qi.oninput(); } };
    qx.onclick = () => { qi.value = ''; qi.oninput(); qi.focus(); };
    page.querySelector('[data-filter]').onclick = e => openFilters(e.currentTarget);
    page.querySelector('[data-more]').onclick = moreMenu;
    const cb = page.querySelector('[data-cols]'); if (cb) cb.onclick = () => columnsSheet(cb);
  },
};

// Once for the app: the layout switches between rows and the table at 900px, Esc leaves select mode, and a press
// and hold must not also count as a tap on the row that appears under the finger.
if (typeof window !== 'undefined') {
  matchMedia('(min-width: 900px)').addEventListener('change', () => { if (S.route?.name === 'bills') hooks.render(); });
  let rz = 0, lastW = innerWidth;   // the table's column widths are worked out for the window's width, so a resize lays it out again
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(() => { if (S.route?.name === 'bills' && !S.route.muted && wideNow() && !document.querySelector('dialog[open]') && !document.activeElement?.matches?.('input')) repaint(); }, 200); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || S.route?.name !== 'bills' || S.route?.muted || document.querySelector('dialog[open]') || !S.bl) return;
    if (S.bl.selecting) stopSelect(); else if (S.bl.sel.size && wideNow()) { S.bl.sel.clear(); hooks.render(); }
  });
  // The finger lifts on the row that select mode just drew; the tap that lift makes is swallowed, and only that one.
  document.addEventListener('pointerup', () => { if (longAt) setTimeout(() => { longAt = 0; }, 350); }, true);
  document.addEventListener('click', e => { if (longAt) { e.preventDefault(); e.stopPropagation(); longAt = 0; } }, true);
}
