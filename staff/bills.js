// Staff v2 · Bills (#/bills, #/bills/muted), plan 3.4. One list for every screen size: two-line rows on phones, a
// table on desktop, both grouped by where each bill stands in the order the current app's board reads left to right
// (hearing scheduled, at risk, waiting, through committee, governor or law), with Monitoring and Did not advance
// folded at the bottom. It replaces the current app's Tracked bills table, the board, the Did not advance page, the
// Still alive and monitor chips, the Coalitions & lists menu and the Muted menu, and keeps what each of them did.
import { S, DB, DEADLINES, esc, fmtDate, fmtDT, effStage, owners, isMuted, daysAgo, STAGES, STAGE_LABEL, hooks } from './data.js';
import { factsOf, stopOf, whyDead, billNum, glossCommittee, roomShort, sessionClock } from './model.js';
import { CHAMBER_NAME } from '../stops.js';
import { icon, btn, iconBtn, groupHead, segmented, empty, notice, toast, menuSheet, pickerSheet, openSheet, switchRow, avatar, ownerOf, keysOn, POS_ICON, POS_WORD } from './ui.js';
import { bl, save, shownBills, liveCount, freshFacts, QUICK, quickCount, isOn, toggle, clearAll, changed, activeFilters, openFilters, placePop, wideNow, settled, hoverNow, typingIn, deskBack,
  views, curView, applyView, resetView, isDefault, openSaveView, openEditViews, VIEW_CAP } from './filters.js';
import { openLook } from './look.js';
import { bulkBar, wireBulkBar, startSelect, stopSelect, dropSelect, selIds, FIELD } from './bulk.js';

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
// Each cell is [first line, second line, hover text]. Roomy rows show the two lines one over the other (a narrow
// column used to break them anywhere: "In PSM/GVO · 1" / "of 2"); compact rows join them on one line with a dot.
const xw = t => `<span class="bl-xw">${t}</span>`;   // words a compact row leaves out
function whereCell(b) {
  const s = stOf(b), f = factsOf(b);
  if (f.stand === 'dead') { const at = b.died_at_stage ? STAGE_LABEL[b.died_at_stage] : ''; return ['Stopped', at ? 'at ' + esc(at) : '', ''] }
  if (s.phase === 'law') return ['Law', '', ''];
  if (s.phase === 'governor') return ['Governor', '', ''];
  if (s.phase === 'floor') return [`${chamberOf(s)} floor`, '', ''];
  if (s.phase === 'conference') return ['Conference', '', ''];
  if (s.committee) return [`In ${esc(s.committee)}`, s.stops > 1 ? `${xw('stop ')}${s.stop} of ${s.stops}` : '', `${glossCommittee(s.committee)}${s.stops > 1 ? `. Stop ${s.stop} of ${s.stops} in the ${chamberOf(s)}` : ''}`];
  return [chamberOf(s), 'no referral yet', ''];
}
function nextCell(b) {
  const s = stOf(b), f = factsOf(b);
  // The short reason keeps the date and the committee inside the cell ("Missed Lateral 2/20/26", "in FIN"); the long
  // sentence used to be cut at "Missed the Lateral deadline on 2...". Hovering still gives the whole sentence.
  if (f.stand === 'dead') { const [a, ...rest] = shortWhy(b).split(' · '); return [a, rest.join(' · '), whyDead(b).replace(/<[^>]+>/g, '')]; }
  if (s.hearingState === 'scheduled') { const [day, ...time] = fmtDT(s.hearing.scheduled_at).split(', '), room = roomShort(s.hearing.room);
    // compact rows drop what the group row already says ("Hearing scheduled") and the room, so the time is never cut
    return [`${xw('Hearing ')}${esc(day)}`, `${esc(time.join(', '))}${s.hearing.room ? xw(', ' + esc(room)) : ''}`, `${s.hearing.committee}${s.hearing.room ? ', ' + s.hearing.room : ''}`]; }
  if (s.hearingState === 'held') return ['Waiting for the report', `heard ${md(s.hearing.scheduled_at)}`, ''];
  if (s.phase === 'law') { const act = /\bAct \d+/i.exec(b.last_action || ''); return [act ? esc(act[0]) : '', '', ''] }
  if (!s.deadline || s.deadline.missed) return ['', '', ''];
  const days = s.deadline.days, left = days <= 0 ? 'today' : `${days === 1 ? '1 day' : days + ' days'}${xw(' left')}`;
  // At risk needs no word here: those rows sit under the "At risk: no hearing yet" group row.
  if (s.phase === 'committee') return [`Hearing by ${md(s.deadline.date)}`, left, `${s.deadline.label} deadline${f.risk ? '. At risk: no hearing yet' : ''}`];
  return [`${esc(s.deadline.label)} ${md(s.deadline.date)}`, left, `${s.deadline.label} deadline`];
}
const pulseText = b => { const d = daysAgo(S.pulse[b.id]?.last_team_touch); return d == null ? 'Never' : d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`; };
// A bill is named by its nickname when it has one (every bill with a position does), then its plain summary.
const summaryOf = b => b.public_summary || b.description || b.title || '';
const titleOf = b => b.nickname || summaryOf(b);
const fullTitle = b => b.nickname ? `${b.nickname}. ${summaryOf(b)}` : summaryOf(b);

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
// What the line above the list counts. It used to say "20 live bills" while the Filter button said "Show 113 bills":
// both were right (the list also holds the folded Monitoring and Did not advance groups) and they read as a
// contradiction. Now the line leads with the same number the button shows, then says what it is made of.
function sumLine(list, q, filtered, more) {
  const n = list.length, live = liveCount(list), dead = list.filter(b => factsOf(b).stand === 'dead').length, mon = n - live - dead;
  if (filtered) return `<b>${n}</b> bill${n === 1 ? ' matches' : 's match'}${q ? ` “${esc(q)}”` : ''}${more ? ` · <button type="button" class="linkbtn" data-scopeall="1">${more} under Everyone</button>` : ''}`;
  if (live === n) return `<b>${n}</b> live bill${n === 1 ? '' : 's'}`;
  return `<b>${n}</b> bill${n === 1 ? '' : 's'} <span class="bl-sumparts">· ${[[live, 'live'], [mon, 'monitoring'], [dead, 'did not advance']].filter(x => x[0]).map(([k, w]) => `${k} ${w}`).join(' · ')}</span>`;
}
// ---- "Where every bill stands": one row above the table (Nate asked for the current app's three columns of cards
// back; his call, 9/19, was that the grouped table already shows the bills, so this is the glance that was missing).
// The counts are buttons: they take you to that group in the table rather than making a second list of it.
// `bl-stlab` is the phone's label. On a phone the strip lost its card and its heading to save the 157px Nate
// objected to, which left two identical-looking rows of counted pills doing different jobs - the quick chips
// filter the list, these jump to a group. The label rides at the head of the same scrolling row, so it says which
// is which for nothing vertically. Desktop keeps the real heading and hides it.
// Seven equal chips would say nothing, so the three that carry the work are full buttons and the rest is a quiet run.
const LEAD = ['hear', 'risk', 'wait'];
const SHORT = { hear: 'Hearing scheduled', risk: 'At risk', wait: 'Waiting', thru: 'Through committees', done: 'Governor or law', mon: 'Monitoring', dead: 'Did not advance' };
const standBtn = (g, cls) => `<button type="button" class="${cls}" data-jump="${g.k}" aria-label="${esc(g.title)}: ${g.rows.length} bill${g.rows.length === 1 ? '' : 's'}. Go to them in the list"><span class="w">${esc(SHORT[g.k] || g.title)}</span><span class="n">${g.rows.length}</span></button>`;
function standStrip(groups, list) {
  if (!groups.length) return '';
  const lead = groups.filter(g => LEAD.includes(g.k)), rest = groups.filter(g => !LEAD.includes(g.k));
  const clock = sessionClock(list);
  const cl = clock ? (() => {
    const n = clock.noHearing.length, soon = clock.days <= 1;
    return `<div class="bl-clock${soon ? ' soon' : ''}">${icon('calendar-clock')}<div class="bl-cl">
      <span class="bl-cl1"><b>${esc(clock.name)}</b> · ${esc(fmtDate(clock.date))} · ${clock.days <= 0 ? 'today' : clock.days === 1 ? '1 day away' : `${clock.days} days away`}</span>
      <span class="bl-cl2">${clock.racing} bill${clock.racing === 1 ? '' : 's'} must be heard by then${clock.racing ? ` · <b class="bl-nh">${n} with no hearing yet</b>` : ''}</span>
    </div></div>`; })() : '';
  return `<section class="bl-stands" aria-labelledby="bl-stands-h">
    <h2 class="bl-stands-h" id="bl-stands-h">Where every bill stands</h2>
    <div class="bl-stgs"><span class="bl-stlab" aria-hidden="true">Where they stand</span><span class="bl-stlead">${lead.map(g => standBtn(g, 'bl-stg')).join('')}</span>${rest.length ? `<span class="bl-strest">${rest.map(g => standBtn(g, 'bl-stg2')).join('')}</span>` : ''}</div>
    ${cl}</section>`;
}
// ---- saved views: a row of chips beside the Mine/Everyone segment, the current one marked ----
function viewsRow() {
  const list = views(), on = curView();
  if (!list.length) return '';
  const chip = (id, label, pressed) => `<button type="button" class="chip bl-v" data-view="${esc(id)}" aria-pressed="${pressed}">${pressed ? icon('bookmark-check') : icon('bookmark')}<span>${esc(label)}</span></button>`;
  return `<div class="bl-views" role="group" aria-label="Saved views"><span class="bl-vlab">Views</span>
    ${chip('', 'Default', !on && isDefault())}${list.map(w => chip(w.id, w.name, on === w.id)).join('')}
    <button type="button" class="chip bl-vedit" data-vedit="1">${icon('pencil')}<span>Edit</span></button></div>`;
}
function parts() {
  const v = bl(), wide = wideNow(), q = v.q.trim(), { list, groups } = build();
  // The quick chips show their own state, so on a desktop they are left out of the "filters that are on" row. On a
  // phone there are no quick chips any more (Nate, 9/19), so every filter that is on has to appear there - otherwise
  // one could be switched on in the sheet and never taken off without opening the sheet again.
  const act = activeFilters(), quickSpecs = new Set(QUICK.map(x => x[0])), sheetOn = wide ? act.filter(([s]) => !quickSpecs.has(s)) : act;
  const clear = btn('Clear all', { kind: 'text', sm: true, attrs: { 'data-fclearall': '1' } });
  // Only a desktop draws these now, and each one counts the whole list, so a phone does not pay for them.
  const quick = wide ? QUICK.map(([spec, label, test]) => { const on = isOn(spec), n = quickCount(spec, test);
    return `<button type="button" class="chip bl-q" data-ft="${spec}" aria-pressed="${on}" ${!on && !n ? 'disabled' : ''}>${on ? icon('check') : ''}<span>${label}</span><span class="bl-n">${n}</span></button>`; }).join('') : '';
  const nm = S.mutes?.size || 0;
  // The phone reaches muted bills through the ... menu, which carries the same count.
  const mutedChip = wide && nm ? `<a class="chip bl-q" href="#/bills/muted">${icon('bell-off')}<span>Muted</span><span class="bl-n">${nm}</span></a>` : '';
  // Filters picked in the sheet show as chips that come off with one click (the quick chips show their own state).
  const onRow = sheetOn.length ? `<div class="bl-on" role="group" aria-label="Filters that are on">${wide ? '<span class="bl-onlab">Filters</span>' : ''}${sheetOn.map(([s, l]) => `<button type="button" class="chip bl-onchip" data-ft="${esc(s)}" aria-label="Remove the filter ${esc(l)}"><span>${esc(l)}</span>${icon('x')}</button>`).join('')}${clear}</div>` : '';
  const quickRow = `<div class="bl-quick" role="group" aria-label="Quick filters">${quick}${mutedChip}${!sheetOn.length && act.length ? clear : ''}</div>`;
  const filtered = act.length || q;
  // A search in Mine says when Everyone has more, and offers the switch (the current app's "show everyone").
  const more = q && v.scope === 'me' && list.length ? (() => { v.scope = 'all'; const n = shownBills().length; v.scope = 'me'; return n > list.length ? n : 0; })() : 0;
  const sum = `<p class="bl-sum" aria-live="polite">${list.length ? sumLine(list, q, filtered, more) : ''}</p>`;
  const selHead = !wide && v.selecting && list.length ? (() => { const shown = NAV, all = shown.length && shown.every(id => v.sel.has(id)), ids = selIds(), vis = new Set(list.map(b => b.id)), hid = ids.filter(id => !vis.has(id)).length;
    return `<div class="bl-selhead"><span>${hid ? `${hid} of the ${ids.length} selected ${hid === 1 ? 'is' : 'are'} hidden by your filters.` : 'Tap bills to select them.'}</span>${btn(all ? 'Select none' : `Select all ${shown.length}`, { kind: 'text', sm: true, attrs: { 'data-selall': all ? 'none' : 'all' } })}</div>`; })() : '';
  const rows = list.length ? (wide ? table(groups) + keysHint() : phoneList(groups)) : emptyState(q, act.length);
  const strip = list.length ? standStrip(groups, list) : '';
  // The head is the sticky block: everything you steer the list with. The body is what scrolls under it.
  // Desktop: the quick chips and the count share one line, so the table starts higher (12 compact rows at 1440×900).
  return wide
    ? { head: `${viewsRow()}<div class="bl-frow">${quickRow}${sum}</div>${onRow}`, body: `${strip}<div id="bl-banner">${banner()}</div>${rows}` }
    : { head: `${viewsRow()}${onRow}`, body: `${strip}<div id="bl-banner">${banner()}</div>${sum}${selHead}${rows}` };
}
// Row keys are for a keyboard and a mouse, and only while shortcuts are on (My settings); the hint shows when they work.
const keysHint = () => hoverNow() && keysOn() ? `<p class="bl-keys"><kbd>J</kbd> <kbd>K</kbd> next and previous bill · <kbd>Enter</kbd> opens it · <kbd>Space</kbd> a quick look · <kbd>X</kbd> selects it · <kbd>Esc</kbd> clears the selection</p>` : '';
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

// ---- phones: rows under sticky group headers ----
// A Bills row has the parts and classes of ui.js's billRow (so it looks like a bill anywhere else), with the title the
// assessment asked for: rows showed 26 of 107 title characters and could not be told apart. The title is two lines
// before anything is cut: the number and the nickname in bold, then the plain summary (or, with no nickname, the
// summary over both lines). The status sentence keeps its own line under it.
export function blRow(b, { sub = '', href, selectable = false, selected = false } = {}) {
  const pos = b.position || '', o = ownerOf(b), nick = b.nickname || '', sum = summaryOf(b);
  const end = `<span class="sv-posic" role="img" title="${esc(POS_WORD[pos] || pos)}" aria-label="${esc(POS_WORD[pos] || pos)}">${icon(POS_ICON[pos] || 'circle-dashed')}</span>${b.priority === 1 ? '<span class="sv-p1">P1</span>' : ''}${o ? avatar(o) : `<span class="bl-noown" title="No owner">${icon('circle-dashed')}<span class="sr">No owner</span></span>`}`;
  const box = selectable ? `<span class="sv-check" aria-hidden="true">${icon(selected ? 'square-check-big' : 'square')}</span>` : '';
  const inner = `${box}<span class="body"><span class="title bl-rt"><b>${esc(billNum(b))}</b> ${nick ? `<b class="bl-nk">${esc(nick)}</b> ` : ''}<span class="sv-t">${esc(sum)}</span></span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="end">${end}</span>`;
  return href && !selectable ? `<a class="row sv-billrow bl-row" href="${esc(href)}" data-bill="${esc(b.id)}">${inner}</a>`
    : `<button type="button" class="row sv-billrow bl-row${selected ? ' sel' : ''}" data-bill="${esc(b.id)}" aria-pressed="${selected ? 'true' : 'false'}">${inner}</button>`;
}
function phoneList(groups) {
  const v = bl();
  // Each group is its own box, so its header sticks only while its rows are on screen and the next header pushes it away.
  // A row carries the same quick-look chevron a Today card does (Nate, 9/19: he tapped a bill expecting the panel and
  // got the whole page). The row itself is an <a>, so the button cannot live inside it - the row and the button sit
  // side by side in a .bl-prow, the pattern the muted list already uses. Not in select mode: there the row is a
  // checkbox and a second target beside it would be read as part of the selection.
  const look = b => iconBtn('chevron-right', `Quick look at ${billNum(b)}`, { 'data-look': b.id }, 'bl-plk');
  const row = b => v.selecting ? blRow(b, { sub: statusLine(b), selectable: true, selected: v.sel.has(b.id) })
    : `<div class="bl-prow">${blRow(b, { sub: statusLine(b), href: '#/bill/' + b.bill_number })}${look(b)}</div>`;
  return `<div class="bl-list${v.selecting ? ' bl-selecting' : ''}">${groups.map(g => `<div class="bl-grp">${groupHead(esc(g.title), g.rows.length, { fold: g.k, open: g.open, id: 'bl-g-' + g.k })}${g.open ? g.rows.map(row).join('') : ''}</div>`).join('')}</div>`;
}

// ---- desktop: a real table, grouped the same way ----
const OPT_COLS = [['cmte', 'Committees', 'Every committee the bill is referred to'], ['coal', 'Coalitions', 'The coalitions working on it'], ['last', 'Last action', 'The Capitol’s latest step and its date'], ['pulse', 'Team pulse', 'When the team last did something on it']];
// Column widths, in px, as [roomy, compact]. `w` is a fixed width; `min` is the least a column can take and stay
// readable (roomy cells wrap to two lines, so they can be narrower than their text); `ideal` is where its text fits
// on one line. The assessment found titles cut at 46 of 102 characters while Position, Next and Bill sat half
// empty, and "P1" clipped to "P": so Position, Priority and Owner are narrow and fixed to what they hold, and the
// spare width goes to the title first (see widths()). The seven standard columns fit from 900px up. The optional
// ones come after Owner, so the columns staff edit never move off screen.
const COLS = [
  { k: 'sel', w: [44, 40] }, { k: 'bill', label: 'Bill', min: [92, 100], ideal: [112, 104], sort: 'num' }, { k: 'title', label: 'Title', min: [180, 176] },
  { k: 'where', label: 'Where it stands', min: [112, 110], ideal: [136, 142], sort: 'stage' }, { k: 'next', label: 'Next', min: [140, 150], ideal: [168, 166], sort: 'next' },
  { k: 'pos', label: 'Position', min: [132, 124], ideal: [156, 148], sort: 'pos' }, { k: 'pri', label: 'Priority', w: [78, 78], sort: 'pri' }, { k: 'own', label: 'Owner', w: [72, 72], sort: 'own' },
  { k: 'cmte', label: 'Committees', min: [96, 96], ideal: [148, 140], opt: 1 }, { k: 'coal', label: 'Coalitions', min: [110, 110], ideal: [176, 168], opt: 1 },
  { k: 'last', label: 'Last action', min: [172, 172], ideal: [320, 300], opt: 1, sort: 'last' }, { k: 'pulse', label: 'Team pulse', w: [104, 100], opt: 1, sort: 'pulse' },
  { k: 'look', w: [36, 32] },
];
// The room the table has: the page is the window, less the sidebar from 1100px (the frame's 248px) and the page's
// gutters, less the table's border. wire() measures the real box and corrects this once if the frame ever differs.
let MEASURED = null;
const estimateAvail = () => { const w = document.documentElement.clientWidth || innerWidth; return (w >= 1100 ? w - 248 - 64 : w - 48) - 2; };
const tableAvail = () => MEASURED && MEASURED.w === innerWidth ? MEASURED.avail : estimateAvail();
// Who gets the spare width, in order: the title (up to two comfortable lines), the columns whose text would otherwise
// wrap or cut, then the title again. Compact rows are one line, so there the hearing time and the position word come
// first (they must never be cut), then the title.
function widths(cols, avail, ci) {
  const W = new Map(cols.map(c => [c.k, c.w ? c.w[ci] : c.min[ci]]));
  let spare = avail - [...W.values()].reduce((t, x) => t + x, 0);
  const give = (keys, cap) => {   // grow these columns toward their cap, sharing what is left in proportion to what each still needs
    const need = keys.filter(k => W.has(k)).map(k => [k, Math.max(0, cap(k) - W.get(k))]).filter(x => x[1] > 0), tot = need.reduce((t, x) => t + x[1], 0);
    if (spare <= 0 || !tot) return; const f = Math.min(1, spare / tot);
    for (const [k, n] of need) W.set(k, W.get(k) + n * f); spare -= tot * f;
  };
  const ideal = k => { const c = cols.find(x => x.k === k); return c.ideal ? c.ideal[ci] : W.get(k); };
  if (ci) { give(['title'], () => 270); give(['next'], ideal); give(['pos'], ideal); give(['where', 'bill'], ideal); give(['title'], () => 360); give(['cmte', 'coal', 'last'], ideal); give(['title'], () => 720); }
  else { give(['title'], () => 440); give(['pos', 'where', 'next', 'bill', 'cmte', 'coal', 'last'], ideal); give(['title'], () => 720); }
  // A very wide window: the title may reach 960px and the other text columns half again their width; past that the
  // table stops growing (a bill number 1,500px from its hearing date is hard to follow across).
  give(['title'], () => 960); give(['where', 'next', 'pos', 'cmte', 'coal', 'last'], k => ideal(k) * 1.5);
  return W;
}
// A little too narrow (the sidebar arrives at 1100px and leaves the page 786px, less than it had at 900): first the
// cells' side gutters go from 12 to 8px (.bl-tight), then the title, where-it-stands and position columns give up
// to a sixth of their width and wrap a little sooner. The Next column is left alone: a hearing's day and time are
// never what gets cut. Only past that is the table made to scroll sideways.
const GUTTERED = new Set(['bill', 'title', 'where', 'next', 'pos', 'cmte', 'coal', 'last']);
function squeezed(cols, avail, ci) {
  const W = new Map(cols.map(c => [c.k, (c.w ? c.w[ci] : c.min[ci]) - (!ci && GUTTERED.has(c.k) ? 8 : 0)])), soft = ['title', 'where', 'pos'];
  const over = [...W.values()].reduce((t, x) => t + x, 0) - avail, pool = soft.reduce((t, k) => t + W.get(k), 0);
  if (over > pool * .17) return null;
  for (const k of soft) W.set(k, W.get(k) * (1 - over / pool));   // a negative `over` is room to spare: it goes back to the same columns
  return W;
}
function table(groups) {
  const v = bl(), ci = v.compact ? 1 : 0, avail = tableAvail();
  const least = cs => cs.reduce((t, c) => t + (c.w ? c.w[ci] : c.min[ci]), 0);
  // The quick-look column costs 36px, which is exactly what a 1100px window (with the sidebar) has to spare. It is
  // the first thing to go, rather than pushing a table that used to fit into scrolling sideways; Space still works.
  let cols = COLS.filter(c => !c.opt || v.cols.has(c.k));
  const roomy = cs => least(cs) <= avail || !!squeezed(cs, avail, ci), noLook = cols.filter(c => c.k !== 'look');
  if (!roomy(cols) && roomy(noLook)) cols = noLook;
  const std = cols.filter(c => !c.opt);
  // When even the least widths do not fit (optional columns in a small window), the standard table fills the box as
  // it always does and the optional columns sit to its right at full width: only the table scrolls sideways, with the
  // tick box and the bill number pinned, and the page itself never does.
  const fits = least(cols) <= avail, tight = fits ? null : squeezed(cols, avail, ci), scroll = !fits && !tight, fitsStd = least(std) <= avail;
  const W = tight || (scroll ? (fitsStd ? widths(std, avail, ci) : squeezed(std, avail, ci) || widths(std, least(std), ci)) : widths(cols, avail, ci));
  if (scroll) for (const c of cols) if (c.opt) W.set(c.k, c.w ? c.w[ci] : c.ideal[ci]);
  const total = cols.reduce((t, c) => t + W.get(c.k), 0), cap = !scroll && total < avail - 1 ? Math.round(total) + 2 : 0;
  const colg = `<colgroup>${cols.map(c => `<col style="width:${scroll ? Math.round(W.get(c.k)) + 'px' : (W.get(c.k) / total * 100).toFixed(3) + '%'}">`).join('')}</colgroup>`;
  const rowsShown = groups.filter(g => g.open).flatMap(g => g.rows), selShown = rowsShown.filter(b => v.sel.has(b.id)).length;
  const [sk, sd] = v.sort || [];
  const th = c => {
    if (c.k === 'sel') return `<th scope="col" class="bl-ck"><label title="Select every bill shown"><input type="checkbox" id="bl-all" ${rowsShown.length && selShown === rowsShown.length ? 'checked' : ''} aria-label="Select every bill shown"></label></th>`;
    if (c.k === 'look') return '<th scope="col" class="bl-h-look"><span class="sr">Quick look</span></th>';
    if (!c.sort) return `<th scope="col" class="bl-h-${c.k}">${c.label}</th>`;
    const on = sk === c.sort, l = c.label.toLowerCase(), tip = !on ? `Sort by ${l}` : sd > 0 ? `Sorted by ${l}, first to last. Click for last to first` : `Sorted by ${l}, last to first. Click to stop sorting`;
    return `<th scope="col" class="bl-h-${c.k}" aria-sort="${on ? (sd > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="bl-sort${on ? ' on' : ''}" data-sort="${c.sort}" title="${tip}"><span>${c.label}</span>${icon(on && sd < 0 ? 'move-down' : 'move-up')}</button></th>`;
  };
  const two = (html, t) => `<span class="bl-c2"${t ? ` title="${esc(t)}"` : ''}>${html}</span>`;   // two lines, then cut (one line in compact rows)
  const lines = ([l1, l2, t]) => `<span class="bl-lns"${t ? ` title="${esc(t)}"` : ''}><span class="bl-ln">${l1}</span>${l2 ? `<span class="bl-ln bl-l2">${l2}</span>` : ''}</span>`;
  const none = '<span class="bl-dash">None</span>';
  const cell = (c, b) => {
    switch (c.k) {
      case 'sel': return `<td class="bl-ck"><label><input type="checkbox" data-sel="${b.id}" ${v.sel.has(b.id) ? 'checked' : ''} aria-label="Select ${esc(billNum(b))}"></label></td>`;
      case 'bill': return `<td class="bl-num"><a href="#/bill/${esc(b.bill_number)}" data-bill="${b.id}"><span>${esc(b.bill_number)}</span>${b.current_version ? ` <span>${esc(b.current_version)}</span>` : ''}</a></td>`;
      case 'title': return `<td class="bl-ti">${two(`${b.nickname ? `<b>${esc(b.nickname)}</b> <br>` : ''}${esc(summaryOf(b))}`, fullTitle(b))}</td>`;
      case 'where': return `<td>${lines(whereCell(b))}</td>`;
      case 'next': { const c3 = nextCell(b); return `<td>${c3[0] ? lines(c3) : none}</td>`; }
      case 'cmte': { const r = (b.referrals || []).join(', '); return `<td>${r ? two(esc(r), glossCommittee((b.referrals || []).join('/'))) : none}</td>`; }
      case 'coal': { const n = (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(x => x.id === id)?.name).filter(Boolean).join(', '); return `<td>${n ? two(esc(n), n) : none}</td>`; }
      case 'last': return `<td>${b.last_action ? two(`${b.last_action_date ? `<span class="bl-date">${md(b.last_action_date)}</span> ` : ''}${esc(b.last_action)}`, b.last_action) : none}</td>`;
      case 'pulse': return `<td>${pulseText(b)}</td>`;
      case 'pos': { const p = b.position || ''; return `<td><button type="button" class="bl-cell" data-edit="pos" data-id="${b.id}" aria-label="Position for ${esc(billNum(b))}: ${esc(POS_WORD[p] || p)}. Change it">${icon(POS_ICON[p] || 'circle-dashed')}<span>${esc(POS_WORD[p] || p)}</span></button></td>`; }
      case 'pri': return `<td><button type="button" class="bl-cell bl-pri" data-edit="pri" data-id="${b.id}" aria-label="Priority for ${esc(billNum(b))}: ${b.priority ? 'P' + b.priority : 'none'}. Change it">${b.priority === 1 ? '<span class="sv-p1">P1</span>' : b.priority ? `<span>P${b.priority}</span>` : none}</button></td>`;
      case 'own': { const o = ownerOf(b); return `<td><button type="button" class="bl-cell bl-own" data-edit="own" data-id="${b.id}" aria-label="Owner of ${esc(billNum(b))}: ${esc(o ? (o.id === S.me?.id ? 'you' : o.full_name) : 'nobody')}. Change it">${o ? avatar(o) : `<span class="bl-noown">${icon('circle-dashed')}</span>`}</button></td>`; }
      // The facts and the next step without leaving the list; the full page is one click on from there.
      case 'look': return `<td class="bl-lk">${iconBtn('scan-eye', `Quick look at ${billNum(b)}`, { 'data-look': b.id }, 'bl-lkb')}</td>`;
    }
    return '<td></td>';
  };
  const n = cols.length, pin = W.get('sel'), extra = cols.filter(c => c.opt).map(c => c.label);
  const words = extra.length > 1 ? `${extra.slice(0, -1).join(', ')} and ${extra[extra.length - 1]}` : extra[0];
  // Said in words as well as shown (the faded right edge): the added columns are there, to the right.
  return `${scroll ? `<p class="bl-tnote" id="bl-tnote">${icon('arrow-right')}<span>${extra.length ? `${esc(words)} ${extra.length === 1 ? 'is' : 'are'} to the right: this window is too narrow for every column, so the table scrolls sideways.` : 'This window is too narrow for the whole table, so it scrolls sideways.'}</span></p>
    <div class="bl-twrap"><div class="bl-tscroll" role="region" aria-label="Bills table" aria-describedby="bl-tnote" tabindex="0" style="--bl-pin:${pin}px">` : ''}<table class="bl-table${v.compact ? ' bl-compact' : ''}${tight || scroll && !fitsStd ? ' bl-tight' : ''}"${scroll ? ` style="width:${Math.round(total)}px"` : cap ? ` style="max-width:${cap}px"` : ''}>${colg}<caption class="sr">Bills, grouped by where they stand</caption>
    <thead><tr>${cols.map(th).join('')}</tr></thead>
    ${groups.map(g => `<tbody class="bl-tg"><tr class="bl-gr"><th colspan="${n}" scope="colgroup"><button type="button" class="sv-group bl-grb" data-fold="${g.k}" aria-expanded="${g.open}"${scroll ? ` style="width:${avail}px"` : ''}><span>${esc(g.title)}</span><span class="n">${g.rows.length}</span>${icon(g.open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button></th></tr>
      ${g.open ? g.rows.map(b => `<tr data-row="${b.id}" data-num="${esc(b.bill_number)}" class="${v.sel.has(b.id) ? 'sel' : ''}${v.cur === b.id ? ' bl-cur' : ''}">${cols.map(c => cell(c, b)).join('')}</tr>`).join('') : ''}</tbody>`).join('')}
  </table>${scroll ? '</div></div>' : ''}`;
}

// ---- muted bills (#/bills/muted) ----
function renderMuted() {
  const rows = S.bills.filter(b => S.mutes?.has(b.id)).sort(byNum);
  ST.clear(); freshFacts();
  return `<div class="bl-page bl-muted">
    ${deskBack('muted')}
    <h1 class="bl-ptitle">Muted bills</h1>
    <p class="bl-lede">They stay off your list and send you no alerts. A new hearing brings a bill back on its own.</p>
    ${rows.length ? `<div class="bl-list">${rows.map(b => `<div class="bl-mrow">${blRow(b, { sub: statusLine(b).replace(/^Muted · /, ''), href: '#/bill/' + b.bill_number })}${btn('Unmute', { kind: 'secondary', sm: true, attrs: { 'data-unmute': b.id, 'aria-label': `Unmute ${billNum(b)}` } })}</div>`).join('')}</div>`
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
  const v = bl(), wide = wideNow(), nm = S.mutes?.size || 0, n = shownBills().length, tc = S.triageCounts, nv = views().length;
  menuSheet({ title: 'Bills', items: [
    { label: 'Save this view', icon: 'bookmark', sub: nv >= VIEW_CAP ? `You have ${VIEW_CAP}, as many as we keep` : 'Name the filters that are on, and come back to them', run: async () => { await settled(); openSaveView(repaintDyn); } },
    nv ? { label: `Saved views (${nv})`, icon: 'bookmark-check', sub: 'Rename or delete one', run: async () => { await settled(); openEditViews(repaintDyn); } } : null,
    { label: 'Reset to default', icon: 'rotate-ccw', sub: isDefault() ? 'Already your own bills, no filters' : 'Your own bills, no filters, no search', disabled: isDefault(), reason: 'Nothing to reset', run: () => { resetView(); repaint('[data-filter]'); } },
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
  openSheet({ title: 'Columns and rows', size: 'auto bl-pop', body: `<p class="small muted bl-colhelp">Bill, title, where it stands, next, position, priority and owner always show. These come after them.</p>${OPT_COLS.map(([k, l, help]) => switchRow('bl-col-' + k, l, v.cols.has(k), help, { 'data-col': k })).join('')}
      <div class="bl-colsep"></div>${switchRow('bl-compact', 'Compact rows', v.compact, 'One line a bill, so more bills fit on the screen', { 'data-compact': '1' })}`,
    wire: d => { placePop(d, anchor);
      d.querySelectorAll('[data-col]').forEach(el => el.onchange = () => { el.checked ? v.cols.add(el.dataset.col) : v.cols.delete(el.dataset.col); save(); hooks.render(); });
      d.querySelector('[data-compact]').onchange = e => { v.compact = e.target.checked; save(); hooks.render(); }; } });
}
function editCell(field, id) {
  const b = S.bills.find(x => x.id === id); if (!b) return;
  const F = FIELD[field], cur = F.cur(b), cell = `[data-edit="${field}"][data-id="${CSS.escape(String(id))}"]`;
  // The table is redrawn after a save; the focus goes back to the cell that was edited, not to the top of the page.
  pickerSheet({ title: `${F.word[0].toUpperCase() + F.word.slice(1)} for ${billNum(b)}`, options: F.opts(), value: cur, onPick: async val => {
    if (val === cur) return;
    try {
      if (field === 'own') {
        const prev = (S.assignments[id] || [])[0] || null;
        await DB.setOwner(id, val === 'none' ? null : val); repaint(cell);
        toast('Saved', { undo: async () => { await DB.setOwner(id, prev); repaint(); } });
      } else {
        const key = field === 'pos' ? 'position' : 'priority', prev = b[key] ?? null;
        await DB.updateBill(id, { [key]: field === 'pos' ? val : Number(val) }); repaint(cell);
        toast('Saved', { undo: async () => { await DB.updateBill(id, { [key]: prev }); repaint(); } });
      }
    } catch (e) { repaint(); toast(e, { err: true }); }
  } });
}

// ---- wiring ----
// Re-render the whole page but keep the reader where they were: same scroll, focus back on the same control.
function repaint(focusSel, fallback = '[data-filter]') {
  const y = scrollY; hooks.render(); if (scrollY !== y) scrollTo(0, y);
  if (focusSel) (document.querySelector(focusSel) || document.querySelector(fallback))?.focus({ preventScroll: true });
}
let ROOT = null, longAt = 0, fixing = false;
function repaintDyn() {
  // Typing in the search box: only the results change, so the box keeps its focus, caret and keyboard.
  const el = document.getElementById('bl-dyn'); if (!el) return;
  const page = el.closest('.bl-page'), p = parts();
  page.querySelector('#bl-head').innerHTML = p.head;
  el.innerHTML = p.body;
  wireDyn(page); measureStick();
  const inner = ROOT?.querySelector('.actionbar .inner'); if (inner) { inner.innerHTML = bulkBar(); wireBulkBar(ROOT); }
}
// How tall the sticky block is, so the table's own sticky header and group rows hold just under it instead of
// under the app header. Measured rather than guessed: the chips wrap, and a saved-views row comes and goes.
function measureStick() {
  const page = document.querySelector('.bl-page'), st = page?.querySelector('.bl-stick'); if (!st) return;
  page.style.setProperty('--bl-sh', (wideNow() ? Math.round(st.getBoundingClientRect().height) : 0) + 'px');
}
// The bill a row is, opened in a new tab (Cmd or Ctrl with a click, or the middle button), the way a link would.
const newTab = num => window.open(`${location.pathname}${location.search}#/bill/${encodeURIComponent(num)}`, '_blank', 'noopener');
// ---- row keys (desktop): J and K move a marker down and up the table, Enter opens the bill, X ticks it. The marker
// is remembered by bill (S.bl.cur), so it keeps its place when the table is redrawn (a tick, a saved cell, a sort, a
// filter) and when you come back from a bill; the assessment found J starting from the top again after every action.
const tableRows = () => [...document.querySelectorAll('.bl-table tr[data-row]')];
function markRow(focus) {
  const v = bl(), rows = tableRows(); let tr = rows.find(r => r.dataset.row === v.cur);
  rows.forEach(r => r.classList.toggle('bl-cur', r === tr));
  if (tr) v.curAt = rows.indexOf(tr);
  if (tr && focus) { tr.querySelector('a[data-bill]')?.focus({ preventScroll: true }); tr.scrollIntoView({ block: 'nearest' }); }
  return tr;
}
// The bills on screen, in the order shown, as the quick look's j/k list. NAV already holds that order (it is what
// Previous and Next on a bill page walk), so it is reused rather than worked out again.
const BYID = () => { const m = new Map(); for (const b of S.bills) m.set(b.id, b); return m; };
function lookAtRow(id) {
  const m = BYID(), list = NAV.map(x => m.get(x)).filter(Boolean), i = list.findIndex(b => b.id === id);
  const b = m.get(id); if (!b) return;
  openLook(b, { list: list.length ? list : [b], index: Math.max(0, i) });
}
// A count in the strip takes you to that group: it opens it if it was folded, then puts its row just under the
// sticky header. Nothing is filtered away, so there is nothing to undo.
function jumpGroup(k) {
  const v = bl();
  if (v.folds[k] !== true) { v.folds[k] = true; repaint(); }
  const head = document.querySelector(`.bl-table .bl-gr [data-fold="${k}"], .bl-grp > [data-fold="${k}"]`);
  const box = head?.closest('tbody, .bl-grp'); if (!box) return;
  // The group row itself comes to rest under the toolbar AND the table's column headers, so the jump lands it there
  // rather than a header's height too high, which hid the group's own first row.
  const th = document.querySelector('.bl-table thead');
  const want = () => stickBottom() + (th && th.isConnected ? th.offsetHeight : 0);
  const gap = () => Math.round(box.getBoundingClientRect().top - want());
  const soft = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  scrollTo({ top: Math.max(0, scrollY + gap()), behavior: soft ? 'smooth' : 'auto' });
  // A smooth scroll can land a few pixels short (the page grew when the group opened), which leaves a sliver of the
  // group above showing; once it has settled, the last pixels are taken quietly.
  setTimeout(() => { const d = gap(); if (Math.abs(d) > 2) scrollTo({ top: Math.max(0, scrollY + d), behavior: 'auto' }); }, soft ? 420 : 0);
  head.focus({ preventScroll: true });
}
function moveRow(step) {
  const v = bl(), rows = tableRows(); if (!rows.length) return;
  let i = rows.findIndex(r => r.dataset.row === v.cur);
  // The marked bill is gone (filtered out, or its group folded): carry on from where it was, not from the top.
  if (i < 0) i = v.curAt == null ? (step > 0 ? -1 : rows.length) : Math.min(v.curAt, rows.length) - (step > 0 ? 1 : 0);
  const to = rows[Math.max(0, Math.min(rows.length - 1, i + step))];
  v.cur = to.dataset.row; v.keys = true; markRow(true);
}
function wireDyn(page) {
  // The head (chips, saved views, the count) and the body (the strip and the rows) are both redrawn together, so
  // both are wired from the page rather than from #bl-dyn alone. The controls in .bl-top are wired once, in wire().
  const v = bl(), dynEl = page;
  dynEl.querySelectorAll('[data-ft]').forEach(el => el.onclick = () => { const spec = el.dataset.ft; toggle(spec); repaint(`.bl-quick [data-ft="${CSS.escape(spec)}"], .bl-on [data-ft="${CSS.escape(spec)}"]`); });
  dynEl.querySelectorAll('[data-fclearall]').forEach(el => el.onclick = () => { clearAll(); repaint('[data-filter]'); });
  dynEl.querySelectorAll('[data-scopeall]').forEach(el => el.onclick = () => { v.scope = 'all'; changed(); repaint('[data-seg="blscope"][data-val="all"]'); });
  dynEl.querySelectorAll('[data-fold]').forEach(el => el.onclick = () => { v.folds[el.dataset.fold] = el.getAttribute('aria-expanded') !== 'true'; repaint(`[data-fold="${el.dataset.fold}"]`); });
  dynEl.querySelectorAll('[data-selall]').forEach(el => el.onclick = () => { if (el.dataset.selall === 'all') NAV.forEach(id => v.sel.add(id)); else NAV.forEach(id => v.sel.delete(id)); repaint('[data-selall]'); });
  dynEl.querySelectorAll('[data-jump]').forEach(el => el.onclick = () => jumpGroup(el.dataset.jump));
  dynEl.querySelectorAll('[data-view]').forEach(el => el.onclick = () => {
    const id = el.dataset.view;
    if (id ? applyView(id) : (resetView(), true)) repaint(`[data-view="${CSS.escape(id)}"]`, '[data-filter]');
  });
  dynEl.querySelectorAll('[data-vedit]').forEach(el => el.onclick = () => openEditViews(repaintDyn));
  dynEl.querySelectorAll('[data-look]').forEach(el => el.onclick = () => { v.cur = el.dataset.look; markRow(false); lookAtRow(el.dataset.look); });
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
  // The widths were worked out for the room the frame should give; if the real box differs, lay it out once more.
  const real = page.clientWidth - 2;
  if (!fixing && real > 0 && Math.abs(real - tableAvail()) > 1) { MEASURED = { w: innerWidth, avail: real }; fixing = true; try { repaintDyn(); } finally { fixing = false; } return; }
  const all = tbl.querySelector('#bl-all'), boxes = [...tbl.querySelectorAll('[data-sel]')];
  if (all) { const n = boxes.filter(b => b.checked).length; all.indeterminate = n > 0 && n < boxes.length;
    all.onchange = () => { boxes.forEach(b => all.checked ? v.sel.add(b.dataset.sel) : v.sel.delete(b.dataset.sel)); repaint('#bl-all'); }; }
  boxes.forEach((el, i) => el.onclick = e => {
    const on = el.checked, from = e.shiftKey && lastBox != null ? Math.min(lastBox, i) : i, to = e.shiftKey && lastBox != null ? Math.max(lastBox, i) : i;
    for (let j = from; j <= to; j++) on ? v.sel.add(boxes[j].dataset.sel) : v.sel.delete(boxes[j].dataset.sel);
    lastBox = i; v.cur = el.dataset.sel; repaint(`[data-sel="${el.dataset.sel}"]`);
  });
  tbl.querySelectorAll('[data-sort]').forEach(el => el.onclick = () => { const k = el.dataset.sort, s = v.sort; v.sort = s && s[0] === k ? (s[1] > 0 ? [k, -1] : null) : [k, 1]; repaint(`[data-sort="${k}"]`); });
  tbl.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => { v.cur = el.dataset.id; markRow(false); editCell(el.dataset.edit, el.dataset.id); });
  const rowOf = e => { const tr = e.target.closest('tr[data-row]'); return tr && !e.target.closest('a, button, input, label') ? tr : null; };
  // The whole row opens the bill; with Cmd or Ctrl (or the middle button) it opens in a new tab, as its link does.
  tbl.addEventListener('click', e => {
    const a = e.target.closest('a[data-bill]'); if (a) { v.cur = a.dataset.bill; return; }
    const tr = rowOf(e); if (!tr || getSelection()?.toString()) return;
    v.cur = tr.dataset.row;
    if (e.metaKey || e.ctrlKey) { markRow(false); newTab(tr.dataset.num); return; }
    S.billNav = NAV.slice(); S.go('#/bill/' + tr.dataset.num);
  });
  tbl.addEventListener('auxclick', e => { const tr = e.button === 1 && rowOf(e); if (tr) { e.preventDefault(); newTab(tr.dataset.num); } });
  tbl.addEventListener('pointerdown', () => { v.keys = false; });
  // A redraw keeps the marker, and gives the focus back to its row when the keys were what moved it there.
  const at = document.activeElement;
  markRow(v.keys && (!at || at === document.body || at.id === 'main' || !at.isConnected));
  // In the sideways-scrolling table the header cannot use position: sticky (its box scrolls, not the window), so it
  // is held under the app's header by hand while the table is on screen.
  holdHead();
  const box = dynEl.querySelector('.bl-tscroll');
  if (box) { if (v.sx) box.scrollLeft = v.sx; edgeCue(box); box.addEventListener('scroll', () => { v.sx = box.scrollLeft; edgeCue(box); }, { passive: true }); }
}
let lastBox = null;
// Where the page's own sticky stack ends: the app header (offset by the sandbox band when there is one) plus the
// Bills toolbar. Read from the boxes themselves, so the band and the wrapping chips never need counting by hand.
function stickBottom() {
  const st = document.querySelector('.bl-page .bl-stick');
  if (st && getComputedStyle(st).position === 'sticky') return Math.max(0, Math.round(st.getBoundingClientRect().bottom));
  return Math.max(0, Math.round(document.querySelector('.sv-hdr')?.getBoundingClientRect().bottom || 56));
}
// In the sideways-scrolling table neither the column headers nor the group rows can use position: sticky (their
// scroll box is the table's, not the window's), so both are held by hand while the table is on screen.
function holdHead() {
  const box = document.querySelector('.bl-tscroll'), head = box?.querySelector('thead'); if (!head) return;
  const top = stickBottom(), r = box.getBoundingClientRect(), hh = head.offsetHeight;
  const dy = Math.round(Math.max(0, Math.min(top - r.top, r.height - hh - 56)));
  box.style.setProperty('--bl-hy', dy + 'px'); box.classList.toggle('bl-held', dy > 0);
  // Each group row stays under the held header while its own rows are on screen, and stops at the end of its group.
  for (const tb of box.querySelectorAll('tbody.bl-tg')) {
    const g = tb.querySelector('.bl-grb'); if (!g) continue;
    const rb = tb.getBoundingClientRect(), gh = g.offsetHeight;
    const d = Math.round(Math.max(0, Math.min(top + hh - rb.top, rb.height - gh)));
    g.style.transform = d ? `translateY(${d}px)` : '';
    g.classList.toggle('bl-held', d > 0);
  }
}
// The faded right edge says "there is more this way"; it goes once the table is scrolled to its end.
function edgeCue(box) { box.parentElement?.classList.toggle('bl-end', box.scrollLeft + box.clientWidth >= box.scrollWidth - 2); }

export default {
  tab: 'bills',
  title: r => r.muted ? 'Muted bills' : 'Bills',
  back: r => r.muted ? { href: '#/bills', label: 'Bills' } : null,
  wide: r => !r.muted,
  narrow: r => !!r.muted,
  noTabs: r => { if (r.muted) dropSelect(); return !r.muted && bl().selecting && !wideNow(); },
  render(route) {
    const v = bl();
    if (route.muted) { dropSelect(); const html = renderMuted(); v.lastMuted = true; return html; }
    // Select mode belongs to the list: arriving from any other page starts without it (it used to follow you around).
    if ((document.body.dataset.screen || 'bills') !== 'bills' || v.lastMuted) dropSelect();
    v.lastMuted = false;
    const wide = wideNow(), p = parts();
    // Everything you steer the list with is in one block, so from 900px up it can stay under the app header while
    // 113 rows go past it. On a phone it is a plain block: the screen is too short to spend on controls.
    return `<div class="bl-page ${wide ? 'bl-wide' : 'bl-phone'}"><div class="bl-stick">${controls(wide)}<div id="bl-head">${p.head}</div></div><div id="bl-dyn">${p.body}</div></div>`;
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
    measureStick();
    // The toolbar's own height changes when the chips wrap (a window resize, a filter that adds a chip, a saved
    // view appearing), and the table's sticky header hangs off it.
    STICK?.disconnect();
    const st = page.querySelector('.bl-stick');
    if (st && typeof ResizeObserver === 'function') { STICK = new ResizeObserver(() => measureStick()); STICK.observe(st); }
  },
};
let STICK = null;

// Once for the app: the layout switches between rows and the table at 900px, the keys, and a press and hold must not
// also count as a tap on the row that appears under the finger.
if (typeof window !== 'undefined') {
  matchMedia('(min-width: 900px)').addEventListener('change', () => { if (S.route?.name === 'bills') hooks.render(); });
  let rz = 0, lastW = innerWidth;   // the table's column widths are worked out for the window's width, so a resize lays it out again
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(() => { if (S.route?.name === 'bills' && !S.route.muted && wideNow() && !document.querySelector('dialog[open]') && !document.activeElement?.matches?.('input')) repaint(); }, 200); });
  addEventListener('scroll', () => { if (S.route?.name === 'bills' && document.querySelector('.bl-tscroll')) holdHead(); }, { passive: true });
  // Every key here is a shortcut, so every one waits for keysOn() (My settings can switch shortcuts off), is ignored
  // while someone types in a field or a sheet is open, and leaves "g then a letter" to the frame.
  let lastG = 0;
  document.addEventListener('keydown', e => {
    if (!keysOn() || S.route?.name !== 'bills' || !S.bl || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') {
      if (typingIn(e.target)) return;
      if (S.route.muted) { if (wideNow()) { const a = document.querySelector('.bl-deskback'); if (a) { e.preventDefault(); a.click(); } } return; }
      if (S.bl.selecting) stopSelect(); else if (S.bl.sel.size && wideNow()) { S.bl.sel.clear(); repaint(); }
      return;
    }
    if (S.route.muted || !wideNow() || !hoverNow() || typingIn(e.target) || e.repeat && !/^[jk]$/i.test(e.key)) return;
    if (e.key === 'g') { lastG = Date.now(); return; }
    if (Date.now() - lastG < 1200) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, v = S.bl, tr = tableRows().find(r => r.dataset.row === v.cur);
    if (k === 'j' || k === 'k') { e.preventDefault(); moveRow(k === 'j' ? 1 : -1); }
    // Space on the marked row: the quick look. It opens a panel and changes nothing, so it is safe on one key.
    else if (k === ' ' && tr && !e.target?.closest?.('button, [role="button"], summary')) { e.preventDefault(); v.keys = true; lookAtRow(tr.dataset.row); }
    else if (k === 'x' && tr) { e.preventDefault(); v.sel.has(v.cur) ? v.sel.delete(v.cur) : v.sel.add(v.cur); v.keys = true; repaint(); }
    // Enter on the row's own link is the browser's; here it covers the marker when the focus is on the page itself.
    else if ((k === 'o' || k === 'Enter' && (e.target === document.body || e.target.id === 'main')) && tr) { e.preventDefault(); S.billNav = NAV.slice(); S.go('#/bill/' + tr.dataset.num); }
  });
  // The finger lifts on the row that select mode just drew; the tap that lift makes is swallowed, and only that one.
  document.addEventListener('pointerup', () => { if (longAt) setTimeout(() => { longAt = 0; }, 350); }, true);
  document.addEventListener('click', e => { if (longAt) { e.preventDefault(); e.stopPropagation(); longAt = 0; } }, true);
}
