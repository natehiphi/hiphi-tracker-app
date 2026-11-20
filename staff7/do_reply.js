// The chair's reply to an ask (R-398 piece 5): the sheet "Did the chair reply?", the three answers, and "Give this ask to…". Anyone on staff can record a reply; the newest word of each chair wins and the
// page says who recorded it. Live these are legislator_notes rows (the same rows staff6 writes: chairask.js recordAsk's words) and nothing else; on the practice copy nothing is sent to anyone.
import { S, DB } from '../staff6/data.js';
import { chairMail } from '../staff6/model.js';
import { band, btn, esc, personMark, toast } from './parts.js';
import { ic } from './icons7.js';
import { billName, billNo, first, issueOf, cmteWords } from './steps.js';
import { askById, askedSentence, dayWords, ymd, holdOf, setHold, whoWords, WAIT_DAYS } from './ask_data.js';
import { mailFor } from './do_ask.js';

const enc = encodeURIComponent;
const person = id => (S.advocates || []).find(a => a.id === id);
const you = id => id === S.me?.id ? 'you' : first(person(id));
const OPTS = [['will_schedule', 'Will schedule', 'Nothing more needs you until the hearing is set'], ['said_no', 'Said no', 'See what you can still do'],
  ['left_message', 'No answer yet', `We remind you again in ${WAIT_DAYS} working days`]];
const pick = { key: '', id: '' };   // which chair the radio choice is on, kept in this visit

// the same words staff6/chairask.js writes into the note, so the old app reads a reply recorded here
const sentence = (answer, who, b, code) => answer === 'will_schedule' ? `${who} will schedule a hearing on ${b.bill_number} (${code}).`
  : answer === 'said_no' ? `${who} said no to a hearing on ${b.bill_number} (${code}).` : `No reply yet from ${who} about a hearing on ${b.bill_number} (${code}); reminder restarted.`;
const when = t => ymd(t) === ymd(Date.now()) ? 'today' : dayWords(t);
export const stepOf = a => ({ id: 'ask:' + a.key, kind: 'reply', bill: a.b, name: billName(a.b), no: billNo(a.b), at: null });   // the done page's stand-in for a step

// ---------------------------------------------------------------------------------- the data change, and taking it back
export async function recordStep(a, chair, answer) {
  const row = await DB.addLegNote(chair.lid, a.b.id, sentence(answer, chair.who, a.b, a.code), { answer, committee: a.code });
  return { kind: 'reply', rows: [[row, chair.lid]], key: a.key };
}
export async function undoRecord(u) {
  if (u.kind === 'give') { setHold(u.key, u.prev); return; }
  for (const [n, lid] of u.rows) await DB.delLegNote(n.id, lid);
}
export function giveStep(a, toId) {
  const prev = holdOf(a.key), asker = toId === a.asker;
  setHold(a.key, asker ? null : { to: toId, by: S.me?.id, at: Date.now() });   // giving it back to the one who asked is no hold at all
  return { kind: 'give', key: a.key, prev };
}

// ---------------------------------------------------------------------------------- the sheet
const strip = a => { const d = a.deadline && !a.deadline.missed ? a.deadline : null;
  return d ? `<div class="strip calm">${ic('clock')}<strong>Needs a hearing by ${esc(dayWords(String(d.date).slice(0, 10)))}</strong><span>in ${d.days} ${d.days === 1 ? 'day' : 'days'}</span></div>` : ''; };
const chairLine = c => c.answer === 'will_schedule' ? `<p class="cans">${ic('check')}<span><b>${esc(c.who)} will schedule it</b> <span class="m">· recorded ${esc(when(c.at))} by ${esc(you(c.by))}</span></span></p>`
  : c.answer === 'said_no' ? `<p class="cans no">${ic('circle-x')}<span><b>${esc(c.who)} said no</b> <span class="m">· recorded ${esc(when(c.at))} by ${esc(you(c.by))}</span></span></p>`
  : c.answer === 'left_message' ? `<p class="cans no">${ic('phone')}<span><b>No reply yet from ${esc(c.who)}</b> <span class="m">· reminder restarted ${esc(when(c.at))} by ${esc(you(c.by))}</span></span></p>` : '';

export function replySheet(key) {
  const a = askById(key); if (!a || a.ended) return '';
  const b = a.b, held = a.holder !== a.asker ? ` ${a.holder === S.me?.id ? 'You have' : `${esc(first(person(a.holder)))} has`} this ask now.` : '';
  const cands = a.quiet.length ? a.quiet : a.chairs, answered = a.chairs.filter(c => !a.quiet.includes(c));
  if (pick.key !== key || !cands.some(c => c.id === pick.id)) { pick.key = key; pick.id = cands.length > 1 ? '' : cands[0].id; }   // two chairs: nobody is chosen until the person picks
  const cur = cands.find(c => c.id === pick.id), none = !cur, changing = !none && (!a.quiet.length || answered.includes(cur));
  let h = '<div class="pn">' + band(issueOf(b), 'Did the chair reply?', billName(b), billNo(b)) + '<div class="pbody">' + strip(a);
  h += '<div class="stgrid"><div class="stmain">';
  h += `<p class="lead tight">${esc(askedSentence(a))}${held}</p>`;
  h += answered.map(chairLine).join('') + (a.quiet.length ? a.quiet.filter(c => c.answer === 'left_message').map(chairLine).join('') : '');
  if (cands.length > 1) h += `<h2 class="sh" id="whoH">Who replied?</h2><div role="radiogroup" aria-labelledby="whoH">${cands.map(c => `<label class="cch cr"><input type="radio" name="chairpick" value="${esc(c.id)}"${c.id === pick.id ? ' checked' : ''}><span class="cct"><b>${esc(c.who)}</b><span>${esc(chairOf(c))}</span></span></label>`).join('')}</div>`;
  if (none) h += `<h2 class="sh" id="didH">What did they say?</h2><p class="hint" id="pickFirst">Pick who replied first</p>`;
  else if (!(a.chairs.length === 1 && a.quiet.length)) h += `<h2 class="sh" id="didH">${didWords(cur, changing)}</h2>`;   // a lone chair who has not answered needs no heading
  h += `<div id="opts" data-chair="${esc(cur?.id || '')}" data-seen="${cur?.at || 0}">${OPTS.map(([k, t, s]) => `<button class="cch${none ? ' off' : ''}" type="button" data-ans="${k}"${none ? ' aria-disabled="true" aria-describedby="pickFirst"' : ''}><span class="cct"><b>${esc(t)}</b><span>${esc(s)}</span></span>${ic('chevron-right')}</button>`).join('')}</div>`;
  h += '<p class="errt" id="rpErr" role="alert" hidden></p></div></div>';
  h += `<div class="cfoot">${btn('Give this ask to…', { kind: 'text', href: '#/give/' + enc(key), id: 'giveLink' })}${btn('See the email you sent', { kind: 'text', id: 'seeMail', attrs: 'aria-expanded="false" aria-controls="mailSee"' })}</div>`;
  return h + `<div class="cmail" id="mailSee" hidden>${emailHTML(a)}</div></div></div>`;
}
const chairOf = c => cmteWords((S.committeeMembers || []).find(m => String(m.legislator_id) === c.id && m.role === 'chair')?.committee);
const didWords = (c, changing) => changing ? `Change ${esc(c.who)}’s answer` : `Did ${esc(c.who)} reply?`;
// The email as the app writes it for this ask (what you changed before sending is not kept on the ask)
export function emailHTML(a) {
  const m = mailFor({ bill: a.b, ask: { code: a.code, m: chairMail(a.code), st: { deadline: a.deadline } } });
  if (!m) return '<p>No email is kept for this ask.</p>';
  return `<p><span class="ml">To</span> <b>${esc(m.to.split(',').join(', '))}</b></p><p><span class="ml">Subject</span> <b>${esc(m.subject)}</b></p><pre>${esc(m.body)}</pre><p class="hint">This is the app’s own wording. Changes you made before you sent it are not kept here.</p>`;
}

export function bindReply(key, ctx) {
  const opts = document.getElementById('opts'), err = document.getElementById('rpErr'); if (!opts) return;
  document.querySelectorAll('input[name=chairpick]').forEach(r => r.addEventListener('change', () => { pick.id = r.value; ctx.rerender(); document.querySelector(`input[name=chairpick][value="${CSS.escape(pick.id)}"]`)?.focus(); }));
  const sm = document.getElementById('seeMail'), box = document.getElementById('mailSee');
  sm.addEventListener('click', () => { const on = box.hidden; box.hidden = !on; sm.setAttribute('aria-expanded', String(on)); });
  opts.querySelectorAll('[data-ans]').forEach(bt => bt.addEventListener('click', async () => {
    if (bt.getAttribute('aria-disabled') === 'true' || !opts.dataset.chair) return;
    err.hidden = true; opts.querySelectorAll('button').forEach(x => x.disabled = true); bt.classList.add('is-loading');
    try { await doReply(ctx, key, opts.dataset.chair, bt.dataset.ans, +opts.dataset.seen); }
    catch (e) { opts.querySelectorAll('button').forEach(x => x.disabled = false); bt.classList.remove('is-loading'); err.textContent = (e && e.message) || 'It did not save. Try again.'; err.hidden = false; }
  }));
}

// A reply, recorded. Will schedule has its own done page with a 10-second Undo; Said no and No answer yet say so in a toast with Undo (said no becomes the step Decide what next in piece 6 part 2).
export async function doReply(ctx, key, chairId, answer, seen) {
  const id = 'ask:' + key; if (ctx.busy.has(id)) return; ctx.busy.add(id);
  try {
    const was = askById(key); if (!was || was.ended) throw new Error('This ask is no longer open, so nothing was saved. Go back to Home.');
    const c = was.chairs.find(x => x.id === chairId); if (!c) throw new Error('That chair is not on this ask.');
    // two people at once: the newest word wins, and the person who came second is told who was first
    const clash = c.at !== seen && c.by !== S.me?.id && c.answer !== 'asked' ? c : null;
    const u = await recordStep(was, c, answer), now = askById(key);
    const clashWords = clash ? ` ${first(person(clash.by))} had recorded “${OPTS.find(o => o[0] === clash.answer)?.[1].toLowerCase()}” a moment ago; yours replaces it.` : '';
    if (answer === 'will_schedule') {
      const other = now.quiet.length ? names(now.quiet.map(x => x.who)) : '';
      const title = now.answer === 'will_schedule' && now.chairs.length > 1 ? `${whoWords(now)} will schedule it.` : `${c.who} will schedule it.`;
      const sub = other ? `${other} ${now.quiet.length > 1 ? 'have' : 'has'} not answered yet. Nothing else needs you on ${billName(now.b)} until ${now.quiet.length > 1 ? 'they answer' : 'the chair answers'}.`
        : `Nothing needs you now. When the hearing is set you get the step Write testimony.${now.remindOn ? ` If none is set by ${dayWords(now.remindOn)}, we ask you to follow up.` : ''}`;
      ctx.finished[id] = { step: stepOf(was), at: Date.now(), kind: 'replied', billId: was.b.id, undo: u, back: '#/ask/' + enc(key), words: { title, sub: sub + clashWords } };
      location.hash = '#/done/' + enc(id);
      return;
    }
    const undo = async () => { try { await undoRecord(u);
      if (location.hash.startsWith('#/do/dc-')) { location.hash = '#/ask/' + enc(key); addEventListener('hashchange', () => toast('Put back.', { ms: 4000 }), { once: true }); return; }   // the step the no made is gone: back to the sheet
      ctx.rerender(); toast('Put back.', { ms: 4000 }); } catch (e) { toast((e && e.message) || 'It could not be undone.'); } };
    const said = answer === 'said_no' ? `Recorded: ${c.who} said no.${clashWords}` : `Saved. We remind you again on ${dayWords(now.clockOn)}.${clashWords}`;
    if (answer === 'said_no' && now.decide && now.holder === S.me?.id) {   // a no is the step Decide what next, for the one who holds the ask (do_followup.js); the toast keeps Undo
      location.hash = '#/do/dc-' + enc(key);
      addEventListener('hashchange', () => toast(said, { undo, ms: 10000 }), { once: true });   // said after the page is drawn, which clears an older toast
      return;
    }
    ctx.rerender();
    toast(said, { undo, ms: 10000 });
  } finally { ctx.busy.delete(id); }
}
const names = l => l.length < 3 ? l.join(' and ') : `${l.slice(0, -1).join(', ')} and ${l.at(-1)}`;

// ---------------------------------------------------------------------------------- Give this ask to…
export function giveSheet(key) {
  const a = askById(key); if (!a || a.ended) return '';
  const b = a.b, issue = issueOf(b), iss = (S.issues || []).find(i => i.id === issue.id);
  const bill = new Set((S.assignments?.[b.id] || [])), ownerId = iss?.owner_id;
  const on = x => x.is_active !== false && x.id !== a.holder;
  const people = (S.advocates || []).filter(on);
  const sub = id => bill.has(id) && id === ownerId ? 'Leads this bill and this issue' : bill.has(id) ? 'Leads this bill' : id === ownerId ? 'Leads this issue' : '';
  const leads = people.filter(x => sub(x.id)).sort((x, y) => (bill.has(y.id) ? 1 : 0) - (bill.has(x.id) ? 1 : 0)), rest = people.filter(x => !sub(x.id));
  const card = (x, lead) => `<button class="cch${lead ? ' lead' : ''}" type="button" data-to="${esc(x.id)}">${personMark(x.initials, { small: true })}<span class="cct"><b>${esc(first(x))}</b>${lead ? `<span>${esc(sub(x.id))}</span>` : ''}</span></button>`;
  return '<div class="pn">' + band(issue, 'Give this ask', billName(b), billNo(b)) + '<div class="pbody">' + strip(a)
    + `<div class="stgrid"><div class="stmain"><h2 class="sh">Who should take this ask over?</h2><p class="hint">Asked of ${esc(whoWords(a))}.</p><div class="cwho">${leads.map(x => card(x, true)).join('')}${rest.map(x => card(x, false)).join('')}</div>`
    + `<p class="errt" id="gvErr" role="alert" hidden></p></div></div><div class="cfoot">${btn('Back to the reply', { kind: 'text', href: '#/ask/' + enc(key) })}</div></div></div>`;
}
export function bindGive(key, ctx) {
  const err = document.getElementById('gvErr');
  document.querySelectorAll('[data-to]').forEach(bt => bt.addEventListener('click', () => {
    const a = askById(key), id = 'ask:' + key; if (!a || ctx.busy.has(id)) return;
    const to = bt.dataset.to, p = person(to); ctx.busy.add(id);
    try {
      const u = giveStep(a, to), who = to === S.me?.id ? 'You' : first(p), has = to === S.me?.id ? 'have' : 'has';
      const day = dayWords(a.askedAt), chair = whoWords(a);
      const sub = to === S.me?.id ? `You wait on ${chair}’s reply to the ${day} email. If there is no reply, you get the step Follow up with the chair.`
        : `${who} waits on ${chair}’s reply to the ${day} email. If there is no reply, ${who} gets the step Follow up with the chair. In the practice copy no message is sent.`;
      ctx.finished[id] = { step: stepOf(a), at: Date.now(), kind: 'gave', billId: a.b.id, undo: u, back: '#/ask/' + enc(key), words: { title: `${who} ${has} this ask now.`, sub } };
      location.hash = '#/done/' + enc(id);
    } catch (e) { err.textContent = (e && e.message) || 'It did not save. Try again.'; err.hidden = false; }
    finally { ctx.busy.delete(id); }
  }));
}
