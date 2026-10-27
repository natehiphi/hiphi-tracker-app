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
//   - Words that carry an ask (R-328 batch G, backend 185): the card shows the ask on its own, says which 4:30 PM email
//     it joins once approved, and has one switch, "Also by text" (off: partner asks are email only unless Nate or Jess
//     switches it on for one ask). An ask longer than a text (110 characters) needs a line of its own for the text. The
//     approved ask then shows on the Partners screen as "Going out at 4:30 PM" with Take it back, like HIPHI's own.
import { S, DB, esc, fmtDate, hooks } from './data.js';
import { icon, btn, chip, toast, openSheet, closeSheet, groupHead, friendly, switchRow, POS_WORD, POS_ICON } from './ui.js';
import { whenAt, billNum, billRoute, billById } from './model.js';
import { dailyWord, paused, HELD_NEXT } from './composer.js';   // which 4:30 PM email; while email is paused an approved ask is held, as HIPHI's own
import { numWords, stepHeadHTML } from './steps.js';   // Staff v6: the bill number as every row says it (D15)

// ---- who ----
// approves_partners comes with the advocates row (migration 184); a turned-off person approves nothing.
export const approvesPartners = (a = S.me) => !!a && a.is_active !== false && !!a.approves_partners;
// An admin or an approver adds groups and people, pauses them and handles requests (partner_admitter() in 184).
export const admitsPartners = (a = S.me) => !!a && a.is_active !== false && (!!a.is_admin || !!a.approves_partners);
export const firstName = id => (S.advocates.find(a => a.id === id)?.full_name || '').split(' ')[0];
// The other approvers, by first name ("Jess"), for "Waits for Jess to approve".
export const otherApprovers = (except = S.me?.id) => S.advocates.filter(a => approvesPartners(a) && a.id !== except).map(a => a.full_name.split(' ')[0]);
// No names: "a partner approver", the role's own name (C-15: "a second approver" is testimony's role, LEAD's ask).
export const orList = names => names.length <= 1 ? names[0] || 'a partner approver' : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

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
// Staff v6: the reading level is said only when it is over the target, in plain words (Nate's walk: "grade 11, above 8"
// and "grade 6" read like codes beside every line; D15). The arithmetic is unchanged (C-10 asks grade 8).
const gradeTag = t => { const g = fkGrade(t); return g != null && g > 8 ? `<span class="pq-grade hi">${icon('info')}<span>Harder to read than we aim for</span></span>` : ''; };
const pointsSum = pts => { const n = pts.length; if (!n) return 'none';
  const hi = pts.filter(p => (fkGrade(p) ?? 0) > 8).length;
  return `${n}${hi ? ` · ${hi === n ? (n === 1 ? 'harder' : 'all harder') : `${hi} harder`} to read than we aim for` : ''}`; };

// ---- the queue ----
// partner_queue() (184): { bills, issues, groups, requests }. Asked once a visit (and again after Refresh: loadAll clears
// it); the page draws without it and redraws when it comes. A read that fails says so on the line, with Try again (B-8).
const keyOf = it => `pq:${it.kind}:${it.id}`;
const HOLD = new Map();   // approvals waiting out their 10 seconds, by key
export function wantQueue({ force = false } = {}) {
  if (!admitsPartners() || S.pqLoading || (!force && S.pq !== undefined)) return;
  S.pqLoading = true; S.pqErr = false;
  DB.partnerQueue().then(q => { S.pq = q; }).catch(e => { console.warn('partner_queue:', e?.message || e); S.pq = null; S.pqErr = true; })
    // Today, Team's bars and Partners draw them; every other page redraws only Today's count (sidebar, phone bar), in place.
    .finally(() => { S.pqLoading = false; if (['today', 'team', 'pgroups'].includes(S.route?.name)) hooks.render(); else hooks.counts?.(); });
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

// ---- the asks (R-328 G, backend 185) ----
// partner_asks_list(): every current partner ask, for the Partners screen's "Going out at 4:30 PM" and for a card whose
// words keep an ask already approved. Asked once a visit, like the queue; any staff member may read it.
export function wantAsks({ force = false } = {}) {
  if (S.pAsksLoading) { if (force) S.pAsksAgain = true; return; }   // a change while a read is on its way reads once more after it
  if (!force && S.pAsks !== undefined) return;
  S.pAsksLoading = true; S.pAsksErr = false; S.pAsksAgain = false;
  DB.partnerAsks().then(a => { S.pAsks = a || []; }).catch(e => { console.warn('partner_asks_list:', e?.message || e); S.pAsks = null; S.pAsksErr = true; })
    .finally(() => { S.pAsksLoading = false; if (S.pAsksAgain) return wantAsks({ force: true }); if (['today', 'team', 'pgroups'].includes(S.route?.name)) hooks.render(); });
}
export const asksChanged = () => { S.pAsks = undefined; };
export const TEXT_MAX = 110, TEXT_MIN = 10;   // a text's room for the line (185: 10 to 110 characters, as HIPHI's big push)
const hstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
// Which email an ask joins, in words: "today’s 4:30 PM email" or "tomorrow’s…" (t: its scheduled_for; none: the next one).
// While email is paused it is held, as HIPHI's own approved emails are (composer.js HELD).
export const emailWord = (t = null) => paused() ? 'the first 4:30 PM email after email is turned on' : `${dailyWord(t)}’s 4:30 PM email`;   // HELD_NEXT's words
const curAsk = it => (S.pAsks || []).find(a => a.partner_slug === it.partner_slug && a.bill_id === it.bill_id && a.state !== 'replaced');
// What approving does to the ask (partner_ask_on_approve): 'new' (it goes out at the next 4:30 PM), 'same' (the live
// words' ask, approved before: it keeps its place and nobody gets it twice; cur when the list has it), 'over' (its end date
// has passed: it goes nowhere), 'ends' (these words drop an ask still going out), or null (no ask either way).
function askFate(it) {
  if (it.kind !== 'bill') return null;
  const w = it.words || {}, cur = curAsk(it), listed = Array.isArray(S.pAsks);
  if (!w.ask) return (cur ? ['going_out', 'sending'].includes(cur.state) : !listed && !!it.live?.ask) ? { kind: 'ends', cur } : null;
  if (!w.ask_until || String(w.ask_until) < hstToday()) return { kind: 'over', cur };
  if (cur ? cur.ask === w.ask : !listed && it.live?.ask === w.ask) return { kind: 'same', cur };
  return { kind: 'new', cur: null };
}
// Also by text, per card, kept across redraws until the words are decided: { on, line, err }. Words that keep an ask
// already approved start from that ask's own setting.
const TXT = new Map();
const txtOf = it => { if (TXT.has(keyOf(it))) return TXT.get(keyOf(it)); const f = askFate(it), c = f?.kind === 'same' ? f.cur : null; return { on: !!c?.also_text, line: c?.text_line || '', err: '' }; };
const setTxt = (it, patch) => TXT.set(keyOf(it), { ...txtOf(it), ...patch });
const needsLine = it => String(it.words?.ask || '').trim().length > TEXT_MAX;
const countWords = n => n > TEXT_MAX ? `${n} of ${TEXT_MAX}: ${n - TEXT_MAX} too many` : n && n < TEXT_MIN ? `${n} of ${TEXT_MAX}: at least ${TEXT_MIN}` : `${n} of ${TEXT_MAX}`;
const countOver = n => n > TEXT_MAX || (n > 0 && n < TEXT_MIN);
// What Approve sends with the words: Also by text and its line, checked here first in the database's own words (a refusal
// after the 10 seconds would leave the words waiting). Nothing for words without an ask, or for words that keep an ask
// whose setting is not known here (the list did not load): the database then keeps the setting it has.
function askOpts(it) {
  const f = askFate(it); if (!f || f.kind === 'over' || f.kind === 'ends') return {};
  if (f.kind === 'same' && !f.cur && !TXT.has(keyOf(it))) return {};
  const t = txtOf(it), line = t.on && needsLine(it) ? String(t.line || '').trim() : '';
  if (t.on && needsLine(it)) {
    if (!line) return { err: 'A text has room for 110 characters: write a shorter line for the text.' };
    if (line.length < TEXT_MIN || line.length > TEXT_MAX) return { err: 'The line for the text is 10 to 110 characters.' };
  }
  return { also_text: !!t.on, text_line: line || null };
}
// Under the ask on the card: what approving does with it.
function askNow(it) {
  const f = askFate(it), c = f?.cur;
  if (!f || f.kind === 'ends') return '';
  if (f.kind === 'over') return 'Its end date has passed, so it does not go out.';
  if (f.kind === 'same') return !c ? 'The same ask as their live words: it keeps its place, and nobody gets it twice.'
    : c.state === 'going_out' ? `The same ask as their live words: it still goes out in ${emailWord(c.scheduled_for)}.`
    : c.state === 'sending' ? 'The same ask as their live words: it is already going out, and nobody gets it twice.'
    : c.state === 'taken_back' ? 'The same ask as their live words, which was taken back: it stays taken back.' : 'The same ask as their live words.';
  return paused() ? `Email is paused. Once you approve, it is held while email is paused: ${HELD_NEXT}. You can take it back on Partners.`
    : `Once you approve, it goes out in ${emailWord()}. You can take it back on Partners until then.`;
}
// The Approve toast's second sentence, and the database's answer in the same words (only a new ask's email can differ: an
// Approve at 4:29 pm joins tomorrow's).
function askSaid(it) {
  const f = askFate(it), c = f?.cur;
  if (!f || f.kind === 'over') return '';
  if (f.kind === 'ends') return 'Their earlier ask stops going out.';
  if (f.kind === 'same') return c?.state === 'taken_back' ? 'The ask stays taken back.' : c?.state === 'going_out' ? `The ask still goes out in ${emailWord(c.scheduled_for)}.` : 'The ask goes on as before.';
  return `The ask goes out in ${emailWord()}.`;
}
const askDone = pa => pa?.state === 'going_out' ? `The ask goes out in ${emailWord(pa.scheduled_for)}.` : '';

// ---- drawing ----
const billOf = it => billById(it.bill_id) || { bill_number: it.bill_number, title: it.title };
const billLink = it => billRoute(billOf(it));
const groupHref = slug => `#/partners/${encodeURIComponent(slug)}`;
const nameOf = it => it.kind === 'issue' ? (it.words?.name || 'An issue of its own') : (it.words?.nickname || billOf(it).nickname || clip(billOf(it).title, 70));
const sentLine = it => [`Sent ${whenAt(it.words?.sent_at || it.words?.written_at)}${it.by ? ` by ${it.by}` : ''}`.replace(/\.?$/, '.'), it.live ? 'They changed their words: what is live now stays up until you approve.' : ''].filter(Boolean).join(' ');
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
  // Words that carry an ask show it on its own below (askHTML), with what it was: here only an ask taken out (A-14).
  const askOf = x => x.ask ? `${String(x.ask).replace(/[.\s]+$/, '')} · until ${dayWord(x.ask_until)}` : '';
  if (!w.ask) f('The ask', askOf(l), askOf(w));
  f('Draft notes', l.draft_note ? `${l.draft_version ? l.draft_version + ': ' : ''}${l.draft_note}` : '', w.draft_note ? `${w.draft_version ? w.draft_version + ': ' : ''}${w.draft_note}` : '');
  const iss = x => (x.issue_ids || []).map(id => issueName(id) || 'one of the group’s own issues').join(', ');
  f('Under these issues', iss(l), iss(w));
  return `<div class="pq-sec"><h4 class="pq-h4">What changed</h4>${rows.length ? `<ul class="pq-diff">${rows.join('')}</ul>` : '<p class="pq-p">Nothing in the words: they sent the same version again.</p>'}</div>`;
}
// Every word they sent, in the order the public sees them on a bill. ask: false when the ask shows on its own (askHTML),
// so it is said once (A-14).
function wordsHTML(it, { ask = true } = {}) {
  const w = it.words || {};
  if (it.kind === 'issue') return `<dl class="pq-dl"><dt>Name</dt><dd>${esc(w.name || '')}</dd>${w.description ? `<dt>Description</dt><dd>${esc(w.description)} ${gradeTag(w.description)}</dd>` : ''}</dl>`;
  const pts = (w.points || []).filter(Boolean), iss = (w.issue_ids || []).map(id => issueName(id) || 'One of the group’s own issues');
  return `<dl class="pq-dl">
    ${w.nickname ? `<dt>Nickname</dt><dd>${esc(w.nickname)}</dd>` : ''}
    <dt>In plain words</dt><dd>${esc(w.summary || '')} ${gradeTag(w.summary)}</dd>
    <dt>Talking points <span class="pq-n">${pts.length} of 5</span></dt><dd>${pts.length ? `<ol class="pq-pts">${pts.map(p => `<li>${esc(p)} ${gradeTag(p)}</li>`).join('')}</ol>` : 'None'}</dd>
    ${w.ask && ask ? `<dt>The ask</dt><dd>${esc(w.ask)} <span class="pq-until">until ${esc(dayWord(w.ask_until))}</span></dd>` : ''}
    ${w.draft_note ? `<dt>Draft notes${w.draft_version ? ` (${esc(w.draft_version)})` : ''}</dt><dd>${esc(w.draft_note)}</dd>` : ''}
    ${iss.length ? `<dt>Under these issues</dt><dd>${iss.map(esc).join(', ')}</dd>` : ''}</dl>`;
}
const head = (it, h = 'h3', id = '') => {
  const b = it.kind === 'bill' ? billOf(it) : null;
  return `<${h} class="pq-name"${id ? ` id="${id}"` : ''}><a class="pq-grp" href="${groupHref(it.partner_slug)}">${esc(it.partner_name)}</a>${b ? ` <span class="pq-on">on</span> <a class="pq-bill" href="${esc(billLink(it))}">${esc(billNum(b))}</a>` : ` <span class="pq-on">· its own issue</span>`}</${h}>`;
};
// The side they take, in plain words: a status, never shaped like a button (spec 4; the bordered "Support" pill with its
// thumbs-up read as one). sideChip and stanceChip stay for the Partners screen's own look.
const sideOf = it => { const w = it.kind === 'issue' ? STANCE[it.words?.stance]?.[0] : sideWord(it.words?.side); return w ? `<span class="pq-side">${esc(it.kind === 'issue' ? w : `Side: ${w}`)}</span>` : ''; };
const acts = (it, primary) => `${btn('Approve', { kind: primary ? 'primary' : 'secondary', icon: 'check', attrs: { 'data-pqok': keyOf(it) } })}${btn('Ask for a change', { kind: 'text', icon: 'message-square', attrs: { 'data-pqask': keyOf(it), 'aria-haspopup': 'dialog' } })}`;
const errLine = m => `<p class="inlinemsg">${icon('circle-alert')}<span>${esc(m)}</span></p>`;
// The ask on its own, just above Approve (R-328 G): what it says and until when, what approving does with it, and Also by
// text (off unless switched on for this one ask), with a line of its own when the ask is longer than a text. where: 'c'
// (a phone's card) or 'p' (the laptop's open item), so the two never share an id.
// `fold` (Today's next-step card): what approving does, the text switch and its line wait under "How it goes out", so the
// ask's words and Approve stay close (the critic's 12: four lines on email and texts above Approve). Open when the text is
// switched on or its line has an error.
function askHTML(it, where, { fold = false } = {}) {
  const w = it.words || {}; if (it.kind !== 'bill' || !w.ask) return '';
  const f = askFate(it), k = keyOf(it), ek = esc(k), id = `pq${where}-${esc(it.id)}`, t = txtOf(it), n = String(t.line || '').trim().length, now = askNow(it);
  const sw = f && (f.kind === 'new' || f.kind === 'same'), l = it.live;
  // An edit says what the ask was, here rather than in "What changed", so the ask is said once (A-14).
  const was = !l ? '' : !l.ask ? 'New in this edit: their live words have no ask.' : l.ask.trim() !== w.ask.trim() ? `Was: ${l.ask}`
    : l.ask_until !== w.ask_until ? `Was until ${dayWord(l.ask_until)}.` : '';
  const how = `${now ? `<p class="pq-askwhen">${icon(f.kind === 'over' ? 'circle-minus' : 'clock')}<span>${esc(now)}</span></p>` : ''}
    ${sw ? `${switchRow(id, 'Also by text', t.on, 'Texted only to people who chose “As they come”, on a day HIPHI isn’t texting them. Texts are off until they’re set up.', { 'data-pqtext': k })}
    ${needsLine(it) ? `<div class="field pq-tline"${t.on ? '' : ' hidden'}><label for="${id}-l">Line for the text</label>
      <input id="${id}-l" type="text" autocomplete="off" data-pqline="${ek}" value="${esc(t.line || '')}" aria-describedby="${id}-lh ${id}-lc"${t.err ? ' aria-invalid="true"' : ''}>
      <span class="help pq-thelp"><span id="${id}-lh">The ask is longer than a text. Write the line that comes after “From ${esc(it.partner_name)}, a HIPHI partner:”.</span><span class="pq-count${countOver(n) ? ' over' : ''}" id="${id}-lc">${esc(countWords(n))}</span></span></div>` : ''}
    <div class="pq-terr" data-pqterr="${ek}" role="alert">${t.err ? errLine(t.err) : ''}</div>` : ''}`;
  return `<div class="pq-ask" data-pqaskbox="${ek}"><h4 class="pq-h4">The ask <span class="pq-until">until ${esc(dayWord(w.ask_until))}</span></h4>
    <p class="pq-asktext">${esc(w.ask)}</p>${was ? `<p class="pq-askwas">${esc(was)}</p>` : ''}
    ${fold && how.trim() ? `<details class="pq-more pq-how"${t.on || t.err ? ' open' : ''}><summary>${icon('chevron-down', { cls: 'chev' })}<span>How it goes out</span></summary>${how}</details>` : how}</div>`;
}

// A phone's card: enough to judge most items without opening the fold.
function card(it) {
  const w = it.words || {}, k = keyOf(it);
  const brief = it.kind === 'issue' ? (w.description ? `<p class="pq-line">${esc(clip(w.description, 140))}</p>` : '')
    : `<p class="pq-line"><b>In plain words:</b> ${esc(clip(w.summary, 140))}</p><p class="pq-line"><b>Points:</b> ${esc(pointsSum((w.points || []).filter(Boolean)))}</p>`;
  return `<article class="card pq-card" data-pqcard="${esc(k)}" aria-labelledby="${esc(k)}-h">
    <div class="pq-top">${head(it, 'h3', esc(k) + '-h')}${sideOf(it)}</div>
    <p class="pq-t">${esc(nameOf(it))}</p>
    <p class="pq-meta">${esc(sentLine(it))}</p>
    ${it.kind === 'bill' ? flagLine(it.flag) : ''}
    ${brief}
    <details class="pq-more"><summary>${icon('chevron-down', { cls: 'chev' })}<span>Read all the words${it.live ? ' and what changed' : ''}</span></summary>${changes(w, it.live)}<div class="pq-sec">${wordsHTML(it, { ask: false })}</div></details>
    ${askHTML(it, 'c')}
    <div class="pq-acts">${acts(it, false)}</div></article>`;
}
// A laptop's row: the step's name first, as every row on Today (R-279), and what tells one from the next.
function row(it, reg) {
  const k = keyOf(it), ek = esc(k), b = it.kind === 'bill' ? billOf(it) : null;
  reg(k, { partner: it, key: k });
  const what = [it.live ? 'An edit' : 'New', it.kind === 'issue' ? STANCE[it.words?.stance]?.[0] : sideWord(it.words?.side), it.kind === 'bill' && it.flag && it.flag !== 'none' ? 'worth a closer look' : '',
    it.kind === 'bill' && it.words?.ask ? 'with an ask' : ''].filter(Boolean).join(' · ');
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
    ${it.live ? `${changes(w, it.live)}<details class="pq-more"><summary>${icon('chevron-down', { cls: 'chev' })}<span>All the words, as they would go live</span></summary><div class="pq-sec">${wordsHTML(it, { ask: false })}</div></details>`
      : `<div class="pq-sec">${wordsHTML(it, { ask: false })}</div>`}
    ${askHTML(it, 'p')}
    <div class="pq-acts bp-acts">${acts(it, true)}</div></div>`;
}

// Today's section (Mine only). rows: the laptop's rows; reg(k, card): Today keeps the row for its open item and j/k.
export function partnerToday({ rows = false, reg = () => {} } = {}) {
  wantQueue();
  const items = pqItems(), o = pqOthers(), n = o.groups.length + o.requests.length;
  if (items.some(it => it.kind === 'bill' && it.live?.ask)) wantAsks();   // an edit may keep an ask already approved: say where it stands
  const parts = [o.groups.length ? plural(o.groups.length, 'group') + ' to approve' : '', o.requests.length ? `${plural(o.requests.length, 'group')} ${o.requests.length === 1 ? 'asks' : 'ask'} to join` : ''].filter(Boolean);
  const line = S.pqErr && admitsPartners() ? `<p class="pq-gline">${icon('circle-alert')}<span>The partners’ words did not load.</span>${btn('Try again', { kind: 'text', sm: true, attrs: { 'data-pqretry': '1' } })}</p>`
    : n ? `<p class="pq-gline">${icon('handshake')}<span><b>Partners:</b> ${esc(parts.join(' · '))}</span><a class="pq-golink" href="#/partners">Open Partners${icon('chevron-right')}</a></p>` : '';
  if (!items.length) return { n: 0, html: line };
  const list = rows ? `<div class="td-rows">${items.map(it => row(it, reg)).join('')}</div>` : `<div class="pq-list">${items.map(card).join('')}</div>`;
  return { n: items.length, html: `<section class="td-group pq-group" aria-labelledby="td-g-pq"><h2 class="td-h">${groupHead('Partner words to approve', items.length, { id: 'td-g-pq' })}</h2>${list}${line}</section>` };
}

// ---- Staff v6 (R-336, spec 6 and F55): partner words as Today's rows, its next-step card and its open item ----
// A row is the group's name, the bill number small and one line (D15); every word they sent waits in the open item (V01:
// the full text never sits in the list). Approve is tonal in the open item and filled only on the "Your next step" card,
// the screen's one filled button (spec 4). Open Partners is always beside them.
const pqLine = it => {
  const b = it.kind === 'bill' ? billOf(it) : null;
  const what = it.kind === 'issue' ? `Approve their issue “${clip(it.words?.name || '', 40)}”` : `Approve their words on ${clip(nameOf(it), 44)}`;
  // Plain words for what is new (the critic's 12: "an edit" and "with an ask" needed explaining).
  return [what, it.live ? 'changed their words' : '', it.kind === 'bill' && it.words?.ask ? 'adds an ask' : it.kind === 'bill' && it.flag && it.flag !== 'none' ? 'worth a closer look' : ''].filter(Boolean).slice(0, 2).join(' · ');
};
const pqOpen = (k = 'text') => btn('Open Partners', { kind: k, icon: 'handshake', href: '#/partners' });
// A row under Today's "Partner words to approve": what and what is new, without the verb its heading already says
// ("Warning labels on sugary drinks · changed their words"; fewer words per row, integrator 23 Oct).
// A row under "Partner words to approve" is named by what it is about, the bill (nickname and number) or the new issue, and
// its line says who and what changed: "Warning labels on sugary drinks SB 2345 / Keiki Smiles Alliance · changed their
// words" (the critic: three rows all titled "Keiki Smiles Alliance", the issue's row with no verb; D15, P-4).
const pqShort = it => [it.kind === 'issue' ? 'New issue' : '', it.partner_name,
  it.kind === 'issue' ? '' : it.live ? 'changed their words' : it.words?.ask ? 'adds an ask' : it.flag && it.flag !== 'none' ? 'worth a closer look' : 'new words'].filter(Boolean).join(' · ');
// The words today.js needs for a row: { name, num, line, href, what, sub, buttons(kind) }. `short`: the row under the
// group's heading, named by its bill or issue.
export function pqRow(it, { short = false } = {}) {
  const b = it.kind === 'bill' ? billOf(it) : null;
  const name = short ? (it.kind === 'issue' ? it.words?.name || 'A new issue' : nameOf(it)) : it.partner_name;
  return { name, num: b ? numWords(b) : '', line: short ? pqShort(it) : pqLine(it), href: groupHref(it.partner_slug), what: pqLine(it).split(' · ')[0],
    sub: sentLine(it), buttons: k => [btn('Approve', { kind: k, icon: 'check', attrs: { 'data-pqok': keyOf(it) } }), btn('Ask for a change', { kind: 'text', icon: 'message-square', attrs: { 'data-pqask': keyOf(it), 'aria-haspopup': 'dialog' } }), pqOpen()] };
}
// The next-step card: the group, what to approve, the closer-look flag, the ask, then Approve; every word, and how the ask
// goes out, one fold away under the buttons (Nate's November card put Approve below a 320 phone's first screen; the doors'
// Partners line is the way to the Partners screen, so the card leaves out Open Partners).
// It leads with what the words are about, the bill's name and its number ("Sugary drink fee SB 2345"), and the partner is
// in the line, "Keiki Smiles Alliance’s words to approve" (Nate's walk: "Keiki Smiles Alliance SB 2345" read the number
// as the partner's; D15).
export function pqCard(it, { id = 't6-next-h' } = {}) {
  const r = pqRow(it, { short: true }), w = it.words || {};
  const ask = askHTML(it, 'c', { fold: true }), how = ask.match(/<details class="pq-more pq-how"[\s\S]*?<\/details>/)?.[0] || '';
  return `<section class="v6-step own named w-today t6-mini pq6" aria-labelledby="${id}" data-pqcard="${esc(keyOf(it))}">
    ${it.kind === 'bill' && billOf(it) ? stepHeadHTML(billOf(it), { kind: 'Partner words', sentence: `Approve ${it.partner_name}’s words on {bill}`, id })
      : stepHeadHTML(null, { kind: it.kind === 'issue' ? 'Partner issue' : 'Partner words', sentence: it.kind === 'issue' ? `Approve ${it.partner_name}’s new issue: ${r.name}` : `Approve ${it.partner_name}’s words on ${r.name}`, id })}
    <p class="v6-step-when">${esc(sentLine(it))}</p>
    ${it.kind === 'bill' ? flagLine(it.flag) : ''}
    ${how ? ask.replace(how, '') : ask}
    <div class="v6-step-acts">${acts(it, true)}</div>
    <details class="pq-more"><summary>${icon('chevron-down', { cls: 'chev' })}<span>Read all the words${it.live ? ' and what changed' : ''}</span></summary>${changes(w, it.live)}<div class="pq-sec">${wordsHTML(it, { ask: false })}</div></details>
    ${how ? `<div class="pq-ask pq-askhow" data-pqaskbox="${esc(keyOf(it))}">${how}</div>` : ''}</section>`;
}
// The open item beside the list (or its own page below 1100px), with Approve tonal.
export function pqItem(it, { close = '' } = {}) {
  const w = it.words || {}, b = it.kind === 'bill' ? billOf(it) : null;
  return `<div class="v6-item t6-item pq6" data-v6item="${esc(keyOf(it))}">
    <div class="v6-item-top"><p class="v6-item-num">${esc(it.kind === 'issue' ? 'Partner issue' : 'Partner words')}</p><a class="v6-item-open" href="${esc(groupHref(it.partner_slug))}"><span>Open their group</span>${icon('arrow-right')}</a>${close}</div>
    <h2 class="v6-item-name" id="v6-item-h" tabindex="-1">${esc(it.partner_name)}${b ? ` <span class="pq-on">on</span> ${esc(numWords(b))}` : ''}</h2>
    <p class="pq-t">${esc(nameOf(it))} ${sideOf(it)}</p>
    <p class="pq-meta">${esc(sentLine(it))}</p>
    ${it.kind === 'bill' ? flagLine(it.flag) : ''}
    ${it.live ? `${changes(w, it.live)}<details class="pq-more"><summary>${icon('chevron-down', { cls: 'chev' })}<span>All the words, as they would go live</span></summary><div class="pq-sec">${wordsHTML(it, { ask: false })}</div></details>`
      : `<div class="pq-sec">${wordsHTML(it, { ask: false })}</div>`}
    ${askHTML(it, 'p')}
    <div class="pq-acts v6-step-acts">${acts(it, false)}</div>
    <p class="pq-openp">${pqOpen()}</p></div>`;
}

// ---- doing ----
const itemBy = k => [...(S.pq?.bills || []), ...(S.pq?.issues || [])].find(it => keyOf(it) === k);
const what = it => it.kind === 'issue' ? `${it.partner_name}’s issue “${it.words?.name || ''}”` : `${it.partner_name}’s words on ${numWords(billOf(it))}`;
const drop = it => { if (!S.pq) return; S.pq.bills = (S.pq.bills || []).filter(x => x !== it); S.pq.issues = (S.pq.issues || []).filter(x => x !== it); };
async function commit(k) {
  const h = HOLD.get(k); if (!h) return; HOLD.delete(k); clearTimeout(h.t);
  let r;
  try { r = await DB.partnerReview(h.it, true, null, h.opt); drop(h.it); TXT.delete(k); if (h.it.kind === 'bill') { if (S.route?.name === 'pgroups') wantAsks({ force: true }); else asksChanged(); } }
  catch (e) {
    // A refusal about the text's line is shown under the line as well, where it can be fixed (B-8).
    if (e?.hint === 'text_line' || /line for the text|room for 110/i.test(e?.message || '')) setTxt(h.it, { on: true, err: friendly(e) });
    toast(`${what(h.it)} did not go live. ${friendly(e)}`, { err: true });
  }
  if (S.route?.name === 'today') hooks.render();
  // The toast said which email a new ask joins; the database's answer decides.
  const now = askDone(r?.partner_ask);
  if (h.fate === 'new' && now && now !== h.said) toast(now, { ok: true });
}
// The 10 seconds run on whatever page is open; leaving the app sends what is held (best effort: if it never arrives, the
// words simply wait for approval again, which is the safe way to fail).
addEventListener('pagehide', () => { for (const k of [...HOLD.keys()]) commit(k); });
// A text line that will not do: said under the line, and the focus goes there (nothing is approved).
function lineErr(k, m) {
  for (const b of document.querySelectorAll('[data-pqaskbox]')) {
    if (b.dataset.pqaskbox !== k) continue;
    const e = b.querySelector('[data-pqterr]'), inp = b.querySelector('[data-pqline]');
    if (e) e.innerHTML = errLine(m);
    e?.closest('details')?.setAttribute('open', '');   // a folded "How it goes out" opens to show it
    if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
  }
}
function approve(k) {
  const it = itemBy(k); if (!it || HOLD.has(k)) return;
  const opt = askOpts(it);
  if (opt.err) { setTxt(it, { err: opt.err }); lineErr(k, opt.err); return; }
  const said = askSaid(it), fate = askFate(it)?.kind, asks = fate === 'new' || fate === 'same';
  const t = setTimeout(() => commit(k), 10000);
  HOLD.set(k, { it, t, opt, said, fate });
  // The open item moves on to the next words still waiting, as Review does after Approve (spec 2: auto-advance); with none
  // left it closes.
  const ld = S.v6ld?.today; if (ld && ld.key === k) ld.key = pqItems()[0] ? keyOf(pqItems()[0]) : null;
  const undo = () => {
    const h = HOLD.get(k);
    // Past the 10 seconds the words are live and cannot wait again; an ask can still be taken back (B-5).
    if (!h) { toast(`Too late to undo: ${it.kind === 'issue' ? 'it is' : 'they are'} already live.${asks ? ' To stop the ask, Take it back on Partners.' : ''}`, asks ? { action: { label: 'Open Partners', run: () => S.go('#/partners') } } : {}); return; }
    clearTimeout(h.t); HOLD.delete(k); dropDone(k); hooks.render(); toast('Undone. It waits for approval again.'); };
  // Today's Done today band lists it with its Undo, so the Undo outlives the toast (spec 6, B-5).
  (S.v6Done ??= []).push({ key: k, by: S.me?.id, at: Date.now(), words: `Approved: ${what(it)}`, undo });
  S.tdRefocus = null; hooks.render();
  toast(`${it.kind === 'issue' ? `Approved: ${what(it)} goes live.` : `Approved: ${what(it)} go live.`}${said ? ' ' + said : ''}`, { ok: true, undo });
}
const dropDone = k => { if (S.v6Done) S.v6Done = S.v6Done.filter(x => x.key !== k); };
function askChange(k) {
  const it = itemBy(k); if (!it) return;
  openSheet({ title: `Ask ${esc(it.partner_name)} for a change`, size: 'auto',
    body: `<p class="pq-shp">${esc(it.kind === 'issue' ? `On its issue “${it.words?.name || ''}”.` : `On ${numWords(billOf(it))}, ${nameOf(it)}.`)} ${it.live ? 'Their live words stay up meanwhile.' : 'Nothing of theirs shows on it meanwhile.'}</p>
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
        drop(it); TXT.delete(keyOf(it)); await closeSheet({ silent: true }); hooks.render();
        toast(`Sent to ${it.partner_name}. They see your note and can send the words again.`, { ok: true });
      };
    } });
}
export function wirePartner(el) {
  el.querySelectorAll('[data-pqok]').forEach(b => b.onclick = e => { e.stopPropagation(); approve(b.dataset.pqok); });
  el.querySelectorAll('[data-pqask]').forEach(b => b.onclick = e => { e.stopPropagation(); askChange(b.dataset.pqask); });
  el.querySelectorAll('[data-pqretry]').forEach(b => b.onclick = () => wantQueue({ force: true }));
  // Also by text and its line (R-328 G): kept per card without a redraw, so typing is never interrupted.
  el.querySelectorAll('[data-pqtext]').forEach(x => x.addEventListener('change', () => {
    const it = itemBy(x.dataset.pqtext); if (!it) return; setTxt(it, { on: x.checked, err: '' });
    const box = x.closest('.pq-ask'), tl = box?.querySelector('.pq-tline'); tl?.toggleAttribute('hidden', !x.checked);
    const e = box?.querySelector('[data-pqterr]'); if (e) e.innerHTML = '';
    if (x.checked && tl && !tl.querySelector('input').value) tl.querySelector('input').focus();   // the line is what is needed next
  }));
  el.querySelectorAll('[data-pqline]').forEach(x => x.addEventListener('input', () => {
    const it = itemBy(x.dataset.pqline); if (!it) return; const n = x.value.trim().length; setTxt(it, { line: x.value, err: '' });
    const c = document.getElementById(x.id + 'c'); if (c) { c.textContent = countWords(n); c.classList.toggle('over', countOver(n)); }
    x.removeAttribute('aria-invalid'); const e = x.closest('.pq-ask')?.querySelector('[data-pqterr]'); if (e) e.innerHTML = '';
  }));
  // A card's fold stays as it was left when Today redraws (B-6).
  el.querySelectorAll('[data-pqcard] .pq-more').forEach(d => d.addEventListener('toggle', () => { (S.pqOpen ??= new Set())[d.open ? 'add' : 'delete'](d.closest('[data-pqcard]').dataset.pqcard); }));
  el.querySelectorAll('[data-pqcard]').forEach(c => { if (S.pqOpen?.has(c.dataset.pqcard)) c.querySelector('.pq-more')?.setAttribute('open', ''); });
}
// For the sandbox's practice data and the Partners screen: a fresh read after a change there.
export const queueChanged = () => { S.pq = undefined; };
