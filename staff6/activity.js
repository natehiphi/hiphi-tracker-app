// HIPHI Staff v6 · Bill › Team talk (R-336 V22; v3's Activity, plan 3.3, R-264). #/bill/X/talk (the old /activity
// redirects). The team's chat, the team's log and the Capitol's record in ONE stream, NEWEST AT THE TOP (Nate, 9/20: he
// reads it as a record, and a record puts the latest thing where the eye starts). The Capitol's actions are clerical and
// many, so each day is condensed to one line that opens to the full text.
// v6: ONE box at the top for anything the team wants on the bill (spec section 6): a message to the team (Type @ to notify
// someone), a note for the bill's record (a note, testimony filed, a coalition step, a supporter email), or a talk with a
// legislator (it opens Log a conversation with the words already in it, so it shows on their page too). v3 had a message
// box, a "Log what happened" button and a "Log a talk" button, three ways in. The box sits at the top on a phone too:
// the newest entry is there, and a fixed box over the tab bar took a fifth of a small screen.
// Above the stream, the conversations with legislators logged on this bill or under any of its issues (R-022 wave 2 #9,
// conversation.js), shown once there is one. A message shows Reply; Copy text and Delete are in its "…" (F121).
import { S, DB, LOG_TYPES, esc, fmtDate, fmtDT, advocate } from './data.js';
import { unreadCount, hstDayOf } from './model.js';
import { committeeName, versionWords, COMMITTEES } from './steps.js';
import { icon, btn, iconBtn, avatar, toast, menuSheet, confirmSheet, segmented } from './ui.js';
import { rerender, drafts, firstName, dayOf, viewIsNew, afterBack } from './bill.js';
import { issuesOfBill } from './issues.js';
import { convSectionHTML, wireConvSection, logConversation, refreshConversations } from './conversation.js';

// v3's words: an "action alert" is a "supporter email" (R-264), on screen only; the stored type stays action_alert.
const LOG_LABEL = { ...Object.fromEntries(LOG_TYPES), action_alert: 'Supporter email' };
const LOG_ICON = { testimony: 'file-text', coalition: 'users', meeting: 'handshake', action_alert: 'megaphone', note: 'notebook-pen' };
// What happened, as the box's list says it (C-15: "Note" was the switch, the list and the pinned note at once, so a
// newcomer could not tell which to use). The plain record entry is "Something else"; the stored type stays 'note'.
const NOTE_WORD = { note: 'Something else', testimony: 'Testimony filed', coalition: 'Coalition step', action_alert: 'Supporter email' };
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
// Who last changed the team note, and when (R-316 W56, C-16): the database writes an "Internal notes edited" line with
// its author every time the note changes (migration 144), so this reads the bill's own timeline; no new column. A note
// older than the timeline's reach says "Written before" its oldest line. '' until the timeline has loaded.
export function noteByText(b) {
  const tl = S.bwTL?.[b.id]; if (!tl) return '';
  const e = tl.find(t => t.title === 'Internal notes edited');
  if (e) { const a = e.advocate_id && advocate(e.advocate_id); return `Last edited by ${a ? (a.id === S.me?.id ? 'you' : a.full_name.split(' ')[0]) : 'a teammate'} · ${fmtDT(e.occurred_at)}`; }
  const old = tl[tl.length - 1]; return old ? `Written before ${fmtDate(old.occurred_at)}` : '';
}
// Swap only the stream (never the whole page), so a half-typed message keeps its focus while the history arrives.
function refreshStream(b) {
  const nb = document.getElementById('bw-noteby'); if (nb) nb.textContent = noteByText(b);
  const box = document.getElementById('bw-stream');
  if (!box || box.dataset.bill !== String(b.id)) return;
  // New activity lands at the top now, so it is the top that must be held, not the bottom.
  const nearTop = window.scrollY <= 240;
  box.innerHTML = streamInner(b);
  wireStream(box, b);
  if (nearTop) window.scrollTo(0, 0);
}

// ---- building the stream ----
// The Capitol gives a date, not a time (every action arrives stamped 8:00 AM), and names the chamber in details.
const chamberOf = ev => (/^Official action\s*-\s*(House|Senate)$/i.exec(ev.details || '') || [])[1] || '';
// One official action in a few words: "HLT passed with amendments (8 yes, 1 no)", "Hearing set: FIN 2/27, 10:00AM".
function shortCodes(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim(), m;
  const ay = /(\d+)\s+Ayes?\b/i.exec(s), no = /(\d+)\s+No(?:es|e)?s?\b/i.exec(s);
  const votes = ay ? ` (${ay[1]} yes${no ? `, ${no[1]} no` : ''})` : '';
  if ((m = /committee(?:\(s\))?\s+on\s+([A-Z][A-Z\/, ]*?)\s+recommend(?:\(s\)|s)?\s+that the measure be\s+([A-Z ,]+?)\./i.exec(s))) {
    const v = m[2].toLowerCase();
    const said = /amend/.test(v) ? 'passed with amendments' : /unamended/.test(v) ? 'passed as is' : /pass/.test(v) ? 'passed' : /defer/.test(v) ? 'deferred it' : /recommit/.test(v) ? 'recommitted it' : v.replace(/,/g, '');
    return `${m[1].trim()} ${said}${votes}`;
  }
  if ((m = /^Bill scheduled to be heard by\s+([A-Z][A-Z\/]*)\s+on\s+\w+,?\s+(\d{1,2})-(\d{1,2})-\d{2,4}\s+(\d{1,2}:\d{2}\s?[AP]M)/i.exec(s))) return `Hearing set: ${m[1]} ${+m[2]}/${+m[3]}, ${m[4]}`;
  // The Senate's notice reads "The committee(s) on HHS/CPN has scheduled a public hearing on 03-20-26 9:30AM; Conference…"
  if ((m = /^The committee\(s\) on\s+([A-Z][A-Z\/]*)\s+(?:has|have) scheduled a public hearing on\s+(\d{1,2})-(\d{1,2})-\d{2,4}\s+(\d{1,2}:\d{2})\s?([AP]M)/i.exec(s))) return `Hearing set: ${m[1]} ${+m[2]}/${+m[3]}, ${m[4]} ${m[5].toUpperCase()}`;
  if ((m = /^Bill scheduled for Conference Committee Meeting on\s+\w+,?\s+(\d{1,2})-(\d{1,2})-\d{2,4}\s+(\d{1,2}:\d{2}\s?[AP]M)?/i.exec(s))) return `Conference meeting set: ${+m[1]}/${+m[2]}${m[3] ? ', ' + m[3] : ''}`;
  const sent = /Transmitted to (House|Senate)/i.exec(s);
  s = s.replace(/\s*\((?:Stand\.|Hse\.|Sen\.|Conf\.|SSCR|HSCR|Gov\.)[^)]*\)/gi, '')
    .replace(/\s*The votes (?:were|in [A-Z\/]+ were) as follows:.*$/i, '')
    .replace(/\s+with (?:none|[^;]*?) voting aye with reservations.*$/i, '')
    .replace(/;\s*none voting.*$/i, '').replace(/,?\s*referral sheet \d+/i, '').replace(/\.\s*Transmitted to (House|Senate)\.?/i, '').replace(/\.$/, '').trim();
  if (sent && !/transmitted/i.test(s)) s += `; sent to the ${sent[1]}`;
  return s.length > 96 ? s.slice(0, 94).replace(/\s\S*$/, '') + '…' : s;
}
// The line a closed day shows says committees and drafts in words (V05: "House Judiciary passed with amendments (8 yes)",
// "Referred to Senate Transportation, Senate Judiciary", "as amended in House draft 1"); the Capitol's own words, codes
// and all, are what the day opens to.
const isCmte = k => !!(COMMITTEES[k] || S.committees?.[k]);
export function shortAction(t) {
  return shortCodes(t)
    .replace(/\b[A-Z]{3}(?:\/[A-Z]{3})*\b/g, c => c.split('/').every(isCmte) ? (committeeName(c) || c) : c)
    .replace(/\b(HD|SD|CD|FD) ?(\d)\b/g, (m, k, n) => versionWords(k + n));
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
  // Within one day the Capitol's actions read newest first too, so the whole stream runs one direction.
  for (const [day, evs] of official) { evs.sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at))); out.push({ kind: 'day', at: evs[0].occurred_at, day, evs }); }
  return out.sort((x, y) => String(y.at).localeCompare(String(x.at)));
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
    return `<div class="bw-msg${mine ? ' mine' : ''}${fresh ? ' fresh' : ''}" data-msg="${esc(m.id)}">${avatar(a, 32)}
      <div class="bw-msgb"><p class="bw-msgh"><b>${esc(mine ? 'You' : a?.full_name || 'Someone')}</b><span class="bw-quiet">${esc(timeOf(m.created_at))}</span>${fresh ? '<span class="bw-new">New</span>' : ''}</p>
        <div class="bw-msgt">${msgHTML(m.body)}</div>
        ${mine ? '' : `<p class="bw-msgacts">${btn('Reply', { kind: 'text', sm: true, icon: 'reply', attrs: { 'data-reply': m.id, 'aria-label': `Reply to ${firstName(a)}` } })}</p>`}</div>
      ${iconBtn('ellipsis', 'More for this message', { 'data-msgmore': m.id, 'aria-haspopup': 'dialog' }, 'bw-msgmore')}</div>`;
  }
  if (it.kind === 'log') {
    const ev = it.ev, a = advocate(ev.advocate_id);
    return `<div class="bw-log"><span class="bw-logic">${icon(LOG_ICON[ev.type] || 'notebook-pen')}</span><div class="bw-msgb">
      <p class="bw-msgh"><b>${esc(a ? (a.id === S.me?.id ? 'You' : a.full_name) : 'The team')}</b><span class="bw-quiet">added ${esc((LOG_LABEL[ev.type] || 'a note').toLowerCase())} · ${esc(timeOf(ev.occurred_at))}</span></p>
      <p class="bw-msgt">${esc(ev.title)}</p>${ev.details ? `<p class="bw-msgd">${esc(ev.details)}</p>` : ''}</div></div>`;
  }
  const line = it.evs.map(ev => shortAction(ev.title)).join(' · ');
  return `<details class="bw-off"><summary><span class="bw-logic">${icon('landmark')}</span><span class="bw-offt"><b>Capitol</b> ${esc(line)}</span>${icon('chevron-down', { cls: 'chev' })}</summary>
    <ul>${it.evs.map(ev => `<li>${chamberOf(ev) ? `<span class="bw-quiet">${esc(chamberOf(ev))}</span> ` : ''}${esc(ev.title)}${ev.details && !chamberOf(ev) ? ` <span class="bw-quiet">${esc(ev.details)}</span>` : ''}</li>`).join('')}</ul></details>`;
}
function streamInner(b) {
  const all = items(b), loading = !(S.bwTL && b.id in S.bwTL);
  const showAll = !!S.bwActAll?.[b.id], shown = showAll ? all : all.slice(0, LIMIT);
  let html = '';
  if (loading) html += `<p class="bw-quiet bw-loading">${icon('loader-circle')}Loading the Capitol’s record…</p>`;
  if (S.bwTLErr?.[b.id]) html += `<p class="bw-quiet">The Capitol’s record did not load. Messages still work.</p>`;
  if (!all.length && !loading) return html + `<p class="bw-none">Nothing here yet.</p>`;
  let last = '';
  for (const it of shown) {
    const k = hstDayOf(it.at);
    if (k !== last) { html += `<h3 class="bw-day">${esc(dayLabel(it.at))}</h3>`; last = k; }
    html += itemHTML(b, it);
  }
  // Older entries are older, so the way to them is downwards now, not upwards.
  if (all.length > shown.length) html += btn(`Show ${all.length - shown.length} earlier`, { kind: 'text', icon: 'history', attrs: { 'data-earlier': '1' }, cls: 'bw-more-act' });
  return html;
}
// ---- conversations with legislators: this bill's, and its issues' ----
const convQ = b => ({ billId: b.id, issueIds: issuesOfBill(b.id).map(i => i.id) });
function convOpts(b) {
  const n = issuesOfBill(b.id).length;
  // Two at most before "Show all": the message box below is what this tab is used for most (desktop draws it on top).
  // v3: no count, no button of its own (the one Log button asks), and hidden until there is a conversation to show.
  return { id: 'bw-cv', q: convQ(b), here: { billId: b.id, issueIds: convQ(b).issueIds }, limit: 2, log: { bill: b }, act: false, count: false, hideEmpty: true,
    none: `No conversations with legislators logged yet${n ? ` for this bill or ${n === 1 ? 'its issue' : 'its issues'}` : ''}.` };
}

// The one box: what it is (Message · Log what happened · Talk with a legislator, v5's own words), the words, and Send.
// Remembered per bill for the visit, with the words typed (B-6).
const KINDS = [['msg', 'Message'], ['note', 'Log what happened'], ['talk', 'Talk with a legislator']];
const HINT = { msg: 'Message the team. Type @ to notify someone.', note: 'What happened? It goes in the bill’s record.', talk: 'What was said? Next you pick who it was with.' };
const SEND = { msg: 'Send message', note: 'Add it to the bill’s record', talk: 'Next: who was it with?' };
// Under 480px the third switch says "Legislator talk", so the three stay one even row (bill.css shows one of the two).
const segWords = html => html.replace('>Talk with a legislator</button>', '><span class="bw-seg-l">Talk with a legislator</span><span class="bw-seg-s">Legislator talk</span></button>');
const kindOf = b => (S.bwKind ??= {})[b.id] || 'msg';
const NOTE_TYPES = ['note', 'testimony', 'coalition', 'action_alert'].map(v => [v, NOTE_WORD[v]]);   // a meeting with a legislator is a talk; with anyone else, something else
export function renderActivity(b, { inline = true } = {}) {
  if (seenSnap.bill !== b.id || viewIsNew()) seenSnap = { bill: b.id, at: S.chatSeen?.[b.id] || '' };
  return `<section class="bw-sec bw-act" aria-labelledby="bw-act-h">
    <h2 id="bw-act-h" class="sr">Team talk</h2>
    ${inline ? `<div class="bw-box">${composerBar(b)}</div>` : ''}
    ${convSectionHTML({ ...convOpts(b), title: 'Talks with legislators', kind: 'bw' })}
    <div class="bw-stream" id="bw-stream" data-bill="${esc(b.id)}">${streamInner(b)}</div>
  </section>`;
}

// ---- the box ----
// Enter sends a message where there is a real keyboard; on a touch screen Return makes a new line and the button sends.
// A note or a talk is longer, so Enter is a new line there and the button sends.
const enterSends = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
export function composerBar(b) {
  const k = kindOf(b), d = drafts.get(b.id + ':chat') || '', nt = S.bwNoteType || 'note';
  return `<form class="bw-composer" data-bill="${esc(b.id)}" data-kind="${k}" novalidate>
    ${segWords(segmented('bwkind', KINDS, k, 'What is it?'))}
    <div class="bw-mention" role="group" aria-label="Notify a teammate" hidden></div>
    <div class="bw-crow"><label class="sr" for="bw-chat">${esc(KINDS.find(x => x[0] === k)[1])}</label>
      <textarea id="bw-chat" rows="${k === 'msg' ? 1 : 3}" maxlength="4000" placeholder="${esc(HINT[k])}">${esc(d)}</textarea>
      <button type="submit" class="bw-send" aria-label="${esc(SEND[k])}" title="${esc(SEND[k])}">${icon(k === 'talk' ? 'arrow-right' : 'send')}</button></div>
    ${k === 'note' ? `<label class="bw-ntype"><span>What happened</span><select id="bw-ntype" class="input">${NOTE_TYPES.map(([v, l]) => `<option value="${v}"${v === nt ? ' selected' : ''}>${esc(NOTE_WORD[v] || LOG_LABEL[v] || l)}</option>`).join('')}</select></label>` : ''}
  </form>`;
}
const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

export function wireActivity(pnl, b, route, root) {
  const entry = viewIsNew();
  // Nothing to scroll to on open: the newest entry is the first one.
  if (unreadCount(b)) DB.markChatSeen(b.id).catch(() => {});
  wireConvSection(pnl, convOpts(b));
  wireStream(pnl.querySelector('#bw-stream'), b);
  const form = root.querySelector('.bw-composer'); if (!form) return;
  const k = kindOf(b), ta = form.querySelector('#bw-chat'), box = form.querySelector('.bw-mention'), key = b.id + ':chat';
  // The kind switch keeps the words typed and the cursor in the box.
  form.querySelectorAll('[data-seg="bwkind"]').forEach(el => el.onclick = () => { S.bwKind[b.id] = el.dataset.val; rerender('#bw-chat'); });
  form.querySelector('#bw-ntype')?.addEventListener('change', e => { S.bwNoteType = e.target.value; });
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; };
  // A message's hint where it fits on one line; shorter ones on a narrow phone, so the empty box stays one line tall.
  if (k === 'msg') for (const ph of [HINT.msg, 'Message the team (@ to notify)', 'Message the team']) { ta.placeholder = ph; if (ta.value || ta.scrollHeight <= ta.clientHeight + 2) break; }
  grow();
  // @ offers teammates whose name starts with what follows it; picking one writes "@Kevin ".
  const people = S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id);
  const mention = () => {
    if (k !== 'msg') { box.hidden = true; return; }
    const upto = ta.value.slice(0, ta.selectionStart), m = /(^|\s)@([A-Za-zʻ'-]*)$/.exec(upto);
    const hits = m ? people.filter(a => firstName(a).toLowerCase().startsWith(m[2].toLowerCase())).slice(0, 6) : [];
    box.hidden = !hits.length;
    box.innerHTML = hits.map(a => `<button type="button" class="bw-at-pick" data-at="${esc(firstName(a))}">${avatar(a, 24)}<span>@${esc(firstName(a))}</span></button>`).join('');
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
    // Tab or Enter picks a name only when one name matches: "@Pat" then Enter sent Lauren's note to Patrick, not Patti (R-267).
    if (!box.hidden && (e.key === 'Tab' || e.key === 'Enter') && !e.shiftKey) { const f = box.querySelectorAll('[data-at]'); if (f.length) { e.preventDefault(); if (f.length === 1) pickAt(f[0].dataset.at); return; } }
    if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); box.hidden = true; return; }
    if (k === 'msg' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && enterSends()) { e.preventDefault(); form.requestSubmit(); }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body && k !== 'talk') { ta.focus(); return; }
    if (!S.me) { toast('Your login is not linked to a staff record yet. Ask your admin.', { err: true }); return; }
    // A talk: the conversation sheet takes it from here (who, when, what was said, already filled in); the box empties
    // once it is saved, and keeps the words if the sheet is closed.
    if (k === 'talk') { logConversation({ bill: b, text: body, onDone: () => { drafts.delete(key); refreshConversations(); rerender('#bw-chat'); } }); return; }
    const send = form.querySelector('.bw-send'); send.setAttribute('aria-busy', 'true'); ta.readOnly = true;
    try {
      if (k === 'msg') { await DB.sendMessage(b.id, body); drafts.delete(key); rerender('#bw-chat'); requestAnimationFrame(toTop); return; }
      // A note: its first line is what happened (the record's line, up to 200 characters), the rest its details.
      const [first, ...rest] = body.split('\n'), title = first.trim().slice(0, 200), more = [first.trim().slice(200), ...rest].join('\n').trim();
      const type = form.querySelector('#bw-ntype')?.value || 'note';
      await DB.addActivity(b.id, type, title, more);
      drafts.delete(key); rerender('#bw-chat'); toast(type === 'note' ? 'Added to the bill’s record.' : `Added to the bill’s record: ${(NOTE_WORD[type] || '').toLowerCase()}.`, { ok: true });
      loadTimeline(b, true);
    } catch (x) { send.removeAttribute('aria-busy'); ta.readOnly = false; toast(x, { err: true }); }
  };
  // "Message James" elsewhere (Today, Team) opens this tab with ?mention=JM (initials; a first name works too): the box is a
  // message starting "@James " with the cursor after it (R-022 wave 3). ?mention=JS,JN -> "@Jess @Jaylen ". Unknown
  // initials are skipped, and whatever was typed before stays after the names.
  const asked = entry && route.q?.mention ? String(route.q.mention).split(',').map(x => x.trim()).filter(Boolean) : [];
  // ?say= (OUTREACH): any screen can start a message here with its own words ("Can you send the email to followers?"),
  // put after the @names, without reaching into this file's drafts. Only into an empty box: nothing typed is lost.
  const say = entry && route.q?.say ? String(route.q.say).slice(0, 1000) : '';
  if ((asked.length || say) && k !== 'msg') { S.bwKind[b.id] = 'msg'; rerender(); return; }
  if (say && !ta.value.trim()) { ta.value = say; drafts.set(key, ta.value); grow(); }
  const mentioned = [...new Set(asked.map(w => S.advocates.find(a => a.id !== S.me?.id
    && ((a.initials || '').toUpperCase() === w.toUpperCase() || firstName(a).toLowerCase() === w.toLowerCase()))).filter(Boolean))];
  const missing = mentioned.filter(a => !new RegExp(`(^|\\s)@${firstName(a).replace(/[^\wʻ'-]/g, '')}\\b`, 'i').test(ta.value));
  if (missing.length) { ta.value = `${missing.map(a => '@' + firstName(a)).join(' ')} ${ta.value.trim() ? ta.value : ''}`; drafts.set(key, ta.value); grow(); }
  // A Reply button elsewhere (Today, How did it go?) opens this tab with ?reply=1: the cursor goes straight into the box.
  if (entry && (route.q?.reply || route.q?.compose || say || mentioned.length)) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollIntoView({ block: 'center' }); }
}
function wireStream(box, b) {
  if (!box) return;
  box.querySelector('[data-earlier]')?.addEventListener('click', () => { const y = document.documentElement.scrollHeight - window.scrollY; (S.bwActAll ??= {})[b.id] = true; box.innerHTML = streamInner(b); wireStream(box, b); window.scrollTo(0, document.documentElement.scrollHeight - y); });
  // Links in a message go through the router (the frame only wires links that exist when the page renders).
  box.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); e.stopImmediatePropagation(); S.go(a.getAttribute('href')); });
  box.querySelectorAll('[data-msgmore]').forEach(el => el.onclick = () => { const m = (S.messages?.[b.id] || []).find(x => String(x.id) === el.dataset.msgmore); if (m) msgMenu(b, m); });
  box.querySelectorAll('[data-reply]').forEach(el => el.onclick = () => { const m = (S.messages?.[b.id] || []).find(x => String(x.id) === el.dataset.reply); if (m) replyTo(b, m); });
}
// Reply (visible on someone else's message, F121): the box becomes a message starting "@Kevin ", the cursor after it.
function replyTo(b, m) {
  const n = firstName(advocate(m.advocate_id)), key = b.id + ':chat';
  if ((S.bwKind ??= {})[b.id] && S.bwKind[b.id] !== 'msg') { S.bwKind[b.id] = 'msg'; }
  const cur = drafts.get(key) || '';
  if (!cur.includes('@' + n)) drafts.set(key, `@${n} ${cur}`);
  rerender('#bw-chat');
  const ta = document.getElementById('bw-chat'); if (!ta) return;
  ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function msgMenu(b, m) {
  const mine = m.advocate_id === S.me?.id;
  menuSheet({ title: 'Message', items: [
    { label: 'Copy text', icon: 'copy', run: async () => { try { await navigator.clipboard.writeText(m.body); toast('Copied'); } catch { toast('Copying is blocked in this browser. Select the text instead.'); } } },
    mine || S.me?.is_admin ? { label: 'Delete message', icon: 'trash-2', danger: true, run: () => afterBack(() => delMsg(b, m)) } : null,
  ] });
}
async function delMsg(b, m) {
  if (!(await confirmSheet({ title: 'Delete this message?', text: 'It disappears for everyone on the team.', ok: 'Delete', danger: true }))) return;
  try { await DB.deleteMessage(m); rerender(); toast('Message deleted.'); } catch (e) { toast(e, { err: true }); }
}
