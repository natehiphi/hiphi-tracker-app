// Staff v6 (R-336, spec 3.3 and 6 "Inbox", V26, D11; F48, F49, F66, F81): the Inbox (#/inbox, #/inbox?view=updates). Only
// things that happened, in two page tabs:
//   - Messages: what teammates wrote to you or about your bills (@mentions included), and the tracker's notes to you (a
//     draft sent for your approval, testimony sent back with a note, a health alert for admins). Only these are counted,
//     in the sidebar and on the phone's bell.
//   - Updates: "What changed" since yesterday, since your last visit or in the last 7 days, one row per bill (it lived at the
//     foot of Today in v5; spec 6 moves it here). Opening it counts as reading the Capitol's updates, as on v5's Today.
// Deadline reminders are not here (V26): they are not something that happened but a step still to do, and the step itself
// says its time on Today and in Testimony. A question still waiting for your answer is also a row on Today (addendum 7).
// Each row is a name and one line (V04); picking one opens it beside the list from 1100px wide, or as its own page below
// that, with Back (V17, F12). Reading, marking read or unread and Mark all read keep v5's data calls (my_inbox, inbox_mark,
// migration 032) and its Undo. Keys (a keyboard and mouse; Help › Keyboard shortcuts switches them off): j and k move, Enter
// opens, e marks read or unread, Shift+M marks the list read (not Shift+A, which approves in Review: R-277 E-11).
import { S, DB, DEMO, esc, fmtDT, hooks, isMine } from './data.js';
import { unslack, billById, plainAction, OUT_PLAIN as OUT, billRoute, agoWords, teamFirst, hstDayOf, legNotesAll, ASK_LOG, whenAt, blurb } from './model.js';
import { icon, btn, iconBtn, toast, keysOn, keysUsed, segmented, sectionNav } from './ui.js';
import { itemRow, nameWords, numWords, nw, listDetail, wireListDetail, ldPicked } from './steps.js';
import { plainCodes } from './terms.js';

const HR = 36e5, DAY = 864e5;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
const ago = iso => agoWords(iso, { short: true });
const st = () => S.ib6 ??= { q: '', unreadOnly: false, from: '', showFilters: false, since: 'day', uq: '' };
const viewOf = route => (route?.view || route?.q?.view) === 'updates' ? 'updates' : 'messages';
const hover = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };

// Practice copy only: the inbox is built for the person practising (today.js does the same; copied so the Inbox does not
// depend on Today's file). S.tdInboxFor is shared with Today so the two never rebuild it twice.
function sandboxInbox() {
  if (!DEMO || !S.buildDemoInbox || !S.me) return;
  const builtFor = S.tdInboxFor ?? (S.advocates.find(a => a.is_admin) || S.advocates[0])?.id;
  if (builtFor !== S.me.id) S.inbox = S.buildDemoInbox();
  S.tdInboxFor = S.me.id;
}

// ---- Messages: what was sent to you ----
// The same items the sidebar counts (model.js toAnswer: addressed to you, and a tracker note only when it is a health
// alert an admin acts on), less the deadline reminders (V26). shared_changes asks model.js inboxCount to leave those out
// too, so the count and this list agree; messagesCount() is that count, which this page shows meanwhile.
const isMsg = i => !!i.direct && i.kind !== 'deadline' && !(i.kind === 'system' && !/^Bill Tracker health/i.test(i.title || ''));
const fromTeam = i => i.kind === 'message';
export const messagesCount = () => (S.inbox || []).filter(i => isMsg(i) && i.unread).length;
const itemOf = key => (S.inbox || []).find(i => i.key === key);
function messageRows() {
  const v = st();
  let rows = (S.inbox || []).filter(isMsg);
  if (v.from === 'team') rows = rows.filter(fromTeam); else if (v.from === 'tracker') rows = rows.filter(i => !fromTeam(i));
  if (v.unreadOnly) rows = rows.filter(i => i.unread);
  const q = v.q.trim().toLowerCase(), qn = q.replace(/\s/g, '');
  if (q) rows = rows.filter(i => { const b = i.bill_id && billById(i.bill_id); return [i.bill_number, b?.nickname, i.title, i.body].join(' ').toLowerCase().includes(q) || (b && String(b.bill_number).toLowerCase().replace(/\s/g, '').includes(qn)); });
  // Unread first, then newest: what you have not seen yet leads.
  return rows.sort((x, y) => (y.unread - x.unread) || String(y.at).localeCompare(String(x.at)));
}
// Who wrote, by first name: "Nate wrote" is the database's title for a message (migration 032).
const whoOf = i => String(unslack(i.title || '')).replace(/\s+(wrote|mentioned you|replied)$/i, '').trim();
// The draft a tracker note is about, while it still waits on the same step, so the note opens where that step lives.
const draftOf = i => { const ds = S.drafts?.[i.bill_id] || []; return /approval/i.test(i.title || '') ? ds.find(d => d.status === 'review' || d.status === 'second_review') : /sent back/i.test(i.title || '') ? ds.find(d => d.status === 'draft' && d.review_note) : null; };
// A row says who wrote (or what the tracker's note is) as its name, when as its small second part, and then the bill and
// the words: the way every messages list reads (sender, time, subject, preview), so the eye finds who wrote first, and the
// bill is named on the line (V19: one plain line; the open item names the bill in full, with its number).
// A message's first clause or sentence is its preview; the open item has all of it.
const firstPart = t => { t = String(t || '').replace(/\s+/g, ' ').trim(); const m = /^(.{24,}?)(?:\s[—–-]\s|[.!?](?=\s)|;\s)/.exec(t); return clip(m ? m[1] + (/[.!?]$/.test(m[1]) ? '' : '…') : t, 120); };
function whatOf(i) {
  if (fromTeam(i)) return whoOf(i) || 'A teammate';
  if (i.kind === 'testimony' && /sent back/i.test(i.title || '')) return 'Sent back with a note';
  if (i.kind === 'testimony' && /approval/i.test(i.title || '')) return 'Testimony for your approval';
  return clip(unslack(i.title || 'From the tracker'), 60);
}
function lineOf(i) {
  const b = i.bill_id && billById(i.bill_id), bill = b ? esc(nameWords(b, 60)) : '', body = firstPart(unslack(i.body || ''));
  const words = fromTeam(i) || /sent back/i.test(i.title || '') ? (body ? `“${esc(body)}”` : '')
    : i.kind === 'testimony' && /approval/i.test(i.title || '') ? `from ${esc(String(i.title).split(' submitted')[0])}`
      : b ? esc(clip(unslack(i.body || ''), 120)) : esc(clip(unslack(i.body || ''), 140));
  return [bill, words].filter(Boolean).join(' · ');
}
const ICON = i => fromTeam(i) ? 'message-square' : i.kind === 'testimony' ? 'file-text' : i.kind === 'system' ? 'settings' : 'bell';
// The button shows what it does: a tick marks it read, the dot (the unread mark) marks it unread again (A-18).
const readBtn = (key, unread, n = 1) => iconBtn(unread ? 'check' : 'circle-dot', n > 1 ? (unread ? `Mark all ${n} read` : `Mark all ${n} unread`) : unread ? 'Mark read' : 'Mark unread', { 'data-ibtoggle': key }, 'ib-read');
function msgRow(i) {
  return itemRow({ key: i.key, name: whatOf(i), num: ago(i.at), icon: ICON(i),
    line: `${i.unread ? '<span class="sr">Unread. </span>' : ''}${lineOf(i)}`, pick: i.key, selected: ldPicked('ib-msg') === i.key,
    button: readBtn(i.key, i.unread), cls: `ib-row ib-msgrow${i.unread ? ' ib-unread' : ''}` });
}
// The same note on three or more bills (a status sweep) is one row; opening it lists each.
const dupKey = i => `${i.kind}|${unslack(i.title || '')}|${unslack(i.body || '')}`;
function dupRow(k, list) {
  const un = list.filter(x => x.unread).length, i = list[0], key = 'dup:' + k;
  return itemRow({ key, name: clip(unslack(i.title || ''), 60), num: ago(i.at), icon: ICON(i),
    line: `${un ? '<span class="sr">Unread. </span>' : ''}${plural(list.length, 'bill')}: ${esc(clip(list.map(x => { const bb = x.bill_id && billById(x.bill_id); return bb ? nameWords(bb, 40) : x.bill_number || ''; }).filter(Boolean).join(', '), 160))}`,
    pick: key, selected: ldPicked('ib-msg') === key, button: readBtn(key, !!un, list.length), cls: `ib-row ib-msgrow${un ? ' ib-unread' : ''}` });
}
function groupedMessages(rows) {
  const seen = new Map(), order = [];
  for (const i of rows.slice(0, 200)) { const k = fromTeam(i) ? 'k:' + i.key : dupKey(i); if (!seen.has(k)) { seen.set(k, [i]); order.push(k); } else seen.get(k).push(i); }
  return order.map(k => { const list = seen.get(k); return list.length < 3 ? list.map(msgRow).join('') : dupRow(k, list); }).join('');
}
const dupList = k => (S.inbox || []).filter(i => isMsg(i) && dupKey(i) === k);
const keysFor = key => String(key).startsWith('dup:') ? dupList(key.slice(4)).map(i => i.key) : [key];

// The open message: the bill's recent talk (so a reply has its context) and the door to the bill's Team talk, where the
// reply box is. A tracker note opens where its step lives (Testimony), never with the step's own button here (spec 11.1).
function msgDetail(key) {
  if (String(key).startsWith('dup:')) {
    const list = dupList(key.slice(4)); if (!list.length) return '';
    return `<div class="ib-item"><h2 class="ib-item-h">${esc(unslack(list[0].title || ''))}</h2>${list[0].body ? `<p class="ib-item-p">${esc(unslack(list[0].body))}</p>` : ''}
      <div class="v6-list ib-sub" role="list" aria-label="The bills it is about">${list.map(i => { const b = i.bill_id && billById(i.bill_id);
        return b ? itemRow({ key: i.key, name: nameWords(b), num: numWords(b), line: nw(esc(ago(i.at))), href: billRoute(b, 'talk') }) : ''; }).join('')}</div></div>`;
  }
  const i = itemOf(key); if (!i) return '';
  const b = i.bill_id && billById(i.bill_id), when = fmtDT(i.at);
  const head = b ? `<p class="ib-item-num">${esc(numWords(b))}</p><h2 class="ib-item-h">${esc(nameWords(b))}</h2>` : `<h2 class="ib-item-h">${esc(unslack(i.title || 'From the tracker'))}</h2>`;
  if (fromTeam(i)) {
    // The talk on the bill, ending with this message and anything after it (at most three before it).
    const all = (S.messages?.[i.bill_id] || []).slice().sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
    const at = all.findIndex(m => 'm:' + m.id === i.key), shown = at >= 0 ? all.slice(Math.max(0, at - 3)) : [];
    const msg = m => `<li class="ib-msg${'m:' + m.id === i.key ? ' this' : ''}"><p class="ib-msg-who">${esc(m.advocate_id === S.me?.id ? 'You' : teamFirst(m.advocate_id))} · ${nw(esc(fmtDT(m.created_at)))}</p><p class="ib-msg-t">${esc(unslack(m.body))}</p></li>`;
    const thread = shown.length ? `<ol class="ib-thread" aria-label="The talk on this bill">${shown.map(msg).join('')}</ol>`
      : `<ol class="ib-thread"><li class="ib-msg this"><p class="ib-msg-who">${esc(whoOf(i))} · ${nw(esc(when))}</p><p class="ib-msg-t">${esc(unslack(i.body || ''))}</p></li></ol>`;
    return `<div class="ib-item">${head}${thread}
      <div class="ib-item-acts">${b ? btn('Reply in Team talk', { icon: 'reply', href: billRoute(b, 'talk') }) : ''}${btn(i.unread ? 'Mark read' : 'Mark unread', { kind: 'text', attrs: { 'data-ibtoggle': i.key } })}</div></div>`;
  }
  const d = draftOf(i), to = d ? (d.status === 'draft' ? '#/testimony?view=sent' : '#/testimony?view=approve') : b ? billRoute(b) : '';
  const say = i.kind === 'testimony' && /sent back/i.test(i.title || '') ? 'Sent back with a note' : unslack(i.title || '');
  return `<div class="ib-item">${head}<p class="ib-item-p"><b>${esc(say)}</b> · ${nw(esc(when))}</p>${i.body ? `<p class="ib-item-q">${esc(unslack(i.body))}</p>` : ''}
    ${d ? `<p class="ib-item-p">${esc(d.status === 'draft' ? 'It waits in Testimony, under Sent back, with its Doc and Resubmit.' : 'It waits in Testimony, under To approve.')}</p>` : ''}
    <div class="ib-item-acts">${to ? btn(d ? 'Open in Testimony' : 'Open the bill', { kind: 'secondary', iconEnd: 'arrow-right', href: to }) : ''}${btn(i.unread ? 'Mark read' : 'Mark unread', { kind: 'text', attrs: { 'data-ibtoggle': i.key } })}</div></div>`;
}

function messagesHTML() {
  const v = st(), all = (S.inbox || []).filter(isMsg), rows = messageRows(), un = rows.filter(i => i.unread).length;
  const filtered = !!(v.q.trim() || v.unreadOnly || v.from), showF = v.showFilters || filtered;
  const count = `<p class="ib-count" aria-live="polite"><span>${plural(rows.length, 'message')}${un ? `, ${un} unread` : ''}</span>${un ? '<button type="button" class="linkbtn" data-ibreadall>Mark all read</button>' : ''}${filtered ? '<button type="button" class="linkbtn" data-ibclear>Clear the filters</button>' : ''}</p>`;
  const filters = showF ? `<div class="ib-filters" id="ib-filters">
      <label class="ib-q"><span class="sr">Filter by bill or words</span>${icon('search')}<input id="ib-q" type="search" placeholder="Filter by bill or words" value="${esc(v.q)}" autocomplete="off" enterkeyhint="search"></label>
      ${segmented('ibfrom', [['', 'Everyone'], ['team', 'Teammates'], ['tracker', 'The tracker']], v.from, 'From')}
      <label class="check ib-unr"><input type="checkbox" id="ib-unread" ${v.unreadOnly ? 'checked' : ''}><span>Unread only</span></label>
    </div>` : '';
  const none = filtered ? `<div class="ib-empty"><p>Nothing matches these filters.</p>${btn('Clear the filters', { kind: 'secondary', attrs: { 'data-ibclear': 1 } })}</div>`
    : '<div class="ib-empty"><p>Nothing here yet. Messages from teammates, @mentions and the tracker’s notes to you land here.</p></div>';
  const list = rows.length ? listDetail({ id: 'ib-msg', label: 'Messages', rows: groupedMessages(rows), detail: ldPicked('ib-msg') ? msgDetail(ldPicked('ib-msg')) : '', empty: 'Pick a message to read it whole', back: 'Back to Messages' }) : none;
  const keys = hover() && keysOn() && keysUsed() && rows.length ? `<p class="ib-keys">${icon('keyboard')}<span>Keys: <kbd>j</kbd> and <kbd>k</kbd> move, <kbd>Enter</kbd> opens, <kbd>e</kbd> marks read or unread, <kbd>Shift</kbd>+<kbd>M</kbd> marks them all read.</span></p>` : '';
  // V26: v5's Inbox carried deadline reminders; v6 keeps them on the step, and says so once, quietly, for anyone looking.
  const where = all.length ? `<p class="ib-note">${icon('clock')}<span>Testimony deadline reminders are not kept here: each step says its own time, on Today and in Testimony.</span></p>` : '';
  // The Filter button only once there is enough to filter (or a filter is on): two messages need none.
  const fBtn = all.length > 5 || filtered || v.showFilters;
  return `${all.length ? `<div class="ib-bar">${count}${!fBtn ? '' : btn('Filter', { kind: 'secondary', sm: true, icon: 'sliders-horizontal', attrs: { 'data-ibfilters': '1', 'aria-expanded': String(!!showF), 'aria-controls': 'ib-filters' } })}</div>` : ''}
    ${filters}<div class="ib-list">${list}</div>${where}${keys}`;
}

// ---- Updates: what changed on your bills (moved from today.js's digest, spec 6 and 11; copied, not imported) ----
// Catching up (decision 6): since yesterday (reaching back over a weekend), since your last visit, or the last 7 days, and
// a filter across every update and message, so "where did I see that" is answered on screen. Each row is one bill.
const SINCE = ['day', 'visit', 'week'];
const sinceOf = () => SINCE.includes(st().since) ? st().since : 'day';
const hst = t => { const x = new Date(t).getTime(); return Number.isNaN(x) ? hstDayOf(t) : new Date(x - 10 * HR).toISOString().slice(0, 10); };
// "Hearing set: LBT Mon 2/9, 3:01 PM" for a sitting since cancelled is left out (R-316 W24, G1-2).
function setButCancelled(billId, text) {
  const m = /^(?:Hearing|Decision making) set: (\S+) (?:\w{3} )?(\d{1,2})\/(\d{1,2})/.exec(text); if (!m) return false;
  const md = h => new Date(h.scheduled_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const same = (S.hearings || []).filter(h => h.bill_id === billId && String(h.committee).replace(/\s+/g, '').replace(/,/g, '/') === m[1] && md(h) === `${+m[2]}/${+m[3]}`);
  return same.length > 0 && same.every(h => h.status === 'cancelled');
}
export function digest(since = 'day') {
  const me = S.me, now = Date.now(); if (!me) return { label: 'yesterday', head: 'since yesterday', rows: [], keys: [], dayLabel: 'yesterday' };
  let back = 1; const dow = t => new Date(hst(t) + 'T12:00:00-10:00').getUTCDay();
  while ([0, 6].includes(dow(now - back * DAY)) && back < 3) back++;
  const dayStart = new Date(hst(now - back * DAY) + 'T00:00:00-10:00').getTime();
  const dayLabel = back === 1 ? 'yesterday' : new Date(now - back * DAY).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' });
  // Your last visit: when the visit before this one began (app.js keeps it). Less than an hour ago, or none, reaches back a day.
  const visit = S.sinceVisit && S.sinceVisit < now - HR ? S.sinceVisit : dayStart;
  const start = since === 'week' ? now - 7 * DAY : since === 'visit' ? visit : dayStart;
  const label = since === 'week' ? 'the last 7 days' : since === 'visit' ? `your last visit, ${whenAt(visit)}` : dayLabel;
  const head = since === 'week' ? 'in the last 7 days' : `since ${label}`;
  // Your bills (owned or followed); someone who owns none (Patti, Julie) also sees the bills of the coalitions they help on,
  // as their Today does, so Updates is never empty for the people who write for a coalition.
  const co = Array.isArray(me.prefs?.coalitions) && !S.bills.some(b => (S.assignments?.[b.id] || []).includes(me.id)) ? new Set(me.prefs.coalitions) : null;
  const want = b => b && (isMine(b) || co && (S.billCampaigns?.[b.id] || []).some(c => co.has(c))) && (b.position !== 'monitor' || S.follows?.has(b.id));
  const by = new Map(), row = b => { let r = by.get(b.id); if (!r) by.set(b.id, r = { b, best: null, at: 0, items: [] }); return r; };
  const add = (b, text, rank, at) => { if (!want(b)) return; const r = row(b); r.at = Math.max(r.at, at); r.items.push({ text, rank, at });
    if (!r.best || rank < r.best[1] || (rank === r.best[1] && at > r.best[2])) r.best = [text, rank, at]; };
  for (const e of S.recentEvents || []) { if (e.source && e.source !== 'auto') continue; const at = new Date(e.occurred_at).getTime(); if (at < start || at > now) continue;
    const [text, rank] = plainAction(e.title); if (setButCancelled(e.bill_id, text)) continue; add(billById(e.bill_id), text, rank, at); }
  for (const h of S.hearings || []) { const o = S.outcomes?.[h.id]; if (!o?.outcome) continue; const at = new Date(o.reported_at || h.scheduled_at).getTime(); if (at < start || at > now) continue;
    add(billById(h.bill_id), (OUT[o.outcome] || (c => `${o.outcome} in ${c}`))(h.committee), 0, at); }
  for (const [bid, msgs] of Object.entries(S.messages || {})) { const b = billById(bid), got = msgs.filter(m => m.advocate_id !== me.id && new Date(m.created_at).getTime() >= start && new Date(m.created_at).getTime() <= now);
    if (got.length && want(b)) { const r = row(b); r.at = Math.max(r.at, ...got.map(m => new Date(m.created_at).getTime()));
      for (const m of got) r.items.push({ msg: true, who: teamFirst(m.advocate_id), text: unslack(m.body), at: new Date(m.created_at).getTime() }); } }
  // A teammate's ask to a chair, or the chair's answer, on your bill (R-316 W3).
  if (ASK_LOG()) for (const n of legNotesAll()) { if (!n.answer || n.advocate_id === me.id) continue; const at = new Date(n.created_at).getTime(); if (at < start || at > now) continue;
    add(billById(n.bill_id), `${teamFirst(n.advocate_id)}: ${n.body}`, 2, at); }
  const rows = [...by.values()].sort((x, y) => (x.best ? x.best[1] : 9) - (y.best ? y.best[1] : 9) || (x.b.priority || 9) - (y.b.priority || 9) || y.at - x.at);
  const whose = co ? 'your bills or your coalitions’ bills' : 'your bills';
  return { label, head, dayLabel, rows, whose, keys: (S.inbox || []).filter(i => !i.direct && i.unread).map(i => i.key) };
}
// The filter: a bill number ("hb1780", "1780"), a nickname, or any word in the updates and messages; a row found by a word
// shows the line it was found in.
const squash = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ‘’`]/g, '');
function digestFind(rows, q) {
  const w = squash(q).trim(); if (!w) return rows.map(r => ({ r, hit: null }));
  const n = w.replace(/\s+/g, '');
  return rows.map(r => {
    if (squash(r.b.bill_number).includes(n) || squash(r.b.nickname).includes(w) || squash(blurb(r.b, 200)).includes(w)) return { r, hit: null };
    // the words as shown ("Senate Education") as well as as sent ("EDU")
    const hit = r.items.filter(x => squash(x.text).includes(w) || !x.msg && squash(shown(x.text)).includes(w)).sort((x, y) => !!x.msg - !!y.msg || y.at - x.at)[0];
    return hit ? { r, hit } : null;
  }).filter(Boolean);
}
// Committee codes leave rows (D15): "Hearing set: TRN Mon 3/23" reads "Hearing set: House Transportation Mon 3/23".
const said = t => plainCodes(esc(t));
const shown = t => said(t).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// The line: what matters most first (a result, a move, a hearing set), then the next newest change, then how many more;
// a row found by the filter shows the line it was found in. A teammate's message says who wrote.
const itemWords = x => x.msg ? `${esc(x.who)}: “${esc(clip(x.text, 80))}”` : said(clip(x.text, 110));
// The same Capitol line can arrive twice (the sync and a notice email): each is said once.
const uniq = items => { const seen = new Set(); return items.slice().sort((x, y) => y.at - x.at).filter(x => { const k = (x.msg ? 'm:' + x.who + ':' : 'c:') + x.text; if (seen.has(k)) return false; seen.add(k); return true; }); };
function updRow({ r, hit }) {
  let line;
  if (hit) line = itemWords(hit);
  else {
    const items = uniq(r.items), top = r.best ? items.find(x => !x.msg && x.text === r.best[0]) : null, rest = items.filter(x => x !== top);
    const shown = [top || rest.shift(), rest.shift()].filter(Boolean), more = items.length - shown.length;
    line = shown.map(itemWords).join(' · ') + (more > 0 ? ` and ${more} more` : '');
  }
  return itemRow({ key: r.b.id, name: nameWords(r.b), num: numWords(r.b), line, pick: r.b.id, selected: ldPicked('ib-upd') === r.b.id, cls: 'ib-row ib-updrow' });
}
// The open bill: every update and message in the time picked, newest first, and the door to its Team talk.
function updDetail(id) {
  const dg = digest(sinceOf()), r = dg.rows.find(x => String(x.b.id) === String(id)); if (!r) return '';
  const items = uniq(r.items);
  return `<div class="ib-item"><p class="ib-item-num">${esc(numWords(r.b))}</p><h2 class="ib-item-h">${esc(nameWords(r.b))}</h2>
    <p class="ib-item-sub">${esc(`What changed ${dg.head}`)}</p>
    <ol class="ib-thread">${items.map(x => `<li class="ib-msg"><p class="ib-msg-who">${x.msg ? `${esc(x.who)} wrote` : 'At the Capitol'} · ${nw(esc(fmtDT(new Date(x.at).toISOString())))}</p><p class="ib-msg-t">${x.msg ? esc(x.text) : said(x.text)}</p></li>`).join('')}</ol>
    <div class="ib-item-acts">${btn('Open its Team talk', { kind: 'secondary', iconEnd: 'arrow-right', href: billRoute(r.b, 'talk') })}</div></div>`;
}
// The tracker's own notes that are not about one bill and need nothing done ("Hearing notice received, no alerts sent").
const trackerNotes = () => (S.inbox || []).filter(i => i.kind === 'system' && !isMsg(i)).sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 10);
function updatesHTML() {
  const v = st(), since = sinceOf(), dg = digest(since), found = digestFind(dg.rows, v.uq || '');
  const seg = segmented('ibsince', [['day', dg.dayLabel === 'yesterday' ? 'Since yesterday' : `Since ${dg.dayLabel}`], ['visit', 'Since your last visit'], ['week', 'Last 7 days']], since, 'How far back');
  const notes = trackerNotes();
  const none = `<div class="ib-empty"><p>${esc(v.uq ? `Nothing ${dg.head} matches “${v.uq}”.` : `Nothing changed on ${dg.whose} ${dg.head}.`)}</p>${since !== 'week' && !v.uq ? btn('Show the last 7 days', { kind: 'secondary', attrs: { 'data-ibweek': 1 } }) : ''}</div>`;
  return `<div class="ib-ubar">${seg}<label class="ib-q"><span class="sr">Filter what changed</span>${icon('search')}<input id="ib-uq" type="search" value="${esc(v.uq || '')}" placeholder="Filter by bill, name or word" autocomplete="off" enterkeyhint="search"></label></div>
    ${found.length ? `<p class="ib-count" aria-live="polite">${esc(`${plural(found.length, 'bill')} changed ${dg.head}`)}</p>` : ''}
    <div class="ib-list">${found.length ? listDetail({ id: 'ib-upd', label: 'What changed', rows: found.slice(0, 60).map(updRow).join(''), detail: ldPicked('ib-upd') ? updDetail(ldPicked('ib-upd')) : '', empty: 'Pick a bill to see everything that changed', back: 'Back to Updates' }) : none}</div>
    ${found.length > 60 ? `<p class="ib-note">And ${found.length - 60} more bills. Each bill’s Team talk has the full record.</p>` : ''}
    ${notes.length ? `<section class="ib-notes" aria-labelledby="ib-nh"><h2 class="ib-h2" id="ib-nh">From the tracker</h2><div class="v6-list" role="list">${notes.map(i => itemRow({ key: i.key, name: clip(unslack(i.title || ''), 70), line: `${esc(clip(unslack(i.body || ''), 120))}${i.body ? ' · ' : ''}${nw(esc(ago(i.at)))}`, cls: 'ib-row ib-plain' })).join('')}</div></section>` : ''}`;
}

function render(route) {
  if (DEMO) sandboxInbox();
  // A fresh copy when the page opens (at most once a minute): the one loaded with the app may be old.
  if (!DEMO && !S.ibLoading && Date.now() - (S.ibLoadedAt || 0) > 60e3) {
    S.ibLoading = true;
    DB.loadInbox().then(() => { S.ibLoadedAt = Date.now(); if (S.route?.name === 'inbox') hooks.render(); }).catch(() => {}).finally(() => { S.ibLoading = false; });
  }
  const view = viewOf(route), un = messagesCount();
  // The place is the title; its two tabs sit under it (D12). The unread count is a quiet number on Messages, never coloured.
  return `<div class="ib-page">
    <div class="sv-phead"><h1 class="sv-h1 ib-h1">Inbox</h1><span class="sv-phr">${sectionNav('inbox', view, { counts: un ? { messages: un > 99 ? '99+' : un } : {} })}</span></div>
    ${view === 'updates' ? updatesHTML() : messagesHTML()}
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
const toggle = key => { const ks = keysFor(key), un = ks.map(itemOf).filter(Boolean).some(i => i.unread); return mark(ks, un); };
const focusRow = key => { const el = document.querySelector(`.ib-list [data-v6row="${CSS.escape(key)}"] .v6-row-main`); if (el) el.focus({ preventScroll: true }); };
// Opening an item reads it, quietly: the row loses its unread mark in place, so the list does not redraw under the reader.
function readQuietly(key) {
  const ks = keysFor(key).filter(k => itemOf(k)?.unread); if (!ks.length) return;
  DB.inboxMark(ks).catch(() => {});
  const row = document.querySelector(`.ib-list [data-v6row="${CSS.escape(key)}"]`);
  if (row) { row.classList.remove('ib-unread'); row.querySelector('.v6-row-line .sr')?.remove(); const b = row.querySelector('.v6-row-act [data-ibtoggle]'); if (b) { b.outerHTML = readBtn(key, false, keysFor(key).length); wireToggle(row.querySelector('.v6-row-act [data-ibtoggle]')); } }
  const n = document.querySelector('.ib-page .sv-secnav [aria-current] .sv-tn'), c = messagesCount(); if (n) { if (c) n.textContent = c; else n.remove(); }
}
function wireToggle(el) { if (el) el.onclick = async e => { e.preventDefault(); e.stopPropagation(); const k = el.dataset.ibtoggle; await toggle(k); focusRow(k); }; }

function wire(route, root) {
  const v = st(), view = viewOf(route);
  root.querySelectorAll('[data-ibtoggle]').forEach(wireToggle);
  root.querySelectorAll('[data-ibclear]').forEach(el => el.onclick = () => { v.q = ''; v.unreadOnly = false; v.from = ''; hooks.render(); });
  root.querySelector('[data-ibfilters]')?.addEventListener('click', () => { v.showFilters = !root.querySelector('#ib-filters'); hooks.render(); (v.showFilters ? document.getElementById('ib-q') : document.querySelector('[data-ibfilters]'))?.focus(); });
  root.querySelector('[data-ibreadall]')?.addEventListener('click', () => mark(messageRows().filter(i => i.unread).map(i => i.key), true));
  root.querySelectorAll('[data-seg="ibfrom"]').forEach(el => el.onclick = () => { v.from = el.dataset.val; hooks.render(); document.querySelector(`[data-seg="ibfrom"][data-val="${el.dataset.val}"]`)?.focus(); });
  const unr = root.querySelector('#ib-unread'); if (unr) unr.onchange = () => { v.unreadOnly = unr.checked; hooks.render(); document.getElementById('ib-unread')?.focus(); };
  const typed = (el, k) => { if (!el) return; let t; el.oninput = () => { v[k] = el.value; clearTimeout(t); t = setTimeout(() => { hooks.render(); const x = document.getElementById(el.id); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 200); };
    el.onkeydown = e => { if (e.key === 'Escape' && el.value) { e.stopPropagation(); el.value = ''; el.oninput(); } }; };
  typed(root.querySelector('#ib-q'), 'q'); typed(root.querySelector('#ib-uq'), 'uq');
  wireListDetail(root, { id: 'ib-msg', open: key => { readQuietly(key); return msgDetail(key); } });
  // The open message's own Mark read / unread (drawn after the page, so wired here as it opens).
  root.querySelector('[data-v6ld="ib-msg"] .v6-ld-detail')?.addEventListener('click', e => { const b = e.target.closest('[data-ibtoggle]'); if (!b) return; e.preventDefault(); toggle(b.dataset.ibtoggle); });
  // Updates: how far back, the filter, and reading. Opening the tab reads the Capitol's updates (they are never counted).
  root.querySelectorAll('[data-seg="ibsince"]').forEach(el => el.onclick = () => { v.since = el.dataset.val; (S.v6ld ??= {})['ib-upd'] = { key: null, y: 0 }; hooks.render(); document.querySelector(`[data-seg="ibsince"][data-val="${el.dataset.val}"]`)?.focus(); });
  root.querySelector('[data-ibweek]')?.addEventListener('click', () => { v.since = 'week'; hooks.render(); document.querySelector('[data-seg="ibsince"][data-val="week"]')?.focus(); });
  wireListDetail(root, { id: 'ib-upd', open: id => updDetail(id) });
  if (view === 'updates') { const ks = digest().keys; if (ks.length) DB.inboxMark(ks).catch(() => {}); }
}

// ---- keys (a keyboard and mouse; never while typing, in a sheet, or with shortcuts switched off) ----
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (S.route?.name !== 'inbox' || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  const rows = [...document.querySelectorAll('.ib-list .v6-ld-list > .v6-row')].filter(r => r.offsetParent), at = rows.findIndex(r => r.contains(document.activeElement));
  if (e.key === 'j' || e.key === 'k') {
    if (!rows.length) return; e.preventDefault();
    const n = at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (e.key === 'j' ? 1 : -1)));
    rows[n].querySelector('.v6-row-main')?.focus(); rows[n].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'e' && at >= 0 && viewOf(S.route) !== 'updates') {
    const k = rows[at].dataset.v6row; if (!k) return;
    e.preventDefault(); toggle(k).then(() => focusRow(k));
  } else if (e.key === 'M' && e.shiftKey && viewOf(S.route) !== 'updates') {
    e.preventDefault(); mark(messageRows().filter(i => i.unread).map(i => i.key), true);
  }
});

export default {
  tab: 'inbox',
  title: () => 'Inbox',
  render, wire,
};
