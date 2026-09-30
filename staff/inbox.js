// Inbox (#/inbox, R-106 part 2, Nate 9/30: "Add 1, 2 and 3 to the new staff app"): everything addressed to you, read
// or unread, in one place. Today turns the unread items into work (a reply, a draft to approve) and folds the Capitol's
// news into "What changed"; once they are done or read they leave Today. The Inbox is where they stay, the way the old
// app's Inbox page kept them (app.js renderInbox). Same data (my_inbox, migration 032) and the same two piles:
//   - Needs you: messages to you and @mentions, testimony steps, reminders. Only these are counted.
//   - Updates: the Capitol's actions on the bills you own or follow, one block per bill, never counted, gone after a week.
// Anything can be marked read or unread, with Undo. "Mark read" clears the list you are looking at, never the other pile.
// Keys (a keyboard and mouse; My settings can switch them off): j and k move, Enter opens, e marks read or unread,
// Shift+A marks the list read. Testimony notices clear themselves once the draft is filed, reminders after the hearing.
import { S, DB, DEMO, esc, fmtDate, fmtDT, hooks } from './data.js';
import { inboxRows, inboxCount, unslack, billById, billNum, blurb, canFirstApprove, canSecondApprove } from './model.js';
import { icon, btn, iconBtn, empty, toast, keysOn } from './ui.js';
import { sandboxInbox, hearingFor } from './today.js';

const KINDS = [['message', 'Messages'], ['testimony', 'Testimony'], ['deadline', 'Deadlines'], ['hearing', 'Hearings'], ['status', 'Status'], ['system', 'System']];
const KIND_ICON = { message: 'message-square', testimony: 'file-text', deadline: 'clock', hearing: 'gavel', status: 'arrow-right', system: 'settings' };
const view = () => S.inboxView ??= { tab: 'needs', kind: '', unreadOnly: false, sort: 'new', q: '', group: true };
const hover = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const wide = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return true; } };
const ago = iso => { const h = (Date.now() - new Date(iso)) / 36e5; return h < 0 ? fmtDT(iso) : h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : h < 24 * 7 ? `${Math.round(h / 24)}d ago` : fmtDate(iso); };
const itemOf = key => (S.inbox || []).find(i => i.key === key);
// Where a row opens: a message on the bill's Activity (where the reply box is), a testimony step on its Testimony tab,
// news on its Activity, anything else on the bill's Overview. A row about no bill (a system notice) opens nothing.
function hrefOf(i) {
  const b = i.bill_id && billById(i.bill_id); if (!b) return '';
  const tab = i.kind === 'testimony' ? 'testimony' : i.kind === 'message' || !i.direct ? 'activity' : '';
  return `#/bill/${encodeURIComponent(b.bill_number)}${tab ? '/' + tab : ''}`;
}
// A testimony step that is yours to approve gets the Review button (the same queue as Today's "Approve"); the rules are
// the database's (098): an admin or an approver first, a stand-in near the deadline, a reviewer for the second.
function reviewAct(i) {
  if (i.kind !== 'testimony' || !i.bill_id) return '';
  const d = (S.drafts?.[i.bill_id] || []).find(x => x.status === 'review' || x.status === 'second_review'); if (!d) return '';
  const h = hearingFor(d);
  const mine = d.status === 'review' ? canFirstApprove(S.me, d, h) : canSecondApprove(S.me, d);
  return mine ? `<div class="ib-rev">${btn(d.status === 'review' ? 'Review it' : 'Give the second approval', { kind: 'secondary', sm: true, icon: 'user-check', href: `#/review/${encodeURIComponent(d.id)}`, attrs: { 'data-ibkey': i.key } })}</div>` : '';
}
// The button shows what it does: a tick marks the row read, a dot (the unread mark) marks it unread again. Envelopes
// read as the row's state rather than the button's action (9/30 review, A-18).
const readBtn = (key, unread) => iconBtn(unread ? 'check' : 'circle-dot', unread ? 'Mark read' : 'Mark unread', { 'data-ibtoggle': key }, 'ib-read');

// In a bill's own block (Updates) the block names the bill, so its rows do not say it again (A-14).
function item(i, inBlock = false) {
  const b = i.bill_id && billById(i.bill_id), href = hrefOf(i);
  const inner = `<span class="ib-ic" aria-hidden="true">${icon(KIND_ICON[i.kind] || 'circle')}</span>
    <span class="ib-body"><span class="ib-l1">${i.unread ? '<span class="sr">Unread: </span>' : ''}${b && !inBlock ? `<b class="ib-num">${esc(billNum(b))}</b>${i.priority === 1 ? '<span class="sv-p1">P1</span>' : ''} ` : ''}<span class="ib-t">${esc(unslack(i.title))}</span></span>
      ${i.body ? `<span class="ib-sub">${esc(unslack(i.body).slice(0, 220))}</span>` : ''}<span class="ib-when m">${esc(ago(i.at))}</span></span>
    <span class="ib-when d" title="${esc(fmtDT(i.at))}">${esc(ago(i.at))}</span>`;
  return `<div class="ib-row${i.unread ? ' unread' : ''}" data-key="${esc(i.key)}">
    ${href ? `<a class="ib-main" href="${esc(href)}" data-ibopen="${esc(i.key)}">${inner}</a>` : `<div class="ib-main">${inner}</div>`}
    <span class="ib-acts">${readBtn(i.key, i.unread)}</span>${reviewAct(i)}</div>`;
}
// The same notice on three or more bills (a deadline reminder, a status sweep) is one row that opens into each.
const dupKey = i => `${i.kind}|${unslack(i.title || '')}|${unslack(i.body || '')}`;
function dupRow(k, list) {
  const i = list[0], un = list.filter(x => x.unread).length, open = (S.ibOpenDup ||= new Set()).has(k);
  return `<div class="ib-dup${open ? ' open' : ''}"><div class="ib-row${un ? ' unread' : ''}" data-key="${esc(i.key)}" data-dup="${esc(k)}">
      <button type="button" class="ib-main" data-ibdup="${esc(k)}" aria-expanded="${open}">
        <span class="ib-ic" aria-hidden="true">${icon(KIND_ICON[i.kind] || 'circle')}</span>
        <span class="ib-body"><span class="ib-l1">${un ? '<span class="sr">Unread: </span>' : ''}<b>${list.length} bills</b> <span class="ib-t">${esc(unslack(i.title))}</span></span>
          <span class="ib-sub">${esc(list.map(x => x.bill_number || '').filter(Boolean).join(' · '))}</span><span class="ib-when m">${esc(ago(i.at))}</span></span>
        <span class="ib-when d">${esc(ago(i.at))}</span>${icon(open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>
      <span class="ib-acts">${iconBtn(un ? 'check' : 'circle-dot', un ? `Mark all ${list.length} read` : `Mark all ${list.length} unread`, { 'data-ibduptoggle': k }, 'ib-read')}</span></div>
    ${open ? `<div class="ib-dupitems">${list.map(i => item(i)).join('')}</div>` : ''}</div>`;
}
function listBody(rows, v) {
  const grouped = v.group && v.sort !== 'pri' && (v.tab === 'updates' || v.sort === 'bill');
  if (grouped) {
    const by = new Map(); for (const i of rows) { const k = i.bill_id || 'none'; if (!by.has(k)) by.set(k, []); by.get(k).push(i); }
    return [...by.entries()].map(([k, list]) => {
      const b = k !== 'none' && billById(k), un = list.filter(i => i.unread).length;
      const name = b ? `<a class="ib-gname" href="#/bill/${encodeURIComponent(b.bill_number)}/activity"><b>${esc(billNum(b))}</b>${b.priority === 1 ? '<span class="sv-p1">P1</span>' : ''}<span>${esc(b.nickname || blurb(b, 80))}</span></a>` : '<b class="ib-gname">Not about one bill</b>';
      return `<section class="ib-group" aria-label="${esc(b ? billNum(b) : 'Not about one bill')}"><div class="ib-ghead">${name}
          ${un ? `<span class="ib-gacts"><span class="ib-gnew">${un} unread</span><button type="button" class="linkbtn ib-gread" data-ibgroup="${esc(k)}">Mark read</button></span>` : ''}</div>
        <div class="rows">${list.slice(0, 4).map(i => item(i, !!b)).join('')}</div>
        ${list.length > 4 && b ? `<a class="ib-gmore" href="#/bill/${encodeURIComponent(b.bill_number)}/activity">All ${list.length} on its Activity tab</a>` : ''}</section>`;
    }).join('');
  }
  const seen = new Map(), order = [];
  for (const i of rows.slice(0, 200)) { const k = dupKey(i); if (!seen.has(k)) { seen.set(k, [i]); order.push(k); } else seen.get(k).push(i); }
  return `<div class="rows">${order.map(k => { const list = seen.get(k); return list.length < 3 ? list.map(i => item(i)).join('') : dupRow(k, list); }).join('')}</div>`;
}

function render() {
  if (DEMO) sandboxInbox();
  // A fresh copy when the page opens (at most once a minute): Today's copy is from when the app loaded.
  if (!DEMO && !S.ibLoading && Date.now() - (S.ibLoadedAt || 0) > 60e3) {
    S.ibLoading = true;
    DB.loadInbox().then(() => { S.ibLoadedAt = Date.now(); if (S.route?.name === 'inbox') hooks.render(); }).catch(() => {}).finally(() => { S.ibLoading = false; });
  }
  const v = view(), all = S.inbox || [], rows = inboxRows();
  const nNeeds = inboxCount(), unreadHere = rows.filter(i => i.unread).length;
  const filtered = !!(v.q.trim() || v.unreadOnly || v.kind), sorted = v.sort && v.sort !== 'new';
  // On a laptop a long list opens its filters (one row); on a phone they stay behind "Filter or sort", so the first item
  // sits high enough to see (A-1: the review found it at 443-496px on a 390px phone).
  const showF = v.showFilters || filtered || sorted || (rows.length > 15 && wide());
  const grouped = v.group && v.sort !== 'pri' && (v.tab === 'updates' || v.sort === 'bill');
  // Only Needs you is counted (Updates are news that clears itself after a week, not a backlog: A-14).
  const tab = (k, label, n) => `<button type="button" data-ibtab="${k}" aria-pressed="${v.tab === k}">${label}${n ? ` <span class="ib-n">${n > 99 ? '99+' : n}<span class="sr"> unread</span></span>` : ''}</button>`;
  const nBills = grouped ? new Set(rows.map(i => i.bill_id || 'none')).size : 0;
  const countLine = (extra = '') => `<p class="ib-count" aria-live="polite"><span>${grouped ? `${nBills} ${nBills === 1 ? 'bill' : 'bills'}` : `${rows.length} ${rows.length === 1 ? 'item' : 'items'}`}${unreadHere ? `, ${unreadHere} unread` : ''}</span>${extra}${unreadHere ? `<button type="button" class="linkbtn" data-ibreadall="1">Mark all read</button>` : ''}</p>`;
  const kinds = KINDS.filter(([k]) => all.some(i => i.kind === k && (v.tab === 'all' || (v.tab === 'needs') === i.direct)));
  const none = filtered ? empty({ title: 'Nothing matches these filters', action: btn('Clear the filters', { kind: 'secondary', attrs: { 'data-ibclear': 1 } }) })
    : v.tab === 'needs' ? empty({ title: 'Nothing needs you', text: 'Messages to you, @mentions, testimony steps and reminders land here.' })
    : v.tab === 'updates' ? empty({ title: 'No updates', text: 'What the Capitol does on the bills you own or follow lands here, for a week.' })
    : empty({ title: 'Nothing here yet', text: 'Messages, testimony steps, reminders and news on your bills land here.' });
  return `<div class="ib-page">
    <div class="ib-bar">
      <div class="sv-seg ib-tabs" role="group" aria-label="Which items">${tab('needs', 'Needs you', nNeeds)}${tab('updates', 'Updates')}${tab('all', 'Everything')}</div>
    </div>
    ${showF ? `<div class="ib-filters">
      <label class="sr" for="ib-q">Filter by bill or words</label><input id="ib-q" class="input ib-q" type="search" placeholder="Filter by bill or words" value="${esc(v.q)}" autocomplete="off">
      <label class="check ib-unr"><input type="checkbox" id="ib-unread" ${v.unreadOnly ? 'checked' : ''}><span>Unread only</span></label>
      <label class="sr" for="ib-sort">Sort</label><select id="ib-sort" class="input ib-sort"><option value="new" ${v.sort === 'new' ? 'selected' : ''}>Unread first, then newest</option><option value="pri" ${v.sort === 'pri' ? 'selected' : ''}>Priority, P1 first</option><option value="bill" ${v.sort === 'bill' ? 'selected' : ''}>By bill</option></select>
      ${kinds.length > 1 ? `<div class="ib-kinds" role="group" aria-label="Kind">${kinds.map(([k, l]) => `<button type="button" class="sv-pick sv-toggle${v.kind === k ? ' on' : ''}" data-ibkind="${k}" aria-pressed="${v.kind === k}">${icon(KIND_ICON[k])}<span>${l}</span></button>`).join('')}</div>` : ''}
      ${countLine(filtered ? '<button type="button" class="linkbtn" data-ibclear="1">Clear the filters</button>' : '')}
    </div>` : countLine('<button type="button" class="linkbtn" data-ibfilters="1">Filter or sort</button>')}
    <div class="ib-list">${rows.length ? listBody(rows, v) : none}</div>
    ${hover() && keysOn() && rows.length ? `<p class="ib-keys">${icon('keyboard')}<span>Keys: <kbd>j</kbd> and <kbd>k</kbd> move, <kbd>Enter</kbd> opens, <kbd>e</kbd> marks read or unread, <kbd>Shift</kbd>+<kbd>A</kbd> marks this list read.</span></p>` : ''}
    <p class="ib-note">Reading never removes anything. Updates go after 7 days, testimony steps once the draft is filed, reminders after the hearing.</p>
  </div>`;
}

// ---- marking read and unread, always with Undo ----
async function mark(keys, read, { say = true } = {}) {
  const set = new Set(keys), before = (S.inbox || []).filter(i => set.has(i.key) && i.unread === read).map(i => i.key);
  if (!before.length) return;
  try {
    await (read ? DB.inboxMark(before) : DB.inboxUnmark(before)); hooks.render();
    if (say) toast(read ? `${before.length === 1 ? 'Marked read' : `${before.length} marked read`}.` : `${before.length === 1 ? 'Marked unread' : `${before.length} marked unread`}.`,
      { undo: async () => { await (read ? DB.inboxUnmark(before) : DB.inboxMark(before)); hooks.render(); } });
  } catch (e) { hooks.render(); toast(e, { err: true }); }
}
const toggle = key => { const i = itemOf(key); if (i) return mark([key], i.unread); };
const dupList = k => inboxRows().filter(i => dupKey(i) === k);
const focusRow = key => { const el = document.querySelector(`.ib-row[data-key="${CSS.escape(key)}"] .ib-main`); if (el) el.focus(); };

function wire(route, root) {
  const v = view();
  root.querySelectorAll('[data-ibtab]').forEach(el => el.onclick = () => { v.tab = el.dataset.ibtab; v.kind = ''; hooks.render(); document.querySelector(`[data-ibtab="${v.tab}"]`)?.focus(); });
  root.querySelectorAll('[data-ibkind]').forEach(el => el.onclick = () => { v.kind = v.kind === el.dataset.ibkind ? '' : el.dataset.ibkind; hooks.render(); document.querySelector(`[data-ibkind="${el.dataset.ibkind}"]`)?.focus(); });
  root.querySelectorAll('[data-ibclear]').forEach(el => el.onclick = () => { v.q = ''; v.unreadOnly = false; v.kind = ''; hooks.render(); });
  root.querySelector('[data-ibfilters]')?.addEventListener('click', () => { v.showFilters = true; hooks.render(); document.getElementById('ib-q')?.focus(); });
  const unr = root.querySelector('#ib-unread'); if (unr) unr.onchange = () => { v.unreadOnly = unr.checked; hooks.render(); document.getElementById('ib-unread')?.focus(); };
  const srt = root.querySelector('#ib-sort'); if (srt) srt.onchange = () => { v.sort = srt.value; hooks.render(); document.getElementById('ib-sort')?.focus(); };
  const q = root.querySelector('#ib-q');
  if (q) { let t; q.oninput = () => { v.q = q.value; clearTimeout(t); t = setTimeout(() => { hooks.render(); const el = document.getElementById('ib-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 200); };
    q.onkeydown = e => { if (e.key === 'Escape' && q.value) { e.stopPropagation(); q.value = ''; q.oninput(); } }; }
  root.querySelector('[data-ibreadall]')?.addEventListener('click', () => mark(inboxRows().filter(i => i.unread).map(i => i.key), true));
  root.querySelectorAll('[data-ibgroup]').forEach(el => el.onclick = () => mark(inboxRows().filter(i => (i.bill_id || 'none') === el.dataset.ibgroup && i.unread).map(i => i.key), true));
  root.querySelectorAll('[data-ibtoggle]').forEach(el => el.onclick = async () => { const k = el.dataset.ibtoggle; await toggle(k); document.querySelector(`[data-ibtoggle="${CSS.escape(k)}"]`)?.focus(); });
  root.querySelectorAll('[data-ibduptoggle]').forEach(el => el.onclick = () => { const list = dupList(el.dataset.ibduptoggle), un = list.filter(i => i.unread); mark((un.length ? un : list).map(i => i.key), !!un.length); });
  root.querySelectorAll('[data-ibdup]').forEach(el => el.onclick = () => { const k = el.dataset.ibdup, s = S.ibOpenDup ||= new Set(); s.has(k) ? s.delete(k) : s.add(k); hooks.render(); document.querySelector(`[data-ibdup="${CSS.escape(k)}"]`)?.focus(); });
  // Opening a row or pressing its Review counts as reading it. The page it opens is the frame's to draw.
  root.querySelectorAll('[data-ibopen], [data-ibkey]').forEach(el => el.addEventListener('click', () => { const k = el.dataset.ibopen || el.dataset.ibkey; if (itemOf(k)?.unread) DB.inboxMark([k]).catch(() => {}); }));
}

// ---- keys (a keyboard and mouse; never while typing, in a sheet, or with shortcuts switched off) ----
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (S.route?.name !== 'inbox' || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  const rows = [...document.querySelectorAll('.ib-list .ib-row')], at = rows.findIndex(r => r.contains(document.activeElement));
  if (e.key === 'j' || e.key === 'k') {
    if (!rows.length) return; e.preventDefault();
    const n = at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (e.key === 'j' ? 1 : -1)));
    rows[n].querySelector('.ib-main')?.focus(); rows[n].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'e' && at >= 0) {
    e.preventDefault(); const r = rows[at], k = r.dataset.dup;
    if (k) { const list = dupList(k), un = list.filter(i => i.unread); mark((un.length ? un : list).map(i => i.key), !!un.length).then(() => focusRow(r.dataset.key)); }
    else toggle(r.dataset.key)?.then(() => focusRow(r.dataset.key));
  } else if (e.key === 'A' && e.shiftKey) {
    e.preventDefault(); mark(inboxRows().filter(i => i.unread).map(i => i.key), true);
  }
});

export default {
  tab: 'today', narrow: true,
  back: () => ({ href: '#/', label: 'Today' }),
  title: () => 'Inbox',
  render, wire,
};
