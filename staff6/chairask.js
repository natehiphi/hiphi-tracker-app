// R-316 W3 (live since Nate's yes and migration 183): every ask to a chair is recorded and the team sees it.
// After any "Email the chair" the app asks "Did you send it?". Yes saves a conversation with the chair (one per chair, on
// each bill the email named), filled in, with its answer and committee. From then on every teammate's row reads "Asked by
// Kevin Mon 3/16 · no reply yet" in place of the button, and "They replied" records the chair's reply in one tap
// (Will schedule · Said no · Left a message). Before this, an "Email the chair" only opened a mail program: on 16 Mar
// Kevin and Nate were both told to email Rep. Takayama about SB2175, and nobody could tell if anyone had.
// The record itself is model.js chairAskOf; the emails' words are model.js chairAskMail.
// Staff v6 (R-336 V13, V24, F135-F138):
//   - "Yes, I sent it" also closes the ask handed to someone ("Ask Rep. Kila for a hearing on HB1"), whoever asked: the ask
//     is made, so nobody keeps a to-do for it (V24: a helper's handed-off ask stayed after it was sent);
//   - "Said no" is never a dead end: the next steps follow it (the vice chair, the companion bill, Not pushing this bill);
//   - "I asked another way" logs an ask made by phone, in person or another email, with "This was an ask for a hearing"
//     ticked, so it counts as the ask, and unticked it is a plain talk with the chair (V24, F138);
//   - one chair of a joint committee can be asked on its own, and only that chair is marked (V24, chairsOf).
import { S, DB, DEMO, esc, advocate, hooks } from './data.js';
import { ASK_LOG, ASK_ANSWERS, ASK_MAILS, chairAskOf, chairIdsOf, askReply, billById, chairMail, legById, legsOf,
  legNotesAll, companionsOf, billByNum, billRoute, hearingAhead, codesOf, whenAt } from './model.js';
import { icon, btn, toast, menuSheet, sheetOpen, openSheet, closeSheet, ASK_TAB } from './ui.js';
import { STATES, chairKey } from './verbs.js';   // R-344: the chair-ask states' shapes
import { sayWords } from './steps.js';   // a bill as staff say it, with no draft code (D15); steps.js imports this file too (used in functions only)

const HST = { timeZone: 'Pacific/Honolulu' };
const dayAt = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
const firstOf = id => id && id === S.me?.id ? 'you' : (advocate(id)?.full_name || 'Someone').split(' ')[0];
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
// "Rep. Kila", "Sen. San Buenaventura": a chair as staff say it.
export const chairWho = id => { const l = legById(id); return l ? `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${(l.sort_name || l.name).split(',')[0]}` : 'The chair'; };
export const askDay = dayAt;

// "Asked by Kevin Mon 3/16 · no reply yet" (or "· will schedule", "· said no", "· left a message").
export const askLine = a => `Asked by ${firstOf(a.by)} ${dayAt(a.at)} · ${askReply(a)}`;
// The chip that stands in for the button once a bill's chair was asked: a button, since a tap records the reply.
export function askedChip(b, code, a = chairAskOf(b, code)) {
  if (!a) return '';
  const tone = a.answer === 'will_schedule' ? 'ok' : a.answer === 'said_no' ? 'warn' : '';
  // R-344 Rule 2: where the ask is, as its one shape (verbs.js STATES.chair: hourglass no reply yet, phone left a message,
  // calendar-check will schedule, thumbs-down said no); the check meant "done", "approve" and "asked" at once (Rule 5).
  return `<button type="button" class="ca-chip${tone ? ' ' + tone : ''}" data-askanswer="${esc(b.id)}|${esc(code)}" data-state="chair:${esc(chairKey(a))}" aria-haspopup="dialog" aria-label="${esc(askLine(a))}. Record the chair’s answer">${icon(STATES.chair[chairKey(a)].icon)}<span>${esc(askLine(a))}</span>${icon('chevron-right', { cls: 'ca-chev' })}</button>`;
}

// ---- the ask handed to someone (W14, R-329): a to-do with this title, so it shows on their Today with its due day ----
// (push.js re-exports both, so every screen that imported them from there keeps working.)
export const ASK_TODO = /^Ask (?:the chairs?|(?:Rep|Sen)\. .+?) for a hearing on (\S+)/;
export const askTodoOf = b => (S.todos?.[b.id] || []).find(t => !t.done && ASK_TODO.test(t.title || '')) || null;

// ---- each chair of a committee, asked or not (V24) ----
// The rows that count as an ask of ONE chair about one bill (the record chairAskOf reads, for that chair alone), so asking
// Sen. San Buenaventura about a joint HHS/CPN bill never marks Sen. Keohokalole asked.
const notesOf = (b, code, legId) => legNotesAll().filter(n => n.bill_id === b.id && n.legislator_id === legId && (!n.committee || !code || n.committee === code))
  .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
// [{ id, code, who, email, asked: { by, at } | null }] for each chair of the committee, in the referral's order.
export function chairsOf(b, code) {
  return codesOf(code).map(k => {
    const id = chairIdsOf(k)[0]; if (!id) return null;
    const m = chairMail(k), first = notesOf(b, code, id)[0];
    return { id, code: k, who: m ? `${m.title} ${m.last}` : chairWho(id), email: m?.email || '', asked: first ? { by: first.advocate_id, at: new Date(first.created_at).getTime() } : null };
  }).filter(Boolean);
}

const sentence = (answer, who, nums, code, decide) => {
  const what = decide ? `a vote on ${nums}` : `a hearing on ${nums}`;
  return answer === 'will_schedule' ? `${who} will schedule ${what} (${code}).`
    : answer === 'said_no' ? `${who} said no to ${what} (${code}).`
    : answer === 'left_message' ? `Left a message for ${who} about ${what} (${code}).`
    : `Asked for ${what} (${code}).`;   // "Asked for a hearing on" is the words logAsk and Help's job steps look for
};
// Save the ask (or the reply) on each bill, one row per chair, with Undo. items: [{ id (bill), code, legs (chairs; all of
// the committee's when absent) }]. `note`: how it was asked and what was said ("I asked another way"). `next`: after "Said
// no", offer the next steps.
export async function recordAsk(items, answer = 'asked', { decide = false, note = '', next = true } = {}) {
  const list = items.map(x => ({ ...x, b: billById(x.id), legs: x.legs || chairIdsOf(x.code) })).filter(x => x.b && x.legs.length);
  if (!list.length) { toast('No chair is listed for this committee, so nothing was saved.', { err: true }); return; }
  const made = [], closed = [], who = x => x.legs.length === 1 && chairIdsOf(x.code).length > 1 ? chairWho(x.legs[0]) : chairMail(x.code)?.who || 'The chair';
  try {
    for (const x of list) for (const id of x.legs)
      made.push([await DB.addLegNote(id, x.b.id, sentence(answer, who(x), x.b.bill_number, x.code, decide) + (note ? ` ${note}` : ''), { answer, committee: x.code }), id]);
    // V24: the ask is made, so the to-do that handed it to someone is done, theirs or yours; Undo opens it again.
    if (answer === 'asked') for (const x of list) { const t = askTodoOf(x.b); if (t) { await DB.updateTodo(x.b.id, t.id, { done: true }); closed.push([x.b.id, t.id]); } }
  } catch (e) { toast(e, { err: true }); return; }
  const what = list.length === 1 ? sayWords(list[0].b) : plural(list.length, 'bill');
  toast(answer === 'asked' ? `Saved: asked ${who(list[0])}${list.length > 1 ? ` about ${what}` : ''}. The team sees it.` : `Saved: ${ASK_ANSWERS.find(x => x[0] === answer)[1].toLowerCase()}${list.length > 1 ? `, on ${what}` : ''}.`,
    { ok: answer !== 'said_no', undo: async () => { for (const [n, id] of made) await DB.delLegNote(n.id, id); for (const [bid, tid] of closed) await DB.updateTodo(bid, tid, { done: false }); hooks.render(); } });
  hooks.render();
  // V13: "Said no" offers what to do next at once (it was a dead end).
  if (answer === 'said_no' && next) setTimeout(() => saidNoSheet(list.map(x => x.b), list[0].code), DEMO ? 250 : 400);
}

// The bills of one ask, each with a tick, all ticked (critic: one call about SB 2470 must not tell the team that SB 2695
// and SB 3029 were asked too). Only when there are two or more.
const billTicks = (bills, legend) => bills.length < 2 ? '' : `<fieldset class="ca-fs"><legend>${esc(legend)}</legend>${bills.map(b => `<label class="ca-ck"><input type="checkbox" name="ca-bill" value="${esc(b.id)}" checked><span>${esc(sayWords(b))}</span></label>`).join('')}</fieldset>`;
const ticked = (d, bills) => bills.length < 2 ? bills.map(b => b.id) : [...d.querySelectorAll('[name="ca-bill"]:checked')].map(x => x.value);

// After the mail program opens: "Did you send it?" One bill: Yes or Not yet (two clicks from the email, spec 8). Two or
// more: the same question with each bill ticked, so a mail cut down to one bill records only that one.
export function sentSheet(e) {
  if (!e || sheetOpen?.()) return;
  const bills = e.items.map(x => billById(x.id)).filter(Boolean), what = bills.length === 1 ? sayWords(bills[0]) : plural(bills.length, 'bill');
  if (bills.length < 2) return menuSheet({ title: 'Did you send it?', items: [
    { label: 'Yes, I sent it', icon: 'check', sub: `Saved for the team: you asked ${e.who} ${e.decide ? 'to schedule a vote' : 'for a hearing'}`, run: () => recordAsk(e.items, 'asked', { decide: e.decide }) },
    { label: 'Not yet', icon: 'clock', sub: 'Nothing is saved; the button stays', run: () => {} }] });
  openSheet({ title: 'Did you send it?', size: 'auto',
    body: `<div class="ca-sheet"><p class="ca-lead">${esc(`To ${e.who} · ${what}`)}</p>${billTicks(bills, 'Which bills did it ask about?')}<p class="err" id="ca-err" role="alert" hidden>${icon('circle-alert')}Tick the bills the email asked about.</p></div>`,
    foot: `${btn('Not yet', { kind: 'text', attrs: { 'data-no': '1' } })}${btn('Yes, I sent it', { kind: 'primary', icon: 'check', attrs: { 'data-go': '1' } })}`,
    wire: d => {
      d.querySelector('[data-no]').onclick = () => closeSheet();
      d.querySelector('[data-go]').onclick = async () => {
        const ids = new Set(ticked(d, bills)); if (!ids.size) { d.querySelector('#ca-err').hidden = false; return; }
        await closeSheet({ silent: true });
        await recordAsk(e.items.filter(x => ids.has(x.id)), 'asked', { decide: e.decide });
      };
    } });
}
// The asker's Follow up (Get hearings, spec 6 and 8): the same mail again ("Following up: …"), or what the chair said,
// in one sheet, so the reply is two clicks from the row (F136) and the follow-up mail is too.
// The replies' words, the same in "They replied" and Follow up (C-10): "We left a message" is ours, never read as the
// chair having left one, with what it does.
const REPLY_LABEL = { left_message: 'We left a message' };
const REPLY_SUB = { will_schedule: 'Record their reply', said_no: 'Record it, then see what to do next', left_message: 'Record it; the follow-up clock starts again' };
// Each answer wears its state's shape (verbs.js STATES.chair), the same as the chip it becomes (R-344 Rule 2).
const shapeOf = (k, ic) => STATES.chair[k]?.icon || ic;
const replies = () => ASK_ANSWERS.filter(([k]) => k !== 'asked').map(([k, label, ic]) => [k, REPLY_LABEL[k] || label, shapeOf(k, ic)]);
// A joint committee's ask went to two chairs: the sheet asks who replied (each chair, or both: "Both chairs" is chosen, so
// the reply is still two clicks, spec 8), and the answer is saved for that chair alone (V24: one chair of a joint committee
// marks only that chair; Nate's walk: HB 756's reply was saved for both Sen. Keohokalole and Sen. San Buenaventura).
// askWords then asks the other chair by name. Items: [{ label, icon, sub, run(legs) }] (legs null: both chairs).
function replySheet(b, code, { title, items }) {
  const chairs = b ? chairsOf(b, code).filter(c => c.asked) : [];
  if (chairs.length < 2) return menuSheet({ title, items: items.filter(Boolean).map(it => ({ ...it, run: () => it.run(null) })) });
  const list = items.filter(Boolean);
  openSheet({ title, pop: true, body: `<fieldset class="ca-fs ca-whorep"><legend>Who replied?</legend><div class="ca-how">${chairs.map(c => `<label class="ca-rd"><input type="radio" name="ca-rep" value="${esc(c.id)}"><span>${esc(c.who)}</span></label>`).join('')}<label class="ca-rd"><input type="radio" name="ca-rep" value="both" checked><span>Both chairs</span></label></div></fieldset>
    <div class="sv-menu">${list.map((it, i) => `<button type="button" data-ri="${i}">${icon(it.icon || 'chevron-right')}<span class="body"><span class="title">${esc(it.label)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}</span></button>`).join('')}</div>`,
    wire: d => d.querySelectorAll('[data-ri]').forEach(el => el.onclick = async () => {
      const v = d.querySelector('[name="ca-rep"]:checked')?.value || 'both', legs = v === 'both' || list[+el.dataset.ri].any ? null : [+v || v];
      await closeSheet({ silent: true }); await list[+el.dataset.ri].run(legs);
    }) });
}
export function followSheet(b, code, { mail = null } = {}) {
  if (!b || sheetOpen?.()) return;
  const m = chairMail(code), two = (m?.n || 1) > 1, a = chairAskOf(b, code);
  replySheet(b, code, { title: esc(`Follow up with ${m?.who || 'the chair'}`), items: [
    mail ? { label: `Email ${two ? 'the chairs' : 'the chair'} again`, icon: 'mail', sub: `Your mail again, its subject starting “Following up”${a ? ` (you asked ${dayAt(a.at)})` : ''}`, any: true, run: () => { location.href = mail.href; afterMail(mail.href); } } : null,
    ...replies().map(([k, label, ic]) => ({ label, icon: ic, sub: REPLY_SUB[k] || '', run: legs => recordAsk([{ id: b.id, code, ...(legs ? { legs } : {}) }], k) })),
  ] });
}
// "They replied": the one-tap answers (Get hearings' Waiting on a reply rows, the step card, the "Asked by …" chip). For one
// bill asked of a joint committee's two chairs, the sheet asks who replied as well.
export function answerSheet(ids, code) {
  const bills = ids.map(billById).filter(Boolean), m = chairMail(code), a = bills.length === 1 ? chairAskOf(bills[0], code) : null;
  const items = (a ? replies() : ASK_ANSWERS.map(([k, label, ic]) => [k, REPLY_LABEL[k] || label, shapeOf(k, ic)]))
    .map(([k, label, ic]) => ({ label, icon: ic, sub: k === 'asked' && bills.length > 1 ? `On all ${bills.length} bills` : REPLY_SUB[k] || '', run: legs => recordAsk(ids.map(id => ({ id, code, ...(legs ? { legs } : {}) })), k) }));
  replySheet(a ? bills[0] : null, code, { title: a ? `What did ${m?.who || 'the chair'} say?` : `Record the ask to ${m?.who || 'the chair'}`, items });
}
export const askDone = (b, code) => answerSheet([b.id], code);

// ---- "Said no": what to do next (V13) ----
// Never a dead end (B-3): the vice chair (their page has Email, Call and Log a talk), the companion bill when it is moving,
// how to ask (Help), and for the bill's owner "Not pushing this bill" (the bill's Mute: off your lists and alerts until it
// gets a hearing, with Undo). Nothing here sends anything by itself.
export function saidNoSheet(bills, code) {
  const list = (bills || []).filter(Boolean); if (!list.length || sheetOpen?.()) return;
  const b = list[0], m = chairMail(code), go = href => () => (S.go ? S.go(href) : (location.hash = href));
  const vices = legsOf(code).filter(x => Object.values(x.roles || {}).includes('vice_chair'));
  const comp = list.length === 1 ? companionsOf(b).map(n => billByNum(n, b.session_year)).find(x => x && hearingAhead(x)) : null;
  const owner = list.length === 1 && (S.assignments?.[b.id] || []).includes(S.me?.id);
  menuSheet({ title: `${m?.who || 'The chair'} said no. What next?`, items: [
    ...vices.slice(0, 2).map(v => ({ label: `Talk to the vice chair, ${chairWho(v.l.id)}`, icon: 'user-round', sub: 'Their page has Email, Call and Log a talk', run: go(`#/legislator/${v.l.id}`) })),
    comp ? { label: `Back its companion, ${sayWords(comp)}`, icon: 'link', sub: `Heard ${whenAt(hearingAhead(comp).scheduled_at)}`, run: go(billRoute(comp)) } : null,
    owner ? { label: 'Not pushing this bill', icon: 'bell-off', sub: 'Off your lists and alerts until it gets a hearing', run: () => notPushing(b) } : null,
    { label: 'How to ask for a hearing', icon: 'circle-help', sub: 'Who else can help, step by step', run: go('#/help/hearing') },
    { label: 'Leave it for now', icon: 'clock', sub: 'It stays on ' + ASK_TAB + ' as Said no', run: () => {} },
  ] });
}
// V24: on a bill waiting for a hearing, Mute reads "Not pushing this bill" (the same call as the bill page's Mute).
export async function notPushing(b) {
  try {
    await DB.mute(b.id, true); hooks.render();
    toast(`Not pushing ${sayWords(b)}: it leaves your lists and alerts until it gets a hearing.`, { undo: async () => { await DB.mute(b.id, false); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}

// ---- "I asked another way" (F138): a call, a visit or another email, logged as the ask ----
// The sheet opens with "This was an ask for a hearing" ticked: saved, it is the ask (every teammate's row says "Asked by
// Kevin"). Unticked, it is a plain talk with the chair (Log a conversation, filled in), never counted as an ask (V24).
const HOW = [['phone', 'By phone', 'By phone.'], ['person', 'In person', 'In person.'], ['email', 'Another email', 'By email.'], ['message', 'A text or message', 'By text or message.']];
export function askAnotherWay(bills, code, { decide = false } = {}) {
  const list = (bills || []).filter(Boolean); if (!list.length) return;
  const chairs = chairsOf(list[0], code), joint = chairs.length > 1;
  const what = list.length === 1 ? sayWords(list[0]) : plural(list.length, 'bill');
  const who = joint ? `<fieldset class="ca-fs"><legend>Which chair did you ask?</legend>${chairs.map(c => `<label class="ca-ck"><input type="checkbox" name="ca-leg" value="${esc(c.id)}"${c.asked ? '' : ' checked'}><span>${esc(c.who)}${c.asked ? ` <span class="ca-sub">asked ${esc(dayAt(c.asked.at))}</span>` : ''}</span></label>`).join('')}</fieldset>` : '';
  const body = `<div class="ca-sheet">
    <p class="ca-lead">${esc(`${joint ? 'The chairs' : chairs[0]?.who || 'The chair'} · ${what}`)}</p>
    ${who}
    ${billTicks(list, 'Which bills was it about?')}
    <fieldset class="ca-fs"><legend>How did you ask?</legend><div class="ca-how">${HOW.map(([k, l], i) => `<label class="ca-rd"><input type="radio" name="ca-how" value="${k}"${i === 0 ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
    <div class="field"><label for="ca-note">What was said <span class="ca-sub">(optional)</span></label><textarea id="ca-note" rows="3" maxlength="1000" placeholder="They will look at it next week"></textarea></div>
    <label class="ca-ck ca-was"><input type="checkbox" id="ca-was" checked><span>${decide ? 'This was an ask to schedule a vote' : 'This was an ask for a hearing'}</span></label>
    <p class="ca-hint" id="ca-hint" aria-live="polite">Saved as the ask: the team sees who asked and when.</p>
    <p class="err" id="ca-err" role="alert" hidden>${icon('circle-alert')}<span id="ca-err-t">Pick the chair you asked.</span></p>
  </div>`;
  openSheet({ title: 'Log how you asked', size: 'auto', body, foot: btn('Save', { kind: 'primary', icon: 'check', attrs: { 'data-go': '1' } }),
    wire: d => {
      const was = d.querySelector('#ca-was'), hint = d.querySelector('#ca-hint'), err = d.querySelector('#ca-err');
      was.onchange = () => { hint.textContent = was.checked ? 'Saved as the ask: the team sees who asked and when.' : 'Not an ask: Save opens Log a conversation, which does not count as asking.'; };
      d.querySelector('[data-go]').onclick = async () => {
        const how = HOW.find(h => h[0] === (d.querySelector('[name="ca-how"]:checked')?.value || 'phone')), note = d.querySelector('#ca-note').value.trim();
        const legs = joint ? [...d.querySelectorAll('[name="ca-leg"]:checked')].map(x => +x.value) : chairs.map(c => c.id);
        if (joint && !legs.length) { d.querySelector('#ca-err-t').textContent = 'Pick the chair you asked.'; err.hidden = false; return; }
        const ids = new Set(ticked(d, list)), picked = list.filter(b => ids.has(b.id));
        if (!picked.length) { d.querySelector('#ca-err-t').textContent = 'Tick the bills you asked about.'; err.hidden = false; return; }
        const words = [how[2], note].filter(Boolean).join(' ');
        if (!was.checked) {   // a talk, not an ask: the conversation sheet takes this one's place, filled in
          const { logConversation } = await import('./conversation.js');
          return logConversation({ bill: picked[0], legislatorIds: legs.length ? legs : chairs.map(c => c.id), text: words });
        }
        await closeSheet({ silent: true });
        await recordAsk(picked.map(b => ({ id: b.id, code, legs })), 'asked', { decide, note: words });
      };
    } });
}

// One listener for the whole app, so every chair email (Today, Hearings, the bill page, Holding our bills, Quick look)
// asks the same question, wherever it is drawn.
let installed = false;
export function installAskWatch() {
  if (installed) return; installed = true;
  document.addEventListener('click', ev => {
    if (!ASK_LOG()) return;
    const ans = ev.target.closest?.('[data-askanswer]');
    if (ans) { ev.preventDefault(); const [id, code] = ans.dataset.askanswer.split('|'); return answerSheet([id], code); }
    const a = ev.target.closest?.('a[href^="mailto:"]');
    if (a) afterMail(a.getAttribute('href'));
  });
}
// A chair email opened from a menu (location.href) asks too.
export function afterMail(href) {
  const e = ASK_MAILS.get(href); if (!e || !ASK_LOG()) return;
  setTimeout(() => sentSheet(e), DEMO ? 400 : 900);
}
// Live, once 183 is in: every chair ask, so each teammate's rows say who asked.
export function loadAsks() {
  if (!ASK_LOG() || DEMO) return;
  DB.chairAsks().then(() => hooks.render()).catch(() => {});
}
