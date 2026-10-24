// HIPHI Staff v5 · a legislator's profile (R-335, Nate 22 Oct 2026: "a notes section for legislators that is easily edited,
// with additional notes added, well organized and easy to find ... a profile of legislators"). A person comes here to read
// what the team knows about a legislator that holds from week to week, and to add what they know (B-1). It sits on the
// legislator's page above their bills: a one-line tip, then six sections in Nate's order (What they care about · How to work
// with them · Their office · Who on our team knows them · History with HIPHI · Watch out for). A section holds several
// people's lines, each with its writer and date; each person changes only their own (an admin any), and every change keeps
// the wording before it ("edited", Earlier wording). "Cares about" is a set of HIPHI issues, which the Legislators list
// filters by and an issue's page lists. The dated log (Conversations and notes) stays in conversation.js.
// Show me lane: on the practice copy until Nate's yes, which also needs a migration for the live app (a table of profile
// lines with their earlier wording, and one of issue picks). The practice copy keeps it in S.legProfiles, saved with the
// tab's other practice changes (data.js savePractice). When PROFILES() is false nothing here is drawn or called.
// Staff v6 (R-336 V23): the sections someone has written in show; the empty ones fold into one "Add what we know" card
// with a button each (R-335's "fold empty ones" option), so the page stays short and every section is still one tap away.
// The tip shows near the top of the page, under Email · Call · Log a talk (profileTipHTML); adding one is in the card. The
// practice copy seeds three sections and the tip with "Placeholder:" lines and leaves three empty, so the card can be seen.
import { S, DEMO, SESSION_YEAR, esc, fmtDate, advocate, hooks } from './data.js';
import { plain, whenAt, hstDayOf, billRoute } from './model.js';
import { icon, btn, iconBtn, toast, openSheet, closeSheet, menuSheet } from './ui.js';
import { showAllBtn } from './ui.js';   // U-4: one "Show all" on every screen
import { photo, shortName, legName, partyDist, legHref } from './pathway.js';
import { issueById, catByKey } from './issues.js';
// A sheet opened from a menu waits for the menu's Back to land (else that Back would close the new sheet).
const afterBack = () => new Promise(res => { if (!history.state?.sheet) return res(); let done = false; const run = () => { if (done) return; done = true; removeEventListener('popstate', run); res(); }; addEventListener('popstate', run); setTimeout(run, 500); });

export const PROFILES = () => DEMO;   // Show me lane: on the practice copy until Nate's yes, which also needs a migration for the live app

// The six sections, in Nate's order (R-335 decision 1). `ph` is the practice copy's placeholder: the copy is public and shows
// real, named legislators, so nothing seeded may read as a fact about one (each starts "Placeholder:"). `by` spreads the
// seeded lines across teammates, so "only your own lines" can be seen when practising as someone else.
export const SECS = [
  { k: 'cares', name: 'What they care about', hint: 'The issues they champion, and why', by: 'LR', d: 5, empty: true,
    ph: 'Placeholder: the issues they champion and why, in a sentence or two.' },
  { k: 'how', name: 'How to work with them', hint: 'How they like to be approached', by: 'KR', d: 6, edited: 4,
    ph: 'Placeholder: how they like to be approached, e.g. a short meeting, a one-page fact sheet, or their aide first.',
    was: 'Placeholder: how they like to be approached.' },
  { k: 'office', name: 'Their office', hint: 'An aide’s name, role, and work email or phone', by: 'KV', d: 3, empty: true,
    help: 'Work contacts only: never a personal phone, email or address.',
    ph: 'Placeholder: an aide’s name, role, and work email or phone. Work contacts only.' },
  { k: 'knows', name: 'Who on our team knows them', hint: 'How you know them, optional', by: 'KV', d: 7,
    ph: 'Placeholder: how you know them, e.g. worked together on a past bill.' },
  { k: 'history', name: 'History with HIPHI', hint: 'Past asks, wins and what they did for our bills', by: 'NT', d: 2,
    ph: 'Placeholder: past asks, wins and what they did for our bills.' },
  { k: 'watch', name: 'Watch out for', hint: 'Positions or concerns to keep in mind', by: 'JS', d: 3, empty: true,
    help: 'Professional facts only: what they have said or done in public life.',
    ph: 'Placeholder: positions or concerns to keep in mind. Professional facts only.' },
];
const SEC = Object.fromEntries(SECS.map(s => [s.k, s]));
const TIP = { by: 'KR', d: 4, ph: 'Placeholder tip: the one thing to know before reaching out, e.g. who to talk to first.' };
const FOLD = 2;   // a section shows its 2 newest lines, the rest behind one "Show all N" (U-4)

// ---- the store ----
const store = () => (S.legProfiles ??= {});
const uid = () => 'pf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// A seeded line's day: d days before the practice day, mid-morning in Honolulu.
const daysAgo = (d, hh = '10:30') => new Date(`${hstDayOf(Date.now() - d * 864e5)}T${hh}:00-10:00`).toISOString();
function writer(ini, i) {
  const on = (S.advocates || []).filter(a => a.is_active !== false);
  return (on.find(a => a.initials === ini) || on[i % Math.max(1, on.length)] || S.me)?.id || null;
}
// The first time a legislator's profile is shown in this tab: a placeholder line in three sections (the other three start
// empty, so the "Add what we know" card shows, V23), a placeholder tip, and no issue picks (Nate adds those himself to try
// the filter). One line has an earlier version, so "edited" can be seen.
function seed(l) {
  const lines = SECS.filter(s => !s.empty).map((s, i) => {
    const x = { id: `pfs-${l.id}-${s.k}`, sec: s.k, body: s.ph, by: writer(s.by, i), at: daysAgo(s.d), history: [] };
    if (s.was) Object.assign(x, { history: [{ body: s.was, by: x.by, at: x.at }], edited_at: daysAgo(s.edited, '14:05'), edited_by: x.by });
    return x;
  });
  lines.unshift({ id: `pfs-${l.id}-tip`, sec: 'tip', body: TIP.ph, by: writer(TIP.by, 0), at: daysAgo(TIP.d, '09:15'), history: [] });
  return { lines, issues: [] };
}
export function profileOf(l) { const all = store(); return (all[l.id] ??= seed(l)); }

// ---- who may, and how a line is signed ----
const mine = x => !!S.me && x.by === S.me.id;
const mayChange = x => mine(x) || !!S.me?.is_admin;   // decision 2: your own lines; an admin any
const firstOf = id => { const a = advocate(id); return !a ? 'Someone' : a.id === S.me?.id ? 'You' : String(a.full_name || '').split(' ')[0] || 'Someone'; };
const dayOf = t => fmtDate(t, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');   // "Thu 3/12", as the conversation list
const whose = x => mine(x) ? 'your' : `${firstOf(x.by)}’s`;
const knowsWho = x => mine(x) ? 'You know them' : `${firstOf(x.by)} knows them`;
const newest = (a, b) => String(b.at).localeCompare(String(a.at));

// v5's "From the tracker: Introduced 37 bills we have a position on" line left History in v6 (R-336): it gave a second
// count of the bills they introduced beside the page's own "Bills they introduced", which now says how many have our
// position under its heading (legislator.js). History holds only what the team writes.

// ---- drawing ----
const landId = () => { try { return new URLSearchParams(location.hash.split('?')[1] || '').get('pf'); } catch { return null; } };
function byline(x) {
  const ed = x.edited_at ? ` · <button type="button" class="linkbtn pf-ed" data-pfed="${esc(x.id)}" aria-label="${esc(`Edited. See the earlier wording of ${whose(x)} line`)}">edited</button>` : '';
  return `<span class="pf-by">${x.sec === 'knows' ? '' : `${esc(firstOf(x.by))} · `}${esc(dayOf(x.edited_at || x.at))}${ed}</span>`;
}
function lineHTML(l, x) {
  const s = SEC[x.sec], at = landId() === x.id;
  const words = x.sec === 'knows' ? `<b>${esc(knowsWho(x))}</b>${x.body ? ` · ${esc(x.body)}` : ''}` : esc(x.body);
  const more = mayChange(x) ? iconBtn('ellipsis', `More for ${whose(x)} line in ${s.name}, ${shortName(l)}`, { 'data-pfmore': x.id, 'aria-haspopup': 'dialog' }, 'pf-more') : '';
  return `<li class="pf-line${at ? ' pf-land' : ''}" data-pfline="${esc(x.id)}"${at ? ' tabindex="-1"' : ''}><p class="pf-text">${words} ${byline(x)}</p>${more}</li>`;
}
function issuesHTML(l, p) {
  const chips = p.issues.map(x => { const i = issueById(x.issue_id); if (!i) return '';
    const rm = mayChange(x) ? `<button type="button" class="pf-irm" data-pfirm="${esc(i.id)}" aria-label="${esc(`Remove ${i.name} from what ${shortName(l)} cares about`)}" title="Remove">${icon('x')}</button>` : '';
    return `<li class="pf-ichip"><a href="#/issue/${encodeURIComponent(i.id)}" title="${esc(`Added by ${firstOf(x.by)}, ${dayOf(x.at)}`)}">${icon(catByKey(i.category)?.icon || 'tag')}<span>${esc(i.name)}</span></a>${rm}</li>`; }).join('');
  // "Add an issue" is drawn as an empty chip, the shape of what it makes, so it does not read as the section's other Add (A-12).
  return `<div class="pf-iss">${chips ? `<ul class="pf-ichips" aria-label="${esc(`Issues ${shortName(l)} cares about`)}">${chips}</ul>` : ''}<button type="button" class="pf-iadd" data-pfiadd="1" aria-haspopup="dialog" aria-label="${esc(`Add an issue ${shortName(l)} cares about`)}">${icon('plus')}<span>Add an issue</span></button></div>`;
}
function secHTML(l, p, s, intro) {
  const rows = p.lines.filter(x => x.sec === s.k).sort(newest), key = `${l.id}|${s.k}`, land = landId();
  const open = S.pfMore?.has(key) || rows.length <= FOLD + 1 || rows.some((x, n) => n >= FOLD && x.id === land);
  const shown = open ? rows : rows.slice(0, FOLD);
  const iKnow = s.k === 'knows' && !rows.some(mine);
  const act = s.k === 'knows' ? (iKnow ? btn('I know them', { kind: 'text', sm: true, icon: 'user-plus', attrs: { 'data-pfknow': '1', 'aria-haspopup': 'dialog', 'aria-label': `I know ${shortName(l)}: add how you know them` } }) : '')
    : btn('Add', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-pfadd': s.k, 'aria-haspopup': 'dialog', 'aria-label': `Add to ${s.name}, ${shortName(l)}` } });
  const list = shown.map(x => lineHTML(l, x)).join('');
  return `<div class="pf-sec${list || s.k === 'cares' ? '' : ' pf-empty'}" data-pfsec="${s.k}">
      <div class="pf-sech"><h3 id="pf-h-${s.k}">${esc(s.name)}</h3>${act}</div>
      ${s.k === 'cares' ? issuesHTML(l, p) : ''}
      ${list ? `<ul class="pf-lines" aria-labelledby="pf-h-${s.k}">${list}</ul>` : ''}
      ${shown.length < rows.length ? showAllBtn(rows.length, { 'data-pfall': key, 'aria-label': `Show all ${rows.length} lines in ${s.name}` }, { cls: 'pf-all' }) : ''}
    </div>`;
}
function tipHTML(l, p) {
  const t = p.lines.find(x => x.sec === 'tip'); if (!t) return '';
  const at = landId() === t.id;
  return `<div class="pf-tip${at ? ' pf-land' : ''}" data-pfline="${esc(t.id)}"${at ? ' tabindex="-1"' : ''}>${icon('lightbulb')}<p class="pf-tiptext"><span class="sr">Tip: </span>${esc(t.body)} ${byline(t)}</p>
    ${mayChange(t) ? iconBtn('ellipsis', `More for ${whose(t)} tip about ${shortName(l)}`, { 'data-pfmore': t.id, 'aria-haspopup': 'dialog' }, 'pf-more') : ''}</div>`;
}
// The tip, near the top of the legislator's page (the one thing to know before reaching out): '' when there is none.
export const profileTipHTML = l => { const t = tipHTML(l, profileOf(l)); return t ? `<div class="pf pf-top" data-pfleg="${l.id}">${t}</div>` : ''; };
// A section with nothing in it: no lines (and, for What they care about, no issue).
const isEmpty = (p, s) => !p.lines.some(x => x.sec === s.k) && !(s.k === 'cares' && p.issues.length);
// "Add what we know": one card with a button for each empty section (and the tip, when there is none). Each opens the same
// sheet the section's own Add does; What they care about opens the issue picker, since its issues are what Legislators
// filters by.
function addCardHTML(l, p, empties) {
  const noTip = !p.lines.some(x => x.sec === 'tip');
  if (!empties.length && !noTip) return '';
  const b = (label, attrs) => btn(label, { kind: 'secondary', sm: true, icon: 'plus', attrs: { 'aria-haspopup': 'dialog', ...attrs } });
  const items = [...(noTip ? [b('A tip', { 'data-pftip': '1', 'aria-label': `Add a tip about ${shortName(l)}: the one thing to know before reaching out` })] : []),
    ...empties.map(s => s.k === 'cares' ? b(s.name, { 'data-pfiadd': '1', 'aria-label': `Add an issue ${shortName(l)} cares about` })
      : s.k === 'knows' ? b('I know them', { 'data-pfknow': '1', 'aria-label': `I know ${shortName(l)}: add how you know them` })
      : b(s.name, { 'data-pfadd': s.k, 'aria-label': `Add to ${s.name}, ${shortName(l)}` }))];
  return `<div class="pf-add" role="group" aria-labelledby="pf-addh"><h3 id="pf-addh">Add what we know</h3><p class="pf-addp">Nothing written here yet. Add what you know, and the team sees it on this page.</p><div class="pf-addb">${items.join('')}</div></div>`;
}
// The Profile section of a legislator's page. intro: the bills they introduced (legislator.js introducedBy). tip: false
// leaves the tip out (the v6 page shows it near the top, profileTipHTML).
export function profileHTML(l, { intro = [], tip = true } = {}) {
  const p = profileOf(l), shown = SECS.filter(s => !isEmpty(p, s)), empties = SECS.filter(s => isEmpty(p, s));
  return `<section class="lg6-sec pf" aria-labelledby="pf-h" data-pfleg="${l.id}">
    <div class="lg6-sech"><h2 id="pf-h">Profile</h2></div>
    ${DEMO ? `<p class="pf-note">${icon('info')}<span>Practice copy: lines that start with Placeholder are sample text, not facts about this legislator.</span></p>` : ''}
    ${tip ? tipHTML(l, p) : ''}
    ${shown.length ? `<div class="pf-box"><div class="pf-secs">${shown.map(s => secHTML(l, p, s, intro)).join('')}</div></div>` : ''}
    ${addCardHTML(l, p, empties)}
  </section>`;
}

// ---- changing it ----
// Repaint the page where it was and put the focus on the next thing to press (B-4: focus returns after a sheet).
function redraw(sel) {
  const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y);
  const el = sel && document.querySelector(sel); if (el) el.focus({ preventScroll: true });
}
const held = new Map();   // C-9: words typed in a sheet closed by Esc or a tap outside come back when it opens again
function lineSheet(l, sec, line = null) {
  const p = profileOf(l), tip = sec === 'tip', s = SEC[sec] || {}, knows = sec === 'knows', hk = line ? `e:${line.id}` : `a:${l.id}:${sec}`;
  const other = line && !mine(line);
  const title = tip ? (line ? (other ? `Edit ${whose(line)} tip` : 'Edit the tip') : 'Add a tip')
    : knows ? (line ? (other ? `Edit ${whose(line)} line` : 'Edit how you know them') : 'I know them')
    : line ? (other ? `Edit ${whose(line)} line` : 'Edit your line') : `Add to ${s.name}`;
  const v = held.get(hk) ?? (line ? line.body : '');
  const label = tip ? 'The one thing to know before reaching out' : knows ? 'How you know them, optional' : s.hint;
  const help = tip ? `One line. It shows at the top of ${shortName(l)}’s page only.` : s.help || '';
  const field = tip ? `<input id="pf-text" type="text" maxlength="140" autocomplete="off" value="${esc(v)}" aria-describedby="pf-help pf-err">`
    : `<textarea id="pf-text" rows="${knows ? 3 : 4}" maxlength="1000" autocapitalize="sentences" spellcheck="true" aria-describedby="pf-help pf-err">${esc(v)}</textarea>`;
  const body = `<div class="pf-sheet">
    <p class="small muted pf-for">${esc(tip ? shortName(l) : `${s.name} · ${shortName(l)}`)}</p>
    <div class="field"><label for="pf-text">${esc(label)}</label>${field}
      <span class="help" id="pf-help">${esc(help)}${line ? `${help ? ' ' : ''}The wording before your change is kept.` : ''}</span>
      <span class="err" id="pf-err" hidden>${icon('circle-alert')}Write a few words first.</span></div>
  </div>`;
  openSheet({ title: esc(title), size: 'auto', body, foot: btn(line ? 'Save changes' : 'Save', { icon: 'check', attrs: { 'data-pfsave': '1' } }),
    wire: d => {
      const ta = d.querySelector('#pf-text'), err = d.querySelector('#pf-err');
      ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch { /* not a text box */ }
      ta.oninput = () => { err.hidden = true; ta.removeAttribute('aria-invalid'); held.set(hk, ta.value); };
      if (tip) ta.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); d.querySelector('[data-pfsave]').click(); } };
      d.querySelector('[data-pfsave]').onclick = async () => {
        const words = ta.value.replace(/\s+$/, '').trim();
        if (!words && !knows) { err.hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
        held.delete(hk); await closeSheet({ silent: true });
        if (line) editLine(l, line, words); else addLine(l, p, sec, words);
      };
    } });
}
function addLine(l, p, sec, words) {
  const x = { id: uid(), sec, body: words, by: S.me.id, at: new Date().toISOString(), history: [] };
  p.lines.push(x); redraw(`[data-pfmore="${x.id}"]`);
  const where = sec === 'tip' ? 'Tip added' : sec === 'knows' ? 'Added: you know them' : `Added to ${SEC[sec].name}`;
  toast(`${where}.`, { ok: true, undo: () => { p.lines = p.lines.filter(y => y !== x); redraw(sec === 'tip' ? '[data-pftip]' : sec === 'knows' ? '[data-pfknow]' : `[data-pfadd="${sec}"]`); toast('Removed.'); } });
}
// Every change keeps the wording before it (decision 2): who wrote that version and when.
function editLine(l, x, words) {
  if (words === x.body) { redraw(`[data-pfmore="${x.id}"]`); return; }
  const before = { body: x.body, edited_at: x.edited_at || null, edited_by: x.edited_by || null, history: [...(x.history || [])] };
  x.history = [{ body: x.body, by: x.edited_by || x.by, at: x.edited_at || x.at }, ...(x.history || [])];
  Object.assign(x, { body: words, edited_at: new Date().toISOString(), edited_by: S.me.id });
  redraw(`[data-pfmore="${x.id}"]`);
  toast('Saved. The earlier wording is kept.', { ok: true, undo: () => { Object.assign(x, before); redraw(`[data-pfmore="${x.id}"]`); toast('Put back as it was.'); } });
}
// Remove acts at once and offers Undo (B-5), as a conversation's Delete does.
function removeLine(l, x) {
  const p = profileOf(l), at = p.lines.indexOf(x), s = SEC[x.sec];
  p.lines = p.lines.filter(y => y !== x);
  redraw(x.sec === 'tip' ? '[data-pftip]' : x.sec === 'knows' ? '[data-pfknow], [data-pfadd="history"]' : `[data-pfadd="${x.sec}"]`);
  toast(x.sec === 'tip' ? 'Tip removed.' : `Removed ${whose(x)} line from ${s.name}.`, { undo: () => { p.lines.splice(Math.min(at, p.lines.length), 0, x); redraw(`[data-pfmore="${x.id}"]`); toast('Put back.'); } });
}
// "Earlier wording": the words now, then each version before, newest first, with who wrote it and when. Shared with the
// conversation list (conversation.js), whose own entries keep their earlier wording on the practice copy.
export function earlierSheet({ now, versions, title = 'Earlier wording', about = '' }) {
  const one = (x, label) => `<li class="pf-ver"><p class="pf-vmeta"><b>${label}</b> · ${esc(firstOf(x.by))} · ${esc(whenAt(x.at))}</p><p class="pf-vtext">${x.body ? esc(x.body) : '<span class="muted">No words, only the name</span>'}</p></li>`;
  openSheet({ title: esc(title), size: 'auto', body: `<div class="pf-sheet">${about ? `<p class="small muted pf-for">${esc(about)}</p>` : ''}
    <ol class="pf-vers">${one(now, 'Now')}${versions.map((x, n) => one(x, n === versions.length - 1 ? 'First written' : 'Before that')).join('')}</ol></div>` });
}
const lineEarlier = (l, x) => earlierSheet({ now: { body: x.body, by: x.edited_by || x.by, at: x.edited_at || x.at }, versions: x.history || [],
  about: x.sec === 'tip' ? `Tip · ${shortName(l)}` : `${SEC[x.sec].name} · ${shortName(l)}` });
function lineMenu(l, x) {
  const name = x.sec === 'tip' ? 'Tip' : SEC[x.sec].name;
  menuSheet({ title: esc(name), items: [
    { label: 'Edit', icon: 'pencil', sub: mine(x) ? 'The earlier wording is kept' : `${firstOf(x.by)}’s line: you can change it as an admin`, run: async () => { await afterBack(); lineSheet(l, x.sec, x); } },
    x.history?.length ? { label: 'Earlier wording', icon: 'history', run: async () => { await afterBack(); lineEarlier(l, x); } } : null,
    { label: 'Remove', icon: 'trash-2', danger: true, run: () => removeLine(l, x) },
  ] });
}

// ---- What they care about: HIPHI issues (decision 6) ----
const liveIssues = () => (S.issues || []).filter(i => !i.archived_at);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// One search-and-pick sheet for an issue: adding one to a legislator, and the Legislators list's "Cares about" filter.
// counts: issue id -> how many legislators care (the filter lists those first); any: an "Any issue" choice that clears it.
export function issueSheet({ title, value = '', any = false, exclude = new Set(), counts = null, help = '', onPick }) {
  let q = '';
  const desk = (() => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } })();
  const opt = (v, label, sub, ic) => { const on = String(v) === String(value || '');
    return `<button type="button" role="radio" aria-checked="${on}" data-pfpick="${esc(v)}">${icon(ic)}<span class="body"><span class="title">${esc(label)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>${on ? icon('check', { cls: 'on' }) : ''}</button>`; };
  const list = () => {
    const t = plain(q.trim());
    const is = liveIssues().filter(i => !exclude.has(i.id) && (!t || plain(i.name).includes(t)))
      .sort((a, b) => (counts ? (counts.get(b.id) || 0) - (counts.get(a.id) || 0) : 0) || a.name.localeCompare(b.name));
    const rows = is.map(i => opt(i.id, i.name, [catByKey(i.category)?.name, counts?.get(i.id) ? `${plural(counts.get(i.id), 'legislator')} care` : ''].filter(Boolean).join(' · '), catByKey(i.category)?.icon || 'tag')).join('');
    return (any && !t ? opt('', 'Any issue', 'Show everyone again', 'circle-dashed') : '') + (rows || `<p class="pf-none">No issue matches “${esc(q.trim())}”.</p>`);
  };
  openSheet({ title: esc(title), pop: true,
    body: `${help ? `<p class="small muted sv-sh-help">${esc(help)}</p>` : ''}<div class="cv-find pf-ifind">${icon('search')}<input id="pf-iq" type="search" autocomplete="off" placeholder="Find an issue" aria-label="Find an issue" aria-controls="pf-ilist"${desk ? ' autofocus' : ''}></div>
      <div class="sv-pickl pf-ipick" id="pf-ilist" role="radiogroup" aria-label="${esc(title)}">${list()}</div>`,
    wire: d => {
      const box = d.querySelector('#pf-ilist');
      const wire = () => box.querySelectorAll('[data-pfpick]').forEach(el => el.onclick = async () => { await closeSheet({ silent: true }); await onPick(el.dataset.pfpick); });
      wire();
      d.querySelector('#pf-iq').oninput = e => { q = e.target.value; box.innerHTML = list(); wire(); };
    } });
}
function addIssue(l) {
  const p = profileOf(l), have = new Set(p.issues.map(x => String(x.issue_id)));
  issueSheet({ title: 'What they care about', help: `Pick a HIPHI issue ${shortName(l)} cares about. The Legislators list can then find everyone who does. A concern about one goes under Watch out for.`,
    exclude: new Set(liveIssues().filter(i => have.has(String(i.id))).map(i => i.id)),
    onPick: id => {
      const i = issueById(id); if (!i) return;
      const x = { issue_id: i.id, by: S.me.id, at: new Date().toISOString() };
      p.issues.push(x); redraw('[data-pfiadd]');
      toast(`${shortName(l)} cares about ${i.name}.`, { ok: true, undo: () => { p.issues = p.issues.filter(y => y !== x); redraw('[data-pfiadd]'); toast('Removed.'); } });
    } });
}
function removeIssue(l, id) {
  const p = profileOf(l), x = p.issues.find(y => String(y.issue_id) === String(id)), i = issueById(id); if (!x || !mayChange(x)) return;
  const at = p.issues.indexOf(x); p.issues = p.issues.filter(y => y !== x); redraw('[data-pfiadd]');
  toast(`Took ${i?.name || 'the issue'} off what ${shortName(l)} cares about.`, { undo: () => { p.issues.splice(at, 0, x); redraw('[data-pfiadd]'); toast('Put back.'); } });
}
// Who cares about an issue, for the Legislators filter and the issue's page (only profiles opened in this tab hold any).
export function caresIds(issueId) {
  const out = new Set();
  for (const [id, p] of Object.entries(store())) if ((p.issues || []).some(x => String(x.issue_id) === String(issueId))) out.add(+id);
  return out;
}
export function caresCounts() {
  const m = new Map();
  for (const p of Object.values(store())) for (const x of p.issues || []) m.set(x.issue_id, (m.get(x.issue_id) || 0) + 1);
  return m;
}
export const caresLegs = issueId => { const ids = caresIds(issueId); return (S.legislators || []).filter(l => ids.has(l.id)).sort((a, b) => a.chamber.localeCompare(b.chamber) || a.district - b.district); };
// An issue's page: "Legislators who care about this", in its side panel on a laptop and after the work on a phone.
export function caresSecHTML(i) {
  const ls = caresLegs(i.id);
  return `<section class="le-sec pf-cares" aria-labelledby="pf-ch"><div class="le-sechead"><h2 id="pf-ch">Legislators who care about this</h2></div>
    ${ls.length ? `<ul class="rows pf-clist">${ls.map(l => `<li><a class="row pf-crow" href="${esc(legHref(l))}">${photo(l, 32)}<span class="body"><span class="title">${esc(legName(l))}</span><span class="sub">${esc(partyDist(l))}</span></span>${icon('chevron-right', { cls: 'chev' })}</a></li>`).join('')}</ul>`
      : '<p class="le-none">None yet. Add this issue under What they care about on a legislator’s page.</p>'}
  </section>`;
}

// ---- search (decision 6a): profile lines and tips, as a "Profiles" group ----
export function profileHits(q) {
  const res = plain(q).split(/\s+/).filter(Boolean).map(t => new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  if (!res.length) return [];
  const out = [];
  for (const [id, p] of Object.entries(store())) {
    const l = (S.legislators || []).find(x => x.id === +id); if (!l) continue;
    for (const x of p.lines || []) {
      // "Kevin knows them" by name here, even to Kevin, so searching a teammate's name finds whom they know
      const said = x.sec === 'knows' ? `${String(advocate(x.by)?.full_name || 'Someone').split(' ')[0]} knows them${x.body ? ': ' + x.body : ''}` : x.body;
      if (!said || !res.every(re => re.test(plain(said)))) continue;
      out.push({ l, x, said, sec: x.sec === 'tip' ? 'Tip' : SEC[x.sec].name, href: `${legHref(l)}?pf=${encodeURIComponent(x.id)}` });
    }
  }
  return out.sort((a, b) => String(b.x.edited_at || b.x.at).localeCompare(String(a.x.edited_at || a.x.at)));
}
// What was written: the whole sentence with the first word searched for, so the reason the result is here shows and
// nothing is cut (A-1; the critic: a typed "…" is still cut). `n` is kept for callers; a sentence is never shortened.
export function quoteOf(text, q, n = 110) { void n; return sentenceWith(text, q); }
export function sentenceWith(text, q) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(), low = plain(t);
  const at = plain(q).split(/\s+/).filter(Boolean).map(w => low.indexOf(w)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  for (const m of t.matchAll(/[^.!?]+(?:[.!?]+["”’)]*|$)\s*/g)) if (at < m.index + m[0].length) return m[0].trim();
  return t;
}

// ---- wiring (legislator.js calls this after each paint) ----
let landed = '';
addEventListener('hashchange', () => { if (!landId()) landed = ''; });
export function wireProfile(root, l) {
  // The tip near the top of the page and the Profile section are two boxes; both are wired.
  root?.querySelectorAll('.pf').forEach(box => wireBox(box, l));
}
function wireBox(box, l) {
  const p = profileOf(l), find = id => p.lines.find(x => x.id === id);
  box.querySelectorAll('[data-pfadd]').forEach(el => el.onclick = () => lineSheet(l, el.dataset.pfadd));
  box.querySelectorAll('[data-pfknow]').forEach(el => el.onclick = () => lineSheet(l, 'knows'));
  box.querySelectorAll('[data-pftip]').forEach(el => el.onclick = () => lineSheet(l, 'tip'));
  box.querySelectorAll('[data-pfmore]').forEach(el => el.onclick = () => { const x = find(el.dataset.pfmore); if (x && mayChange(x)) lineMenu(l, x); });
  box.querySelectorAll('[data-pfed]').forEach(el => el.onclick = () => { const x = find(el.dataset.pfed); if (x) lineEarlier(l, x); });
  box.querySelectorAll('[data-pfall]').forEach(el => el.onclick = () => { (S.pfMore ??= new Set()).add(el.dataset.pfall); redraw(`[data-pfsec="${el.dataset.pfall.split('|')[1]}"] [data-pfmore], [data-pfsec="${el.dataset.pfall.split('|')[1]}"] h3`); });
  box.querySelectorAll('[data-pfiadd]').forEach(el => el.onclick = () => addIssue(l));
  box.querySelectorAll('[data-pfirm]').forEach(el => el.onclick = () => removeIssue(l, el.dataset.pfirm));
  // A search result opened this page at one line (?pf=): it comes into view and takes the focus, once per arrival.
  const k = landId(), el = k && landed !== location.hash ? box.querySelector(`[data-pfline="${CSS.escape(k)}"]`) : null;
  if (el) { landed = location.hash; setTimeout(() => { if (!el.isConnected) return; el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }, 60); }
}
