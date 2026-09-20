// HIPHI Staff v2 · Bill > Activity (plan 3.3). The team's chat, the team's log and the Capitol's record in ONE stream,
// oldest at the top and newest just above the message box, like any messaging app. The Capitol's actions are
// clerical and many (a day can bring five), so each day is condensed to one line that opens to the full text.
// Phones: the message box takes the tab bar's place at the bottom. Desktop (build 3): it sits at the end of the
// stream, inside the column, and says what Enter and Shift+Enter do. Typing @ offers teammates to notify.
import { S, DB, DEMO, LOG_TYPES, esc, fmtDate, advocate } from './data.js';
import { unreadCount, hstDayOf } from './model.js';
import { icon, btn, iconBtn, avatar, toast, openSheet, closeSheet, menuSheet, confirmSheet, field } from './ui.js';
import { rerender, drafts, firstName, dayOf, viewIsNew, afterBack } from './bill.js';

const LOG_LABEL = Object.fromEntries(LOG_TYPES);
const LOG_ICON = { testimony: 'file-text', coalition: 'users', meeting: 'handshake', action_alert: 'megaphone', note: 'notebook-pen' };
const LOG_HINT = { testimony: 'Testimony filed: support, in person', coalition: 'Coalition agreed to sign on',
  meeting: 'Met with Chair Takayama’s office', action_alert: 'Alert sent to 31 supporters', note: 'What happened?' };
const LIMIT = 30;                                   // newest entries shown; "Show earlier" opens the rest

// ---- the Capitol's history, loaded once per bill per visit ----
export function loadTimeline(b, force = false) {
  S.bwTL ??= {}; S.bwTLBusy ??= {};
  if ((b.id in S.bwTL && !force) || S.bwTLBusy[b.id]) return;
  S.bwTLBusy[b.id] = true;
  DB.timeline(b.id).then(rows => { S.bwTL[b.id] = rows || []; })
    .catch(e => { S.bwTL[b.id] = S.bwTL[b.id] || []; S.bwTLErr = { [b.id]: true }; console.warn('timeline:', e); })
    .finally(() => { S.bwTLBusy[b.id] = false; refreshStream(b); });
}
// Swap only the stream (never the whole page), so a half-typed message keeps its focus while the history arrives.
function refreshStream(b) {
  const box = document.getElementById('bw-stream');
  if (!box || box.dataset.bill !== String(b.id)) return;
  const nearEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
  box.innerHTML = streamInner(b);
  wireStream(box, b);
  if (nearEnd) window.scrollTo(0, document.documentElement.scrollHeight);
}

// ---- building the stream ----
// The Capitol gives a date, not a time (every action arrives stamped 8:00 AM), and names the chamber in details.
const chamberOf = ev => (/^Official action\s*-\s*(House|Senate)$/i.exec(ev.details || '') || [])[1] || '';
// One official action in a few words: "HLT passed with amendments (8 yes, 1 no)", "Hearing set: FIN 2/27, 10:00AM".
export function shortAction(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim(), m;
  const ay = /(\d+)\s+Ayes?\b/i.exec(s), no = /(\d+)\s+No(?:es|e)?s?\b/i.exec(s);
  const votes = ay ? ` (${ay[1]} yes${no ? `, ${no[1]} no` : ''})` : '';
  if ((m = /committee(?:\(s\))?\s+on\s+([A-Z][A-Z\/, ]*?)\s+recommend(?:\(s\)|s)?\s+that the measure be\s+([A-Z ,]+?)\./i.exec(s))) {
    const v = m[2].toLowerCase();
    const said = /amend/.test(v) ? 'passed with amendments' : /unamended/.test(v) ? 'passed as is' : /pass/.test(v) ? 'passed' : /defer/.test(v) ? 'deferred it' : /recommit/.test(v) ? 'recommitted it' : v.replace(/,/g, '');
    return `${m[1].trim()} ${said}${votes}`;
  }
  if ((m = /^Bill scheduled to be heard by\s+([A-Z][A-Z\/]*)\s+on\s+\w+,?\s+(\d{1,2})-(\d{1,2})-\d{2,4}\s+(\d{1,2}:\d{2}\s?[AP]M)/i.exec(s))) return `Hearing set: ${m[1]} ${+m[2]}/${+m[3]}, ${m[4]}`;
  if ((m = /^Bill scheduled for Conference Committee Meeting on\s+\w+,?\s+(\d{1,2})-(\d{1,2})-\d{2,4}\s+(\d{1,2}:\d{2}\s?[AP]M)?/i.exec(s))) return `Conference meeting set: ${+m[1]}/${+m[2]}${m[3] ? ', ' + m[3] : ''}`;
  const sent = /Transmitted to (House|Senate)/i.exec(s);
  s = s.replace(/\s*\((?:Stand\.|Hse\.|Sen\.|Conf\.|SSCR|HSCR|Gov\.)[^)]*\)/gi, '')
    .replace(/\s*The votes (?:were|in [A-Z\/]+ were) as follows:.*$/i, '')
    .replace(/\s+with (?:none|[^;]*?) voting aye with reservations.*$/i, '')
    .replace(/;\s*none voting.*$/i, '').replace(/,?\s*referral sheet \d+/i, '').replace(/\.\s*Transmitted to (House|Senate)\.?/i, '').replace(/\.$/, '').trim();
  if (sent && !/transmitted/i.test(s)) s += `; sent to the ${sent[1]}`;
  return s.length > 96 ? s.slice(0, 94).replace(/\s\S*$/, '') + '…' : s;
}
function items(b) {
  const out = [], official = new Map();
  for (const m of S.messages?.[b.id] || []) out.push({ kind: 'msg', at: m.created_at, m });
  for (const ev of S.bwTL?.[b.id] || []) {
    // "Hearing notice posted" is the sync's own bookkeeping; the Capitol's "scheduled to be heard" says it already.
    if (ev.type === 'hearing_auto' && /^Hearing notice posted/.test(ev.title || '')) continue;
    if (ev.source === 'team') { out.push({ kind: 'log', at: ev.occurred_at, ev }); continue; }
    const k = hstDayOf(ev.occurred_at); if (!official.has(k)) official.set(k, []); official.get(k).push(ev);
  }
  for (const [day, evs] of official) { evs.sort((x, y) => String(x.occurred_at).localeCompare(String(y.occurred_at))); out.push({ kind: 'day', at: evs[0].occurred_at, day, evs }); }
  return out.sort((x, y) => String(x.at).localeCompare(String(y.at)));
}
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', minute: '2-digit' });
function dayLabel(iso) {
  const k = hstDayOf(iso), today = hstDayOf(Date.now()), yest = hstDayOf(Date.now() - 864e5);
  if (k === today) return 'Today';
  if (k === yest) return 'Yesterday';
  return k.slice(0, 4) === today.slice(0, 4) ? dayOf(iso) : fmtDate(iso, { weekday: 'short', year: '2-digit' }).replace(/^(\w{3}),/, '$1');
}
// Message text: web addresses open in a new tab; in the words between them, bill numbers become links and @names stand
// out. Addresses are cut out first so a bill number inside one is never linked twice.
function msgHTML(body) {
  const names = new Set(S.advocates.map(a => firstName(a).toLowerCase()));
  const words = t => esc(t)
    .replace(/\b([HS]B) ?(\d{1,4})\b/g, (x, k, n) => `<a href="#/bill/${k}${n}">${x}</a>`)
    .replace(/(^|\s)@([A-Za-zʻ'-]+)/g, (x, sp, n) => names.has(n.toLowerCase()) ? `${sp}<b class="bw-at">@${n}</b>` : x);
  return String(body || '').split(/(https?:\/\/[^\s<]*[^\s<.,;:!?)])/g)
    .map((part, i) => i % 2 ? `<a href="${esc(part)}" target="_blank" rel="noopener">${esc(part)}</a>` : words(part)).join('').replace(/\n/g, '<br>');
}
let seenSnap = { bill: null, at: '' };           // what counted as read when this visit to the tab began
function itemHTML(b, it) {
  if (it.kind === 'msg') {
    const m = it.m, a = advocate(m.advocate_id), mine = m.advocate_id === S.me?.id;
    const fresh = !mine && seenSnap.bill === b.id && (!seenSnap.at || m.created_at > seenSnap.at);
    return `<div class="bw-msg${mine ? ' mine' : ''}" data-msg="${esc(m.id)}">${avatar(a, 32)}
      <div class="bw-msgb"><p class="bw-msgh"><b>${esc(mine ? 'You' : a?.full_name || 'Someone')}</b><span class="meta">${esc(timeOf(m.created_at))}</span>${fresh ? '<span class="bw-new">New</span>' : ''}</p>
        <div class="bw-msgt">${msgHTML(m.body)}</div></div>
      ${iconBtn('ellipsis', 'More for this message', { 'data-msgmore': m.id }, 'bw-msgmore')}</div>`;
  }
  if (it.kind === 'log') {
    const ev = it.ev, a = advocate(ev.advocate_id);
    return `<div class="bw-log"><span class="bw-logic">${icon(LOG_ICON[ev.type] || 'notebook-pen')}</span><div class="bw-msgb">
      <p class="bw-msgh"><b>${esc(a ? (a.id === S.me?.id ? 'You' : a.full_name) : 'The team')}</b><span class="meta">logged ${esc((LOG_LABEL[ev.type] || 'a note').toLowerCase())} · ${esc(timeOf(ev.occurred_at))}</span></p>
      <p class="bw-msgt">${esc(ev.title)}</p>${ev.details ? `<p class="small muted">${esc(ev.details)}</p>` : ''}</div></div>`;
  }
  const line = it.evs.map(ev => shortAction(ev.title)).join(' · ');
  return `<details class="bw-off"><summary><span class="bw-logic">${icon('landmark')}</span><span class="bw-offt"><b>Capitol</b> ${esc(line)}</span>${icon('chevron-down', { cls: 'chev' })}</summary>
    <ul>${it.evs.map(ev => `<li>${chamberOf(ev) ? `<span class="meta">${esc(chamberOf(ev))}</span> ` : ''}${esc(ev.title)}${ev.details && !chamberOf(ev) ? ` <span class="meta">${esc(ev.details)}</span>` : ''}</li>`).join('')}</ul></details>`;
}
function streamInner(b) {
  const all = items(b), loading = !(S.bwTL && b.id in S.bwTL);
  const showAll = !!S.bwActAll?.[b.id], shown = showAll ? all : all.slice(-LIMIT);
  let html = '';
  if (all.length > shown.length) html += btn(`Show earlier activity (${all.length - shown.length})`, { kind: 'text', icon: 'history', attrs: { 'data-earlier': '1' }, cls: 'bw-earlier' });
  if (loading) html += `<p class="meta bw-loading">${icon('loader-circle')}Loading the Capitol’s record…</p>`;
  if (S.bwTLErr?.[b.id]) html += `<p class="meta">The Capitol’s record did not load. Messages still work.</p>`;
  if (!all.length && !loading) return html + `<p class="bw-none">Nothing here yet. Write the first message below; the owner and followers see it.</p>`;
  let last = '';
  for (const it of shown) {
    const k = hstDayOf(it.at);
    if (k !== last) { html += `<h3 class="bw-day">${esc(dayLabel(it.at))}</h3>`; last = k; }
    html += itemHTML(b, it);
  }
  return html;
}
// inline: on desktop the message box is drawn here, at the end of the stream, not as the page's bottom bar.
export function renderActivity(b, { inline = false } = {}) {
  if (seenSnap.bill !== b.id || viewIsNew()) seenSnap = { bill: b.id, at: S.chatSeen?.[b.id] || '' };
  return `<section class="bw-sec bw-act" aria-labelledby="bw-act-h">
    <h2 id="bw-act-h" class="sr">Activity</h2>
    <div class="bw-sech"><p class="meta">The owner, followers and anyone you @mention get a Slack DM.${DEMO ? ' The sandbox stops at Mar 16, 2026.' : ''}</p>${inline ? '' : logBtn}</div>
    <div class="bw-stream" id="bw-stream" data-bill="${esc(b.id)}">${streamInner(b)}</div>
    ${inline ? `<div class="bw-inbox">${composerBar(b, { hint: true })}</div>` : ''}
  </section>`;
}

// ---- the message box (phones: the page's bottom bar on this tab; desktop: the end of the stream) ----
// Enter sends where there is a real keyboard; on a touch screen Return makes a new line and the Send button sends.
const enterSends = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// The stream opens at its newest entry, so on desktop "Log activity" sits there too, under the message box; on a
// phone the box is the page's bottom bar and has no room for it, so it stays at the top of the stream.
const logBtn = btn('Log activity', { kind: 'text', icon: 'notebook-pen', attrs: { 'data-log': '1' } });
export function composerBar(b, { hint: inline = false } = {}) {
  const d = drafts.get(b.id + ':chat') || '';
  const hint = inline && enterSends();     // the line under the box is only drawn where it is true
  return `<form class="bw-composer" data-bill="${esc(b.id)}" novalidate>
    <div class="bw-mention" role="group" aria-label="Notify a teammate" hidden></div>
    <div class="bw-crow"><label class="sr" for="bw-chat">Message the team</label>
      <textarea id="bw-chat" rows="1" maxlength="4000" placeholder="Message the team. Type @ to notify someone."${hint ? ' aria-describedby="bw-chat-h"' : ''}>${esc(d)}</textarea>
      <button type="submit" class="bw-send" aria-label="Send message" title="Send message">${icon('send')}</button></div>
    ${inline ? `<div class="bw-cfoot">${hint ? '<p class="meta bw-chint" id="bw-chat-h">Enter sends. Shift+Enter starts a new line.</p>' : '<span></span>'}${logBtn}</div>` : ''}
  </form>`;
}
// iOS keeps fixed bars behind the keyboard; lift the message box by the keyboard's height (Android resizes on its own).
let vvOn = false;
function keepAboveKeyboard() {
  if (vvOn || !window.visualViewport) return; vvOn = true;
  const vv = window.visualViewport;
  const fit = () => { const bar = document.querySelector('.bw-composer')?.closest('.actionbar'); if (!bar) return;
    const off = Math.round(window.innerHeight - vv.height - vv.offsetTop); bar.style.transform = off > 40 ? `translateY(${-off}px)` : ''; };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
}
const toBottom = () => window.scrollTo(0, document.documentElement.scrollHeight);

export function wireActivity(pnl, b, route, root) {
  const entry = viewIsNew();
  // Opened (or came back to) the tab: show the newest entries, just above the message box.
  if (entry) requestAnimationFrame(toBottom);
  if (unreadCount(b)) DB.markChatSeen(b.id).catch(() => {});
  pnl.querySelector('[data-log]').onclick = () => logSheet(b);
  wireStream(pnl.querySelector('#bw-stream'), b);
  const form = root.querySelector('.bw-composer'); if (!form) return;
  keepAboveKeyboard();
  const ta = form.querySelector('#bw-chat'), box = form.querySelector('.bw-mention'), key = b.id + ':chat';
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 132) + 'px'; };
  // The full hint where it fits on one line; shorter ones on a narrow phone, so the empty box stays one line tall.
  for (const ph of ['Message the team. Type @ to notify someone.', 'Message the team (@ to notify)', 'Message the team']) { ta.placeholder = ph; if (ta.value || ta.scrollHeight <= ta.clientHeight + 2) break; }
  grow();
  // @ offers teammates whose name starts with what follows it; picking one writes "@Kevin ".
  const people = S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id);
  const mention = () => {
    const upto = ta.value.slice(0, ta.selectionStart), m = /(^|\s)@([A-Za-zʻ'-]*)$/.exec(upto);
    const hits = m ? people.filter(a => firstName(a).toLowerCase().startsWith(m[2].toLowerCase())).slice(0, 6) : [];
    box.hidden = !hits.length;
    box.innerHTML = hits.map(a => `<button type="button" class="chip" data-at="${esc(firstName(a))}">${avatar(a, 24)}@${esc(firstName(a))}</button>`).join('');
    box.querySelectorAll('[data-at]').forEach(el => el.onmousedown = e => e.preventDefault());   // keep the keyboard up
    box.querySelectorAll('[data-at]').forEach(el => el.onclick = () => pickAt(el.dataset.at));
  };
  const pickAt = name => {
    const at = ta.selectionStart, upto = ta.value.slice(0, at).replace(/@([A-Za-zʻ'-]*)$/, '@' + name + ' ');
    ta.value = upto + ta.value.slice(at); ta.focus(); ta.setSelectionRange(upto.length, upto.length);
    drafts.set(key, ta.value); box.hidden = true; grow();
  };
  ta.oninput = () => { drafts.set(key, ta.value); grow(); mention(); };
  ta.onclick = mention;
  ta.onkeydown = e => {
    if (!box.hidden && (e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) { const f = box.querySelector('[data-at]'); if (f) { e.preventDefault(); pickAt(f.dataset.at); return; } }
    if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); box.hidden = true; return; }
    // Enter sends on a keyboard (Shift+Enter is a new line); on a phone the Return key makes a new line.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && enterSends()) { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const body = ta.value.trim(); if (!body) { ta.focus(); return; }
    if (!S.me) { toast('Your login is not linked to a staff record yet. Ask your admin.', { err: true }); return; }
    const send = form.querySelector('.bw-send'); send.setAttribute('aria-busy', 'true'); ta.readOnly = true;
    try {
      await DB.sendMessage(b.id, body); drafts.delete(key);
      rerender('#bw-chat'); requestAnimationFrame(toBottom);
    } catch (x) { send.removeAttribute('aria-busy'); ta.readOnly = false; toast(x, { err: true }); }
  };
  // A Reply button elsewhere (Today) opens this tab with ?reply=1: the cursor goes straight into the box.
  if (entry && (route.q?.reply || route.q?.compose)) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
function wireStream(box, b) {
  if (!box) return;
  box.querySelector('[data-earlier]')?.addEventListener('click', () => { const y = document.documentElement.scrollHeight - window.scrollY; (S.bwActAll ??= {})[b.id] = true; box.innerHTML = streamInner(b); wireStream(box, b); window.scrollTo(0, document.documentElement.scrollHeight - y); });
  // Links in a message go through the router (the frame only wires links that exist when the page renders).
  box.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); e.stopImmediatePropagation(); S.go(a.getAttribute('href')); });
  box.querySelectorAll('[data-msgmore]').forEach(el => el.onclick = () => { const m = (S.messages?.[b.id] || []).find(x => String(x.id) === el.dataset.msgmore); if (m) msgMenu(b, m); });
}
function msgMenu(b, m) {
  const mine = m.advocate_id === S.me?.id;
  menuSheet({ title: 'Message', items: [
    { label: 'Copy text', icon: 'copy', run: async () => { try { await navigator.clipboard.writeText(m.body); toast('Copied'); } catch { toast('Copying is blocked in this browser. Select the text instead.'); } } },
    { label: 'Reply', icon: 'reply', sub: `Mention ${mine ? 'someone' : firstName(advocate(m.advocate_id))}`, run: () => { const ta = document.getElementById('bw-chat'); if (!ta) return; if (!mine) { const n = firstName(advocate(m.advocate_id)); if (!ta.value.includes('@' + n)) ta.value = `@${n} ` + ta.value; drafts.set(b.id + ':chat', ta.value); } ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } },
    mine || S.me?.is_admin ? { label: 'Delete message', icon: 'trash-2', danger: true, run: () => afterBack(() => delMsg(b, m)) } : null,
  ] });
}
async function delMsg(b, m) {
  if (!(await confirmSheet({ title: 'Delete this message?', text: 'It disappears for everyone on the team.', ok: 'Delete', danger: true }))) return;
  try { await DB.deleteMessage(m); rerender(); toast('Message deleted.'); } catch (e) { toast(e, { err: true }); }
}

// ---- Log activity: something the team did that the Capitol's record will not show ----
function logSheet(b) {
  let type = LOG_LABEL[S.logType] ? S.logType : 'testimony';
  openSheet({ title: 'Log activity', size: 'auto',
    body: `<fieldset class="bw-types"><legend>Type</legend><div class="chips">${LOG_TYPES.map(([v, l]) => `<button type="button" class="chip" data-lt="${v}" aria-pressed="${v === type}">${icon(LOG_ICON[v])}${esc(l)}</button>`).join('')}</div></fieldset>
      <div class="field"><label for="bw-lt">What happened</label><input id="bw-lt" maxlength="200" autocomplete="off" aria-describedby="bw-lt-e" placeholder="${esc(LOG_HINT[type])}"><span class="err" id="bw-lt-e" hidden>${icon('circle-alert')}Write what happened first.</span></div>
      ${field('bw-ld', 'Details (optional)', '<textarea id="bw-ld" rows="3" placeholder="Who, what was said, what comes next."></textarea>')}
      <p class="meta">It is dated now and shows in this bill’s activity with your name.</p>`,
    foot: btn('Add to activity', { kind: 'primary', attrs: { 'data-go': '1' } }),
    wire: d => {
      const t = d.querySelector('#bw-lt'), er = d.querySelector('#bw-lt-e');
      d.querySelectorAll('[data-lt]').forEach(el => el.onclick = () => { type = el.dataset.lt; S.logType = type; d.querySelectorAll('[data-lt]').forEach(x => x.setAttribute('aria-pressed', String(x === el))); t.placeholder = LOG_HINT[type]; });
      t.oninput = () => { er.hidden = true; t.removeAttribute('aria-invalid'); };
      d.querySelector('[data-go]').onclick = async e => {
        const title = t.value.trim();
        if (!title) { er.hidden = false; t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
        if (!S.me) { toast('Your login is not linked to a staff record yet. Ask your admin.', { err: true }); return; }
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true');
        try {
          await DB.addActivity(b.id, type, title, d.querySelector('#bw-ld').value.trim());
          closeSheet({ silent: true }); toast('Logged.');
          loadTimeline(b, true);
        } catch (x) { go.removeAttribute('aria-busy'); toast(x, { err: true }); }
      };
    } });
}
