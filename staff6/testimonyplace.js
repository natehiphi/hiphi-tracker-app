// Staff v6 (R-336 V12, V25, spec 3.3 and 6): the Testimony place. v5 had no place for testimony: drafts lived on Today
// (a ready-to-file one folded under "+2 on this bill"), Review had no door, the Capitol form's answers lived in Help, and
// writers who own nothing saw a draft only the day it was due (assessment X5, X22). Here every testimony the team has in
// hand is a task list grouped by the five state words (steps.js testimonyState), one page tab each:
//   To write (Writing) · To approve (With an approver, Second look) · Sent back (Writing, sent back) · Ready to file ·
//   Filed (this session; the earlier testimony library is #/testimony?view=library) · Missed (only when any)
// It opens on To approve for approvers with something to approve, else To write when the person has something to write,
// else the first tab with something of theirs, else the first with anything. Each tab lists the person's own steps first
// ("For you") and the team's after them, each row a name, the number and one line ("Kris, Jess or Nate approves · due
// today 3:00 PM"); a shared approval is one row, never four people's (V12). The picked row opens beside the list
// (listDetail, V17) as the step card (steps.js stepCard, V07): its buttons for the person's own step, a status line for
// anyone else's. A step that is Ready to file is the filing card (filing.js, V25), 0 clicks to find from Today and at most
// 3 steps. Writer, no migration (spec 6 fallback for W6): whoever sent the draft, else the coalition's helpers and the
// owner, from the day the notice lands (steps.js writersOf). Review mode (#/review) is opened from To approve.
// Route: { name: 'testimony', view } (app.js parseRoute); ?view=write|approve|sent|file|filed|missed|library.
import { S, DB, esc, hooks, SESSION_YEAR, SESSION_OVER } from './data.js';
import { draftHearing, billById, alertsToReview, approves, standingIn, whenAt, lateLine, billRoute, isDecision } from './model.js';
import { icon, btn, sectionNav, toast } from './ui.js';
import { billStep, billRow, listDetail, wireListDetail, ldPicked, stepCard, committeeName, numWords, nameWords, sayWords, notFiled, dayWords, testimonyState, nw, firstWords } from './steps.js';
import { closeBtn, aboutBill } from './billpane.js';
import { filingSteps } from './filing.js';
import { renderEarlier, wireTestimony } from './testimony.js';
import { queue } from './review.js';

const DAY = 864e5;
const ms = t => t == null || t === '' ? null : new Date(t).getTime();
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const lower = s => s ? s[0].toLowerCase() + s.slice(1) : s;
const yearOf = t => t ? +new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }).slice(0, 4) : null;
const TABS = ['write', 'approve', 'sent', 'file', 'filed', 'missed'];
const TAB_WORD = { write: 'To write', approve: 'To approve', sent: 'Sent back', file: 'Ready to file', filed: 'Filed', missed: 'Missed' };
const LIMIT = 8, FILED_LIMIT = 15, LIB_LIMIT = 25;

// ---- every testimony in hand, once per render ----
// A draft (not cancelled; a monitor bill's automatic draft only once someone has touched it, as on Today), and a set
// hearing on a bill with a position and no draft yet (Writing: the writer sees it from the day the notice lands). A
// decision-making sitting takes no testimony (R-316 W49), so it never asks for a draft.
function collect() {
  const now = Date.now(), out = [];
  for (const ds of Object.values(S.drafts || {})) for (const d of ds) {
    if (d.status === 'cancelled') continue;
    const b = billById(d.bill_id); if (!b || b.tracked === false) continue;
    if (b.position === 'monitor' && !d.submitted_at && !d.review_note && d.status !== 'filed') continue;
    const h = draftHearing(d), st = testimonyState(d, b, { h }); if (!st) continue;
    const tab = st.key === 'write' ? (st.sentBack ? 'sent' : 'write') : st.key === 'second' ? 'approve' : st.key;
    if (tab === 'missed' && !h) continue;
    out.push({ key: String(d.id), b, d, h, st, tab, recorded: tab === 'missed' && notFiled(d, b) });
  }
  if (!S.failed?.('testimony drafts')) for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || ms(h.scheduled_at) <= now || isDecision(h)) continue;
    const b = billById(h.bill_id); if (!b || b.tracked === false || b.position === 'monitor') continue;
    if ((S.drafts?.[b.id] || []).some(d => d.committee === h.committee && d.status !== 'cancelled')) continue;
    out.push({ key: 'h' + h.id, b, d: null, h, st: testimonyState(null, b, { h }), tab: 'write' });
  }
  for (const it of out) { it.s = billStep(it.b, { d: it.d, h: it.h }); it.own = !!it.s?.you; }
  return out.filter(it => it.s);
}
// Filed: this session's filings (the year the hearing sat, else the year it was filed), newest first. Between sessions the
// last session's, said so. Everything older is the library's.
const filedWhen = it => ms(it.h?.scheduled_at) ?? ms(it.d?.filed_at) ?? 0;
function filedYear(all) {
  const years = all.filter(it => it.tab === 'filed').map(it => yearOf(it.h?.scheduled_at || it.d?.filed_at)).filter(Boolean);
  return years.includes(SESSION_YEAR) ? SESSION_YEAR : years.length ? Math.max(...years) : SESSION_YEAR;
}
// Missed is the session's record too: the sittings of the year the Filed tab shows.
function model() {
  const all = collect(), fy = filedYear(all);
  const tabs = Object.fromEntries(TABS.map(t => [t, []]));
  for (const it of all) {
    if (it.tab === 'filed' && yearOf(it.h?.scheduled_at || it.d?.filed_at) !== fy) continue;
    if (it.tab === 'missed' && yearOf(it.h.scheduled_at) !== fy) continue;
    tabs[it.tab]?.push(it);
  }
  const soon = (x, y) => (x.s.off ? 1 : 0) - (y.s.off ? 1 : 0) || (x.s.due ?? Infinity) - (y.s.due ?? Infinity) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true });
  for (const t of ['write', 'approve', 'sent', 'file']) tabs[t].sort(soon);
  tabs.filed.sort((x, y) => filedWhen(y) - filedWhen(x));
  // Missed: the ones still asking "Did we file?" (the two days after the sitting) first, then the record, newest first.
  const asking = it => !it.recorded && ms(it.h.scheduled_at) >= Date.now() - 2 * DAY;
  tabs.missed.sort((x, y) => (asking(y) ? 1 : 0) - (asking(x) ? 1 : 0) || ms(y.h.scheduled_at) - ms(x.h.scheduled_at));
  for (const it of tabs.missed) if (!asking(it)) it.own = false;   // past answering: the record, nobody's step
  const mine = t => tabs[t].filter(it => it.own);
  return { tabs, mine, fy };
}
// The tab it opens on (spec 3.3).
function openOn(m) {
  if ((approves(S.me) || S.me?.is_reviewer) && m.mine('approve').length) return 'approve';
  if (m.mine('write').length) return 'write';
  // Between sessions nothing is in hand: the session's record (Filed, with the library) is where it opens.
  return TABS.find(k => k !== 'filed' && m.mine(k).length) || TABS.find(k => m.tabs[k].length) || 'write';
}

// ---- rows ----
// One line per row (V04, D15): the person's own step says its verb and its one time (steps.js actBy, the same words as
// the card); someone else's says who, then when testimony is due. The tab already says the state, so rows do not repeat it.
function lineOf(it) {
  const { s, st, tab } = it, cm = it.h ? committeeName(it.h.committee) || it.h.committee : '';
  if (tab === 'filed') { const by = it.d.filed_by ? (it.d.filed_by === S.me?.id ? 'you' : firstWords(it.d.filed_by)) : '';
    return `Filed${by ? ` by ${by}` : ''}${it.d.filed_at ? ` ${dayWords(it.d.filed_at)}` : ''}${cm ? ` · ${cm}` : ''}`; }
  if (tab === 'missed') return it.recorded ? `Missed · noted on the bill · ${cm}` : `Missed · the hearing started ${whenAt(it.h.scheduled_at)}`;
  if (s.off) return `${st.word} · hearing cancelled, no new date yet`;
  const late = s.status.tone === 'late', when = late ? lateLine(s.until, { lower: true }) : s.due != null ? `due ${whenAt(s.due)}` : '';
  if (s.you) {
    if (['late', 'overdue'].includes(s.status.tone)) return s.line;
    const act = s.act?.words ? lower(s.act.words) : when;
    if (s.kind === 'second') return `Second look · ${act}`;
    // F44: a second approver standing in says for whom ("Standing in for Kris or Nate").
    if (s.kind === 'approve' && it.d?.status === 'review' && standingIn(S.me, it.h)) {
      const main = s.whose.ids.filter(id => id !== S.me?.id && (S.advocates || []).some(a => a.id === id && (a.is_admin || a.can_approve)));
      return `Standing in${main.length ? ` for ${main.map(id => firstWords(id)).join(main.length > 2 ? ', ' : ' or ').replace(/, ([^,]*)$/, ' or $1')}` : ''} · ${act}`;
    }
    // F39: the bill changed since the draft was written; the card says to which version.
    if (st.stale && st.key === 'write') return `The bill changed: check your testimony · ${act}`;
    return s.line;
  }
  if (s.nobody) return ['No one holds it', when].filter(Boolean).join(' · ');
  const who = cap(s.whose.words);
  const what = { nodraft: `${who} makes the draft`, write: `${who} writes it`, submit: `${who} writes it`, revise: `${who} revises it`,
    approve: `${who} approves`, second: `Second look from ${who}`, file: `${who} files it` }[s.kind] || st.word;
  return [what, when].filter(Boolean).join(' · ');
}
// Filed and Missed rows are said plainly: the tab already says so, and a column of green ticks or grey crosses is a wall of
// one colour (status by exception, D3).
// Rows here wrap a long name or line rather than cut it (cls tp-r, testimony.css): a joint committee's name is long.
const rowOf = (it, picked) => billRow(it.b, { ...(['filed', 'missed'].includes(it.tab) && !it.own ? { step: it.s, line: nw(esc(lineOf(it))) } : { step: { ...it.s, line: lineOf(it) } }), pick: it.key, selected: it.key === picked, cls: 'tp-r' });
const gh = (text, id) => `<div class="tp-gh" role="listitem"><h2 class="tp-ghh" id="${esc(id)}">${esc(text)}</h2></div>`;
const moreBtn = (view, n) => `<div class="tp-more" role="listitem">${btn(`Show all ${n}`, { kind: 'text', icon: 'chevron-down', attrs: { 'data-tpall': view } })}</div>`;
function listRows(view, items, picked) {
  const all = (S.tpAll ??= {})[view];
  if (view === 'filed') return (all ? items : items.slice(0, FILED_LIMIT)).map(it => rowOf(it, picked)).join('') + (items.length > FILED_LIMIT && !all ? moreBtn(view, items.length) : '');
  const own = items.filter(it => it.own), team = items.filter(it => !it.own), shown = all ? team : team.slice(0, LIMIT);
  return `${own.length ? gh('For you', `tp-g-${view}-you`) + own.map(it => rowOf(it, picked)).join('') : ''}${team.length ? gh(view === 'missed' ? 'The record' : 'The team’s', `tp-g-${view}-team`) + shown.map(it => rowOf(it, picked)).join('') : ''}${team.length > shown.length ? moreBtn(view, team.length) : ''}`;
}

// ---- the open item: the step card, and the filing card for a step that is Ready to file ----
function detailOf(it, view) {
  const { b, d, h } = it, s = billStep(b, { d, h }), own = !!s?.you, primary = view !== 'approve';
  let card = stepCard(b, { where: 'testimony', d, h, named: false, primary, from: 'testimony', id: `tp-s-${esc(it.key)}` });
  // V25: the viewer's own filing is the filing card's four steps in place of the card's buttons (a stepCard option for
  // this is asked of the integrator; until then the buttons' box is swapped for the steps).
  if (s?.kind === 'file' && own && d) card = card.replace(/<div class="v6-step-acts">[\s\S]*?<\/div>/, `<div class="tp-filing">${filingSteps(b, d, { inline: true, primary })}</div>`);
  const extra = [];
  // F46: the writer can take it back from review until it is approved (as the bill page's Withdraw).
  if (d && ['review', 'second_review'].includes(d.status) && d.submitted_by === S.me?.id && !own)
    extra.push(btn('Withdraw from review', { kind: 'text', icon: 'undo-2', attrs: { 'data-tpwd': d.id, 'data-v6b': b.id } }));
  if (d?.status === 'filed') {
    if (d.filed_url) extra.push(btn('Capitol confirmation', { kind: 'text', iconEnd: 'external-link', href: d.filed_url, target: '_blank' }));
    if (d.doc_url) extra.push(btn('Open Doc', { kind: 'text', icon: 'file-text', iconEnd: 'external-link', href: d.doc_url, target: '_blank' }));
  }
  // The bill's other testimony in hand, in the state words (never folded into "+N on this bill": V12).
  const others = (S.drafts?.[b.id] || []).filter(x => x !== d && !['cancelled', 'filed'].includes(x.status)).map(x => ({ x, t: testimonyState(x, b) })).filter(o => o.t && o.t.key !== 'missed');
  const also = others.length ? `<section class="v6-also" aria-labelledby="tp-also-h"><h3 class="v6-also-h" id="tp-also-h">Also on this bill</h3><ul class="v6-also-list">${others.slice(0, 3).map(o => `<li class="v6-also-item"><span class="v6-also-t">${esc(committeeName(o.x.committee) || o.x.committee)} · ${esc(o.t.word)}</span></li>`).join('')}</ul></section>` : '';
  const about = aboutBill(b, { hearing: !h });
  return `<div class="v6-item tp-item" data-v6item="${esc(b.id)}">
    <div class="v6-item-top"><p class="v6-item-num">${esc(numWords(b))}</p><a class="v6-item-open" href="${esc(billRoute(b))}" data-bill="${esc(b.id)}"><span>Open the bill</span>${icon('arrow-right')}</a>${closeBtn()}</div>
    <h2 class="v6-item-name" id="tp-item-h" tabindex="-1">${esc(nameWords(b, 160))}</h2>
    ${card}
    ${extra.length ? `<div class="tp-extra">${extra.join('')}</div>` : ''}
    ${also}
    ${about ? `<div class="v6-item-doors"><details class="v6-item-det"${S.v6About?.[b.id] ? ' open' : ''} data-v6about="${esc(b.id)}"><summary class="v6-item-door">${icon('info')}<span>About this bill</span>${icon('chevron-down')}</summary><div class="v6-item-about">${about}</div></details></div>` : ''}
  </div>`;
}

// ---- the earlier testimony library (F118, #/testimony?view=library): every bill with filed testimony, newest first;
// the picked bill opens beside the list as testimony.js draws it (its own parts and the search across all testimony) ----
function library() {
  const by = new Map();
  for (const d of Object.values(S.drafts || {}).flat()) {
    if (d.status !== 'filed') continue;
    const b = billById(d.bill_id); if (!b) continue;
    const at = ms(draftHearing(d)?.scheduled_at) ?? ms(d.filed_at) ?? 0, e = by.get(b.id) || { b, n: 0, at: -1, d: null };
    e.n++; if (at >= e.at) { e.at = at; e.d = d; } by.set(b.id, e);
  }
  return [...by.values()].sort((x, y) => y.at - x.at);
}
const libDay = at => yearOf(at) !== SESSION_YEAR ? new Date(at).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'Pacific/Honolulu' }) : dayWords(at);
const libLine = e => `Filed ${e.n === 1 ? 'once' : `${e.n} times`}${e.at > 0 ? ` · ${e.n === 1 ? '' : 'newest '}${libDay(e.at)}` : ''}`;
function libDetail(e) {
  const b = e.b;
  return `<div class="v6-item tp-item tp-libitem" data-v6item="${esc(b.id)}">
    <div class="v6-item-top"><p class="v6-item-num">${esc(numWords(b))}</p><a class="v6-item-open" href="${esc(billRoute(b))}" data-bill="${esc(b.id)}"><span>Open the bill</span>${icon('arrow-right')}</a>${closeBtn()}</div>
    <h2 class="v6-item-name" id="tp-item-h" tabindex="-1">${esc(nameWords(b, 160))}</h2>
    <div class="tp-earlier">${renderEarlier(b, { open: true })}</div>
  </div>`;
}
function renderLibrary() {
  const libs = library(), id = 'tp-library', picked = ldPicked(id), q = String(S.tpLibQ || '').trim().toLowerCase();
  const hit = e => !q || [e.b.bill_number, numWords(e.b), nameWords(e.b, 200), e.d ? committeeName(e.d.committee) : ''].join(' ').toLowerCase().includes(q);
  const shown = libs.filter(hit), all = (S.tpAll ??= {}).library || q, list = all ? shown : shown.slice(0, LIB_LIMIT);
  const pe = picked != null ? libs.find(e => String(e.b.id) === String(picked)) : null;
  const rows = list.map(e => billRow(e.b, { line: nw(esc(libLine(e))), button: false, pick: String(e.b.id), selected: !!pe && e === pe, cls: 'tp-r' })).join('')
    + (shown.length > list.length ? moreBtn('library', shown.length) : '');
  return `${head('filed')}
    <div class="tp-sub"><a class="tp-backlink" href="#/testimony?view=filed">${icon('chevron-left')}<span>Filed</span></a>
      <h2 class="tp-h2">Earlier testimony library</h2>
      <p class="tp-intro">Every testimony the tracker has filed, newest first. Pick a bill to read what HIPHI wrote and borrow from it.</p>
      <div class="tp-find">${icon('search')}<label class="sr" for="tp-libq">Filter the library</label><input id="tp-libq" type="search" autocomplete="off" placeholder="Filter by bill or committee" value="${esc(S.tpLibQ || '')}"></div></div>
    ${shown.length ? listDetail({ id, label: 'Bills with earlier testimony', rows, picked: pe ? String(pe.b.id) : null, detail: pe ? libDetail(pe) : '', empty: 'Pick a bill to see its earlier testimony' })
      : `<p class="tp-none">${q ? `No filed testimony matches “${esc(S.tpLibQ)}”.` : 'No filed testimony yet.'}</p>`}`;
}

// ---- the page ----
function head(cur, m) {
  const hide = !m || !m.tabs.missed.length ? ['missed'] : [];
  const counts = m ? Object.fromEntries(['write', 'approve', 'sent', 'file', 'missed'].map(t => [t, m.mine(t).length]).filter(([, n]) => n)) : {};
  return `<h1 class="v6-ptitle sv-h1 tp-h1">Testimony</h1>${sectionNav('testimony', cur, { hide, counts })}`;
}
// One calm line per tab under the tabs: what it holds. To approve also starts Review (F41, F42) and says how many
// supporter emails wait in Outreach › Emails (F172).
function intro(view, m) {
  const n = m.mine(view).length;
  // An empty tab says it once, in its empty box (A-14); To approve keeps its emails line, Filed its library.
  if (!m.tabs[view].length && !['approve', 'filed'].includes(view)) return '';
  switch (view) {
    case 'write': return `<p class="tp-intro">${n ? 'Testimony to write, from the day its hearing notice lands. Send each for approval by the time on its row.' : 'Nothing for you to write right now. A draft shows here the day its hearing notice lands.'}</p>`;
    case 'approve': {
      const q = queue().filter(x => x.type === 'draft').length, mails = approves(S.me) ? alertsToReview().length : 0;
      const start = q ? `<div class="tp-start"><p class="tp-intro">${q === 1 ? '1 waits for you' : `${q} wait for you`}, the soonest first. Review shows one at a time, then moves on.</p>${btn('Start review', { kind: 'primary', icon: 'user-check', href: '#/review' })}</div>`
        : `<p class="tp-intro">${approves(S.me) || S.me?.is_reviewer ? 'Nothing waits for your approval.' : 'Testimony with an approver, or waiting for its second look.'}</p>`;
      const em = mails ? `<a class="tp-emails" href="#/outreach/emails">${icon('mail')}<span>${mails === 1 ? '1 supporter email to approve' : `${mails} supporter emails to approve`}</span><span class="tp-open">Open</span>${icon('chevron-right')}</a>` : '';
      return !q && !m.tabs.approve.length ? em : start + em;
    }
    case 'sent': return `<p class="tp-intro">${n ? 'An approver asked for changes: read the note, revise it in the Doc, then resubmit.' : 'Nothing has come back to you for changes.'}</p>`;
    case 'file': return `<p class="tp-intro">${n ? 'Approved testimony. Each has its filing steps: the PDF, the Capitol page and the form’s answers.' : 'Nothing for you to file right now.'}</p>`;
    case 'filed': return `<div class="tp-start"><p class="tp-intro">${m.fy === SESSION_YEAR && !SESSION_OVER ? 'Filed this session, newest first.' : `Filed in the ${m.fy} session, newest first.`}</p>${btn('Earlier testimony library', { kind: 'secondary', icon: 'book-open', href: '#/testimony?view=library' })}</div>`;
    case 'missed': return '<p class="tp-intro">Hearings that started with nothing filed, noted for the team with nobody blamed.</p>';
  }
  return '';
}
const EMPTY = { write: 'Nothing to write right now. A draft shows here the day its hearing notice lands.', approve: 'Nothing is with an approver right now.', sent: 'Nothing has come back for changes.', file: 'Nothing is ready to file right now.', filed: 'Nothing filed yet this session.', missed: 'Nothing missed.' };
function render(route) {
  if (!S.me) return '<p>No staff record yet. Ask your admin to add you.</p>';
  if (route.view === 'library') { S.tpView = 'library'; return `<div class="tp">${renderLibrary()}</div>`; }
  const m = model(), view = TABS.includes(route.view) && (route.view !== 'missed' || m.tabs.missed.length) ? route.view : openOn(m);
  S.tpView = view;
  const items = m.tabs[view], id = `tp-${view}`;
  let picked = ldPicked(id); const pit0 = picked != null ? items.find(it => it.key === String(picked)) : null;
  // Below 1100px the picked item is a page of its own: arriving at the tab by a link (not Back to the item's own history
  // entry, not a redraw after a step) shows the list, so a tab never opens on something picked an hour ago.
  const narrow = !matchMedia('(min-width: 1100px)').matches, stale = narrow && pit0 && !history.state?.panel;
  const pit = stale ? null : pit0;
  if (picked != null && !pit) { S.v6ld[id].key = null; picked = null; }   // its step moved on (approved, filed), or a fresh arrival
  return `<div class="tp" data-tpview="${esc(view)}">${head(view, m)}${intro(view, m)}
    ${items.length ? listDetail({ id, label: `Testimony: ${TAB_WORD[view]}`, rows: listRows(view, items, picked), picked, detail: pit ? detailOf(pit, view) : '' })
      : `<div class="tp-empty"><p>${icon('circle-check')}<span>${esc(EMPTY[view])}</span></p></div>`}</div>`;
}
function wire(route, root) {
  const view = S.tpView, id = `tp-${view}`;
  if (view === 'library') {
    const libs = library(), find = key => libs.find(x => String(x.b.id) === String(key));
    wireListDetail(root, { id, open: key => { const e = find(key); return e ? libDetail(e) : ''; },
      onChange: key => { const e = key != null && find(key), box = root.querySelector('.tp-libitem'); if (e && box) wireTestimony(box, e.b); } });
    const open = root.querySelector('.tp-libitem'), e = open && find(open.dataset.v6item); if (e) wireTestimony(open, e.b);
    const q = root.querySelector('#tp-libq');
    if (q) q.addEventListener('input', () => { S.tpLibQ = q.value; hooks.render(); const n = document.getElementById('tp-libq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
  } else {
    wireListDetail(root, { id, open: key => { const it = model().tabs[view].find(x => x.key === String(key)); return it ? detailOf(it, view) : ''; } });
  }
  root.querySelectorAll('[data-tpall]').forEach(b => b.addEventListener('click', () => { (S.tpAll ??= {})[b.dataset.tpall] = true; hooks.render(); }));
  // The frame gives every #/ link its own click (app.js wireFrame), which ran before listDetail's and opened the bill's
  // page instead of the item beside the list. Once the frame has wired the page, each row's link is swapped for a copy
  // without it, so a click opens the item (and Cmd-click still opens the bill). Shared change asked: wireFrame to skip
  // a[data-v6pick]. Links in an item drawn later go through S.go, as the frame's do.
  queueMicrotask(() => root.querySelectorAll('.v6-ld a.v6-row-main[data-v6pick]').forEach(a => a.replaceWith(a.cloneNode(true))));
  const aside = root.querySelector('.v6-ld-detail');
  aside?.addEventListener('click', e => {
    const a = e.target?.closest?.('a[href^="#/"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    e.preventDefault(); S.go(a.getAttribute('href'));
  });
}
// F46: Withdraw from review, in the open item (the Undo toast after Send for approval does it too, steps.js). One
// listener, so the item works however wireListDetail redraws it.
document.addEventListener('click', async e => {
  const w = e.target?.closest?.('[data-tpwd]'); if (!w) return;
  e.preventDefault();
  const b = billById(w.dataset.v6b), d = b && (S.drafts?.[b.id] || []).find(x => String(x.id) === w.dataset.tpwd); if (!b || !d) return;
  w.setAttribute('aria-busy', 'true'); w.disabled = true;
  try {
    await DB.transition(b.id, d.id, 'withdraw'); hooks.render();
    toast(`Withdrawn. ${sayWords(b)} is back in Writing with you.`, { undo: async () => { await DB.transition(b.id, d.id, 'submit'); hooks.render(); toast('Sent for approval again.'); } });
  } catch (err) { toast(err, { err: true }); if (w.isConnected) { w.removeAttribute('aria-busy'); w.disabled = false; } }
});

export default {
  tab: 'testimony',
  title: () => 'Testimony',
  render, wire,
};
