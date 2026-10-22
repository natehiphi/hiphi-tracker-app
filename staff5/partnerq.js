// Partner words to approve, on Today (R-328 batch B; Nate's decisions of 22 Oct 2026, the plan page in the backend's
// docs/partners-2026-10/page.html; backend migration 184). Outside advocacy groups write on the PUBLIC tracker; nothing
// they write shows until Nate or Jess (advocates.approves_partners) approves it. A person comes here to read a group's
// words on one bill (or one issue of its own) and either Approve them or Ask for a change with a note the group sees.
//
//   - Only the partner approvers see the cards: the database refuses anyone else's Approve, and a card that can only be
//     read would be one more thing on everybody's Today (A-24, B-13). Other staff see what a group has live on the
//     Partners screen (partnergroups.js).
//   - A phone gets one card per item: the partner, the bill and its side (a plain chip: HIPHI's blue chip stays HIPHI's,
//     A-5), who sent it and when, the closer-look flag, the first lines of the words, and the two buttons; every word is
//     one fold away ("Read all the words": detail inside one card, B-14). A laptop gets one row per item, and the item
//     picked opens in full beside the list (A-24), as every other row on Today does.
//   - Groups waiting for a second approver and requests to join live on the Partners screen; Today has one line that
//     counts the ones this person can act on and links there, so Today stays one list to clear.
//   - Approve is one tap (Nate). It takes 10 seconds to reach the database so Undo can stop it (B-5; the same delay
//     Today's suggestion log uses): approved words cannot be put back to waiting once they are live.
//   - The reading grade beside each talking point is the same arithmetic as tests/words_test.mjs (C-10 asks grade 8).
import { S, DB, esc, fmtDate, hooks } from './data.js';
import { icon, btn, chip, toast, openSheet, closeSheet, groupHead, friendly, POS_WORD, POS_ICON } from './ui.js';
import { whenAt, billNum, billRoute, billById } from './model.js';

// ---- who ----
// approves_partners comes with the advocates row (migration 184); a turned-off person approves nothing.
export const approvesPartners = (a = S.me) => !!a && a.is_active !== false && !!a.approves_partners;
// An admin or an approver adds groups and people, pauses them and handles requests (partner_admitter() in 184).
export const admitsPartners = (a = S.me) => !!a && a.is_active !== false && (!!a.is_admin || !!a.approves_partners);
export const firstName = id => (S.advocates.find(a => a.id === id)?.full_name || '').split(' ')[0];
// The other approvers, by first name ("Jess"), for "Waits for Jess to approve".
export const otherApprovers = (except = S.me?.id) => S.advocates.filter(a => approvesPartners(a) && a.id !== except).map(a => a.full_name.split(' ')[0]);
export const orList = names => names.length <= 1 ? names[0] || 'a second approver' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

// ---- words ----
export const sideWord = s => POS_WORD[s] || s;
export const sideChip = s => chip(sideWord(s), '', POS_ICON[s] || 'circle-dashed');
const STANCE = { support: ['Supports', 'thumbs-up'], oppose: ['Opposes', 'thumbs-down'], mixed: ['Mixed', 'scale'] };
export const stanceChip = s => STANCE[s] ? chip(STANCE[s][0], '', STANCE[s][1]) : '';
// The closer-look line, in Nate's words (22 Oct). flag: null (HIPHI is on the same side: the database checked it),
// 'none' (no position, or not public), 'monitor', 'neutral'.
const FLAG = {
  none: ['info', 'HIPHI has no position on this bill, so the partner chose freely.'],
  monitor: ['eye', 'HIPHI only monitors this bill: worth a closer look.'],
  neutral: ['message-square', 'HIPHI is neutral on this bill: worth a closer look.'],
};
const flagLine = f => { const [ic, w] = FLAG[f] || ['circle-check', 'Same side as HIPHI, checked.'];
  return `<p class="pq-flag ${!FLAG[f] ? 'ok' : f === 'none' ? 'none' : 'look'}">${icon(ic)}<span>${esc(w)}</span></p>`; };
const dayWord = d => d ? fmtDate(d, { weekday: 'short' }).replace(',', '') : '';
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// Flesch-Kincaid grade, as tests/words_test.mjs and tests/checks.py count it: sentences of three words or more, a word
// is anything with a letter in it, syllables by vowel groups. A short line (under three words) has no grade.
const syllables = word => {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length);
};
export function fkGrade(text) {
  const sents = String(text || '').split(/[.!?]+\s|\n+/).filter(t => t.split(/\s+/).filter(Boolean).length >= 3);
  const words = sents.flatMap(t => t.split(/\s+/).filter(Boolean)).filter(w => /[A-Za-z]/.test(w));
  if (!sents.length || !words.length) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return Math.max(1, Math.round(0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59));
}
const gradeTag = t => { const g = fkGrade(t); return g == null ? '' : `<span class="pq-grade${g > 8 ? ' hi' : ''}">grade ${g}${g > 8 ? ', above 8' : ''}</span>`; };
const pointsSum = pts => { const n = pts.length; if (!n) return 'none';
  const hi = pts.filter(p => (fkGrade(p) ?? 0) > 8).length;
  return `${n}, ${hi ? `${hi} above grade 8` : n === 1 ? 'at grade 8 or below' : 'all at grade 8 or below'}`; };

// ---- the queue ----
// partner_queue() (184): { bills, issues, groups, requests }. Asked once a visit (and again after Refresh: loadAll clears
// it); the page draws without it and redraws when it comes. A read that fails says so on the line, with Try again (B-8).
const keyOf = it => `pq:${it.kind}:${it.id}`;
const HOLD = new Map();   // approvals waiting out their 10 seconds, by key
export function wantQueue({ force = false } = {}) {
  if (!admitsPartners() || S.pqLoading || (!force && S.pq !== undefined)) return;
  S.pqLoading = true; S.pqErr = false;
  DB.partnerQueue().then(q => { S.pq = q; }).catch(e => { console.warn('partner_queue:', e?.message || e); S.pq = null; S.pqErr = true; })
    .finally(() => { S.pqLoading = false; if (['today', 'pgroups'].includes(S.route?.name)) hooks.render(); });
}
// What waits on this person: the words they may approve (never one they hold in their 10 seconds).
export function pqItems() {
  if (!approvesPartners() || !S.pq) return [];
  return [...(S.pq.bills || []), ...(S.pq.issues || [])].filter(it => !HOLD.has(keyOf(it))).sort((x, y) => String(x.words?.sent_at || '').localeCompare(String(y.words?.sent_at || '')));
}
// Groups this person can approve (an approver who did not add it) and new requests, for Today's one line.
export function pqOthers() {
  if (!admitsPartners() || !S.pq) return { groups: [], requests: [] };
  return { groups: approvesPartners() ? (S.pq.groups || []).filter(g => g.added_by !== S.me?.id) : [], requests: S.pq.requests || [] };
}

// ---- drawing ----
const billOf = it => billById(it.bill_id) || { bill_number: it.bill_number, title: it.title };
const billLink = it => billRoute(billOf(it));
const groupHref = slug => `#/partners/${encodeURIComponent(slug)}`;
const nameOf = it => it.kind === 'issue' ? (it.words?.name || 'An issue of its own') : (it.words?.nickname || billOf(it).nickname || clip(billOf(it).title, 70));
const sentLine = it => [`Sent ${whenAt(it.words?.sent_at || it.words?.written_at)}${it.by ? ` by ${it.by}` : ''}`.replace(/\.?$/, '.'), it.live ? 'An edit: the live version stays up until you approve.' : ''].filter(Boolean).join(' ');
// HIPHI's issue by its id, else one of the group's own (the queue read brings their names: data.js partnerQueue).
const issueName = id => S.issues?.find(i => i.id === id)?.name || (S.pq?.issueNames || {})[id] || null;
// What changed against the live words (an edit): each field that differs, then the talking points kept, added and dropped.
function changes(w, l) {
  if (!l) return '';
  const rows = [], same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
  const f = (label, a, b, fmt = x => esc(x)) => { if (!same(a, b)) rows.push(`<li><b>${label}</b><span class="pq-was">Was: ${a ? fmt(a) : '<i>nothing</i>'}</span><span class="pq-now">Now: ${b ? fmt(b) : '<i>nothing</i>'}</span></li>`); };
  if (l.side !== undefined) f('Side', l.side, w.side, s => esc(sideWord(s)));
  f('Nickname', l.nickname, w.nickname); f('In plain words', l.summary, w.summary);
  if (l.name !== undefined) { f('Name', l.name, w.name); f('Description', l.description, w.description); f('Side', l.stance, w.stance, s => esc(STANCE[s]?.[0] || s)); }
  const lp = (l.points || []).map(String), wp = (w.points || []).map(String);
  const add = wp.filter(p => !lp.includes(p)), drop = lp.filter(p => !wp.includes(p));
  if (add.length || drop.length) rows.push(`<li><b>Talking points</b>${add.map(p => `<span class="pq-now">Added: ${esc(p)}</span>`).join('')}${drop.map(p => `<span class="pq-was">Taken out: ${esc(p)}</span>`).join('')}</li>`);
  const askOf = x => x.ask ? `${String(x.ask).replace(/[.\s]+$/, '')} · until ${dayWord(x.ask_until)}` : '';
  f('The ask', askOf(l), askOf(w));
  f('Draft notes', l.draft_note ? `${l.draft_version ? l.draft_version + ': ' : ''}${l.draft_note}` : '', w.draft_note ? `${w.draft_version ? w.draft_version + ': ' : ''}${w.draft_note}` : '');
  const iss = x => (x.issue_ids || []).map(id => issueName(id) || 'one of the group’s own issues').join(', ');
  f('Under these issues', iss(l), iss(w));
  return `<div class="pq-sec"><h4 class="pq-h4">What changed</h4>${rows.length ? `<ul class="pq-diff">${rows.join('')}</ul>` : '<p class="pq-p">Nothing in the words: they sent the same version again.</p>'}</div>`;
}
// Every word they sent, in the order the public sees them on a bill.
function wordsHTML(it) {
  const w = it.words || {};
  if (it.kind === 'issue') return `<dl class="pq-dl"><dt>Name</dt><dd>${esc(w.name || '')}</dd>${w.description ? `<dt>Description</dt><dd>${esc(w.description)} ${gradeTag(w.description)}</dd>` : ''}</dl>`;
  const pts = (w.points || []).filter(Boolean), iss = (w.issue_ids || []).map(id => issueName(id) || 'One of the group’s own issues');
  return `<dl class="pq-dl">
    ${w.nickname ? `<dt>Nickname</dt><dd>${esc(w.nickname)}</dd>` : ''}
    <dt>In plain words</dt><dd>${esc(w.summary || '')} ${gradeTag(w.summary)}</dd>
    <dt>Talking points <span class="pq-n">${pts.length} of 5</span></dt><dd>${pts.length ? `<ol class="pq-pts">${pts.map(p => `<li>${esc(p)} ${gradeTag(p)}</li>`).join('')}</ol>` : 'None'}</dd>
    ${w.ask ? `<dt>The ask</dt><dd>${esc(w.ask)} <span class="pq-until">until ${esc(dayWord(w.ask_until))}</span></dd>` : ''}
    ${w.draft_note ? `<dt>Draft notes${w.draft_version ? ` (${esc(w.draft_version)})` : ''}</dt><dd>${esc(w.draft_note)}</dd>` : ''}
    ${iss.length ? `<dt>Under these issues</dt><dd>${iss.map(esc).join(', ')}</dd>` : ''}</dl>`;
}
const head = (it, h = 'h3', id = '') => {
  const b = it.kind === 'bill' ? billOf(it) : null;
  return `<${h} class="pq-name"${id ? ` id="${id}"` : ''}><a class="pq-grp" href="${groupHref(it.partner_slug)}">${esc(it.partner_name)}</a>${b ? ` <span class="pq-on">on</span> <a class="pq-bill" href="${esc(billLink(it))}">${esc(billNum(b))}</a>` : ` <span class="pq-on">· its own issue</span>`}</${h}>`;
};
const sideOf = it => it.kind === 'issue' ? stanceChip(it.words?.stance) : sideChip(it.words?.side);
const acts = (it, primary) => `${btn('Approve', { kind: primary ? 'primary' : 'secondary', icon: 'check', attrs: { 'data-pqok': keyOf(it) } })}${btn('Ask for a change', { kind: 'text', icon: 'message-square', attrs: { 'data-pqask': keyOf(it), 'aria-haspopup': 'dialog' } })}`;

// A phone's card: enough to judge most items without opening the fold.
function card(it) {
  const w = it.words || {}, k = keyOf(it);
  const brief = it.kind === 'issue' ? (w.description ? `<p class="pq-line">${esc(clip(w.description, 140))}</p>` : '')
    : `<p class="pq-line"><b>In plain words:</b> ${esc(clip(w.summary, 140))}</p><p class="pq-line"><b>Points:</b> ${esc(pointsSum((w.points || []).filter(Boolean)))}${w.ask ? ` · <b>Ask</b> until ${esc(dayWord(w.ask_until))}` : ''}</p>`;
  return `<article class="card pq-card" data-pqcard="${esc(k)}" aria-labelledby="${esc(k)}-h">
    <div class="pq-top">${head(it, 'h3', esc(k) + '-h')}${sideOf(it)}</div>
    <p class="pq-t">${esc(nameOf(it))}</p>
    <p class="pq-meta">${esc(sentLine(it))}</p>
    ${it.kind === 'bill' ? flagLine(it.flag) : ''}
    ${brief}
    <details class="pq-more"><summary>${icon('chevron-down', { cls: 'chev' })}<span>Read all the words${it.live ? ' and what changed' : ''}</span></summary>${changes(w, it.live)}<div class="pq-sec">${wordsHTML(it)}</div></details>
    <div class="pq-acts">${acts(it, false)}</div></article>`;
}
// A laptop's row: the step's name first, as every row on Today (R-279), and what tells one from the next.
function row(it, reg) {
  const k = keyOf(it), ek = esc(k), b = it.kind === 'bill' ? billOf(it) : null;
  reg(k, { partner: it, key: k });
  const what = [it.live ? 'An edit' : 'New', it.kind === 'issue' ? STANCE[it.words?.stance]?.[0] : sideWord(it.words?.side), it.kind === 'bill' && it.flag && it.flag !== 'none' ? 'worth a closer look' : ''].filter(Boolean).join(' · ');
  return `<div data-k="${ek}" class="td-row pq-row"><button type="button" class="td-rsel" data-sel="${ek}" aria-current="false"><span class="td-urg" aria-hidden="true"></span><span class="td-rmain">
      <span class="td-rb"><b class="td-num">${esc(it.partner_name)}</b><span class="td-rn">${esc(b ? billNum(b) + ' · ' + nameOf(it) : 'Its own issue · ' + nameOf(it))}</span></span>
      <span class="td-rs"><b class="td-step">${it.kind === 'issue' ? 'Approve partner issue' : 'Approve partner words'}</b><span class="td-stepdot" aria-hidden="true"> · </span><span class="td-rd">${esc(what)}</span></span></span></button>
    <span class="td-ract"></span><span class="td-rmark" aria-hidden="true">${icon('chevron-right')}</span></div>`;
}
// The open item beside the rows: everything, then the two buttons (Approve the one filled button, A-3).
export function partnerPane(c) {
  const it = c.partner, w = it.words || {};
  return `<div class="td-ptop"><p class="td-pnum td-rkind">${icon('handshake')}<span>${it.kind === 'issue' ? 'Partner issue' : 'Partner words'}</span></p></div>
    <div class="pq-pane">${head(it, 'h2', 'td-pane-h')}
    <p class="pq-t">${esc(nameOf(it))} ${sideOf(it)}</p>
    <p class="pq-meta">${esc(sentLine(it))}</p>
    ${it.kind === 'bill' ? flagLine(it.flag) : ''}
    ${it.live ? `${changes(w, it.live)}<details class="pq-more"><summary>${icon('chevron-down', { cls: 'chev' })}<span>All the words, as they would go live</span></summary><div class="pq-sec">${wordsHTML(it)}</div></details>`
      : `<div class="pq-sec">${wordsHTML(it)}</div>`}
    <div class="pq-acts bp-acts">${acts(it, true)}</div></div>`;
}

// Today's section (Mine only). rows: the laptop's rows; reg(k, card): Today keeps the row for its open item and j/k.
export function partnerToday({ rows = false, reg = () => {} } = {}) {
  wantQueue();
  const items = pqItems(), o = pqOthers(), n = o.groups.length + o.requests.length;
  const parts = [o.groups.length ? plural(o.groups.length, 'group') + ' to approve' : '', o.requests.length ? `${plural(o.requests.length, 'group')} ${o.requests.length === 1 ? 'asks' : 'ask'} to join` : ''].filter(Boolean);
  const line = S.pqErr && admitsPartners() ? `<p class="pq-gline">${icon('circle-alert')}<span>The partners’ words did not load.</span>${btn('Try again', { kind: 'text', sm: true, attrs: { 'data-pqretry': '1' } })}</p>`
    : n ? `<p class="pq-gline">${icon('handshake')}<span><b>Partners:</b> ${esc(parts.join(' · '))}</span><a class="pq-golink" href="#/partners">Open Partners${icon('chevron-right')}</a></p>` : '';
  if (!items.length) return { n: 0, html: line };
  const list = rows ? `<div class="td-rows">${items.map(it => row(it, reg)).join('')}</div>` : `<div class="pq-list">${items.map(card).join('')}</div>`;
  return { n: items.length, html: `<section class="td-group pq-group" aria-labelledby="td-g-pq"><h2 class="td-h">${groupHead('Partner words to approve', items.length, { id: 'td-g-pq' })}</h2>${list}${line}</section>` };
}

// ---- doing ----
const itemBy = k => [...(S.pq?.bills || []), ...(S.pq?.issues || [])].find(it => keyOf(it) === k);
const what = it => it.kind === 'issue' ? `${it.partner_name}’s issue “${it.words?.name || ''}”` : `${it.partner_name}’s words on ${billNum(billOf(it))}`;
const drop = it => { if (!S.pq) return; S.pq.bills = (S.pq.bills || []).filter(x => x !== it); S.pq.issues = (S.pq.issues || []).filter(x => x !== it); };
async function commit(k) {
  const h = HOLD.get(k); if (!h) return; HOLD.delete(k); clearTimeout(h.t);
  try { await DB.partnerReview(h.it, true, null); drop(h.it); }
  catch (e) { toast(`${what(h.it)} did not go live. ${friendly(e)}`, { err: true }); }
  if (S.route?.name === 'today') hooks.render();
}
// The 10 seconds run on whatever page is open; leaving the app sends what is held (best effort: if it never arrives, the
// words simply wait for approval again, which is the safe way to fail).
addEventListener('pagehide', () => { for (const k of [...HOLD.keys()]) commit(k); });
function approve(k) {
  const it = itemBy(k); if (!it || HOLD.has(k)) return;
  const t = setTimeout(() => commit(k), 10000);
  HOLD.set(k, { it, t });
  S.tdRefocus = null; hooks.render();
  toast(it.kind === 'issue' ? `Approved: ${what(it)} goes live.` : `Approved: ${what(it)} go live.`, { ok: true, undo: () => { const h = HOLD.get(k); if (h) { clearTimeout(h.t); HOLD.delete(k); } hooks.render(); toast('Undone. It waits for approval again.'); } });
}
function askChange(k) {
  const it = itemBy(k); if (!it) return;
  openSheet({ title: `Ask ${esc(it.partner_name)} for a change`, size: 'auto',
    body: `<p class="pq-shp">${esc(it.kind === 'issue' ? `On its issue “${it.words?.name || ''}”.` : `On ${billNum(billOf(it))}, ${nameOf(it)}.`)} ${it.live ? 'Their live words stay up meanwhile.' : 'Nothing of theirs shows on it meanwhile.'}</p>
      <div class="field"><label for="pq-note">What to change</label><textarea id="pq-note" rows="4" maxlength="400" aria-describedby="pq-note-help" autofocus></textarea>
      <span class="help" id="pq-note-help">The group sees this note with their words. Say what to change and why, in a sentence or two.</span></div><div id="pq-note-err" role="alert"></div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn('Send the note', { icon: 'send', attrs: { 'data-go': '1' } })}`,
    wire: d => {
      const ta = d.querySelector('#pq-note'), go = d.querySelector('[data-go]'), err = m => { d.querySelector('#pq-note-err').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}<span>${esc(m)}</span></p>` : ''; };
      d.querySelector('[data-no]').onclick = () => closeSheet();
      go.onclick = async () => {
        const note = ta.value.trim(); if (!note) { err('Say what to change: the group needs to know.'); ta.focus(); return; }
        if (go.getAttribute('aria-busy')) return; go.setAttribute('aria-busy', 'true'); err('');
        try { await DB.partnerReview(it, false, note); } catch (e) { go.removeAttribute('aria-busy'); err(friendly(e)); return; }
        drop(it); await closeSheet({ silent: true }); hooks.render();
        toast(`Sent to ${it.partner_name}. They see your note and can send the words again.`, { ok: true });
      };
    } });
}
export function wirePartner(el) {
  el.querySelectorAll('[data-pqok]').forEach(b => b.onclick = e => { e.stopPropagation(); approve(b.dataset.pqok); });
  el.querySelectorAll('[data-pqask]').forEach(b => b.onclick = e => { e.stopPropagation(); askChange(b.dataset.pqask); });
  el.querySelectorAll('[data-pqretry]').forEach(b => b.onclick = () => wantQueue({ force: true }));
  // A card's fold stays as it was left when Today redraws (B-6).
  el.querySelectorAll('[data-pqcard] .pq-more').forEach(d => d.addEventListener('toggle', () => { (S.pqOpen ??= new Set())[d.open ? 'add' : 'delete'](d.closest('[data-pqcard]').dataset.pqcard); }));
  el.querySelectorAll('[data-pqcard]').forEach(c => { if (S.pqOpen?.has(c.dataset.pqcard)) c.querySelector('.pq-more')?.setAttribute('open', ''); });
}
// For the sandbox's practice data and the Partners screen: a fresh read after a change there.
export const queueChanged = () => { S.pq = undefined; };
