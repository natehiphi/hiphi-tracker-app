// R-316 W3 (practice copy until Nate's yes and migration 183): every ask to a chair is recorded and the team sees it.
// After any "Email the chair" the app asks "Did you send it?". Yes saves a conversation with the chair (one per chair, on
// each bill the email named), filled in, with its answer and committee. From then on every teammate's row reads "Asked by
// Kevin Mon 3/16 · no reply yet" in place of the button, and the answer chip records the chair's reply in one tap
// (Asked for a hearing · Will schedule · Said no · Left a message). Before this, an "Email the chair" only opened a mail
// program: on 16 Mar Kevin and Nate were both told to email Rep. Takayama about SB2175, and nobody could tell if anyone had.
// The record itself is model.js chairAskOf; the emails' words are model.js chairAskMail.
import { S, DB, DEMO, esc, advocate, hooks } from './data.js';
import { ASK_LOG, ASK_ANSWERS, ASK_MAILS, chairAskOf, chairIdsOf, askReply, billById, billSay, chairMail } from './model.js';
import { icon, toast, menuSheet, sheetOpen } from './ui.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const dayAt = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
const firstOf = id => id && id === S.me?.id ? 'you' : (advocate(id)?.full_name || 'Someone').split(' ')[0];
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// "Asked by Kevin Mon 3/16 · no reply yet" (or "· will schedule", "· said no", "· left a message").
export const askLine = a => `Asked by ${firstOf(a.by)} ${dayAt(a.at)} · ${askReply(a)}`;
// The chip that stands in for the button once a bill's chair was asked: a button, since a tap records the reply.
export function askedChip(b, code, a = chairAskOf(b, code)) {
  if (!a) return '';
  const tone = a.answer === 'will_schedule' ? 'ok' : a.answer === 'said_no' ? 'warn' : '';
  return `<button type="button" class="ca-chip${tone ? ' ' + tone : ''}" data-askanswer="${esc(b.id)}|${esc(code)}" aria-haspopup="dialog" aria-label="${esc(askLine(a))}. Record the chair’s answer">${icon(a.answer === 'said_no' ? 'circle-x' : 'check')}<span>${esc(askLine(a))}</span>${icon('chevron-right', { cls: 'ca-chev' })}</button>`;
}

const sentence = (answer, who, nums, code, decide) => {
  const what = decide ? `decision making on ${nums}` : `a hearing on ${nums}`;
  return answer === 'will_schedule' ? `${who} will schedule ${what} (${code}).`
    : answer === 'said_no' ? `${who} said no to ${what} (${code}).`
    : answer === 'left_message' ? `Left a message for ${who} about ${what} (${code}).`
    : `Asked for ${what} (${code}).`;   // "Asked for a hearing on" is the words logAsk and Help's job steps look for
};
// Save the ask (or the reply) on each bill, one row per chair, with Undo. items: [{ id (bill), code, legs (chairs; all of
// the committee's when absent) }].
export async function recordAsk(items, answer = 'asked', { decide = false } = {}) {
  const list = items.map(x => ({ ...x, b: billById(x.id), legs: x.legs || chairIdsOf(x.code) })).filter(x => x.b && x.legs.length);
  if (!list.length) { toast('No chair is listed for this committee, so nothing was saved.', { err: true }); return; }
  const made = [], who = x => x.legs.length === 1 && x.legs[0] !== chairIdsOf(x.code)[0] ? legWho(x.legs[0]) : chairMail(x.code)?.who || 'The chair';
  try {
    for (const x of list) for (const id of x.legs)
      made.push([await DB.addLegNote(id, x.b.id, sentence(answer, who(x), x.b.bill_number, x.code, decide), { answer, committee: x.code }), id]);
  } catch (e) { toast(e, { err: true }); return; }
  const what = list.length === 1 ? billSay(list[0].b) : plural(list.length, 'bill');
  toast(answer === 'asked' ? `Saved: asked ${who(list[0])}${list.length > 1 ? ` about ${what}` : ''}.` : `Saved: ${ASK_ANSWERS.find(x => x[0] === answer)[1].toLowerCase()}${list.length > 1 ? `, on ${what}` : ''}.`,
    { ok: true, undo: async () => { for (const [n, id] of made) await DB.delLegNote(n.id, id); hooks.render(); } });
  hooks.render();
}
const legWho = id => { const l = (S.legislators || []).find(x => x.id === id); return l ? `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${(l.sort_name || l.name).split(',')[0]}` : 'The chair'; };

// After the mail program opens: "Did you send it?"
export function sentSheet(e) {
  if (!e || sheetOpen?.()) return;
  const bills = e.items.map(x => billById(x.id)).filter(Boolean), what = bills.length === 1 ? billSay(bills[0]) : plural(bills.length, 'bill');
  menuSheet({ title: 'Did you send it?', items: [
    { label: 'Yes, I sent it', icon: 'send', sub: `Saved for the team: you asked ${e.who} for ${e.decide ? 'decision making' : bills.length > 1 ? `hearings on ${what}` : 'a hearing'}`, run: () => recordAsk(e.items, 'asked', { decide: e.decide }) },
    { label: 'Not yet', icon: 'clock', sub: 'Nothing is saved; the button stays', run: () => {} }] });
}
// The one-tap answers: on a P1 chair row's Done, and on the "Asked by …" chip.
export function answerSheet(ids, code) {
  const bills = ids.map(billById).filter(Boolean), m = chairMail(code), a = bills.length === 1 ? chairAskOf(bills[0], code) : null;
  menuSheet({ title: a ? `What did ${m?.who || 'the chair'} say?` : `Record the ask to ${m?.who || 'the chair'}`, items: ASK_ANSWERS
    .filter(([k]) => !(a && k === 'asked'))
    .map(([k, label, ic]) => ({ label, icon: ic, sub: k === 'asked' && bills.length > 1 ? `On all ${bills.length} bills` : '', run: () => recordAsk(ids.map(id => ({ id, code })), k) })) });
}
export const askDone = (b, code) => answerSheet([b.id], code);

// One listener for the whole app, so every chair email (Today, This week, the push board, the bill page, Holding our
// bills, Quick look) asks the same question, wherever it is drawn.
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
